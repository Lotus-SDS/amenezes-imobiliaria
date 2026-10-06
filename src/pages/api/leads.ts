// Formulários do site → leads no painel. Aceita JSON (com JS) e formulário comum (sem JS → redireciona para /obrigado/).
import type { APIRoute } from 'astro';
import { salvarLead } from '../../server/leads';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
// ponytail: limite por IP em memória (20 envios/hora); basta para um processo só
const envios = new Map<string, number[]>();

export const POST: APIRoute = async ({ request, redirect, clientAddress }) => {
  const json = (request.headers.get('content-type') ?? '').includes('application/json');
  let dados: Record<string, unknown> = {};
  if (json) dados = await request.json().catch(() => ({}));
  else {
    const fd = await request.formData();
    for (const k of new Set(fd.keys())) dados[k] = fd.getAll(k).map(String); // salvarLead junta listas com vírgula
  }
  if (Array.isArray(dados.formulario)) dados.formulario = dados.formulario[0];
  // o campo "tipo" do formulário é o tipo do imóvel (captação); o formulário vem em "formulario"
  if (Array.isArray(dados.tipo)) dados.tipo = dados.tipo.join(', ');
  if (Array.isArray(dados.website)) dados.website = dados.website[0];
  const responder = (ok: boolean, status = 200) => (json ? Response.json({ ok }, { status }) : redirect(`${BASE}/obrigado/`, 303));

  if (dados.website) return responder(true); // honeypot: robô recebe "ok" e nada é gravado
  const agora = Date.now();
  const lista = (envios.get(clientAddress) ?? []).filter((t) => agora - t < 3600_000);
  if (lista.length >= 20) return json ? Response.json({ ok: false, erro: 'Muitos envios. Tente mais tarde.' }, { status: 429 }) : redirect(`${BASE}/contato/`, 303);
  envios.set(clientAddress, [...lista, agora]);

  const tipo = ['contato', 'visita', 'captacao', 'newsletter'].includes(String(dados.formulario)) ? String(dados.formulario) : 'contato';
  const ok = salvarLead(tipo, dados);
  return ok ? responder(true, 201) : responder(false, 400);
};
