// Login do painel: senha com scrypt (stdlib), sessão em cookie HttpOnly com token aleatório guardado no banco.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { db } from './db';

export const COOKIE = 'am_sessao';
const DURACAO = 1000 * 60 * 60 * 24 * 14; // 14 dias

export function hashSenha(senha: string) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${scryptSync(senha, sal, 64).toString('hex')}`;
}

function confere(senha: string, hash: string) {
  const [, sal, dk] = hash.split('$');
  if (!sal || !dk) return false;
  const calc = scryptSync(senha, Buffer.from(sal, 'hex'), 64);
  return timingSafeEqual(calc, Buffer.from(dk, 'hex'));
}

export type Usuario = { id: number; email: string; nome: string };

// Limite de tentativas por IP: 8 erros → 15 min de espera.
// ponytail: em memória; basta para um processo só. Se houver mais de uma réplica, mover para o banco.
const tentativas = new Map<string, { n: number; ate: number }>();

export function login(email: string, senha: string, ip: string): { token: string } | { erro: string } {
  const t = tentativas.get(ip);
  if (t && t.n >= 8 && t.ate > Date.now()) return { erro: 'Muitas tentativas. Aguarde 15 minutos.' };
  const u = db.prepare('SELECT id, hash FROM usuarios WHERE email = ?').get(email.trim().toLowerCase()) as { id: number; hash: string } | undefined;
  if (!u || !confere(senha, u.hash)) {
    tentativas.set(ip, { n: (t && t.ate > Date.now() ? t.n : 0) + 1, ate: Date.now() + 15 * 60 * 1000 });
    return { erro: 'E-mail ou senha incorretos.' };
  }
  tentativas.delete(ip);
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessoes (token, usuario_id, expira) VALUES (?, ?, ?)').run(token, u.id, Date.now() + DURACAO);
  db.prepare('DELETE FROM sessoes WHERE expira < ?').run(Date.now());
  return { token };
}

export function usuarioDaSessao(token: string | undefined): Usuario | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const r = db.prepare('SELECT u.id, u.email, u.nome FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ?').get(token, Date.now());
  return (r as Usuario) ?? null;
}

export const logout = (token: string | undefined) => token && db.prepare('DELETE FROM sessoes WHERE token = ?').run(token);

export function criarUsuario(email: string, senha: string, nome = '') {
  if (senha.length < 10) throw new Error('A senha precisa ter pelo menos 10 caracteres.');
  db.prepare('INSERT INTO usuarios (email, nome, hash) VALUES (?, ?, ?)').run(email.trim().toLowerCase(), nome, hashSenha(senha));
}

export function trocarSenha(id: number, atual: string, nova: string) {
  const u = db.prepare('SELECT hash FROM usuarios WHERE id = ?').get(id) as { hash: string } | undefined;
  if (!u || !confere(atual, u.hash)) return 'Senha atual incorreta.';
  if (nova.length < 10) return 'A nova senha precisa ter pelo menos 10 caracteres.';
  db.prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(hashSenha(nova), id);
  db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(id); // derruba todas as sessões (inclusive esta: entra de novo com a senha nova)
  return null;
}

export const listarUsuarios = () => db.prepare('SELECT id, email, nome, criado FROM usuarios ORDER BY id').all() as (Usuario & { criado: string })[];
export const removerUsuario = (id: number) => db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
