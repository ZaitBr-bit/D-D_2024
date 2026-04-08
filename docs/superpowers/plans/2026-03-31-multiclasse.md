# Multiclasse - Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que personagens adquiram níveis em múltiplas classes durante o level-up, seguindo as regras de multiclasse do D&D 5.5 (2024).

**Arquitetura:** Um flag `multiclasse_habilitado` (boolean) no personagem controla se as mecânicas de multiclasse estão ativas. O flag é definido durante a criação (step de seleção de classe) e pode ser alterado na sheet. Quando habilitado, o personagem usa `classes: [{nome, nivel}]` e o level-up ganha um step para escolher em qual classe subir. Quando desabilitado, tudo funciona como atualmente (classe única). Os espaços de magia são calculados pela tabela de Conjurador Multiclasse quando há mais de uma classe conjuradora.

**Tech Stack:** Vanilla JavaScript ES6 modules, JSON data files, localStorage/Firestore persistence.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `site/js/multiclasse.js` | **Criar** | Regras de multiclasse: pré-requisitos, proficiências, tabela de espaços, cálculo de nível conjurador |
| `site/js/dados-classes.js` | **Modificar** | Adicionar dados de proficiências de multiclasse por classe |
| `site/js/levelup.js` | **Modificar** | `subirDeNivel()` aceita `opcoes.classe_levelup` para indicar em qual classe subir |
| `site/js/levelup-flow.js` | **Modificar** | Step "escolha de classe" no início do fluxo; contexto dinâmico baseado na classe escolhida |
| `site/js/levelup-cards.js` | **Modificar** | Card de seleção de classe para multiclasse |
| `site/js/levelup-ui.js` | **Modificar** | Integrar novo step na navegação |
| `site/js/levelup-validations.js` | **Modificar** | Validar pré-requisitos de multiclasse |
| `site/js/utils.js` | **Modificar** | Helper `getNivelTotalPersonagem()`, `getNivelClasse()`, `getClassePrincipal()` |
| `site/js/pages/sheet.js` | **Modificar** | Exibir múltiplas classes, recursos por classe, espaços de magia combinados |
| `site/js/pages/creator.js` | **Modificar** | Salvar personagem no formato novo `classes: [...]` |
| `site/js/store.js` | **Modificar** | Migração de dados: personagens antigos ganham `classes` array |
| `site/js/db.js` | **Nenhuma** | Já carrega dados de classe individualmente |

---

## Task 1: Migração do Modelo de Dados

**Files:**
- Modify: `site/js/store.js`
- Modify: `site/js/utils.js`

O personagem atual tem `classe: "Guerreiro", nivel: 5`. O novo modelo adiciona:
- `multiclasse_habilitado: boolean` — flag que controla se multiclasse está ativo
- `classes: [{nome, nivel, subclasse}]` — array das classes (sempre preenchido, mas só usado de verdade quando flag é `true`)

- [ ] **Step 1: Adicionar campo `multiclasse_habilitado` ao personagem vazio em `store.js`**

Em `criarPersonagemVazio()`, adicionar após `escolhas_classe: {}`:

```javascript
    multiclasse_habilitado: false,
    classes: [],
```

- [ ] **Step 2: Criar função de migração em `store.js`**

Adicionar ao final do arquivo, antes do último export:

```javascript
/**
 * Migra personagem do formato antigo (classe única) para o novo (multiclasse).
 * Idempotente: se já tem 'classes', não faz nada.
 */
export function migrarParaMulticlasse(personagem) {
  if (personagem.classes && personagem.classes.length > 0) return personagem;
  
  // Personagens antigos não tinham multiclasse
  if (personagem.multiclasse_habilitado === undefined) {
    personagem.multiclasse_habilitado = false;
  }
  
  if (personagem.classe) {
    personagem.classes = [{
      nome: personagem.classe,
      nivel: personagem.nivel || 1,
      subclasse: personagem.subclasse || null
    }];
  }
  
  return personagem;
}
```

- [ ] **Step 3: Integrar migração no `getPersonagem()`**

Em `store.js`, modificar `getPersonagem` para migrar automaticamente:

```javascript
export function getPersonagem(id) {
  const p = listarPersonagens().find(p => p.id === id) || null;
  if (p) migrarParaMulticlasse(p);
  return p;
}
```

- [ ] **Step 4: Criar helpers de nível em `utils.js`**

Adicionar ao final de `utils.js`:

```javascript
/**
 * Retorna o nível total do personagem (soma de todas as classes).
 */
export function getNivelTotal(personagem) {
  if (personagem.classes && personagem.classes.length > 0) {
    return personagem.classes.reduce((sum, c) => sum + c.nivel, 0);
  }
  return personagem.nivel || 1;
}

/**
 * Retorna o nível do personagem em uma classe específica (0 se não possui).
 */
export function getNivelClasse(personagem, nomeClasse) {
  if (personagem.classes) {
    const c = personagem.classes.find(c => c.nome === nomeClasse);
    return c ? c.nivel : 0;
  }
  return personagem.classe === nomeClasse ? (personagem.nivel || 1) : 0;
}

/**
 * Retorna o nome da classe principal (primeira classe adquirida).
 */
export function getClassePrincipal(personagem) {
  if (personagem.classes && personagem.classes.length > 0) {
    return personagem.classes[0].nome;
  }
  return personagem.classe;
}

/**
 * Verifica se o personagem é multiclasse (flag habilitado E possui mais de uma classe).
 */
export function ehMulticlasse(personagem) {
  return !!personagem.multiclasse_habilitado && personagem.classes && personagem.classes.length > 1;
}

/**
 * Retorna a subclasse de uma classe específica do personagem.
 */
export function getSubclasseDeClasse(personagem, nomeClasse) {
  if (personagem.classes) {
    const c = personagem.classes.find(c => c.nome === nomeClasse);
    return c ? c.subclasse : null;
  }
  return personagem.classe === nomeClasse ? personagem.subclasse : null;
}

/**
 * Retorna string de exibição das classes. Ex: "Guerreiro 5 / Mago 3"
 */
export function formatarClasses(personagem) {
  if (personagem.multiclasse_habilitado && personagem.classes && personagem.classes.length > 1) {
    return personagem.classes.map(c => `${c.nome} ${c.nivel}`).join(' / ');
  }
  return personagem.classe || '';
}
```

- [ ] **Step 5: Manter sincronia entre `classes[]` e campos legados**

Adicionar helper em `utils.js`:

```javascript
/**
 * Sincroniza campos legados (classe, subclasse, nivel) a partir do array classes.
 * Chamar após qualquer modificação no array classes.
 */
export function sincronizarCamposLegados(personagem) {
  if (!personagem.classes || personagem.classes.length === 0) return;
  
  // classe = classe principal (primeira)
  personagem.classe = personagem.classes[0].nome;
  // subclasse = subclasse da classe principal
  personagem.subclasse = personagem.classes[0].subclasse || null;
  // nivel = nível total
  personagem.nivel = personagem.classes.reduce((sum, c) => sum + c.nivel, 0);
}
```


