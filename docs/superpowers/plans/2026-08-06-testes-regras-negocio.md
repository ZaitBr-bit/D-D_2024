# Testes de Regras de Negócio do Livro — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Suíte de testes que confronta o app com o livro (piloto: os 75 talentos), com catálogo curado como fonte da verdade, motor de unidade em node:test, camada fina de Playwright e lista viva de lacunas conhecidas.

**Architecture:** Catálogo de expectativas curado à mão a partir de `Informacoes Separadas/Talentos.md` (`testes/regras/catalogo/talentos.mjs`); motores genéricos de teste que o percorrem — unidade importando os módulos do app direto no Node (`testes/regras/unidade/`), e2e dirigindo a UI real (`testes/e2e/regras/`); lacunas do app viram entradas anotadas em `testes/regras/lacunas-conhecidas.mjs` (suíte verde, pendências visíveis).

**Tech Stack:** Node 22 (`node:test`, ESM), Playwright já instalado em `testes/e2e/node_modules` (`@playwright/test` ^1.49). Zero dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-06-testes-regras-negocio-design.md`

## Global Constraints

- **Nenhum arquivo de `site/` é alterado.** Lacunas do app são anotadas, nunca corrigidas aqui.
- Em `testes/e2e/` mudam apenas: `package.json` (scripts), `playwright.config.mjs` (uma linha de `testIgnore`) e o subdiretório novo `regras/`.
- Zero dependência npm nova; `node_modules/` continua existindo só em `testes/e2e/`.
- Comentários de código SEMPRE em Português do Brasil; toda função criada tem comentário explicando o que faz.
- Nunca fazer commit — o usuário commita quando quiser.
- Comandos rodam com cwd `testes/e2e/` (é onde o npm/npx resolvem); os de unidade usam caminho relativo `../regras/`.
- Os testes citam o livro: categoria dos talentos usa as chaves EXATAS de `dados/talentos/talentos.json`: `'de Origem'` (10), `'Geral'` (43), `'de Estilo de Luta'` (10), `'de Dádiva Épica'` (12).
- Mecânica de lacuna: teste que falha por lacuna documentada passa; teste que PASSA estando na lista falha com "remova da lista". Motivo em branco é erro.

## Fatos do código levantados no design (o implementador não precisa redescobrir)

- `REGRAS_TALENTOS` em [site/js/regras-cobertura.js](../../site/js/regras-cobertura.js) tem hoje **20 entradas** (Especialista em Perícia, Resiliente, Iniciado em Magia, Tocado Por Fadas, Tocado Pelas Sombras, Conjurador Ritualista, Envenenador, Telecinético e as 12 Dádivas). **Habilidoso, Artifista, Músico e Aumento no Valor de Atributo não estão lá** — a validação deles é codificada à mão em `levelup-validations.js:114`, o que o spec define como NÃO-cobertura. Esses vão para a lista de lacunas no teste `escolhas`.
- `validarEscolhasTalento(char, nome, escolhas)` (`regras-cobertura.js`) devolve `{ valido, erro? }` e retorna `{ valido: true }` para qualquer talento sem entrada no mapa.
- Formatos de `escolhas` aceitos por `validarEscolhasTalento` (lidos do código): `{ atributo }`, `{ pericia_proficiencia, pericia_expertise }` (Especialista em Perícia), `{ pericia_expertise }` (Dádiva da Proficiência em Perícia), `{ energias: [2 distintas] }`, `{ magia }` (Tocados), `{ rituais: [bonusProficiencia(nivel) itens] }` (Conjurador Ritualista), `{ iniciado_em_magia: { lista, atributo, truques: [2], magia } }`.
- `resolverPassivosTalentos(char)` (`site/js/talentos-effects.js`) devolve `{ bonusIniciativa, bonusDeslocamento, bonusCA, bonusCAArmaduraMediaMaxDes, bonusAtaqueDistancia, bonusDanoUmaMao, bonusDanoArremesso, bonusDanoDesarmado, proficienciasExtra, resistenciasExtra, cdTalentos, visaoVerdadeira, flags, estilosAtivos }`.
- **Globais de navegador no import (verificado por execução):** `site/js/utils.js:609` faz `window.fecharModal = fecharModal` no top-level, e `regras-cobertura.js`, `talentos-effects.js` e `store.js` todos o importam. Importar em Node exige stubs de `localStorage`, `window` e `document` — só `localStorage` NÃO basta (o rascunho deste plano dizia que bastava; estava errado). Com os três stubs, os três módulos importam e funcionam. Se surgir outra global, acrescentar ao stub do harness.
- UI de level-up: modo talento via radio `input[name="levelup-asi-modo"]` valor `talento`, seleção em `#levelup-talento-select`, escolhas em selects `.escolha-talento-levelup`, ASI embutido em `#levelup-talento-asi` (`site/js/levelup-cards.js:156-200`, `site/js/levelup-ui.js:520-640`). Feature flag: `localStorage['feature.levelup.flow.v2'] = '1'`.
- Criador: passo 1 é classe (`[data-classe="Guerreiro"]` + `popup-confirmar-classe`); antecedente tem `popup-confirmar-antecedente` e selects `.escolha-talento-antecedente` (`site/js/creator/passo-antecedente.js`). Antecedentes que dão Habilidoso: Charlatão, Escriba, Nobre.
- Helpers reutilizáveis de `testes/e2e/helpers.mjs`: `assentar`, `satisfazerPasso`, `passoAtual`, `confirmarModal`, `lerToastErro`, `resolverModalAberto`, `semearPersonagem`.
- Títulos de talento em `Talentos.md` são headings `### <Nome>` (10 sob `## Talentos de Origem`, 43 sob `## Talentos Gerais`, 10 sob `## Talentos de Estilo de Luta`, 12 sob `## Talentos de Dádiva Épica`).

---

### Task 1: Catálogo — esqueleto e os 10 talentos de Origem

**Risk:** low — arquivo de dados puro, validado por parse e contagem.

**Files:**
- Create: `testes/regras/catalogo/talentos.mjs`

- [ ] **Step 1: Criar o arquivo com o schema documentado e as 10 entradas de Origem**

**Interfaces:**
- Produces: `export const TIPOS_ESCOLHA` (array de strings) e `export const CATALOGO_TALENTOS` (objeto nome → entrada). Toda entrada tem: `livro` (string `'Talentos.md §<título exato do heading>'`), `categoria` (chave exata de dados), `prerequisito` (`null` ou objeto), `repetivel` (boolean), `escolhas` (array, pode ser vazio), `aumento_atributo` (`null` ou array de chaves minúsculas de atributo), `passivos` (`null` ou objeto), `flags` (array de strings, pode faltar), `exemplo_valido` (obrigatório quando `escolhas.length > 0` E o talento tem entrada em REGRAS_TALENTOS hoje ou deveria ter — na prática: sempre que `escolhas.length > 0`).

Conteúdo (curadoria de Origem já resolvida no design — copiar e conferir contra `Informacoes Separadas/Talentos.md` linhas 113–232):

