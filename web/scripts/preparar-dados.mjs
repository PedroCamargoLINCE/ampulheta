// Escolhe o curvas.json que o site vai servir, valida com o validador do contrato
// e copia para public/ (o Vite leva public/ para dist/ no build).
//
// Ordem: ../data/publicado/curvas.json (dado real) e, se não existir, a fixture
// sintética de ../contracts/. Falha se o validador reprovar.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const raiz = resolve(web, '..');
const real = resolve(raiz, 'data/publicado/curvas.json');
const fixture = resolve(raiz, 'contracts/fixtures/curvas.exemplo.json');
const validador = resolve(raiz, 'contracts/validar.py');
const destino = resolve(web, 'public/curvas.json');

const origem = existsSync(real) ? real : fixture;
console.log(`dados: usando ${origem === real ? 'data/publicado/curvas.json' : 'fixture sintética de contracts/'}`);

try {
  execFileSync('python3', [validador, origem], { stdio: 'inherit' });
} catch {
  console.error('dados: o validador do contrato reprovou o arquivo; nada foi copiado.');
  process.exit(1);
}

mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origem, destino);
console.log('dados: copiado para public/curvas.json');
