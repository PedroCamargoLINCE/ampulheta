"""A fixture do contrato tem que continuar válida; é o que o Web consome."""
import importlib.util
import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def _carregar_validador():
    spec = importlib.util.spec_from_file_location("validar", RAIZ / "contracts" / "validar.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_fixture_valida():
    validar = _carregar_validador()
    doc = json.loads((RAIZ / "contracts" / "fixtures" / "curvas.exemplo.json").read_text(encoding="utf-8"))
    r = validar.validar(doc)
    assert r.erros == []
    assert doc["sintetico"] is True


def test_validador_pega_s_crescente():
    validar = _carregar_validador()
    doc = json.loads((RAIZ / "contracts" / "fixtures" / "curvas.exemplo.json").read_text(encoding="utf-8"))
    doc["curvas"][0]["sobrevivencia"][5] = 1.0  # quebra a monotonicidade
    assert any("não crescente" in e for e in validar.validar(doc).erros)