---

## Task 2: Regras de Multiclasse (módulo central)

**Files:**
- Create: `site/js/multiclasse.js`
- Modify: `site/js/dados-classes.js`

- [ ] **Step 1: Adicionar dados de proficiências de multiclasse em `dados-classes.js`**

Adicionar ao final do arquivo:

```javascript
/**
 * Proficiências adquiridas ao multiclassear PARA cada classe.
 * Ou seja, o que se ganha ao pegar o primeiro nível numa nova classe (não a classe inicial).
 * Referência: Capítulo 3 do Livro do Jogador 2024 — seção "Como um Personagem Multiclasse".
 */
export const MULTICLASSE_PROFICIENCIAS = {
  "Bárbaro": {
    armas: ["Marcial"],
    armaduras: ["Escudo"],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Bardo": {
    armas: [],
    armaduras: ["Leve"],
    pericias: 1,
    pericias_opcoes: null, // qualquer perícia
    ferramentas: ["Instrumento Musical"]
  },
  "Bruxo": {
    armas: [],
    armaduras: ["Leve"],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Clérigo": {
    armas: [],
    armaduras: ["Leve", "Média", "Escudo"],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Druida": {
    armas: [],
    armaduras: ["Leve", "Escudo"],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Feiticeiro": {
    armas: [],
    armaduras: [],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Guardião": {
    armas: ["Marcial"],
    armaduras: ["Leve", "Média", "Escudo"],
    pericias: 1,
    pericias_opcoes: ["Lidar com Animais", "Atletismo", "Furtividade", "Intuição", "Investigação", "Natureza", "Percepção", "Sobrevivência"],
    ferramentas: []
  },
  "Guerreiro": {
    armas: ["Marcial"],
    armaduras: ["Leve", "Média", "Escudo"],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Ladino": {
    armas: [],
    armaduras: ["Leve"],
    pericias: 1,
    pericias_opcoes: ["Acrobacia", "Atletismo", "Enganação", "Furtividade", "Intimidação", "Intuição", "Investigação", "Percepção", "Persuasão", "Prestidigitação"],
    ferramentas: ["Ferramentas de Ladrão"]
  },
  "Mago": {
    armas: [],
    armaduras: [],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Monge": {
    armas: [],
    armaduras: [],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  },
  "Paladino": {
    armas: ["Marcial"],
    armaduras: ["Leve", "Média", "Escudo"],
    pericias: 0,
    pericias_opcoes: null,
    ferramentas: []
  }
};
```

- [ ] **Step 2: Criar `site/js/multiclasse.js` com as regras centrais**

