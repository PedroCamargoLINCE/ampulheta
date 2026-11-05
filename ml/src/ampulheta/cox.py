"""Estágio 3 — Camada 2: Cox proporcional, um por transição. Lê só `../data/processos.parquet`.

Covariáveis categóricas: vara, classe e assunto principal. Vara e classe têm a primeira de cada
lista do config como referência; os assuntos com pelo menos `FRACAO_MINIMA_ASSUNTO` dos
processos viram dummies e os demais formam a referência "outros assuntos". Ano de ajuizamento
fica de fora de propósito: o uso real é prever processos novos, e um modelo que depende do ano não
extrapola. A fase atual entra como um Cox separado para cada transição de `transicoes` no config
(ajuizamento → sentença, audiência → sentença), não como covariável "teve audiência", que daria
viés de tempo imortal. Validação temporal (ADR-004): ajusta em ajuizados até 2021 e mede em 2022
em diante, com concordance index, Brier integrado (contra a curva Kaplan-Meier do treino) e
calibração por grupo em horizontes fixos. O teste de proporcionalidade é reportado, não
corrigido. O modelo final, cujos hazard ratios são publicados, é ajustado em todos os processos.
Escreve `models/cox.json`.
"""
from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.statistics import proportional_hazard_test
from sksurv.metrics import integrated_brier_score
from sksurv.util import Surv

from .modelo import TRANSICAO_PADRAO, tempo_em_meses, tempos_da_transicao

ANO_CORTE = 2021          # treino: ajuizados até aqui; teste: depois
N_MINIMO = 30             # dummies com menos processos que isso no ajuste ficam fora (ex.: vara criada depois do corte)
FRACAO_MINIMA_ASSUNTO = 0.01   # assuntos abaixo disso caem em "outros assuntos"
HORIZONTE_BRIER = 36      # meses; dentro do acompanhamento mínimo do teste
HORIZONTES_CALIBRACAO = (12, 24)
FORA = ("t", "evento", "ano")  # colunas da matriz que não são covariáveis


def assuntos_frequentes(processos: pd.DataFrame) -> list[dict[str, Any]]:
    """Assuntos principais com pelo menos FRACAO_MINIMA_ASSUNTO dos processos, do mais comum ao
    menos comum, com o nome mais frequente de cada código (nulo se o raw não trouxe nome)."""
    fracao = processos.assunto_principal.value_counts(normalize=True)
    nomes = processos.get("assunto_principal_nome", pd.Series(index=processos.index, dtype=object))
    usados = []
    for codigo in fracao[fracao >= FRACAO_MINIMA_ASSUNTO].index:
        n = nomes[processos.assunto_principal == codigo].dropna()
        usados.append({"codigo": int(codigo), "nome": n.mode().iloc[0] if len(n) else None})
    return usados


def montar_matriz(processos: pd.DataFrame, cfg: dict[str, Any], assuntos: list[dict[str, Any]],
                  referencia: bool = True) -> pd.DataFrame:
    """Tempo em meses, evento, ano e dummies de vara, classe e assunto. Com `referencia`, a
    primeira vara e a primeira classe do config ficam sem coluna (Cox); sem, entram todas (árvores)."""
    df = pd.DataFrame({"t": tempo_em_meses(processos.tempo_dias), "evento": processos.evento.astype(int),
                       "ano": pd.to_datetime(processos.data_ajuizamento).dt.year})
    for nome, coluna in (("vara", "vara_codigo"), ("classe", "classe_codigo")):
        codigos = [c["codigo"] for c in cfg[f"{nome}s"]]
        for c in codigos[1:] if referencia else codigos:
            df[f"{nome}_{c}"] = (processos[coluna] == c).astype(int)
    for a in assuntos:
        df[f"assunto_{a['codigo']}"] = (processos.assunto_principal == a["codigo"]).astype(int)
    return df


