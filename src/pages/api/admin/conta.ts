// Conta e usuários do painel: trocar a própria senha, adicionar e remover acessos
import type { APIRoute } from 'astro';
import { criarUsuario, removerUsuario, trocarSenha } from '../../../server/auth';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const f = await request.formData();
  const voltar = (msg: string) => redirect(`${BASE}/admin/conta/?msg=${encodeURIComponent(msg)}`, 303);
  const eu = locals.usuario!;
  switch (f.get('acao')) {
    case 'senha': {
      const erro = trocarSenha(eu.id, String(f.get('atual') ?? ''), String(f.get('nova') ?? ''));
      return erro ? voltar(erro) : redirect(`${BASE}/admin/entrar/?ok=${encodeURIComponent('Senha alterada. Entre com a senha nova.')}`, 303);
    }
    case 'adicionar':
      try {
        criarUsuario(String(f.get('email') ?? ''), String(f.get('senha') ?? ''), String(f.get('nome') ?? ''));
        return voltar('Acesso criado.');
      } catch (e: any) {
        return voltar(/UNIQUE/.test(e?.message) ? 'Já existe um acesso com esse e-mail.' : e?.message || 'Não foi possível criar.');
      }
    case 'remover': {
      const id = Number(f.get('id'));
      if (id === eu.id) return voltar('Você não pode remover o seu próprio acesso.');
      removerUsuario(id);
      return voltar('Acesso removido.');
    }
  }
  return voltar('Ação desconhecida.');
};
