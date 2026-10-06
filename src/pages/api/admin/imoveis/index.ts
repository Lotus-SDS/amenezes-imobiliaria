// Cria um imóvel novo (JSON do formulário do painel)
import type { APIRoute } from 'astro';
import { criar } from '../../../../server/imoveis';

export const POST: APIRoute = async ({ request }) => {
  const dados = await request.json().catch(() => null);
  if (!dados || typeof dados !== 'object') return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
  const id = criar(dados);
  return Response.json({ id }, { status: 201 });
};
