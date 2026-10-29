"""Publicação. Gera `../data/publicado/curvas.json` no formato de `../contracts/` (versão 1.0.0).

Obrigações:
- Grade mensal fixa (ADR-007): S(t) avaliada em t = 0, 1, …, H meses.
- Curva agregada (vara=null, classe=null) sempre presente; depois por vara, por classe, por vara × classe.
- Não publicar curvas com n < 30.
- `fonte.citacao` com CNJ/DataJud e data do snapshot; `sintetico: false`.
- Terminar rodando o validador: `python3 ../contracts/validar.py ../data/publicado/curvas.json --estrito`.
"""
from __future__ import annotations

from typing import Any


def publicar(cfg: dict[str, Any]) -> None:
    raise NotImplementedError("Publicação ainda não implementada. Ver contracts/README.md.")