```js
// ============================================================
// Catálogo de regras de talentos, curado à mão a partir do livro
// (Informacoes Separadas/Talentos.md). É a FONTE DA VERDADE dos
// testes de regras: os motores em ../unidade/ e ../../e2e/regras/
// confrontam o app com o que está declarado aqui.
//
// Só entra campo verificável por máquina. Prosa não-mecanizável
// (ex.: "pode trocar Iniciativa com um aliado") fica de fora — o
// texto descritivo já é coberto pela extração em dados/.
// ============================================================

// Tipos de escolha que uma entrada pode declarar. O teste de
// completude rejeita tipo fora desta lista.
export const TIPOS_ESCOLHA = [
  'pericia', 'ferramenta', 'pericia_ou_ferramenta', 'instrumento',
  'ferramenta_artesao', 'atributo_talento', 'atributo_salvaguarda',
  'atributo_conjuracao', 'lista_magias', 'truque', 'magia_1_circulo',
  'magia', 'energia', 'pericia_expertise', 'ritual', 'arma', 'manobra'
];

export const CATALOGO_TALENTOS = {
  // ---------- Talentos de Origem (Talentos.md §Talentos de Origem) ----------
  'Alerta': {
    livro: 'Talentos.md §Alerta',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusIniciativa: 'proficiencia' },
    flags: ['alerta_troca_iniciativa'],
  },
  'Artifista': {
    livro: 'Talentos.md §Artifista',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [{ tipo: 'ferramenta_artesao', qtd: 3 }],
    aumento_atributo: null,
    passivos: null,
    flags: ['artifista_desconto', 'artifista_fabricacao_rapida'],
    exemplo_valido: { selecoes: ['Ferramentas de Alquimista', 'Ferramentas de Carpinteiro', 'Ferramentas de Cartógrafo'] },
  },
  'Atacante Selvagem': {
    livro: 'Talentos.md §Atacante Selvagem',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['atacante_selvagem'],
  },
  'Curandeiro': {
    livro: 'Talentos.md §Curandeiro',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['curandeiro_medico_combate', 'curandeiro_cura_garantida'],
  },
  'Habilidoso': {
    livro: 'Talentos.md §Habilidoso',
    categoria: 'de Origem',
    prerequisito: null,
    // "Repetível. Você pode adquirir este talento mais de uma vez."
    repetivel: true,
    // "proficiência em qualquer combinação de três perícias ou ferramentas"
    escolhas: [{ tipo: 'pericia_ou_ferramenta', qtd: 3 }],
    aumento_atributo: null,
    passivos: null,
    exemplo_valido: { selecoes: ['Atletismo', 'História', 'Ferramentas de Ferreiro'] },
  },
  'Iniciado em Magia': {
    livro: 'Talentos.md §Iniciado em Magia',
    categoria: 'de Origem',
    prerequisito: null,
    // Repetível, "mas deve escolher uma lista de magias diferente a cada vez"
    repetivel: true,
    escolhas: [
      { tipo: 'lista_magias', qtd: 1, opcoes: ['Clérigo', 'Druida', 'Mago'] },
      { tipo: 'atributo_conjuracao', qtd: 1, opcoes: ['inteligencia', 'sabedoria', 'carisma'] },
      { tipo: 'truque', qtd: 2 },
      { tipo: 'magia_1_circulo', qtd: 1 },
    ],
    aumento_atributo: null,
    passivos: null,
    exemplo_valido: {
      iniciado_em_magia: { lista: 'Mago', atributo: 'inteligencia', truques: ['Luz', 'Mãos Mágicas'], magia: 'Armadura Arcana' },
    },
  },
  'Músico': {
    livro: 'Talentos.md §Músico',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [{ tipo: 'instrumento', qtd: 3 }],
    aumento_atributo: null,
    passivos: null,
    flags: ['musico_cancao_encorajadora'],
    exemplo_valido: { selecoes: ['Alaúde', 'Flauta', 'Tambor'] },
  },
  'Sortudo': {
    livro: 'Talentos.md §Sortudo',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: null,
    flags: ['sortudo'],
  },
  'Valentão de Taverna': {
    livro: 'Talentos.md §Valentão de Taverna',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusDanoDesarmado: '1d4' },
    flags: ['valentao_empurrar', 'valentao_armamento_improvisado', 'valentao_dano_garantido'],
  },
  'Vigoroso': {
    livro: 'Talentos.md §Vigoroso',
    categoria: 'de Origem',
    prerequisito: null,
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    // PV máximo é dinâmico (2 × nível) — fora do motor de passivos
    // de talentos-effects.js; verificado pela regra transversal de PV
    // quando o domínio "ficha" for implementado.
    passivos: null,
  },
};
```

Antes de dar por pronto, confira cada entrada contra a seção correspondente do livro (`Informacoes Separadas/Talentos.md` linhas 113–232) — os nomes de instrumento do `exemplo_valido` de Músico devem existir em `_INSTRUMENTOS` de `site/js/levelup-ui.js`, e as ferramentas do Artifista em `_FERRAMENTAS_ARTESAO` (grep no arquivo).

- [ ] **Step 2: Validar parse e contagem**

Run: `cd testes/e2e && node -e "import('../regras/catalogo/talentos.mjs').then(m => { const n = Object.keys(m.CATALOGO_TALENTOS).length; console.log(n + ' entradas'); if (n !== 10) process.exit(1); })"`
Expected: `10 entradas`, exit 0.

---

### Task 2: Catálogo — Talentos Gerais, parte 1 (Adepto Elemental → Líder Inspirador, 23 entradas)

**Risk:** low — dados puros; erro de curadoria é pego pelos testes das Tasks 5–7.

**Files:**
- Modify: `testes/regras/catalogo/talentos.mjs`

- [ ] **Step 1: Curar as 23 entradas**

Fonte: `Informacoes Separadas/Talentos.md` linhas 232–511 (headings `### Adepto Elemental` até `### Líder Inspirador`). São, na ordem do livro: Adepto Elemental, Agressor, Analítico, Atirador Arcano, Atleta, Ator, Aumento no Valor de Atributo, Chef, Combatente Montado, Conjurador Bélico, Conjurador Ritualista, Duelista Defensivo, Envenenador, Esmagador, Especialista Ambidestro, Especialista em Armaduras Leves, Especialista em Armaduras Médias, Especialista em Armaduras Pesadas, Especialista em Besta, Especialista em Perícia, Exterminador de Conjuradores, Imobilizador, Líder Inspirador.

Regras de curadoria por campo (aplicar lendo a seção do livro de cada talento):
- `prerequisito`: a linha em itálico sob o título (ex.: *Talento Geral (Pré-requisito: Nível 4+, ...)*) vira objeto: `{ nivel: 4 }`, mais `atributos: { forca: 13 }` quando exige valor mínimo, `conjurador: true` quando exige aptidão de conjuração, `armadura: 'Leve'|'Média'|'Pesada'` quando exige treinamento com armadura, `outro: '<texto>'` para o que não se encaixar.
- `aumento_atributo`: o benefício "**Aumento no Valor de Atributo.**" lista os atributos elegíveis — array com as chaves minúsculas (`['forca', 'destreza', ...]`; `null` se o talento não dá +1).
- `escolhas`: só o que o jogador escolhe AO ADQUIRIR o talento (não escolhas de uso em jogo). Ex.: Adepto Elemental escolhe um tipo de dano → `[{ tipo: 'energia', qtd: 1 }]`; Especialista em Perícia → `[{ tipo: 'pericia', qtd: 1 }, { tipo: 'pericia_expertise', qtd: 1 }]`.
- `repetivel`: `true` sse a seção tem o parágrafo "**Repetível.**".
- `passivos`/`flags`: SÓ quando `resolverPassivosTalentos` (site/js/talentos-effects.js) já expõe o efeito — grep pelo nome do talento no arquivo; se o app não implementa o passivo, deixe `passivos: null` (a ausência é assunto do teste de passivos + lacunas, não do catálogo).
- `exemplo_valido`: obrigatório quando há `escolhas`. Formato deve ser um dos aceitos por `validarEscolhasTalento` (ver "Fatos do código" no topo). Para talento com `aumento_atributo`, inclua `atributo: '<chave elegível>'`.

Três entradas resolvidas por completo, para servir de gabarito (copiar):

