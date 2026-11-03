"""Estágio 1b — Coleta do 2º grau (ADR-013). Lê os números do snapshot de 1º grau já fechado e
baixa, em lotes, os registros de grau de recurso dos mesmos números: é neles que ficam o trânsito
em julgado e a baixa quando há apelação. Grava `raw/<snapshot>-g2/<tribunal>/lote_NNNNN.jsonl.gz`,
um arquivo por lote de números (ordem fixa, então retomar é pular os arquivos que já existem), e
ao final `manifest.json`. `--parte i/n` processa só os lotes i, i+n, i+2n…, para rodar n processos
em paralelo; a rodada final sem `--parte` confere todos os lotes e fecha o manifesto.
"""
from __future__ import annotations

import gzip
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .coletor import Buscar, cliente_http, sha256


def numeros_do_snapshot(raiz_g1: Path) -> list[str]:
    numeros = set()
    for p in sorted(raiz_g1.rglob("*.jsonl.gz")):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            for linha in f:
                numeros.add(json.loads(linha)["_source"]["numeroProcesso"])
    return sorted(numeros)


def montar_query(numeros: list[str], grau: str) -> dict[str, Any]:
    return {"size": 5 * len(numeros), "query": {"bool": {"filter": [
        {"terms": {"numeroProcesso": numeros}}, {"match": {"grau": grau}}]}}}


def buscar_lote(buscar: Buscar, numeros: list[str], grau: str) -> list[dict]:
    """Um lote cabe numa resposta; se a API disser que há mais do que devolveu, divide o lote."""
    resposta = buscar(montar_query(numeros, grau))["hits"]
    if resposta["total"]["value"] > len(resposta["hits"]) and len(numeros) > 1:
        meio = len(numeros) // 2
        return buscar_lote(buscar, numeros[:meio], grau) + buscar_lote(buscar, numeros[meio:], grau)
    return resposta["hits"]


def coletar_g2(cfg: dict[str, Any], snapshot: str, parte: str | None = None, buscar: Buscar | None = None) -> None:
    raiz_g1 = Path(cfg["saida"]["raw"]) / snapshot
    if not (raiz_g1 / "manifest.json").exists():
        raise SystemExit(f"{raiz_g1} não tem manifest.json; feche o snapshot de 1º grau antes")
    raiz = Path(cfg["saida"]["raw"]) / f"{snapshot}-g2"
    if (raiz / "manifest.json").exists():
        raise SystemExit(f"{raiz} já tem manifest.json; coleta de 2º grau é imutável")
    grau, lote = cfg["recurso"]["grau"], int(cfg["recurso"]["lote"])
    pasta = raiz / cfg["tribunal"]
    pasta.mkdir(parents=True, exist_ok=True)
    numeros = numeros_do_snapshot(raiz_g1)
    lotes = [numeros[i:i + lote] for i in range(0, len(numeros), lote)]
    i, n = (int(x) for x in parte.split("/")) if parte else (1, 1)
    buscar = buscar or cliente_http(cfg)
    print(f"{len(numeros)} números em {len(lotes)} lotes de {lote}; parte {i}/{n}")

    for k in range(i - 1, len(lotes), n):
        arq = pasta / f"lote_{k + 1:05d}.jsonl.gz"
        if arq.exists():
            continue
        hits = buscar_lote(buscar, lotes[k], grau)
        with gzip.open(arq, "wt", encoding="utf-8") as f:
            for h in hits:
                f.write(json.dumps(h, ensure_ascii=False) + "\n")
        print(f"  lote {k + 1}/{len(lotes)}: {len(hits)} registros")

    if parte:
        return
    faltam = [k + 1 for k in range(len(lotes)) if not (pasta / f"lote_{k + 1:05d}.jsonl.gz").exists()]
    if faltam:
        raise SystemExit(f"faltam lotes: {faltam[:10]}…")
    total = sum(1 for p in pasta.glob("*.jsonl.gz") for _ in gzip.open(p, "rt", encoding="utf-8"))
    manifest = {
        "snapshot_base": snapshot, "grau": grau, "coletado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "tribunal": cfg["tribunal"], "lote": lote, "numeros": len(numeros), "lotes": len(lotes), "total": total,
        "arquivos": {str(p.relative_to(raiz)): sha256(p) for p in sorted(raiz.rglob("*.jsonl.gz"))},
    }
    (raiz / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{total} registros de {grau} para {len(numeros)} números -> {raiz / 'manifest.json'}")
