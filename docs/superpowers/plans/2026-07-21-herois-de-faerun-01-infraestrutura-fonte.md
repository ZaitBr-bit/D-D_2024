# Heróis de Faerûn — Infraestrutura de Fonte Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar uma identificação única e reutilizável para todo conteúdo de *Heroes of Faerûn* e garantir que ela sobreviva ao fluxo completo do inventário.

**Architecture:** `dados/fontes.json` registra a fonte canônica. `site/js/fontes.js` concentra comparação, clonagem e selo HTML. Os seletores copiam `fonte` para o nível superior do item de inventário. A persistência atual continua serializando o personagem inteiro, sem migração destrutiva. Criador e ficha usam o mesmo helper visual; o selo continua visível na impressão.

**Tech Stack:** JSON, JavaScript ES modules, CSS, Node.js built-in test runner

---

## Contrato deste escopo

Objeto canônico:

```json
{
  "id": "frhof-2025",
  "nome": "Forgotten Realms: Heroes of Faerûn",
  "rotulo": "Heróis de Faerûn",
  "tipo": "expansao",
  "ano": 2025
}
```

Regra de persistência:

```js
{
  nome: 'Nome do conteúdo',
  fonte: {
    id: 'frhof-2025',
    nome: 'Forgotten Realms: Heroes of Faerûn',
    rotulo: 'Heróis de Faerûn',
    tipo: 'expansao',
    ano: 2025
  }
}
```

`fonte` fica no registro de conteúdo e no item selecionado. Não inferir fonte por nome, pasta ou texto de descrição. Registros antigos sem `fonte` continuam válidos e não recebem fonte automaticamente.

### Task 1: Criar a estrutura isolada da expansão

**Files:**
- Create: `Informacoes Separadas/Forgotten Realms - Heróis de Faerûn/README.md`

- [x] **Step 1: Criar o índice da expansão**

Criar o arquivo com este conteúdo:

```markdown
# Forgotten Realms — Heróis de Faerûn

Referência separada do conteúdo mecânico de *Forgotten Realms: Heroes of Faerûn*, compatível com D&D 2024.

## Estado

| Área | Quantidade | Estado |
|---|---:|---|
| Infraestrutura de fonte | 1 | Em implementação |
| Equipamentos regionais mundanos | 12 | Não iniciado |
| Itens mágicos | 3 | Não iniciado |
| Magias | 19 | Não iniciado |
| Talentos | 34 | Não iniciado |
| Antecedentes | 18 | Não iniciado |
| Subclasses | 8 | Não iniciado |
| Auditoria integrada | 1 bateria | Aguardar conteúdos individuais |
| Magia de Círculo | 1 subsistema | Última etapa |

## Estrutura

- `01-opcoes-de-personagem/`: subclasses, antecedentes e talentos.
- `02-magias/`: magias individuais da expansão.
- `03-equipamentos/`: equipamentos regionais e itens mágicos.
- `04-magia-de-circulo/`: subsistema cooperativo, implementado por último.

## Convenções

- Idioma: português brasileiro.
- Regras-base: D&D 2024.
- Identificador obrigatório: `frhof-2025`.
- Selo visual: `Heróis de Faerûn`.
- Medidas no aplicativo: sistema métrico; medida original mantida nos dados para auditoria.
- Todo conteúdo novo registra a fonte; conteúdo-base apenas referenciado não recebe a marca.
- Divindades, facções, Renome, Bastião, regiões e atlas estão fora do escopo.
- Esta pasta é referência humana; o aplicativo consome os JSONs em `dados/`.
```

- [x] **Step 2: Confirmar caminho, UTF-8 e contrato**

Run: `$arquivo = 'Informacoes Separadas\Forgotten Realms - Heróis de Faerûn\README.md'; Test-Path -LiteralPath $arquivo; Select-String -LiteralPath $arquivo -Pattern 'frhof-2025|Magia de Círculo' -Encoding utf8`