```js
  'Aumento no Valor de Atributo': {
    livro: 'Talentos.md §Aumento no Valor de Atributo',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: true,
    // "aumente um atributo em 2, ou dois atributos em 1" — 2 pontos
    escolhas: [{ tipo: 'atributo_talento', qtd: 2 }],
    aumento_atributo: null, // o talento É o aumento; campo é para o +1 embutido dos demais
    passivos: null,
    exemplo_valido: { atributo: 'forca' },
  },
  'Conjurador Ritualista': {
    livro: 'Talentos.md §Conjurador Ritualista',
    categoria: 'Geral',
    prerequisito: { nivel: 4, atributos_alternativos: { inteligencia: 13, sabedoria: 13, carisma: 13 } },
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'ritual', qtd: 'proficiencia' }, // qtd = bônus de proficiência
    ],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    // charBase dos testes tem nível 4 → bônus +2 → 2 rituais
    exemplo_valido: { atributo: 'sabedoria', rituais: ['Alarme', 'Identificar'] },
  },
  'Especialista em Perícia': {
    livro: 'Talentos.md §Especialista em Perícia',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    // Corrigido durante a execução: a seção do livro NÃO tem parágrafo
    // "**Repetível.**" (o rascunho do plano dizia true, por engano).
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_talento', qtd: 1 },
      { tipo: 'pericia', qtd: 1 },
      { tipo: 'pericia_expertise', qtd: 1 },
    ],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    // Expertise na mesma perícia recém-adquirida é aceita pelo app.
    // A perícia NÃO pode ser uma das que charBase() já semeia
    // (Atletismo, História) — o validador rejeita adquirir proficiência
    // em perícia que o personagem já tem. Corrigido durante a execução:
    // o rascunho usava Atletismo e era rejeitado.
    exemplo_valido: { atributo: 'inteligencia', pericia_proficiencia: 'Furtividade', pericia_expertise: 'Furtividade' },
  },
```

(Se `atributos_alternativos` — "Inteligência, Sabedoria ou Carisma 13+" — aparecer, use exatamente essa chave; o schema da Task 5 a aceita.)

- [ ] **Step 2: Validar parse e contagem acumulada**

Run: `cd testes/e2e && node -e "import('../regras/catalogo/talentos.mjs').then(m => { const n = Object.keys(m.CATALOGO_TALENTOS).length; console.log(n); if (n !== 33) process.exit(1); })"`
Expected: `33` (10 + 23), exit 0.

---

### Task 3: Catálogo — Talentos Gerais, parte 2 (Mente Aguçada → Velocista, 20 entradas)

**Risk:** low

**Files:**
- Modify: `testes/regras/catalogo/talentos.mjs`

- [ ] **Step 1: Curar as 20 entradas restantes de Gerais**

Fonte: `Informacoes Separadas/Talentos.md` linhas 512–743: Mente Aguçada, Mestre das Armas, Mestre em Armaduras Médias, Mestre em Armaduras Pesadas, Mestre em Armas de Haste, Mestre em Armas Grandes, Mestre em Escudos, Mestre-Atirador, Perfurador, Resiliente, Resistente, Sentinela, Sorrateiro, Talhador, Telecinético, Telepático, Tocado Pelas Sombras, Tocado Por Fadas, Treinamento com Armas Marciais, Velocista. Mesmas regras de curadoria da Task 2.

Gabaritos (copiar):

```js
  'Resiliente': {
    livro: 'Talentos.md §Resiliente',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [{ tipo: 'atributo_salvaguarda', qtd: 1 }],
    aumento_atributo: ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    exemplo_valido: { atributo: 'sabedoria' },
  },
  'Tocado Por Fadas': {
    livro: 'Talentos.md §Tocado Por Fadas',
    categoria: 'Geral',
    prerequisito: { nivel: 4 },
    repetivel: false,
    escolhas: [
      { tipo: 'atributo_conjuracao', qtd: 1, opcoes: ['inteligencia', 'sabedoria', 'carisma'] },
      { tipo: 'magia_1_circulo', qtd: 1 },
    ],
    aumento_atributo: ['inteligencia', 'sabedoria', 'carisma'],
    passivos: null,
    exemplo_valido: { atributo: 'carisma', magia: 'Sono' },
  },
```

- [ ] **Step 2: Validar contagem**

Run: `cd testes/e2e && node -e "import('../regras/catalogo/talentos.mjs').then(m => { const n = Object.keys(m.CATALOGO_TALENTOS).length; console.log(n); if (n !== 53) process.exit(1); })"`
Expected: `53`, exit 0.

---

### Task 4: Catálogo — Estilo de Luta (10) e Dádivas Épicas (12)

**Risk:** low

**Files:**
- Modify: `testes/regras/catalogo/talentos.mjs`

- [ ] **Step 1: Curar as 22 entradas finais**

Fontes: `Talentos.md` linhas 744–809 (Arquearia, Combate com Armas de Arremesso, Combate com Armas Grandes, Combate com Duas Armas, Combate Desarmado, Defensivo, Duelismo, Interceptação, Luta às Cegas, Protetivo) e 810–943 (as 12 Dádivas, de Fortitude a Espírito da Noite).

Padrões:
- Estilo de Luta: `prerequisito: { estiloLuta: true }` (a linha diz "Pré-requisito: Característica de Estilo de Luta"), `escolhas: []`, `repetivel: false`, `aumento_atributo: null`. Passivos quando `talentos-effects.js` implementa — gabarito:

```js
  'Arquearia': {
    livro: 'Talentos.md §Arquearia',
    categoria: 'de Estilo de Luta',
    prerequisito: { estiloLuta: true },
    repetivel: false,
    escolhas: [],
    aumento_atributo: null,
    passivos: { bonusAtaqueDistancia: 2 },
  },
```

- Dádivas Épicas: `prerequisito: { nivel: 19 }`, `escolhas: [{ tipo: 'atributo_talento', qtd: 1 }]` (todas dão +1 até 30, escolhido), `aumento_atributo` com os seis atributos, `exemplo_valido: { atributo: 'constituicao' }`. Exceções lidas do livro: Dádiva da Proficiência em Perícia acrescenta `{ tipo: 'pericia_expertise', qtd: 1 }` com `exemplo_valido: { atributo: 'carisma', pericia_expertise: 'Atletismo' }` (charBase é proficiente em Atletismo); Dádiva da Resistência à Energia acrescenta `{ tipo: 'energia', qtd: 2 }` com `exemplo_valido: { atributo: 'constituicao', energias: ['Ácido', 'Gélido'] }`.

- [ ] **Step 2: Validar contagem final e ausência de duplicatas**

Run: `cd testes/e2e && node -e "import('../regras/catalogo/talentos.mjs').then(m => { const n = Object.keys(m.CATALOGO_TALENTOS).length; console.log(n); if (n !== 75) process.exit(1); })"`
Expected: `75`, exit 0.

---

### Task 5: Lacunas conhecidas, harness de unidade e teste de completude

**Risk:** medium — primeiro código executável; importa módulos do app em Node.

**Files:**
- Create: `testes/regras/lacunas-conhecidas.mjs`
- Create: `testes/regras/unidade/harness.mjs`
- Create: `testes/regras/unidade/completude.test.mjs`

- [ ] **Step 1: Criar `lacunas-conhecidas.mjs`**

**Interfaces:**
- Produces: `export const LACUNAS` (array de `{ talento, teste, motivo }`), `export const TESTES_VALIDOS` (array), `export function lacuna(talento, teste)` → entrada ou `null`.

```js
// ============================================================
// Lista viva de lacunas do app em relação ao livro.
// Cada entrada faz o teste correspondente esperar FALHA; se o app
// for corrigido e o teste passar, o motor exige remover a entrada.
// Motivo em branco é erro (verificado em completude.test.mjs).
// ============================================================

// Nomes de teste que podem aparecer em `teste`.
export const TESTES_VALIDOS = [
  'escolhas', 'validacao', 'passivos',
  'e2e-levelup', 'e2e-criador', 'e2e-repetivel',
];

export const LACUNAS = [
  // Preenchida nas Tasks 6-10 conforme os motores rodarem.
  // Formato: { talento: 'Habilidoso', teste: 'escolhas',
  //            motivo: 'sem entrada em REGRAS_TALENTOS; validação solta em levelup-validations.js:114' },
];

// Busca a lacuna registrada para um par (talento, teste), se houver.
export function lacuna(talento, teste) {
  return LACUNAS.find((l) => l.talento === talento && l.teste === teste) || null;
}
```

