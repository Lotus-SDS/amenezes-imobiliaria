// Recebe uma foto já reduzida pelo navegador (corpo binário WebP/JPEG) e grava no volume de dados.
import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FOTOS_DIR } from '../../../server/db';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const TIPOS: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg' };
const LIMITE = 6 * 1024 * 1024;

export const POST: APIRoute = async ({ request }) => {
  const ext = TIPOS[request.headers.get('content-type') ?? ''];
  if (!ext) return Response.json({ erro: 'Envie a foto em WebP ou JPEG.' }, { status: 415 });
  const buf = Buffer.from(await request.arrayBuffer());
  if (!buf.length || buf.length > LIMITE) return Response.json({ erro: 'Foto vazia ou maior que 6 MB.' }, { status: 413 });
  // confere a assinatura do arquivo (não confia só no cabeçalho)
  const webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
  if ((ext === 'webp' && !webp) || (ext === 'jpg' && !jpeg)) return Response.json({ erro: 'Arquivo não é uma imagem válida.' }, { status: 415 });
  const nome = `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}.${ext}`;
  await writeFile(join(FOTOS_DIR, nome), buf);
  return Response.json({ url: `${BASE}/fotos/${nome}` }, { status: 201 });
};
