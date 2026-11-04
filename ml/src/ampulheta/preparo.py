"""Estágio 2 — Preparo. Lê só `raw/<snapshot>/`, escreve Parquet e relatório em `../data/`.

Saídas:
- processos.parquet: uma linha por processo, com tempo até o evento ou a censura.
- eventos.parquet: uma linha por movimento (formato longo), para modelar outros eventos depois.
- relatorio_qualidade.md: gerado, com a contagem de cada regra de limpeza e a censura por vara.

Evento = primeiro movimento cujo código está na família Julgamento da TPU (193 e descendentes),
lida de `tpu_julgamento.csv` (gerada da TPU oficial em 2026-10-29, versão de 2025-09-11), menos os
códigos listados em `evento_sentenca.excluir_codigos` do config (decisões de embargos, ADR-010).
Processos de sistemas listados em `preparo.sistemas_sem_julgamento` recebem a flag
`sistema_sem_julgamento` (ADR-009): ficam na base, e cada modelo decide se os usa.
Cada marco de `marcos` no config (ADR-011) vira uma coluna `data_<nome>` com a data do primeiro
movimento de seus códigos, ou nula. Se existir `raw/<snapshot>-g2/` fechado (ADR-013), os
movimentos de 2º grau do mesmo número entram nos marcos marcados com `com_recurso`, ignorando o
que vier depois da data do snapshot, para manter uma única data de censura.
"""
from __future__ import annotations

import csv
import gzip
import json
from collections import Counter
from collections.abc import Iterable
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd

Familia = dict[int, dict[str, str]]  # codigo -> {nome, ramo}
Marcos = dict[str, set[int]]  # nome -> códigos TPU
Recurso = dict[str, list[dict]]  # numeroProcesso -> movimentos de 2º grau (codigo, nome, data) e classe


def ler_familia(caminho: str | Path, excluir: Iterable[int] = ()) -> Familia:
    fora = set(excluir)
    with open(caminho, encoding="utf-8") as f:
        return {int(r["codigo"]): {"nome": r["nome"], "ramo": r["ramo"]}
                for r in csv.DictReader(f) if int(r["codigo"]) not in fora}


def ler_hits(raiz: Path):
    for p in sorted(raiz.rglob("*.jsonl.gz")):
        with gzip.open(p, "rt", encoding="utf-8") as f:
            for linha in f:
                yield json.loads(linha)


def ler_recurso(raiz_g2: Path) -> Recurso:
    """Movimentos de todos os registros de 2º grau, por número; `classe` guarda a do primeiro registro."""
    recurso: Recurso = {}
    for hit in ler_hits(raiz_g2):
        src = hit["_source"]
        r = recurso.setdefault(src["numeroProcesso"], {"classe": src["classe"]["nome"], "registros": 0, "movimentos": []})
        r["registros"] += 1
        r["movimentos"].extend({"codigo": m["codigo"], "nome": m.get("nome"), "data": data_movimento(m["dataHora"])}
                               for m in src.get("movimentos", []) if "codigo" in m)
    return recurso


def data_ajuizamento(s: str) -> date:
    return datetime.strptime(s[:8], "%Y%m%d").date()


def data_movimento(s: str) -> date:
    return datetime.fromisoformat(s).date()


def processar(src: dict[str, Any], snapshot: date, familia: Familia, contagem: Counter,
              sistemas_sem_julgamento: Iterable[str] = (), marcos: Marcos | None = None,
              marcos_com_recurso: Iterable[str] = (), recurso: dict | None = None) -> tuple[dict | None, list[dict]]:
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
    if src.get("sistema", {}).get("nome") in set(sistemas_sem_julgamento):
        flags.append("sistema_sem_julgamento")
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
    movs_recurso = []
    if recurso:
        for m in recurso["movimentos"]:
            if m["data"] > snapshot:
                contagem["movimento de 2º grau depois do snapshot ignorado"] += 1
            else:
                movs_recurso.append(m)
    linha["registros_recurso"] = recurso["registros"] if recurso else 0
    linha["classe_recurso"] = recurso["classe"] if recurso else None
    for nome, codigos in (marcos or {}).items():
        fonte = movimentos + (movs_recurso if nome in set(marcos_com_recurso) else [])
        datas = [m["data"] for m in fonte if m["codigo"] in codigos]
        linha[f"data_{nome}"] = min(datas) if datas else None
    eventos = [{**m, "grau": "G1"} for m in movimentos] + [
        {"numero_processo": numero, "codigo": m["codigo"], "nome": m["nome"], "data": m["data"], "grau": "G2"} for m in movs_recurso]
    return linha, eventos


