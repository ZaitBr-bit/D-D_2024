# Heróis de Faerûn — Talentos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar os 34 talentos de *Forgotten Realms: Heroes of Faerûn* ao catálogo, level-up, ficha, impressão e motor de passivos, todos com fonte `frhof-2025`.

**Architecture:** Manter `dados/talentos/talentos.json` base intacto. Criar `dados/talentos/talentos_frhof.json` isolado, mesclar em `getTalentos()` e usar metadados explícitos por talento para escolhas, pré-requisitos, ASI, magias, recursos e passivos. Automatizar só efeitos compatíveis com `talentos-effects.js`, `subirDeNivel()` e recursos já persistidos no personagem; resto fica como regra exibida e auditável.

**Tech Stack:** Markdown, JSON, JavaScript ES modules, Node.js built-in test runner, PowerShell

---

## Pré-requisitos e decisão

Executar [05 — Antecedentes](2026-07-21-herois-de-faerun-05-antecedentes.md) antes deste plano. Talentos de Origem FRHOF concedidos por antecedentes são entrada do filtro de pré-requisitos dos talentos Gerais deste escopo.

Melhor forma: catálogo separado + integração genérica + matriz de efeitos. Não criar 34 fluxos especiais. Cada talento carrega dados suficientes para o app renderizar, validar e aplicar escolhas por metadados. `talentos-effects.js` recebe somente flags/passivos derivados; `levelup.js` aplica alterações permanentes no personagem; ficha exibe ações e recursos manuais quando automação completa não existe.

## Inventário canônico

| Nome original | Categoria D&D Beyond | Categoria no app | Propriedades a auditar |
|---|---|---|---|
| Cult of the Dragon Initiate | Origin | de Origem | Idioma/tema dracônico, medo, inspiração por medo. |
| Emerald Enclave Fledgling | Origin | de Origem | Magia ou comunicação animal, cooperação com aliado. |
| Harper Agent | Origin | de Origem | Gíria de Ladrões, instrumentos, distração musical. |
| Lords' Alliance Agent | Origin | de Origem | Golpe inspirador, honra/apoio de aliado. |
| Purple Dragon Rook | Origin | de Origem | Pedido social, grito de reunião. |
| Spellfire Spark | Origin | de Origem | Absorção mágica, chama de spellfire. |
| Tyro of the Gauntlet | Origin | de Origem | Postura conjunta, vigilância. |
| Zhentarim Ruffian | Origin | de Origem | Explorar abertura, proteção de grupo. |
| Cold Caster | General | Geral | ASI Int/Sab/Car, *Raio de Gelo*, *Frostbite*. |
| Dragonscarred | General | Geral | ASI Con/Car, resistência a dano, poder assustador. |
| Enclave Magic | General | Geral | ASI Int/Sab/Car, animais, vínculo mental/cooperativo. |
| Fairy Trickster | General | Geral | ASI, movimento feérico, ataque desorientador. |
| Genie Magic | General | Geral | ASI Int/Sab/Car, magia ligada a desejo. |
| Harper Teamwork | General | Geral | ASI, palavras debilitantes, força de vontade inspiradora. |
| Lordly Resolve | General | Geral | ASI For/Car, porta-estandarte. |
| Mythal Touched | General | Geral | ASI, proteção de mythal. |
| Order's Resilience | General | Geral | ASI For/Sab/Car, ressurgir, força conjunta. |
| Purple Dragon Commandant | General | Geral | ASI For/Des, encorajar aliado, último esforço. |
| Spellfire Adept | General | Geral | ASI, spellfire alimentado, spellfire abrasador. |
| Street Justice | General | Geral | ASI For/Des, agarrar, nó firme, intimidação. |
| Zhentarim Tactics | General | Geral | ASI, retaliar, mercenário versátil. |
| Boon of Bloodshed | Epic Boon | de Dádiva Épica | ASI qualquer, fortuna assassina, poder pela dor. |
| Boon of Bountiful Health | Epic Boon | de Dádiva Épica | ASI qualquer, PV temporários, regeneração. |
| Boon of Communication | Epic Boon | de Dádiva Épica | ASI Int/Sab/Car, comunicação, idiomas, telepatia. |
| Boon of Desperate Resilience | Epic Boon | de Dádiva Épica | ASI For/Con, resistência quando sangrando. |
| Boon of Exquisite Radiance | Epic Boon | de Dádiva Épica | ASI qualquer, repouso eterno, radiância. |
| Boon of Fluid Forms | Epic Boon | de Dádiva Épica | ASI Int/Sab/Car, transformação, resistência da forma. |
| Boon of Fortune's Favor | Epic Boon | de Dádiva Épica | ASI qualquer, repetir salvaguarda. |
| Boon of Poison Mastery | Epic Boon | de Dádiva Épica | ASI qualquer, antitóxico, venenos perfeitos. |
| Boon of Revelry | Epic Boon | de Dádiva Épica | ASI, dança inspiradora, canto. |
| Boon of Terror | Epic Boon | de Dádiva Épica | ASI Car, imunidade a Amedrontado, Intimidação, fuga forçada. |
| Boon of the Bright Sun | Epic Boon | de Dádiva Épica | ASI Con/Sab/Car, presença diurna, luz fortificante. |
| Boon of the Furious Storm | Epic Boon | de Dádiva Épica | ASI Int/Sab/Car, olho da tempestade, força da tempestade. |
| Boon of the Soul Drinker | Epic Boon | de Dádiva Épica | ASI qualquer, resistência a frio/necrótico, drenar vida. |

