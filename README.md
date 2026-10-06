# A. Menezes Imobiliária: Horizonte Dourado

Site novo da A. Menezes (Marataízes – ES), construído em **Astro + Three.js (WebGPU/TSL)**.
O conteúdo é HTML estático, rápido e indexável. A experiência 3D é uma camada extra, carregada depois e só em aparelhos que aguentam.

> Arquitetura: [ARCHITECTURE.md](ARCHITECTURE.md). Briefing, conceitos, pendências e apresentação comercial são documentos internos e não ficam no repositório.

## Prévia na Lotus

Publicado como site filho do Lotus_site em **https://lotusdev.com.br/amenezes-imobiliaria/**.
- O build recebe `BASE_PATH=/amenezes-imobiliaria/`. O `astro.config.mjs` usa esse valor como `base`, e todos os links internos passam por `u()` (`src/lib/url.ts`).
- Cada push na `main` deste repositório publica a versão nova (workflow `.github/workflows/lotus.yml`; precisa do secret `LOTUS_BOT_TOKEN`).
- Sem `BASE_PATH`, o mesmo código gera o site para a raiz do domínio do cliente.

---

## Rodar localmente

Requisitos: **Node 20+** (testado no 24).

```bash
npm install
npm run dev          # http://localhost:4321  (desenvolvimento, recarrega ao salvar)
```

Versão final, idêntica à de produção (use esta para gravar o vídeo):

```bash
npm run build        # gera dist/ (≈ 323 páginas em ~2 s)
npm run preview      # http://localhost:4321
```

### Atualizar os imóveis

Os 301 imóveis vêm de um retrato do site atual, salvo em `src/data/imoveis.json`. Para atualizar:

```bash
npm run sync         # lê amenezes.com.br (API pública + páginas) e regrava src/data/
npm run build
```

---

## Gravar o vídeo para o cliente

1. Rode `npm run build && npm run preview` e abra no **Chrome** (WebGPU ativo) em tela cheia (F11).
2. A abertura (os 4 atos) toca **uma vez por sessão**. Para repetir, abra uma aba anônima ou rode `sessionStorage.clear()` no console e recarregue.
3. Role devagar com a roda do mouse ou com o trackpad. A rolagem suave (Lenis) deixa o movimento cinematográfico.
4. Um roteiro que funciona bem:
   - Abertura: noite na orla → as luzes viram o sol → amanhecer.
   - Rolar pela home: **Comprar** (casa de luz) → **Alugar** (prédio) → **Temporada** (pôr do sol) → destaques → **Lotes** → **120x** → linha do tempo 1957 → números → contato à noite.
   - Clicar em **WhatsApp**: acende uma luz nova na orla (a recompensa). Feche a aba do WhatsApp que abrir.
   - Clicar em "Temporada" → abrir um imóvel → galeria em tela cheia → voltar. O 3D continua entre as páginas.
5. Atalhos úteis na URL:
   - `?tier=alto` força a qualidade máxima (use na gravação).
   - `?debug` abre um painel com FPS, tier e um **scrubber dos atos** para enquadrar momentos.
   - `?tier=estatico` mostra a versão sem 3D (como fica em celular fraco ou com "reduzir movimento" ligado).
   - `?poster` mostra só a cena, sem interface (foi assim que gerei `public/img/og-padrao.jpg`).
6. Para gravar o celular, use o modo de dispositivo do Chrome (F12 → ícone de celular, 390×844) ou grave num aparelho real conectado à mesma rede (`npm run preview -- --host`).

---

## Editar textos, cores e contatos

| O quê | Onde |
|---|---|
| Cores, fontes, telefone, WhatsApp, e-mail, endereço, horário, redes | **`brand.config.ts`** (um arquivo só) |
| Paleta do céu por hora do dia, cor do ouro, densidade das partículas por aparelho | `brand.config.ts` → `experiencia` |
| Textos da home | `src/pages/index.astro` |
| Sobre, Contato, Cadastre seu imóvel, Financiamento, Política | `src/pages/*.astro` |
| Cards e página de imóvel | `src/components/Card.astro`, `src/pages/cadastro-de-imoveis/[slug].astro` |
| O que acontece com o 3D em cada seção | `src/experience/cenas.ts` (um "estado de cena" por seção `data-cena`) |

Trocar de marca = editar `brand.config.ts` + logo em `public/img/` + textos das páginas.

---

## Estrutura

