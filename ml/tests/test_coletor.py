import gzip
import json

import pytest

from ampulheta.coletor import coletar, montar_query, resposta_completa

CFG = {
    "tribunal": "tjsp", "grau": "G1",
    "api": {"tamanho_pagina": 2},
    "classes": [{"codigo": 7, "nome": "Procedimento Comum Cível"}],
    "varas": [{"codigo": 10672, "nome": "4ª Vara Cível de Sorocaba"}],
    "ajuizamento": {"de": "2018-01-01", "ate": "2024-12-31"},
    "saida": {},
}


def buscar_falso(hits_total: int, falhar_apos: int | None = None):
    """Simula a API: devolve páginas de `tamanho_pagina` hits ordenados por @timestamp.
    Se `falhar_apos` for dado, levanta erro depois de servir esse número de páginas."""
    servidas = 0

    def buscar(query):
        nonlocal servidas
        if falhar_apos is not None and servidas >= falhar_apos:
            raise RuntimeError("API caiu")
        servidas += 1
        inicio = query["search_after"][0] + 1 if "search_after" in query else 0
        hits = [{"_id": f"p{i}", "_source": {"numeroProcesso": str(i)}, "sort": [i]}
                for i in range(inicio, min(inicio + query["size"], hits_total))]
        return {"hits": {"hits": hits, "total": {"value": hits_total}}}

    return buscar


def test_query_usa_formato_de_data_da_api_e_match_no_grau():
    q = montar_query(CFG, 10672)
    filtros = q["query"]["bool"]["filter"]
    assert {"match": {"grau": "G1"}} in filtros
    assert {"range": {"dataAjuizamento": {"gte": "20180101000000", "lte": "20241231235959"}}} in filtros
    assert "search_after" not in q
    assert montar_query(CFG, 10672, [123])["search_after"] == [123]


def test_coleta_pagina_ate_o_fim_e_escreve_manifest(tmp_path):
    cfg = {**CFG, "saida": {"raw": str(tmp_path)}}
    coletar(cfg, "2026-10-29", buscar=buscar_falso(5))
    pasta = tmp_path / "2026-10-29" / "tjsp" / "10672"
    assert sorted(p.name for p in pasta.glob("*.jsonl.gz")) == ["00001.jsonl.gz", "00002.jsonl.gz", "00003.jsonl.gz"]
    manifest = json.loads((tmp_path / "2026-10-29" / "manifest.json").read_text())
    assert manifest["total"] == 5 and manifest["total_por_vara"] == {"10672": 5}
    assert len(manifest["arquivos"]) == 3
    assert manifest["total_esperado_por_vara"] == {"10672": 5}


def test_retoma_de_onde_parou_sem_duplicar(tmp_path):
    cfg = {**CFG, "saida": {"raw": str(tmp_path)}}
    with pytest.raises(RuntimeError):
        coletar(cfg, "2026-10-29", buscar=buscar_falso(5, falhar_apos=1))
    coletar(cfg, "2026-10-29", buscar=buscar_falso(5))
    linhas = [json.loads(l) for p in sorted((tmp_path / "2026-10-29" / "tjsp" / "10672").glob("*.jsonl.gz"))
              for l in gzip.open(p, "rt").read().splitlines()]
    assert [h["_id"] for h in linhas] == ["p0", "p1", "p2", "p3", "p4"]


def test_snapshot_com_manifest_e_imutavel(tmp_path):
    cfg = {**CFG, "saida": {"raw": str(tmp_path)}}
    coletar(cfg, "2026-10-29", buscar=buscar_falso(1))
    with pytest.raises(SystemExit):
        coletar(cfg, "2026-10-29", buscar=buscar_falso(1))


def test_resposta_parcial_nao_e_aceita():
    assert resposta_completa({"timed_out": False, "_shards": {"failed": 0}, "hits": {}})
    assert not resposta_completa({"timed_out": False, "_shards": {"failed": 1}, "hits": {}})
    assert not resposta_completa({"timed_out": True, "_shards": {"failed": 0}, "hits": {}})


def test_coleta_parcial_nao_fecha_o_snapshot(tmp_path):
    cfg = {**CFG, "saida": {"raw": str(tmp_path)}}
    coletar(cfg, "2026-10-29", buscar=buscar_falso(3), fechar=False)
    assert not (tmp_path / "2026-10-29" / "manifest.json").exists()
    coletar(cfg, "2026-10-29", buscar=buscar_falso(3))  # rodada final: vara já pronta responde vazio e fecha
    manifest = json.loads((tmp_path / "2026-10-29" / "manifest.json").read_text())
    assert manifest["total"] == 3 and len(manifest["arquivos"]) == 2