Usar texto autoral resumido nos campos `descricao` e `beneficios[].descricao`. Não copiar parágrafos integrais da publicação.

## Matriz de pré-requisitos

Validar pré-requisitos por dados estruturados, não por regex em `prerequisito`. Todo seletor normal usa `cumprePrerequisitosTalento(char, talento, contexto)`. Talento inelegível não aparece no seletor; detalhe/manual pode mostrar motivo apenas em fluxo explícito de Mestre.

| Nome original | Pré-requisito estruturado | Contextos em que pode aparecer |
|---|---|---|
| Cult of the Dragon Initiate | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Emerald Enclave Fledgling | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Harper Agent | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Lords' Alliance Agent | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Purple Dragon Rook | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Spellfire Spark | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Tyro of the Gauntlet | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Zhentarim Ruffian | Talento de Origem; sem nível mínimo. | Criação por antecedente FRHOF, Humano Versátil, invocação que concede talento de Origem, adição manual de Mestre. |
| Cold Caster | Nível 4+, sem cadeia adicional. | ASI/feat normal de nível 4+. |
| Dragonscarred | Nível 4+ e `Cult of the Dragon Initiate`. | ASI/feat normal somente se personagem já tem o talento exigido. |
| Enclave Magic | Nível 4+ e `Emerald Enclave Fledgling`. | ASI/feat normal somente se personagem já tem o talento exigido. |
| Fairy Trickster | Nível 4+, sem cadeia adicional. | ASI/feat normal de nível 4+. |
| Genie Magic | Nível 4+, sem cadeia adicional. | ASI/feat normal de nível 4+. |
| Harper Teamwork | Nível 4+ e `Harper Agent`. | ASI/feat normal somente se personagem já tem o talento exigido. |
| Lordly Resolve | Nível 4+ e `Lords' Alliance Agent`. | ASI/feat normal somente se personagem já tem o talento exigido. |
| Mythal Touched | Nível 4+, sem cadeia adicional. | ASI/feat normal de nível 4+. |
| Order's Resilience | Nível 4+ e `Tyro of the Gauntlet`. | ASI/feat normal somente se personagem já tem o talento exigido. |
| Purple Dragon Commandant | Nível 4+ e (`Purple Dragon Rook` ou proficiência com Armas Marciais). | ASI/feat normal somente se uma das alternativas existe. |
| Spellfire Adept | Nível 4+ e (`Spellfire Spark` ou `Conjuração` ou `Magia de Pacto`). | ASI/feat normal somente se personagem tem o talento ou uma característica de conjuração. |
| Street Justice | Nível 4+, sem cadeia adicional. | ASI/feat normal de nível 4+. |
| Zhentarim Tactics | Nível 4+ e `Zhentarim Ruffian`. | ASI/feat normal somente se personagem já tem o talento exigido. |
| Boon of Bloodshed | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Bountiful Health | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Communication | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Desperate Resilience | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Exquisite Radiance | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Fluid Forms | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Fortune's Favor | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Poison Mastery | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Revelry | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of Terror | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of the Bright Sun | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of the Furious Storm | Nível 19+. | ASI/feat épico de nível 19+. |
| Boon of the Soul Drinker | Nível 19+. | ASI/feat épico de nível 19+. |

