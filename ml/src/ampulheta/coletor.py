"""Estágio 1 — Coleta. Único módulo que toca a API do DataJud.

Uma pasta `raw/<snapshot>/<tribunal>/<vara>/` por vara, uma página por arquivo `.jsonl.gz`
(compactado para caber no git e permitir retomar a coleta de outra máquina).
Cada linha é o hit inteiro da API (`_id`, `_source`, `sort`), o que torna a retomada
trivial: o `sort` da última linha gravada é o `search_after` da próxima página.
Fechada a coleta, escreve-se `manifest.json`; com manifesto presente, a pasta é imutável.

Fatos da API usados aqui (docs/PLANO.md): `dataAjuizamento` é string `AAAAMMDDhhmmss`;
`grau` é campo de texto (usar `match`, não `term`); paginação por `search_after` com
`sort` em `@timestamp`; 120 req/min; 429 e 504 frequentes em pico.
"""
from __future__ import annotations

import gzip
import hashlib
import json
import os
import time
from collections.abc import Callable, Iterator
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import httpx

Pagina = dict[str, Any]  # resposta crua do Elasticsearch
Buscar = Callable[[dict[str, Any]], Pagina]


def montar_query(cfg: dict[str, Any], vara: int, search_after: list | None = None) -> dict[str, Any]:
    aj = cfg["ajuizamento"]
    q = {
        "size": cfg["api"]["tamanho_pagina"],
        "sort": [{"@timestamp": "asc"}],
        "query": {"bool": {"filter": [
            {"match": {"grau": cfg["grau"]}},
            {"term": {"orgaoJulgador.codigo": vara}},
            {"terms": {"classe.codigo": [c["codigo"] for c in cfg["classes"]]}},
            {"range": {"dataAjuizamento": {
                "gte": aj["de"].replace("-", "") + "000000",
                "lte": aj["ate"].replace("-", "") + "235959"}}},
        ]}},
    }
    if search_after:
        q["search_after"] = search_after
    return q


def resposta_completa(dados: Pagina) -> bool:
    """O Elasticsearch devolve 200 com página incompleta quando um shard falha ou estoura o tempo;
    aceitar isso perderia documentos em silêncio, porque o search_after seguiria adiante."""
    return not dados.get("timed_out") and dados.get("_shards", {}).get("failed", 0) == 0


def cliente_http(cfg: dict[str, Any]) -> Buscar:
    """Devolve uma função `buscar(query) -> página` com retry exponencial e limite de taxa."""
    api = cfg["api"]
    chave = os.environ.get(api["chave_env"])
    if not chave:
        raise SystemExit(f"defina a variável de ambiente {api['chave_env']} com a chave pública do DataJud")
    url = api["url"].format(tribunal=cfg["tribunal"])
    http = httpx.Client(headers={"Authorization": f"APIKey {chave}"}, timeout=api["timeout_s"])
    intervalo = 60 / api["req_por_minuto"]

    def buscar(query: dict[str, Any]) -> Pagina:
        tentativa = 0
        while True:  # a API passa por janelas longas de indisponibilidade; esperar é mais barato que recomeçar
            time.sleep(intervalo)
            try:
                r = http.post(url, json=query)
                if r.status_code == 200:
                    dados = r.json()
                    if resposta_completa(dados):
                        return dados
                    motivo = f"resposta parcial (timed_out={dados.get('timed_out')}, shards={dados.get('_shards')})"
                elif r.status_code not in (429, 500, 502, 503, 504):
                    r.raise_for_status()
                else:
                    motivo = f"HTTP {r.status_code}"
            except httpx.TransportError as e:  # timeout, conexão caída
                motivo = type(e).__name__
            espera = min(2**tentativa * 5, 60)  # a API oscila em janelas curtas; esperar mais só atrasa
            tentativa += 1
            print(f"  {motivo}; tentativa {tentativa} em {espera}s")
            time.sleep(espera)

    return buscar