```javascript
// ============================================================
// Regras de Multiclasse — D&D 5.5 (2024)
// ============================================================
import { CLASSES_INFO, MULTICLASSE_PROFICIENCIAS, ATRIBUTO_NOME_PARA_KEY } from './dados-classes.js';
import { calcMod, getNivelTotal, getNivelClasse } from './utils.js';

/**
 * Tabela de espaços de magia do Conjurador Multiclasse.
 * Índice = nível de conjurador combinado (1–20).
 * Valor = espaços por círculo { 1: total, 2: total, ... }
 */
const TABELA_CONJURADOR_MULTICLASSE = {
  1:  { 1: 2 },
  2:  { 1: 3 },
  3:  { 1: 4, 2: 2 },
  4:  { 1: 4, 2: 3 },
  5:  { 1: 4, 2: 3, 3: 2 },
  6:  { 1: 4, 2: 3, 3: 3 },
  7:  { 1: 4, 2: 3, 3: 3, 4: 1 },
  8:  { 1: 4, 2: 3, 3: 3, 4: 2 },
  9:  { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }
};

/**
 * Classificação de conjurador para cálculo de multiclasse.
 * "completo" = nível inteiro (Bardo, Clérigo, Druida, Feiticeiro, Mago)
 * "meio" = metade do nível arredondada para cima (Guardião, Paladino)
 * "terco" = um terço do nível arredondado para baixo (Cavaleiro Místico, Trapaceiro Arcano)
 * null = não conjurador
 */
const TIPO_CONJURADOR = {
  "Bardo": "completo",
  "Clérigo": "completo",
  "Druida": "completo",
  "Feiticeiro": "completo",
  "Mago": "completo",
  "Guardião": "meio",
  "Paladino": "meio",
  "Bárbaro": null,
  "Guerreiro": null,   // Cavaleiro Místico tratado pela subclasse
  "Ladino": null,       // Trapaceiro Arcano tratado pela subclasse
  "Monge": null,
  "Bruxo": null         // Magia de Pacto é separada
};

/**
 * Subclasses que concedem conjuração de 1/3.
 */
const SUBCLASSES_CONJURADORAS_TERCO = ["Cavaleiro Místico", "Trapaceiro Arcano"];

/**
 * Verifica se o personagem atende os pré-requisitos para multiclassear para uma nova classe.
 * Regra: precisa ter 13+ no atributo primário de TODAS as classes atuais E da classe alvo.
 * @param {Object} personagem
 * @param {string} classeAlvo - Nome da classe que deseja adquirir
 * @returns {{ permitido: boolean, motivos: string[] }}
 */
export function verificarPreRequisitosMulticlasse(personagem, classeAlvo) {
  const motivos = [];
  const atributos = personagem.atributos;
  
  // Verificar atributos de todas as classes atuais
  const classesParaVerificar = [
    ...(personagem.classes || []).map(c => c.nome),
    classeAlvo
  ];
  
  // Remover duplicatas (caso já tenha a classe)
  const classesUnicas = [...new Set(classesParaVerificar)];
  
  for (const classe of classesUnicas) {
    const info = CLASSES_INFO[classe];
    if (!info) continue;
    
    const primario = info.atributo_primario;
    // Atributos compostos como "Força ou Destreza" = precisa de 13 em um deles
    // Atributos compostos como "Destreza e Sabedoria" = precisa de 13 em ambos
    if (primario.includes(' ou ')) {
      const opcoes = primario.split(' ou ').map(s => s.trim());
      const atendeBool = opcoes.some(attr => {
        const chave = ATRIBUTO_NOME_PARA_KEY[attr];
        return chave && (atributos[chave] || 10) >= 13;
      });
      if (!atendeBool) {
        motivos.push(`${classe} exige ${primario} 13+ (você tem ${opcoes.map(a => {
          const ch = ATRIBUTO_NOME_PARA_KEY[a];
          return `${a} ${ch ? atributos[ch] : '?'}`;
        }).join(', ')})`);
      }
    } else if (primario.includes(' e ')) {
      const obrigatorios = primario.split(' e ').map(s => s.trim());
      for (const attr of obrigatorios) {
        const chave = ATRIBUTO_NOME_PARA_KEY[attr];
        if (chave && (atributos[chave] || 10) < 13) {
          motivos.push(`${classe} exige ${attr} 13+ (você tem ${atributos[chave]})`);
        }
      }
    } else {
      const chave = ATRIBUTO_NOME_PARA_KEY[primario];
      if (chave && (atributos[chave] || 10) < 13) {
        motivos.push(`${classe} exige ${primario} 13+ (você tem ${atributos[chave]})`);
      }
    }
  }
  
  return { permitido: motivos.length === 0, motivos };
}

/**
 * Retorna a lista de classes disponíveis para multiclasse (excluindo as que já possui).
 * @param {Object} personagem
 * @returns {Array<{nome: string, permitido: boolean, motivos: string[]}>}
 */
export function listarClassesMulticlasseDisponiveis(personagem) {
  const classesAtuais = (personagem.classes || []).map(c => c.nome);
  const todasClasses = Object.keys(CLASSES_INFO);
  
  return todasClasses
    .filter(nome => !classesAtuais.includes(nome))
    .map(nome => {
      const resultado = verificarPreRequisitosMulticlasse(personagem, nome);
      return { nome, ...resultado };
    });
}

/**
 * Retorna as proficiências ganhas ao multiclassear PARA uma classe.
 * @param {string} nomeClasse
 * @returns {Object} proficiências adquiridas
 */
export function getProficienciasMulticlasse(nomeClasse) {
  return MULTICLASSE_PROFICIENCIAS[nomeClasse] || null;
}

/**
 * Calcula o nível total de conjurador combinando todas as classes.
 * Regra D&D 5.5 (2024):
 * - Bardo, Clérigo, Druida, Feiticeiro, Mago: nível inteiro
 * - Guardião, Paladino: metade (arredonda para cima)
 * - Cavaleiro Místico, Trapaceiro Arcano: 1/3 (arredonda para baixo)
 * - Bruxo: NÃO conta (Magia de Pacto é separada)
 * @param {Object} personagem
 * @returns {number} nível de conjurador combinado
 */
export function calcularNivelConjuradorCombinado(personagem) {
  if (!personagem.classes) return 0;
  
  let nivelTotal = 0;
  
  for (const classe of personagem.classes) {
    const tipo = TIPO_CONJURADOR[classe.nome];
    
    if (tipo === "completo") {
      nivelTotal += classe.nivel;
    } else if (tipo === "meio") {
      nivelTotal += Math.ceil(classe.nivel / 2);
    } else if (tipo === null) {
      // Verificar subclasses conjuradoras (1/3)
      if (SUBCLASSES_CONJURADORAS_TERCO.includes(classe.subclasse)) {
        nivelTotal += Math.floor(classe.nivel / 3);
      }
    }
    // Bruxo não contribui (Magia de Pacto separada)
  }
  
  return nivelTotal;
}

/**
 * Verifica se o personagem possui mais de uma classe com a característica Conjuração.
 * Bruxo (Magia de Pacto) NÃO conta como Conjuração para esta verificação.
 * @param {Object} personagem
 * @returns {boolean}
 */
export function possuiMultiplasClassesConjuradoras(personagem) {
  if (!personagem.multiclasse_habilitado || !personagem.classes) return false;
  
  let count = 0;
  for (const classe of personagem.classes) {
    const tipo = TIPO_CONJURADOR[classe.nome];
    if (tipo !== null) {
      count++;
    } else if (SUBCLASSES_CONJURADORAS_TERCO.includes(classe.subclasse)) {
      count++;
    }
  }
  return count > 1;
}

/**
 * Retorna os espaços de magia do conjurador multiclasse.
 * Usa a tabela de Conjurador Multiclasse do D&D 5.5.
 * Se o personagem tem apenas uma classe conjuradora, retorna null (usar tabela da classe).
 * @param {Object} personagem
 * @returns {Object|null} { circulo: total } ou null
 */
export function getEspacosMagiaMulticlasse(personagem) {
  if (!possuiMultiplasClassesConjuradoras(personagem)) return null;
  
  const nivelConj = calcularNivelConjuradorCombinado(personagem);
  if (nivelConj <= 0) return null;
  
  const nivelClamped = Math.min(20, nivelConj);
  const tabela = TABELA_CONJURADOR_MULTICLASSE[nivelClamped];
  if (!tabela) return null;
  
  // Converter para formato esperado: { circulo: { total, usados } }
  const espacos = {};
  for (const [circulo, total] of Object.entries(tabela)) {
    espacos[circulo] = { total, usados: 0 };
  }
  return espacos;
}

/**
 * Retorna o número máximo de dados de vida de cada tipo que o personagem possui.
 * Ex: { 10: 5, 8: 3 } para Guerreiro 5 / Clérigo 3
 * @param {Object} personagem
 * @returns {Object} { dado_vida: quantidade }
 */
export function getDadosDeVidaMulticlasse(personagem) {
  const dados = {};
  if (!personagem.classes) {
    const info = CLASSES_INFO[personagem.classe];
    if (info) dados[info.dado_vida] = personagem.nivel || 1;
    return dados;
  }
  
  for (const classe of personagem.classes) {
    const info = CLASSES_INFO[classe.nome];
    if (!info) continue;
    const dv = info.dado_vida;
    dados[dv] = (dados[dv] || 0) + classe.nivel;
  }
  return dados;
}
```

---

## Task 3: Flag de Multiclasse na Criação de Personagem

**Files:**
- Modify: `site/js/pages/creator.js`

O step 1 do creator (seleção de classe) ganha um toggle "Habilitar Multiclasse". Ao finalizar, o personagem é salvo com `multiclasse_habilitado` e o array `classes: [...]`.

- [ ] **Step 1: Adicionar toggle de multiclasse em `renderStepClasse`**

Em `creator.js`, na função `renderStepClasse(el)` (~linha 994), adicionar o toggle ANTES do grid de classes. Localizar o `el.innerHTML = \`` e inserir o toggle:

```javascript
el.innerHTML = `
    <h3 style="margin-bottom:12px">Escolha sua Classe</h3>
    <div class="multiclasse-toggle" style="margin-bottom:16px;padding:10px 14px;background:var(--bg-card,#1a1a2e);border-radius:8px;display:flex;align-items:center;gap:10px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:0.95rem">
        <input type="checkbox" id="chk-multiclasse" ${personagem.multiclasse_habilitado ? 'checked' : ''}
               style="width:18px;height:18px;accent-color:var(--cor-accent,#6c63ff)">
        <span>Habilitar Multiclasse</span>
      </label>
      <span style="font-size:0.8rem;color:var(--cor-texto-sec,#888)">
        Permite adquirir níveis em múltiplas classes ao subir de nível.
      </span>
    </div>
    <div class="selection-grid" id="grid-classes">
      ${/* ... grid de classes existente ... */''}
    </div>
    ${resumoHtml}
  `;
```

- [ ] **Step 2: Bind do toggle de multiclasse**

Após o `el.innerHTML`, adicionar evento para o checkbox:

```javascript
// Bind do toggle de multiclasse
document.getElementById('chk-multiclasse')?.addEventListener('change', (e) => {
  personagem.multiclasse_habilitado = e.target.checked;
});
```

