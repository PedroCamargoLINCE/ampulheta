from collections import Counter
from datetime import date

import pytest

from ampulheta.preparo import ler_familia, processar

SNAPSHOT = date(2026, 10, 29)


@pytest.fixture(scope="module")
def familia():
    return ler_familia("tpu_julgamento.csv")


def fonte(ajuizamento="20200115120000", movimentos=()):
    return {
        "numeroProcesso": "00000000120208260602",
        "orgaoJulgador": {"codigo": 10672, "nome": "4ª Vara Cível"},
        "classe": {"codigo": 7, "nome": "Procedimento Comum Cível"},
        "assuntos": [{"codigo": 4862}],
        "sistema": {"nome": "SAJ"},
        "dataAjuizamento": ajuizamento,
        "movimentos": [{"codigo": c, "nome": "x", "dataHora": d} for c, d in movimentos],
    }


def test_familia_cobre_os_dois_ramos(familia):
    assert familia[219] == {"nome": "Procedência", "ramo": "com_merito"}
    assert familia[463]["ramo"] == "sem_merito"
    assert 123 not in familia  # Remessa não é julgamento


def test_sentenciado_conta_ate_a_primeira_sentenca(familia):
    c = Counter()
    linha, movs = processar(fonte(movimentos=[
        (26, "2020-01-16T10:00:00.000Z"),   # distribuição
        (219, "2021-01-15T10:00:00.000Z"),  # procedência
        (198, "2021-03-01T10:00:00.000Z"),  # embargos, também família 193, mas posterior
    ]), SNAPSHOT, familia, c)
    assert linha["evento"] == 1 and linha["tempo_dias"] == 366
    assert linha["data_evento"] == date(2021, 1, 15)
    assert linha["tipo_sentenca"] == "Procedência" and linha["com_merito"] is True
    assert len(movs) == 3 and linha["flags"] == ""


def test_censurado_conta_ate_o_snapshot(familia):
    linha, _ = processar(fonte(movimentos=[(26, "2020-01-16T10:00:00.000Z"), (123, "2020-02-01T10:00:00.000Z")]),
                         SNAPSHOT, familia, Counter())
    assert linha["evento"] == 0 and linha["data_evento"] is None
    assert linha["tempo_dias"] == (SNAPSHOT - date(2020, 1, 15)).days
    assert linha["tipo_sentenca"] is None


def test_descartes_sao_contados(familia):
    c = Counter()
    assert processar(fonte(ajuizamento="19850101000000"), SNAPSHOT, familia, c) == (None, [])
    assert processar(fonte(ajuizamento="20270101000000"), SNAPSHOT, familia, c) == (None, [])
    assert processar(fonte(movimentos=[(219, "2019-12-31T10:00:00.000Z")]), SNAPSHOT, familia, c) == (None, [])
    assert c["descartado: ajuizamento fora de [1990, snapshot]"] == 2
    assert c["descartado: sentença antes do ajuizamento"] == 1


def test_movimentos_duplicados_no_dia_e_historico_curto(familia):
    c = Counter()
    linha, movs = processar(fonte(movimentos=[(26, "2020-01-16T10:00:00.000Z"), (26, "2020-01-16T15:00:00.000Z")]),
                            SNAPSHOT, familia, c)
    assert len(movs) == 1 and linha["n_movimentos"] == 1
    assert c["movimento duplicado (mesmo código, mesmo dia) removido"] == 1
    assert "historico_curto" in linha["flags"]


def test_movimento_sem_codigo_e_ignorado_e_contado(familia):
    c = Counter()
    src = fonte(movimentos=[(26, "2020-01-16T10:00:00.000Z"), (219, "2021-01-15T10:00:00.000Z")])
    src["movimentos"].append({"dataHora": "2026-05-18T06:24:00.000Z", "orgaoJulgador": {"codigo": "10672"}})
    linha, movs = processar(src, SNAPSHOT, familia, c)
    assert c["movimento sem código TPU ignorado"] == 1
    assert len(movs) == 2 and linha["evento"] == 1
