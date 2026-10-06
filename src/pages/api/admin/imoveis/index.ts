// Cria um imóvel novo (JSON do formulário do painel). Com "copiarDe", parte dos dados de outro imóvel (duplicar).
import type { APIRoute } from 'astro';
import { criar, porId } from '../../../../server/imoveis';

export const POST: APIRoute = async ({ request }) => {
  const dados = await request.json().catch(() => null);
  if (!dados || typeof dados !== 'object') return Response.json({ erro: 'Dados inválidos.' }, { status: 400 });
  const base = dados.copiarDe ? porId(Number(dados.copiarDe)) : null;
  const id = criar(base ? { ...base, ...dados } : dados);
  return Response.json({ id }, { status: 201 });
};