- [ ] **Step 2: Criar `harness.mjs`**

**Interfaces:**
- Produces: `export const RAIZ`; `export async function modulosApp()` → `{ regras, efeitos, store }` (módulos importados de site/js com stub de localStorage); `export function lerTalentosDados()` → array de 75 `{ nome, categoria, ... }`; `export function lerTitulosLivro()` → `Set` de títulos `###`; `export async function comLacuna(talento, teste, fn)` (mecânica de lacuna); `export function charBase()` → personagem mínimo de teste.

```js
// ============================================================
// Harness dos testes de unidade: stubs de globais de navegador,
// import dos módulos do app direto do disco e a mecânica de
// lacunas conhecidas.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lacuna } from '../lacunas-conhecidas.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const RAIZ = resolve(AQUI, '..', '..', '..');

// Instala os globais de navegador que os módulos do app tocam ao serem
// importados. utils.js:609 faz `window.fecharModal = ...` no top-level,
// e é importado por regras-cobertura.js, talentos-effects.js e store.js —
// sem `window` o import lança ReferenceError. `document` acompanha porque
// utils.js manipula DOM em toasts/modais. Se um módulo passar a exigir
// outra global, acrescente o stub AQUI (e só aqui).
function instalarStubs() {
  if (globalThis.localStorage) return;
  const mapa = new Map();
  globalThis.localStorage = {
    getItem: (c) => (mapa.has(c) ? mapa.get(c) : null),
    setItem: (c, v) => mapa.set(c, String(v)),
    removeItem: (c) => mapa.delete(c),
    clear: () => mapa.clear(),
  };
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      style: {}, classList: { add() {}, remove() {} },
      appendChild() {}, setAttribute() {},
    }),
    body: { appendChild() {} },
  };
}

let _cache = null;

// Importa (uma vez) os módulos do app usados pelos motores de teste.
export async function modulosApp() {
  if (_cache) return _cache;
  instalarStubs();
  const importar = (rel) => import(pathToFileURL(resolve(RAIZ, rel)).href);
  const [regras, efeitos, store] = await Promise.all([
    importar('site/js/regras-cobertura.js'),
    importar('site/js/talentos-effects.js'),
    importar('site/js/store.js'),
  ]);
  _cache = { regras, efeitos, store };
  return _cache;
}

// Achata dados/talentos/talentos.json em uma lista de 75 talentos.
export function lerTalentosDados() {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/talentos/talentos.json'), 'utf-8'));
  const lista = [];
  for (const grupo of Object.values(d.por_categoria)) lista.push(...grupo);
  return lista;
}

// Títulos `### Nome` de Talentos.md — para conferir as citações do catálogo.
export function lerTitulosLivro() {
  const md = readFileSync(
    resolve(RAIZ, 'Informacoes Separadas', 'Talentos.md'), 'utf-8');
  return new Set([...md.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => m[1]));
}

// Personagem mínimo dos testes de validação/passivos. Nível 4 (bônus
// de proficiência +2) e duas perícias proficientes, porque algumas
// validações exigem proficiência prévia (Dádiva da Proficiência em Perícia).
export async function charBase() {
  const { store } = await modulosApp();
  const p = store.criarPersonagemVazio();
  p.nivel = 4;
  p.pericias_proficientes = ['Atletismo', 'História'];
  return p;
}

// Mecânica de lacunas: sem lacuna registrada, roda o confronto
// normalmente; com lacuna, exige que ele FALHE — se passar, o app foi
// corrigido e a entrada precisa sair da lista.
export async function comLacuna(talento, teste, fn) {
  const pendente = lacuna(talento, teste);
  if (!pendente) return fn();
  try {
    await fn();
  } catch {
    return; // falha esperada, documentada em lacunas-conhecidas.mjs
  }
  throw new Error(
    `Lacuna corrigida: remova { talento: '${talento}', teste: '${teste}' } de lacunas-conhecidas.mjs`);
}
```

- [ ] **Step 3: Criar `completude.test.mjs`**

```js
// ============================================================
// Completude e sanidade do catálogo: bijeção com dados/, schema
// das entradas, citações reais do livro e higiene das lacunas.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS, TIPOS_ESCOLHA } from '../catalogo/talentos.mjs';
import { LACUNAS, TESTES_VALIDOS } from '../lacunas-conhecidas.mjs';
import { lerTalentosDados, lerTitulosLivro } from './harness.mjs';

const dados = lerTalentosDados();
const titulos = lerTitulosLivro();
const nomesDados = new Set(dados.map((t) => t.nome));
const nomesCatalogo = new Set(Object.keys(CATALOGO_TALENTOS));

test('todo talento de dados/ tem entrada no catálogo', () => {
  const faltam = [...nomesDados].filter((n) => !nomesCatalogo.has(n));
  assert.deepEqual(faltam, [], `sem entrada no catálogo: ${faltam.join(', ')}`);
});

test('todo talento do catálogo existe em dados/ (sem órfãos)', () => {
  const orfaos = [...nomesCatalogo].filter((n) => !nomesDados.has(n));
  assert.deepEqual(orfaos, [], `órfãos no catálogo: ${orfaos.join(', ')}`);
});

test('categoria do catálogo bate com dados/', () => {
  for (const t of dados) {
    assert.equal(CATALOGO_TALENTOS[t.nome]?.categoria, t.categoria,
      `${t.nome}: categoria divergente`);
  }
});

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  test(`schema: ${nome}`, () => {
    assert.match(e.livro || '', /^Talentos\.md §.+/, 'campo livro ausente ou fora do formato');
    const titulo = e.livro.replace('Talentos.md §', '');
    assert.ok(titulos.has(titulo), `citação quebrada: "### ${titulo}" não existe em Talentos.md`);
    assert.equal(typeof e.repetivel, 'boolean', 'repetivel deve ser boolean');
    assert.ok(Array.isArray(e.escolhas), 'escolhas deve ser array');
    for (const esc of e.escolhas) {
      assert.ok(TIPOS_ESCOLHA.includes(esc.tipo), `tipo de escolha desconhecido: ${esc.tipo}`);
      assert.ok(esc.qtd === 'proficiencia' || Number.isInteger(esc.qtd), `qtd inválida em ${esc.tipo}`);
    }
    if (e.escolhas.length > 0) {
      assert.ok(e.exemplo_valido && typeof e.exemplo_valido === 'object',
        'talento com escolhas exige exemplo_valido');
    }
  });
}

test('lacunas conhecidas: todas com talento real, teste válido e motivo escrito', () => {
  for (const l of LACUNAS) {
    assert.ok(nomesCatalogo.has(l.talento), `lacuna de talento inexistente: ${l.talento}`);
    assert.ok(TESTES_VALIDOS.includes(l.teste), `teste desconhecido: ${l.teste}`);
    assert.ok(l.motivo?.trim(), `lacuna sem motivo: ${l.talento}/${l.teste}`);
  }
});
```

- [ ] **Step 4: Rodar e corrigir o catálogo até verde**

Run: `cd testes/e2e && node --test "../regras/unidade/*.test.mjs"`
Expected: tudo verde. Falhas aqui são erros de curadoria (nome com acento diferente de dados/, citação com título errado) — corrigir o **catálogo**, não o teste. Atenção a nomes com hífen/acento: a bijeção usa igualdade exata de string.

---

### Task 6: Motor de escolhas e de validação

**Risk:** medium — é o teste que materializa a lacuna do Habilidoso; exige interpretar resultados com honestidade (lacuna ≠ teste errado).

**Files:**
- Create: `testes/regras/unidade/escolhas.test.mjs`
- Create: `testes/regras/unidade/validacao.test.mjs`
- Modify: `testes/regras/lacunas-conhecidas.mjs`

- [ ] **Step 1: Criar `escolhas.test.mjs`**

```js
// ============================================================
// Confronto: talento que o LIVRO diz ter escolhas precisa de regra
// no app — entrada em REGRAS_TALENTOS (o mapa que a UI consulta) e
// rejeição de escolhas vazias. Validações soltas codificadas à mão
// em levelup-validations.js NÃO contam: validar quantidade sem
// oferecer os controles é exatamente o bug do Habilidoso.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, comLacuna, charBase } from './harness.mjs';

