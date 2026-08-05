// ============================================================
// Gerador ÚNICO e committed dos oráculos de compatibilidade em
// tests/fixtures/**. Onde a lógica é mecanicamente derivável (moedas.js,
// ficha-edicoes.js, dados-classes.js, e as duas migrações de store.js que
// não dependem de DOM), este script EXECUTA o código real de site/js/**
// para obter os valores esperados — não os digita à mão. Para trechos que
// só existem dentro de site/js/pages/sheet.js (funções privadas, não
// exportadas, que operam sobre estado de módulo global `char` e chamam
// `salvar()`/DOM), os valores são derivados por leitura cuidadosa do código
//-fonte real e citados com número de linha — esse é o limite honesto do
// que pode ser executado fora do navegador hoje.
//
// Uso:
//   node scripts/generate-baseline-fixtures.mjs           # escreve todas as fixtures
//   node scripts/generate-baseline-fixtures.mjs --check    # não escreve; retorna
//                                                           # exitCode 1 se o conteúdo
//                                                           # gerado divergir do que
//                                                           # já está em disco
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installBrowserShims, resetFakeLocalStorage, freezeClock } from './lib/browser-shims.mjs';
import { CLASSES_INFO } from '../site/js/dados-classes.js';
import * as moedasReal from '../site/js/moedas.js';
// Task 37: `site/js/ficha-edicoes.js` saiu do runtime (órfão provado); o
// código real vive agora em tests/helpers/legacy-edicoes-source.js.
import * as edicoesReal from '../tests/helpers/legacy-edicoes-source.js';

installBrowserShims();

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const BASELINE = 'e43c5ea';
const GENERATED_AT = '2026-07-26T00:00:00.000Z';

function envelope(cases) {
  return { fixtureVersion: 1, compatibilityBaseline: BASELINE, generatedAt: GENERATED_AT, cases };
}

function deepClone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// --------------------------------------------------------------
// Template base: a REAL criarPersonagemVazio() de site/js/store.js,
// executada com o relógio congelado, com id/timestamps fixados depois
// (determinismo) em vez do gerarId()/Date.now() reais.
// --------------------------------------------------------------
let _storeModulePromise = null;
async function getStoreModule() {
  if (!_storeModulePromise) {
    resetFakeLocalStorage();
    const unfreeze = freezeClock('2026-07-01T12:00:00.000Z');
    _storeModulePromise = import('../site/js/store.js').finally(unfreeze);
  }
  return _storeModulePromise;
}

async function personagemVazio(overrides = {}) {
  const store = await getStoreModule();
  const real = store.criarPersonagemVazio();
  real.id = 'a1b2-c3d4-e5f6';
  real.criado_em = '2026-07-01T12:00:00.000Z';
  real.atualizado_em = '2026-07-01T12:00:00.000Z';
  return { ...real, ...overrides };
}

function writeFixture(relPath, cases) {
  const full = path.join(repoRoot, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  return { relPath: full, content: `${JSON.stringify(envelope(cases), null, 2)}\n` };
}

// ================================================================
// Cada build* function retorna { relPath, content } via writeFixture().
// ================================================================

async function buildLegacyMinimal() {
  const p = await personagemVazio();
  return writeFixture('tests/fixtures/characters/legacy-minimal.json', [
    {
      id: 'minimal-vazio',
      descricao: 'Personagem recém-criado via criarPersonagemVazio() (site/js/store.js), sem nenhuma escolha feita. Shape obtido executando a função real (não digitado à mão).',
      origemReal: 'site/js/store.js#criarPersonagemVazio (executado de verdade por scripts/generate-baseline-fixtures.mjs)',
      personagem: p
    }
  ]);
}

async function buildLegacyAllFields() {
  const p = await personagemVazio({
    id: 'aa11-bb22-cc33',
    nome: 'Personagem de Teste — Campos Completos',
    nivel: 5, xp: 6500, exaustao: 1,
    classe: 'Guerreiro', subclasse: 'Cavaleiro Arcano', especie: 'Humano', antecedente: 'Soldado',
    alinhamento: 'Leal e Bom',
    tracos_escolhidos: ['Versátil'],
    extras_classe: { estilo_luta_escolhido: 'Defensivo' },
    escolhas_classe: { estilo_luta: ['Defensivo'] },
    escolhas_antecedente: { pericia_extra: 'Atletismo' },
    proficiencias_extra: ['Kit de Ferreiro'],
    atributos: { forca: 16, destreza: 13, constituicao: 15, inteligencia: 10, sabedoria: 12, carisma: 8 },
    configuracao_criacao: { atributos: { metodo: 'pointbuy', valoresBase: { forca: 15, destreza: 13, constituicao: 14, inteligencia: 10, sabedoria: 12, carisma: 8 }, rolagens: null } },
    atributos_base: { forca: 15, destreza: 13, constituicao: 14, inteligencia: 10, sabedoria: 12, carisma: 8 },
    bonus_antecedente: { forca: 1, constituicao: 1 },
    pv_max: 44, pv_atual: 30, pv_temporario: 5,
    dados_vida_total: 5, dados_vida_usados: 2,
    pericias_proficientes: ['Atletismo', 'Intimidação'],
    salvaguardas_proficientes: ['Força', 'Constituição'],
    inventario: [
      { nome: 'Espada Longa', tipo: 'arma', equipado: true, quantidade: 1, dados: { peso: '1,5 kg', categoria: 'Marcial' } },
      { nome: 'Cota de Malha', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '16', categoria: 'Pesada', peso: '20 kg' } },
      { nome: 'Escudo', tipo: 'escudo', equipado: true, quantidade: 1, dados: { peso: '3 kg' } }
    ],
    escolha_equip_classe: 'Pacote A', escolha_equip_antecedente: 'Pacote Soldado',
    moedas: { pc: 12, pp: 8, pe: 0, po: 45, pl: 1 },
    talentos: ['Versátil'],
    itens_customizados: [{ nome: 'Adaga da Família', tipo: 'arma', descricao: 'Herança de família, sem efeito mecânico.', dados: { peso: '0,5 kg' } }],
    usos_habilidades: { segundo_folego: { usados: 0, max: 1 } },
    aparencia: 'Cicatriz no rosto, cabelo curto grisalho.',
    personalidade: 'Direto e leal aos companheiros.',
    ideais: 'Disciplina acima de tudo.',
    lacos: 'Serviu no mesmo regimento que seu irmão.',
    defeitos: 'Confia demais em superiores.',
    historia_personagem: 'Ex-soldado de um exército mercenário dissolvido.',
    notas: 'Ficha de referência para testes de fixture.',
    idiomas: ['Comum', 'Anão'], tamanho: 'Médio',
    config: { sobrecarga_afeta_deslocamento: true },
    condicoes: ['Enjoo (leve)'],
    proficiencias_ferramentas: ['Kit de Ferreiro'],
    talentos_flags: { versatil_escolhido: true },
    criado_em: '2026-06-01T09:00:00.000Z', atualizado_em: '2026-07-20T18:30:00.000Z'
  });
  p._slots_magia_livre = 0;
  p.espacos_magia_extras = {};
  p.recursos = { talentos: { dadiva_destino: { usado: false } } };
  p.maestrias_arma = ['Espada Longa'];
  p.manobras_conhecidas = [];
  p.iniciado_em_magia_instancias = [];
  p.adepto_elemental_tipos = [];
  p.bonus_pv_dadiva_fortitude = 0;
  p.bonus_pv_anao_aplicado = 0;
  p.bonus_pv_vigoroso_aplicado = 0;
  p.morte_sucessos = 0;
  p.morte_falhas = 0;
  p.escolhas_talento = {};
  p.inspiracao_heroica = 0;
  p.instrumento_classe_escolhido = null;
  p.talentos_via_invocacao = [];
  p.talento_versatil = null;
  p.talento_antecedente = null;
  p.pericia_especie = null;
  p.pericias_especie = [];
  p.pv_max_override = null;

  return writeFixture('tests/fixtures/characters/legacy-all-fields.json', [
    {
      id: 'all-fields-01',
      descricao: 'Personagem nível 5 com todos os campos do template preenchidos, incluindo os campos "monólito" adicionados fora de criarPersonagemVazio (recursos, maestrias_arma, escolhas_talento, etc).',
      origemReal: 'site/js/store.js#criarPersonagemVazio (executado de verdade) + site/js/pages/sheet.js / levelup.js / creator.js (campos monólito adicionados em runtime, lidos por leitura de código)',
      personagem: p
    }
  ]);
}

// ----------------------------------------------------------------
// legacy-po.json — EXECUTA migrarMoedasLegado real (site/js/store.js).
// ----------------------------------------------------------------
async function buildLegacyPo() {
  const store = await getStoreModule();
  const { normalizarCarteira } = moedasReal;

  function rodarMigracao(pAntes) {
    const clone = deepClone(pAntes);
    const depois = store.migrarMoedasLegado(clone);
    return depois;
  }

  const caso1Antes = { id: 'po11-po22-po33', nome: 'Legado PO Simples', po: 120 };
  const caso1Depois = rodarMigracao(caso1Antes);

  const caso2Antes = { id: 'po44-po55-po66', nome: 'Legado PO Parcial', moedas: { po: 10, pp: '3' }, po: 999 };
  const caso2Depois = rodarMigracao(caso2Antes);

  const caso3Antes = { id: 'po77-po88-po99', nome: 'Já Migrado', moedas: { pc: 5, pp: 0, pe: 0, po: 20, pl: 0 } };
  const caso3Depois = rodarMigracao(caso3Antes);

  // Verificação cruzada com normalizarCarteira, para não confiar apenas na migração.
  if (JSON.stringify(caso2Depois.moedas) !== JSON.stringify(normalizarCarteira({ po: 10, pp: 3 }))) {
    throw new Error('Divergência inesperada entre migrarMoedasLegado e normalizarCarteira em legacy-po.json (caso 2)');
  }

  return writeFixture('tests/fixtures/characters/legacy-po.json', [
    {
      id: 'po-legado-sem-moedas',
      descricao: 'Personagem salvo antes da carteira multi-moeda existir: só tem `po` (número), sem `moedas`. Migração executada de verdade contra site/js/store.js#migrarMoedasLegado.',
      origemReal: 'site/js/store.js#migrarMoedasLegado (EXECUTADO)',
      personagemAntes: caso1Antes,
      operacao: 'migrarMoedasLegado',
      personagemDepois: caso1Depois
    },
    {
      id: 'po-legado-com-moedas-parcial',
      descricao: 'Personagem que já tem `moedas` parcial (faltando denominações) e ainda o campo legado `po` residual; migrarMoedasLegado ignora `po` quando `moedas` já é objeto (usa moedas como base) e normaliza via normalizarCarteira. Executado de verdade.',
      origemReal: 'site/js/store.js#migrarMoedasLegado + site/js/moedas.js#normalizarCarteira (EXECUTADO)',
      personagemAntes: caso2Antes,
      operacao: 'migrarMoedasLegado',
      personagemDepois: caso2Depois
    },
    {
      id: 'po-migracao-idempotente',
      descricao: 'Rodar migrarMoedasLegado novamente sobre um personagem já migrado não altera nada (idempotente). Executado de verdade.',
      origemReal: 'site/js/store.js#migrarMoedasLegado (EXECUTADO)',
      personagemAntes: caso3Antes,
      operacao: 'migrarMoedasLegado',
      personagemDepois: caso3Depois
    }
  ]);
}

// ----------------------------------------------------------------
// legacy-edicoes.json — EXECUTA as 4 funções reais de ficha-edicoes.js.
// Os retornos são gravados CRUS (sem wrapper), exatamente como a função
// real retorna.
// ----------------------------------------------------------------
async function buildLegacyEdicoes() {
  const unfreeze = freezeClock('2026-07-15T10:00:00.000Z');
  let caso1Antes, caso1Depois;
  try {
    caso1Antes = await personagemVazio({ id: 'ed11-ed22-ed33', nome: 'Editado Simples', pv_max: 20 });
    caso1Depois = deepClone(caso1Antes);
    const ret1 = edicoesReal.aplicarEdicao(caso1Depois, 'pv_max', 25, '2026-07-15T10:00:00.000Z');
    caso1Antes._returnFromAplicarEdicao = ret1; // undefined -> removido no envelope abaixo
  } finally {
    unfreeze();
  }
  const ret1Real = caso1Antes._returnFromAplicarEdicao;
  delete caso1Antes._returnFromAplicarEdicao;

  const caso2Antes = deepClone(caso1Depois);
  const caso2Depois = deepClone(caso2Antes);
  const ret2 = edicoesReal.reverterEdicao(caso2Depois, 'pv_max');

  const caso3Antes = await personagemVazio({
    id: 'ed77-ed88-ed99', nome: 'Consolidação Atributos',
    atributos_base: { forca: 16, destreza: 13, constituicao: 14, inteligencia: 10, sabedoria: 12, carisma: 8 },
    edicoes: {
      versao: 1,
      campos: {
        'atributos_base.forca': { original: 15, editadoEm: '2026-07-10T08:00:00.000Z', origem: 'manual' },
        'atributos_base.constituicao': { original: 13, editadoEm: '2026-07-12T08:00:00.000Z', origem: 'manual' }
      }
    }
  });
  const caso3Depois = deepClone(caso3Antes);
  const ret3 = edicoesReal.consolidarEdicoesAtributos(caso3Depois);

  const caso4Antes = await personagemVazio({
    id: 'edaa-edbb-edcc', nome: 'Delta Sistema', pv_atual: 25,
    edicoes: { versao: 1, campos: { pv_atual: { original: 20, editadoEm: '2026-07-11T08:00:00.000Z', origem: 'manual' } } }
  });
  const caso4Depois = deepClone(caso4Antes);
  const ret4 = edicoesReal.aplicarDeltaSistema(caso4Depois, 'pv_atual', -8, 30);

  const cases = [
    {
      id: 'edicao-campo-simples-aplicar',
      descricao: 'aplicarEdicao grava o valor original antes de sobrescrever um campo simples (pv_max), com editadoEm e origem "manual". Executado de verdade; aplicarEdicao não tem `return` (retorna undefined), por isso este caso não tem resultadoRetornado.',
      origemReal: 'site/js/ficha-edicoes.js#aplicarEdicao (EXECUTADO)',
      personagemAntes: caso1Antes,
      operacao: { fn: 'aplicarEdicao', caminho: 'pv_max', proposto: 25, editadoEm: '2026-07-15T10:00:00.000Z' },
      personagemDepois: caso1Depois
    },
    {
      id: 'edicao-reverter',
      descricao: 'reverterEdicao restaura o valor original e remove a entrada de edicoes.campos, retornando o booleano `true` (raw, sem wrapper) quando havia entrada a reverter.',
      origemReal: 'site/js/ficha-edicoes.js#reverterEdicao (EXECUTADO)',
      personagemAntes: caso2Antes,
      operacao: { fn: 'reverterEdicao', caminho: 'pv_max' },
      personagemDepois: caso2Depois,
      resultadoRetornado: ret2
    },
    {
      id: 'edicao-consolidar-atributos',
      descricao: 'consolidarEdicoesAtributos agrupa edições de sub-campos (atributos_base.forca) em uma única entrada no caminho pai (atributos_base), usando a menor editadoEm entre os filhos. Retorna o booleano `temEdicao` CRU (não `{temEdicao: true}`).',
      origemReal: 'site/js/ficha-edicoes.js#consolidarEdicoesAtributos (EXECUTADO)',
      personagemAntes: caso3Antes,
      operacao: { fn: 'consolidarEdicoesAtributos' },
      personagemDepois: caso3Depois,
      resultadoRetornado: ret3
    },
    {
      id: 'edicao-delta-sistema',
      descricao: 'aplicarDeltaSistema (usado por dano/cura) aplica um delta limitado por teto e, se o campo já estava editado manualmente, ajusta o `original` guardado na mesma proporção. Retorna o número `aplicado` CRU (não `{aplicado: -8}`).',
      origemReal: 'site/js/ficha-edicoes.js#aplicarDeltaSistema (EXECUTADO)',
      personagemAntes: caso4Antes,
      operacao: { fn: 'aplicarDeltaSistema', caminho: 'pv_atual', delta: -8, teto: 30 },
      personagemDepois: caso4Depois,
      resultadoRetornado: ret4
    }
  ];

  if (ret1Real !== undefined) {
    throw new Error(`aplicarEdicao deveria retornar undefined, retornou ${JSON.stringify(ret1Real)}`);
  }

  return writeFixture('tests/fixtures/characters/legacy-edicoes.json', cases);
}

