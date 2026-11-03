import json
from datetime import date

import numpy as np
import pandas as pd

from ampulheta.cox import modelar_cox, montar_matriz, relatorio

CFG = {
    "classes": [{"codigo": 7, "nome": "Procedimento Comum Cível"}, {"codigo": 93, "nome": "Despejo"}],
    "varas": [{"codigo": 10671, "nome": "3ª Vara"}, {"codigo": 10672, "nome": "4ª Vara"}],
}


def processos_sinteticos(n=3000, seed=0) -> pd.DataFrame:
    """Weibull censurado; a 4ª Vara é mais lenta e o despejo é mais rápido; ajuizamentos de 2018 a 2024."""
    rng = np.random.default_rng(seed)
    vara = rng.choice([10671, 10672], n)
    classe = rng.choice([7, 93], n, p=[0.8, 0.2])
    escala = np.where(vara == 10672, 600, 400) * np.where(classe == 93, 0.4, 1.0)
    verdadeiro = rng.weibull(1.3, n) * escala
    ajuizamento = pd.Series(pd.to_datetime("2018-01-01") + pd.to_timedelta(rng.integers(0, 7 * 365, n), unit="D"))
    censura = (pd.Timestamp("2026-10-29") - ajuizamento).dt.days.to_numpy()
    return pd.DataFrame({
        "vara_codigo": vara, "classe_codigo": classe, "data_ajuizamento": ajuizamento.dt.date,
        "tempo_dias": np.minimum(verdadeiro, censura).astype(int),
        "evento": (verdadeiro <= censura).astype(int),
        "data_censura": date(2026, 10, 29),
    })


def test_matriz_usa_a_primeira_vara_e_classe_como_referencia():
    m = montar_matriz(processos_sinteticos(50), CFG)
    assert set(m.columns) == {"t", "evento", "ano", "vara_10672", "classe_93"}
    assert m.t.min() > 0


def test_cox_recupera_os_efeitos_e_valida_no_tempo():
    cox = modelar_cox(processos_sinteticos(), CFG)
    hr = {h["covariavel"]: h for h in cox["hazard_ratios"]}
    assert hr["vara_10672"]["hazard_ratio"] < 1 < hr["classe_93"]["hazard_ratio"]
    assert all(h["ic_inferior"] <= h["hazard_ratio"] <= h["ic_superior"] for h in hr.values())
    v = cox["validacao_temporal"]
    assert v["treino"]["ate"] == 2021 and v["teste"]["de"] == 2022 and v["treino"]["n"] + v["teste"]["n"] == 3000
    assert 0.55 < v["concordance_index"]["teste"] < 0.9
    assert v["brier_integrado"]["cox"] <= v["brier_integrado"]["kaplan_meier"]
    cal = pd.DataFrame(v["calibracao"])
    assert set(cal.horizonte_meses) == {12, 24} and (cal.n > 0).all()
    assert (cal.observado - cal.previsto).abs().mean() < 0.1  # dado sintético segue Weibull, não Cox; só exige calibração razoável
    json.dumps(cox)  # serializável
    assert "hazard ratio" in relatorio(cox, CFG, "2026-10-29")