Expected: `True`, uma ocorrência de `frhof-2025` e Magia de Círculo identificada como última etapa.

### Task 2: Fixar o contrato da fonte com teste

**Files:**
- Create: `dados/fontes.json`
- Create: `site/js/fontes.js`
- Create: `tests/fontes.test.mjs`

- [x] **Step 1: Escrever o teste que define o contrato**

Criar `tests/fontes.test.mjs` com testes para:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  FONTE_FRHOF,
  clonarFonte,
  ehFonte,
  renderSeloFonte
} from '../site/js/fontes.js';

test('registro e constante frhof-2025 são idênticos', async () => {
  const json = JSON.parse(await readFile(new URL('../dados/fontes.json', import.meta.url), 'utf8'));
  assert.equal(json.fontes.length, 1);
  assert.deepEqual(json.fontes[0], FONTE_FRHOF);
});

test('fonte pode ser consultada sem inferência pelo nome do conteúdo', () => {
  assert.equal(ehFonte({ fonte: FONTE_FRHOF }, 'frhof-2025'), true);
  assert.equal(ehFonte({ fonte: { id: 'phb-2024' } }, 'frhof-2025'), false);
  assert.equal(ehFonte({ nome: 'Heróis de Faerûn' }, 'frhof-2025'), false);
});

test('clonagem preserva o contrato sem compartilhar referência', () => {
  const copia = clonarFonte(FONTE_FRHOF);
  assert.deepEqual(copia, FONTE_FRHOF);
  assert.notEqual(copia, FONTE_FRHOF);
});

test('selo só aparece para conteúdo com fonte conhecida', () => {
  assert.match(renderSeloFonte(FONTE_FRHOF), /class="badge badge-fonte"/);
  assert.match(renderSeloFonte(FONTE_FRHOF), />Heróis de Faerûn</);
  assert.equal(renderSeloFonte(null), '');
  assert.equal(renderSeloFonte({ id: 'phb-2024' }), '');
});
```

- [x] **Step 2: Executar o teste e confirmar a falha inicial**

Run: `node --test tests/fontes.test.mjs`

Expected: falha por ausência de `dados/fontes.json` ou `site/js/fontes.js`.

- [x] **Step 3: Criar o registro canônico**

Criar `dados/fontes.json`:

```json
{
  "fontes": [
    {
      "id": "frhof-2025",
      "nome": "Forgotten Realms: Heroes of Faerûn",
      "rotulo": "Heróis de Faerûn",
      "tipo": "expansao",
      "ano": 2025
    }
  ]
}
```

- [x] **Step 4: Implementar helpers puros de fonte**

Criar `site/js/fontes.js`. O módulo não deve acessar `window` ou `document`, para permanecer testável no Node.

```js
export const FONTE_FRHOF = Object.freeze({
  id: 'frhof-2025',
  nome: 'Forgotten Realms: Heroes of Faerûn',
  rotulo: 'Heróis de Faerûn',
  tipo: 'expansao',
  ano: 2025
});

const FONTES = new Map([[FONTE_FRHOF.id, FONTE_FRHOF]]);
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ESCAPES[caractere]);
}

export function obterIdFonte(valor) {
  if (!valor || typeof valor !== 'object') return '';
  return typeof valor.id === 'string' ? valor.id : valor.fonte?.id || '';
}

export function ehFonte(valor, id) {
  return obterIdFonte(valor) === id;
}

export function clonarFonte(fonte) {
  if (!fonte || typeof fonte !== 'object' || !FONTES.has(fonte.id)) return null;
  return { ...FONTES.get(fonte.id) };
}

