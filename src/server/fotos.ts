// Entrega as fotos enviadas pelo painel (nomes aleatórios e imutáveis → cache de 1 ano).
// As rotas ficam em src/pages/fotos/[nome].webp.ts e [nome].jpg.ts: com a extensão no nome da rota,
// o Astro não exige barra no fim da URL.
import type { APIRoute } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FOTOS_DIR } from './db';

export const servirFoto = (ext: 'webp' | 'jpg'): APIRoute => async ({ params }) => {
  const nome = `${params.nome ?? ''}.${ext}`;
  if (!/^[a-z0-9]+-[a-f0-9]{12}\.(webp|jpg)$/.test(nome)) return new Response(null, { status: 404 });
  try {
    const buf = await readFile(join(FOTOS_DIR, nome));
    return new Response(buf, {
      headers: { 'Content-Type': ext === 'webp' ? 'image/webp' : 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
};
