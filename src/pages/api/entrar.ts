// POST do formulário de login do painel
import type { APIRoute } from 'astro';
import { COOKIE, login } from '../../server/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  const f = await request.formData();
  const r = login(String(f.get('email') ?? ''), String(f.get('senha') ?? ''), clientAddress);
  if ('erro' in r) return redirect(`${BASE}/admin/entrar/?erro=${encodeURIComponent(r.erro)}`, 303);
  cookies.set(COOKIE, r.token, { path: `${BASE}/`, httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 * 60 * 24 * 14 });
  return redirect(`${BASE}/admin/`, 303);
};