def tabela_marcos(processos: pd.DataFrame) -> pd.DataFrame:
    """Cobertura de cada marco e mediana de dias desde o ajuizamento (só quem o atingiu; ignora censura)."""
    linhas = []
    for col in [c for c in processos.columns if c.startswith("data_") and c not in ("data_ajuizamento", "data_evento", "data_censura")]:
        d = processos[col].dropna()
        dias = (pd.to_datetime(d) - pd.to_datetime(processos.loc[d.index, "data_ajuizamento"])).dt.days
        linhas.append({"marco": col.removeprefix("data_"), "processos": len(d),
                       "%": round(100 * len(d) / len(processos), 1), "mediana_dias": dias.median() if len(d) else None})
    return pd.DataFrame(linhas)


def tabela_transito_por_ano(processos: pd.DataFrame) -> pd.DataFrame:
    """Entre os sentenciados, % com trânsito em julgado registrado, por ano da sentença: mede se o
    registro está completo o bastante para a curva sentença → trânsito."""
    s = processos[processos.evento == 1]
    t = s.groupby(pd.to_datetime(s.data_evento).dt.year).agg(
        sentenciados=("evento", "size"), com_transito=("data_transito_em_julgado", "count"),
        com_recurso=("registros_recurso", lambda x: int((x > 0).sum())))
    t["%_com_transito"] = (100 * t.com_transito / t.sentenciados).round(1)
    t.index.name = "ano_sentenca"
    return t


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
        "", "## Marcos além da sentença (ADR-011)", "", tabela_marcos(processos).to_markdown(index=False),
        *(["", "## Registros de 2º grau (ADR-013)", "",
           f"{int((processos.registros_recurso > 0).sum())} processos ({100 * (processos.registros_recurso > 0).mean():.1f}%) têm registro de "
           f"2º grau; classes mais comuns: " + "; ".join(f"{k} ({v})" for k, v in processos.classe_recurso.value_counts().head(4).items()) + ".",
           "", "Trânsito em julgado entre os sentenciados, por ano da sentença:", "", tabela_transito_por_ano(processos).to_markdown()]
          if "data_transito_em_julgado" in processos.columns else []),
        "", "## Por ano de ajuizamento", "", anos.to_markdown(),
        "", "## Tipo da primeira sentença (TPU)", "", tipos.to_markdown(),
        "",
    ])


def preparar(cfg: dict[str, Any], snapshot: str) -> None:
    raiz = Path(cfg["saida"]["raw"]) / snapshot
    manifest = json.loads((raiz / "manifest.json").read_text(encoding="utf-8"))
    familia = ler_familia(cfg["evento_sentenca"]["tabela"], cfg["evento_sentenca"].get("excluir_codigos", ()))
    sistemas = cfg.get("preparo", {}).get("sistemas_sem_julgamento", ())
    marcos = {m["nome"]: set(m["codigos"]) for m in cfg.get("marcos", [])}
    com_recurso = {m["nome"] for m in cfg.get("marcos", []) if m.get("com_recurso")}
    raiz_g2 = raiz.with_name(f"{snapshot}-g2")
    recurso = ler_recurso(raiz_g2) if (raiz_g2 / "manifest.json").exists() else {}
    if recurso:
        print(f"2º grau: {len(recurso)} números com registro em {raiz_g2}")
    data_snapshot = date.fromisoformat(snapshot)

    contagem: Counter = Counter()
    vistos: set[str] = set()
    linhas, eventos = [], []
    for hit in ler_hits(raiz):
        if hit["_id"] in vistos:
            contagem["hit duplicado na paginação removido"] += 1
            continue
        vistos.add(hit["_id"])
        linha, movs = processar(hit["_source"], data_snapshot, familia, contagem, sistemas, marcos,
                                com_recurso, recurso.get(hit["_source"]["numeroProcesso"]))
        if linha:
            linhas.append(linha)
            eventos.extend(movs)

    processos = pd.DataFrame(linhas)
    saida = Path(cfg["saida"]["data"])
    processos.to_parquet(saida / "processos.parquet", index=False)
    pd.DataFrame(eventos).to_parquet(saida / "eventos.parquet", index=False)
    (saida / "relatorio_qualidade.md").write_text(relatorio(processos, contagem, manifest, snapshot), encoding="utf-8")
    print(f"{len(processos)} processos, {len(eventos)} movimentos -> {saida}")