const { regras } = await modulosApp();

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (e.escolhas.length === 0) continue;
  test(`escolhas: ${nome}`, async () => {
    await comLacuna(nome, 'escolhas', async () => {
      assert.ok(regras.getRegraTalento(nome),
        `${nome}: livro exige escolhas (${e.escolhas.map((x) => x.tipo).join(', ')}), ` +
        `mas não há entrada em REGRAS_TALENTOS — a UI não tem o que renderizar`);
      const res = regras.validarEscolhasTalento(await charBase(), nome, {});
      assert.equal(res.valido, false,
        `${nome}: o app aceita adquirir o talento sem nenhuma das escolhas que o livro exige`);
    });
  });
}
```

- [ ] **Step 2: Criar `validacao.test.mjs`**

```js
// ============================================================
// Confronto: para talentos com escolhas, o app aceita um conjunto
// válido (exemplo_valido curado do livro) e rejeita mutações
// inválidas dele (item removido; duplicata).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, comLacuna, charBase } from './harness.mjs';

const { regras } = await modulosApp();

// Gera mutações inválidas do exemplo válido: uma com um item a menos
// e uma com duplicata, para cada campo de lista do exemplo.
function mutacoesInvalidas(exemplo) {
  const saida = [];
  for (const [campo, valor] of Object.entries(exemplo)) {
    if (Array.isArray(valor) && valor.length > 1) {
      saida.push({ ...exemplo, [campo]: valor.slice(0, -1) });
      saida.push({ ...exemplo, [campo]: [valor[0], ...valor.slice(0, -1)] });
    }
  }
  return saida;
}

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (e.escolhas.length === 0) continue;
  test(`validação: ${nome} aceita o exemplo do livro`, async () => {
    await comLacuna(nome, 'validacao', async () => {
      const res = regras.validarEscolhasTalento(await charBase(), nome, e.exemplo_valido);
      assert.equal(res.valido, true, `${nome}: exemplo válido rejeitado: ${res.erro}`);
    });
  });
  const invalidas = mutacoesInvalidas(e.exemplo_valido || {});
  if (invalidas.length > 0) {
    test(`validação: ${nome} rejeita conjuntos inválidos`, async () => {
      await comLacuna(nome, 'validacao', async () => {
        for (const escolhas of invalidas) {
          const res = regras.validarEscolhasTalento(await charBase(), nome, escolhas);
          assert.equal(res.valido, false,
            `${nome}: aceitou conjunto inválido ${JSON.stringify(escolhas)}`);
        }
      });
    });
  }
}
```

Nota: para talentos SEM entrada em `REGRAS_TALENTOS`, "aceita o exemplo" passa trivialmente (`valido: true` para tudo) e "rejeita inválidos" falha — a lacuna vai na entrada `validacao` além da `escolhas`. Isso é intencional: são duas afirmações distintas do livro.

- [ ] **Step 3: Rodar, ler cada falha e classificá-la**

Run: `cd testes/e2e && node --test "../regras/unidade/*.test.mjs"`

Para CADA falha, decidir com o código na frente (`site/js/regras-cobertura.js`):
- O app realmente não implementa → adicionar a `LACUNAS` com motivo específico (arquivo e linha da validação solta, se existir). Esperados no mínimo: Habilidoso, Artifista, Músico, Aumento no Valor de Atributo (validação solta em `levelup-validations.js:114`), e possivelmente Adepto Elemental, Analítico, Mente Aguçada e outros Gerais com escolha sem entrada no mapa.
- O catálogo curou errado (tipo/qtd/exemplo em formato que o app nem deveria aceitar) → corrigir o catálogo.
**Nunca** enfraquecer o teste para passar.

- [ ] **Step 4: Rodar até verde com lacunas anotadas**

Run: `cd testes/e2e && node --test "../regras/unidade/*.test.mjs"`
Expected: verde; `git diff ../regras/lacunas-conhecidas.mjs` mostra a lista com motivos escritos, incluindo Habilidoso.

---

### Task 7: Motor de passivos

**Risk:** medium

**Files:**
- Create: `testes/regras/unidade/passivos.test.mjs`
- Modify: `testes/regras/lacunas-conhecidas.mjs`

- [ ] **Step 1: Criar `passivos.test.mjs`**

```js
// ============================================================
// Confronto: efeitos passivos numéricos e flags que o LIVRO
// declara devem sair de resolverPassivosTalentos().
// 'proficiencia' no catálogo significa "igual ao bônus de
// proficiência do personagem" (nível 4 → +2).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, comLacuna, charBase } from './harness.mjs';

const { efeitos } = await modulosApp();
const BONUS_PROFICIENCIA_NIVEL_4 = 2;

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (!e.passivos && !(e.flags?.length)) continue;
  test(`passivos: ${nome}`, async () => {
    await comLacuna(nome, 'passivos', async () => {
      const char = await charBase();
      char.talentos = [nome];
      const p = efeitos.resolverPassivosTalentos(char);
      for (const [chave, esperado] of Object.entries(e.passivos || {})) {
        const alvo = esperado === 'proficiencia' ? BONUS_PROFICIENCIA_NIVEL_4 : esperado;
        assert.deepEqual(p[chave], alvo, `${nome}: ${chave} deveria ser ${alvo}`);
      }
      for (const flag of e.flags || []) {
        assert.equal(p.flags[flag], true, `${nome}: flag ${flag} ausente`);
      }
    });
  });
}
```

- [ ] **Step 2: Rodar, classificar falhas (lacuna vs. erro de curadoria), anotar lacunas**

Run: `cd testes/e2e && node --test "../regras/unidade/*.test.mjs"`
Mesma disciplina da Task 6, agora contra `site/js/talentos-effects.js`. Se um nome de flag no catálogo não bater com o do app (ex.: catálogo diz `sortudo` e o app usa outro), a fonte da verdade do NOME é o app (flag é detalhe interno); a fonte da verdade da EXISTÊNCIA do efeito é o livro. Nome errado → corrigir catálogo; efeito ausente → lacuna.

- [ ] **Step 3: Rodar até verde**

Run: `cd testes/e2e && node --test "../regras/unidade/*.test.mjs"`
Expected: verde, ~150+ subtestes somando os quatro arquivos.

---

### Task 8: Infra e2e — config, testIgnore da paridade e helpers

**Risk:** medium — mexe (1 linha) na config da suíte de paridade; provar que ela continua intacta faz parte da task.

**Files:**
- Modify: `testes/e2e/playwright.config.mjs` (só o `testIgnore` do projeto paridade)
- Create: `testes/e2e/regras/playwright.config.mjs`
- Create: `testes/e2e/regras/helpers-regras.mjs`
- Create: `testes/e2e/regras/smoke.spec.mjs` (temporário, apagado na própria task)

- [ ] **Step 1: Blindar a paridade contra os specs novos**

Em `testes/e2e/playwright.config.mjs`, projeto `paridade`, trocar:

```js
      testIgnore: 'offline.spec.mjs',
```
por:
```js
      // regras/** é outra suíte (testes de regras do livro), com config própria.
      testIgnore: ['offline.spec.mjs', 'regras/**'],
```

- [ ] **Step 2: Criar `testes/e2e/regras/playwright.config.mjs`**

```js
// ============================================================
// Config da suíte de REGRAS: diferente da paridade, sobe SÓ este
// site — a pergunta aqui é "o app obedece ao livro?", não "é igual
// ao original?". Vive dentro de testes/e2e/ porque é a única árvore
// com node_modules (a resolução do @playwright/test sobe a partir
// do arquivo que importa).
// ============================================================
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
const NOVO = resolve(AQUI, '..', '..', '..');

