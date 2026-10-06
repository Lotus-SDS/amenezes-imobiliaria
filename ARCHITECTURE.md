# ARCHITECTURE — A. Menezes · Horizonte Dourado

> Fase 3 · conceito escolhido: **A — Horizonte Dourado** · intensidade 2.
> Princípio: **o conteúdo chega primeiro, o 3D chega depois e nunca bloqueia nada.**

> **Escopo aprovado (06/10/2026): versão local de apresentação.** Sem deploy por enquanto. Os dados vêm de um retrato do site público (`npm run sync`). Formulários e WhatsApp mostram a recompensa visual. O WhatsApp abre de verdade; os formulários ainda não enviam. A reserva de temporada aponta para a página do imóvel no site atual. Tudo o que está abaixo sobre mu-plugin, `.htaccess` e GitHub Actions continua válido como **plano de produção**, e fica listado em PENDENCIAS.md.

---

## 1. Decisão de stack

### O problema
O WordPress atual faz três coisas que **não podem parar**: o Sérgio cadastra imóveis (JetEngine), recebe reservas de temporada (JetBooking + WooCommerce) e recebe formulários. Já o *front* (Elementor + 15 plugins) é o que deixa o site lento e datado.

### A solução: **WordPress continua sendo o painel; o front vira Astro, no mesmo domínio**

```
                     amenezes.com.br  (Hostinger · LiteSpeed)
 ┌──────────────────────────────────────────────────────────────────┐
 │  .htaccess: existe HTML estático para a URL?                      │
 │        ├── SIM → serve o Astro (home, imóveis, sobre, contato…)   │
 │        └── NÃO → WordPress (wp-admin, wp-json, checkout, reserva) │
 └──────────────────────────────────────────────────────────────────┘
        ▲ deploy (FTP/SSH)                      │ webhook ao salvar imóvel
        │                                        ▼
 ┌──────────────────┐   build    ┌─────────────────────────────────┐
 │  GitHub Actions  │ ◄───────── │ WP mu-plugin "amenezes-headless" │
 │  npm run build   │            │ · expõe campos JetEngine na API  │
 └──────────────────┘            │ · /wp-json/amenezes/v1/lead      │
        ▲ lê a API REST          │ · dispara rebuild                │
        └────────────────────────┴─────────────────────────────────┘
```

**Por que Astro e não um tema WordPress novo:**
| Critério | Tema WP novo | **Astro + WP como painel** |
|---|---|---|
| 3D persistente entre páginas | precisa de router JS de terceiros (swup/barba) | **nativo**: `<ClientRouter />` + `transition:persist` no canvas |
| Lighthouse ≥ 90 mobile | difícil com plugins carregando no front | páginas **HTML estático**, 0 KB de JS obrigatório para o conteúdo |
| Code-splitting do 3D | manual | Vite faz por padrão |
| Segurança | front e painel expostos juntos | front estático; WP só responde ao que não é estático |
| Rotina do Sérgio | igual | **igual** (mesmo painel, mesmas telas) |

**O custo dessa escolha, sem esconder:**
1. Ao salvar um imóvel, o site leva **~3 min** para refletir (rebuild). Enquanto isso, um imóvel **novo** já abre, porque o WordPress o serve pelo template antigo até o rebuild terminar (a convivência no `.htaccess` funciona como rede de segurança).
2. Precisa de um repositório GitHub com Actions (o plano gratuito sobra para o volume previsto).
3. O checkout de reserva continua no WooCommerce, então vou estilizar só essas telas com as cores novas (tema-filho mínimo, sem Elementor).