export function renderSeloFonte(fonte) {
  const registro = FONTES.get(obterIdFonte(fonte));
  if (!registro) return '';
  return `<span class="badge badge-fonte" title="Fonte: ${escaparHtml(registro.nome)} (${registro.ano})">${escaparHtml(registro.rotulo)}</span>`;
}
```

- [x] **Step 5: Confirmar o teste verde**

Run: `node --test tests/fontes.test.mjs`

Expected: 4 testes aprovados, 0 falhas.

### Task 3: Expor o registro pelo carregador de dados

**Files:**
- Modify: `site/js/db.js`
- Modify: `tests/fontes.test.mjs`

- [x] **Step 1: Acrescentar teste estático para a API de dados**

No teste, ler `site/js/db.js` e exigir as exportações `getFontes` e `getFonte` e o caminho `fontes.json`.

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/fontes.test.mjs`

Expected: falha apenas no novo teste.

- [x] **Step 3: Adicionar API pública em `site/js/db.js`**

Após a seção de origens:

```js
// --- Fontes ---

export async function getFontes() {
  return fetchJSON('fontes.json');
}

export async function getFonte(id) {
  const dados = await getFontes();
  return dados?.fontes?.find(fonte => fonte.id === id) || null;
}
```

- [x] **Step 4: Validar teste e sintaxe**

Run: `node --test tests/fontes.test.mjs; node --check site/js/db.js`

Expected: todos os testes aprovados e nenhuma saída de erro de sintaxe.

### Task 4: Aplicar selo e preservação no criador

**Files:**
- Modify: `site/js/pages/creator.js`
- Modify: `site/css/app.css`
- Modify: `tests/fontes.test.mjs`

- [x] **Step 1: Acrescentar verificações estáticas do criador**

O teste deve exigir em `creator.js`:

