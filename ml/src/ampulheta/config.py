"""Carrega e valida o config.yaml."""
from __future__ import annotations

from pathlib import Path
from typing import Any


def carregar(caminho: str | Path = "config.yaml") -> dict[str, Any]:
    import yaml  # import tardio para o --help funcionar sem dependências instaladas

    with open(caminho, encoding="utf-8") as f:
        cfg = yaml.safe_load(f)
    obrigatorios = ("tribunal", "grau", "api", "classes", "varas", "ajuizamento", "evento_sentenca", "saida")
    faltando = [k for k in obrigatorios if k not in cfg]
    if faltando:
        raise ValueError(f"config.yaml sem as chaves: {faltando}")
    return cfg
