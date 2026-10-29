"""Linha de comando: ampulheta coletar | preparar | modelar | publicar."""
from __future__ import annotations

import argparse
import sys

from . import __version__


def construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="ampulheta", description="Tempo até a sentença com análise de sobrevivência.")
    p.add_argument("--version", action="version", version=f"ampulheta {__version__}")
    p.add_argument("--config", default="config.yaml", help="caminho do config.yaml")
    sub = p.add_subparsers(dest="comando", required=True)

    c = sub.add_parser("coletar", help="estágio 1: baixa processos da API do DataJud para raw/<snapshot>/")
    c.add_argument("--snapshot", help="data AAAA-MM-DD; padrão é hoje")

    pr = sub.add_parser("preparar", help="estágio 2: raw/<snapshot>/ -> data/*.parquet + relatório")
    pr.add_argument("--snapshot", required=True, help="pasta de raw/ a usar")

    sub.add_parser("modelar", help="estágio 3: Parquet -> models/ e métricas")
    sub.add_parser("publicar", help="models/ -> data/publicado/curvas.json (contrato)")
    return p


def main(argv: list[str] | None = None) -> int:
    args = construir_parser().parse_args(argv)
    from .config import carregar

    cfg = carregar(args.config)
    if args.comando == "coletar":
        from .coletor import coletar
        print(coletar(cfg, args.snapshot))
    elif args.comando == "preparar":
        from .preparo import preparar
        preparar(cfg, args.snapshot)
    elif args.comando == "modelar":
        from .modelo import modelar
        modelar(cfg)
    elif args.comando == "publicar":
        from .publicar import publicar
        publicar(cfg)
    return 0


if __name__ == "__main__":
    sys.exit(main())
