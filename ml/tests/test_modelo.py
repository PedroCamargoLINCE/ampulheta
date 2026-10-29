import importlib.util
import json
import subprocess
import sys
from datetime import date, datetime, timezone

import numpy as np
import pandas as pd

from ampulheta.modelo import curva_km, curvas_km, tempo_em_meses
from ampulheta.publicar import montar_documento

CFG = {
    "tribunal": "tjsp", "grau": "G1", "municipio": "Sorocaba",
    "classes": [{"codigo": 7, "nome": "Procedimento Comum Cível"}, {"codigo": 93, "nome": "Despejo"}],
    "varas": [{"codigo": 10671, "nome": "3ª Vara"}, {"codigo": 10672, "nome": "4ª Vara"}, {"codigo": 99, "nome": "sem dados"}],
}


def processos_sinteticos(n=600, seed=0) -> pd.DataFrame:
    """Tempos Weibull censurados num snapshot; vara 10672 é mais lenta que a 10671."""
    rng = np.random.default_rng(seed)
    vara = rng.choice([10671, 10672], n)
    classe = rng.choice([7, 93], n, p=[0.8, 0.2])
    escala = np.where(vara == 10672, 600, 400)
    verdadeiro = rng.weibull(1.3, n) * escala
    censura = rng.uniform(200, 2000, n)
    return pd.DataFrame({
        "vara_codigo": vara, "classe_codigo": classe,
        "tempo_dias": np.minimum(verdadeiro, censura).astype(int),
        "evento": (verdadeiro <= censura).astype(int),
        "data_censura": date(2026, 10, 29),
    })


def test_curva_km_respeita_invariantes_do_contrato():
    df = processos_sinteticos()
    grade = list(range(0, 61))
    c = curva_km(tempo_em_meses(df.tempo_dias), df.evento, grade)
    S, lo, hi = c["sobrevivencia"], c["ic_inferior"], c["ic_superior"]
    assert len(S) == len(lo) == len(hi) == 61
    assert S[0] == 1.0 and all(b <= a for a, b in zip(S, S[1:]))
    assert all(l <= s <= h for l, s, h in zip(lo, S, hi))
    assert c["n"] == c["eventos"] + c["censurados"] == 600
    gw = c["greenwood_acumulado"]
    assert len(gw) == 61 and gw[0] == 0 and all(b >= a for a, b in zip(gw, gw[1:]))
    assert gw[12] > 0  # já houve eventos no primeiro ano
    q = c["quantis_meses"]
    assert q["p50"] is not None and q["p50"] <= q["p80"]
    assert q["p90"] is None or q["p80"] <= q["p90"]


def test_evento_no_dia_zero_nao_derruba_s_de_zero():
    df = pd.DataFrame({"tempo_dias": [0, 0, 10, 20], "evento": [1, 1, 1, 0]})
    c = curva_km(tempo_em_meses(df.tempo_dias), df.evento, [0, 1, 2])
    assert c["sobrevivencia"][0] == 1.0


def test_curvas_km_omite_grupos_pequenos_e_detecta_vara_lenta():
    df = processos_sinteticos()
    km = curvas_km(df)
    chaves = {(c["vara"], c["classe"]) for c in km["curvas"]}
    assert (None, None) in chaves and ("10671", None) in chaves and ("10672", None) in chaves
    assert all(c["n"] >= 30 for c in km["curvas"])
    por_vara = {c["vara"]: c["quantis_meses"]["p50"] for c in km["curvas"] if c["classe"] is None and c["vara"]}
    assert por_vara["10672"] > por_vara["10671"]
    assert km["logrank_entre_varas"]["p"] < 0.01


def test_documento_publicado_passa_no_validador_estrito(tmp_path):
    df = processos_sinteticos()
    doc = montar_documento(CFG, curvas_km(df), df, datetime(2026, 10, 29, 12, tzinfo=timezone.utc))
    assert doc["snapshot"] == "2026-10-29" and "28/10" not in doc["fonte"]["citacao"]
    assert [v["codigo"] for v in doc["varas"]] == ["10671", "10672"]  # vara sem dados não entra
    arq = tmp_path / "curvas.json"
    arq.write_text(json.dumps(doc), encoding="utf-8")
    r = subprocess.run([sys.executable, "../contracts/validar.py", str(arq), "--estrito"], capture_output=True, text=True)
    assert r.returncode == 0, r.stdout
