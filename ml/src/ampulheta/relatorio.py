"""Estágio 3 — Relatório do modelo. Lê `models/cox.json` e `models/boosting.json` e escreve
`../data/relatorio_modelo.md`: uma seção por transição (hazard ratios, validação temporal e
calibração do Cox) e a comparação Kaplan-Meier × Cox × boosting no teste temporal."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

from .cox import ANO_CORTE, HORIZONTE_BRIER


def rotulos(cfg: dict[str, Any]) -> dict[str, str]:
    return {"ajuizamento": "Ajuizamento", "sentenca": "Sentença"} | {m["nome"]: m["rotulo"] for m in cfg.get("marcos", [])}


def nomes_covariaveis(cox: dict[str, Any], cfg: dict[str, Any]) -> dict[str, str]:
    nomes = {f"vara_{v['codigo']}": v["nome"] for v in cfg["varas"]}
    nomes |= {f"classe_{c['codigo']}": c["nome"] for c in cfg["classes"]}
    # o código vai junto porque a TPU repete nomes em ramos diferentes (ex.: dano moral civil e do consumidor)
    nomes |= {f"assunto_{a['codigo']}": f"{a['nome'] or 'sem nome'} ({a['codigo']})" for a in cox["covariaveis"]["assunto"]["usados"]}
    return nomes


def erro_calibracao(cal: list[dict[str, Any]], h: int) -> float:
    """Diferença absoluta média entre observado e previsto, ponderada pelo n de cada grupo."""
    c = pd.DataFrame(cal)
    c = c[c.horizonte_meses == h]
    return round(float(((c.observado - c.previsto).abs() * c.n).sum() / c.n.sum()), 3)


def secao_transicao(t: dict[str, Any], nomes: dict[str, str], titulo: str) -> list[str]:
    ph = {p["covariavel"]: p["p"] for p in t["proporcionalidade"]}
    hr = pd.DataFrame([{"grupo": h["covariavel"].split("_")[0], "covariável": nomes[h["covariavel"]],
                        "hazard ratio": h["hazard_ratio"], "IC 95%": f'{h["ic_inferior"]}–{h["ic_superior"]}',
                        "p": f'{h["p"]:.2g}', "p proporcionalidade": f'{ph.get(h["covariavel"], float("nan")):.2g}'}
                       for h in t["hazard_ratios"]])
    v = t["validacao_temporal"]
    linhas = [f"## {titulo}", "", f"Cox sobre {t['n']} processos ({t['eventos']} com evento).", "",
              "### Hazard ratios (modelo ajustado em todos os processos)", "", hr.to_markdown(index=False), "",
              f"### Validação temporal (treino: ajuizados até {v['treino']['ate']}, n = {v['treino']['n']}; "
              f"teste: {v['teste']['de']} em diante, n = {v['teste']['n']})", ""]
    if "indisponivel" in v:
        return linhas + [f"Sem validação temporal: {v['indisponivel']}.", ""]
    cal = pd.DataFrame(v["calibracao"])
    return linhas + [
        f"- Concordance index: {v['concordance_index']['treino']} no treino, {v['concordance_index']['teste']} no teste "
        "(0,5 = ordena ao acaso).",
        *([f"- Sem processos suficientes no treino, tratadas como referência no teste: "
           + ", ".join(nomes[c] for c in v["covariaveis_fora_do_treino"]) + "."] if v["covariaveis_fora_do_treino"] else []),
        f"- Brier integrado até {v['brier_integrado']['horizonte_meses']} meses no teste: {v['brier_integrado']['cox']} "
        f"(Kaplan-Meier sem covariáveis: {v['brier_integrado']['kaplan_meier']}; menor é melhor).",
        "", "### Calibração no teste (probabilidade do evento até h meses, por grupo do previsto)", "",
        *(f"{h} meses:\n\n" + cal[cal.horizonte_meses == h].drop(columns="horizonte_meses").to_markdown(index=False) + "\n"
          for h in sorted(set(cal.horizonte_meses))),
    ]


def comparacao(cox: dict[str, Any], boosting: dict[str, Any], rot: dict[str, str]) -> list[str]:
    b_por = {(t["origem"], t["destino"]): t for t in boosting["transicoes"]}
    linhas, importancias, avisos = [], [], []
    for t in cox["transicoes"]:
        nome = f"{rot[t['origem']]} → {rot[t['destino']]}"
        v, b = t["validacao_temporal"], b_por.get((t["origem"], t["destino"]), {"indisponivel": "não ajustado"})
        if "indisponivel" in v:
            avisos.append(f"{nome}: sem teste temporal ({v['indisponivel']}).")
            continue
        horizontes = sorted({c["horizonte_meses"] for c in v["calibracao"]})
        cal = lambda c: {f"erro de calibração {h} m": erro_calibracao(c, h) for h in horizontes}
        linhas += [{"transição": nome, "camada": "Kaplan-Meier", "c-index": 0.5, "Brier integrado": v["brier_integrado"]["kaplan_meier"]},
                   {"transição": nome, "camada": "Cox", "c-index": v["concordance_index"]["teste"],
                    "Brier integrado": v["brier_integrado"]["cox"], **cal(v["calibracao"])}]
        if "indisponivel" in b:
            avisos.append(f"{nome}: boosting não ajustado ({b['indisponivel']}).")
        else:
            linhas.append({"transição": nome, "camada": "Boosting", "c-index": b["concordance_index"]["teste"],
                           "Brier integrado": b["brier_integrado"]["boosting"], **cal(b["calibracao"])})
            importancias.append({"transição": nome, **b["importancia"]})
    p = boosting["parametros"]
    return [
        "## Comparação de camadas (teste temporal)", "",
        f"Mesmo treino (ajuizados até {ANO_CORTE}) e mesmo teste para as três. "
        "Kaplan-Meier não usa covariáveis, então ordena ao acaso (c-index 0,5). "
        f"Brier integrado até {HORIZONTE_BRIER} meses; "
        "erro de calibração = diferença média entre observado e previsto nos grupos, ponderada pelo n. "
        f"Boosting com perda de Cox, {p['n_estimators']} árvores de profundidade {p['max_depth']}, taxa {p['learning_rate']}, "
        f"subamostra {p['subsample']}, parâmetros fixos sem busca; serve só para comparação e não publica curvas.",
        "", pd.DataFrame(linhas).fillna("—").to_markdown(index=False), "",
        *([f"- {a}" for a in avisos] + [""] if avisos else []),
        "Importância das variáveis no boosting (redução de perda, somada por grupo):", "",
        pd.DataFrame(importancias).to_markdown(index=False) if importancias else "sem boosting ajustado.", "",
    ]


def relatorio(cox: dict[str, Any], boosting: dict[str, Any], cfg: dict[str, Any]) -> str:
    nomes, rot = nomes_covariaveis(cox, cfg), rotulos(cfg)
    ref_vara = nomes.get(f"vara_{cox['covariaveis']['vara']['referencia']}")
    ref_classe = nomes.get(f"classe_{cox['covariaveis']['classe']['referencia']}")
    a = cox["covariaveis"]["assunto"]
    return "\n".join([
        f"# Relatório do modelo — snapshot {cox['snapshot']}",
        "",
        "Gerado por `ampulheta modelar`. Fonte: CNJ/DataJud, API Pública.",
        "",
        "Cox proporcional, um modelo por transição (a fase atual não entra como covariável, para evitar viés de "
        f"tempo imortal), com vara, classe e assunto principal. Referências: {ref_vara}, {ref_classe} e "
        f"{a['referencia']} (assuntos com menos de {a['fracao_minima']:.0%} dos processos; {len(a['usados'])} assuntos "
        "entram como covariável). Hazard ratio > 1 = evento mais rápido que a referência. A coluna de proporcionalidade "
        "é o p do teste de Schoenfeld; p pequeno indica que o efeito muda ao longo do tempo e o hazard ratio deve ser "
        "lido como média no período.",
        "",
        *[l for t in cox["transicoes"] for l in secao_transicao(t, nomes, f"{rot[t['origem']]} → {rot[t['destino']]}")],
        *comparacao(cox, boosting, rot),
    ])


def escrever(cfg: dict[str, Any]) -> None:
    ler = lambda nome: json.loads(Path(f"models/{nome}.json").read_text(encoding="utf-8"))
    destino = Path(cfg["saida"]["data"]) / "relatorio_modelo.md"
    destino.write_text(relatorio(ler("cox"), ler("boosting"), cfg), encoding="utf-8")
    print(f"relatório -> {destino}")
