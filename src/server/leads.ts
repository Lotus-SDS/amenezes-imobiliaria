// Leads dos formulários do site (contato, visita, captação, newsletter): ficam no banco e aparecem no painel.
import { db } from './db';

export type Lead = { id: number; tipo: string; dados: Record<string, string>; lido: number; criado: string };

const CAMPOS = ['nome', 'telefone', 'celular', 'email', 'interesse', 'mensagem', 'imovel', 'dia', 'periodo', 'proprietario',
  'finalidade', 'tipo', 'condominio', 'financiamento', 'endereco', 'area_total', 'area_util', 'dormitorios', 'suites',
  'vagas_cobertas', 'vagas_descobertas', 'outras', 'pagina'];

export function salvarLead(tipo: string, entrada: Record<string, unknown>) {
  const dados: Record<string, string> = {};
  for (const c of CAMPOS) {
    const v = entrada[c];
    if (v != null && v !== '') dados[c] = (Array.isArray(v) ? v.join(', ') : String(v)).slice(0, 2000);
  }
  if (!Object.keys(dados).length) return false;
  db.prepare('INSERT INTO leads (tipo, dados) VALUES (?, ?)').run(String(tipo).slice(0, 30), JSON.stringify(dados));
  return true;
}

export const listarLeads = () =>
  (db.prepare('SELECT id, tipo, dados, lido, criado FROM leads ORDER BY id DESC LIMIT 500').all() as any[]).map((l) => ({ ...l, dados: JSON.parse(l.dados) })) as Lead[];
export const naoLidos = () => (db.prepare('SELECT COUNT(*) AS n FROM leads WHERE lido = 0').get() as { n: number }).n;
export const marcarLido = (id: number, lido: boolean) => db.prepare('UPDATE leads SET lido = ? WHERE id = ?').run(lido ? 1 : 0, id);
export const excluirLead = (id: number) => db.prepare('DELETE FROM leads WHERE id = ?').run(id);