### Stack final
| Camada | Escolha |
|---|---|
| Front | **Astro 5** (saída estática) + TypeScript |
| 3D | **Three.js** `three/webgpu`: **WebGPURenderer + TSL**, com fallback automático para o backend WebGL2 |
| Coreografia | **GSAP + ScrollTrigger**, **Lenis** |
| Estilo | CSS puro com custom properties geradas do `brand.config.ts` (sem framework CSS) |
| Fontes | **Fraunces** (títulos, variável) + **Outfit** (texto/números, já usada hoje), self-hosted, woff2 com subset latino |
| Debug | lil-gui + monitor de frame próprio (só carregam com `?debug`) |
| Painel | WordPress existente + **1 mu-plugin** (arquivo único PHP) |
| Deploy | GitHub Actions → FTP/SSH Hostinger · rebuild por webhook + 1×/dia por segurança |

---

## 2. Mapa do site

### Páginas servidas pelo Astro
| URL | Página | Observação |
|---|---|---|
| `/` | Home: experiência completa | os 4 atos + todas as seções |
| `/imoveis/` | Busca com filtros | **novo**, substitui `/todos-os-imoveis-2/`. Filtro no cliente sobre um JSON enxuto dos ~300 cards (≈ 40 KB gzip) |
| `/tipo-de-negocio/venda/` · `/alugar/` · `/aluguel_temporada/` | Listagens por finalidade | URL mantida; mesma página de busca com filtro fixo + texto SEO próprio. Cada uma tem a sua "hora do dia" |
| `/tipo-de-imovel/{casa,apartamento,lote,loja,duplex,ponto-comercial,area-comercial,galpao,area,garagem}/` | Listagens por tipo | URL mantida |
| `/cadastro-de-imoveis/{slug}/` | **301 páginas de imóvel** | **URL idêntica**. Galeria, ficha, descrição, tabela de financiamento, mapa, vídeo, WhatsApp com código, "Agendar visita", reserva (temporada) |
| `/financiamento-proprio/` | **novo** | lotes em até 120x: explicação, simulação real do cliente, lotes disponíveis |
| `/sobre-nos/` | A Empresa | linha do tempo 1957 → hoje, texto reescrito |
| `/contato/` | Contato | endereço, mapa, horário [PREENCHER], formulário |
| `/cadastre-seu-imovel/` | Captação | mesmo formulário completo, em etapas |
| `/politica-de-privacidade/` | Política LGPD | atualizada |
| `/404` | Página não encontrada | com busca por código |

### Continuam no WordPress (mesma URL)
`/wp-admin/` · `/wp-json/` · `/finalizar-compra/` · `/carrinho/` · `/minha-conta/` · `/lista-de-reservas/` · **`/reservar/?imovel={id}`** (página nova com o formulário JetBooking original, estilizada)

### Redirecionamentos 301 (`.htaccess`)
| De | Para |
|---|---|
| `/todos-os-imoveis-2/` | `/imoveis/` |
| `/loja/` | `/tipo-de-negocio/aluguel_temporada/` |
| `/empresa/*` (CPT "A Empresa") | `/sobre-nos/` |
| `/?s=*` | `/imoveis/?q=*` |
| `/tipo-de-imovel/{chacara,kitnet,sitio}/` (vazias) | `/imoveis/` *(só se não houver imóvel no rebuild)* |

**Sitemap** gerado pelo Astro com **todas** as páginas, incluindo os 301 imóveis (hoje fora do sitemap). O sitemap do Rank Math é desligado para não haver dois.

---

## 3. Dados

### Modelo de um imóvel (`src/data/imoveis.json`, gerado no build)
```ts
{
  id, slug, url, codigo, titulo,
  finalidade: 'venda' | 'anual' | 'temporada',
  tipo, bairro, cidade, endereco,
  quartos, banheiros, garagem, area, pessoas,
  preco, aluguel, iptu,                     // número ou null → "Consulte"
  descricaoHtml, financiamento?: Tabela[],  // tabela extraída da descrição
  caracteristicas: string[],
  fotos: { src, srcset, w, h, alt }[],      // usa os tamanhos que o WP já gera (sem pipeline de imagem próprio)
  mapa?, video?, modificado
}
```

