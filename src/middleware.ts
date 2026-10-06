// Protege o painel (/admin e /api/admin) e acrescenta cabeçalhos de segurança em todas as respostas.
import { defineMiddleware } from 'astro:middleware';
import { COOKIE, usuarioDaSessao } from './server/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const onRequest = defineMiddleware(async (ctx, next) => {
  const caminho = ctx.url.pathname.slice(BASE.length) || '/';
  const painel = caminho.startsWith('/admin');
  const apiPainel = caminho.startsWith('/api/admin');

  if (painel || apiPainel) {
    const usuario = usuarioDaSessao(ctx.cookies.get(COOKIE)?.value);
    ctx.locals.usuario = usuario;
    const publica = caminho.startsWith('/admin/entrar');
    if (!usuario && !publica) {
      if (apiPainel) return Response.json({ erro: 'Sua sessão expirou. Entre de novo.' }, { status: 401 });
      return ctx.redirect(`${BASE}/admin/entrar/`);
    }
  }

  const res = await next();
  try {
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (painel || apiPainel) {
      res.headers.set('Cache-Control', 'no-store');
      res.headers.set('X-Robots-Tag', 'noindex, nofollow');
      res.headers.set('X-Frame-Options', 'DENY');
    }
  } catch { /* respostas imutáveis (ex.: redirecionamento) seguem como estão */ }
  return res;
});
