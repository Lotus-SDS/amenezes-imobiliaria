# A. Menezes Imobiliária: Horizonte Dourado

Site novo da A. Menezes (Marataízes – ES) **com painel de administração próprio**.
**Astro (servidor Node) + Three.js (WebGPU/TSL)**. As páginas são montadas a cada visita a partir do banco do painel: uma alteração aparece no site na hora. A experiência 3D é uma camada extra, carregada depois e só em aparelhos que aguentam.

> Arquitetura: [ARCHITECTURE.md](ARCHITECTURE.md). Briefing, conceitos, pendências e apresentação comercial são documentos internos e não ficam no repositório.

## Painel de administração

Em **`/amenezes-imobiliaria/admin/`** (na prévia) ou `/admin/` (no domínio do cliente).

| Tela | O que faz |
|---|---|
| **Imóveis** | Lista os imóveis (publicados, rascunhos e arquivados) com busca e filtros |
| **Novo / editar imóvel** | Título, código, tipo, finalidade, endereço, bairro, mapa, ficha, preços, financiamento próprio, descrição, características, fotos e vídeo. Situação: *publicado*, *rascunho* ou *arquivado* (vendido ou alugado: sai do site sem apagar). Destaque na home |
| **Fotos** | Arrastar e soltar, reordenar, escolher a capa (1ª foto) e remover. O navegador reduz cada foto antes de enviar (versões de 1600 e 800 px em WebP) |
| **Contatos** | Tudo o que chega pelos formulários do site (contato, agendar visita, cadastro de imóvel, newsletter), com botão para responder no WhatsApp |
| **Conta** | Trocar a senha e dar ou remover acesso a outras pessoas |

**Segurança:**
- **Senhas:** guardadas com scrypt; nunca ficam em texto.
- **Sessão:** cookie `HttpOnly`, `Secure` e `SameSite=Strict`, válido por 14 dias.
- **Tentativas de login:** 8 erros seguidos bloqueiam o IP por 15 minutos.
- **Origem dos envios:** formulários vindos de outro site são recusados (`security.checkOrigin`).
- **Fotos:** só são aceitas WebP e JPEG, conferidas pela assinatura do arquivo, com até 6 MB.
- **Formulários do site:** honeypot contra robôs e limite de 20 envios por hora por IP.

**Primeiro acesso / esqueci a senha:** no servidor, `docker compose -f deploy/compose.yml exec app node scripts/criar-admin.mjs`. O script pede o e-mail e a senha no terminal; se o e-mail já existir, ele troca a senha.

### Dados
- **Banco:** SQLite nativo do Node (`node:sqlite`) em `DATA_DIR`, que em produção é o volume Docker `dados`. As fotos enviadas ficam em `DATA_DIR/fotos`.
- **Importação inicial:** na primeira vez que o app sobe, o banco importa os 301 imóveis do retrato do WordPress (`src/data/imoveis.json`). Dali em diante, o painel é a fonte oficial.
- **Fotos antigas:** as fotos importadas continuam apontando para o WordPress antigo. Antes de desligar o WordPress, é preciso migrá-las (ver PENDÊNCIAS).
- **Backup do volume:**
  ```bash
  docker run --rm -v amenezes_dados:/data -v "$PWD":/b alpine tar czf /b/amenezes-$(date +%F).tgz -C /data .
  ```

## Servidor (stack própria na VPS da Lotus)

O app roda no mesmo servidor e no mesmo Traefik da Lotus, mas numa **stack própria**: aplicação com banco não vira submodule do Lotus_site, conforme o `docs/ci-cd.md` dele.

```bash
# primeira vez
git clone https://github.com/Lotus-SDS/amenezes-imobiliaria.git /opt/amenezes
cd /opt/amenezes && git switch main
docker compose -f deploy/compose.yml up -d --build
docker compose -f deploy/compose.yml exec app node scripts/criar-admin.mjs

# atualizar
cd /opt/amenezes && git pull && docker compose -f deploy/compose.yml up -d --build
```

O `deploy/compose.yml` entra na rede `web_network` e responde em `lotusdev.com.br/amenezes-imobiliaria/` com certificado `myresolver`. A prioridade alta faz essa rota vencer a do site estático antigo enquanto ela existir.

---

## Rodar localmente

Requisitos: **Node 22.13+** (testado no 24).

```bash
npm install
npm run dev          # http://localhost:4321  (desenvolvimento, recarrega ao salvar)
npm run admin        # cria um acesso ao painel no banco local (./data)
```

Versão de produção:

```bash
npm run build
npm start            # http://localhost:4321  (banco em ./data)
```

Para testar com o caminho da prévia, use `BASE_PATH=/amenezes-imobiliaria/ npm run build`.

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

## Publicar no domínio do cliente (futuro)

O mesmo container serve o domínio do cliente: build sem `BASE_PATH` (raiz) e uma regra de Traefik (ou outro proxy) para `amenezes.com.br`. O WordPress antigo pode ser desligado depois de migrar as fotos antigas e refazer a reserva online de temporada. Essas duas pendências estão listadas para o cliente.

> As medições de performance acima foram feitas na versão estática. A versão com servidor entrega o mesmo HTML, montado em cerca de 5 ms por página; vale medir de novo depois do deploy.

### Decisões técnicas em relação ao pedido original
- **ScrollTrigger:** foi trocado por IntersectionObserver nativo, mais a matemática própria de rolagem do `ScrollDirector`. É uma biblioteca a menos e acaba com os recálculos de layout. GSAP continua nas animações e o Lenis na rolagem suave.
- **Passes de pós deixados de fora (GTAO, SSR, DOF, motion blur):** a cena é um horizonte aberto, sem objetos próximos. Esses passes gastariam GPU sem diferença visível e prejudicariam celulares.
- **Assets:** nada de modelos 3D ou HDRI para baixar. Tudo é procedural (geometria, céu, ambiente), por isso não há Draco nem KTX2.
