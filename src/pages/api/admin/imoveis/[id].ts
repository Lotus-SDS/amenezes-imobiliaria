// Atualiza ou exclui um imóvel
import type { APIRoute } from 'astro';
import { atualizar, excluir } from '../../../../server/imoveis';

const id = (p: string | undefined) => (/^\d+$/.test(p ?? '') ? Number(p) : NaN);

export const PUT: APIRoute = async ({ params, request }) => {
  const dados = await request.json().catch(() => null);
  if (!dados || typeof dados !== 'object') return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
  const ok = await atualizar(id(params.id), dados);
  return ok ? Response.json({ ok: true }) : Response.json({ erro: 'Imóvel não encontrado.' }, { status: 404 });
};

export const DELETE: APIRoute = async ({ params }) => {
  const ok = await excluir(id(params.id));
  return ok ? Response.json({ ok: true }) : Response.json({ erro: 'Imóvel não encontrado.' }, { status: 404 });
};