### Origem
- **Com acesso ao painel (alvo):** o mu-plugin registra os campos do JetEngine na API (`register_rest_field`) e o `scripts/sync-wp.mjs` lê tudo em ~4 requisições.
- **Antes do acesso (provisório, para eu não ficar parado):** o mesmo script lê a API pública (título, taxonomias, fotos) e completa preço, ficha e descrição a partir do HTML público de cada imóvel, gerando **o mesmo JSON**. Quando o mu-plugin entrar, apago o leitor de HTML. *ponytail: raspagem frágil a mudanças de template — é ponte, não solução.*
- **Taxonomias limpas no build:** mapa de apelidos (`Morobá → Marobá`, "TERRENO"/"ÁREA DE TERRENO" fora da lista de bairros). A limpeza definitiva é feita no painel, listada em PENDENCIAS.

### Formulários → `POST /wp-json/amenezes/v1/lead`
Um endpoint só para: contato, agendar visita, cadastre seu imóvel e newsletter.
- Grava o lead como post privado no WP (**nada se perde se o e-mail falhar**) e envia e-mail para sergio@amenezes.com.br.
- Proteção: honeypot + armadilha de tempo + limite por IP. Consentimento LGPD obrigatório.
- Sem JS: o `<form>` faz POST normal e o endpoint redireciona para `/obrigado/`.

### WhatsApp
Link montado por página: `wa.me/5528999251334?text=Olá! Tenho interesse no imóvel {codigo} – {titulo}: {url}`. Na home e nas institucionais, mensagem por intenção (comprar / alugar / temporada / anunciar).

### Reserva de temporada
- **Etapa garantida:** botão "Ver datas e reservar" → `/reservar/?imovel={id}` (formulário JetBooking original, já funcionando, com o visual novo).
- **Etapa desejável:** no próprio imóvel, ilha que consulta `/jet-booking/v2/booked-dates` e mostra as datas ocupadas antes do clique. Só entra depois de validar com acesso ao painel.

---

## 4. Grafo de cena 3D

```
Scene
├── CameraRig ............ dolly + órbita com mola (InteractionManager alimenta tilt/parallax)
├── Atmosphere
│   ├── SkyDome .......... gradiente TSL guiado por uHora (0 noite → .25 amanhecer → .5 meio-dia → .75 pôr do sol → 1 noite)
│   ├── SeaMist .......... névoa de altura com ruído 3D (fog node)
│   └── PMREM do próprio céu → ambiente do ouro (sem HDRI baixado)
├── Ocean
│   ├── malha 256² (alto) / 128² / 64² com ondas Gerstner no vertex (TSL)
│   ├── normal de detalhe por ruído animado
│   ├── reflexo: reflector() em ½ res (alto), ¼ (médio), céu falso (baixo)
│   └── rastro de brilho do sol (especular anisotrópico na direção do sol)
├── Shoreline ............ silhueta procedural da costa ao fundo (ridge noise), pontos de ancoragem por bairro
├── Symbol (o Sol)
│   ├── SunCore .......... disco-lente (esfera achatada) com deformação viva no vertex (ouro líquido)
│   │                      MeshPhysicalNodeMaterial: metalness 1, iridescência (filme fino), clearcoat, fresnel/rim
│   │                      gravação "1957" via atlas MSDF → perturbação de normal
│   ├── Crescent ......... o traço do logo, arco em esmalte azul #2E3192 sobre o disco
│   └── DissolveMask ..... ruído que materializa o disco a partir das partículas
└── Particles (Simulation)
    ├── 120k / 40k / 12k pontos, compute shader TSL
    ├── estados-alvo (buffers): ORLA (luzes por bairro, proporcional à contagem real)
    │                           · ESPIRAL · SOL (amostragem por área da superfície do disco)
    │                           · CASA · APARTAMENTO · LOTE · GALPÃO (silhuetas extrudadas, amostradas em worker)
    │                           · 120 FATIAS (financiamento) · ORLA
    ├── blend entre estados + curl noise + mola por partícula (chegada orgânica, não linear)
    └── cursor = atrator suave + fonte de luz
```

