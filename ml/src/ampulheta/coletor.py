"""Estágio 1 — Coleta. Único módulo que toca a API do DataJud.

Contrato (docs/PLANO.md §Estágio 1):
- Monta a query Elasticsearch a partir do config (tribunal, grau, classes, varas, janela de ajuizamento).
- Pagina com `search_after` + `sort` em `@timestamp`.
- Grava cada página na hora em `raw/<snapshot>/<tribunal>/<vara>/<pagina>.jsonl`; retoma se cair.
- Retry com backoff exponencial em 429/504; respeita 120 req/min.
- Escreve `raw/<snapshot>/manifest.json` com data/hora, filtros, totais e hash dos arquivos.
A pasta do snapshot é imutável depois de fechada.
"""
from __future__ import annotations

from typing import Any


def coletar(cfg: dict[str, Any], snapshot: str | None = None) -> str:
    """Executa a coleta e devolve a data do snapshot (AAAA-MM-DD)."""
    raise NotImplementedError("Estágio 1 ainda não implementado. Ver docs/PLANO.md §Estágio 1.")
