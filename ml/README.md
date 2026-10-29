# ampulheta (pacote Python)

Pipeline em três estágios desacoplados. Método completo em `../docs/PLANO.md`.

```bash
ampulheta coletar  --config config.yaml
ampulheta preparar --snapshot 2026-10-28
ampulheta modelar
ampulheta publicar
```

Saída final: `../data/publicado/curvas.json`, validada por `../contracts/validar.py`.