- importação de `clonarFonte` e `renderSeloFonte`;
- `fonte: clonarFonte(item.fonte)` ao criar item pelo seletor;
- selo no card do seletor, na linha do inventário e no modal de detalhes.

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/fontes.test.mjs`

Expected: falha nas verificações do criador.

- [x] **Step 3: Importar os helpers**

Em `site/js/pages/creator.js`:

```js
import { clonarFonte, renderSeloFonte } from '../fontes.js';
```

- [x] **Step 4: Preservar a fonte nas duas entradas de equipamento**

Em `adicionarItensEquipamentoInicial`, quando `equipComp` ou `equip` for encontrado, copiar:

```js
fonte: clonarFonte(equipComp.fonte)
```

ou:

```js
fonte: clonarFonte(equip.fonte)
```

Em `mostrarSeletorItem`, incluir no card:

```js
${renderSeloFonte(it.fonte)}
```

Ao adicionar o item selecionado, preservar regra e fonte:

```js
personagem.inventario.push({
  nome: item.nome,
  tipo: 'equipamento',
  quantidade: 1,
  equipado: false,
  descricao: item.descricao || '',
  fonte: clonarFonte(item.fonte),
  dados: {
    peso: item.peso,
    custo: item.custo,
    tipo_uso: item.tipo_uso || '',
    descricao: item.descricao || '',
    categoria: item.categoria || '',
    catalogo: item.catalogo || ''
  }
});
```

- [x] **Step 5: Mostrar o selo na lista e nos detalhes**

Em `renderItemInventario`, adicionar `renderSeloFonte(item.fonte)` ao lado do nome. Em `mostrarDetalheItem`, adicionar o selo no início do corpo do modal. Escapar dados do item com os helpers já usados pelo arquivo; o selo não substitui `escHtml` nos demais campos.

- [x] **Step 6: Criar estilo imprimível**

Em `site/css/app.css`, junto das badges:

```css
.badge-fonte {
  background: #e8ddc2;
  border: 1px solid #9a7b3f;
  color: #4d3714;
  font-size: 0.62rem;
  font-weight: 700;
  margin-left: 0.3rem;
  white-space: nowrap;
}
```

Não adicionar `no-print`. Dentro de `@media print`, garantir contraste:

```css
.badge-fonte {
  background: transparent !important;
  border-color: #555 !important;
  color: #222 !important;
}
```

- [x] **Step 7: Validar**

Run: `node --test tests/fontes.test.mjs; node --check site/js/pages/creator.js`

Expected: testes aprovados e sintaxe válida.

### Task 5: Aplicar selo e preservação na ficha

**Files:**
- Modify: `site/js/pages/sheet.js`
- Modify: `tests/fontes.test.mjs`

- [x] **Step 1: Acrescentar verificações estáticas da ficha**

Exigir importação dos helpers, clonagem no novo item e três usos do selo: seletor, inventário e detalhes.

- [x] **Step 2: Executar e confirmar a falha**

Run: `node --test tests/fontes.test.mjs`

Expected: falha nas verificações da ficha.

- [x] **Step 3: Importar os helpers**

```js
import { clonarFonte, renderSeloFonte } from '../fontes.js';
```

- [x] **Step 4: Separar fonte dos dados do item no seletor**

Nos mapeamentos de `consumiveis`, `municao` e `equipamento`, acrescentar `fonte: i.fonte`. Ao montar `novoItem`:

```js
const novoItem = {
  nome: item.nome,
  tipo: item.tipo,
  quantidade: quantidadeSelecionada,
  equipado: false,
  descricao: item.tipo === 'arma' ? `${item.dados.dano}` : item.tipo === 'armadura' ? `CA: ${item.dados.ca}` : '',
  fonte: clonarFonte(item.fonte),
  dados: { ...item.dados }
};
```

Ao agrupar item existente, exigir também `inv.fonte?.id === item.fonte?.id`; dois conteúdos homônimos de fontes diferentes não podem ser fundidos.

- [x] **Step 5: Exibir o selo em todos os pontos**

- `renderCategoria`: junto a `it.nome`.
- `renderSheetInvItem`: junto a `item.nome`; esta marcação também atende a impressão.
- `mostrarDetalheItemSheet`: no início do modal.

- [x] **Step 6: Validar**

Run: `node --test tests/fontes.test.mjs; node --check site/js/pages/sheet.js`

Expected: testes aprovados e sintaxe válida.

### Task 6: Provar persistência e documentar o schema

**Files:**
- Modify: `tests/fontes.test.mjs`
- Modify: `README.md`

- [x] **Step 1: Adicionar teste de ida e volta JSON**

Criar um personagem mínimo com item marcado, executar `JSON.stringify` e `JSON.parse`, e verificar `restaurado.inventario[0].fonte.id === 'frhof-2025'`. O teste documenta por que salvar, exportar e importar preservam a fonte: `store.js` serializa o objeto completo e sua validação mínima não remove campos.

- [x] **Step 2: Documentar `fonte` no README**

Na seção “Item de inventário”, acrescentar `fonte?: { id, nome, rotulo, tipo, ano }`. Na seção de carregamento de dados, registrar `dados/fontes.json`, `getFontes()` e `getFonte(id)`. Explicar que conteúdo sem `fonte` é conteúdo-base ou legado e permanece compatível.

- [x] **Step 3: Executar a bateria final do escopo**

Run: `node --test tests/fontes.test.mjs; node --check site/js/fontes.js; node --check site/js/db.js; node --check site/js/pages/creator.js; node --check site/js/pages/sheet.js; git diff --check`

Expected: todos os testes aprovados, nenhuma falha de sintaxe e nenhum erro de whitespace.

- [ ] **Step 4: Verificação manual no navegador**

Run: `pwsh -File iniciar_servidor.ps1`

Expected:

- personagem antigo abre sem selo e sem erro;
- fixture temporária com `fonte.id = "frhof-2025"` mostra `Heróis de Faerûn` no seletor, inventário, detalhe e impressão;
- exportar e reimportar mantém `inventario[].fonte.id`;
- remover a fixture temporária antes de encerrar a tarefa;
- nenhum commit criado.
