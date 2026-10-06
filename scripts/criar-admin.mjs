// Cria um acesso ao painel direto no banco (primeiro acesso, ou recuperar quem perdeu a senha).
//   no servidor:  docker compose exec app node scripts/criar-admin.mjs
//   local:        node scripts/criar-admin.mjs
// Pede e-mail e senha no terminal (a senha não aparece nem fica gravada em arquivo).
// Se o e-mail já existir, troca a senha dele.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const arquivo = join(resolve(process.env.DATA_DIR ?? './data'), 'amenezes.db');
if (!existsSync(arquivo)) {
  console.error(`Banco não encontrado em ${arquivo}. Abra o site uma vez para ele ser criado.`);
  process.exit(1);
}

function perguntar(texto, oculto = false) {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) rl._writeToOutput = (s) => rl.output.write(s.includes(texto) ? s : '');
    rl.question(texto, (r) => { rl.close(); if (oculto) process.stdout.write('\n'); ok(r.trim()); });
  });
}

const email = (process.env.ADMIN_EMAIL || (await perguntar('E-mail: '))).toLowerCase();
const nome = process.env.ADMIN_NOME ?? (await perguntar('Nome (opcional): '));
const senha = process.env.ADMIN_SENHA || (await perguntar('Senha (mínimo 10 caracteres): ', true));
if (!/^\S+@\S+\.\S+$/.test(email)) { console.error('E-mail inválido.'); process.exit(1); }
if (senha.length < 10) { console.error('A senha precisa ter pelo menos 10 caracteres.'); process.exit(1); }

// mesmo formato de src/server/auth.ts (hashSenha)
const sal = randomBytes(16);
const hash = `scrypt$${sal.toString('hex')}$${scryptSync(senha, sal, 64).toString('hex')}`;

const db = new DatabaseSync(arquivo);
const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
if (existe) {
  db.prepare('UPDATE usuarios SET hash = ? WHERE id = ?').run(hash, existe.id);
  db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(existe.id);
  console.log(`Senha de ${email} trocada.`);
} else {
  db.prepare('INSERT INTO usuarios (email, nome, hash) VALUES (?, ?, ?)').run(email, nome, hash);
  console.log(`Acesso criado para ${email}.`);
}