### Coreografia (ScrollDirector)
| Seção (HTML) | uHora | Partículas | Sol | Câmera |
|---|---|---|---|---|
| Loader → Ato 1 Origem | 0.00 noite | ORLA | invisível | baixa, rente à água |
| Ato 2 Convergência | 0.05 | ESPIRAL | — | sobe |
| Ato 3 Materialização | 0.12 | SOL → dissolve | aparece, "1957" brilha | aproxima |
| Ato 4 Revelação (título + 3 portas) | 0.25 amanhecer | somem no disco | sobe no horizonte | assenta |
| Comprar / Alugar / Temporada | .25 / .50 / .75 | CASA, APTO, LOTE, GALPÃO conforme o card ativo | vira silhueta | travelling lateral |
| Financiamento próprio | .60 | 120 FATIAS | divide | frontal |
| Sobre (linha do tempo) | arco .25 → .75 | — | percorre o céu | arco de 40° |
| Provas / números | .80 | reflexos na água | baixo | olha a água |
| Contato | .95 → noite | voltam para ORLA | se põe | volta ao início |
| **Clique WhatsApp / envio** | — | **acende uma luz nova na orla** (burst + bloom) | — | micro-zoom |

Tudo é **scrub**: rolar para cima desfaz exatamente o caminho. Os atos 1–3 tocam sozinhos (≈ 3,5 s) se o visitante não rolar, e o título fica legível desde o primeiro quadro.

**Páginas internas:** preset "mar calmo", com sol baixo, sem partículas de narrativa e câmera estática com parallax. A troca de página não recria o canvas: o preset faz tween para o novo estado.

---

## 5. Pipeline de renderização

```
compute (partículas) → cena (céu, mar + reflector, costa, sol, partículas)
  → bloom físico multinível → god rays (½ res, a partir do sol) → DOF leve (só alto)
  → aberração cromática sutil → tone mapping AgX + LUT da marca (azul nas sombras, ouro nos altos)
  → grão + vinheta → SMAA
```
**Deixados de fora de propósito:** GTAO, SSR e motion blur. A cena é um horizonte aberto, sem objetos próximos para oclusão, o reflexo da água já vem do reflector e o motion blur borraria o texto sobreposto. Gastaria GPU sem ganho visível. Entram só se a crítica de arte da etapa 7 pedir.

**Ordem de corte por custo** (QualityManager, quando o frame estoura): DOF → god rays → resolução do reflector → níveis de bloom → contagem de partículas → resolução de render (DPR).

---

## 6. Orçamento de performance

### Conteúdo (vale para todos)
| Métrica | Meta |
|---|---|
| LCP | ≤ 2,5 s em 4G (o LCP é o **título em HTML** ou o pôster AVIF, nunca o canvas) |
| JS para o conteúdo funcionar | **0 KB** (filtros e menu: ≈ 15 KB gzip, carregados com prioridade baixa) |
| CSS crítico | inline ≤ 14 KB |
| Fontes | 2 arquivos woff2 com preload, `font-display: swap` |
| Long tasks após a abertura | nenhuma > 50 ms (amostragem de silhuetas em Web Worker; shaders pré-compilados com `compileAsync`) |
| Lighthouse mobile | ≥ 90 performance, ≥ 95 acessibilidade, 100 SEO |

### Experiência 3D (chunk separado, só baixa após `load` + `requestIdleCallback`)
| | **Alto** | **Médio** | **Baixo** | **Estático** |
|---|---|---|---|---|
| Quem | desktop c/ GPU dedicada, Apple M, celular topo | notebook integrado, celular médio | celular de entrada | sem WebGL2/WebGPU, `prefers-reduced-motion`, Save-Data, ou benchmark reprovado |
| Meta | 60 fps (16,6 ms) | 60 fps | 30 fps (33 ms) | — |
| DPR máx | 1,75 | 1,25 | 1,0 | — |
| Partículas | 120k | 40k | 12k | — |
| Mar | 256², reflector ½ | 128², reflector ¼ | 64², céu falso | — |
| Pós | completo | bloom 3 níveis, sem DOF e god rays | bloom 2 níveis + tone map | — |
| Visual | completo | completo, menos brilho fino | essencial | pôster AVIF renderizado da própria cena + sol em CSS |
| Download 3D | ≈ 350 KB gzip (three/webgpu + código + atlas MSDF) | igual | igual | 0 |

