// Encerra a sessão do painel
import type { APIRoute } from 'astro';
import { COOKIE, logout } from '../../../server/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const POST: APIRoute = ({ cookies, redirect }) => {
  logout(cookies.get(COOKIE)?.value);
  cookies.delete(COOKIE, { path: `${BASE}/` });
  return redirect(`${BASE}/admin/entrar/`, 303);
};
