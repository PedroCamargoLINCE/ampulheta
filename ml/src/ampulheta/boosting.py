"""Estágio 3 — Camada 3: gradient boosting de sobrevivência, só para comparar desempenho.

`GradientBoostingSurvivalAnalysis` (scikit-survival, perda de Cox) com as mesmas covariáveis do
Cox em one-hot (todas as varas e classes, os mesmos assuntos frequentes), hiperparâmetros fixos
e sem busca, para não olhar o teste. Mesma validação temporal do Cox (ADR-004): ajusta em
ajuizados até 2021 e mede em 2022 em diante com concordance index, Brier integrado e calibração.
Não publica hazard ratios nem curvas. Escreve `models/boosting.json`.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sksurv.ensemble import GradientBoostingSurvivalAnalysis
from sksurv.util import Surv

from .cox import (FORA, HORIZONTE_BRIER, HORIZONTES_CALIBRACAO, assuntos_frequentes, brier_integrado, brier_kaplan_meier, calibracao,
                  dividir, meses_brier, montar_matriz, sem_teste)
from .modelo import TRANSICAO_PADRAO, tempos_da_transicao

# 100 árvores a 0,1 em vez de 300 a 0,05: a perda de Cox do scikit-survival custa ~5 s por árvore
# com 20 mil processos, e o resultado no teste é o mesmo; `modelar` fica em ~10 min em vez de ~30.
PARAMETROS = {"loss": "coxph", "n_estimators": 100, "learning_rate": 0.1, "max_depth": 3,
              "subsample": 0.8, "random_state": 0}
EVENTOS_MINIMOS_TREINO = 100  # abaixo disso a transição não ganha boosting
GRUPOS = ("vara", "classe", "assunto")


def sobrevivencia(modelo: GradientBoostingSurvivalAnalysis, X: pd.DataFrame, tempos) -> np.ndarray:
    """S(t) prevista, uma linha por processo e uma coluna por tempo."""
    return np.vstack([f(tempos) for f in modelo.predict_survival_function(X)])


def importancia(modelo: GradientBoostingSurvivalAnalysis, colunas: list[str]) -> dict[str, float]:
    imp = pd.Series(modelo.feature_importances_, index=colunas)
    return {g: round(float(imp[[c for c in colunas if c.startswith(f"{g}_")]].sum()), 4) for g in GRUPOS}


def modelar_transicao(processos: pd.DataFrame, cfg: dict[str, Any], assuntos: list[dict[str, Any]],
                      origem: str, destino: str, parametros: dict[str, Any]) -> dict[str, Any]:
    df = montar_matriz(tempos_da_transicao(processos, origem, destino), cfg, assuntos, referencia=False)
    treino, teste = dividir(df)
    saida = {"origem": origem, "destino": destino, "n": int(len(df)), "eventos": int(df.evento.sum()),
             "treino": {"n": int(len(treino)), "eventos": int(treino.evento.sum())},
             "teste": {"n": int(len(teste)), "eventos": int(teste.evento.sum())}}
    motivo = sem_teste(teste) or (f"menos de {EVENTOS_MINIMOS_TREINO} eventos no treino"
                                  if treino.evento.sum() < EVENTOS_MINIMOS_TREINO else None)
    if motivo:
        return saida | {"indisponivel": motivo}
    colunas = [c for c in df.columns if c not in FORA]
    modelo = GradientBoostingSurvivalAnalysis(**parametros).fit(
        treino[colunas], Surv.from_arrays(treino.evento.astype(bool), treino.t))
    X = teste[colunas]
    S = sobrevivencia(modelo, X, meses_brier())
    em_h = {h: 1 - sobrevivencia(modelo, X, [h])[:, 0] for h in HORIZONTES_CALIBRACAO}
    return saida | {
        "concordance_index": {"teste": round(float(modelo.score(X, Surv.from_arrays(teste.evento.astype(bool), teste.t))), 4)},
        "brier_integrado": {"boosting": brier_integrado(S, treino, teste),
                            "kaplan_meier": brier_kaplan_meier(treino, teste), "horizonte_meses": HORIZONTE_BRIER},
        "calibracao": calibracao(lambda h: em_h[h], teste),
        "importancia": importancia(modelo, colunas),
    }


def modelar_boosting(processos: pd.DataFrame, cfg: dict[str, Any], parametros: dict[str, Any] | None = None) -> dict[str, Any]:
    parametros = parametros or PARAMETROS
    assuntos = assuntos_frequentes(processos)
    return {"metodo": "gradient boosting (coxph)", "parametros": parametros,
            "assuntos": [a["codigo"] for a in assuntos],
            "transicoes": [modelar_transicao(processos, cfg, assuntos, o, d, parametros)
                           for o, d in cfg.get("transicoes") or [TRANSICAO_PADRAO]]}


def modelar(cfg: dict[str, Any]) -> None:
    processos = pd.read_parquet(Path(cfg["saida"]["data"]) / "processos.parquet")
    b = modelar_boosting(processos, cfg)
    Path("models").mkdir(exist_ok=True)
    Path("models/boosting.json").write_text(json.dumps(b, ensure_ascii=False, indent=1), encoding="utf-8")
    for t in b["transicoes"]:
        metricas = (t["indisponivel"] if "indisponivel" in t else
                    f"c-index teste {t['concordance_index']['teste']}, Brier integrado {t['brier_integrado']['boosting']}")
        print(f"Boosting {t['origem']}→{t['destino']}: {metricas}")
    print("-> models/boosting.json")