- [ ] **Step 3: Salvar `classes[]` na função `finalizar()`**

Em `creator.js`, na função `finalizar()` (~linha 827), antes do `salvarPersonagem(personagem)` (~linha 986), adicionar:

```javascript
// Montar array de classes para suporte a multiclasse
personagem.classes = [{
  nome: personagem.classe,
  nivel: 1,
  subclasse: personagem.subclasse || null
}];
```

---

## Task 4: Adaptar Level-Up — Escolha de Classe

**Files:**
- Modify: `site/js/levelup-flow.js`
- Modify: `site/js/levelup-cards.js`
- Modify: `site/js/levelup-ui.js`

O fluxo de level-up precisa de um step "Escolha de Classe" no início, **somente quando `personagem.multiclasse_habilitado === true`**. Quando o flag é `false`, o fluxo permanece idêntico ao atual.

- [ ] **Step 1: Adicionar step de escolha de classe em `levelup-flow.js`**

Em `STEP_DEFINITIONS` (ou onde os steps são definidos), adicionar como PRIMEIRO step:

```javascript
{
  id: 'escolha_classe',
  label: 'Escolha de Classe',
  visivel: (ctx) => ctx.multiclasseHabilitado && ctx.nivelTotal < 20,
  obrigatorio: true
}
```

Modificar `buildLevelUpContext` para receber e usar a classe escolhida para o level-up. Adicionar ao contexto:

```javascript
// No início de buildLevelUpContext, após determinar nivelNovo:
const multiclasseHabilitado = !!char.multiclasse_habilitado;
const nivelTotal = getNivelTotal(char);
const classesAtuais = char.classes || [{ nome: char.classe, nivel: char.nivel || 1, subclasse: char.subclasse }];

// A classe para level-up vem do state (escolhida pelo jogador)
// Se multiclasse desabilitado, sempre avança na classe atual
const classeParaLevelUp = multiclasseHabilitado
  ? (helpers.classeEscolhida || classesAtuais[0].nome)
  : classesAtuais[0].nome;
const nivelNaClasseAtual = getNivelClasse(char, classeParaLevelUp);
const nivelNaClasseNovo = nivelNaClasseAtual + 1;
const ehNovaClasse = nivelNaClasseAtual === 0;

// Usar classeParaLevelUp em vez de char.classe para todas as verificações de features
```

- [ ] **Step 2: Criar card de escolha de classe em `levelup-cards.js`**

Adicionar nova função exportada:

```javascript
/**
 * Renderiza o card de seleção de classe para level-up.
 * Mostra opção de avançar na(s) classe(s) atual(is) ou adquirir nova classe.
 */
export function renderCardEscolhaClasse(ctx, state) {
  const classesAtuais = ctx.classesAtuais || [];
  const classesDisponiveis = ctx.classesMulticlasseDisponiveis || [];
  const selecionada = state.classe_levelup || classesAtuais[0]?.nome || '';
  
  let html = `<div class="levelup-card escolha-classe">`;
  html += `<h3>Em qual classe deseja avançar?</h3>`;
  
  // Seção: Classes atuais
  html += `<div class="secao-classes-atuais">`;
  html += `<h4>Classes Atuais</h4>`;
  html += `<div class="grid-classes">`;
  for (const classe of classesAtuais) {
    const checked = selecionada === classe.nome ? 'checked' : '';
    html += `
      <label class="classe-opcao ${checked ? 'selecionada' : ''}">
        <input type="radio" name="classe_levelup" value="${classe.nome}" ${checked}>
        <span class="classe-nome">${classe.nome}</span>
        <span class="classe-nivel">Nível ${classe.nivel} → ${classe.nivel + 1}</span>
      </label>`;
  }
  html += `</div></div>`;
  
  // Seção: Novas classes (multiclasse)
  if (classesDisponiveis.length > 0) {
    html += `<div class="secao-novas-classes">`;
    html += `<h4>Multiclasse — Nova Classe</h4>`;
    html += `<div class="grid-classes">`;
    for (const classe of classesDisponiveis) {
      const checked = selecionada === classe.nome ? 'checked' : '';
      const disabled = !classe.permitido ? 'disabled' : '';
      html += `
        <label class="classe-opcao ${checked ? 'selecionada' : ''} ${disabled ? 'bloqueada' : ''}">
          <input type="radio" name="classe_levelup" value="${classe.nome}" ${checked} ${disabled}>
          <span class="classe-nome">${classe.nome}</span>
          <span class="classe-nivel">Novo — Nível 1</span>
          ${!classe.permitido ? `<span class="classe-motivo">${classe.motivos.join('; ')}</span>` : ''}
        </label>`;
    }
    html += `</div></div>`;
  }
  
  html += `</div>`;
  return html;
}
```

- [ ] **Step 3: Integrar step na UI em `levelup-ui.js`**

Onde os steps são renderizados (ex: `renderizarModalPrincipal`), adicionar tratamento do novo step `escolha_classe`:

```javascript
// No switch/if que renderiza o card do step atual:
case 'escolha_classe':
  cardHtml = renderCardEscolhaClasse(ctx, state);
  break;
```

Ao mudar a classe escolhida, reconstruir o contexto com a nova classe. Adicionar binding de evento:

```javascript
// Dentro de bindEventosStep() para 'escolha_classe':
container.querySelectorAll('input[name="classe_levelup"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    state.classe_levelup = e.target.value;
    // Reconstruir contexto com a classe escolhida
    reconstruirContexto(state.classe_levelup);
  });
});
```

- [ ] **Step 4: Modificar `buildLevelUpContext` para usar classe dinâmica**

Em `levelup-flow.js`, o contexto deve ser construído com base na classe escolhida, não `char.classe` fixo. Principais mudanças:

```javascript
// Substituir todas as referências a char.classe dentro de buildLevelUpContext por classeParaLevelUp
// Substituir char.subclasse por getSubclasseDeClasse(char, classeParaLevelUp)
// Substituir novoNivel por nivelNaClasseNovo
// O bônus de proficiência usa nivelTotal (não nível da classe)

// Adicionar ao ctx retornado:
ctx.multiclasseHabilitado = multiclasseHabilitado;
ctx.classeParaLevelUp = classeParaLevelUp;
ctx.ehNovaClasse = ehNovaClasse;
ctx.nivelTotal = nivelTotal;
ctx.nivelTotalNovo = nivelTotal + 1;
ctx.nivelNaClasse = nivelNaClasseAtual;
ctx.nivelNaClasseNovo = nivelNaClasseNovo;
ctx.classesAtuais = classesAtuais;
ctx.classesMulticlasseDisponiveis = multiclasseHabilitado ? classesDisponiveis : [];
```

---

## Task 5: Adaptar `subirDeNivel` para Multiclasse

**Files:**
- Modify: `site/js/levelup.js`

A função `subirDeNivel` precisa atualizar o array `classes[]` em vez de apenas incrementar `nivel`. Se `multiclasse_habilitado` é `false`, o comportamento é idêntico ao atual.

