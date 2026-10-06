// Marca lead como lido/não lido ou exclui
import type { APIRoute } from 'astro';
import { excluirLead, marcarLido } from '../../../../server/leads';

const id = (p: string | undefined) => (/^\d+$/.test(p ?? '') ? Number(p) : NaN);

export const PATCH: APIRoute = async ({ params, request }) => {
  const { lido } = await request.json().catch(() => ({}));
  marcarLido(id(params.id), !!lido);
  return Response.json({ ok: true });
};

export const DELETE: APIRoute = ({ params }) => {
  excluirLead(id(params.id));
  return Response.json({ ok: true });
};
