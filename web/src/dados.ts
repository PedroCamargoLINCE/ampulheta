// Tipos do contrato (contracts/README.md, versão 1.x) e acesso às curvas.

export interface Vara {
  codigo: string;
  nome: string;
  municipio: string;
}

export interface Classe {
  codigo: string;
  nome: string;
}

export interface Curva {
  vara: string | null;
  classe: string | null;
  metodo: 'kaplan-meier';
  n: number;
  eventos: number;
  censurados: number;
  sobrevivencia: number[];
  ic_inferior: number[];
  ic_superior: number[];
  quantis_meses: { p50: number | null; p80: number | null; p90: number | null };
}

export interface Contrato {
  contrato: string;
  gerado_em: string;
  snapshot: string;
  sintetico: boolean;
  fonte: { nome: string; url: string; citacao: string };
  tribunal: string;
  grau: 'G1' | 'G2';
  evento: string;
  grade_meses: number[];
  varas: Vara[];
  classes: Classe[];
  curvas: Curva[];
}

/** Versão major do contrato que este site entende. */
const MAJOR_SUPORTADO = 1;

export async function carregar(url = './curvas.json'): Promise<Contrato> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`não foi possível carregar ${url} (HTTP ${resposta.status})`);
  const doc = (await resposta.json()) as Contrato;
  const major = Number(String(doc.contrato).split('.')[0]);
  if (major !== MAJOR_SUPORTADO) {
    throw new Error(`contrato ${doc.contrato} não é suportado (esperado ${MAJOR_SUPORTADO}.x)`);
  }
  return doc;
}

export function buscarCurva(doc: Contrato, vara: string | null, classe: string | null): Curva | undefined {
  return doc.curvas.find((c) => c.vara === vara && c.classe === classe);
}

export function nomeVara(doc: Contrato, codigo: string | null): string {
  if (codigo === null) return 'Todas as varas';
  return doc.varas.find((v) => v.codigo === codigo)?.nome ?? `Vara ${codigo}`;
}

export function nomeClasse(doc: Contrato, codigo: string | null): string {
  if (codigo === null) return 'Todas as classes';
  return doc.classes.find((c) => c.codigo === codigo)?.nome ?? `Classe ${codigo}`;
}

export function rotuloCurva(doc: Contrato, c: Pick<Curva, 'vara' | 'classe'>): string {
  const classe = c.classe === null ? 'todas as classes' : nomeClasse(doc, c.classe);
  return `${nomeVara(doc, c.vara)}, ${classe}`;
}