export default defineConfig({
  testDir: '.',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? 'line' : [['line'], ['html', { open: 'never' }]],
  use: {
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    // Igual à paridade: o cache do SW mascararia regressões.
    serviceWorkers: 'block',
  },
  webServer: [{
    command: `node ../servidor.mjs "${NOVO.replace(/\\/g, '/')}" 8802`,
    url: 'http://127.0.0.1:8802/site/',
    reuseExistingServer: true,
    timeout: 20_000,
  }],
});
```

- [ ] **Step 3: Criar `helpers-regras.mjs`**

**Interfaces:**
- Consumes: `assentar`, `semearPersonagem`, `satisfazerPasso`, `passoAtual`, `confirmarModal`, `lerToastErro`, `resolverModalAberto` de `../helpers.mjs` (reexportados).
- Produces: `export const NOVO`; `export async function abrirSite(context, hash)` → `{ page, erros }`; `export async function abrirFicha(context, campos)` → idem, com personagem semeado e ficha aberta; `export async function personagemSalvo(page)` → objeto do único personagem no localStorage.

```js
// ============================================================
// Helpers da suíte de regras: versões de um site só dos helpers de
// paridade, que sempre operam em pares. Reusa o que dá de ../helpers.mjs.
// ============================================================
import {
  assentar, semearPersonagem, satisfazerPasso, passoAtual,
  confirmarModal, lerToastErro, resolverModalAberto,
} from '../helpers.mjs';

export {
  assentar, satisfazerPasso, passoAtual,
  confirmarModal, lerToastErro, resolverModalAberto,
};

export const NOVO = 'http://127.0.0.1:8802/site/';

// Abre o site coletando erros de console/página — qualquer erro
// derruba o teste no final (mesma disciplina da paridade).
export async function abrirSite(context, hash = '') {
  const page = await context.newPage();
  const erros = [];
  page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => erros.push(`pageerror: ${e.message}`));
  await page.goto(NOVO + hash, { waitUntil: 'domcontentloaded' });
  await assentar(page);
  return { page, erros };
}

// Semeia um personagem pela fábrica do próprio app e abre a ficha dele.
export async function abrirFicha(context, campos, id = 'regras-teste-1') {
  const lado = await abrirSite(context);
  await semearPersonagem(lado.page, campos, id);
  await lado.page.goto(`${NOVO}#ficha/${id}`, { waitUntil: 'domcontentloaded' });
  await assentar(lado.page);
  return lado;
}

// Lê o personagem salvo (o único) direto do store do app.
export async function personagemSalvo(page) {
  return page.evaluate(async () => {
    const store = await import(new URL('./js/store.js', location.href).href);
    return store.listarPersonagens()[0] || null;
  });
}
```

Antes de escrever, confira em `../helpers.mjs` a assinatura real de `semearPersonagem(page, campos, id)` (grep) — se a ordem dos parâmetros diferir, siga a do arquivo.

- [ ] **Step 4: Smoke test provisório + provar as duas suítes**

Criar `testes/e2e/regras/smoke.spec.mjs`:

```js
// Smoke provisório da infra (apagado ainda nesta task): sobe o site,
// semeia um Guerreiro nível 3 e vê a ficha renderizar.
import { test, expect } from '@playwright/test';
import { abrirFicha } from './helpers-regras.mjs';

test('infra: ficha semeada renderiza', async ({ context }) => {
  const { page, erros } = await abrirFicha(context, {
    nome: 'Smoke', classe: 'Guerreiro', nivel: 3,
    atributos: { forca: 15, destreza: 14, constituicao: 14, inteligencia: 13, sabedoria: 12, carisma: 10 },
  });
  await expect(page.locator('#app-content')).not.toBeEmpty();
  expect(erros).toEqual([]);
});
```

Run: `cd testes/e2e && npx playwright test --config=regras/playwright.config.mjs`
Expected: 1 passed.

Run: `cd testes/e2e && npx playwright test --list | tail -3`
Expected: a contagem de testes listados da paridade é a MESMA de antes da task (rodar `--list` antes do Step 1 e comparar) — nenhum spec de `regras/` aparece.

Depois: apagar `smoke.spec.mjs`.

---

### Task 9: E2e — escolhas de talento na subida de nível

**Risk:** high — dirige o fluxo real de cards do level-up; descobertas viram lacunas `e2e-levelup`.

**Files:**
- Create: `testes/e2e/regras/talentos-levelup.spec.mjs`
- Modify: `testes/regras/lacunas-conhecidas.mjs`

- [ ] **Step 1: Escrever o spec dirigido pelo catálogo**

```js
// ============================================================
// Regra do livro: talento com escolhas, ao ser selecionado na
// subida de nível, deve OFERECER os controles de escolha, bloquear
// a confirmação até completá-las e persistir o que foi escolhido.
// Dirigido pelo catálogo: talento novo com escolhas entra sozinho.
// ============================================================
import { test, expect } from '@playwright/test';
import { CATALOGO_TALENTOS } from '../../regras/catalogo/talentos.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import { abrirFicha, personagemSalvo } from './helpers-regras.mjs';

const ATRIBUTOS = { forca: 15, destreza: 14, constituicao: 14,
                    inteligencia: 13, sabedoria: 12, carisma: 10 };

// Guerreiro nível 3 → 4 ganha ASI; Dádivas Épicas exigem nível 19.
const SEMENTES = {
  normal: { classe: 'Guerreiro', nivel: 3, xp: 355000, atributos: ATRIBUTOS,
            pericias_proficientes: ['Atletismo', 'História'] },
  epico:  { classe: 'Guerreiro', nivel: 18, xp: 355000, atributos: ATRIBUTOS,
            pericias_proficientes: ['Atletismo', 'História'] },
};

// Abre o modal de level-up e navega até a tela de ASI/talento,
// confirmando as telas anteriores (subclasse, PV etc.) que aparecerem.
async function irAteEscolhaDeTalento(page) {
  await page.evaluate(() => {
    localStorage.setItem('feature.levelup.flow.v2', '1');
    document.getElementById('btn-levelup')?.click();
  });
  await page.waitForTimeout(700);
  for (let i = 0; i < 8; i++) {
    if (await page.locator('input[name="levelup-asi-modo"]').count()) return true;
    const btn = page.locator('#modal-acoes button:not([disabled])').last();
    if (!await btn.count()) return false;
    await btn.click();
    await page.waitForTimeout(400);
  }
  return page.locator('input[name="levelup-asi-modo"]').count() > 0;
}

// Quantos controles de escolha o catálogo espera na tela para este
// talento: selects .escolha-talento-levelup para escolhas de lista,
// mais o select/hidden #levelup-talento-asi quando há +1 embutido.
function controlesEsperados(entrada) {
  const deListas = entrada.escolhas
    .filter((e) => !['atributo_talento', 'atributo_conjuracao', 'atributo_salvaguarda',
                     'lista_magias', 'truque', 'magia_1_circulo', 'magia'].includes(e.tipo))
    .reduce((soma, e) => soma + (e.qtd === 'proficiencia' ? 2 : e.qtd), 0);
  return deListas;
}

const CANDIDATOS = Object.entries(CATALOGO_TALENTOS)
  .filter(([, t]) => t.escolhas.length > 0);

