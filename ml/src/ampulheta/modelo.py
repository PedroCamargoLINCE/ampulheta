"""Estágio 3 — Modelagem. Lê só os Parquet; nunca chama a API.

Camadas, cada uma publicável por si:
1. Kaplan-Meier por vara, classe e ano de ajuizamento, com IC e log-rank entre varas.
2. Cox proporcional: hazard ratios interpretáveis; checar proporcionalidade.
3. Gradient boosting de sobrevivência (scikit-survival) para interações vara × assunto.

Validação sempre temporal (ADR-004). Métricas: concordance index, Brier integrado, calibração dos quantis.
"""
from __future__ import annotations

from typing import Any


def modelar(cfg: dict[str, Any]) -> None:
    raise NotImplementedError("Estágio 3 ainda não implementado. Ver docs/PLANO.md §Estágio 3.")