def ultimo_sort(pasta: Path) -> tuple[int, list | None]:
    """Número da última página gravada e o `sort` da sua última linha (para retomar)."""
    paginas = sorted(pasta.glob("*.jsonl.gz"))
    if not paginas:
        return 0, None
    with gzip.open(paginas[-1], "rt", encoding="utf-8") as f:
        linhas = f.read().splitlines()
    return len(paginas), json.loads(linhas[-1])["sort"]


def coletar_vara(cfg: dict[str, Any], vara: int, pasta: Path, buscar: Buscar) -> Iterator[int]:
    """Baixa todas as páginas da vara em `pasta`, retomando se já houver páginas. Gera o nº de hits por página
    e, ao final, grava em `total_esperado.txt` o `hits.total` informado pela API, para conferência no manifesto."""
    pasta.mkdir(parents=True, exist_ok=True)
    n_pagina, search_after = ultimo_sort(pasta)
    while True:
        resposta = buscar(montar_query(cfg, vara, search_after))["hits"]
        hits = resposta["hits"]
        if not hits:
            (pasta / "total_esperado.txt").write_text(str(resposta["total"]["value"]), encoding="utf-8")
            return
        n_pagina += 1
        with gzip.open(pasta / f"{n_pagina:05d}.jsonl.gz", "wt", encoding="utf-8") as f:
            for h in hits:
                f.write(json.dumps(h, ensure_ascii=False) + "\n")
        search_after = hits[-1]["sort"]
        yield len(hits)


def sha256(caminho: Path) -> str:
    return hashlib.sha256(caminho.read_bytes()).hexdigest()


def coletar(cfg: dict[str, Any], snapshot: str | None = None, buscar: Buscar | None = None, fechar: bool = True) -> str:
    """Executa a coleta e devolve a data do snapshot (AAAA-MM-DD).
    Com `fechar=False` (coleta parcial, ex.: processos paralelos com `--vara`) não escreve o manifesto;
    uma rodada final sem `--vara` percorre todas as varas (as prontas respondem vazio) e fecha o snapshot."""
    snapshot = snapshot or date.today().isoformat()
    raiz = Path(cfg["saida"]["raw"]) / snapshot
    if (raiz / "manifest.json").exists():
        raise SystemExit(f"{raiz} já tem manifest.json; snapshot é imutável. Use outra data.")
    buscar = buscar or cliente_http(cfg)

    totais: dict[str, int] = {}
    esperados: dict[str, int] = {}
    for v in cfg["varas"]:
        pasta = raiz / cfg["tribunal"] / str(v["codigo"])
        print(f"vara {v['codigo']} ({v['nome']})")
        for n in coletar_vara(cfg, v["codigo"], pasta, buscar):
            print(f"  +{n}")
        totais[str(v["codigo"])] = sum(1 for p in pasta.glob("*.jsonl.gz") for _ in gzip.open(p, "rt", encoding="utf-8"))
        esperado = int((pasta / "total_esperado.txt").read_text())
        print(f"  total {totais[str(v['codigo'])]} (API informa {esperado})")
        esperados[str(v["codigo"])] = esperado

    if not fechar:
        return snapshot
    manifest = {
        "snapshot": snapshot,
        "coletado_em": datetime.now(UTC).isoformat(timespec="seconds"),
        "tribunal": cfg["tribunal"],
        "grau": cfg["grau"],
        "classes": cfg["classes"],
        "varas": cfg["varas"],
        "ajuizamento": cfg["ajuizamento"],
        "total_por_vara": totais,
        "total_esperado_por_vara": esperados,  # hits.total da API; diferença = retomada com páginas duplicadas (preparo deduplica)
        "total": sum(totais.values()),
        "arquivos": {str(p.relative_to(raiz)): sha256(p) for p in sorted(raiz.rglob("*.jsonl.gz"))},
    }
    (raiz / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return snapshot
