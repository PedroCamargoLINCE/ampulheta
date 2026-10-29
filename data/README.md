# data/

Escrito pelo pipeline (`ml/`), lido pelo site (`web/`).

- `processos.parquet`, `eventos.parquet` — saída do estágio 2; versionados (são a reprodutibilidade).
  Se passarem de ~50 MB, mover para Git LFS e registrar em `docs/DECISOES.md`.
- `relatorio_qualidade.md` — gerado pelo estágio 2.
- `publicado/curvas.json` — saída do `publicar.py`, no formato de `contracts/`. É o único arquivo que o site lê.