Categorias de contexto:

- `criacao_antecedente`: somente talentos de Origem concedidos por antecedente.
- `especie_versatil`: somente talentos de Origem elegíveis para Humano Versátil.
- `invocacao_origem`: somente talentos de Origem.
- `levelup_asi`: talentos Gerais no nível 4+ e Dádivas Épicas no nível 19+; nunca talentos de Origem.
- `manual_mestre`: selector separado com aviso; pode listar todos, mas deve mostrar inelegíveis bloqueados por padrão.

### Task 1: Criar referência humana auditável

**Files:**
- Create: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/01-opcoes-de-personagem/talentos-frhof.md`
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`

- [ ] **Step 1: Criar o documento de referência**

Criar diretório `01-opcoes-de-personagem` se ausente. Arquivo começa com:

```markdown
# Talentos

> **Fonte:** Forgotten Realms: Heroes of Faerûn (2025)
> **ID da fonte:** `frhof-2025`
> **Escopo:** 34 talentos; 8 de Origem, 13 Gerais e 13 Dádivas Épicas.
```

Depois, incluir tabela do inventário canônico, matriz de pré-requisitos e uma subseção `##` por talento, com nome original, nome no aplicativo, categoria, pré-requisito, ASI, escolhas, magias concedidas, recursos, passivos, ações/reação/bônus, descanso/recarga, impacto na ficha e regra resumida.

- [ ] **Step 2: Marcar impacto na ficha**

Em cada subseção, incluir `Impacto na ficha:` com uma destas classes: `passivo automatizável`, `escolha persistente`, `recurso rastreável`, `ação manual`, `efeito situacional` ou `sem automação`. Registrar explicitamente atributo, perícia, ferramenta, idioma, magia, resistência, imunidade, PV temporários, deslocamento, telepatia, vantagem/desvantagem, salvaguarda e condição quando existirem.

- [ ] **Step 3: Atualizar README isolado**

Trocar linha `Talentos | 34 | Não iniciado` por `Talentos | 34 | Em implementação — [catálogo](01-opcoes-de-personagem/talentos-frhof.md)`. Não alterar Antecedentes, Subclasses, Auditoria integrada ou Magia de Círculo.

- [ ] **Step 4: Validar contagem humana**

Run: `$arquivo = 'Informacoes Separadas\Forgotten Realms - Heróis de Faerûn\01-opcoes-de-personagem\talentos-frhof.md'; (Select-String -LiteralPath $arquivo -Pattern '^## ' -Encoding utf8).Count; Select-String -LiteralPath $arquivo -Pattern 'frhof-2025|Impacto na ficha|Pré-requisito estruturado|Boon of the Soul Drinker' -Encoding utf8`

Expected: 34 subseções, ID da fonte presente, 34 impactos de ficha, matriz de pré-requisitos e último talento canônico presente.

### Task 2: Criar catálogo JSON isolado e teste de contrato

**Files:**
- Create: `dados/talentos/talentos_frhof.json`
- Create: `tests/talentos-frhof.test.mjs`

- [ ] **Step 1: Escrever teste antes do JSON**

Teste exige:

