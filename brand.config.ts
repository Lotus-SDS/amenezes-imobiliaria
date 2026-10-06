// ─────────────────────────────────────────────────────────────
// brand.config — tudo o que é "marca" mora aqui.
// Trocar de cliente = editar este arquivo + logo + textos das páginas.
// ─────────────────────────────────────────────────────────────

export const brand = {
  nome: 'A. Menezes Imobiliária',
  razaoSocial: 'A.MENEZES EMPREENDIMENTOS IMOBILIÁRIOS LTDA',
  fundacao: '1957-12-26',
  fundador: 'Amilar de Menezes',
  gestor: 'Sérgio Menezes',
  site: 'https://amenezes.com.br',

  contato: {
    whatsapp: '5528999251334',
    whatsappLabel: '(28) 99925-1334',
    telefone: '552835321334',
    telefoneLabel: '(28) 3532-1334',
    email: 'sergio@amenezes.com.br',
    endereco: {
      rua: 'Av. Simão Soares, 1199 — Ed. Barra Shopping',
      bairro: 'Barra',
      cidade: 'Marataízes',
      uf: 'ES',
      cep: '29349-000',
      geo: { lat: -21.018091, lng: -40.8134054 },
    },
    horario: '[PREENCHER: horário de atendimento]',
    instagram: 'https://www.instagram.com/amenezesimobiliaria/',
    facebook: 'https://www.facebook.com/amenezesimobiliaria',
  },

  // Cores oficiais (extraídas do logo) + derivadas para interface
  cores: {
    amarelo: '#FFDE00',
    azul: '#2E3192',
    noite: '#060B26',
    noite2: '#0C1442',
    tinta: '#12143A', // texto principal sobre claro
    areia: '#F5F0E4', // fundo de leitura
    areia2: '#EAE2CF',
    linha: 'rgba(18,20,58,.12)',
  },

  fontes: {
    display: "'Fraunces Variable', 'Iowan Old Style', Georgia, serif",
    texto: "'Outfit Variable', system-ui, -apple-system, 'Segoe UI', sans-serif",
  },

  // ── Experiência 3D ──────────────────────────────────────────
  experiencia: {
    // Céu por hora do dia: [zênite, horizonte, brilho ao redor do sol]
    // uHora: 0 = noite · .25 = amanhecer · .5 = dia · .75 = pôr do sol · 1 = noite
    ceu: [
      { h: 0.0, zenite: '#02041A', horizonte: '#0E1850', brilho: '#3B3F9E' },
      { h: 0.25, zenite: '#141A63', horizonte: '#F2956A', brilho: '#FFD27A' },
      { h: 0.5, zenite: '#2B4FB8', horizonte: '#A8C6E8', brilho: '#FFF3C4' },
      { h: 0.75, zenite: '#1A144E', horizonte: '#FF7438', brilho: '#FFC03A' },
      { h: 1.0, zenite: '#02041A', horizonte: '#0E1850', brilho: '#3B3F9E' },
    ],
    ouro: '#FFD23A', // base do ouro líquido (o amarelo da marca puxado para metal)
    esmalte: '#2E3192', // o traço crescente do logo
    luzOrla: '#FFD98A',
    // Orçamento por tier (ver ARCHITECTURE.md §6)
    tiers: {
      alto: { particulas: 110_000, dprMax: 1.75, mar: 220, esfera: 160, bloom: true, nuvens: 3, msaa: 4 },
      medio: { particulas: 40_000, dprMax: 1.35, mar: 140, esfera: 112, bloom: true, nuvens: 2, msaa: 0 },
      baixo: { particulas: 14_000, dprMax: 1.0, mar: 80, esfera: 72, bloom: false, nuvens: 1, msaa: 0 },
    },
  },
} as const;

export type Tier = keyof typeof brand.experiencia.tiers;

export const anos = () => {
  const f = new Date(brand.fundacao);
  const h = new Date();
  return h.getFullYear() - f.getFullYear() - (h < new Date(h.getFullYear(), f.getMonth(), f.getDate()) ? 1 : 0);
};

export const waLink = (texto: string) =>
  `https://wa.me/${brand.contato.whatsapp}?text=${encodeURIComponent(texto)}`;
