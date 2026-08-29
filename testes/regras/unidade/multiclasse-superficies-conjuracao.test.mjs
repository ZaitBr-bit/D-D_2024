// ============================================================
// Superficies de conjuracao: superficiesDeConjuracao (Tarefa 1 do
// sub-projeto "tela de Magias por classe").
//
// Nenhum teste aqui pode passar antes da implementacao: rode o arquivo
// contra a arvore intacta e confirme `# pass 0` antes de codar.
//
// O caso que motiva a funcao: um Ladino 5/Mago 1 hoje nao ve as magias do
// Mago -- a tela inteira decide pela classe INICIAL. Os oraculos abaixo
// medem "quais superficies de conjuracao este personagem tem", nao "qual a
// CD/ataque por classe" (isso ja e' conjuracoesPorClasse, em utils.js).
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

test('ORACULO 1 -- o caso reportado: Ladino 5/Mago 1 ve o Mago', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Ladino', nivel: 5 },
    { classe: 'Mago', nivel: 1 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup.length, 1,
    'Ladino nao conjura (sem Trapaceiro Arcano) -- so o Mago e superficie');
  assert.equal(sup[0].classe, 'Mago');
  assert.equal(sup[0].nivelClasse, 1,
    'nivel NA CLASSE do Mago, nao o nivel TOTAL (6)');
  assert.equal(sup[0].listaMagias, 'Mago');
  assert.equal(sup[0].usaGrimorio, true, 'Mago tem grimorio');
});

test('ORACULO 2 -- zero superficies: Barbaro 5 puro nao conjura', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]);
  assert.deepEqual(mc.superficiesDeConjuracao(p), []);
});

test('ORACULO 3 -- duas superficies, na ordem de aquisicao: Clerigo 5/Mago 5', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Clérigo', nivel: 5 },
    { classe: 'Mago', nivel: 5 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup.length, 2);
  assert.deepEqual(sup.map((s) => s.classe), ['Clérigo', 'Mago'],
    'ordem de aquisicao (classe inicial primeiro), nao ordem alfabetica');
  assert.equal(sup[0].nivelClasse, 5);
  assert.equal(sup[1].nivelClasse, 5);
});

// ORACULO 4 -- este e' o que pega o uso da funcao ERRADA
// (`classesConjuradoras`, no mesmo arquivo): ela exclui de proposito
// `categoria === 'pacto'` (docblock ao lado: "Bruxo fica DE FORA"). Se
// superficiesDeConjuracao reaproveitasse aquele filtro em vez da base de
// conjuracoesPorClasse, o Bruxo desapareceria da tela -- metade de um
// Bruxo/Mago escondida em silencio. Confirmado por mutacao: ver
// task-1-report.md, secao "Prova de que os oraculos nao sao vazios".
test('ORACULO 4 -- o Bruxo nao pode sumir: Guerreiro 5/Bruxo 5', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5 },
    { classe: 'Bruxo', nivel: 5 },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.ok(sup.some((s) => s.classe === 'Bruxo'),
    'Bruxo tem Magia de Pacto -- categoria "pacto", excluida por classesConjuradoras ' +
    'de proposito, mas ele TEM de aparecer aqui: a tela precisa mostrar as magias dele');
});

// ORACULO 5 -- este e' o que pega listaMagias e usaGrimorio colapsados numa
// coisa so: um Cavaleiro Mistico prepara/conhece da lista do MAGO mas nao
// tem grimorio proprio (so a classe Mago guarda magias num grimorio
// fisico). Confirmado por mutacao: ver task-1-report.md.
test('ORACULO 5 -- subclasse conjuradora: Cavaleiro Mistico usa a lista do Mago sem grimorio', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([
    { classe: 'Guerreiro', nivel: 5, subclasse: 'Cavaleiro Místico' },
  ]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup.length, 1);
  assert.equal(sup[0].classe, 'Guerreiro');
  assert.equal(sup[0].listaMagias, 'Mago',
    'Cavaleiro Mistico prepara/conhece magias DE MAGO (Classes.md:3968)');
  assert.equal(sup[0].usaGrimorio, false,
    'so a classe Mago tem grimorio -- um Cavaleiro Mistico NAO tem, mesmo usando a lista do Mago');
});

test('ORACULO 6 -- classe unica nao muda nada: Mago 5 puro', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup.length, 1);
  assert.equal(sup[0].nivelClasse, p.nivel,
    'classe unica: o nivel NA CLASSE e o nivel TOTAL do espelho sao o mesmo numero');
  assert.equal(sup[0].classe, 'Mago');
  assert.equal(sup[0].listaMagias, 'Mago');
  assert.equal(sup[0].usaGrimorio, true);
});

// ORACULO 7 -- invariante de aceitacao: se as duas funcoes discordarem
// sobre "este personagem conjura por alguma classe?", uma das duas esta
// errada -- e conjuraPorAlgumaClasse ja tem mais uso no app, entao a
// suspeita e' superficiesDeConjuracao.
test('ORACULO 7 -- invariante: length > 0 concorda com conjuraPorAlgumaClasse, para todos os casos acima', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const casos = [
    await personagemMulticlasse([{ classe: 'Ladino', nivel: 5 }, { classe: 'Mago', nivel: 1 }]),
    await personagemMulticlasse([{ classe: 'Bárbaro', nivel: 5 }]),
    await personagemMulticlasse([{ classe: 'Clérigo', nivel: 5 }, { classe: 'Mago', nivel: 5 }]),
    await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5 }, { classe: 'Bruxo', nivel: 5 }]),
    await personagemMulticlasse([{ classe: 'Guerreiro', nivel: 5, subclasse: 'Cavaleiro Místico' }]),
    await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]),
  ];
  for (const p of casos) {
    const temSuperficie = mc.superficiesDeConjuracao(p).length > 0;
    const conjuraPorto = mc.conjuraPorAlgumaClasse(p);
    assert.equal(temSuperficie, conjuraPorto,
      `divergencia para classes ${JSON.stringify(p.classes.map((c) => c.classe))}: ` +
      `superficiesDeConjuracao diz ${temSuperficie}, conjuraPorAlgumaClasse diz ${conjuraPorto}`);
  }
});

// ============================================================
// mapaDados: opcional, so para a tabela. A funcao continua PURA e
// testavel fora do navegador sem ele -- os sete oraculos acima nunca o
// passam, de proposito, para provar isso.
// ============================================================

test('tabela vem null quando mapaDados nao e passado', async () => {
  const { multiclasseConjuracao: mc } = await modulosApp();
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const sup = mc.superficiesDeConjuracao(p);
  assert.equal(sup[0].tabela, null);
});

test('tabela vem do mapaDados quando passado, por identidade -- MESMO objeto que dadosDe(classe) devolveria', async () => {
  const { multiclasseConjuracao: mc, db } = await modulosApp();
  const dadosMago = await db.getClasse('Mago');
  const mapa = new Map([['Mago', dadosMago]]);
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 5 }]);
  const sup = mc.superficiesDeConjuracao(p, mapa);
  assert.equal(sup[0].tabela, dadosMago.tabela_caracteristicas,
    'mesmo objeto (identidade), nao uma copia de valor -- fetchJSON cacheia em memoria por caminho');
});