- [ ] **Step 1: Modificar `subirDeNivel` para aceitar `opcoes.classe_levelup`**

No início da função, após validação de XP:

```javascript
// Determinar em qual classe subir
// Se multiclasse desabilitado, sempre avança na classe atual
const classeParaLevelUp = personagem.multiclasse_habilitado
  ? (opcoes.classe_levelup || personagem.classe)
  : personagem.classe;
const ehNovaClasse = personagem.multiclasse_habilitado
  && !personagem.classes?.some(c => c.nome === classeParaLevelUp);

// Garantir que o personagem tem o array classes
if (!personagem.classes || personagem.classes.length === 0) {
  personagem.classes = [{
    nome: personagem.classe,
    nivel: personagem.nivel || 1,
    subclasse: personagem.subclasse || null
  }];
}
```

- [ ] **Step 2: Modificar atualização de nível**

Substituir o bloco `personagem.nivel = novoNivel;` por:

```javascript
if (ehNovaClasse) {
  // Adicionar nova classe ao array
  personagem.classes.push({
    nome: classeParaLevelUp,
    nivel: 1,
    subclasse: null
  });
} else {
  // Incrementar nível da classe existente
  const classeEntry = personagem.classes.find(c => c.nome === classeParaLevelUp);
  classeEntry.nivel += 1;
}

// Sincronizar campos legados
sincronizarCamposLegados(personagem);
const novoNivel = personagem.nivel; // Nível total atualizado
```

- [ ] **Step 3: Usar nível da classe (não total) para features**

Substituir referências ao nível para features de classe. O nível na classe específica determina features, subclasse, ASI, etc.:

```javascript
// O nível NA CLASSE (não total) para verificar features
const nivelNaClasse = personagem.classes.find(c => c.nome === classeParaLevelUp).nivel;

// Usar nivelNaClasse para:
// - obterCaracteristicasNivel(classeParaLevelUp, nivelNaClasse)
// - concedeAumentoAtributo(classeParaLevelUp, nivelNaClasse)
// - exigeSubclasse(classeParaLevelUp, nivelNaClasse)
// - etc.

// Usar novoNivel (total) para:
// - bonusProficiencia(novoNivel)
// - dados_vida_total = novoNivel
```

- [ ] **Step 4: Adaptar cálculo de HP para multiclasse**

O dado de vida para HP depende da classe em que está subindo, não da classe principal:

```javascript
// Usar classeParaLevelUp para calcular HP
const hpGanho = calcularHPGanhoComOpcao(classeParaLevelUp, modConAntes, opcoes);
```

- [ ] **Step 5: Aplicar subclasse na classe correta**

Quando o jogador escolhe subclasse, aplicar na entrada correta do array `classes`:

```javascript
if (precisaSubclasse && opcoes.subclasse) {
  const classeEntry = personagem.classes.find(c => c.nome === classeParaLevelUp);
  classeEntry.subclasse = opcoes.subclasse;
  // Manter legado sincronizado
  sincronizarCamposLegados(personagem);
}
```

- [ ] **Step 6: Aplicar proficiências de multiclasse para nova classe**

Quando é nova classe, aplicar proficiências parciais (não as completas de nível 1):

```javascript
import { getProficienciasMulticlasse } from './multiclasse.js';

if (ehNovaClasse) {
  const profMulti = getProficienciasMulticlasse(classeParaLevelUp);
  if (profMulti) {
    // Aplicar proficiências de perícia (se há escolha, retornar pendência)
    if (profMulti.pericias > 0 && !opcoes.pericias_multiclasse) {
      return {
        sucesso: false,
        pendente: true,
        tipo_pendencia: 'pericias_multiclasse',
        mensagem: `Escolha ${profMulti.pericias} perícia(s) ao adquirir ${classeParaLevelUp}`
      };
    }
    
    if (profMulti.pericias > 0 && opcoes.pericias_multiclasse) {
      if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
      for (const pericia of opcoes.pericias_multiclasse) {
        if (!personagem.pericias_proficientes.includes(pericia)) {
          personagem.pericias_proficientes.push(pericia);
        }
      }
    }
    
    // Ferramentas (automático)
    if (profMulti.ferramentas.length > 0) {
      if (!personagem.proficiencias_ferramentas) personagem.proficiencias_ferramentas = [];
      for (const ferr of profMulti.ferramentas) {
        if (!personagem.proficiencias_ferramentas.includes(ferr)) {
          personagem.proficiencias_ferramentas.push(ferr);
        }
      }
    }
  }
}
```

---

## Task 6: Espaços de Magia Multiclasse

**Files:**
- Modify: `site/js/levelup.js` (função `atualizarEspacosMagia`)
- Modify: `site/js/pages/sheet.js`

- [ ] **Step 1: Localizar `atualizarEspacosMagia` em `levelup.js`**

Buscar a função que atualiza espaços de magia. Modificá-la para usar a tabela multiclasse quando há múltiplas classes conjuradoras.

- [ ] **Step 2: Modificar cálculo de espaços**

```javascript
import { possuiMultiplasClassesConjuradoras, getEspacosMagiaMulticlasse } from './multiclasse.js';

async function atualizarEspacosMagia(personagem, classeData) {
  // Se tem múltiplas classes conjuradoras, usar tabela multiclasse
  if (possuiMultiplasClassesConjuradoras(personagem)) {
    const espacosMulti = getEspacosMagiaMulticlasse(personagem);
    if (espacosMulti) {
      // Preservar slots usados
      for (const [circ, dados] of Object.entries(espacosMulti)) {
        if (personagem.espacos_magia[circ]) {
          espacosMulti[circ].usados = Math.min(
            personagem.espacos_magia[circ].usados || 0,
            dados.total
          );
        }
      }
      personagem.espacos_magia = espacosMulti;
      return;
    }
  }
  
  // Caso contrário, usar tabela da classe (lógica original)
  // ... (manter código existente)
}
```

- [ ] **Step 3: Adicionar suporte a Magia de Pacto separada em `multiclasse.js`**

O Bruxo usa Magia de Pacto — seus espaços são separados e NÃO entram na soma da tabela de Conjurador Multiclasse. Adicionar em `multiclasse.js`:

```javascript
/**
 * Retorna os espaços de Magia de Pacto do Bruxo (separados dos espaços normais).
 * @param {Object} personagem
 * @returns {Object|null} { nivel: number, total: number, usados: number } ou null
 */
export function getEspacosMagiaDePacto(personagem) {
  const nivelBruxo = getNivelClasse(personagem, 'Bruxo');
  if (nivelBruxo === 0) return null;
  
  // Tabela de Magia de Pacto do Bruxo (nível → {espaços, circulo})
  const tabela = {
    1: { total: 1, circulo: 1 }, 2: { total: 2, circulo: 1 },
    3: { total: 2, circulo: 2 }, 4: { total: 2, circulo: 2 },
    5: { total: 2, circulo: 3 }, 6: { total: 2, circulo: 3 },
    7: { total: 2, circulo: 4 }, 8: { total: 2, circulo: 4 },
    9: { total: 2, circulo: 5 }, 10: { total: 2, circulo: 5 },
    11: { total: 3, circulo: 5 }, 12: { total: 3, circulo: 5 },
    13: { total: 3, circulo: 5 }, 14: { total: 3, circulo: 5 },
    15: { total: 3, circulo: 5 }, 16: { total: 3, circulo: 5 },
    17: { total: 4, circulo: 5 }, 18: { total: 4, circulo: 5 },
    19: { total: 4, circulo: 5 }, 20: { total: 4, circulo: 5 }
  };
  
  const entrada = tabela[nivelBruxo];
  if (!entrada) return null;
  
  const usados = personagem.recursos?.bruxo?.pacto_usados || 0;
  return {
    nivel: nivelBruxo,
    total: entrada.total,
    circulo: entrada.circulo,
    usados: Math.min(usados, entrada.total)
  };
}
```

- [ ] **Step 4: Na sheet, exibir espaços de Magia de Pacto separados para Bruxo**

Se o personagem tem Bruxo + outra classe conjuradora, os espaços do Bruxo (Magia de Pacto) são separados dos espaços de Conjuração normal. Adicionar lógica em `sheet.js` na seção de espaços de magia:

```javascript
import { getEspacosMagiaDePacto } from '../multiclasse.js';

// Ao renderizar espaços de magia, verificar se Bruxo multiclasse
const pactSlots = getEspacosMagiaDePacto(char);
const temBruxoMulticlasse = pactSlots && ehMulticlasse(char);

if (temBruxoMulticlasse) {
  // Renderizar seção "Espaços de Magia de Pacto" separada
  html += `<div class="espacos-pacto">`;
  html += `<h4>Magia de Pacto (Bruxo)</h4>`;
  html += `<p>Espaços: ${pactSlots.total - pactSlots.usados}/${pactSlots.total} (${pactSlots.circulo}o Círculo)</p>`;
  // Renderizar checkboxes para marcar/desmarcar slots usados
  html += `</div>`;
}
```

---

## Task 7: Adaptar Sheet para Múltiplas Classes

**Files:**
- Modify: `site/js/pages/sheet.js`
- Modify: `site/css/app.css`

- [ ] **Step 1: Exibir múltiplas classes no cabeçalho (se multiclasse habilitado)**

Localizar onde `char.classe` é exibido no cabeçalho da ficha (buscar por `char.classe` em `sheet.js`). Substituir por:

```javascript
import { formatarClasses, ehMulticlasse, getNivelClasse } from '../utils.js';

// Onde exibe nome da classe — só formata como multiclasse se flag ativo E tem múltiplas classes:
const classeExibicao = formatarClasses(char);
// Se multiclasse ativo: "Guerreiro 5 / Mago 3"
// Se multiclasse desabilitado: "Guerreiro" (comportamento atual)
```

- [ ] **Step 1b: Adicionar toggle de multiclasse na sheet**

Na seção de informações da ficha (onde exibe classe/nível), adicionar um toggle para habilitar/desabilitar multiclasse. Isso permite que o jogador ative multiclasse para um personagem já criado:

```javascript
// Na seção de informações do personagem, após exibir a classe:
html += `
  <label class="toggle-multiclasse" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;margin-top:4px;cursor:pointer">
    <input type="checkbox" id="chk-multiclasse-sheet" ${char.multiclasse_habilitado ? 'checked' : ''}
           style="width:14px;height:14px;accent-color:var(--cor-accent,#6c63ff)">
    <span style="color:var(--cor-texto-sec,#888)">Multiclasse</span>
  </label>
`;

// Bind:
document.getElementById('chk-multiclasse-sheet')?.addEventListener('change', (e) => {
  char.multiclasse_habilitado = e.target.checked;
  salvarPersonagem(char);
  renderFicha(); // Re-renderizar para mostrar/esconder UI multiclasse
});
```

- [ ] **Step 2: Exibir dados de vida separados por tipo (se multiclasse ativo)**

Se o personagem tem `multiclasse_habilitado && classes.length > 1` e dados de vida diferentes, exibir separados:

```javascript
import { getDadosDeVidaMulticlasse } from '../multiclasse.js';

const dadosVida = getDadosDeVidaMulticlasse(char);
// Renderizar: "5d10 + 3d6" ou "5d10 (Guerreiro) + 3d6 (Mago)"
```

- [ ] **Step 3: Exibir recursos de TODAS as classes (se multiclasse ativo)**

Na seção de recursos da sheet, se `char.multiclasse_habilitado && char.classes.length > 1`, iterar sobre todas as classes. Caso contrário, usar apenas a classe principal (comportamento atual):

```javascript
// Só iterar múltiplas classes se multiclasse está habilitado
const classesParaRenderizar = (char.multiclasse_habilitado && char.classes?.length > 1)
  ? char.classes
  : [{ nome: char.classe, nivel: char.nivel, subclasse: char.subclasse }];

for (const classeEntry of classesParaRenderizar) {
  const nivelNaClasse = classeEntry.nivel;
  const nomeClasse = classeEntry.nome;
  
  // Chamar getEstadoRecursos{Classe}() com o nível correto
  // Renderizar seção de recursos com indicação da classe
}
```

- [ ] **Step 4: Exibir características de todas as classes**

Na seção de características, listar features de todas as classes, agrupadas por classe:

```javascript
// Ao carregar dados da ficha, carregar classeData para CADA classe
const classesData = {};
for (const classeEntry of char.classes) {
  classesData[classeEntry.nome] = await getClasse(classeEntry.nome);
}
```

- [ ] **Step 5: Ajustes CSS para exibição multiclasse**

Adicionar estilos para os novos elementos em `app.css`:

```css
/* Cabeçalho multiclasse */
.ficha-classes-multi {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.ficha-classe-badge {
  background: var(--cor-classe, #333);
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

/* Dados de vida múltiplos */
.dados-vida-multi {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

/* Recursos agrupados por classe */
.recursos-classe-grupo {
  border-left: 3px solid var(--cor-classe, #666);
  padding-left: 0.75rem;
  margin-bottom: 1rem;
}

.recursos-classe-titulo {
  font-weight: bold;
  margin-bottom: 0.5rem;
  color: var(--cor-classe, #ccc);
}
```
---

## Task 8: Adaptar Validações do Level-Up

**Files:**
- Modify: `site/js/levelup-validations.js`

- [ ] **Step 1: Incluir `classe_levelup` no `collectOpcoes`**

Adicionar ao objeto `opcoes` retornado:

```javascript
export function collectOpcoes(ctx, state) {
  const opcoes = {
    classe_levelup: state.classe_levelup || ctx.classeParaLevelUp,
    // ... resto das opções existentes
  };
  
  // Se é nova classe e exige escolha de perícia:
  if (ctx.ehNovaClasse) {
    opcoes.pericias_multiclasse = state.pericias_multiclasse || [];
  }
  
  return opcoes;
}
```

- [ ] **Step 2: Validar pré-requisitos de multiclasse em `validateAll`**

