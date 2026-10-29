"""Estágio 2 — Preparo. Lê só `raw/<snapshot>/`, escreve Parquet em `../data/`.

Saídas:
- processos.parquet: uma linha por processo (numero_processo, vara_codigo, vara_nome, classe_codigo,
  assunto_principal, data_ajuizamento, data_evento, data_censura, tempo_dias, evento, tipo_sentenca, flags).
- eventos.parquet: uma linha por movimento (formato longo).
- relatorio_qualidade.md: gerado automaticamente, com contagem por regra de limpeza e censura por vara.

Regras de limpeza (todas contadas): ajuizamento fora de [1990, snapshot]; sentença antes do ajuizamento;
movimentos duplicados (mesmo código, mesmo dia); < 2 movimentos recebe flag; varas que mudaram de código
via tabela de equivalência manual.
"""
from __future__ import annotations

from typing import Any


def preparar(cfg: dict[str, Any], snapshot: str) -> None:
    raise NotImplementedError("Estágio 2 ainda não implementado. Ver docs/PLANO.md §Estágio 2.")
