"""Estágio 2 — Preparo. Lê só `raw/<snapshot>/`, escreve Parquet e relatório em `../data/`.

Saídas:
- processos.parquet: uma linha por processo, com tempo até o evento ou a censura.
- eventos.parquet: uma linha por movimento (formato longo), para modelar outros eventos depois.
- relatorio_qualidade.md: gerado, com a contagem de cada regra de limpeza e a censura por vara.

Evento = primeiro movimento cujo código está na família Julgamento da TPU (193 e descendentes),
lida de `tpu_julgamento.csv` (gerada da TPU oficial em 2026-10-29, versão de 2025-09-11).
"""
from __future__ import annotations

import csv
import gzip
import json
from collections import Counter
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd

Familia = dict[int, dict[str, str]]  # codigo -> {nome, ramo}


def ler_familia(caminho: str | Path) -> Familia:
    with open(caminho, encoding="utf-8") as f:
        return {int(r["codigo"]): {"nome": r["nome"], "ramo": r["ramo"]} for r in csv.DictReader(f)}


def ler_hits(raiz: Path):
    for p in sorted(raiz.rglob("*.jsonl.gz")):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            for linha in f:
                yield json.loads(linha)


def data_ajuizamento(s: str) -> date:
    return datetime.strptime(s[:8], "%Y%m%d").date()


def data_movimento(s: str) -> date:
    return datetime.fromisoformat(s).date()


def processar(src: dict[str, Any], snapshot: date, familia: Familia, contagem: Counter) -> tuple[dict | None, list[dict]]:
    """Transforma um `_source` da API em (linha de processos, linhas de eventos).
    Devolve (None, []) quando o processo é descartado; cada descarte e flag é contado em `contagem`."""
    numero = src["numeroProcesso"]
    ajuizamento = data_ajuizamento(src["dataAjuizamento"])
    if not (date(1990, 1, 1) <= ajuizamento <= snapshot):
        contagem["descartado: ajuizamento fora de [1990, snapshot]"] += 1
        return None, []

    # deduplica movimentos de mesmo código no mesmo dia
    vistos: set[tuple[int, date]] = set()
    movimentos = []
    for m in src.get("movimentos", []):
        if "codigo" not in m:  # raro na API (só dataHora e orgaoJulgador); sem código não há como classificar
            contagem["movimento sem código TPU ignorado"] += 1
            continue
        chave = (m["codigo"], data_movimento(m["dataHora"]))
        if chave in vistos:
            contagem["movimento duplicado (mesmo código, mesmo dia) removido"] += 1
            continue
        vistos.add(chave)
        movimentos.append({"numero_processo": numero, "codigo": m["codigo"], "nome": m.get("nome"), "data": chave[1]})

    sentencas = sorted((m for m in movimentos if m["codigo"] in familia), key=lambda m: m["data"])
    primeira = sentencas[0] if sentencas else None
    if primeira and primeira["data"] < ajuizamento:
        contagem["descartado: sentença antes do ajuizamento"] += 1
        return None, []

    fim = primeira["data"] if primeira else snapshot
    flags = []
    if len(movimentos) < 2:
        flags.append("historico_curto")
    if movimentos and min(m["data"] for m in movimentos) < ajuizamento:
        flags.append("movimento_antes_do_ajuizamento")
    for fl in flags:
        contagem[f"flag: {fl}"] += 1

    linha = {
        "numero_processo": numero,
        "vara_codigo": src["orgaoJulgador"]["codigo"],
        "vara_nome": src["orgaoJulgador"]["nome"],
        "classe_codigo": src["classe"]["codigo"],
        "classe_nome": src["classe"]["nome"],
        "assunto_principal": (src.get("assuntos") or [{}])[0].get("codigo"),
        "sistema": src.get("sistema", {}).get("nome"),
        "data_ajuizamento": ajuizamento,
        "data_evento": primeira["data"] if primeira else None,
        "data_censura": snapshot,
        "tempo_dias": (fim - ajuizamento).days,
        "evento": int(primeira is not None),
        "sentenca_codigo": primeira["codigo"] if primeira else None,
        "tipo_sentenca": familia[primeira["codigo"]]["nome"] if primeira else None,
        "com_merito": familia[primeira["codigo"]]["ramo"] == "com_merito" if primeira else None,
        "n_movimentos": len(movimentos),
        "flags": ",".join(flags),
    }
    return linha, movimentos


