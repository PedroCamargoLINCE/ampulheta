"""Estágio 3 — Modelagem. Lê só `../data/processos.parquet`; nunca chama a API.

Camada 1 (esta): Kaplan-Meier por transição entre marcos (ADR-011: ajuizamento → sentença,
sentença → trânsito em julgado…), cada uma por vara, por classe e por vara × classe, numa grade
mensal fixa (ADR-007), com IC 95% (escala log(−log S), padrão do lifelines), variância de
Greenwood acumulada, número em risco por ponto da grade e quantis. Escreve `models/km.json` já no formato de curva
do contrato; `publicar.py` só acrescenta o cabeçalho. Curvas com n < 30 não são geradas.
Camadas 2 (Cox) e 3 (boosting) virão aqui, sempre com validação temporal (ADR-004).
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import pandas as pd
from lifelines import KaplanMeierFitter
from lifelines.statistics import multivariate_logrank_test
from lifelines.utils import qth_survival_time

DIAS_POR_MES = 365.25 / 12
N_MINIMO = 30
H_MAXIMO = 120  # meses
TRANSICAO_PADRAO = ("ajuizamento", "sentenca")


def coluna_marco(nome: str) -> str:
    return {"ajuizamento": "data_ajuizamento", "sentenca": "data_evento"}.get(nome, f"data_{nome}")


def tempos_da_transicao(processos: pd.DataFrame, origem: str, destino: str) -> pd.DataFrame:
    """Processos que atingiram a origem, com tempo em dias até o destino ou até a censura.
    Quem tem o destino antes da origem (raro, registro fora de ordem) fica de fora."""
    ini = pd.to_datetime(processos[coluna_marco(origem)])
    fim = pd.to_datetime(processos[coluna_marco(destino)])
    censura = pd.to_datetime(processos["data_censura"])
    evento = fim.notna()
    ok = ini.notna() & ~(evento & (fim < ini))
    tempo = (fim.where(evento, censura) - ini).dt.days
    return processos.assign(tempo_dias=tempo, evento=evento.astype(int))[ok]


def tempo_em_meses(tempo_dias: pd.Series) -> pd.Series:
    # sentença no dia do ajuizamento vira 1 dia, para que S(0) seja 1 por construção
    return tempo_dias.clip(lower=1) / DIAS_POR_MES


def curva_km(tempo_meses: pd.Series, evento: pd.Series, grade: list[int]) -> dict[str, Any]:
    kmf = KaplanMeierFitter().fit(tempo_meses, evento)
    S = kmf.survival_function_at_times(grade).to_numpy()
    ic = kmf.confidence_interval_survival_function_
    ic = ic.reindex(ic.index.union(grade)).ffill().loc[grade].to_numpy()  # função escada, como o KM
    lo, hi = ic[:, 0], ic[:, 1]
    lo = [float(min(l, s)) if not math.isnan(l) else float(s) for l, s in zip(lo, S)]
    hi = [float(max(h, s)) if not math.isnan(h) else float(s) for h, s in zip(hi, S)]

    et = kmf.event_table
    termo = (et.observed / (et.at_risk * (et.at_risk - et.observed))).where(et.at_risk > et.observed, 0.0)
    greenwood = termo.cumsum().reindex(et.index.union(grade)).ffill().loc[grade]  # σ²(t) acumulada, escada

    def quantil(p: float) -> float | None:  # tempo em que S cai a (1 - p)
        t = qth_survival_time(1 - p, kmf.survival_function_)
        return None if math.isinf(t) else round(float(t), 1)

    return {
        "metodo": "kaplan-meier",
        "n": int(len(tempo_meses)),
        "eventos": int(evento.sum()),
        "censurados": int(len(tempo_meses) - evento.sum()),
        "sobrevivencia": [round(float(s), 4) for s in S],
        "ic_inferior": [round(x, 4) for x in lo],
        "ic_superior": [round(x, 4) for x in hi],
        "greenwood_acumulado": [round(float(g), 6) for g in greenwood],
        "em_risco": [int((tempo_meses >= g).sum()) for g in grade],  # 0 depois do último tempo observado
        "quantis_meses": {"p50": quantil(0.5), "p80": quantil(0.8), "p90": quantil(0.9)},
    }


def grupos(df: pd.DataFrame):
    yield (None, None), df
    for v, g in df.groupby("vara_codigo"):
        yield (str(v), None), g
    for c, g in df.groupby("classe_codigo"):
        yield (None, str(c)), g
    for (v, c), g in df.groupby(["vara_codigo", "classe_codigo"]):
        yield (str(v), str(c)), g


def curvas_km(processos: pd.DataFrame, transicoes: list[tuple[str, str]] | None = None) -> dict[str, Any]:
    """Para cada transição, curvas agregada, por vara, por classe e vara × classe (n >= 30), numa
    grade mensal comum a todas. O log-rank entre varas é calculado na transição padrão."""
    transicoes = [tuple(t) for t in (transicoes or [TRANSICAO_PADRAO])]
    frames = {t: (lambda d: d.assign(t=tempo_em_meses(d.tempo_dias)))(tempos_da_transicao(processos, *t)) for t in transicoes}
    maior = max(df.t.max() for df in frames.values() if len(df))
    grade = list(range(min(math.ceil(maior), H_MAXIMO) + 1))
    curvas = [{"vara": v, "classe": c, "origem": o, "destino": d, **curva_km(g.t, g.evento, grade)}
              for (o, d), df in frames.items() for (v, c), g in grupos(df) if len(g) >= N_MINIMO]
    logrank = None
    df = frames[transicoes[0]]
    if df.vara_codigo.nunique() > 1:
        lr = multivariate_logrank_test(df.t, df.vara_codigo, df.evento)
        logrank = {"estatistica": round(float(lr.test_statistic), 2), "p": float(lr.p_value),
                   "graus_liberdade": int(df.vara_codigo.nunique() - 1)}
    return {"grade_meses": grade, "curvas": curvas, "logrank_entre_varas": logrank}


def modelar(cfg: dict[str, Any]) -> None:
    processos = pd.read_parquet(Path(cfg["saida"]["data"]) / "processos.parquet")
    km = curvas_km(processos, cfg.get("transicoes"))
    Path("models").mkdir(exist_ok=True)
    Path("models/km.json").write_text(json.dumps(km, ensure_ascii=False), encoding="utf-8")
    por_transicao = pd.Series([f"{c['origem']}→{c['destino']}" for c in km["curvas"]]).value_counts().to_dict()
    print(f"{len(km['curvas'])} curvas KM em grade de {len(km['grade_meses'])} meses -> models/km.json {por_transicao}")
    if lr := km["logrank_entre_varas"]:
        print(f"log-rank entre varas: estatística {lr['estatistica']}, p = {lr['p']:.3g}")
