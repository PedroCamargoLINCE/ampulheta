#!/usr/bin/env python3
"""Valida um curvas.json contra o contrato 1.x sem dependências externas.

Uso: python3 contracts/validar.py <arquivo.json> [--estrito]

Checa a estrutura (campos, tipos) e os invariantes matemáticos que um JSON Schema
não expressa: tamanhos iguais, S não crescente, S[0] == 1, IC envolvendo S,
n == eventos + censurados, códigos referenciados existentes, quantis ordenados,
greenwood_acumulado (opcional, 1.1.0) não decrescente a partir de 0.
Sai com código 0 se válido, 1 se houver erro. Avisos (ex.: n < 30) só viram erro
com --estrito.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime

EPS = 1e-9
N_MINIMO = 30


class Resultado:
    def __init__(self) -> None:
        self.erros: list[str] = []
        self.avisos: list[str] = []

    def erro(self, msg: str) -> None:
        self.erros.append(msg)

    def aviso(self, msg: str) -> None:
        self.avisos.append(msg)


def _exige(obj: dict, chave: str, tipos, r: Resultado, onde: str) -> bool:
    if chave not in obj:
        r.erro(f"{onde}: falta o campo '{chave}'")
        return False
    if not isinstance(obj[chave], tipos):
        r.erro(f"{onde}: campo '{chave}' tem tipo {type(obj[chave]).__name__}, esperado {tipos}")
        return False
    return True


def _lista_numerica(v, nome: str, r: Resultado, onde: str) -> bool:
    if not isinstance(v, list) or not all(isinstance(x, (int, float)) and not isinstance(x, bool) for x in v):
        r.erro(f"{onde}: '{nome}' deve ser lista de números")
        return False
    if any(x < -EPS or x > 1 + EPS for x in v):
        r.erro(f"{onde}: '{nome}' tem valor fora de [0, 1]")
        return False
    return True


def validar(doc: dict) -> Resultado:
    r = Resultado()
    if not isinstance(doc, dict):
        r.erro("raiz deve ser um objeto")
        return r

    # --- cabeçalho -----------------------------------------------------------
    if _exige(doc, "contrato", str, r, "raiz") and not re.fullmatch(r"1\.\d+\.\d+", doc["contrato"]):
        r.erro(f"raiz: 'contrato' = {doc['contrato']!r}; este validador aceita 1.x.y")
    if _exige(doc, "gerado_em", str, r, "raiz"):
        try:
            datetime.fromisoformat(doc["gerado_em"].replace("Z", "+00:00"))
        except ValueError:
            r.erro("raiz: 'gerado_em' não é ISO-8601")
    if _exige(doc, "snapshot", str, r, "raiz"):
        try:
            date.fromisoformat(doc["snapshot"])
        except ValueError:
            r.erro("raiz: 'snapshot' não é data AAAA-MM-DD")
    _exige(doc, "sintetico", bool, r, "raiz")
    if _exige(doc, "fonte", dict, r, "raiz"):
        for k in ("nome", "url", "citacao"):
            if _exige(doc["fonte"], k, str, r, "fonte") and not doc["fonte"][k].strip():
                r.erro(f"fonte: '{k}' vazio")
    _exige(doc, "tribunal", str, r, "raiz")
    if _exige(doc, "grau", str, r, "raiz") and doc["grau"] not in ("G1", "G2"):
        r.erro("raiz: 'grau' deve ser G1 ou G2")
    _exige(doc, "evento", str, r, "raiz")

    # --- grade ---------------------------------------------------------------
    grade = doc.get("grade_meses")
    if _exige(doc, "grade_meses", list, r, "raiz"):
        if len(grade) < 2 or not all(isinstance(g, int) and not isinstance(g, bool) for g in grade):
            r.erro("grade_meses: precisa de >= 2 inteiros")
        elif grade[0] != 0:
            r.erro("grade_meses: deve começar em 0")
        elif any(b <= a for a, b in zip(grade, grade[1:])):
            r.erro("grade_meses: deve ser estritamente crescente")

    # --- dicionários ---------------------------------------------------------
    varas: set[str] = set()
    classes: set[str] = set()
    if _exige(doc, "varas", list, r, "raiz"):
        for i, v in enumerate(doc["varas"]):
            onde = f"varas[{i}]"
            if isinstance(v, dict) and all(_exige(v, k, str, r, onde) for k in ("codigo", "nome", "municipio")):
                if v["codigo"] in varas:
                    r.erro(f"{onde}: código duplicado {v['codigo']!r}")
                varas.add(v["codigo"])
            elif not isinstance(v, dict):
                r.erro(f"{onde}: deve ser objeto")
    if _exige(doc, "classes", list, r, "raiz"):
        for i, c in enumerate(doc["classes"]):
            onde = f"classes[{i}]"
            if isinstance(c, dict) and all(_exige(c, k, str, r, onde) for k in ("codigo", "nome")):
                if c["codigo"] in classes:
                    r.erro(f"{onde}: código duplicado {c['codigo']!r}")
                classes.add(c["codigo"])
            elif not isinstance(c, dict):
                r.erro(f"{onde}: deve ser objeto")

    # --- curvas --------------------------------------------------------------
    if not _exige(doc, "curvas", list, r, "raiz") or not doc["curvas"]:
        r.erro("curvas: lista vazia")
        return r

    tem_agregada = False
    chaves_vistas: set[tuple] = set()
    n_grade = len(grade) if isinstance(grade, list) else None
    for i, c in enumerate(doc["curvas"]):
        onde = f"curvas[{i}]"
        if not isinstance(c, dict):
            r.erro(f"{onde}: deve ser objeto")
            continue
        vara, classe = c.get("vara"), c.get("classe")
        for nome, val, dic in (("vara", vara, varas), ("classe", classe, classes)):
            if val is None:
                continue
            if not isinstance(val, str):
                r.erro(f"{onde}: '{nome}' deve ser string ou null")
            elif val not in dic:
                r.erro(f"{onde}: {nome} {val!r} não está em '{nome}s'")
        if vara is None and classe is None:
            tem_agregada = True
        chave = (vara, classe)
        if chave in chaves_vistas:
            r.erro(f"{onde}: curva duplicada para vara={vara!r} classe={classe!r}")
        chaves_vistas.add(chave)

        if _exige(c, "metodo", str, r, onde) and c["metodo"] != "kaplan-meier":
            r.erro(f"{onde}: metodo {c['metodo']!r} desconhecido no contrato 1.x")

        ok_n = all(_exige(c, k, int, r, onde) for k in ("n", "eventos", "censurados"))
        if ok_n:
            if c["n"] != c["eventos"] + c["censurados"]:
                r.erro(f"{onde}: n ({c['n']}) != eventos + censurados ({c['eventos'] + c['censurados']})")
            if c["n"] < N_MINIMO:
                r.aviso(f"{onde}: n = {c['n']} < {N_MINIMO}; não publique curvas tão pequenas")

        series = {}
        for k in ("sobrevivencia", "ic_inferior", "ic_superior"):
            if k in c and _lista_numerica(c[k], k, r, onde):
                series[k] = c[k]
            elif k not in c:
                r.erro(f"{onde}: falta '{k}'")
        if n_grade is not None:
            for k, v in series.items():
                if len(v) != n_grade:
                    r.erro(f"{onde}: '{k}' tem {len(v)} pontos, grade tem {n_grade}")
        S = series.get("sobrevivencia")
        if S:
            if abs(S[0] - 1.0) > EPS:
                r.erro(f"{onde}: sobrevivencia[0] = {S[0]}, deve ser 1.0")
            if any(b > a + EPS for a, b in zip(S, S[1:])):
                r.erro(f"{onde}: sobrevivencia deve ser não crescente")
            lo, hi = series.get("ic_inferior"), series.get("ic_superior")
            if lo and hi and len(lo) == len(S) == len(hi):
                if any(not (l - EPS <= s <= h + EPS) for l, s, h in zip(lo, S, hi)):
                    r.erro(f"{onde}: IC não envolve a sobrevivência em algum ponto")

        gw = c.get("greenwood_acumulado")
        if gw is not None:  # opcional desde 1.1.0
            if not isinstance(gw, list) or not all(isinstance(x, (int, float)) and not isinstance(x, bool) and x >= 0 for x in gw):
                r.erro(f"{onde}: 'greenwood_acumulado' deve ser lista de números >= 0")
            else:
                if n_grade is not None and len(gw) != n_grade:
                    r.erro(f"{onde}: 'greenwood_acumulado' tem {len(gw)} pontos, grade tem {n_grade}")
                if gw and abs(gw[0]) > EPS:
                    r.erro(f"{onde}: greenwood_acumulado[0] deve ser 0")
                if any(b < a - EPS for a, b in zip(gw, gw[1:])):
                    r.erro(f"{onde}: greenwood_acumulado deve ser não decrescente")

        if _exige(c, "quantis_meses", dict, r, onde):
            q = c["quantis_meses"]
            vals = []
            for k in ("p50", "p80", "p90"):
                if k not in q:
                    r.erro(f"{onde}: quantis_meses sem '{k}'")
                elif q[k] is not None and (not isinstance(q[k], (int, float)) or isinstance(q[k], bool) or q[k] < 0):
                    r.erro(f"{onde}: quantis_meses.{k} deve ser número >= 0 ou null")
                else:
                    vals.append(q[k])
            nums = [v for v in vals if v is not None]
            if nums != sorted(nums):
                r.erro(f"{onde}: quantis devem ser não decrescentes (p50 <= p80 <= p90)")
            # null só pode aparecer depois de um número (se p50 é null, p80 e p90 também)
            visto_null = False
            for v in vals:
                if v is None:
                    visto_null = True
                elif visto_null:
                    r.erro(f"{onde}: quantil atingido depois de um não atingido")

    if not tem_agregada:
        r.erro("curvas: falta a curva agregada (vara=null, classe=null)")
    return r


def main(argv: list[str]) -> int:
    args = [a for a in argv if not a.startswith("--")]
    estrito = "--estrito" in argv
    if len(args) != 1:
        print(__doc__)
        return 2
    with open(args[0], encoding="utf-8") as f:
        try:
            doc = json.load(f)
        except json.JSONDecodeError as e:
            print(f"ERRO: JSON inválido: {e}")
            return 1
    r = validar(doc)
    for a in r.avisos:
        print(f"AVISO: {a}")
    for e in r.erros:
        print(f"ERRO:  {e}")
    falhou = bool(r.erros) or (estrito and bool(r.avisos))
    resumo = f"{len(doc.get('curvas', []))} curva(s), {len(r.erros)} erro(s), {len(r.avisos)} aviso(s)"
    print(("INVÁLIDO — " if falhou else "VÁLIDO — ") + resumo)
    return 1 if falhou else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
