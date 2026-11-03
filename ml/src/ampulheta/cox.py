"""Estágio 3 — Camada 2: Cox proporcional. Lê só `../data/processos.parquet`.

Covariáveis categóricas: vara e classe, com a primeira de cada lista do config como referência.
Ano de ajuizamento fica de fora de propósito: o uso real é prever processos novos, e um
modelo que depende do ano não extrapola. Validação temporal (ADR-004): ajusta em ajuizados até
2021 e mede em 2022 em diante, com concordance index, Brier integrado (contra a curva
Kaplan-Meier do treino como referência) e calibração por decil em horizontes fixos. O teste
de proporcionalidade é reportado, não corrigido: onde falhar, vira conteúdo. O modelo final,
cujos hazard ratios são publicados, é ajustado em todos os processos.
Escreve `models/cox.json` e `../data/relatorio_modelo.md`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from lifelines import CoxPHFitter, KaplanMeierFitter
from lifelines.statistics import proportional_hazard_test
from sksurv.metrics import integrated_brier_score
from sksurv.util import Surv

from .modelo import tempo_em_meses

ANO_CORTE = 2021          # treino: ajuizados até aqui; teste: depois
N_MINIMO = 30             # dummies com menos processos que isso no ajuste ficam fora (ex.: vara criada depois do corte)
HORIZONTE_BRIER = 36      # meses; dentro do acompanhamento mínimo do teste
HORIZONTES_CALIBRACAO = (12, 24)


def montar_matriz(processos: pd.DataFrame, cfg: dict[str, Any]) -> pd.DataFrame:
    """Tempo em meses, evento e dummies de vara e classe (referência = primeira do config)."""
    df = pd.DataFrame({"t": tempo_em_meses(processos.tempo_dias), "evento": processos.evento.astype(int),
                       "ano": pd.to_datetime(processos.data_ajuizamento).dt.year})
    for nome, coluna in (("vara", "vara_codigo"), ("classe", "classe_codigo")):
        codigos = [c["codigo"] for c in cfg[f"{nome}s"]]
        for c in codigos[1:]:
            df[f"{nome}_{c}"] = (processos[coluna] == c).astype(int)
    return df


def ajustar(df: pd.DataFrame) -> CoxPHFitter:
    """Ajusta só com as dummies que têm pelo menos N_MINIMO processos; as demais caem na referência."""
    dummies = [c for c in df.columns if c not in ("t", "evento", "ano")]
    usadas = [c for c in dummies if df[c].sum() >= N_MINIMO]
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


def brier_integrado(cph: CoxPHFitter, treino: pd.DataFrame, teste: pd.DataFrame) -> dict[str, float]:
    tempos = np.arange(1, HORIZONTE_BRIER + 1)
    y_treino = Surv.from_arrays(treino.evento.astype(bool), treino.t)
    y_teste = Surv.from_arrays(teste.evento.astype(bool), teste.t)
    S_cox = cph.predict_survival_function(covariaveis(cph, teste), times=tempos).to_numpy().T
    km = KaplanMeierFitter().fit(treino.t, treino.evento)
    S_km = np.tile(km.survival_function_at_times(tempos).to_numpy(), (len(teste), 1))
    return {"cox": round(float(integrated_brier_score(y_treino, y_teste, S_cox, tempos)), 4),
            "kaplan_meier": round(float(integrated_brier_score(y_treino, y_teste, S_km, tempos)), 4),
            "horizonte_meses": HORIZONTE_BRIER}


def calibracao(cph: CoxPHFitter, teste: pd.DataFrame) -> list[dict[str, Any]]:
    """Por grupo de probabilidade prevista de sentença até h meses (até dez, por decil; com poucas
    combinações de covariáveis saem menos), compara com a observada (Kaplan-Meier do grupo, que
    respeita a censura)."""
    covs = covariaveis(cph, teste)
    linhas = []
    for h in HORIZONTES_CALIBRACAO:
        previsto = 1 - cph.predict_survival_function(covs, times=[h]).iloc[0].to_numpy()
        grupo = pd.qcut(previsto, 10, labels=False, duplicates="drop")
        for g in sorted(set(grupo)):
            sel = grupo == g
            km = KaplanMeierFitter().fit(teste.t[sel], teste.evento[sel])
            linhas.append({"horizonte_meses": h, "grupo": int(g) + 1, "n": int(sel.sum()),
                           "previsto": round(float(previsto[sel].mean()), 3),
                           "observado": round(float(1 - km.survival_function_at_times([h]).iloc[0]), 3)})
    return linhas


def modelar_cox(processos: pd.DataFrame, cfg: dict[str, Any]) -> dict[str, Any]:
    df = montar_matriz(processos, cfg)
    treino, teste = df[df.ano <= ANO_CORTE], df[df.ano > ANO_CORTE]
    cph_treino = ajustar(treino)
    cph = ajustar(df)
    return {
        "metodo": "cox",
        "covariaveis": {"vara": {"referencia": str(cfg["varas"][0]["codigo"])},
                        "classe": {"referencia": str(cfg["classes"][0]["codigo"])}},
        "n": int(len(df)), "eventos": int(df.evento.sum()),
        "hazard_ratios": hazard_ratios(cph),
        "proporcionalidade": proporcionalidade(cph, df),
        "validacao_temporal": {
            "treino": {"ate": ANO_CORTE, "n": int(len(treino)), "eventos": int(treino.evento.sum())},
            "teste": {"de": ANO_CORTE + 1, "n": int(len(teste)), "eventos": int(teste.evento.sum())},
            "covariaveis_fora_do_treino": [c for c in df.columns if c not in ("t", "evento", "ano") and c not in cph_treino.params_.index],
            "concordance_index": {"treino": round(float(cph_treino.concordance_index_), 4),
                                  "teste": round(float(cph_treino.score(teste[["t", "evento", *cph_treino.params_.index]], scoring_method="concordance_index")), 4)},
            "brier_integrado": brier_integrado(cph_treino, treino, teste),
            "calibracao": calibracao(cph_treino, teste),
        },
    }


def relatorio(cox: dict[str, Any], cfg: dict[str, Any], snapshot: str) -> str:
    nomes = {f"vara_{v['codigo']}": v["nome"] for v in cfg["varas"]}
    nomes |= {f"classe_{c['codigo']}": c["nome"] for c in cfg["classes"]}
    ref_vara = next(v["nome"] for v in cfg["varas"] if str(v["codigo"]) == cox["covariaveis"]["vara"]["referencia"])
    ref_classe = next(c["nome"] for c in cfg["classes"] if str(c["codigo"]) == cox["covariaveis"]["classe"]["referencia"])
    ph = {p["covariavel"]: p["p"] for p in cox["proporcionalidade"]}
    hr = pd.DataFrame([{"covariável": nomes[h["covariavel"]], "hazard ratio": h["hazard_ratio"],
                        "IC 95%": f'{h["ic_inferior"]}–{h["ic_superior"]}', "p": f'{h["p"]:.2g}',
                        "p proporcionalidade": f'{ph.get(h["covariavel"], float("nan")):.2g}'} for h in cox["hazard_ratios"]])
    v = cox["validacao_temporal"]
    cal = pd.DataFrame(v["calibracao"])
    return "\n".join([
        f"# Relatório do modelo — snapshot {snapshot}",
        "",
        "Gerado por `ampulheta modelar`. Fonte: CNJ/DataJud, API Pública. "
        f"Cox proporcional sobre {cox['n']} processos ({cox['eventos']} com sentença).",
        "",
        "## Hazard ratios (modelo ajustado em todos os processos)",
        "",
        f"Referências: {ref_vara} e {ref_classe}. Hazard ratio > 1 = sentença mais rápida que a referência. "
        "A coluna de proporcionalidade é o p do teste de Schoenfeld; p pequeno indica que o efeito muda ao longo do tempo "
        "e o hazard ratio deve ser lido como média no período.",
        "", hr.to_markdown(index=False), "",
        f"## Validação temporal (treino: ajuizados até {v['treino']['ate']}, n = {v['treino']['n']}; "
        f"teste: {v['teste']['de']} em diante, n = {v['teste']['n']})",
        "",
        f"- Concordance index: {v['concordance_index']['treino']} no treino, {v['concordance_index']['teste']} no teste "
        "(0,5 = ordena ao acaso).",
        *([f"- Sem processos suficientes no treino, tratadas como referência no teste: "
           + ", ".join(nomes[c] for c in v["covariaveis_fora_do_treino"]) + "."] if v["covariaveis_fora_do_treino"] else []),
        f"- Brier integrado até {v['brier_integrado']['horizonte_meses']} meses no teste: {v['brier_integrado']['cox']} "
        f"(Kaplan-Meier sem covariáveis: {v['brier_integrado']['kaplan_meier']}; menor é melhor).",
        "",
        "## Calibração no teste (probabilidade de sentença até h meses, por grupo do previsto)",
        "",
        *(f"### {h} meses\n\n" + cal[cal.horizonte_meses == h].drop(columns="horizonte_meses").to_markdown(index=False) + "\n"
          for h in HORIZONTES_CALIBRACAO),
    ])


def modelar(cfg: dict[str, Any]) -> None:
    dados = Path(cfg["saida"]["data"])
    processos = pd.read_parquet(dados / "processos.parquet")
    cox = modelar_cox(processos, cfg)
    Path("models").mkdir(exist_ok=True)
    Path("models/cox.json").write_text(json.dumps(cox, ensure_ascii=False, indent=1), encoding="utf-8")
    snapshot = str(processos.data_censura.iloc[0])
    (dados / "relatorio_modelo.md").write_text(relatorio(cox, cfg, snapshot), encoding="utf-8")
    v = cox["validacao_temporal"]
    print(f"Cox: {len(cox['hazard_ratios'])} covariáveis -> models/cox.json; c-index teste {v['concordance_index']['teste']}, "
          f"Brier integrado {v['brier_integrado']['cox']} (KM {v['brier_integrado']['kaplan_meier']}) -> {dados / 'relatorio_modelo.md'}")