```js
const nomesOriginaisEsperados = [
  'Cult of the Dragon Initiate',
  'Emerald Enclave Fledgling',
  'Harper Agent',
  "Lords' Alliance Agent",
  'Purple Dragon Rook',
  'Spellfire Spark',
  'Tyro of the Gauntlet',
  'Zhentarim Ruffian',
  'Cold Caster',
  'Dragonscarred',
  'Enclave Magic',
  'Fairy Trickster',
  'Genie Magic',
  'Harper Teamwork',
  'Lordly Resolve',
  'Mythal Touched',
  "Order's Resilience",
  'Purple Dragon Commandant',
  'Spellfire Adept',
  'Street Justice',
  'Zhentarim Tactics',
  'Boon of Bloodshed',
  'Boon of Bountiful Health',
  'Boon of Communication',
  'Boon of Desperate Resilience',
  'Boon of Exquisite Radiance',
  'Boon of Fluid Forms',
  "Boon of Fortune's Favor",
  'Boon of Poison Mastery',
  'Boon of Revelry',
  'Boon of Terror',
  'Boon of the Bright Sun',
  'Boon of the Furious Storm',
  'Boon of the Soul Drinker'
];
```

Também exigir:

- `total === 34` e `todos.length === 34`;
- 8 talentos `categoria === 'de Origem'`;
- 13 talentos `categoria === 'Geral'`;
- 13 talentos `categoria === 'de Dádiva Épica'`;
- todo registro com `nome`, `nome_original`, `categoria`, `prerequisito`, `beneficios`, `descricao`, `fonte`, `mecanica`;
- todo `fonte` igual a `FONTE_FRHOF`;
- `mecanica.prerequisitos`, `mecanica.asi`, `mecanica.escolhas`, `mecanica.magias`, `mecanica.recursos`, `mecanica.passivos`, `mecanica.acoes`, `mecanica.descanso`, `mecanica.automacao`;
- pré-requisitos estruturados batem exatamente com a matriz: 8 Origem sem `nivel_minimo`, 13 Gerais com `nivel_minimo: 4`, 13 Dádivas com `nivel_minimo: 19`, cadeias por talento anterior e alternativas de talento/proficiência/conjuração;
- nomes únicos por `nome_original` e por `nome`;
- ausência de alteração em `dados/talentos/talentos.json`.

- [ ] **Step 2: Executar e confirmar falha**

Run: `node --test tests/talentos-frhof.test.mjs`

Expected: falha por ausência de `dados/talentos/talentos_frhof.json`.

- [ ] **Step 3: Criar JSON**

Formato de cada registro:

```json
{
  "nome": "Centelha de Spellfire",
  "nome_original": "Spellfire Spark",
  "categoria": "de Origem",
  "prerequisito": "",
  "beneficios": [
    {
      "nome": "Absorção Mágica",
      "descricao": "Você rastreia a capacidade do personagem de absorver energia mágica conforme o talento, com usos recuperados no Descanso Longo."
    },
    {
      "nome": "Chama de Spellfire",
      "descricao": "Você registra a opção ofensiva de spellfire como ação do talento, exibida na ficha sem alterar ataques-base permanentes."
    }
  ],
  "descricao": "Você adquire os seguintes benefícios.",
  "mecanica": {
    "prerequisitos": {
      "categoria_contexto": "origem",
      "nivel_minimo": null,
      "talentos": [],
      "alternativas": [],
      "contextos_permitidos": ["criacao_antecedente", "especie_versatil", "invocacao_origem", "manual_mestre"]
    },
    "asi": { "atributos": [], "quantidade": 0, "maximo": null },
    "escolhas": [],
    "magias": [],
    "recursos": [
      {
        "id": "spellfire_spark_absorcao_magica",
        "nome": "Absorção Mágica",
        "base": "bonus_proficiencia",
        "recupera": "descanso_longo"
      }
    ],
    "passivos": ["spellfire_spark"],
    "acoes": ["spellfire_flame"],
    "descanso": ["restaurar_spellfire_spark_absorcao_magica"],
    "automacao": "recurso_rastreavel"
  },
  "fonte": {
    "id": "frhof-2025",
    "nome": "Forgotten Realms: Heroes of Faerûn",
    "rotulo": "Heróis de Faerûn",
    "tipo": "expansao",
    "ano": 2025
  }
}
```

