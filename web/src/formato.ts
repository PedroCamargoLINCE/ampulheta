// Formatação em português do Brasil.

const inteiroFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const decimalFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function inteiro(n: number): string {
  return inteiroFmt.format(n);
}

/** 0,473 → "47%"; abaixo de 1% vira "<1%" e acima de 99% vira ">99%" para não fingir precisão. */
export function porcentagem(p: number): string {
  if (p > 0 && p < 0.005) return '<1%';
  if (p < 1 && p > 0.995) return '>99%';
  return `${inteiroFmt.format(p * 100)}%`;
}

/** 12 → "12 meses"; 14,23 → "14,2 meses". */
export function meses(m: number): string {
  const texto = Number.isInteger(m) ? inteiroFmt.format(m) : decimalFmt.format(m);
  return `${texto} ${m === 1 ? 'mês' : 'meses'}`;
}

/** "2026-10-28" → "28/10/2026", sem passar por Date (evita deslocamento de fuso). */
export function dataIso(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