**Detecção:** WebGPU disponível? → `adapter.info` + renderer WebGL. Depois, **benchmark de ~250 ms durante o loader** (renderiza a cena real em 64×64 e mede) e define o tier. Em tempo real: média móvel do frame time; acima da meta por 2 s → desce um degrau (DPR −10%, depois corta um passe); abaixo por 5 s → sobe. Se nada resolver, faz crossfade para o pôster.

**Economia:** render pausado com a aba oculta ou com o canvas fora da tela (IntersectionObserver); nas internas, render só enquanto houver movimento. `dispose()` rigoroso ao trocar de preset.

---

## 7. Estratégia de fallback

| Situação | Experiência |
|---|---|
| Sem JavaScript | site 100% navegável: busca por links de categoria, formulários com POST normal, WhatsApp funciona |
| JS sem WebGL2/WebGPU | pôster AVIF da cena + brilho do sol em CSS; todas as animações de texto e interface mantidas |
| `prefers-reduced-motion` | pôster estático bonito, sem scroll suave nem parallax; transições viram fade simples |
| WebGPU falha ao iniciar | WebGPURenderer cai para o backend WebGL2 sozinho |
| Contexto da GPU perdido | crossfade para o pôster, sem erro na tela |
| Frame estourando sem solução | crossfade para o pôster |

---

## 8. Estrutura de código

```
/
├── brand.config.ts            # cores, fontes, paletas por hora do dia, parâmetros visuais, contatos
├── astro.config.mjs
├── public/                    # .htaccess, robots.txt, fontes, pôsteres, favicon
├── scripts/
│   └── sync-wp.mjs            # WP → src/data/*.json
├── wordpress/
│   ├── mu-plugins/amenezes-headless.php
│   └── theme-reserva/         # tema-filho mínimo: só checkout/reserva/minha-conta
├── src/
│   ├── data/                  # imoveis.json, taxonomias.json (gerados)
│   ├── layouts/Base.astro     # <head>, SEO, schema, ClientRouter, canvas persistente, consentimento
│   ├── components/            # Header, Search, Card, Gallery, LeadForm, WhatsApp, CookieBanner…
│   ├── pages/                 # rotas do mapa acima
│   └── experience/            # o 3D, carregado sob demanda
│       ├── index.ts           # ponto de entrada (import dinâmico)
│       ├── Engine.ts          # renderer, loop, resize, visibilidade, dispose
│       ├── QualityManager.ts  # detecção, benchmark, tiers, escalonamento dinâmico
│       ├── Pipeline.ts        # ordem dos passes, ligação com PostFX
│       ├── PostFX.ts          # bloom, god rays, DOF, CA, AgX+LUT, grão, SMAA
│       ├── Symbol.ts          # o Sol: geometria, material de ouro, gravação, crescente
│       ├── Particles.ts       # buffers, estados-alvo, renderização dos pontos
│       ├── Simulation.ts      # compute shaders (blend, curl noise, molas, cursor)
│       ├── Atmosphere.ts      # céu, névoa, mar, costa
│       ├── ScrollDirector.ts  # Lenis + ScrollTrigger + timelines por página, presets por rota
│       ├── InteractionManager.ts # mouse, toque, giroscópio, arraste com inércia, botões magnéticos, cursor
│       ├── AudioEngine.ts     # mar generativo (ruído filtrado em ondas), DESLIGADO por padrão
│       ├── materials/         # nós TSL: gold, ocean, sky
│       ├── shapes/            # silhuetas SVG (casa, apto, lote, galpão) + worker de amostragem
│       └── debug.ts           # lil-gui, monitor, scrubber dos atos (só com ?debug)
└── .github/workflows/deploy.yml
```

