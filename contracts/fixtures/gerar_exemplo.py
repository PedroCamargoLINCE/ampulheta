#!/usr/bin/env python3
"""Gera contracts/fixtures/curvas.exemplo.json: dado SINTÉTICO no formato do contrato.

Curvas Weibull S(t) = exp(-(t/λ)^k) com parâmetros plausíveis por vara × classe,
IC 95% aproximado por Greenwood com n fictício. Serve só para o Web desenvolver
antes de existir dado real. Sem dependências além da biblioteca padrão.
"""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timezone
from pathlib import Path

random.seed(2026)
SAIDA = Path(__file__).with_name("curvas.exemplo.json")
HORIZONTE_MESES = 120

VARAS = [
    {"codigo": "9001", "nome": "1ª Vara Cível de Sorocaba", "municipio": "Sorocaba"},
    {"codigo": "9002", "nome": "2ª Vara Cível de Sorocaba", "municipio": "Sorocaba"},
    {"codigo": "9003", "nome": "3ª Vara Cível de Sorocaba", "municipio": "Sorocaba"},
]
CLASSES = [
    {"codigo": "7", "nome": "Procedimento Comum Cível"},
    {"codigo": "12", "nome": "Despejo por Falta de Pagamento"},
]
# (escala λ em meses, forma k) — despejo é mais rápido; 3ª vara é mais lenta
PARAMS = {
    ("9001", "7"): (22.0, 1.6), ("9002", "7"): (19.0, 1.5), ("9003", "7"): (31.0, 1.4),
    ("9001", "12"): (11.0, 1.8), ("9002", "12"): (9.5, 1.9), ("9003", "12"): (16.0, 1.6),
}
TAMANHOS = {
    ("9001", "7"): 1820, ("9002", "7"): 1540, ("9003", "7"): 2105,
    ("9001", "12"): 610, ("9002", "12"): 480, ("9003", "12"): 720,
}


def weibull(t: float, lam: float, k: float) -> float:
    return math.exp(-((t / lam) ** k)) if t > 0 else 1.0


def curva(lam: float, k: float, n: int, grade: list[int]) -> dict:
    S = [weibull(t, lam, k) for t in grade]
    # Greenwood aproximado: var(S) ≈ S² · (1−S)/(n·S) ; IC em escala log(−log) simplificado
    lo, hi, gw = [], [], []
    for s in S:
        if s <= 0 or s >= 1:
            lo.append(s); hi.append(s); gw.append(gw[-1] if gw else 0.0); continue
        gw.append((1 - s) / (n * s))  # σ² de Greenwood acumulada, aproximação sem censura
        se = s * math.sqrt((1 - s) / (n * s))
        lo.append(max(0.0, s - 1.96 * se))
        hi.append(min(1.0, s + 1.96 * se))
    eventos = round(n * (1 - weibull(grade[-1] * 0.55, lam, k)))  # censura cerca de 45% da janela
    quantis = {}
    for nome, p in (("p50", 0.5), ("p80", 0.8), ("p90", 0.9)):
        t = lam * (-math.log(1 - p)) ** (1 / k)
        quantis[nome] = round(t, 1) if t <= grade[-1] else None
    return {
        "metodo": "kaplan-meier",
        "n": n, "eventos": eventos, "censurados": n - eventos,
        "sobrevivencia": [round(x, 4) for x in S],
        "ic_inferior": [round(x, 4) for x in lo],
        "ic_superior": [round(x, 4) for x in hi],
        "greenwood_acumulado": [round(x, 6) for x in gw],
        "quantis_meses": quantis,
    }


def mistura(chaves: list[tuple[str, str]], grade: list[int]) -> dict:
    """Agregado = média ponderada por n das curvas componentes."""
    comps = [(TAMANHOS[c], curva(*PARAMS[c], TAMANHOS[c], grade)) for c in chaves]
    n = sum(w for w, _ in comps)
    def pond(campo: str, casas: int = 4) -> list[float]:
        return [round(sum(w * c[campo][i] for w, c in comps) / n, casas) for i in range(len(grade))]
    S = pond("sobrevivencia")
    eventos = sum(c["eventos"] for _, c in comps)
    quantis = {}
    for nome, p in (("p50", 0.5), ("p80", 0.8), ("p90", 0.9)):
        alvo = 1 - p
        q = None
        for i in range(1, len(grade)):
            if S[i] <= alvo:
                # interpolação linear entre i-1 e i
                frac = (S[i - 1] - alvo) / (S[i - 1] - S[i]) if S[i - 1] != S[i] else 0
                q = round(grade[i - 1] + frac * (grade[i] - grade[i - 1]), 1)
                break
        quantis[nome] = q
    return {
        "metodo": "kaplan-meier", "n": n, "eventos": eventos, "censurados": n - eventos,
        "sobrevivencia": S, "ic_inferior": pond("ic_inferior"), "ic_superior": pond("ic_superior"),
        "greenwood_acumulado": pond("greenwood_acumulado", 6), "quantis_meses": quantis,
    }


def main() -> None:
    grade = list(range(0, HORIZONTE_MESES + 1))
    curvas = []
    todas = list(PARAMS)
    curvas.append({"vara": None, "classe": None, **mistura(todas, grade)})
    for v in VARAS:
        curvas.append({"vara": v["codigo"], "classe": None,
                       **mistura([c for c in todas if c[0] == v["codigo"]], grade)})
    for c in CLASSES:
        curvas.append({"vara": None, "classe": c["codigo"],
                       **mistura([k for k in todas if k[1] == c["codigo"]], grade)})
    for (v, c), (lam, k) in PARAMS.items():
        curvas.append({"vara": v, "classe": c, **curva(lam, k, TAMANHOS[(v, c)], grade)})

    doc = {
        "contrato": "1.1.0",
        "gerado_em": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "snapshot": "2026-10-28",
        "sintetico": True,
        "fonte": {
            "nome": "DADO SINTÉTICO — não é CNJ/DataJud",
            "url": "https://datajud-wiki.cnj.jus.br/api-publica/",
            "citacao": "Dado sintético para desenvolvimento. Nenhum processo real.",
        },
        "tribunal": "TJSP",
        "grau": "G1",
        "evento": "Primeiro movimento da família Julgamento (TPU 193 e filhos)",
        "grade_meses": grade,
        "varas": VARAS,
        "classes": CLASSES,
        "curvas": curvas,
    }
    SAIDA.write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"gravado {SAIDA} com {len(curvas)} curvas")


if __name__ == "__main__":
    main()
