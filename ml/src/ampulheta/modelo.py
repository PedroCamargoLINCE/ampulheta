"""Estágio 3 — Modelagem. Lê só `../data/processos.parquet`; nunca chama a API.

Camada 1 (esta): Kaplan-Meier por vara, por classe e por vara × classe, avaliado numa grade
mensal fixa (ADR-007), com IC 95% (escala log(−log S), padrão do lifelines), variância de
Greenwood acumulada e quantis. Escreve `models/km.json` já no formato de curva
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
        "quantis_meses": {"p50": quantil(0.5), "p80": quantil(0.8), "p90": quantil(0.9)},
    }


def curvas_km(processos: pd.DataFrame) -> dict[str, Any]:
    """Curvas agregada, por vara, por classe e vara × classe (n >= 30), numa grade mensal comum."""
    df = processos.assign(t=tempo_em_meses(processos.tempo_dias))
    grade = list(range(min(math.ceil(df.t.max()), H_MAXIMO) + 1))

    def grupos():
        yield (None, None), df
        for v, g in df.groupby("vara_codigo"):
            yield (str(v), None), g
        for c, g in df.groupby("classe_codigo"):
            yield (None, str(c)), g
        for (v, c), g in df.groupby(["vara_codigo", "classe_codigo"]):
            yield (str(v), str(c)), g

    curvas = [{"vara": v, "classe": c, **curva_km(g.t, g.evento, grade)}
              for (v, c), g in grupos() if len(g) >= N_MINIMO]
    logrank = None
    if df.vara_codigo.nunique() > 1:
        lr = multivariate_logrank_test(df.t, df.vara_codigo, df.evento)
        logrank = {"estatistica": round(float(lr.test_statistic), 2), "p": float(lr.p_value),
                   "graus_liberdade": int(df.vara_codigo.nunique() - 1)}
    return {"grade_meses": grade, "curvas": curvas, "logrank_entre_varas": logrank}


def modelar(cfg: dict[str, Any]) -> None:
    processos = pd.read_parquet(Path(cfg["saida"]["data"]) / "processos.parquet")
    km = curvas_km(processos)
    Path("models").mkdir(exist_ok=True)
    Path("models/km.json").write_text(json.dumps(km, ensure_ascii=False), encoding="utf-8")
    print(f"{len(km['curvas'])} curvas KM em grade de {len(km['grade_meses'])} meses -> models/km.json")
    if lr := km["logrank_entre_varas"]:
        print(f"log-rank entre varas: estatística {lr['estatistica']}, p = {lr['p']:.3g}")
