import pytest

from ampulheta.cli import construir_parser


def test_subcomandos_existem():
    p = construir_parser()
    for cmd in ("coletar", "modelar", "publicar"):
        assert p.parse_args([cmd]).comando == cmd
    assert p.parse_args(["preparar", "--snapshot", "2026-10-28"]).snapshot == "2026-10-28"


def test_sem_subcomando_falha():
    with pytest.raises(SystemExit):
        construir_parser().parse_args([])