Comentários em português. Trocar de marca = editar `brand.config.ts` + logo + textos.

---

## 9. SEO, acessibilidade e LGPD (resumo do que a arquitetura garante)
- Todo texto em HTML semântico; o canvas é `aria-hidden` e decorativo.
- Schema.org: `RealEstateAgent` (LocalBusiness) com endereço, telefone, `foundingDate: 1957-12-26` e redes; `BreadcrumbList`; por imóvel, `Offer` + tipo (`Apartment`, `House`, `SingleFamilyResidence`…), e `LodgingBusiness`/`Accommodation` na temporada.
- Open Graph único e correto por página, com imagem 1200×630 gerada (foto do imóvel + selo).
- WCAG AA: contraste validado nos tokens (amarelo nunca vira cor de texto sobre fundo claro), foco visível, navegação por teclado no menu, galeria e filtros, `alt` gerado (tipo + bairro + nº da foto) quando o painel não tiver.
- **LGPD:** banner com "Aceitar / Recusar / Preferências", **GTM e Pixel da Meta só depois do aceite** (Consent Mode v2), checkbox de consentimento nos formulários, política atualizada.

---

## 10. Plano de etapas

| # | Etapa | Entrega | Critério para avançar |
|---|---|---|---|
| 4 | **Símbolo estático** | projeto Astro rodando, `brand.config`, Engine + QualityManager, o Sol com material final sobre o mar e o céu, `?debug` | prints em 3 horas do dia; o ouro precisa parecer **ouro líquido**, não plástico amarelo. Console limpo. **Sua aprovação.** |
| 5 | **Hero: os 4 atos** | loader-orla em CSS → partículas, convergência, materialização, revelação, título animado, 3 portas | atos 1–4 fluidos e reversíveis; H1 legível desde o 1º quadro |
| 6 | **Simulações e atmosfera** | compute completo, silhuetas, 120 fatias, névoa, god rays | 60 fps no alto, 30+ no baixo (medido) |
| 7 | **Pós e interações** | cadeia de pós, cursor-luz, tilt, botões magnéticos, giroscópio, áudio opcional | crítica de arte: nada brilha "de graça" |
| 8 | **Todas as páginas com conteúdo real** | sync do WP, 301 imóveis, listagens, institucionais, formulários, WhatsApp, reserva, textos reescritos (antes/depois) | nenhum conteúdo do inventário do BRIEFING faltando |
| 9 | **SEO, acessibilidade, LGPD** | sitemap, schema, OG, banner de consentimento, `.htaccess` com 301, mu-plugin | validadores de schema e axe sem erros |
| 10 | **Otimização e auditoria** | testes em celular real (Android de entrada + iPhone), Lighthouse, README, PENDENCIAS, APRESENTACAO | metas da seção 6 batidas e documentadas |

Antes de ir ao ar, testo localmente a convivência Astro + WordPress (`.htaccess`) num container Docker com Apache/PHP.

---

## 11. Dependências e riscos
| Item | Impacto | Plano |
|---|---|---|
| Acesso admin ao WordPress | campos do JetEngine na API, mu-plugin, página `/reservar/` | até lá, ponte por leitura do HTML público (seção 3) |
| Credenciais FTP/SSH da Hostinger | deploy automático | **você** cadastra nos *secrets* do GitHub; eu nunca vejo as credenciais |
| Fluxo de reserva JetBooking/Woo | é a única venda online do site | etapa garantida = formulário original estilizado; integração nativa só após validação |
| Logo em vetor | nitidez do selo e da gravação "1957" | redesenho fiel em SVG a partir do PNG, para aprovação do cliente |
| Rebuild de ~3 min | imóvel editado demora a aparecer | imóvel novo já abre pelo WP; avisar o Sérgio no README |