def dividir(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    return df[df.ano <= ANO_CORTE], df[df.ano > ANO_CORTE]


def ajustar(df: pd.DataFrame) -> CoxPHFitter:
    """Ajusta só com as dummies que têm pelo menos N_MINIMO processos; as demais caem na referência."""
    usadas = [c for c in df.columns if c not in FORA and df[c].sum() >= N_MINIMO]
    return CoxPHFitter().fit(df[["t", "evento", *usadas]], duration_col="t", event_col="evento")


def covariaveis(cph: CoxPHFitter, df: pd.DataFrame) -> pd.DataFrame:
    return df[list(cph.params_.index)]


def hazard_ratios(cph: CoxPHFitter) -> list[dict[str, Any]]:
    s = cph.summary
    return [{"covariavel": k, "hazard_ratio": round(float(r["exp(coef)"]), 3),
             "ic_inferior": round(float(r["exp(coef) lower 95%"]), 3),
             "ic_superior": round(float(r["exp(coef) upper 95%"]), 3), "p": float(r["p"])}
            for k, r in s.iterrows()]


def proporcionalidade(cph: CoxPHFitter, df: pd.DataFrame) -> list[dict[str, Any]]:
    r = proportional_hazard_test(cph, df[["t", "evento", *cph.params_.index]], time_transform="rank").summary
    return [{"covariavel": k[0] if isinstance(k, tuple) else k, "p": float(v["p"])} for k, v in r.iterrows()]


def brier_integrado(S: np.ndarray, treino: pd.DataFrame, teste: pd.DataFrame) -> float:
    """Brier integrado de 1 a HORIZONTE_BRIER meses; S tem uma linha por processo do teste e uma
    coluna por mês. A censura é estimada no treino."""
    y_treino = Surv.from_arrays(treino.evento.astype(bool), treino.t)
    y_teste = Surv.from_arrays(teste.evento.astype(bool), teste.t)
    return round(float(integrated_brier_score(y_treino, y_teste, S, meses_brier())), 4)


def meses_brier() -> np.ndarray:
    return np.arange(1, HORIZONTE_BRIER + 1)


def brier_kaplan_meier(treino: pd.DataFrame, teste: pd.DataFrame) -> float:
    """Referência sem covariáveis: a mesma curva Kaplan-Meier do treino para todo processo do teste."""
    km = KaplanMeierFitter().fit(treino.t, treino.evento)
    S = np.tile(km.survival_function_at_times(meses_brier()).to_numpy(), (len(teste), 1))
    return brier_integrado(S, treino, teste)


def calibracao(prever: Callable[[int], np.ndarray], teste: pd.DataFrame) -> list[dict[str, Any]]:
    """`prever(h)` dá a probabilidade de sentença até h meses para cada processo do teste. Por grupo
    do previsto (até dez, por decil; com poucas combinações de covariáveis saem menos), compara
    com a observada (Kaplan-Meier do grupo, que respeita a censura)."""
    linhas = []
    for h in HORIZONTES_CALIBRACAO:
        previsto = prever(h)
        grupo = pd.qcut(previsto, 10, labels=False, duplicates="drop")
        for g in sorted(set(grupo)):
            sel = grupo == g
            km = KaplanMeierFitter().fit(teste.t[sel], teste.evento[sel])
            linhas.append({"horizonte_meses": h, "grupo": int(g) + 1, "n": int(sel.sum()),
                           "previsto": round(float(previsto[sel].mean()), 3),
                           "observado": round(float(1 - km.survival_function_at_times([h]).iloc[0]), 3)})
    return linhas


def sem_teste(teste: pd.DataFrame) -> str | None:
    """Motivo para não validar no tempo, ou None quando o teste tem dados para isso."""
    if not len(teste):
        return "sem processos no teste"
    if not teste.evento.sum():
        return "sem eventos no teste"
    if teste.t.max() <= HORIZONTE_BRIER:
        return f"acompanhamento do teste não passa de {HORIZONTE_BRIER} meses"
    return None


def validacao_temporal(df: pd.DataFrame) -> dict[str, Any]:
    treino, teste = dividir(df)
    v = {"treino": {"ate": ANO_CORTE, "n": int(len(treino)), "eventos": int(treino.evento.sum())},
         "teste": {"de": ANO_CORTE + 1, "n": int(len(teste)), "eventos": int(teste.evento.sum())}}
    if motivo := sem_teste(teste):
        return v | {"indisponivel": motivo}
    cph = ajustar(treino)
    covs = covariaveis(cph, teste)
    S = cph.predict_survival_function(covs, times=meses_brier()).to_numpy().T
    return v | {
        "covariaveis_fora_do_treino": [c for c in df.columns if c not in FORA and c not in cph.params_.index],
        "concordance_index": {"treino": round(float(cph.concordance_index_), 4),
                              "teste": round(float(cph.score(teste[["t", "evento", *cph.params_.index]],
                                                             scoring_method="concordance_index")), 4)},
        "brier_integrado": {"cox": brier_integrado(S, treino, teste), "kaplan_meier": brier_kaplan_meier(treino, teste),
                            "horizonte_meses": HORIZONTE_BRIER},
        "calibracao": calibracao(lambda h: 1 - cph.predict_survival_function(covs, times=[h]).iloc[0].to_numpy(), teste),
    }


def modelar_transicao(processos: pd.DataFrame, cfg: dict[str, Any], assuntos: list[dict[str, Any]],
                      origem: str, destino: str) -> dict[str, Any]:
    df = montar_matriz(tempos_da_transicao(processos, origem, destino), cfg, assuntos)
    cph = ajustar(df)
    return {"origem": origem, "destino": destino, "n": int(len(df)), "eventos": int(df.evento.sum()),
            "hazard_ratios": hazard_ratios(cph), "proporcionalidade": proporcionalidade(cph, df),
            "validacao_temporal": validacao_temporal(df)}


def modelar_cox(processos: pd.DataFrame, cfg: dict[str, Any]) -> dict[str, Any]:
    assuntos = assuntos_frequentes(processos)
    return {
        "metodo": "cox",
        "snapshot": str(processos.data_censura.iloc[0]),
        "covariaveis": {"vara": {"referencia": str(cfg["varas"][0]["codigo"])},
                        "classe": {"referencia": str(cfg["classes"][0]["codigo"])},
                        "assunto": {"referencia": "outros assuntos", "fracao_minima": FRACAO_MINIMA_ASSUNTO,
                                    "usados": assuntos}},
        "transicoes": [modelar_transicao(processos, cfg, assuntos, o, d)
                       for o, d in cfg.get("transicoes") or [TRANSICAO_PADRAO]],
    }


def modelar(cfg: dict[str, Any]) -> None:
    processos = pd.read_parquet(Path(cfg["saida"]["data"]) / "processos.parquet")
    cox = modelar_cox(processos, cfg)
    Path("models").mkdir(exist_ok=True)
    Path("models/cox.json").write_text(json.dumps(cox, ensure_ascii=False, indent=1), encoding="utf-8")
    for t in cox["transicoes"]:
        v = t["validacao_temporal"]
        metricas = (f"c-index teste {v['concordance_index']['teste']}, Brier integrado {v['brier_integrado']['cox']} "
                    f"(KM {v['brier_integrado']['kaplan_meier']})" if "indisponivel" not in v else v["indisponivel"])
        print(f"Cox {t['origem']}→{t['destino']}: {len(t['hazard_ratios'])} covariáveis, {metricas}")
    print(f"{len(cox['covariaveis']['assunto']['usados'])} assuntos como covariável -> models/cox.json")