for (const [nome, entrada] of CANDIDATOS) {
  const semente = entrada.categoria === 'de Dádiva Épica' ? 'epico' : 'normal';
  test(`level-up: ${nome}`, async ({ context }) => {
    const l = lacuna(nome, 'e2e-levelup');
    test.fail(Boolean(l), l?.motivo);

    const { page, erros } = await abrirFicha(context, SEMENTES[semente]);
    expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);

    // Muda para o modo talento e seleciona o talento-alvo.
    await page.check('input[name="levelup-asi-modo"][value="talento"]').catch(() => {});
    const select = page.locator('#levelup-talento-select');
    const opcao = select.locator(`option[value="${nome}"]`);
    if (!await opcao.count()) {
      // Ausente da lista: só é aceitável se um pré-requisito do LIVRO
      // justificar (a semente satisfaz nível e atributos 15/14/13…).
      const pre = entrada.prerequisito;
      expect(pre, `${nome} não aparece na lista e o livro não dá pré-requisito que justifique`)
        .not.toBeNull();
      return;
    }
    await select.selectOption(nome);
    await page.waitForTimeout(400);

    // 1. A tela oferece os controles de escolha que o livro exige.
    const selects = page.locator('.escolha-talento-levelup');
    expect(await selects.count(),
      `${nome}: livro exige ${JSON.stringify(entrada.escolhas)}, tela não oferece`)
      .toBeGreaterThanOrEqual(controlesEsperados(entrada));

    // 1b. Quando o livro enumera uma lista FECHADA de opções, a tela
    // tem de oferecer exatamente aquelas. É esta asserção que prova os
    // desvios de rótulo já conhecidos (Analítico troca Percepção por
    // Medicina; Adepto Elemental usa Frio/Fogo em vez de Gélido/Ígneo).
    for (const esc of entrada.escolhas.filter((e) => Array.isArray(e.opcoes))) {
      const ofertadas = await selects.first().locator('option')
        .evaluateAll((ops) => ops.map((o) => o.value).filter(Boolean));
      const faltando = esc.opcoes.filter((o) => !ofertadas.includes(o));
      expect(faltando,
        `${nome}: o livro oferece ${JSON.stringify(esc.opcoes)}, a tela não oferece ${JSON.stringify(faltando)}`)
        .toEqual([]);
    }

    // 2. Confirmar sem escolher não avança (a validação segura).
    const confirmar = page.locator('#modal-acoes button:not([disabled])').last();
    await confirmar.click();
    await page.waitForTimeout(400);
    expect(await page.locator('input[name="levelup-asi-modo"], .escolha-talento-levelup').count(),
      `${nome}: confirmou sem as escolhas obrigatórias`).toBeGreaterThan(0);

    // 3. Preenche cada select com uma opção distinta e confirma.
    const n = await selects.count();
    for (let i = 0; i < n; i++) {
      const s = selects.nth(i);
      const valores = await s.locator('option').evaluateAll(
        (ops) => ops.map((o) => o.value).filter(Boolean));
      await s.selectOption(valores[i % valores.length]);
    }
    // ASI embutido, se o select existir.
    const asi = page.locator('select#levelup-talento-asi');
    if (await asi.count()) {
      const valores = await asi.locator('option:not([disabled])').evaluateAll(
        (ops) => ops.map((o) => o.value).filter(Boolean));
      if (valores.length) await asi.selectOption(valores[0]);
    }
    await confirmar.click();
    await page.waitForTimeout(600);

    // 4. As seleções persistem no personagem salvo, em algum campo.
    const escolhidos = [];
    for (let i = 0; i < n; i++) {
      escolhidos.push(await selects.nth(i).inputValue().catch(() => ''));
    }
    const salvo = JSON.stringify(await personagemSalvo(page));
    for (const v of escolhidos.filter(Boolean)) {
      expect(salvo, `${nome}: escolha "${v}" não persistiu na ficha`).toContain(v);
    }
    expect(erros).toEqual([]);
  });
}
```

- [ ] **Step 2: Rodar, classificar cada falha e anotar lacunas `e2e-levelup`**

Run: `cd testes/e2e && npx playwright test --config=regras/playwright.config.mjs talentos-levelup`

Disciplina da Task 6: falha porque o app não oferece/valida/persiste → lacuna com motivo (ex.: `'Adepto Elemental', teste: 'e2e-levelup', motivo: 'levelup-ui.js não renderiza select de tipo de energia'`); falha porque o spec/driver leu a tela errado (seletor, timing, ordem de cards) → corrigir o spec — usar `--headed`/trace para distinguir. Se `irAteEscolhaDeTalento` empacar em todas as classes, isso é defeito do driver, não 40 lacunas: corrigir antes de anotar qualquer coisa.

- [ ] **Step 3: Rodar até verde**

Run: `cd testes/e2e && npx playwright test --config=regras/playwright.config.mjs talentos-levelup`
Expected: verde (com `test.fail` anotados pelas lacunas).

---

### Task 10: E2e — talento de origem no criador e repetibilidade

**Risk:** high — mesmos motivos da Task 9.

**Files:**
- Create: `testes/e2e/regras/talentos-criador.spec.mjs`
- Create: `testes/e2e/regras/talentos-repetivel.spec.mjs`
- Modify: `testes/regras/lacunas-conhecidas.mjs`

- [ ] **Step 1: Criar `talentos-criador.spec.mjs`**

```js
// ============================================================
// Regra do livro: antecedente concede um talento de origem; se o
// talento tem escolhas (Habilidoso, Artifista, Músico...), o passo
// do antecedente deve oferecê-las e recusar confirmação incompleta.
// ============================================================
import { test, expect } from '@playwright/test';
import { CATALOGO_TALENTOS } from '../../regras/catalogo/talentos.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import { abrirSite, satisfazerPasso, confirmarModal, lerToastErro, assentar } from './helpers-regras.mjs';

// Antecedente → talento concedido, lido de dados/ para o teste crescer
// sozinho quando o conteúdo mudar.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const ANTECEDENTES = (() => {
  const d = JSON.parse(readFileSync(resolve(RAIZ, 'dados/origens/antecedentes.json'), 'utf-8'));
  const lista = Array.isArray(d) ? d : d.antecedentes;
  return lista.map((a) => ({
    nome: a.nome,
    talento: (a.talento || '').replace(/\s*\(.*$/, '').trim(),
  }));
})();

// Um antecedente por talento-com-escolhas basta: a regra é do talento.
const CASOS = [];
const vistos = new Set();
for (const a of ANTECEDENTES) {
  const t = CATALOGO_TALENTOS[a.talento];
  if (t && t.escolhas.length > 0 && !vistos.has(a.talento)) {
    vistos.add(a.talento);
    CASOS.push({ antecedente: a.nome, talento: a.talento, entrada: t });
  }
}

// Avança o wizard do passo 1 (classe) até os cards de antecedente.
async function irAteAntecedentes(page) {
  await page.click('[data-classe="Guerreiro"]');
  await confirmarModal(page, 'popup-confirmar-classe').catch(() => {});
  for (let i = 0; i < 8; i++) {
    if (await page.locator('[data-antecedente]').count()) return true;
    if (!await satisfazerPasso(page)) return false;
    await assentar(page).catch(() => {});
  }
  return page.locator('[data-antecedente]').count() > 0;
}

