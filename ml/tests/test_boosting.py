import json

from ampulheta.boosting import PARAMETROS, modelar_boosting
from ampulheta.cox import modelar_cox
from ampulheta.relatorio import relatorio

from .test_cox import CFG, processos_sinteticos

RAPIDO = PARAMETROS | {"n_estimators": 30}


def test_boosting_valida_no_tempo_e_agrega_importancia():
    p = processos_sinteticos(1200)
    b = modelar_boosting(p, CFG, RAPIDO)
    padrao = b["transicoes"][0]
    assert padrao["treino"]["n"] + padrao["teste"]["n"] == 1200
    assert 0.55 < padrao["concordance_index"]["teste"] < 0.9
    assert padrao["brier_integrado"]["boosting"] < padrao["brier_integrado"]["kaplan_meier"]
    assert {c["horizonte_meses"] for c in padrao["calibracao"]} == {12, 24}
    imp = padrao["importancia"]
    assert set(imp) == {"vara", "classe", "assunto"} and abs(sum(imp.values()) - 1) < 1e-3
    assert "hazard_ratios" not in padrao
    json.dumps(b)


def test_transicao_com_poucos_eventos_fica_sem_boosting():
    p = processos_sinteticos(1200)
    p["data_audiencia"] = None
    p.loc[p.index[:20], "data_audiencia"] = p.data_ajuizamento[:20]
    assert "indisponivel" in modelar_boosting(p, CFG, RAPIDO)["transicoes"][1]


def test_relatorio_compara_as_tres_camadas():
    p = processos_sinteticos(1200)
    texto = relatorio(modelar_cox(p, CFG), modelar_boosting(p, CFG, RAPIDO), CFG)
    assert "CNJ/DataJud, API Pública" in texto and "snapshot 2026-10-29" in texto
    assert "## Ajuizamento → Sentença" in texto and "## Audiência → Sentença" in texto
    assert "## Comparação de camadas" in texto and "Boosting" in texto and "Cobrança (100)" in texto