Registros sem ASI usam `quantidade: 0`; talentos gerais e dádivas com ASI usam `quantidade: 1`; escolhas sem opções fixas ficam descritas em `mecanica.escolhas` com `tipo`, `quantidade`, `opcoes` e `persistir_em`.

- [ ] **Step 4: Confirmar JSON e contrato**

Run: `node --test tests/talentos-frhof.test.mjs`

Expected: 34 talentos válidos, fonte consistente, categorias corretas, mecânica estruturada.

### Task 3: Integrar `getTalentos()` por mescla

**Files:**
- Modify: `site/js/db.js`
- Modify: `tests/talentos-frhof.test.mjs`

- [ ] **Step 1: Adicionar carregador dedicado**

Em `site/js/db.js`, criar:

```js
export async function getTalentosFRHOF() {
  return fetchJSON('talentos/talentos_frhof.json');
}
```

- [ ] **Step 2: Mesclar categorias sem tocar base**

Substituir `getTalentos()` por:

```js
function dedupeTalentosPorNome(talentos) {
  const vistos = new Set();
  return talentos.filter(talento => {
    const chave = (talento.nome_original || talento.nome || '').toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export async function getTalentos() {
  const [base, frhof] = await Promise.all([
    fetchJSON('talentos/talentos.json'),
    getTalentosFRHOF()
  ]);

  const porCategoria = { ...(base?.por_categoria || {}) };
  for (const talento of frhof?.todos || []) {
    const categoria = talento.categoria || 'Outros';
    porCategoria[categoria] = dedupeTalentosPorNome([...(porCategoria[categoria] || []), talento]);
  }

  const todos = dedupeTalentosPorNome([
    ...(base?.todos || []),
    ...(frhof?.todos || [])
  ]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    ...(base || {}),
    total: todos.length,
    por_categoria: porCategoria,
    todos
  };
}
```

- [ ] **Step 3: Testar integração**

Teste com `globalThis.fetch` falso deve exigir que `getTalentos()` carregue `talentos/talentos.json` e `talentos/talentos_frhof.json`, retorne `total === 109`, preserve os 75 talentos-base sem `fonte` e inclua os 34 FRHOF com `fonte.id`.

- [ ] **Step 4: Validar sintaxe**

Run: `node --test tests/talentos-frhof.test.mjs; node --check site/js/db.js`

Expected: mescla aprovada, sintaxe limpa, base intocado.

### Task 4: Integrar seleção, level-up e persistência

**Files:**
- Create: `site/js/talentos-prerequisitos.js`
- Modify: `site/js/levelup-cards.js`
- Modify: `site/js/levelup-ui.js`
- Modify: `site/js/levelup-validations.js`
- Modify: `site/js/levelup.js`
- Modify: `tests/talentos-frhof.test.mjs`

- [ ] **Step 1: Criar avaliador único de pré-requisitos**

Criar `site/js/talentos-prerequisitos.js`. Os pré-requisitos estruturados usam nomes originais em inglês; por isso, o avaliador deve indexar tanto `nome` (rótulo em português) quanto `nome_original` (identificador canônico) das entradas persistidas pelo plano 05:

```js
import { semAcento } from './utils.js';

function normalizarNome(valor) {
  return semAcento(String(valor || '').trim()).toLowerCase();
}

function nomesPersistidosTalento(talento) {
  if (typeof talento === 'string') return [talento];
  return [talento?.nome, talento?.nome_original].filter(Boolean);
}

function temTalento(char, nomesExigidos = []) {
  const talentos = new Set(
    (char?.talentos || [])
      .flatMap(nomesPersistidosTalento)
      .map(normalizarNome)
  );
  return nomesExigidos.some(nome => talentos.has(normalizarNome(nome)));
}

function temArmasMarciais(char) {
  const fontes = [
    ...(char?.proficiencias_armas || []),
    ...(char?.proficienciasExtra || []),
    ...(char?.proficiencias || [])
  ].map(normalizarNome);
  return fontes.some(p => p.includes('armas marciais') || p.includes('arma marcial'));
}

function temConjuracaoOuPacto(char) {
  const classe = normalizarNome(char?.classe);
  const conjuradores = new Set([
    'bardo', 'bruxo', 'clerigo', 'druida', 'feiticeiro', 'guardiao', 'mago', 'paladino'
  ]);
  return Boolean(
    conjuradores.has(classe)
    || char?.conjuracao
    || char?.espacos_magia
    || char?.magia_pacto
    || char?.caracteristicas?.some(c => ['Conjuração', 'Magia de Pacto'].includes(c?.nome || c))
  );
}

function cumpreAlternativa(char, alternativa) {
  if (!alternativa) return true;
  if (alternativa.tipo === 'talento') return temTalento(char, alternativa.nomes || []);
  if (alternativa.tipo === 'proficiencia_armas_marciais') return temArmasMarciais(char);
  if (alternativa.tipo === 'conjuracao_ou_magia_pacto') return temConjuracaoOuPacto(char);
  return false;
}

export function explicarPrerequisitoTalento(char, talento, contexto = 'levelup_asi', nivelAlvo = char?.nivel || 1) {
  const prereq = talento?.mecanica?.prerequisitos || {};
  const permitidos = prereq.contextos_permitidos || [];
  if (permitidos.length > 0 && !permitidos.includes(contexto)) return 'Contexto não permitido para este talento.';
  if (Number.isFinite(prereq.nivel_minimo) && Number(nivelAlvo) < prereq.nivel_minimo) return `Requer nível ${prereq.nivel_minimo} ou superior.`;
  for (const grupo of prereq.talentos || []) {
    if (!temTalento(char, grupo.nomes || [])) return `Requer ${grupo.nomes?.join(' ou ')}.`;
  }
  for (const grupo of prereq.alternativas || []) {
    if (!(grupo.opcoes || []).some(opcao => cumpreAlternativa(char, opcao))) return grupo.mensagem || 'Pré-requisito alternativo não atendido.';
  }
  return '';
}

export function cumprePrerequisitosTalento(char, talento, contexto = 'levelup_asi', nivelAlvo = char?.nivel || 1) {
  return explicarPrerequisitoTalento(char, talento, contexto, nivelAlvo) === '';
}
```

- [ ] **Step 2: Exibir fonte no seletor e detalhes**

Em `renderCardASI()`, filtrar com `cumprePrerequisitosTalento(char, t, 'levelup_asi', nivelNovo)`. Isso remove talentos de Origem do ASI comum, remove Gerais antes do nível 4, remove Dádivas antes do nível 19 e remove cadeias não atendidas. Opções elegíveis mostram `Heróis de Faerûn` via `renderSeloFonte(t.fonte)` ou sufixo textual seguro. Em `mostrarDetalhesTalento()`, exibir selo, categoria, pré-requisito, benefícios e `mecanica.automacao`.

- [ ] **Step 3: Generalizar escolhas por `mecanica.escolhas`**

Em `renderEscolhasTalento()`, antes dos casos especiais legados, ler `talentoData.mecanica.escolhas`. Renderizar `select`, `checkbox` ou lista de magias por `tipo`. Persistir em `state.escolhasTalento` e `state.talentoTipoEscolha`. Manter casos legados de `Habilidoso`, `Artifista`, `Músico`, `Iniciado em Magia`, `Adepto Elemental`, `Tocado Por Fadas`, `Tocado Pelas Sombras`, `Conjurador Ritualista`, `Resiliente`, `Analítico`, `Mente Aguçada`, `Especialista em Perícia` funcionando.

- [ ] **Step 4: Persistir fonte ao escolher talento**