```javascript
import { verificarPreRequisitosMulticlasse } from './multiclasse.js';

export function validateAll(ctx, state) {
  const erros = [];
  
  // Validar pré-requisitos se é nova classe
  if (ctx.ehNovaClasse) {
    const preReq = verificarPreRequisitosMulticlasse(ctx.personagem, ctx.classeParaLevelUp);
    if (!preReq.permitido) {
      erros.push(`Pré-requisitos não atendidos: ${preReq.motivos.join(', ')}`);
    }
    
    // Validar perícias escolhidas
    const profMulti = getProficienciasMulticlasse(ctx.classeParaLevelUp);
    if (profMulti?.pericias > 0) {
      const selecionadas = state.pericias_multiclasse || [];
      if (selecionadas.length !== profMulti.pericias) {
        erros.push(`Selecione ${profMulti.pericias} perícia(s) para ${ctx.classeParaLevelUp}`);
      }
    }
  }
  
  // ... validações existentes
  return erros;
}

---

## Task 9: Card de Proficiências para Nova Classe

**Files:**
- Modify: `site/js/levelup-cards.js`
- Modify: `site/js/levelup-flow.js`

Quando o jogador escolhe uma nova classe, precisa de um card para selecionar perícias (se aplicável).

- [ ] **Step 1: Adicionar step `proficiencias_multiclasse` em `levelup-flow.js`**

```javascript
{
  id: 'proficiencias_multiclasse',
  label: 'Proficiências da Nova Classe',
  visivel: (ctx) => ctx.ehNovaClasse && ctx.proficienciasMulticlasse?.pericias > 0,
  obrigatorio: true
}
```

Posicionar após `escolha_classe` e antes de `ganhos_nivel`.

- [ ] **Step 2: Criar card de proficiências em `levelup-cards.js`**

```javascript
/**
 * Renderiza card para seleção de proficiências ao entrar em nova classe.
 */
export function renderCardProficienciasMulticlasse(ctx, state) {
  const prof = ctx.proficienciasMulticlasse;
  if (!prof || prof.pericias === 0) return '';
  
  const selecionadas = state.pericias_multiclasse || [];
  const opcoes = prof.pericias_opcoes || []; // null = qualquer perícia
  const jaTemProficiencia = ctx.personagem.pericias_proficientes || [];
  
  let html = `<div class="levelup-card proficiencias-multi">`;
  html += `<h3>Proficiências — ${ctx.classeParaLevelUp}</h3>`;
  html += `<p>Selecione ${prof.pericias} perícia(s):</p>`;
  
  // Listar proficiências automáticas (armas, armaduras, ferramentas)
  if (prof.armas.length > 0 || prof.armaduras.length > 0 || prof.ferramentas.length > 0) {
    html += `<div class="prof-automaticas">`;
    html += `<h4>Ganhos Automáticos</h4><ul>`;
    if (prof.armas.length > 0) html += `<li>Armas: ${prof.armas.join(', ')}</li>`;
    if (prof.armaduras.length > 0) html += `<li>Armaduras: ${prof.armaduras.join(', ')}</li>`;
    if (prof.ferramentas.length > 0) html += `<li>Ferramentas: ${prof.ferramentas.join(', ')}</li>`;
    html += `</ul></div>`;
  }
  
  // Grid de perícias selecionáveis
  const periciasVisiveis = opcoes.length > 0 
    ? opcoes 
    : ctx.todasPericias.map(p => p.nome);
  
  html += `<div class="grid-pericias">`;
  for (const pericia of periciasVisiveis) {
    const jaTem = jaTemProficiencia.includes(pericia);
    const checked = selecionadas.includes(pericia) ? 'checked' : '';
    const disabled = jaTem ? 'disabled' : '';
    html += `
      <label class="pericia-opcao ${jaTem ? 'ja-proficiente' : ''} ${checked ? 'selecionada' : ''}">
        <input type="checkbox" name="pericias_multiclasse" value="${pericia}" ${checked} ${disabled}>
        ${pericia} ${jaTem ? '(já proficiente)' : ''}
      </label>`;
  }
  html += `</div></div>`;
  
  return html;
}
```

- [ ] **Step 3: Integrar na UI em `levelup-ui.js`**

```javascript
// No switch de renderização:
case 'proficiencias_multiclasse':
  cardHtml = renderCardProficienciasMulticlasse(ctx, state);
  break;


---

## Task 10: Adaptar Card de Ganhos e Card de Subclasse

**Files:**
- Modify: `site/js/levelup-cards.js`

- [ ] **Step 1: Modificar `renderCardGanhosNivel` para multiclasse**

O card de ganhos deve mostrar qual classe está subindo e o dado de vida correto:

```javascript
// Em renderCardGanhosNivel, substituir referência a ctx.classe por ctx.classeParaLevelUp
// E exibir: "Nível Total: X → Y" e "Nível em {Classe}: X → Y"

html += `<div class="nivel-info">`;
html += `<p>Nível Total: ${ctx.nivelTotal} → ${ctx.nivelTotalNovo}</p>`;
html += `<p>${ctx.classeParaLevelUp}: Nível ${ctx.nivelNaClasse} → ${ctx.nivelNaClasseNovo}</p>`;
if (ctx.ehNovaClasse) {
  html += `<p class="nova-classe-badge">Nova Classe!</p>`;
}
html += `</div>`;
```

- [ ] **Step 2: Modificar `renderCardSubclasse` para usar classe dinâmica**

Garantir que as subclasses exibidas são da classe em que está subindo (não da classe principal):

```javascript
// Em renderCardSubclasse, substituir referências a ctx.classeData
// por ctx.classeParaLevelUpData (dados da classe que está subindo)
```
---

## Task 11: Adaptar Seleção de Magias para Multiclasse

**Files:**
- Modify: `site/js/levelup-cards.js`
- Modify: `site/js/levelup-flow.js`

- [ ] **Step 1: Carregar magias da classe correta**

No contexto de conjuração, usar a classe que está subindo para determinar a lista de magias:

```javascript
// Em buildLevelUpContext, na seção de conjuração:
// Usar classeParaLevelUp para obter magias disponíveis
// O círculo máximo de magias depende do nível NA CLASSE, não do nível total
// (exceto para espaços de magia, que usam a tabela multiclasse)
```

- [ ] **Step 2: Distinguir magias por classe no card**

```javascript
// No renderCardMagias, se multiclasse:
// Mostrar de qual classe são as magias preparadas
// Permitir selecionar apenas magias da classe que está subindo
// Mostrar aviso: "Magias da lista de {Classe}. Círculo máximo: {X}"
```

- [ ] **Step 3: O Mago multiclasse ganha 2 magias no grimório por nível de Mago**

Garantir que ao subir nível COMO Mago, ganha 2 magias no grimório:

```javascript
// Em buildLevelUpContext:
if (classeParaLevelUp === 'Mago') {
  conjuracao.ehMago = true;
  conjuracao.grimorioGanhos = 2; // 2 por nível de Mago
}
```