def relatorio(processos: pd.DataFrame, contagem: Counter, manifest: dict, snapshot: str) -> str:
    por_vara = processos.groupby("vara_nome").agg(n=("evento", "size"), eventos=("evento", "sum"))
    por_vara["censura_%"] = (100 * (1 - por_vara["eventos"] / por_vara["n"])).round(1)
    por_classe = processos.groupby("classe_nome").agg(n=("evento", "size"), eventos=("evento", "sum"))
    por_classe["censura_%"] = (100 * (1 - por_classe["eventos"] / por_classe["n"])).round(1)
    por_sistema = processos.groupby("sistema").agg(n=("evento", "size"), eventos=("evento", "sum"))
    por_sistema["censura_%"] = (100 * (1 - por_sistema["eventos"] / por_sistema["n"])).round(1)
    tipos = processos.loc[processos.evento == 1, "tipo_sentenca"].value_counts().head(15)
    anos = processos.assign(ano=processos.data_ajuizamento.map(lambda d: d.year)).groupby("ano").agg(n=("evento", "size"), eventos=("evento", "sum"))
    sentenciados = processos[processos.evento == 1]
    return "\n".join([
        f"# Relatório de qualidade — snapshot {snapshot}",
        "",
        "Gerado por `ampulheta preparar`. Fonte: CNJ/DataJud, API Pública. "
        f"Coleta em {manifest['coletado_em']}; {manifest['total']} registros brutos.",
        "",
        "## Regras de limpeza (contadas)",
        "",
        "| Regra | Ocorrências |", "| --- | ---: |",
        *(f"| {k} | {v} |" for k, v in sorted(contagem.items())),
        "",
        f"Processos na tabela final: **{len(processos)}**, dos quais {int(processos.evento.sum())} com sentença "
        f"({100 * processos.evento.mean():.1f}%) e {int((processos.evento == 0).sum())} censurados na data do snapshot.",
        "",
        "## Tempo até a sentença (só sentenciados; otimista, ignora censura)",
        "",
        f"mediana {sentenciados.tempo_dias.median():.0f} dias, p80 {sentenciados.tempo_dias.quantile(0.8):.0f}, "
        f"p90 {sentenciados.tempo_dias.quantile(0.9):.0f}." if len(sentenciados) else "sem sentenciados.",
        "",
        "## Por vara", "", por_vara.to_markdown(),
        "", "## Por classe", "", por_classe.to_markdown(),
        "", "## Por sistema de origem", "", por_sistema.to_markdown(),
        "", "## Por ano de ajuizamento", "", anos.to_markdown(),
        "", "## Tipo da primeira sentença (TPU)", "", tipos.to_markdown(),
        "",
    ])


def preparar(cfg: dict[str, Any], snapshot: str) -> None:
    raiz = Path(cfg["saida"]["raw"]) / snapshot
    manifest = json.loads((raiz / "manifest.json").read_text(encoding="utf-8"))
    familia = ler_familia(cfg["evento_sentenca"]["tabela"])
    data_snapshot = date.fromisoformat(snapshot)

    contagem: Counter = Counter()
    vistos: set[str] = set()
    linhas, eventos = [], []
    for hit in ler_hits(raiz):
        if hit["_id"] in vistos:
            contagem["hit duplicado na paginação removido"] += 1
            continue
        vistos.add(hit["_id"])
        linha, movs = processar(hit["_source"], data_snapshot, familia, contagem)
        if linha:
            linhas.append(linha)
            eventos.extend(movs)

    processos = pd.DataFrame(linhas)
    saida = Path(cfg["saida"]["data"])
    processos.to_parquet(saida / "processos.parquet", index=False)
    pd.DataFrame(eventos).to_parquet(saida / "eventos.parquet", index=False)
    (saida / "relatorio_qualidade.md").write_text(relatorio(processos, contagem, manifest, snapshot), encoding="utf-8")
    print(f"{len(processos)} processos, {len(eventos)} movimentos -> {saida}")