// ----------------------------------------------------------------
// legacy-all-classes.json / known-casters / prepared-casters — usam o
// CLASSES_INFO real importado (já é execução real, é uma const exportada).
// ----------------------------------------------------------------
async function buildLegacyAllClasses() {
  const idHexPorClasse = {
    'Bárbaro': 'cl01-cl01-cl01', 'Bardo': 'cl02-cl02-cl02', 'Bruxo': 'cl03-cl03-cl03',
    'Clérigo': 'cl04-cl04-cl04', 'Druida': 'cl05-cl05-cl05', 'Feiticeiro': 'cl06-cl06-cl06',
    'Guardião': 'cl07-cl07-cl07', 'Guerreiro': 'cl08-cl08-cl08', 'Ladino': 'cl09-cl09-cl09',
    'Mago': 'cl10-cl10-cl10', 'Monge': 'cl11-cl11-cl11', 'Paladino': 'cl12-cl12-cl12'
  };
  const cases = [];
  for (const [classe, info] of Object.entries(CLASSES_INFO)) {
    const idSlug = classe.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const p = await personagemVazio({
      id: idHexPorClasse[classe], nome: `Exemplo de ${classe}`, classe,
      dados_vida_total: 1, salvaguardas_proficientes: info.salvaguardas
    });
    cases.push({
      id: `classe-${idSlug}`,
      descricao: `Personagem nível 1 da classe ${classe} (dado de vida d${info.dado_vida}, salvaguardas ${info.salvaguardas.join('/')}${info.conjurador ? `, conjurador tipo "${info.tipo_conjuracao}" via ${info.atributo_conjuracao}` : ', não-conjurador'}).`,
      origemReal: 'site/js/dados-classes.js#CLASSES_INFO (import real, sem cópia manual)',
      classeInfoEsperado: info,
      personagem: p
    });
  }
  return writeFixture('tests/fixtures/characters/legacy-all-classes.json', cases);
}

async function buildLegacyKnownCasters() {
  return writeFixture('tests/fixtures/characters/legacy-known-casters.json', [
    {
      id: 'conhecidas-bardo',
      descricao: `Bardo nível 3, tipo_conjuracao real="${CLASSES_INFO['Bardo'].tipo_conjuracao}" (importado de dados-classes.js): magias_conhecidas fixas (Carisma), sem magias_preparadas.`,
      origemReal: 'site/js/dados-classes.js#CLASSES_INFO + site/js/utils.js#getMagiaPreparadas',
      personagem: await personagemVazio({
        id: 'kc01-kc01-kc01', nome: 'Bardo Conhecido', classe: 'Bardo', subclasse: 'Colégio do Saber', nivel: 3,
        atributos: { forca: 8, destreza: 14, constituicao: 13, inteligencia: 10, sabedoria: 12, carisma: 16 },
        magias_conhecidas: [{ nome: 'Palavra de Cura', circulo: 1, origem: 'classe' }, { nome: 'Luzes Dançantes', circulo: 0, origem: 'classe' }],
        espacos_magia: { 1: { total: 4, usados: 1 }, 2: { total: 2, usados: 0 } }
      })
    },
    {
      id: 'conhecidas-feiticeiro',
      descricao: `Feiticeiro nível 5, tipo_conjuracao real="${CLASSES_INFO['Feiticeiro'].tipo_conjuracao}".`,
      origemReal: 'site/js/dados-classes.js#CLASSES_INFO',
      personagem: await personagemVazio({
        id: 'kc02-kc02-kc02', nome: 'Feiticeiro Conhecido', classe: 'Feiticeiro', subclasse: 'Feitiçaria Dracônica', nivel: 5,
        atributos: { forca: 8, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 17 },
        magias_conhecidas: [{ nome: 'Mísseis Mágicos', circulo: 1, origem: 'classe' }, { nome: 'Bola de Fogo', circulo: 3, origem: 'classe' }],
        espacos_magia: { 1: { total: 4, usados: 0 }, 2: { total: 3, usados: 1 }, 3: { total: 2, usados: 0 } }
      })
    }
  ]);
}

async function buildLegacyPreparedCasters() {
  return writeFixture('tests/fixtures/characters/legacy-prepared-casters.json', [
    {
      id: 'preparadas-clerigo',
      descricao: `Clérigo nível 3, tipo_conjuracao real="${CLASSES_INFO['Clérigo'].tipo_conjuracao}", com magia de domínio sempre-preparada (origem "dominio") e magia escolhida manualmente.`,
      origemReal: 'site/js/dados-classes.js#CLASSES_INFO + site/js/pages/sheet.js#migrarMagiasDominio',
      personagem: await personagemVazio({
        id: 'pc01-pc01-pc01', nome: 'Clérigo Preparado', classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 3,
        atributos: { forca: 12, destreza: 10, constituicao: 14, inteligencia: 8, sabedoria: 16, carisma: 12 },
        magias_preparadas: [{ nome: 'Abençoar', circulo: 1, origem: 'dominio' }, { nome: 'Curar Ferimentos', circulo: 1 }],
        espacos_magia: { 1: { total: 4, usados: 2 }, 2: { total: 2, usados: 0 } }
      })
    },
    {
      id: 'preparadas-mago-com-grimorio',
      descricao: `Mago nível 5, tipo_conjuracao real="${CLASSES_INFO['Mago'].tipo_conjuracao}", com grimório (todas as magias conhecidas via aprendizado) e magias_preparadas como subconjunto ativo.`,
      origemReal: 'site/js/utils.js#normalizarGrimorioMago',
      personagem: await personagemVazio({
        id: 'pc02-pc02-pc02', nome: 'Mago Preparado', classe: 'Mago', subclasse: 'Evocador', nivel: 5,
        atributos: { forca: 8, destreza: 14, constituicao: 13, inteligencia: 17, sabedoria: 10, carisma: 8 },
        grimorio: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Escudo Arcano', circulo: 1 }, { nome: 'Bola de Fogo', circulo: 3 }],
        magias_preparadas: [{ nome: 'Mísseis Mágicos', circulo: 1 }, { nome: 'Bola de Fogo', circulo: 3 }],
        espacos_magia: { 1: { total: 4, usados: 1 }, 2: { total: 3, usados: 0 }, 3: { total: 2, usados: 1 } }
      })
    }
  ]);
}

async function buildLegacyCustomSpellsItems() {
  return writeFixture('tests/fixtures/characters/legacy-custom-spells-items.json', [
    {
      id: 'itens-customizados-basico',
      descricao: 'Item de inventário totalmente customizado pelo jogador (sem referência a dados/equipamento/*.json), incluindo bônus de CA lido por calcCA (site/js/utils.js linha ~218).',
      origemReal: 'site/js/utils.js#calcCA (bônus de itens customizados equipados)',
      personagem: await personagemVazio({
        id: 'cu01-cu01-cu01', nome: 'Item Customizado', classe: 'Guerreiro', nivel: 4,
        atributos: { forca: 15, destreza: 12, constituicao: 14, inteligencia: 10, sabedoria: 10, carisma: 8 },
        itens_customizados: [{ nome: 'Anel de Proteção Caseiro', tipo: 'anel', descricao: 'Homebrew do grupo.', dados: { bonus_ca: 1, peso: '0 kg' } }],
        inventario: [{ nome: 'Anel de Proteção Caseiro', tipo: 'anel', equipado: true, quantidade: 1, dados: { bonus_ca: 1, peso: '0 kg' } }]
      })
    },
    {
      id: 'magias-customizadas-basico',
      descricao: 'Magia totalmente customizada (fora de dados/magias/*.json) registrada em magias_customizadas e referenciada tanto no grimório quanto em magias_conhecidas e magias_preparadas via origem "customizada" (para caracterizar todos os pontos onde uma magia customizada pode aparecer referenciada).',
      origemReal: 'site/js/pages/sheet.js (fluxo de magia customizada)',
      personagem: await personagemVazio({
        id: 'cu02-cu02-cu02', nome: 'Magia Customizada', classe: 'Mago', nivel: 3,
        atributos: { forca: 8, destreza: 14, constituicao: 12, inteligencia: 16, sabedoria: 10, carisma: 10 },
        magias_customizadas: [{ nome: 'Explosão de Faísca (Homebrew)', circulo: 1, escola: 'Evocação', descricao: 'Magia autoral do grupo, dano 2d6 ígneo em área pequena.' }],
        magias_conhecidas: [{ nome: 'Explosão de Faísca (Homebrew)', circulo: 1, origem: 'customizada' }],
        grimorio: [{ nome: 'Explosão de Faísca (Homebrew)', circulo: 1, origem: 'customizada' }],
        magias_preparadas: [{ nome: 'Explosão de Faísca (Homebrew)', circulo: 1, origem: 'customizada' }],
        espacos_magia: { 1: { total: 4, usados: 0 }, 2: { total: 2, usados: 0 } }
      })
    }
  ]);
}

async function buildLegacyResourcesEdits() {
  return writeFixture('tests/fixtures/characters/legacy-resources-edits.json', [
    {
      id: 'recursos-talentos-descanso-longo',
      descricao: 'recursos.talentos com estado de talentos "Conjurador Ritualista" e "Dádiva da Recuperação Divina". restaurarRecursosTalentos(char, "longo") é uma função pura exportada — executada de verdade abaixo.',
      origemReal: 'site/js/regras-cobertura.js#restaurarRecursosTalentos (EXECUTADO)',
      ...(() => {
        const antes = {
          id: 're01-re01-re01', nome: 'Recursos Antes do Descanso', classe: 'Clérigo', nivel: 6,
          talentos: ['Conjurador Ritualista', 'Dádiva da Recuperação Divina'],
          recursos: {
            talentos: {
              conjurador_ritualista: { ritual_rapido_usado: true },
              dadiva_recuperacao: { ate_a_morte_usado: true, dados_vitalidade_gastos: 2 },
              dadiva_destino: { usado: true }
            }
          }
        };
        return { personagemAntes: antes, operacao: { fn: 'restaurarRecursosTalentos', tipoDescanso: 'longo' } };
      })()
    },
    {
      id: 'recursos-com-edicao-manual',
      descricao: 'Personagem com edicoes.campos apontando para dentro de `recursos` (edição manual de um recurso de talento), demonstrando que `edicoes` também cobre sub-caminhos de `recursos`.',
      origemReal: 'site/js/ficha-edicoes.js#aplicarEdicao (caminho aninhado) + site/js/regras-cobertura.js (estrutura de recursos.talentos)',
      personagem: await personagemVazio({
        id: 're02-re02-re02', nome: 'Recurso Editado', classe: 'Bárbaro', nivel: 3,
        recursos: { talentos: { dadiva_proeza_combate: { usado_no_turno: true } } },
        edicoes: { versao: 1, campos: { 'recursos.talentos.dadiva_proeza_combate.usado_no_turno': { original: false, editadoEm: '2026-07-18T09:00:00.000Z', origem: 'manual' } } }
      })
    }
  ]);
}

