"""Publicação. Junta `models/km.json` ao cabeçalho do contrato (`../contracts/`, versão 1.3.0)
e grava `../data/publicado/curvas.json`. Termina rodando o validador em modo estrito;
se ele reprovar, nada é publicado.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .preparo import ler_familia

CONTRATO = "1.3.0"


def marcos_do_contrato(cfg: dict[str, Any]) -> list[dict[str, Any]]:
    """Ajuizamento e sentença são implícitos; os demais vêm do config. Os códigos TPU permitem ao site
    descobrir a fase de um processo a partir dos movimentos da API (ADR-011)."""
    ev = cfg["evento_sentenca"]
    excluir = set(ev.get("excluir_codigos", ()))
    familia = sorted(c for c in ler_familia(ev["tabela"]) if c not in excluir)
    return [{"codigo": "ajuizamento", "nome": "Ajuizamento", "codigos_tpu": []},
            {"codigo": "sentenca", "nome": "Sentença", "codigos_tpu": familia},
            *({"codigo": m["nome"], "nome": m["rotulo"], "codigos_tpu": list(m["codigos"])} for m in cfg.get("marcos", []))]


def montar_documento(cfg: dict[str, Any], km: dict[str, Any], processos: pd.DataFrame, gerado_em: datetime) -> dict[str, Any]:
    snapshot = date.fromisoformat(str(processos.data_censura.iloc[0]))
    presentes = set(processos.vara_codigo.astype(str))
    return {
        "contrato": CONTRATO,
        "gerado_em": gerado_em.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "snapshot": snapshot.isoformat(),
        "sintetico": False,
        "fonte": {
            "nome": "Conselho Nacional de Justiça — DataJud, API Pública",
            "url": "https://datajud-wiki.cnj.jus.br/api-publica/",
            "citacao": f"Fonte: CNJ/DataJud. Snapshot de {snapshot:%d/%m/%Y}.",
        },
        "tribunal": cfg["tribunal"].upper(),
        "grau": cfg["grau"],
        "evento": "Primeiro movimento da família Julgamento (TPU 193 e filhos)",
        "grade_meses": km["grade_meses"],
        "varas": [{"codigo": str(v["codigo"]), "nome": v["nome"], "municipio": cfg["municipio"]}
                  for v in cfg["varas"] if str(v["codigo"]) in presentes],
        "classes": [{"codigo": str(c["codigo"]), "nome": c["nome"]} for c in cfg["classes"]],
        "marcos": marcos_do_contrato(cfg),
        "curvas": km["curvas"],
    }


def publicar(cfg: dict[str, Any]) -> None:
    km = json.loads(Path("models/km.json").read_text(encoding="utf-8"))
    processos = pd.read_parquet(Path(cfg["saida"]["data"]) / "processos.parquet")
    doc = montar_documento(cfg, km, processos, datetime.now(UTC))

    saida = Path(cfg["saida"]["publicado"]) / "curvas.json"
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    print(f"{len(doc['curvas'])} curvas -> {saida}")
    subprocess.run([sys.executable, cfg["saida"]["validador"], str(saida), "--estrito"], check=True)