for (const { antecedente, talento, entrada } of CASOS) {
  test(`criador: ${antecedente} concede ${talento} com escolhas`, async ({ context }) => {
    const l = lacuna(talento, 'e2e-criador');
    test.fail(Boolean(l), l?.motivo);

    const { page, erros } = await abrirSite(context, '#criar');
    expect(await irAteAntecedentes(page), 'não chegou ao passo de antecedente').toBe(true);

    await page.click(`[data-antecedente="${antecedente}"]`);
    await page.waitForTimeout(400);

    // 1. O popup de confirmação oferece os selects de escolha do talento.
    const selects = page.locator('.escolha-talento-antecedente');
    const esperado = entrada.escolhas
      .filter((e) => ['pericia', 'ferramenta', 'pericia_ou_ferramenta',
                      'instrumento', 'ferramenta_artesao'].includes(e.tipo))
      .reduce((s, e) => s + e.qtd, 0);
    expect(await selects.count(),
      `${talento}: livro exige ${JSON.stringify(entrada.escolhas)} ao adquirir`)
      .toBeGreaterThanOrEqual(esperado);
    if (esperado === 0) return; // talento cujas escolhas não são de select (ex.: Iniciado em Magia)

    // 2. Confirmar sem preencher deve ser recusado com aviso.
    await confirmarModal(page, 'popup-confirmar-antecedente').catch(() => {});
    await page.waitForTimeout(300);
    const toast = await lerToastErro(page);
    expect(toast, `${talento}: confirmou sem as ${esperado} escolhas`).toBeTruthy();

    // 3. Preenche opções distintas e confirma com sucesso.
    const n = await selects.count();
    for (let i = 0; i < n; i++) {
      const s = selects.nth(i);
      const valores = await s.locator('option').evaluateAll(
        (ops) => ops.map((o) => o.value).filter(Boolean));
      await s.selectOption(valores[i % valores.length]);
    }
    await confirmarModal(page, 'popup-confirmar-antecedente');
    await page.waitForTimeout(300);
    expect(await page.locator('#modal-overlay').isVisible(),
      `${talento}: modal não fechou após escolhas completas`).toBe(false);
    expect(erros).toEqual([]);
  });
}
```

- [ ] **Step 2: Criar `talentos-repetivel.spec.mjs`**

```js
// ============================================================
// Regra do livro: "Repetível. Você pode adquirir este talento mais
// de uma vez." — e, sem essa marca, adquirir duas vezes é proibido.
// Testa no level-up: personagem que JÁ tem o talento sobe de nível
// e olha a lista de talentos oferecidos.
// ============================================================
import { test, expect } from '@playwright/test';
import { CATALOGO_TALENTOS } from '../../regras/catalogo/talentos.mjs';
import { lacuna } from '../../regras/lacunas-conhecidas.mjs';
import { abrirFicha } from './helpers-regras.mjs';

const ATRIBUTOS = { forca: 15, destreza: 14, constituicao: 14,
                    inteligencia: 13, sabedoria: 12, carisma: 10 };

// Reaproveita a navegação da suíte de level-up.
async function irAteEscolhaDeTalento(page) {
  await page.evaluate(() => {
    localStorage.setItem('feature.levelup.flow.v2', '1');
    document.getElementById('btn-levelup')?.click();
  });
  await page.waitForTimeout(700);
  for (let i = 0; i < 8; i++) {
    if (await page.locator('input[name="levelup-asi-modo"]').count()) return true;
    const btn = page.locator('#modal-acoes button:not([disabled])').last();
    if (!await btn.count()) return false;
    await btn.click();
    await page.waitForTimeout(400);
  }
  return page.locator('input[name="levelup-asi-modo"]').count() > 0;
}

// Um repetível e um não-repetível bastam para fixar a regra dos dois
// lados; Habilidoso é o caso do livro que motivou o projeto.
const CASOS = [
  { nome: 'Habilidoso', esperaOfertado: true },
  { nome: 'Alerta', esperaOfertado: false },
];

for (const { nome, esperaOfertado } of CASOS) {
  test(`repetível: ${nome} já adquirido ${esperaOfertado ? 'reaparece' : 'não reaparece'}`, async ({ context }) => {
    const l = lacuna(nome, 'e2e-repetivel');
    test.fail(Boolean(l), l?.motivo);
    expect(CATALOGO_TALENTOS[nome].repetivel, 'caso desalinhado com o catálogo')
      .toBe(esperaOfertado);

    const { page } = await abrirFicha(context, {
      classe: 'Guerreiro', nivel: 3, xp: 355000, atributos: ATRIBUTOS,
      pericias_proficientes: ['Atletismo', 'História'],
      talentos: [nome],
    });
    expect(await irAteEscolhaDeTalento(page), 'não chegou à tela de ASI/talento').toBe(true);
    await page.check('input[name="levelup-asi-modo"][value="talento"]').catch(() => {});
    const oferta = await page
      .locator(`#levelup-talento-select option[value="${nome}"]`).count();
    expect(oferta > 0,
      `${nome}: livro diz repetível=${esperaOfertado}, lista de talentos diz o contrário`)
      .toBe(esperaOfertado);
  });
}
```

- [ ] **Step 3: Rodar os dois specs, classificar falhas, anotar lacunas, repetir até verde**

Run: `cd testes/e2e && npx playwright test --config=regras/playwright.config.mjs talentos-criador talentos-repetivel`
Expected: verde com lacunas anotadas (mesma disciplina das tasks anteriores; chaves `e2e-criador` e `e2e-repetivel`).

---

### Task 11: Scripts npm, README e rodada final

**Risk:** low

**Files:**
- Modify: `testes/e2e/package.json`
- Create: `testes/regras/README.md`

- [ ] **Step 1: Acrescentar os scripts**

Em `testes/e2e/package.json`, no bloco `scripts` (mantendo os existentes):

```json
    "test:regras": "npm run test:regras:unidade && npm run test:regras:e2e",
    "test:regras:unidade": "node --test \"../regras/unidade/*.test.mjs\"",
    "test:regras:e2e": "playwright test --config=regras/playwright.config.mjs"
```

- [ ] **Step 2: Escrever `testes/regras/README.md`**

Conteúdo obrigatório (prosa curta, no tom do README da paridade):
- A pergunta que esta suíte responde: **"o app obedece ao livro?"** — em contraste com a paridade ("a tela é a mesma do original?"). Um erro presente nos dois sites passa na paridade para sempre; é esta suíte que o pega.
- Fonte da verdade: `catalogo/talentos.mjs`, curado à mão de `Informacoes Separadas/Talentos.md`, com citação por entrada; completude contra `dados/` garantida por teste.
- Como rodar (os três scripts acima, a partir de `testes/e2e/`).
- A mecânica de `lacunas-conhecidas.mjs`: falha esperada documentada mantém a suíte verde; corrigiu o app → o teste cobra a remoção da entrada; motivo em branco é erro. A lista É o backlog de correções contra o livro.
- **O que cada motor prova, e o que não prova.** Em especial, o limite do motor de passivos: os campos `passivos`/`flags` do catálogo foram curados lendo `site/js/talentos-effects.js` (o app é dono dos nomes internos de flag), então esse motor verifica sobretudo que o catálogo transcreveu o app corretamente e serve de rede contra regressão — ele não prova sozinho que o app obedece ao livro. Quem faz a confrontação com o livro ali é a etapa de curadoria. Dizer isso em voz alta evita que "62/62 verde" seja lido como garantia maior do que é.
- Por que os specs Playwright vivem em `testes/e2e/regras/` (resolução do `@playwright/test`; único `node_modules` do projeto).
- Mapa de domínios futuros na ordem do spec (antecedentes, espécies, classes/níveis, magias, regras transversais da ficha), com a frase: cada domínio novo é um arquivo de catálogo + um motor, a estrutura não muda.

- [ ] **Step 3: Rodada final completa das TRÊS suítes**

Run: `cd testes/e2e && npm run test:regras`
Expected: unidade + e2e de regras verdes.

Run: `cd testes/e2e && npm test`
Expected: paridade intacta — 328 passam, 1 pulado, como documentado no README dela.

- [ ] **Step 4: Conferir critérios de sucesso do spec**

Checklist contra `docs/superpowers/specs/2026-08-06-testes-regras-negocio-design.md`:
1. Suítes verdes com lacunas anotadas ✓ (Step 3)
2. Catálogo cobre os 75 por teste ✓ (completude.test.mjs)
3. `grep Habilidoso ../regras/lacunas-conhecidas.mjs` → entrada com motivo ✓
4. Citações conferidas por teste ✓ (completude.test.mjs)
5. `git status` mostra mudanças SÓ em `testes/regras/`, `testes/e2e/regras/`, `testes/e2e/package.json`, `testes/e2e/playwright.config.mjs` e `docs/superpowers/` ✓

Reportar ao usuário a lista final de lacunas encontradas — ela é o produto secundário do projeto e o insumo dos próximos.