---

## Task 12: Recursos da Sheet — Múltiplas Classes

**Files:**
- Modify: `site/js/pages/sheet.js`

Cada classe tem recursos próprios (Fúria do Bárbaro, Inspiração do Bardo, etc.). A sheet precisa exibir todos.

- [ ] **Step 1: Refatorar funções `getEstadoRecursos*` para aceitar nível**

As funções `getEstadoFuria()`, `getEstadoInspiracaoBardo()`, etc. usam `char.nivel`. Precisam usar o nível NA classe:

```javascript
// Em cada função getEstadoRecursos{Classe}():
// Substituir char.nivel por getNivelClasse(char, '{Classe}')
// Exemplo:
function getEstadoFuria() {
  const nivelBarbaro = getNivelClasse(char, 'Bárbaro');
  if (nivelBarbaro === 0) return null;
  // Usar nivelBarbaro em vez de char.nivel para calcular usos, dano, etc.
}
```

- [ ] **Step 2: Renderizar recursos de todas as classes**

Na seção de recursos da ficha, iterar sobre todas as classes:

```javascript
function renderizarRecursos() {
  let html = '';
  for (const classeEntry of char.classes) {
    const recursos = getRecursosParaClasse(classeEntry.nome);
    if (recursos) {
      html += `<div class="recursos-classe-grupo">`;
      html += `<div class="recursos-classe-titulo">${classeEntry.nome} (Nv ${classeEntry.nivel})</div>`;
      html += renderizarRecursosClasse(recursos);
      html += `</div>`;
    }
  }
  return html;
}
```
---

## Task 13: Bônus de Proficiência e Ataque Extra

**Files:**
- Modify: `site/js/utils.js`
- Modify: `site/js/pages/sheet.js`

- [ ] **Step 1: Bônus de proficiência usa nível total**

Verificar que `bonusProficiencia()` já recebe o nível total. Em todos os locais onde é chamada, garantir que passa `getNivelTotal(personagem)`:

```javascript
// Cada chamada de bonusProficiencia(personagem.nivel) deve ser:
bonusProficiencia(getNivelTotal(personagem))
```

- [ ] **Step 2: Ataque Extra não acumula**

Se o personagem tem Ataque Extra de duas classes (ex: Guerreiro 5 + Guardião 5), só conta uma vez. Adicionar verificação:

```javascript
// Em utils.js ou multiclasse.js:
export function getNumeroAtaques(personagem) {
  let ataques = 1;
  
  // Verificar Ataque Extra em qualquer classe
  const temAtaqueExtra = personagem.classes?.some(c => {
    const info = CLASSES_INFO[c.nome];
    // Nível 5+ em classes marciais concede Ataque Extra
    const niveisAtaqueExtra = { Bárbaro: 5, Guerreiro: 5, Guardião: 5, Monge: 5, Paladino: 5 };
    return c.nivel >= (niveisAtaqueExtra[c.nome] || 99);
  });
  
  if (temAtaqueExtra) ataques = 2;
  
  // Dois Ataques Extras do Guerreiro (nível 11)
  const nivelGuerreiro = getNivelClasse(personagem, 'Guerreiro');
  if (nivelGuerreiro >= 11) ataques = 3;
  
  return ataques;
}
```

## Task 14: Testes Manuais e Ajustes Finais

**Files:**
- Todos os arquivos modificados

- [ ] **Step 1: Testar migração de personagem existente**

Abrir app no navegador. Verificar nos DevTools que personagens existentes recebem `classes: [...]` ao serem carregados:

```
Abrir Console → listarPersonagens() → verificar que cada personagem tem .classes
```

- [ ] **Step 2: Testar criação de novo personagem**

Criar novo personagem pelo wizard. Verificar que é salvo com `classes: [{nome, nivel: 1, subclasse: null}]`.

- [ ] **Step 3: Testar level-up na mesma classe**

Subir nível em personagem existente (mesma classe). Verificar:
- classes[0].nivel incrementou
- personagem.nivel incrementou
- HP calculado corretamente
- Features de classe do nível correto

- [ ] **Step 4: Testar multiclasse — nova classe**

Subir nível escolhendo nova classe. Verificar:
- Pré-requisitos bloqueiam se atributos < 13
- Nova entrada em classes[]
- Proficiências parciais aplicadas
- HP usa dado de vida da nova classe
- Features de nível 1 da nova classe

- [ ] **Step 5: Testar espaços de magia multiclasse**

Criar personagem Mago 3 → multiclasse Clérigo. Verificar:
- Espaços usam tabela de Conjurador Multiclasse
- Nível conjurador = 3 (Mago) + 1 (Clérigo) = 4
- Espaços: 4 de 1o, 3 de 2o

- [ ] **Step 6: Testar sheet multiclasse**

Abrir ficha de personagem multiclasse. Verificar:
- Cabeçalho mostra "Guerreiro 5 / Mago 3"
- Dados de vida separados por tipo
- Recursos de ambas as classes exibidos
- Espaços de magia corretos

---

## Notas Importantes de Implementação

### Flag `multiclasse_habilitado`
- `false` por padrão em personagens novos e migrados
- Definido no step 1 do creator (toggle "Habilitar Multiclasse")
- Pode ser alterado na sheet a qualquer momento
- Quando `false`: level-up avança automaticamente na classe atual (sem step de escolha de classe), sheet exibe apenas a classe principal, todo o fluxo funciona como atualmente
- Quando `true`: level-up mostra step de escolha de classe (avançar na atual ou nova), sheet exibe multiclasse com badges, dados de vida separados, recursos de cada classe

### Retrocompatibilidade
- O campo `classe` (string) e `nivel` (number) continuam existindo como campos legados
- `sincronizarCamposLegados()` deve ser chamado após qualquer alteração no array `classes`
- Código que lê `char.classe` continuará funcionando (aponta para a classe principal)
- Personagens migrados recebem `multiclasse_habilitado: false` — sem mudança de comportamento

### Bruxo e Magia de Pacto
- O Bruxo usa Magia de Pacto, que é DIFERENTE de Conjuração
- Espaços de Magia de Pacto são separados e não entram no cálculo da tabela multiclasse
- Mas espaços de ambos os tipos podem ser usados para conjurar magias de qualquer fonte
- Implementação: manter `espacos_magia_pacto` separado de `espacos_magia`

### Subclasses
- Cada classe tem sua própria subclasse (nível 3 NA classe)
- `personagem.subclasse` aponta para a subclasse da classe principal (legado)
- `personagem.classes[i].subclasse` é o campo correto para multiclasse

### Ataque Extra
- Nunca acumula entre classes (max 2 ataques, exceto Guerreiro 11+)
- A feature Lâmina Sedenta do Bruxo NÃO dá ataques extras se já tem Ataque Extra

### Dados de Vida
- Dados de vida de tipos diferentes são mantidos separados
- Total de dados de vida = nível total do personagem
- Recuperação em descanso longo: até metade do total (arredondado para cima), mínimo 1
