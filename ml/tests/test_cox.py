import json
from datetime import date

import numpy as np
import pandas as pd

from ampulheta.cox import assuntos_frequentes, modelar_cox, montar_matriz

CFG = {
    "classes": [{"codigo": 7, "nome": "Procedimento Comum Cível"}, {"codigo": 93, "nome": "Despejo"}],
    "varas": [{"codigo": 10671, "nome": "3ª Vara"}, {"codigo": 10672, "nome": "4ª Vara"}],
    "marcos": [{"nome": "audiencia", "rotulo": "Audiência"}],
    "transicoes": [["ajuizamento", "sentenca"], ["audiencia", "sentenca"]],
}
ASSUNTOS = {100: "Cobrança", 200: "Dano Moral"}


def processos_sinteticos(n=3000, seed=0) -> pd.DataFrame:
    """Weibull censurado; a 4ª Vara é mais lenta, o despejo e o assunto 100 são mais rápidos; ajuizamentos
    de 2018 a 2024. Um terço tem audiência, num instante uniforme antes do evento (ou da censura)."""
    rng = np.random.default_rng(seed)
    vara = rng.choice([10671, 10672], n)
    classe = rng.choice([7, 93], n, p=[0.8, 0.2])
    # 300 e 400 ficam abaixo de 1% e viram "outros assuntos"
    assunto = rng.choice([100, 200, 300, 400], n, p=[0.4, 0.584, 0.008, 0.008])
    escala = np.where(vara == 10672, 600, 400) * np.where(classe == 93, 0.4, 1.0) * np.where(assunto == 100, 0.6, 1.0)
    verdadeiro = rng.weibull(1.3, n) * escala
    ajuizamento = pd.Series(pd.to_datetime("2018-01-01") + pd.to_timedelta(rng.integers(0, 7 * 365, n), unit="D"))
    censura = (pd.Timestamp("2026-10-29") - ajuizamento).dt.days.to_numpy()
    tempo = np.minimum(verdadeiro, censura).astype(int)
    evento = verdadeiro <= censura
    audiencia = ajuizamento + pd.to_timedelta(np.where(rng.random(n) < 1 / 3, rng.random(n) * tempo, np.nan), unit="D")
    return pd.DataFrame({
        "vara_codigo": vara, "classe_codigo": classe, "assunto_principal": assunto,
        "assunto_principal_nome": [ASSUNTOS.get(a) for a in assunto],
        "data_ajuizamento": ajuizamento.dt.date, "tempo_dias": tempo, "evento": evento.astype(int),
        "data_evento": (ajuizamento + pd.to_timedelta(tempo, unit="D")).where(evento).dt.date,
        "data_audiencia": audiencia.dt.date, "data_censura": date(2026, 10, 29),
    })


def test_assuntos_raros_ficam_em_outros():
    p = processos_sinteticos()
    assert assuntos_frequentes(p) == [{"codigo": 200, "nome": "Dano Moral"}, {"codigo": 100, "nome": "Cobrança"}]


def test_matriz_usa_a_primeira_vara_e_classe_como_referencia():
    p = processos_sinteticos(50)
    m = montar_matriz(p, CFG, [{"codigo": 100, "nome": "Cobrança"}])
    assert set(m.columns) == {"t", "evento", "ano", "vara_10672", "classe_93", "assunto_100"}
    assert m.t.min() > 0
    todas = montar_matriz(p, CFG, [{"codigo": 100, "nome": "Cobrança"}], referencia=False)
    assert {"vara_10671", "vara_10672", "classe_7", "classe_93", "assunto_100"} <= set(todas.columns)


def test_cox_recupera_os_efeitos_e_valida_no_tempo_em_cada_transicao():
    cox = modelar_cox(processos_sinteticos(), CFG)
    assert cox["covariaveis"]["assunto"]["referencia"] == "outros assuntos"
    assert [a["codigo"] for a in cox["covariaveis"]["assunto"]["usados"]] == [200, 100]
    padrao, audiencia = cox["transicoes"]
    assert (padrao["origem"], audiencia["origem"]) == ("ajuizamento", "audiencia")
    assert audiencia["n"] < padrao["n"]
    hr = {h["covariavel"]: h for h in padrao["hazard_ratios"]}
    assert hr["vara_10672"]["hazard_ratio"] < 1 < hr["classe_93"]["hazard_ratio"]
    assert hr["assunto_200"]["hazard_ratio"] < hr["assunto_100"]["hazard_ratio"]
    assert all(h["ic_inferior"] <= h["hazard_ratio"] <= h["ic_superior"] for h in hr.values())
    v = padrao["validacao_temporal"]
    assert v["treino"]["ate"] == 2021 and v["teste"]["de"] == 2022 and v["treino"]["n"] + v["teste"]["n"] == 3000
    assert 0.55 < v["concordance_index"]["teste"] < 0.9
    assert v["brier_integrado"]["cox"] <= v["brier_integrado"]["kaplan_meier"]
    cal = pd.DataFrame(v["calibracao"])
    assert set(cal.horizonte_meses) == {12, 24} and (cal.n > 0).all()
    assert (cal.observado - cal.previsto).abs().mean() < 0.1  # dado sintético segue Weibull, não Cox; só exige calibração razoável
    assert "concordance_index" in audiencia["validacao_temporal"]
    json.dumps(cox)  # serializável


def test_transicao_sem_teste_e_reportada_em_vez_de_quebrar():
    p = processos_sinteticos()
    p.loc[pd.to_datetime(p.data_ajuizamento).dt.year > 2021, "data_audiencia"] = None
    v = modelar_cox(p, CFG)["transicoes"][1]["validacao_temporal"]
    assert v["indisponivel"] == "sem processos no teste" and v["teste"]["n"] == 0