Em `subirDeNivel()`, importar `clonarFonte` de `./fontes.js`. Quando `opcoes.talento` corresponder a um talento FRHOF, gravar entrada como objeto com os dois identificadores; `nome_original` mantém compatibilidade com os pré-requisitos canônicos e `nome` preserva o rótulo da UI:

```js
personagem.talentos.push({
  nome: talentoData.nome,
  nome_original: talentoData.nome_original,
  origem: 'levelup',
  fonte: clonarFonte(talentoData.fonte)
});
```

Personagens legados com talentos string continuam válidos. O objeto concedido pelo antecedente no plano 05 usa o mesmo formato, mas com `origem: 'antecedente'`; o avaliador deve reconhecer ambos.

- [ ] **Step 5: Persistir escolhas e recursos genéricos**

Aplicar `mecanica.asi` com `aplicarDeltaSistema()`. Persistir escolhas em `personagem.talentos_parametros[nome_normalizado]`. Persistir recursos em `personagem.usos_habilidades[nome_recurso] = { total, usados: 0, recupera }`. Adicionar magias concedidas em `magias_conhecidas` ou `magias_preparadas` com `{ nome, circulo, origem: 'talento', fonte }`.

- [ ] **Step 6: Validar level-up e filtros negativos**

Teste deve simular um personagem nível 3→4 escolhendo `Cold Caster`, confirmar ASI +1, talento com `nome`, `nome_original`, `origem: 'levelup'` e fonte clonada, magias/ações registradas conforme JSON e ausência de duplicação. Simular nível 18→19 escolhendo `Boon of Communication`, confirmar categoria épica disponível, ASI, parâmetros e fonte. Simular personagem legado com talento string e confirmar `resolverPassivosTalentos()` sem erro.

Testes negativos obrigatórios:

- `Cult of the Dragon Initiate` não aparece em `levelup_asi`;
- `Cold Caster` não aparece para nível 3;
- `Boon of Bloodshed` não aparece para nível 18;
- `Dragonscarred` não aparece sem `Cult of the Dragon Initiate`;
- `Enclave Magic` não aparece sem `Emerald Enclave Fledgling`;
- `Harper Teamwork` não aparece sem `Harper Agent`;
- `Lordly Resolve` não aparece sem `Lords' Alliance Agent`;
- `Order's Resilience` não aparece sem `Tyro of the Gauntlet`;
- `Purple Dragon Commandant` não aparece sem `Purple Dragon Rook` e sem proficiência marcial;
- `Spellfire Adept` não aparece sem `Spellfire Spark`, sem `Conjuração` e sem `Magia de Pacto`;
- `Spellfire Adept` aparece com `Spellfire Spark`, mesmo sem `Conjuração` ou `Magia de Pacto`;
- `Spellfire Adept` aparece quando `char.talentos` contém `{ nome: 'Centelha de Spellfire', nome_original: 'Spellfire Spark', origem: 'antecedente', fonte: FONTE_FRHOF }`, mesmo sem `Conjuração` ou `Magia de Pacto`;
- `Spellfire Adept` aparece sem `Spellfire Spark` quando personagem tem `Conjuração` ou `Magia de Pacto`;
- `Zhentarim Tactics` não aparece sem `Zhentarim Ruffian`.

Run: `node --test tests/talentos-frhof.test.mjs; node --check site/js/talentos-prerequisitos.js; node --check site/js/levelup-cards.js; node --check site/js/levelup-ui.js; node --check site/js/levelup-validations.js; node --check site/js/levelup.js`

Expected: seleção, persistência, filtros de pré-requisito e sintaxe aprovadas.

### Task 5: Integrar ficha, impressão e passivos automatizáveis

**Files:**
- Modify: `site/js/talentos-effects.js`
- Modify: `site/js/pages/sheet.js`
- Modify: `tests/talentos-frhof.test.mjs`

- [ ] **Step 1: Mapear passivos em `talentos-effects.js`**

Adicionar flags/passivos por nome canônico:

```js
if (nomes.has('Dragonscarred')) {
  passivos.resistenciasExtra.push('tipo_escolhido_dragonscarred');
  passivos.flags.dragonscarred_fearsome_power = true;
}
if (nomes.has('Boon of Desperate Resilience') || nomes.has('Dádiva da Resiliência Desesperada')) {
  passivos.flags.dadiva_resiliencia_desesperada_sangrando = true;
}
if (nomes.has('Boon of Communication') || nomes.has('Dádiva da Comunicação')) {
  passivos.flags.dadiva_comunicacao_telepatia = true;
  passivos.flags.dadiva_comunicacao_idiomas = true;
}
```

Usar os nomes reais escolhidos no JSON final; manter aliases só se `nome` traduzido diferir de `nome_original`.

- [ ] **Step 2: Mostrar fonte e mecânica na ficha**

Em `renderSecaoTalentos()`, talentos objeto mostram `renderSeloFonte(t.fonte)`. Detalhe mostra `mecanica.automacao`, escolhas salvas, recursos restantes e benefícios. Impressão usa o mesmo selo em talentos e lista recursos rastreáveis.

- [ ] **Step 3: Descanso restaura recursos**

No fluxo de descanso longo em `sheet.js`, restaurar `usos_habilidades` cujo `recupera === 'descanso_longo'` e origem seja `talento`. Não restaurar recursos que o JSON marcou como `manual` sem total rastreável.

- [ ] **Step 4: Testar passivos e impressão**

Teste deve confirmar:

- `normalizarTalentos([{ nome: 'Spellfire Spark', fonte: FONTE_FRHOF }])` retorna `['Spellfire Spark']`;
- talentos com fonte renderizam selo na ficha e impressão;
- recursos de talento FRHOF persistem em export/import;
- descanso longo restaura recurso rastreável;
- talentos sem automação continuam exibidos sem alterar CA, PV, deslocamento ou salvaguardas.

Run: `node --test tests/talentos-frhof.test.mjs tests/fontes.test.mjs; node --check site/js/talentos-effects.js; node --check site/js/pages/sheet.js`

Expected: passivos compatíveis, selo preservado, descanso sem regressão.

### Task 6: Fechar validação e estados

**Files:**
- Modify: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`
- Modify: `docs/superpowers/plans/2026-07-21-herois-de-faerun.md`
- Validate: `iniciar_servidor.ps1`

- [ ] **Step 1: Rodar suíte técnica**

Run: `node --test tests/*.test.mjs; node --check site/js/db.js; node --check site/js/talentos-prerequisitos.js; node --check site/js/levelup-cards.js; node --check site/js/levelup-ui.js; node --check site/js/levelup-validations.js; node --check site/js/levelup.js; node --check site/js/talentos-effects.js; node --check site/js/pages/sheet.js; git diff --check`

Expected: testes aprovados, sintaxe válida, whitespace limpo.

- [ ] **Step 2: Validar manualmente**

Run: `pwsh -File iniciar_servidor.ps1`

No app: criar personagem nível 3 e subir ao 4; confirmar que talentos Gerais elegíveis aparecem e talentos Gerais com cadeia faltante não aparecem; escolher talento geral FRHOF; confirmar selo, ASI, escolhas, recursos, ficha, export/import e impressão. Criar personagem nível 18 e subir ao 19; confirmar que Dádivas Épicas aparecem somente no nível 19. Criar personagem nível 1 com antecedente/adição manual de talento de Origem; confirmar selo e passivos. Confirmar que talentos de Origem não aparecem no ASI comum. Abrir personagem legado; confirmar ausência de quebra.

- [ ] **Step 3: Atualizar estados**

Após suíte técnica e validação manual, marcar `Talentos` como `Concluído — validação visual pendente` no README isolado se navegador não foi validado, ou `Concluído` se foi. No plano principal, trocar o escopo 5 para `Implementado — validação visual pendente` ou `Implementado`. Não alterar Antecedentes, Subclasses, Auditoria integrada ou Magia de Círculo. Não criar commit automaticamente.
