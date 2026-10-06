// Banco do painel: SQLite nativo do Node (node:sqlite), num arquivo dentro de DATA_DIR.
// Em produção, DATA_DIR é um volume Docker: banco e fotos sobrevivem a cada deploy.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import inicial from '../data/imoveis.json';

export const DATA_DIR = resolve(process.env.DATA_DIR ?? './data');
export const FOTOS_DIR = join(DATA_DIR, 'fotos');
mkdirSync(FOTOS_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'amenezes.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS imoveis (
    id INTEGER PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'publicado',   -- publicado | rascunho | arquivado
    dados TEXT NOT NULL,                        -- o imóvel inteiro em JSON (mesmo formato do site)
    criado TEXT NOT NULL DEFAULT (datetime('now')),
    atualizado TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL DEFAULT '',
    hash TEXT NOT NULL,
    criado TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessoes (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY,
    tipo TEXT NOT NULL,
    dados TEXT NOT NULL,
    lido INTEGER NOT NULL DEFAULT 0,
    criado TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Importação única: na primeira vez, o banco recebe o retrato do WordPress (src/data/imoveis.json).
// Depois disso o painel é a fonte oficial e o WordPress não alimenta mais o site.
const vazio = (db.prepare('SELECT COUNT(*) AS n FROM imoveis').get() as { n: number }).n === 0;
if (vazio) {
  const ins = db.prepare('INSERT INTO imoveis (slug, status, dados, atualizado) VALUES (?, ?, ?, ?)');
  db.exec('BEGIN');
  for (const i of inicial as any[]) {
    // a capa do WordPress entra como 1ª foto da galeria: a partir daqui, capa = 1ª foto
    const fotos = [...(i.fotos || [])];
    if (i.capa && !fotos.some((f: any) => f.src === i.capa.src || f.full === i.capa.src)) {
      const maior = (i.capa.srcset || '').split(',').map((s: string) => s.trim().split(' ')[0]).filter(Boolean).pop() || i.capa.src;
      fotos.unshift({ src: i.capa.src, full: maior, alt: i.capa.alt || '' });
    }
    const { id: wpId, ...resto } = i;
    ins.run(i.slug, 'publicado', JSON.stringify({ ...resto, wpId, fotos }), (i.modificado || '').replace('T', ' '));
  }
  db.exec('COMMIT');
  console.log(`[painel] ${(inicial as any[]).length} imóveis importados do retrato do WordPress.`);
}