// ----------------------------------------------------------------
// legacy-migration-stages.json — EXECUTA as 2 migrações de store.js
// (migrarMoedasLegado, migrarEdicoesLegado) de verdade. As 13 migrações de
// site/js/pages/sheet.js são funções privadas (não exportadas) que operam
// sobre a variável de módulo global `char` e chamam salvar() (que grava em
// localStorage e window) — não são importáveis/executáveis isoladamente em
// Node sem reescrever sheet.js (isso é, em si, um dos motivos da
// refatoração planejada). Para essas, os casos abaixo foram derivados por
// leitura cuidadosa e citam a linha exata da função real.
// ----------------------------------------------------------------
async function buildLegacyMigrationStages() {
  const store = await getStoreModule();

  const moedasAntes = { po: 50 };
  const moedasDepois = store.migrarMoedasLegado(deepClone(moedasAntes));

  const edicoesAntes = { nome: 'Sem Edições Ainda' };
  const edicoesDepois = store.migrarEdicoesLegado(deepClone(edicoesAntes));

  return writeFixture('tests/fixtures/characters/legacy-migration-stages.json', [
    {
      id: 'migracao-moedas-legado',
      descricao: 'migrarMoedasLegado: campo único `po` -> carteira `moedas` (ver também legacy-po.json para mais variações). EXECUTADO de verdade.',
      origemReal: 'site/js/store.js#migrarMoedasLegado (EXECUTADO)',
      fnMigracao: 'migrarMoedasLegado', executavelIsoladamente: true,
      personagemAntes: moedasAntes,
      personagemDepoisParcial: moedasDepois,
      camposRemovidos: ['po']
    },
    {
      id: 'migracao-edicoes-legado',
      descricao: 'migrarEdicoesLegado: garante edicoes.versao===1 e configuracao_criacao.atributos, sem alterar campos existentes da ficha. EXECUTADO de verdade.',
      origemReal: 'site/js/store.js#migrarEdicoesLegado (EXECUTADO)',
      fnMigracao: 'migrarEdicoesLegado', executavelIsoladamente: true,
      personagemAntes: edicoesAntes,
      personagemDepoisParcial: edicoesDepois
    },
    {
      id: 'migracao-magias-dominio',
      descricao: 'migrarMagiasDominio (sheet.js:2880-2891): marca magias_preparadas cujo nome está na lista de magias de domínio da subclasse (magiasDominioCache) com origem "dominio", exceto as que já são "dominio"/"sempre"/"especie_legado". Depende de magiasDominioCache (carregado de dados/classes/*.json em runtime) — o cache abaixo é um valor assumido/representativo, não lido de um arquivo real nesta geração.',
      origemReal: 'site/js/pages/sheet.js#migrarMagiasDominio linha 2880',
      fnMigracao: 'migrarMagiasDominio', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js (não exportada), opera sobre a variável de módulo `char` e lê o cache de módulo `magiasDominioCache` carregado via fetch de dados/classes/*.json; chama salvar() ao final.',
      cacheAssumido: { magiasDominioCache: [{ nome: 'Abençoar' }, { nome: 'Curar Ferimentos' }] },
      personagemAntes: { classe: 'Clérigo', magias_preparadas: [{ nome: 'Abençoar', circulo: 1 }, { nome: 'Chama Sagrada', circulo: 0 }] },
      personagemDepoisParcial: { magias_preparadas: [{ nome: 'Abençoar', circulo: 1, origem: 'dominio' }, { nome: 'Chama Sagrada', circulo: 0 }] }
    },
    {
      id: 'migracao-slots-magia-livre',
      descricao: 'migrarSlotsMagiaLivre (sheet.js:2899-2921): função PURA de campo (sem dependência de dados de JSON externos) que detecta retroativamente se o personagem tem menos magias manuais do que o limite de "magias preparadas" da tabela de classe permite (deficit), e registra o deficit em _slots_magia_livre — só para classes tipo_conjuracao "conhecidas". Depende da tabela de características da classe (classeData?.tabela_caracteristicas, carregada em runtime de dados/classes/*.json) para saber o máximo esperado; o valor abaixo assume maxEsperado=4 (representativo de um Bardo nível 3).',
      origemReal: 'site/js/pages/sheet.js#migrarSlotsMagiaLivre linha 2899',
      fnMigracao: 'migrarSlotsMagiaLivre', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, lê classeData (cache de módulo carregado de dados/classes/*.json) e a variável global `char`; chama salvar().',
      cacheAssumido: { maxEsperadoAssumido: 4 },
      personagemAntes: { classe: 'Bardo', nivel: 3, magias_preparadas: [{ nome: 'Palavra de Cura', circulo: 1 }], _slots_magia_livre: 0 },
      personagemDepoisParcial: { _slots_magia_livre: 3 },
      notas: 'deficit = maxEsperado(4) - atual(1) = 3; como 3 > jaRegistrado(0), char._slots_magia_livre = 3.'
    },
    {
      id: 'migracao-magias-sempre-preparadas',
      descricao: 'migrarMagiasSemprePreparadas (sheet.js:2923-2969): marca com origem "sempre" as magias_preparadas cujo nome está na lista de magias sempre-preparadas da subclasse (magiasSempreCache), remove entradas "sempre" que não estão mais nessa lista (higienização), e incrementa _slots_magia_livre por cada slot liberado.',
      origemReal: 'site/js/pages/sheet.js#migrarMagiasSemprePreparadas linha 2923',
      fnMigracao: 'migrarMagiasSemprePreparadas', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, lê o cache de módulo `magiasSempreCache` (dados/classes/*.json) e a variável global `char`; chama salvar().',
      cacheAssumido: { magiasSempreCache: [{ nome: 'Armadura Arcana', circulo: 1 }] },
      personagemAntes: { magias_preparadas: [{ nome: 'Armadura Arcana', circulo: 1 }, { nome: 'Bola de Fogo', circulo: 3, origem: 'sempre' }], _slots_magia_livre: 0 },
      personagemDepoisParcial: { magias_preparadas: [{ nome: 'Armadura Arcana', circulo: 1, origem: 'sempre' }], _slots_magia_livre: 1 },
      notas: '"Bola de Fogo" tinha origem "sempre" mas não está em magiasSempreCache -> removida (higienização). "Armadura Arcana" está no cache e não tinha origem "sempre"/"dominio"/"especie_legado" -> vira "sempre" e libera 1 slot.'
    },
    {
      id: 'migracao-truques-especie',
      descricao: 'migrarTruquesEspecie (sheet.js:2972-2986): adiciona a magias_conhecidas os truques concedidos pela espécie/traço escolhido (obterTruquesEspecieFicha, função pura embutida em sheet.js — ex: Aasimar sempre ganha "Luz"), com origem "especie", se ainda não estiverem lá.',
      origemReal: 'site/js/pages/sheet.js#migrarTruquesEspecie linha 2972 + #obterTruquesEspecieFicha linha 3016',
      fnMigracao: 'migrarTruquesEspecie', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre a variável global `char`; chama salvar(). A lógica de obterTruquesEspecieFicha em si é pura e determinística (tabela fixa embutida no código, sem dependência de dados/*.json), então o caso abaixo é exato, não representativo.',
      personagemAntes: { especie: 'Aasimar', tracos_escolhidos: [], magias_conhecidas: [] },
      personagemDepoisParcial: { magias_conhecidas: [{ nome: 'Luz', circulo: 0, origem: 'especie' }] }
    },
    {
      id: 'migracao-magias-legado-especie',
      descricao: 'migrarMagiasLegadoEspecie (sheet.js:2994-3013): concede retroativamente a magia de Legado Ínfero (Tiferino)/Linhagem Élfica (Elfo) dos níveis 3/5 para fichas que já estavam nesses níveis antes da concessão automática existir em subirDeNivel. Depende de MAGIAS_LEGADO_ESPECIE (tabela embutida no módulo) e indiceMagiasCache (dados/magias/_indice.json).',
      origemReal: 'site/js/pages/sheet.js#migrarMagiasLegadoEspecie linha 2994',
      fnMigracao: 'migrarMagiasLegadoEspecie', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js; lê MAGIAS_LEGADO_ESPECIE (tabela de módulo) e indiceMagiasCache (cache carregado de dados/magias/_indice.json); opera sobre `char`; chama salvar().',
      cacheAssumido: { tabelaLegadoAssumidaTiferinoAbissal: { 3: 'Rajada de Veneno' } },
      personagemAntes: { especie: 'Tiferino', tracos_escolhidos: ['Abissal'], nivel: 3, magias_preparadas: [] },
      personagemDepoisParcial: { magias_preparadas: [{ nome: 'Rajada de Veneno', circulo: 1, origem: 'especie_legado' }] }
    },
    {
      id: 'migracao-escolhas-classe-legadas',
      descricao: 'migrarEscolhasClasseLegadas (sheet.js:3041-3065): aplica escolhas de "especialista" (Ladino/Guardião) e "acadêmico" (Mago) mecanicamente em pericias_expertise. É apenas manipulação de campos (sem dependência de dados externos), mas ainda assim uma função privada de sheet.js.',
      origemReal: 'site/js/pages/sheet.js#migrarEscolhasClasseLegadas linha 3041',
      fnMigracao: 'migrarEscolhasClasseLegadas', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, portanto o caso abaixo é exato.',
      personagemAntes: { escolhas_classe: { especialista: ['Furtividade'], academico: [] }, pericias_expertise: [] },
      personagemDepoisParcial: { pericias_expertise: ['Furtividade'] }
    },
    {
      id: 'migracao-nome-pericia-lidar-animais',
      descricao: 'migrarNomePericiaLidarAnimais (sheet.js:3068-3078): renomeia a perícia legada "Adestrar Animais" (regras 2014) para "Lidar com Animais" (2024) nas listas de proficiência/expertise. Sem dependência de dados externos.',
      origemReal: 'site/js/pages/sheet.js#migrarNomePericiaLidarAnimais linha 3068',
      fnMigracao: 'migrarNomePericiaLidarAnimais', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, caso abaixo é exato.',
      personagemAntes: { pericias_proficientes: ['Adestrar Animais', 'Percepção'], pericias_expertise: ['Adestrar Animais'] },
      personagemDepoisParcial: { pericias_proficientes: ['Lidar com Animais', 'Percepção'], pericias_expertise: ['Lidar com Animais'] }
    },
    {
      id: 'migracao-talento-versatil-humano',
      descricao: 'migrarTalentoVersatilHumano (sheet.js:3081-3088): se a espécie é Humano e existe um `talento_versatil` legado, garante que esse talento esteja presente no array `talentos`. Manipulação pura de campos, sem dependência de dados externos.',
      origemReal: 'site/js/pages/sheet.js#migrarTalentoVersatilHumano linha 3081',
      fnMigracao: 'migrarTalentoVersatilHumano', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, caso abaixo é exato.',
      personagemAntes: { especie: 'Humano', talento_versatil: 'Sortudo', talentos: [] },
      personagemDepoisParcial: { talentos: ['Sortudo'] }
    },
    {
      id: 'migracao-pericia-especie',
      descricao: 'migrarPericiaEspecie (sheet.js:3091-3098): se existe `pericia_especie` legado (perícia única concedida por espécie, ex: Hábil/Sentidos Aguçados), garante que esteja em pericias_proficientes. Manipulação pura de campos.',
      origemReal: 'site/js/pages/sheet.js#migrarPericiaEspecie linha 3091',
      fnMigracao: 'migrarPericiaEspecie', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, caso abaixo é exato.',
      personagemAntes: { pericia_especie: 'Percepção', pericias_proficientes: [] },
      personagemDepoisParcial: { pericias_proficientes: ['Percepção'] }
    },
    {
      id: 'migracao-pericias-especie-array',
      descricao: 'migrarPericiasEspecie (sheet.js:3101-3112): mesma ideia que migrarPericiaEspecie, mas para o formato de array `pericias_especie` (ex: Kenku, que concede múltiplas perícias). Manipulação pura de campos.',
      origemReal: 'site/js/pages/sheet.js#migrarPericiasEspecie linha 3101',
      fnMigracao: 'migrarPericiasEspecie', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, caso abaixo é exato.',
      personagemAntes: { pericias_especie: ['Enganação', 'Intuição'], pericias_proficientes: ['Intuição'] },
      personagemDepoisParcial: { pericias_proficientes: ['Intuição', 'Enganação'] }
    },
    {
      id: 'migracao-pericias-talentos',
      descricao: 'migrarPericiasTalentos (sheet.js:3115-3137): para cada contexto em `escolhas_talento` (antecedente, versatil, levelup_N), adiciona a pericias_proficientes qualquer escolha que seja o nome de uma perícia real (filtra ferramentas). Usa uma lista fixa de nomes de perícia embutida na própria função (sem dependência de dados externos).',
      origemReal: 'site/js/pages/sheet.js#migrarPericiasTalentos linha 3115',
      fnMigracao: 'migrarPericiasTalentos', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Lista de perícias é uma constante embutida na função, caso abaixo é exato.',
      personagemAntes: { escolhas_talento: { antecedente: ['Percepção', 'Kit de Ferreiro'] }, pericias_proficientes: [] },
      personagemDepoisParcial: { pericias_proficientes: ['Percepção'] },
      notas: '"Kit de Ferreiro" não é um nome de perícia da lista fixa (PERICIAS_NOMES) e é ignorado; apenas "Percepção" é adicionada.'
    },
    {
      id: 'migracao-iniciado-em-magia-instancias',
      descricao: 'migrarIniciadoEmMagiaInstancias (sheet.js:8414-8427): formato antigo (objeto único `iniciado_em_magia`) vira array `iniciado_em_magia_instancias`; campo antigo é removido. Manipulação pura de campos.',
      origemReal: 'site/js/pages/sheet.js#migrarIniciadoEmMagiaInstancias linha 8414',
      fnMigracao: 'migrarIniciadoEmMagiaInstancias', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, caso abaixo é exato.',
      personagemAntes: { iniciado_em_magia: { lista: 'Mago', atributo_conjuracao: 'Inteligência', magia_1_circulo: 'Escudo Arcano' } },
      personagemDepoisParcial: { iniciado_em_magia_instancias: [{ lista: 'Mago', atributo_conjuracao: 'Inteligência', magia_1_circulo: 'Escudo Arcano' }] },
      camposRemovidos: ['iniciado_em_magia']
    },
    {
      id: 'migracao-adepto-elemental-tipos',
      descricao: 'migrarAdeptoElementalTipos (sheet.js:8430-8439): formato antigo (string única `adepto_elemental_tipo`) vira array `adepto_elemental_tipos`; campo antigo é removido. Manipulação pura de campos.',
      origemReal: 'site/js/pages/sheet.js#migrarAdeptoElementalTipos linha 8430',
      fnMigracao: 'migrarAdeptoElementalTipos', executavelIsoladamente: false,
      motivoNaoExecutavel: 'Função privada de sheet.js, opera sobre `char`; chama salvar(). Sem dependência de dados externos, caso abaixo é exato.',
      personagemAntes: { adepto_elemental_tipo: 'Ígneo' },
      personagemDepoisParcial: { adepto_elemental_tipos: ['Ígneo'] },
      camposRemovidos: ['adepto_elemental_tipo']
    }
  ]);
}

async function buildLegacyUnknownFields() {
  const p = await personagemVazio({
    id: 'unk1-unk1-unk1', nome: 'Campos Desconhecidos',
    companheiro_animal_experimental: { nome: 'Sombra', tipo: 'Lobo', pv_atual: 11 },
    _flag_beta_interface_nova: true,
    preferencias_ui: { tema: 'escuro', densidade: 'compacta' }
  });
  return writeFixture('tests/fixtures/characters/legacy-unknown-fields.json', [
    {
      id: 'campos-desconhecidos-preservados',
      descricao: 'Personagem com campos desconhecidos (de uma feature futura ou de uma extensão local) que o código atual não lê nem escreve, mas que devem sobreviver a um ciclo salvar/carregar (round-trip) sem serem descartados, já que listarPersonagens/salvarPersonagem operam sobre o objeto inteiro via JSON.stringify/JSON.parse (site/js/store.js), não por allowlist de campos.',
      origemReal: 'site/js/store.js#listarPersonagens / #salvarPersonagem (sem filtragem de campos)',
      personagem: p
    }
  ]);
}

async function buildV2BaselineCompatible() {
  const original = await personagemVazio({ id: 'v2c1-v2c1-v2c1', nome: 'Compatível V2', classe: 'Guerreiro', nivel: 2, pv_max: 20, pv_atual: 20 });
  return writeFixture('tests/fixtures/characters/v2-baseline-compatible.json', [
    {
      id: 'v2-compativel-guerreiro',
      descricao: 'Personagem v2 hipotético (schemaVersion 2) que renomeia/reagrupa campos v1 sem perder informação.',
      notas: 'Este schema v2 é ilustrativo — nenhuma implementação v2 existe ainda no app atual (site/js só produz v1).',
      schemaVersion: 2,
      personagemV1Original: original,
      personagemV2: {
        schemaVersion: 2,
        identity: { id: 'v2c1-v2c1-v2c1', nome: 'Compatível V2', origemV1: 'id,nome' },
        build: { classe: 'Guerreiro', nivel: 2, origemV1: 'classe,nivel' },
        state: { pv_max: 20, pv_atual: 20, origemV1: 'pv_max,pv_atual' }
      }
    }
  ]);
}

async function buildV2IdentityConflict() {
  const original = await personagemVazio({ id: 'ee01-ee02-ee03', nome: 'Conflito de Identidade' });
  return writeFixture('tests/fixtures/characters/v2-identity-conflict.json', [
    {
      id: 'v2-conflito-id-formato-diferente',
      descricao: 'O v1 usa gerarId() (formato "xxxx-xxxx-xxxx" hexadecimal); um v2 hipotético usa UUID v4. Migrar exige mapeamento explícito de identidade.',
      notas: 'Nenhuma implementação v2 existe ainda no app atual.',
      schemaVersion: 2,
      personagemV1Original: original,
      personagemV2ConflitanteProposto: { schemaVersion: 2, identity: { id: '3fa85f64-5717-4562-b3fc-2c963f66afa6', nomeV1Alias: 'ee01-ee02-ee03' } },
      resultadoEsperado: { compativel: false, motivo: 'identity.id não corresponde ao id v1; requer mapeamento explícito antes de mesclar.' }
    }
  ]);
}

async function buildFutureV3() {
  return writeFixture('tests/fixtures/characters/future-v3.json', [
    {
      id: 'schema-futuro-desconhecido',
      descricao: 'Documento de uma hipotética versão 3 futura do schema. Comportamento esperado: _validarPersonagem (site/js/store.js) rejeita.',
      origemReal: 'site/js/store.js#_validarPersonagem',
      schemaVersion: 3,
      documento: {
        schemaVersion: 3, kind: 'character-sheet',
        core: { displayName: 'Personagem Futuro', level: { value: 4, xp: 2700 } },
        mechanics: { classId: 'fighter', abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 } }
      },
      resultadoEsperadoNoAppAtual: { validarPersonagem: false, motivo: 'Não possui id/nome/nivel/atributos no shape esperado por _validarPersonagem.' }
    }
  ]);
}

// ----------------------------------------------------------------
// near-limits.json — imagem sintética válida (JPEG com padding em segmento
// de comentário) + limites de payload conhecidos, agora honestamente
// rotulados: "produzido" é naoMedido (Node não tem canvas/Image), "aceito"
// é derivado explicitamente dos limites de payload já registrados.
// ----------------------------------------------------------------
const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

// Um único segmento de comentário JPEG (marker 0xFFFE) tem um campo de
// tamanho de 2 bytes (big-endian) que INCLUI os próprios 2 bytes de tamanho,
// então o payload máximo por segmento é 65535 - 2 = 65533 bytes. Para
// alcançar um `targetBytes` muito maior que isso (ex: perto de 1 MiB), o
// formato JPEG permite múltiplos marcadores COM consecutivos antes do SOS —
// isso é uma extensão bem definida do formato (não um hack): qualquer
// decodificador JPEG em conformidade simplesmente pula cada segmento de
// aplicação/comentário que não reconhece precisa processar, usando o próprio
// campo de tamanho de cada um. `padJpegComComment` empilha quantos
// segmentos forem necessários para chegar o mais perto possível de
// `targetBytes` (nunca ultrapassando), em vez de truncar num único segmento.
const MAX_COM_SEGMENT_PAYLOAD = 65533; // 0xFFFF (max do campo de tamanho) - 2 bytes do próprio campo
const COM_SEGMENT_HEADER_BYTES = 4; // 0xFF 0xFE + 2 bytes de tamanho

function buildComSegment(payloadLen) {
  const lenField = payloadLen + 2; // o campo de tamanho inclui a si mesmo (2 bytes)
  const marker = Buffer.from([0xff, 0xfe, (lenField >> 8) & 0xff, lenField & 0xff]);
  const payload = Buffer.alloc(payloadLen, 0x00); // padding sintético, não é dado de imagem real
  return Buffer.concat([marker, payload]);
}

function padJpegComComment(base64Tiny, targetBytes) {
  const tiny = Buffer.from(base64Tiny, 'base64');
  const soi = tiny.subarray(0, 2);
  const resto = tiny.subarray(2);
  let budget = Math.max(0, targetBytes - tiny.length);
  const segments = [];
  while (budget > COM_SEGMENT_HEADER_BYTES) {
    const payloadLen = Math.min(MAX_COM_SEGMENT_PAYLOAD, budget - COM_SEGMENT_HEADER_BYTES);
    segments.push(buildComSegment(payloadLen));
    budget -= COM_SEGMENT_HEADER_BYTES + payloadLen;
  }
  return Buffer.concat([soi, ...segments, resto]);
}

async function buildNearLimits() {
  const LOCAL_STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
  const FIRESTORE_DOC_LIMIT_BYTES = 1048576;
  // "Aceito": não há checagem de tamanho de imagem em nenhum lugar de site/js
  // (grep confirmado — ver relatório de fix). O único teto real que bloqueia
  // um personagem com imagem grande de ser salvo na nuvem é o limite de
  // documento do Firestore acima; localmente, o teto é o de localStorage.
  const acceptedCeilingBytes = FIRESTORE_DOC_LIMIT_BYTES;
  // O que de fato conta para o limite de documento do Firestore é o TAMANHO
  // DA STRING persistida (o campo `imagem` guarda o data URL como string),
  // não o tamanho do binário JPEG decodificado. Por isso o alvo é calculado
  // em cima do comprimento final do data URL (prefixo + base64), reservando
  // uma margem para os demais campos do personagem no mesmo documento —
  // e não em cima do tamanho bruto do JPEG antes de codificar.
  const DATA_URL_PREFIX = 'data:image/jpeg;base64,';
  const MARGEM_PARA_RESTANTE_DO_DOCUMENTO_BYTES = 2000;
  const targetDataUrlLength = acceptedCeilingBytes - MARGEM_PARA_RESTANTE_DO_DOCUMENTO_BYTES;
  const targetBase64Length = targetDataUrlLength - DATA_URL_PREFIX.length;
  // base64: 4 caracteres para cada 3 bytes de entrada (arredondado para baixo
  // aqui é seguro — o resultado real fica ligeiramente abaixo do alvo, nunca
  // acima, então nunca estoura o teto).
  const targetRawBytes = Math.floor((targetBase64Length * 3) / 4);
  const paddedJpegBuffer = padJpegComComment(TINY_JPEG_BASE64, targetRawBytes);
  const paddedDataUrl = `${DATA_URL_PREFIX}${paddedJpegBuffer.toString('base64')}`;

  // Verificação de sanidade do próprio gerador: o data URL final precisa
  // realmente ficar perto do teto (não apenas "ter sido pedido" a ficar
  // perto) — evita reintroduzir silenciosamente o mesmo tipo de divergência
  // entre o que a fixture AFIRMA e o que ela de fato CONTÉM.
  const proporcaoDoTeto = paddedDataUrl.length / acceptedCeilingBytes;
  if (proporcaoDoTeto < 0.9 || proporcaoDoTeto > 1.0) {
    throw new Error(
      `near-limits.json: data URL gerado (${paddedDataUrl.length} bytes) está a ${(proporcaoDoTeto * 100).toFixed(1)}% ` +
      `do teto do Firestore (${acceptedCeilingBytes} bytes) — deveria estar entre 90% e 100%. ` +
      'Verifique padJpegComComment (múltiplos segmentos COM) e o cálculo de targetRawBytes.'
    );
  }

  const p = await personagemVazio({ id: 'lim1-lim1-lim1', nome: 'Perto do Limite de Imagem', imagem: paddedDataUrl });

  return writeFixture('tests/fixtures/characters/near-limits.json', [
    {
      id: 'imagem-proximo-do-limite',
      descricao: `Não existe checagem de tamanho de imagem em site/js/** (confirmado por busca textual em todo o diretório — nenhum arquivo referencia um limite de bytes/KB para o campo \`imagem\`). Por isso não há um teto de "aceito" definido pelo app em si; o teto real e efetivo é o limite de payload que bloqueia a persistência (Firestore, 1 MiB). Este caso fixa uma imagem sintética (JPEG válido, 1x1 pixel real + padding via MÚLTIPLOS segmentos de comentário JPEG consecutivos — um único segmento COM satura em ~65,5 KB por causa do campo de tamanho de 16 bits do formato, então padJpegComComment empilha quantos forem necessários) dimensionada para ficar a ${(paddedDataUrl.length / acceptedCeilingBytes * 100).toFixed(1)}% desse teto de 1 MiB (dentro da margem reservada para os demais campos do personagem no mesmo documento), como referência de "quase no limite aceito". A imagem NÃO é uma fotografia real.`,
      origemReal: 'Busca textual confirmando ausência de checagem de tamanho de imagem em site/js/** + site/js/auth.js#salvarPersonagemCloud (limite de documento do Firestore é quem efetivamente barra o salvamento)',
      cotaAceitaDerivadaDe: 'firestoreDocumentLimitBytes (ver caso limites-de-payload-conhecidos)',
      proporcaoDoTetoAceito: Number(proporcaoDoTeto.toFixed(4)),
      imagemDataUrlBytes: paddedDataUrl.length,
      imagemDataUrlAmostraSintetica: true,
      tamanhoProduzidoPeloFluxoDeUpload: {
        naoMedido: true,
        motivo: 'processarImagemArquivo (site/js/utils.js:628-661) usa canvas.toDataURL, que exige um DOM/Canvas real de navegador; não pode ser executado headlessly em Node para medir o tamanho real produzido a partir de uma foto de entrada. Uma medição real requer Playwright/browser (fora do escopo desta task de congelamento de fixtures em Node).',
        parametrosConhecidos: { maxDim: 300, formato: 'image/jpeg', qualidade: 0.8 }
      },
      personagem: p
    },
    {
      id: 'limites-de-payload-conhecidos',
      descricao: 'Limites de payload que restringem o fluxo atual de persistência, mesmo sem checagem explícita no código do app: localStorage (usado por site/js/store.js, chave dnd_personagens) e documento do Firestore (usado por site/js/auth.js#salvarPersonagemCloud). Testes de segurança futuros não podem reduzir esses limites silenciosamente — qualquer redução deve ser uma decisão explícita registrada aqui.',
      localStorageLimitBytes: LOCAL_STORAGE_LIMIT_BYTES,
      firestoreDocumentLimitBytes: FIRESTORE_DOC_LIMIT_BYTES,
      notas: 'Valores de plataforma (não configuráveis pelo código do app atual): 5 MiB é a cota padrão de localStorage por origem nos navegadores baseados em Chromium/Firefox; 1 MiB (1.048.576 bytes) é o limite documentado por documento do Cloud Firestore.'
    }
  ]);
}

// ----------------------------------------------------------------
// sync/legacy-queue.json
// ----------------------------------------------------------------
async function buildSyncQueue() {
  const filaPersonagemExemplo = await personagemVazio({ id: 'sy01-sy01-sy01', nome: 'Fila de Sync', classe: 'Ladino', nivel: 2 });
  const outroPersonagem = await personagemVazio({ id: 'sy02-sy02-sy02', nome: 'Outro Personagem' });

  return writeFixture('tests/fixtures/sync/legacy-queue.json', [
    {
      id: 'fila-upsert-pendente',
      descricao: 'Um upsert pendente na fila (personagem alterado offline ou aguardando sync), no shape exato produzido por enfileirarSync: { id, dados, tentativas }, sem campo `acao`.',
      origemReal: 'site/js/sync.js#enfileirarSync',
      localStorageKey: 'dnd_sync_queue',
      filaAntes: [],
      operacao: { fn: 'enfileirarSync', personagem: filaPersonagemExemplo },
      filaDepois: [{ id: 'sy01-sy01-sy01', dados: filaPersonagemExemplo, tentativas: 0 }]
    },
    {
      id: 'fila-upsert-substituido-por-novo-upsert',
      descricao: 'enfileirarSync faz upsert por id: uma segunda chamada para o mesmo personagem substitui a entrada anterior na mesma posição.',
      origemReal: 'site/js/sync.js#enfileirarSync',
      localStorageKey: 'dnd_sync_queue',
      filaAntes: [{ id: 'sy01-sy01-sy01', dados: { ...filaPersonagemExemplo, nome: 'Fila de Sync (versão antiga)' }, tentativas: 2 }],
      operacao: { fn: 'enfileirarSync', personagem: filaPersonagemExemplo },
      filaDepois: [{ id: 'sy01-sy01-sy01', dados: filaPersonagemExemplo, tentativas: 0 }]
    },
    {
      id: 'fila-remocao-pendente-cancela-upsert',
      descricao: 'enfileirarRemocao remove qualquer upsert pendente do mesmo id e enfileira uma remoção no shape { id, acao: "remover", tentativas }, sem campo `dados`.',
      origemReal: 'site/js/sync.js#enfileirarRemocao',
      localStorageKey: 'dnd_sync_queue',
      filaAntes: [
        { id: 'sy01-sy01-sy01', dados: filaPersonagemExemplo, tentativas: 0 },
        { id: 'sy02-sy02-sy02', dados: outroPersonagem, tentativas: 1 }
      ],
      operacao: { fn: 'enfileirarRemocao', id: 'sy01-sy01-sy01' },
      filaDepois: [
        { id: 'sy02-sy02-sy02', dados: outroPersonagem, tentativas: 1 },
        { id: 'sy01-sy01-sy01', acao: 'remover', tentativas: 0 }
      ]
    },
    {
      id: 'fila-remocao-com-tentativas-esgotadas',
      descricao: 'Entrada de remoção que já falhou MAX_TENTATIVAS (3) vezes: permanece na fila (não é descartada automaticamente), apenas loga aviso.',
      origemReal: 'site/js/sync.js#_processarFilaSync (MAX_TENTATIVAS=3)',
      localStorageKey: 'dnd_sync_queue',
      filaAntes: [{ id: 'sy03-sy03-sy03', acao: 'remover', tentativas: 3 }]
    }
  ]);
}

// ----------------------------------------------------------------
// expected/derived-values.json — agora com PV, deslocamento e recursos
// (as 10 categorias do brief) + um segundo caso de perícia passiva.
// ----------------------------------------------------------------
async function buildDerivedValues() {
  const derivedChar = await personagemVazio({
    id: 'dv01-dv01-dv01', nome: 'Referência de Valores Derivados', classe: 'Clérigo', subclasse: 'Domínio da Vida', nivel: 5,
    atributos: { forca: 12, destreza: 14, constituicao: 14, inteligencia: 10, sabedoria: 16, carisma: 12 },
    pv_max: 38, pv_atual: 20, pv_temporario: 6,
    dados_vida_usados: 2,
    pericias_proficientes: ['Percepção', 'Religião', 'Intuição'],
    inventario: [
      { nome: 'Cota de Malha', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '16', categoria: 'Pesada', peso: '20 kg' } },
      { nome: 'Escudo', tipo: 'escudo', equipado: true, quantidade: 1, dados: { peso: '3 kg' } },
      { nome: 'Mochila de Aventureiro', tipo: 'equipamento', equipado: false, quantidade: 1, dados: { peso: '5 kg' } }
    ],
    magias_preparadas: [{ nome: 'Abençoar', circulo: 1, origem: 'dominio' }, { nome: 'Curar Ferimentos', circulo: 1 }],
    espacos_magia: { 1: { total: 4, usados: 1 }, 2: { total: 3, usados: 0 }, 3: { total: 2, usados: 0 } },
    especie: 'Humano',
    recursos: { talentos: { dadiva_destino: { usado: false } } }
  });

  return writeFixture('tests/fixtures/expected/derived-values.json', [
    {
      id: 'pv-convergente',
      categoria: 'pv',
      campo: 'PV (Pontos de Vida atual/máximo)',
      origemReal: 'char.pv_atual/char.pv_max são lidos diretamente (mesmo par de campos) por screen (sheet.js ~3654-3658), print (gerarHtmlImpressao, sheet.js:16920-16928) e PDF (_montarDadosCartao, sheet.js:17629) — sem helper de cálculo (são campos de estado direto, não derivados).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: null, screen: '20/38', print: '20/38', pdf: '20/38' },
      expectedUnified: '20/38',
      baselineDifferences: [],
      notas: 'Sem helper público compartilhado (PV é lido diretamente do campo, não calculado); expectedUnified = valor da tela principal, igual em todas as saídas no baseline atual.'
    },
    {
      id: 'ca-convergente',
      categoria: 'ca',
      campo: 'CA (Classe de Armadura)',
      origemReal: 'site/js/utils.js#calcCA — chamado de forma idêntica em screen (sheet.js:3162), print (linha 16887) e PDF (linha 17622): sempre calcCA(char, passivosTalentosCache).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 18, screen: 18, print: 18, pdf: 18 },
      expectedUnified: 18,
      baselineDifferences: [],
      notas: 'Cota de Malha (Pesada, CA base 16, sem bônus de Des) + Escudo (+2) = 18. Todas as telas chamam o mesmo helper público com os mesmos argumentos: já convergido no baseline atual.'
    },
    {
      id: 'iniciativa-convergente',
      categoria: 'iniciativa',
      campo: 'Iniciativa',
      origemReal: 'site/js/pages/sheet.js#getModIniciativa — chamado de forma idêntica em screen (3164), print (16889) e PDF (17623).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 2, screen: 2, print: 2, pdf: 2 },
      expectedUnified: 2,
      baselineDifferences: [],
      notas: 'getModIniciativa não está em utils.js (é local a sheet.js), mas é a mesma função reaproveitada nas três saídas: já convergido.'
    },
    {
      id: 'pv-temporario-divergente',
      categoria: 'pv',
      campo: 'PV Temporário',
      origemReal: 'Campo do personagem é `pv_temporario` (site/js/store.js#criarPersonagemVazio). A tela principal lê corretamente `char.pv_temporario` (sheet.js:3658). O HTML de impressão (gerarHtmlImpressao, sheet.js:16932) e o cartão do PDF (_montarDadosCartao, sheet.js:17634) leem, em vez disso, `char.pv_temp` — um campo que NUNCA é escrito em nenhum lugar do app.',
      personagem: derivedChar,
      baselineObserved: { domainHelper: null, screen: 6, print: 0, pdf: 0 },
      expectedUnified: 6,
      baselineDifferences: [
        { onde: 'print', valorAtual: 0, valorEsperado: 6, motivo: 'gerarHtmlImpressao lê char.pv_temp (inexistente) em vez de char.pv_temporario.' },
        { onde: 'pdf', valorAtual: 0, valorEsperado: 6, motivo: '_montarDadosCartao lê char.pv_temp (inexistente) em vez de char.pv_temporario.' }
      ],
      notas: 'Não há helper público compartilhado para PV temporário; expectedUnified usa o valor mostrado na tela principal.'
    },
    {
      id: 'dados-de-vida-restantes-divergente',
      categoria: 'dados_de_vida',
      campo: 'Dados de Vida restantes',
      origemReal: 'Screen calcula corretamente `char.nivel - (char.dados_vida_usados || 0)` (sheet.js:3662, 4169, 4338). Print (sheet.js:16936) lê `char.dados_vida_disponiveis ?? char.nivel` — campo nunca escrito, sempre cai no fallback nivel. PDF omite Dados de Vida do cartão.',
      personagem: derivedChar,
      baselineObserved: { domainHelper: null, screen: 3, print: 5, pdf: null },
      expectedUnified: 3,
      baselineDifferences: [
        { onde: 'print', valorAtual: 5, valorEsperado: 3, motivo: 'gerarHtmlImpressao lê char.dados_vida_disponiveis (inexistente) em vez de calcular nivel - dados_vida_usados.' },
        { onde: 'pdf', valorAtual: null, valorEsperado: 3, motivo: '_montarDadosCartao não inclui Dados de Vida na lista de stats do cartão — campo omitido.' }
      ],
      notas: 'Sem helper público compartilhado; expectedUnified usa o valor da tela principal (nivel - dados_vida_usados = 5 - 2 = 3).'
    },
    {
      id: 'cd-magia-convergente',
      categoria: 'cd_magia',
      campo: 'CD de Magia',
      origemReal: 'site/js/utils.js#calcCDMagia — chamado de forma idêntica em screen, print e PDF (17636, apenas quando info.conjurador).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 14, screen: 14, print: 14, pdf: 14 },
      expectedUnified: 14,
      baselineDifferences: [],
      notas: '8 + bônus de proficiência (3 no nível 5) + mod Sabedoria (16 -> +3) = 14.'
    },
    {
      id: 'ataque-magia-convergente',
      categoria: 'ataque_magia',
      campo: 'Bônus de Ataque de Magia',
      origemReal: 'site/js/utils.js#calcAtaqueMagia — mesma chamada em screen/print/PDF.',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 6, screen: 6, print: 6, pdf: 6 },
      expectedUnified: 6,
      baselineDifferences: [],
      notas: 'bônus de proficiência (3) + mod Sabedoria (+3) = +6.'
    },
    {
      id: 'percepcao-passiva-convergente',
      categoria: 'pericias_passivas',
      campo: 'Percepção Passiva',
      origemReal: 'site/js/utils.js#calcPercepcaoPassiva — chamado de forma idêntica em screen (15160), print (17032) e PDF (17661).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 16, screen: 16, print: 16, pdf: 16 },
      expectedUnified: 16,
      baselineDifferences: [],
      notas: '10 + mod Sabedoria (+3) + bônus de proficiência (3, pois "Percepção" está em pericias_proficientes) = 16.'
    },
    {
      id: 'intuicao-passiva-convergente',
      categoria: 'pericias_passivas',
      campo: 'Intuição Passiva',
      origemReal: 'site/js/utils.js#calcIntuicaoPassiva (linha 283) — chamado de forma idêntica em screen (15161), print (17033) e PDF (17662).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 16, screen: 16, print: 16, pdf: 16 },
      expectedUnified: 16,
      baselineDifferences: [],
      notas: '10 + mod Sabedoria (+3) + bônus de proficiência (3, pois "Intuição" está em pericias_proficientes) = 16. Segundo caso de perícia passiva coberto (calcPercepcaoPassiva já coberto acima), demonstrando que calcIntuicaoPassiva/calcInvestigacaoPassiva seguem o mesmo padrão de calcBonusPericia.'
    },
    {
      id: 'carga-somente-na-tela',
      categoria: 'carga',
      campo: 'Capacidade de Carga / Peso Total do Inventário',
      origemReal: 'site/js/utils.js#getCapacidadeCarga / #getPesoTotalInventario, usados apenas na tela principal (sheet.js:15422-15423). Print e PDF não exibem esse valor em nenhum lugar (omissão, não cálculo divergente).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: 84, screen: 84, print: null, pdf: null },
      expectedUnified: 84,
      baselineDifferences: [
        { onde: 'print', valorAtual: null, valorEsperado: 84, motivo: 'Capacidade de carga não é exibida na impressão (omissão de feature, não bug de valor).' },
        { onde: 'pdf', valorAtual: null, valorEsperado: 84, motivo: 'Capacidade de carga não é exibida no PDF (omissão de feature, não bug de valor).' }
      ],
      notas: 'Força 12 × multiplicador Médio (7) = 84 kg. Peso total do inventário = 20 + 3 + 5 = 28 kg.'
    },
    {
      id: 'espacos-de-magia-convergente',
      categoria: 'espacos',
      campo: 'Espaços de Magia (1º círculo, disponíveis)',
      origemReal: 'char.espacos_magia é lido diretamente (mesmo objeto em memória) por screen, print e PDF.',
      personagem: derivedChar,
      baselineObserved: { domainHelper: null, screen: 3, print: 3, pdf: 3 },
      expectedUnified: 3,
      baselineDifferences: [],
      notas: 'espacos_magia["1"] = { total: 4, usados: 1 } -> 3 disponíveis.'
    },
    {
      id: 'deslocamento-convergente',
      categoria: 'deslocamento',
      campo: 'Deslocamento',
      origemReal: 'site/js/utils.js#getDeslocamento — chamado de forma idêntica em screen (sheet.js, cálculo de deslocamento final via getDeslocamentoFinal), print (sheet.js:16894-16895/16944) e PDF (sheet.js:17625/17631), sempre envolvido por getDeslocamentoFinal(getDeslocamento(especieTexto)).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: '9 metros', screen: '9 metros', print: '9 metros', pdf: '9 metros' },
      expectedUnified: '9 metros',
      baselineDifferences: [],
      notas: 'Espécie "Humano" sem texto_completo customizado no personagem de referência: getDeslocamento retorna o fallback padrão "9 metros" quando não há string "Deslocamento: Xm" para casar — mesmo valor nas três saídas.'
    },
    {
      id: 'recursos-de-talento-convergente',
      categoria: 'recursos',
      campo: 'Recursos de talento (recursos.talentos.*)',
      origemReal: 'char.recursos é lido diretamente (mesmo objeto em memória); restaurarRecursosTalentos (site/js/regras-cobertura.js#345, EXECUTADO neste caso) é a única lógica compartilhada sobre esse campo, e é chamada a partir do fluxo de descanso da tela principal — não há renderização própria de "recursos" em print/PDF (eles não exibem uma seção dedicada a recursos de talento).',
      personagem: derivedChar,
      baselineObserved: { domainHelper: false, screen: false, print: null, pdf: null },
      expectedUnified: false,
      baselineDifferences: [
        { onde: 'print', valorAtual: null, valorEsperado: false, motivo: 'Recursos de talento não têm uma seção própria na impressão (omissão de feature).' },
        { onde: 'pdf', valorAtual: null, valorEsperado: false, motivo: 'Recursos de talento não têm uma seção própria no PDF (omissão de feature).' }
      ],
      notas: 'char.recursos.talentos.dadiva_destino.usado = false (valor direto do campo, sem transformação); print/PDF simplesmente não têm UI para isso.'
    }
  ]);
}

// ----------------------------------------------------------------
// expected/command-transitions.json — EXECUTA moedas.js de verdade para
// todos os casos de categoria "moedas".
// ----------------------------------------------------------------
async function buildCommandTransitions() {
  const ctBase = async (overrides) => personagemVazio({ id: 'ctxx-ctxx-ctxx', nome: 'Transições de Comando', classe: 'Clérigo', nivel: 5, ...overrides });

  // --- moedas: EXECUTA pagarCusto real ---
  const moedasFalhaAntes = { pc: 0, pp: 0, pe: 0, po: 3, pl: 0 };
  const moedasFalhaResultado = moedasReal.pagarCusto(moedasFalhaAntes, '50 PO');

  const moedasConverteAntes = { pc: 0, pp: 60, pe: 0, po: 0, pl: 0 };
  const moedasConverteResultado = moedasReal.pagarCusto(moedasConverteAntes, '5 PO');

  const moedasSucessoAntes = { pc: 0, pp: 0, pe: 0, po: 100, pl: 0 };
  const moedasSucessoResultado = moedasReal.pagarCusto(moedasSucessoAntes, '50 PO');

  const cases = [
    {
      id: 'dano-absorvido-por-pv-temporario',
      categoria: 'dano',
      descricao: 'Dano é absorvido primeiro pelo PV temporário; o excedente reduz pv_atual. Reflete sheet.js linhas 4080-4082.',
      origemReal: 'site/js/pages/sheet.js (aplicação de dano, ~linha 4080)',
      personagemAntes: await ctBase({ pv_atual: 20, pv_max: 38, pv_temporario: 5 }),
      operacao: { tipo: 'aplicar_dano', valor: 8 },
      personagemDepois: await ctBase({ pv_atual: 17, pv_max: 38, pv_temporario: 0 }),
      notas: '5 de dano absorvidos pelo PV temp (zera), os 3 restantes descontam de pv_atual: 20 - 3 = 17.'
    },
    {
      id: 'dano-ate-zero-nao-reseta-salvaguardas-morte',
      categoria: 'dano',
      descricao: 'Aplicar dano até pv_atual chegar a 0 NÃO reseta morte_sucessos/morte_falhas automaticamente (sheet.js linha 4085: apenas Math.max(0, pv_atual - dano)). O reset só acontece no handler de CURA (linhas 4106-4109).',
      origemReal: 'site/js/pages/sheet.js linha 4085 (dano)',
      personagemAntes: await ctBase({ pv_atual: 5, pv_max: 38, pv_temporario: 0, morte_sucessos: 1, morte_falhas: 2 }),
      operacao: { tipo: 'aplicar_dano', valor: 10 },
      personagemDepois: await ctBase({ pv_atual: 0, pv_max: 38, pv_temporario: 0, morte_sucessos: 1, morte_falhas: 2 }),
      notas: 'pv_atual não fica negativo (mínimo 0); morte_sucessos/morte_falhas permanecem inalterados pelo dano em si.'
    },
    {
      id: 'cura-nao-ultrapassa-pv-max',
      categoria: 'cura',
      descricao: 'Cura incrementa pv_atual sem ultrapassar pv_max.',
      origemReal: 'site/js/ficha-edicoes.js#aplicarDeltaSistema (usado pelo fluxo de cura/dano com teto=pv_max)',
      personagemAntes: await ctBase({ pv_atual: 30, pv_max: 38 }),
      operacao: { tipo: 'aplicar_cura', valor: 15 },
      personagemDepois: await ctBase({ pv_atual: 38, pv_max: 38 }),
      notas: 'aplicarDeltaSistema com teto=pv_max: Math.min(38, 45) = 38.'
    },
    {
      id: 'cura-a-partir-de-zero-reseta-salvaguardas-morte',
      categoria: 'cura',
      descricao: 'Quando uma cura eleva pv_atual de 0 para um valor positivo, morte_sucessos/morte_falhas são resetados a 0. Reflete sheet.js linhas 4106-4109.',
      origemReal: 'site/js/pages/sheet.js (handler de cura, linhas 4105-4110)',
      personagemAntes: await ctBase({ pv_atual: 0, pv_max: 38, morte_sucessos: 2, morte_falhas: 1 }),
      operacao: { tipo: 'aplicar_cura', valor: 8 },
      personagemDepois: await ctBase({ pv_atual: 8, pv_max: 38, morte_sucessos: 0, morte_falhas: 0 })
    },
    {
      id: 'pv-temporario-nao-acumula-usa-maior-valor',
      categoria: 'pv_temporario',
      descricao: 'PV temporário de uma nova fonte não soma ao existente: usa o maior valor entre o atual e o novo. Reflete sheet.js linhas 4125, 6278, 7253, 12840.',
      origemReal: 'site/js/pages/sheet.js (ex: linha 6278: char.pv_temporario = Math.max(char.pv_temporario || 0, temp))',
      personagemAntes: await ctBase({ pv_temporario: 8 }),
      operacao: { tipo: 'conceder_pv_temporario', valor: 5 },
      personagemDepois: await ctBase({ pv_temporario: 8 }),
      notas: 'Math.max(8, 5) = 8.'
    },
    {
      id: 'descanso-curto-nao-reseta-dados-de-vida',
      categoria: 'descansos',
      descricao: 'Descanso curto NÃO restaura dados_vida_usados. Recursos com custo "curto" (ex: Dádiva do Destino) são restaurados.',
      origemReal: 'site/js/regras-cobertura.js#restaurarRecursosTalentos (tipoDescanso "curto")',
      personagemAntes: await ctBase({ dados_vida_usados: 3, talentos: ['Dádiva do Destino'], recursos: { talentos: { dadiva_destino: { usado: true } } } }),
      operacao: { tipo: 'descanso', tipoDescanso: 'curto' },
      personagemDepois: await ctBase({ dados_vida_usados: 3, talentos: ['Dádiva do Destino'], recursos: { talentos: { dadiva_destino: { usado: false } } } })
    },
    {
      id: 'descanso-longo-reseta-dados-de-vida-morte-e-pv',
      categoria: 'descansos',
      descricao: 'Descanso longo: dados_vida_usados volta a 0, pv_atual volta a pv_max, morte_sucessos/morte_falhas voltam a 0, espacos_magia_extras é limpo. Reflete sheet.js linhas 4574-4595.',
      origemReal: 'site/js/pages/sheet.js (fluxo de descanso longo, ~linha 4574)',
      personagemAntes: await ctBase({ pv_atual: 10, pv_max: 38, dados_vida_usados: 4, morte_sucessos: 2, morte_falhas: 1, espacos_magia_extras: { 1: 2 } }),
      operacao: { tipo: 'descanso', tipoDescanso: 'longo' },
      personagemDepois: await ctBase({ pv_atual: 38, pv_max: 38, dados_vida_usados: 0, morte_sucessos: 0, morte_falhas: 0, espacos_magia_extras: {} })
    },
    {
      id: 'concentracao-nova-magia-remove-efeitos-da-anterior',
      categoria: 'concentracao',
      descricao: 'Efeitos mágicos com concentracao:true da magia anterior são removidos quando o personagem começa a concentrar em outra magia.',
      origemReal: 'site/js/pages/sheet.js#registrarConcentracaoMagiaPersonalizada linha 269: char.efeitos_magicos = char.efeitos_magicos.filter(efeito => !efeito.concentracao) antes de registrar a nova concentração.',
      personagemAntes: await ctBase({ efeitos_magicos: [{ nome: 'Armadura Arcana', tipo_efeito: 'base', valor: 13, concentracao: false }, { nome: 'Bênção', tipo: 'bonus_ataque', concentracao: true }] }),
      operacao: { tipo: 'iniciar_concentracao', novaMagia: 'Palavra Sagrada de Cura' },
      personagemDepois: await ctBase({ efeitos_magicos: [{ nome: 'Armadura Arcana', tipo_efeito: 'base', valor: 13, concentracao: false }] }),
      notas: 'Apenas o efeito não-concentração (Armadura Arcana) sobrevive.'
    },
    {
      id: 'condicao-adicionada-e-removida',
      categoria: 'condicoes',
      descricao: 'Adicionar/remover uma condição opera sobre o array `condicoes` (strings), sem estrutura adicional no baseline atual.',
      origemReal: 'site/js/pages/sheet.js (gestão de condicoes)',
      personagemAntes: await ctBase({ condicoes: [] }),
      operacao: { tipo: 'adicionar_condicao', condicao: 'Enjoo (leve)' },
      personagemDepois: await ctBase({ condicoes: ['Enjoo (leve)'] })
    },
    {
      id: 'inventario-equipar-item-e-toggle-nao-exclusivo',
      categoria: 'inventario',
      descricao: 'O toggle "equipado" de um item de inventário apenas seta char.inventario[idx].equipado = cb.checked (sheet.js:15707) — NÃO desequipa automaticamente outras armaduras. calcCA (utils.js:152) usa apenas a PRIMEIRA armadura encontrada via Array#find.',
      origemReal: 'site/js/pages/sheet.js linha 15707 + site/js/utils.js#calcCA linha 152',
      personagemAntes: await ctBase({ inventario: [
        { nome: 'Gibão de Couro', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '11', categoria: 'Leve', peso: '5 kg' } },
        { nome: 'Cota de Malha', tipo: 'armadura', equipado: false, quantidade: 1, dados: { ca: '16', categoria: 'Pesada', peso: '20 kg' } }
      ] }),
      operacao: { tipo: 'toggle_equipado', nome: 'Cota de Malha', equipado: true },
      personagemDepois: await ctBase({ inventario: [
        { nome: 'Gibão de Couro', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '11', categoria: 'Leve', peso: '5 kg' } },
        { nome: 'Cota de Malha', tipo: 'armadura', equipado: true, quantidade: 1, dados: { ca: '16', categoria: 'Pesada', peso: '20 kg' } }
      ] }),
      notas: 'Ambas as armaduras ficam equipado:true (nenhuma exclusão mútua no baseline atual).'
    },
    {
      id: 'moedas-pagar-custo-insuficiente',
      categoria: 'moedas',
      descricao: 'pagarCusto EXECUTADO de verdade: carteira insuficiente retorna sucesso:false e não altera as moedas.',
      origemReal: 'site/js/moedas.js#pagarCusto (EXECUTADO)',
      personagemAntes: await ctBase({ moedas: moedasFalhaAntes }),
      operacao: { tipo: 'pagar_custo', custoStr: '50 PO' },
      personagemDepois: await ctBase({ moedas: moedasFalhaResultado.moedas }),
      resultadoOperacao: { sucesso: moedasFalhaResultado.sucesso },
      notas: 'Total antes: 3 PO = 300 PC. Custo: 50 PO = 5000 PC. Insuficiente.'
    },
    {
      id: 'moedas-pagar-custo-converte-denominacao-menor',
      categoria: 'moedas',
      descricao: 'pagarCusto EXECUTADO de verdade: converte automaticamente moedas de denominação menor quando a denominação exata do custo não está disponível, redistribuindo o total pelo MENOR NÚMERO DE MOEDAS possível — o que pode significar usar a denominação MAIOR (ex: PL), não necessariamente a mesma do custo.',
      origemReal: 'site/js/moedas.js#pagarCusto (EXECUTADO)',
      personagemAntes: await ctBase({ moedas: moedasConverteAntes }),
      operacao: { tipo: 'pagar_custo', custoStr: '5 PO' },
      personagemDepois: await ctBase({ moedas: moedasConverteResultado.moedas }),
      resultadoOperacao: { sucesso: moedasConverteResultado.sucesso },
      notas: 'Carteira só tinha PP (60 PP = 600 PC). Custo de 5 PO = 500 PC. Restam 100 PC, redistribuídos gulosamente da maior denominação para a menor.'
    },
    {
      id: 'moedas-pagar-custo-sucesso',
      categoria: 'moedas',
      descricao: 'pagarCusto EXECUTADO de verdade: retira o custo em PC-equivalente e redistribui o restante pelo MENOR NÚMERO DE MOEDAS (guloso da maior denominação para a menor — distribuirCobre itera PL->PO->PE->PP->PC), não necessariamente na mesma denominação do custo original.',
      origemReal: 'site/js/moedas.js#pagarCusto (EXECUTADO)',
      personagemAntes: await ctBase({ moedas: moedasSucessoAntes }),
      operacao: { tipo: 'pagar_custo', custoStr: '50 PO' },
      personagemDepois: await ctBase({ moedas: moedasSucessoResultado.moedas }),
      resultadoOperacao: { sucesso: moedasSucessoResultado.sucesso },
      notas: '100 PO - 50 PO = 5000 PC restantes; distribuirCobre redistribui gulosamente da maior denominação (PL=1000) para baixo: 5000/1000 = 5 PL exatos, 0 nas demais.'
    },
    {
      id: 'recursos-talento-usado-e-restaurado',
      categoria: 'recursos',
      descricao: 'Marcar um recurso de talento como usado e restaurá-lo no próximo descanso aplicável.',
      origemReal: 'site/js/regras-cobertura.js#restaurarRecursosTalentos',
      personagemAntes: await ctBase({ talentos: ['Dádiva da Proeza em Combate'], recursos: { talentos: { dadiva_proeza_combate: { usado_no_turno: false } } } }),
      operacao: { tipo: 'usar_recurso_talento', talento: 'Dádiva da Proeza em Combate', campo: 'usado_no_turno' },
      personagemDepois: await ctBase({ talentos: ['Dádiva da Proeza em Combate'], recursos: { talentos: { dadiva_proeza_combate: { usado_no_turno: true } } } })
    },
    {
      id: 'edicao-manual-de-pv-max-e-depois-cura-do-sistema',
      categoria: 'edicoes',
      descricao: 'Uma edição manual de pv_max seguida por uma cura do sistema sobre pv_atual não remove o registro de edição de pv_max.',
      origemReal: 'site/js/ficha-edicoes.js#aplicarEdicao + #aplicarDeltaSistema',
      personagemAntes: await ctBase({ pv_max: 38, pv_atual: 20, edicoes: { versao: 1, campos: { pv_max: { original: 33, editadoEm: '2026-07-19T10:00:00.000Z', origem: 'manual' } } } }),
      operacao: { tipo: 'aplicar_cura', valor: 5 },
      personagemDepois: await ctBase({ pv_max: 38, pv_atual: 25, edicoes: { versao: 1, campos: { pv_max: { original: 33, editadoEm: '2026-07-19T10:00:00.000Z', origem: 'manual' } } } })
    },
    {
      id: 'levelup-pendente-por-falta-de-subclasse',
      categoria: 'levelup',
      descricao: 'subirDeNivel retorna pendência explícita quando o personagem chega no nível que exige escolha de subclasse e nenhuma foi informada.',
      origemReal: 'site/js/levelup.js#subirDeNivel (linhas 944-950)',
      personagemAntes: await ctBase({ classe: 'Guerreiro', subclasse: '', nivel: 2, xp: 1000 }),
      operacao: { tipo: 'subir_de_nivel', opcoes: {} },
      resultadoOperacao: { sucesso: false, pendente: true, tipo_pendencia: 'subclasse', mensagem: 'É necessário escolher uma subclasse para avançar para o nível 3' },
      personagemDepois: await ctBase({ classe: 'Guerreiro', subclasse: '', nivel: 2, xp: 1000 })
    },
    {
      id: 'levelup-nivel-maximo-recusado',
      categoria: 'levelup',
      descricao: 'subirDeNivel recusa avançar além do nível 20.',
      origemReal: 'site/js/levelup.js#subirDeNivel (linhas 886-888)',
      personagemAntes: await ctBase({ classe: 'Guerreiro', nivel: 20 }),
      operacao: { tipo: 'subir_de_nivel', opcoes: {} },
      resultadoOperacao: { sucesso: false, erro: 'Nível máximo já alcançado (20)' },
      personagemDepois: await ctBase({ classe: 'Guerreiro', nivel: 20 })
    },
    {
      id: 'levelup-xp-insuficiente-recusado',
      categoria: 'levelup',
      descricao: 'subirDeNivel recusa avançar quando o personagem não tem XP suficiente (a menos que opcoes.ignorar_xp seja true).',
      origemReal: 'site/js/levelup.js#subirDeNivel (linhas 890-897)',
      personagemAntes: await ctBase({ classe: 'Guerreiro', subclasse: 'Campeão', nivel: 1, xp: 0 }),
      operacao: { tipo: 'subir_de_nivel', opcoes: {} },
      resultadoOperacao: { sucesso: false, erroContem: 'XP insuficiente' },
      personagemDepois: await ctBase({ classe: 'Guerreiro', subclasse: 'Campeão', nivel: 1, xp: 0 })
    }
  ];

  // Verificação de sanidade do próprio gerador antes de gravar.
  if (moedasFalhaResultado.sucesso !== false) throw new Error('Esperava pagarCusto insuficiente falhar');
  if (moedasConverteResultado.sucesso !== true) throw new Error('Esperava pagarCusto de conversão suceder');
  if (moedasSucessoResultado.sucesso !== true) throw new Error('Esperava pagarCusto suceder');

  return writeFixture('tests/fixtures/expected/command-transitions.json', cases);
}

// ----------------------------------------------------------------
// expected/round-trips.json — EXECUTA salvarPersonagem/exportarTodos/
// importarPersonagens/listarPersonagens reais de store.js.
// ----------------------------------------------------------------
async function buildRoundTrips() {
  const store = await getStoreModule();

  // Caso 1: salvarPersonagem sobrescreve atualizado_em.
  resetFakeLocalStorage();
  let unfreeze = freezeClock('2026-01-10T08:00:00.000Z');
  const p1 = { id: 'rt01-rt01-rt01', nome: 'Round Trip Salvar', criado_em: '2026-01-10T08:00:00.000Z', atualizado_em: '2026-01-10T08:00:00.000Z' };
  unfreeze();
  const p1Antes = deepClone(p1);
  unfreeze = freezeClock('2026-07-26T00:00:00.000Z');
  const p1Depois = store.salvarPersonagem(deepClone(p1));
  unfreeze();

  // Caso 2: personagem novo sem id. gerarId() (site/js/utils.js) usa
  // Math.random() — para tornar a fixture 100% determinística e reproduzível
  // via `--check`, fixamos Math.random() só durante esta chamada (o formato
  // "xxxx-xxxx-xxxx" continua sendo produzido pela função real; apenas os
  // dígitos ficam fixos em 0, o que é honesto e documentado abaixo).
  resetFakeLocalStorage();
  unfreeze = freezeClock('2026-07-26T00:00:00.000Z');
  const realRandom = Math.random;
  Math.random = () => 0;
  const p2Depois = store.salvarPersonagem({ nome: 'Personagem Novo Sem Id' });
  Math.random = realRandom;
  unfreeze();
  const idGeradoReal = p2Depois.id;

  // Caso 3: exportar/importar preserva campos desconhecidos.
  resetFakeLocalStorage();
  unfreeze = freezeClock('2026-07-01T12:00:00.000Z');
  const p3Original = await personagemVazio({ id: 'rt02-rt02-rt02', nome: 'Round Trip Export/Import', _flag_beta_interface_nova: true, preferencias_ui: { tema: 'escuro' } });
  unfreeze();
  resetFakeLocalStorage();
  unfreeze = freezeClock('2026-07-01T12:00:00.000Z');
  store.salvarPersonagem(deepClone(p3Original));
  const exportado = store.exportarTodos();
  unfreeze();
  resetFakeLocalStorage();
  const countNovos = store.importarPersonagens(exportado);
  const listaAposImport = store.listarPersonagens();
  const p3AposRoundTrip = listaAposImport.find(p => p.id === 'rt02-rt02-rt02');

  // Caso 4: importar personagem inválido é descartado.
  resetFakeLocalStorage();
  const jsonImportado = [
    { id: 'ok1-ok1-ok1-ok1', nome: 'Válido', nivel: 1, atributos: { forca: 10 } },
    { id: '', nome: 'Sem Id', nivel: 1, atributos: {} },
    { id: 'ok2-ok2-ok2-ok2', nome: 'Nível Fora de Faixa', nivel: 25, atributos: {} }
  ];
  const countNovosCaso4 = store.importarPersonagens(JSON.stringify(jsonImportado));

  // Caso 5: idempotência de listarPersonagens (migração de po legado).
  resetFakeLocalStorage();
  globalThis.localStorage.setItem('dnd_personagens', JSON.stringify([{ id: 'rt03-rt03-rt03', nome: 'Idempotência de Leitura', po: 30 }]));
  const primeiraLeitura = store.listarPersonagens().find(p => p.id === 'rt03-rt03-rt03');
  const segundaLeitura = store.listarPersonagens().find(p => p.id === 'rt03-rt03-rt03');

  if (countNovos !== 1) throw new Error(`Esperava countNovos=1 no round-trip de export/import, obteve ${countNovos}`);
  if (!p3AposRoundTrip) throw new Error('Personagem não sobreviveu ao round-trip export/import');
  if (countNovosCaso4 !== 1) throw new Error(`Esperava countNovos=1 ao importar lista com 2 inválidos, obteve ${countNovosCaso4}`);
  if (JSON.stringify(primeiraLeitura) !== JSON.stringify(segundaLeitura)) throw new Error('listarPersonagens não é idempotente no caso de teste');

  return writeFixture('tests/fixtures/expected/round-trips.json', [
    {
      id: 'salvar-personagem-sobrescreve-atualizado-em',
      descricao: 'salvarPersonagem EXECUTADO de verdade: sempre sobrescreve atualizado_em com o relógio atual no momento da chamada, mesmo que o personagem já tenha um atualizado_em de entrada.',
      origemReal: 'site/js/store.js#salvarPersonagem (EXECUTADO, linha 82)',
      relogioFixado: '2026-07-26T00:00:00.000Z',
      personagemAntesDeSalvar: p1Antes,
      operacao: { fn: 'salvarPersonagem' },
      personagemDepoisDeSalvar: p1Depois,
      notas: 'atualizado_em de entrada (2026-01-10) é completamente ignorado; o campo de saída é sempre o relógio no momento de salvarPersonagem.'
    },
    {
      id: 'salvar-personagem-novo-define-id-e-criado-em',
      descricao: 'salvarPersonagem EXECUTADO de verdade sobre um personagem sem id: gera um id real (gerarId) e define criado_em, além de atualizado_em.',
      origemReal: 'site/js/store.js#salvarPersonagem (EXECUTADO, linhas 86-89)',
      relogioFixado: '2026-07-26T00:00:00.000Z',
      personagemAntesDeSalvar: { nome: 'Personagem Novo Sem Id' },
      operacao: { fn: 'salvarPersonagem' },
      personagemDepoisDeSalvar: p2Depois,
      notas: `id gerado por gerarId() real (site/js/utils.js), com Math.random() fixado em 0 apenas para esta chamada (determinismo do gerador de fixtures) — o valor "${idGeradoReal}" reflete o formato real "xxxx-xxxx-xxxx", não um id digitado à mão.`
    },
    {
      id: 'exportar-e-importar-preserva-campos-desconhecidos',
      descricao: 'exportarTodos + importarPersonagens EXECUTADOS de verdade: preserva campos desconhecidos do personagem inteiro.',
      origemReal: 'site/js/store.js#exportarTodos + #importarPersonagens + #_validarPersonagem (EXECUTADOS)',
      personagemOriginal: p3Original,
      operacao: { fn: 'exportarTodos->importarPersonagens' },
      personagemAposRoundTrip: p3AposRoundTrip,
      notas: 'importarPersonagens só adiciona o personagem à lista se nenhum outro com o mesmo id já existir.'
    },
    {
      id: 'importar-personagem-invalido-e-descartado',
      descricao: 'importarPersonagens EXECUTADO de verdade: descarta itens que falham em _validarPersonagem, continuando os demais.',
      origemReal: 'site/js/store.js#importarPersonagens (EXECUTADO, linhas 216-219)',
      jsonImportado,
      resultadoOperacao: { countNovos: countNovosCaso4 },
      notas: 'Apenas o primeiro item passa em _validarPersonagem; os outros dois são descartados sem interromper o loop.'
    },
    {
      id: 'migracoes-de-listarPersonagens-sao-idempotentes',
      descricao: 'listarPersonagens EXECUTADO de verdade duas vezes seguidas sobre o mesmo localStorage: produz exatamente o mesmo resultado (idempotência).',
      origemReal: 'site/js/store.js#listarPersonagens (EXECUTADO, linhas 50-71)',
      personagemArmazenado: { id: 'rt03-rt03-rt03', nome: 'Idempotência de Leitura', po: 30 },
      primeiraLeitura,
      segundaLeitura,
      notas: 'Primeira e segunda leitura produzem o mesmo objeto; o campo legado `po` já foi removido e não reaparece.'
    }
  ]);
}

// ----------------------------------------------------------------
// characters/baseline-field-inventory.json
// ----------------------------------------------------------------
const CATEGORIAS_VALIDAS = ['identity', 'build', 'state', 'override', 'metadata', 'compatibilityProjection', 'legacyPassthrough'];

async function buildBaselineFieldInventory() {
  const fieldInventoryCases = [
    { campo: 'id', classificacao: 'identity', origem: 'template', descricao: 'Identificador único do personagem (gerarId()).' },
    { campo: 'nome', classificacao: 'identity', origem: 'template', descricao: 'Nome do personagem.' },
    { campo: 'imagem', classificacao: 'identity', origem: 'template', descricao: 'Data URL do retrato (site/js/utils.js#processarImagemArquivo).' },
    { campo: 'nivel', classificacao: 'build', origem: 'template', descricao: 'Nível de personagem (1-20), avança via subirDeNivel.' },
    { campo: 'xp', classificacao: 'build', origem: 'template', descricao: 'Pontos de experiência acumulados.' },
    { campo: 'exaustao', classificacao: 'state', origem: 'template', descricao: 'Nível de exaustão (0-6), efeito temporário/reversível.' },
    { campo: 'classe', classificacao: 'build', origem: 'template', descricao: 'Classe escolhida (chave em site/js/dados-classes.js#CLASSES_INFO).' },
    { campo: 'subclasse', classificacao: 'build', origem: 'template', descricao: 'Subclasse escolhida.' },
    { campo: 'especie', classificacao: 'build', origem: 'template', descricao: 'Espécie escolhida.' },
    { campo: 'antecedente', classificacao: 'build', origem: 'template', descricao: 'Antecedente escolhido.' },
    { campo: 'alinhamento', classificacao: 'identity', origem: 'template', descricao: 'Alinhamento moral/ético (flavor, não afeta mecânica).' },
    { campo: 'ordem_divina', classificacao: 'build', origem: 'template', descricao: 'Escolha de Ordem Divina (Clérigo).' },
    { campo: 'ordem_primal', classificacao: 'build', origem: 'template', descricao: 'Escolha de Ordem Primal (Druida).' },
    { campo: 'tracos_escolhidos', classificacao: 'build', origem: 'template', descricao: 'Traços de espécie escolhidos.' },
    { campo: 'extras_classe', classificacao: 'build', origem: 'template', descricao: 'Escolhas extras de classe (ex: estilo de luta selecionado).' },
    { campo: 'escolhas_classe', classificacao: 'build', origem: 'template', descricao: 'Escolhas de classe (especialista, acadêmico, estilo_luta, etc).' },
    { campo: 'escolhas_antecedente', classificacao: 'build', origem: 'template', descricao: 'Escolhas de antecedente.' },
    { campo: 'proficiencias_extra', classificacao: 'build', origem: 'template', descricao: 'Proficiências extras concedidas fora do fluxo padrão.' },
    { campo: 'atributos', classificacao: 'build', origem: 'template', descricao: 'Valores finais de atributo (após bônus de antecedente).' },
    { campo: 'configuracao_criacao', classificacao: 'metadata', origem: 'template', descricao: 'Metadados de COMO os atributos foram criados — usado só para validar edições futuras.' },
    { campo: 'edicoes', classificacao: 'override', origem: 'template', descricao: 'Estado de edições manuais reversíveis da ficha (site/js/ficha-edicoes.js).' },
    { campo: 'atributos_base', classificacao: 'build', origem: 'template', descricao: 'Valores de atributo antes do bônus de antecedente.' },
    { campo: 'bonus_antecedente', classificacao: 'build', origem: 'template', descricao: 'Bônus de atributo concedido pelo antecedente.' },
    { campo: 'pv_max', classificacao: 'state', origem: 'template', descricao: 'PV máximo atual.' },
    { campo: 'pv_atual', classificacao: 'state', origem: 'template', descricao: 'PV atual (dano/cura).' },
    { campo: 'pv_temporario', classificacao: 'state', origem: 'template', descricao: 'PV temporário atual (campo canônico; ver compatibilityProjection pv_temp para o alias divergente de impressão/PDF).' },
    { campo: 'dados_vida_total', classificacao: 'build', origem: 'template', descricao: 'Total de dados de vida disponíveis (cresce com nível).' },
    { campo: 'dados_vida_usados', classificacao: 'state', origem: 'template', descricao: 'Quantos dados de vida já foram gastos desde o último descanso longo.' },
    { campo: 'pericias_proficientes', classificacao: 'build', origem: 'template', descricao: 'Perícias com proficiência.' },
    { campo: 'pericias_expertise', classificacao: 'build', origem: 'template', descricao: 'Perícias com expertise (bônus dobrado).' },
    { campo: 'salvaguardas_proficientes', classificacao: 'build', origem: 'template', descricao: 'Salvaguardas com proficiência.' },
    { campo: 'inventario', classificacao: 'state', origem: 'template', descricao: 'Itens carregados/equipados.' },
    { campo: 'escolha_equip_classe', classificacao: 'build', origem: 'template', descricao: 'Pacote de equipamento inicial escolhido (classe).' },
    { campo: 'escolha_equip_antecedente', classificacao: 'build', origem: 'template', descricao: 'Pacote de equipamento inicial escolhido (antecedente).' },
    { campo: 'moedas', classificacao: 'state', origem: 'template', descricao: 'Carteira multi-moeda atual (site/js/moedas.js).' },
    { campo: 'magias_conhecidas', classificacao: 'state', origem: 'template', descricao: 'Magias conhecidas atualmente preparadas/ativas.' },
    { campo: 'magias_preparadas', classificacao: 'state', origem: 'template', descricao: 'Magias preparadas atualmente.' },
    { campo: 'grimorio', classificacao: 'state', origem: 'template', descricao: 'Grimório do Mago.' },
    { campo: 'espacos_magia', classificacao: 'state', origem: 'template', descricao: 'Espaços de magia por círculo.' },
    { campo: 'talentos', classificacao: 'build', origem: 'template', descricao: 'Talentos adquiridos.' },
    { campo: 'itens_customizados', classificacao: 'build', origem: 'template', descricao: 'Definições de itens homebrew autorados pelo jogador.' },
    { campo: 'magias_customizadas', classificacao: 'build', origem: 'template', descricao: 'Definições de magias homebrew autoradas pelo jogador.' },
    { campo: 'efeitos_magicos', classificacao: 'state', origem: 'template', descricao: 'Efeitos mágicos ativos no momento.' },
    { campo: 'usos_habilidades', classificacao: 'state', origem: 'template', descricao: 'Contagem de usos/recargas de habilidades.' },
    { campo: 'aparencia', classificacao: 'identity', origem: 'template', descricao: 'Texto de flavor (roleplay).' },
    { campo: 'personalidade', classificacao: 'identity', origem: 'template', descricao: 'Texto de flavor (roleplay).' },
    { campo: 'ideais', classificacao: 'identity', origem: 'template', descricao: 'Texto de flavor (roleplay).' },
    { campo: 'lacos', classificacao: 'identity', origem: 'template', descricao: 'Texto de flavor (roleplay).' },
    { campo: 'defeitos', classificacao: 'identity', origem: 'template', descricao: 'Texto de flavor (roleplay).' },
    { campo: 'historia_personagem', classificacao: 'identity', origem: 'template', descricao: 'Texto de flavor (roleplay).' },
    { campo: 'notas', classificacao: 'identity', origem: 'template', descricao: 'Notas livres do jogador.' },
    { campo: 'idiomas', classificacao: 'build', origem: 'template', descricao: 'Idiomas conhecidos.' },
    { campo: 'tamanho', classificacao: 'build', origem: 'template', descricao: 'Tamanho da criatura.' },
    { campo: 'config', classificacao: 'metadata', origem: 'template', descricao: 'Preferências de comportamento da própria ficha.' },
    { campo: 'condicoes', classificacao: 'state', origem: 'template', descricao: 'Condições ativas no momento.' },
    { campo: 'resistencias', classificacao: 'build', origem: 'template', descricao: 'Resistências a dano.' },
    { campo: 'vulnerabilidades', classificacao: 'build', origem: 'template', descricao: 'Vulnerabilidades a dano.' },
    { campo: 'imunidades', classificacao: 'build', origem: 'template', descricao: 'Imunidades a dano/condição.' },
    { campo: 'proficiencias_ferramentas', classificacao: 'build', origem: 'template', descricao: 'Proficiências em ferramentas.' },
    { campo: 'proficiencias_instrumentos', classificacao: 'build', origem: 'template', descricao: 'Proficiências em instrumentos musicais.' },
    { campo: 'talentos_flags', classificacao: 'build', origem: 'template', descricao: 'Flags booleanas auxiliares de talentos.' },
    { campo: 'talentos_parametros', classificacao: 'build', origem: 'template', descricao: 'Parâmetros configuráveis de talentos.' },
    { campo: 'criado_em', classificacao: 'metadata', origem: 'template', descricao: 'Timestamp ISO de criação.' },
    { campo: 'atualizado_em', classificacao: 'metadata', origem: 'template', descricao: 'Timestamp ISO da última gravação.' },

    // Campos monólito explicitamente exigidos pelo brief:
    { campo: 'po', classificacao: 'legacyPassthrough', origem: 'monólito (pré-migração)', descricao: 'Campo legado de ouro único; migrarMoedasLegado o remove após migrar para `moedas` (site/js/store.js, EXECUTADO em legacy-po.json).' },
    { campo: 'pv_temp', classificacao: 'compatibilityProjection', origem: 'monólito (leitura de impressão/PDF)', descricao: 'Lido apenas por gerarHtmlImpressao/_montarDadosCartao (sheet.js:16932, 17634) como alias quebrado de pv_temporario — nunca é escrito (ver derived-values.json).' },
    { campo: '_slots_magia_livre', classificacao: 'state', origem: 'monólito (sheet.js)', descricao: 'Contador de vagas de magia conhecida liberadas por ajuste automático de migração (sheet.js:2916-2919, 2949, 14722).' },
    { campo: 'espacos_magia_extras', classificacao: 'state', origem: 'monólito (sheet.js)', descricao: 'Espaços de magia extras concedidos por círculo (sheet.js:2735, 5730-5731); zerado em descanso longo.' },
    { campo: 'recursos', classificacao: 'state', origem: 'monólito (sheet.js / regras-cobertura.js)', descricao: 'Estado de recursos de talentos/subclasses com uso limitado; restaurado por restaurarRecursosTalentos.' },
    { campo: 'maestrias_arma', classificacao: 'build', origem: 'monólito (sheet.js)', descricao: 'Maestrias de arma escolhidas (sheet.js:7598-7781).' },
    { campo: 'manobras_conhecidas', classificacao: 'build', origem: 'monólito (levelup.js / sheet.js)', descricao: 'Manobras de combate conhecidas (levelup.js:1586-1597, sheet.js:1087).' },
    { campo: 'iniciado_em_magia', classificacao: 'legacyPassthrough', origem: 'monólito (formato legado, pré-migração)', descricao: 'Formato antigo (objeto único); migrarIniciadoEmMagiaInstancias (sheet.js:8414) converte e remove.' },
    { campo: 'iniciado_em_magia_instancias', classificacao: 'build', origem: 'monólito (sheet.js, formato atual)', descricao: 'Array de instâncias do talento Iniciado em Magia.' },
    { campo: 'adepto_elemental_tipo', classificacao: 'legacyPassthrough', origem: 'monólito (formato legado, pré-migração)', descricao: 'Formato antigo (string única); migrarAdeptoElementalTipos (sheet.js:8430) converte e remove.' },
    { campo: 'adepto_elemental_tipos', classificacao: 'build', origem: 'monólito (sheet.js, formato atual)', descricao: 'Array de tipos de energia escolhidos para Adepto Elemental.' },
    { campo: 'bonus_pv_dadiva_fortitude', classificacao: 'state', origem: 'monólito (levelup.js / regras-cobertura.js)', descricao: 'PV máximo extra aplicado pelo talento Dádiva da Fortitude (valor fixo 40) — levelup.js:239,1380; regras-cobertura.js:325.' },
    { campo: 'bonus_pv_anao_aplicado', classificacao: 'state', origem: 'monólito (creator.js / sheet.js)', descricao: 'PV extra já aplicado pelo traço de espécie Anão — sheet.js:1023-1030.' },
    { campo: 'bonus_pv_vigoroso_aplicado', classificacao: 'state', origem: 'monólito (creator.js / sheet.js)', descricao: 'PV extra já aplicado pelo talento/traço "Vigoroso" — sheet.js:1038-1045.' },
    { campo: 'morte_sucessos', classificacao: 'state', origem: 'monólito (sheet.js)', descricao: 'Salvaguardas contra morte bem-sucedidas (0-3); resetado ao curar de 0 PV (sheet.js:4106-4109, 4578).' },
    { campo: 'morte_falhas', classificacao: 'state', origem: 'monólito (sheet.js)', descricao: 'Salvaguardas contra morte falhas (0-3).' },

    // Campos adicionais encontrados pela revisão independente (varredura de
    // atribuições `char.<campo> =` em sheet.js/creator.js/levelup.js):
    { campo: 'pv_max_override', classificacao: 'override', origem: 'monólito (sheet.js)', descricao: 'Override manual que capa/substitui o pv_max calculado (sheet.js:1014,1029,1044 e 4565-4572) — mecanismo de override paralelo a `edicoes`, mas específico de PV máximo.' },
    { campo: 'escolhas_talento', classificacao: 'build', origem: 'monólito (levelup.js / creator.js / sheet.js)', descricao: 'Escolhas feitas ao adquirir talentos, por contexto (antecedente, versatil, levelup_N) — levelup.js:248-249,1308-1310; creator.js:1686-1761,1953-1961; consumido por migrarPericiasTalentos (sheet.js:3115).' },
    { campo: 'inspiracao_heroica', classificacao: 'state', origem: 'monólito (sheet.js)', descricao: 'Contagem de usos de Inspiração Heroica disponíveis — recurso de uso limitado, reseta em descanso.' },
    { campo: 'instrumento_classe_escolhido', classificacao: 'build', origem: 'monólito (sheet.js)', descricao: 'Instrumento musical escolhido como proficiência de classe (ex: Bardo).' },
    { campo: 'talentos_via_invocacao', classificacao: 'build', origem: 'monólito (sheet.js)', descricao: 'Lista de talentos concedidos indiretamente por uma invocação/escolha (usada para detectar novos talentos concedidos, ver sheet.js função de invocações).' },
    { campo: 'talento_versatil', classificacao: 'legacyPassthrough', origem: 'monólito (formato legado, sheet.js)', descricao: 'Talento único legado do traço Versátil do Humano (sheet.js:3082); migrarTalentoVersatilHumano garante presença em `talentos` mas não remove este campo (diferente de iniciado_em_magia/adepto_elemental_tipo) — mantido apenas para leitura de compatibilidade.' },
    { campo: 'talento_antecedente', classificacao: 'build', origem: 'monólito (sheet.js / creator.js)', descricao: 'Talento concedido pelo antecedente escolhido na criação.' },
    { campo: 'pericia_especie', classificacao: 'legacyPassthrough', origem: 'monólito (formato legado, sheet.js)', descricao: 'Formato legado (perícia única) de espécie com escolha de perícia (sheet.js:3092); migrarPericiaEspecie copia para pericias_proficientes mas não remove o campo original.' },
    { campo: 'pericias_especie', classificacao: 'build', origem: 'monólito (sheet.js, formato atual/array)', descricao: 'Formato atual (array) de perícias concedidas por espécie, ex: Kenku (sheet.js:3101); migrarPericiasEspecie copia para pericias_proficientes.' }
  ];

  for (const item of fieldInventoryCases) {
    if (!CATEGORIAS_VALIDAS.includes(item.classificacao)) {
      throw new Error(`Classificação inválida para campo ${item.campo}: ${item.classificacao}`);
    }
  }

  return writeFixture('tests/fixtures/characters/baseline-field-inventory.json', fieldInventoryCases.map((item, idx) => ({
    id: `campo-${String(idx + 1).padStart(2, '0')}-${item.campo.replace(/[^a-zA-Z0-9]/g, '_')}`,
    ...item
  })));
}

// ================================================================
// Orquestração
// ================================================================
export async function buildAllFixtures() {
  const builders = [
    buildLegacyMinimal, buildLegacyAllFields, buildLegacyPo, buildLegacyEdicoes,
    buildLegacyAllClasses, buildLegacyKnownCasters, buildLegacyPreparedCasters,
    buildLegacyCustomSpellsItems, buildLegacyResourcesEdits, buildLegacyMigrationStages,
    buildLegacyUnknownFields, buildV2BaselineCompatible, buildV2IdentityConflict,
    buildFutureV3, buildNearLimits, buildSyncQueue, buildDerivedValues,
    buildCommandTransitions, buildRoundTrips, buildBaselineFieldInventory
  ];
  const results = [];
  for (const build of builders) {
    results.push(await build());
  }
  return results;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const results = await buildAllFixtures();
  let mismatches = 0;
  for (const { relPath, content } of results) {
    const relForLog = path.relative(repoRoot, relPath);
    if (checkOnly) {
      const onDisk = fs.existsSync(relPath) ? fs.readFileSync(relPath, 'utf8') : null;
      // Ignora apenas o campo generatedAt na comparação de --check (o clock
      // congelado usado no CLI de update pode diferir por segundos).
      const normalize = (s) => s && s.replace(/"generatedAt":\s*"[^"]*"/, '"generatedAt":""');
      if (normalize(onDisk) !== normalize(content)) {
        console.error(`[generate-baseline-fixtures] DIVERGENTE: ${relForLog}`);
        mismatches++;
      } else {
        console.log(`[generate-baseline-fixtures] OK: ${relForLog}`);
      }
    } else {
      fs.writeFileSync(relPath, content);
      console.log(`[generate-baseline-fixtures] escrito: ${relForLog}`);
    }
  }
  if (checkOnly && mismatches > 0) {
    console.error(`[generate-baseline-fixtures] ${mismatches} fixture(s) divergente(s) do que a fonte real produziria.`);
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main().catch(err => {
    console.error('[generate-baseline-fixtures] ERRO:', err);
    process.exitCode = 1;
  });
}