```
brand.config.ts          marca e parâmetros visuais
scripts/sync-wp.mjs      WordPress → src/data/*.json
src/
  layouts/Base.astro     SEO, schema.org, canvas persistente, cabeçalho, rodapé, WhatsApp, LGPD
  pages/                 todas as rotas (URLs do site atual preservadas)
  components/            Card, Listagem (filtros), Faixa, LeadForm, Icone
  scripts/ui.ts          interface: rolagem suave, revelações, cursor, botões magnéticos, LGPD, formulários
  experience/            o 3D (chunk separado, carregado sob demanda)
    Engine.ts            renderer WebGPU (fallback WebGL2), laço, resize, pausa, recompensa
    QualityManager.ts    detecção de aparelho + escalonamento dinâmico de qualidade
    PostFX.ts            bloom + gradação da marca (tone mapping neutro)
    Symbol.ts            o Sol: ouro líquido, iridescência, "1957" gravado, crescente do logo
    Particles.ts         luzes da orla e seus reflexos na água
    Simulation.ts        compute shader das partículas (mola + ruído + cursor)
    Atmosphere.ts        céu, mar (ondas Gerstner + reflexo analítico do sol), silhueta da orla
    ScrollDirector.ts    rolagem → estado de cena (reversível)
    InteractionManager.ts mouse, toque, giroscópio, arraste com inércia
    AudioEngine.ts       som de mar generativo (desligado por padrão)
    cenas.ts             estados de cena por seção + os 4 atos da abertura
    debug.ts             painel ?debug
```

---

## Performance medida (Lighthouse mobile, build local, 06/10/2026)

| Página | Perf. | Acessib. | Boas práticas | SEO | LCP | TBT |
|---|---|---|---|---|---|---|
| Home | 93 | 100 | 100 | 100 | 2,6 s | 70 ms |
| Imóveis à venda | 93 | 100 | 100 | 100 | 2,6 s | 50 ms |
| Página de imóvel | 95 | 100 | 100 | 100 | 2,7 s | 80 ms |
| Sobre | 94 | 100 | 100 | 100 | 2,4 s | 110 ms |
| Contato | 94 | 99 | 100 | 100 | 2,4 s | 90 ms |
| Todos os imóveis | 88 | 100 | 100 | 100 | 3,3 s | 90 ms |

**Site atual, para comparar:** Performance 78 · Acessibilidade 92 · Boas práticas 71 · LCP 4,6 s.

- Os tempos são da simulação de 4G lento do Lighthouse. O LCP real observado no build local é de cerca de 0,2 s.
- Em "Todos os imóveis", o LCP é a foto do primeiro card, que hoje vem do servidor do WordPress atual. Em produção, no mesmo domínio e com cache LiteSpeed, ele cai.

### Como o 3D fica leve em qualquer aparelho
- **Detecção antes do download:** o pacote 3D (cerca de 255 KB gzip) só é baixado se o aparelho aguenta. Celulares fracos, quem tem "reduzir movimento" ligado e quem usa economia de dados recebem o **pôster renderizado da própria cena** e nunca pagam esse custo.
- **3 tiers** (alto, médio, baixo), com partículas de 110 mil a 14 mil, resolução e malhas adaptadas a cada um.
- **Escalonamento em tempo real:** se o quadro passa do orçamento, a resolução cai; se ainda não bastar, o bloom é desligado, depois metade das partículas; em último caso, o pôster entra.
- **Sem passes caros:** o reflexo do sol no mar é calculado direto no shader (raio × esfera), sem renderizar a cena duas vezes. Vinheta e grão são CSS.
- **Shaders pré-compilados** antes do primeiro quadro, montagem da cena em fatias (sem tarefa longa) e render pausado quando a aba fica oculta ou a faixa 3D sai da tela.

---

## Publicar em produção

O plano completo está em [ARCHITECTURE.md](ARCHITECTURE.md) §1. Em resumo:
1. O WordPress continua como painel (o Sérgio cadastra imóveis igual a hoje).
2. Um mu-plugin expõe os campos do JetEngine na API e recebe os formulários (`/wp-json/amenezes/v1/lead`). No front, basta preencher `ENDPOINT_LEAD` em `src/scripts/ui.ts`.
3. O `dist/` vai para o `public_html` da Hostinger. Um `.htaccess` serve o HTML estático quando ele existe e manda o resto para o WordPress (painel, checkout, reservas).
4. GitHub Actions refaz o build quando um imóvel é salvo (cerca de 3 min).

Itens que dependem do cliente estão em [PENDENCIAS.md](PENDENCIAS.md).

### Decisões técnicas em relação ao pedido original
- **ScrollTrigger:** foi trocado por IntersectionObserver nativo, mais a matemática própria de rolagem do `ScrollDirector`. É uma biblioteca a menos e acaba com os recálculos de layout. GSAP continua nas animações e o Lenis na rolagem suave.
- **Passes de pós deixados de fora (GTAO, SSR, DOF, motion blur):** a cena é um horizonte aberto, sem objetos próximos. Esses passes gastariam GPU sem diferença visível e prejudicariam celulares.
- **Assets:** nada de modelos 3D ou HDRI para baixar. Tudo é procedural (geometria, céu, ambiente), por isso não há Draco nem KTX2.
