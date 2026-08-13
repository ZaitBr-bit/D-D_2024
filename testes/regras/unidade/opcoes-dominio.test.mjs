import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, lerTalentosDados } from './harness.mjs';

// opcoes-dominio.js passou a importar levelup.js (achado C2 da revisão
// final: motivoPreRequisito delega a elegibilidade para
// talentoElegivelParaPersonagem em vez de reimplementá-la) -- e levelup.js
// importa utils.js, que toca `window` no top-level. `modulosApp()` (mesmo
// harness usado pelos outros motores de unidade) instala os stubs de
// navegador antes de qualquer import de módulo do app; por isso o import
// de opcoes-dominio.js aqui precisa ser DINÂMICO, depois dele, e não
// estático no topo do arquivo (um `import` estático seria avaliado antes
// dos stubs existirem e lançaria "window is not defined").
await modulosApp();
const { deTalentos, deArmas, deMagias, deManobras, deEstilosLuta, rotuloPericia, motivoPreRequisito } =
  await import('../../../site/js/opcoes-dominio.js');

test('deTalentos: resumo vem dos nomes dos benefícios', () => {
  const [o] = deTalentos([{
    nome: 'Agressor', categoria: 'Geral', prerequisito: 'Nível 4 ou superior',
    beneficios: [{ nome: 'Aumento no Valor de Atributo', descricao: 'x' },
                 { nome: 'Corrida Aprimorada', descricao: 'y' }],
  }]);
  assert.equal(o.resumo, 'Aumento no Valor de Atributo · Corrida Aprimorada');
  assert.equal(o.grupo, 'Geral');
  assert.equal(o.bloqueado, null);
});

test('deTalentos: já possuído vira bloqueado com motivo', () => {
  const [o] = deTalentos([{ nome: 'Alerta', categoria: 'de Origem', beneficios: [] }],
    { jaPossui: new Set(['Alerta']) });
  assert.equal(o.bloqueado.motivo, 'você já possui este talento');
});

test('deTalentos: já possuído mas Repetível não bloqueia', () => {
  const [o] = deTalentos([{
    nome: 'Aumento no Valor de Atributo', categoria: 'Geral',
    beneficios: [{ nome: 'Repetível', descricao: 'x' }],
  }], { jaPossui: new Set(['Aumento no Valor de Atributo']) });
  assert.equal(o.bloqueado, null);
});

test('motivoPreRequisito: nível insuficiente', () => {
  const t = { prerequisito: 'Nível 19 ou superior' };
  assert.equal(motivoPreRequisito(t, { nivel: 5 }), 'exige nível 19 — você está no 5');
  assert.equal(motivoPreRequisito(t, { nivel: 19 }), null);
});

test('motivoPreRequisito: atributo, bastando um dos dois', () => {
  const t = { prerequisito: 'Nível 4 ou superior, Força ou Destreza 13 ou superior' };
  const char = { nivel: 4, atributos: { forca: 10, destreza: 14 } };
  assert.equal(motivoPreRequisito(t, char), null);
  const fraco = { nivel: 4, atributos: { forca: 10, destreza: 10 } };
  assert.equal(motivoPreRequisito(t, fraco), 'exige Força ou Destreza 13 — você tem 10/10');
});

test('motivoPreRequisito: sem pré-requisito é sempre elegível', () => {
  assert.equal(motivoPreRequisito({ prerequisito: '' }, { nivel: 1 }), null);
});

// ------------------------------------------------------------------
// Achado C2 da revisão final: a regex de atributo de motivoPreRequisito
// exigia " ou " entre os nomes; os dados reais também usam vírgula
// ("Inteligência, Sabedoria ou Carisma 13 ou superior"), e a função não
// entendia "Característica de Estilo de Luta", "Característica Conjuração
// ou Magia de Pacto", "Treinamento com Armadura ..." nem "Característica
// de Conjuração" -- 19 talentos ficavam sem aviso nenhum. A correção deixa
// de reimplementar a regra: motivoPreRequisito agora delega a
// ELEGIBILIDADE para talentoElegivelParaPersonagem (levelup.js, a mesma
// engine que filtra a lista de talentos da subida de nível) e só redige o
// texto. Os testes abaixo cobrem as 18 formas distintas de `prerequisito`
// hoje em dados/talentos/talentos.json (levantadas com um script, não
// supostas), agrupadas por família.
// ------------------------------------------------------------------

test('motivoPreRequisito: reproduz a falha concreta relatada (C2) -- Mago Int 16/Sab 10/Car 10 vê Conjurador Ritualista liberado', () => {
  // Mesmo talento e mesmo cenário do achado da revisão final: nível 3->4,
  // Inteligência 16 (>= 13), Sabedoria e Carisma 10 (< 13) -- basta UM dos
  // três atender, e Inteligência atende. Antes da correção, a regex só
  // enxergava "Sabedoria ou Carisma" (perdia "Inteligência," por causa da
  // vírgula) e bloqueava o talento por engano.
  const conjuradorRitualista = {
    nome: 'Conjurador Ritualista',
    prerequisito: 'Nível 4 ou superior, Inteligência, Sabedoria ou Carisma 13 ou superior',
  };
  const mago = {
    classe: 'Mago', nivel: 4,
    atributos: { forca: 10, destreza: 12, constituicao: 12, inteligencia: 16, sabedoria: 10, carisma: 10 },
  };
  assert.equal(motivoPreRequisito(conjuradorRitualista, mago), null,
    'Conjurador Ritualista deveria estar LIBERADO (Inteligência 16 atende) -- se voltar a texto não-null, a regressão C2 voltou');
});

test('motivoPreRequisito: as 18 formas reais de prerequisito em dados/talentos/talentos.json concordam com talentoElegivelParaPersonagem', async () => {
  const { levelup } = await modulosApp();
  const todos = lerTalentosDados();
  const prerequisitosUnicos = [...new Set(todos.map(t => t.prerequisito).filter(Boolean))];

  // Levantado ao vivo (não suposto): 18 formas distintas hoje. Se este
  // número mudar, é sinal de que uma forma nova entrou em talentos.json --
  // vale conferir se ela cai numa das famílias já cobertas abaixo antes de
  // só atualizar o número.
  assert.equal(prerequisitosUnicos.length, 18,
    `esperava 18 formas distintas de prerequisito, achou ${prerequisitosUnicos.length}: ` +
    JSON.stringify(prerequisitosUnicos));

  // Um personagem "forte": nível 20, todos os atributos 18, conjurador
  // (Mago), com armadura pesada/escudo e um Estilo de Luta escolhido --
  // deveria passar em TODO pré-requisito de atributo/nível/conjuração/
  // armadura/estilo de luta do catálogo.
  const forte = {
    classe: 'Mago', nivel: 20,
    atributos: { forca: 18, destreza: 18, constituicao: 18, inteligencia: 18, sabedoria: 18, carisma: 18 },
    caracteristica_conjuracao: true,
    proficiencias_armaduras: ['Leve', 'Média', 'Pesada', 'Escudo'],
    escolhas_classe: { estilo_luta: ['Defensivo'] },
  };
  // Um personagem "fraco": nível 1, todos os atributos 8, sem conjuração,
  // sem treinamento de armadura, sem estilo de luta -- deveria falhar em
  // todo pré-requisito não-vazio do catálogo.
  const fraco = {
    classe: 'Ladino', nivel: 1,
    atributos: { forca: 8, destreza: 8, constituicao: 8, inteligencia: 8, sabedoria: 8, carisma: 8 },
  };

  for (const prerequisito of prerequisitosUnicos) {
    const talento = { nome: `[teste] ${prerequisito}`, prerequisito };

    const elegivelForte = levelup.talentoElegivelParaPersonagem(forte, talento, forte.nivel, { permitirExistente: true });
    const motivoForte = motivoPreRequisito(talento, forte);
    assert.equal(motivoForte === null, elegivelForte,
      `prerequisito ${JSON.stringify(prerequisito)}: talentoElegivelParaPersonagem disse ` +
      `${elegivelForte} para o personagem forte, mas motivoPreRequisito devolveu ${JSON.stringify(motivoForte)}`);

    const elegivelFraco = levelup.talentoElegivelParaPersonagem(fraco, talento, fraco.nivel, { permitirExistente: true });
    const motivoFraco = motivoPreRequisito(talento, fraco);
    assert.equal(motivoFraco === null, elegivelFraco,
      `prerequisito ${JSON.stringify(prerequisito)}: talentoElegivelParaPersonagem disse ` +
      `${elegivelFraco} para o personagem fraco, mas motivoPreRequisito devolveu ${JSON.stringify(motivoFraco)}`);
    // O personagem fraco não atende NENHUM pré-requisito não-vazio do
    // catálogo real -- se algum motivo vier null aqui, ou a engine ou a
    // fixture estão errados.
    assert.equal(elegivelFraco, false,
      `prerequisito ${JSON.stringify(prerequisito)}: personagem fraco deveria ser inelegível`);
    assert.notEqual(motivoFraco, null,
      `prerequisito ${JSON.stringify(prerequisito)}: motivoPreRequisito deveria explicar por que o ` +
      `personagem fraco não atende -- ficou sem aviso nenhum (o próprio bug do achado C2)`);
  }
});

test('motivoPreRequisito: família "Característica de Estilo de Luta" -- exige um estilo já escolhido', () => {
  const t = { prerequisito: 'Característica de Estilo de Luta' };
  assert.equal(motivoPreRequisito(t, { classe: 'Guerreiro', nivel: 4, escolhas_classe: { estilo_luta: ['Defensivo'] } }), null);
  const motivo = motivoPreRequisito(t, { classe: 'Guerreiro', nivel: 4, escolhas_classe: {} });
  assert.match(motivo, /Estilo de Luta/);
});

test('motivoPreRequisito: família "Característica Conjuração ou Magia de Pacto"', () => {
  const t = { prerequisito: 'Nível 4 ou superior, Característica Conjuração ou Magia de Pacto' };
  assert.equal(motivoPreRequisito(t, { classe: 'Mago', nivel: 4 }), null);
  const motivo = motivoPreRequisito(t, { classe: 'Guerreiro', nivel: 4 });
  assert.match(motivo, /Conjuração|Pacto/);
});

test('motivoPreRequisito: família "Característica de Conjuração"', () => {
  const t = { prerequisito: 'Nível 19 ou superior, Característica de Conjuração' };
  assert.equal(motivoPreRequisito(t, { classe: 'Mago', nivel: 19 }), null);
  const motivo = motivoPreRequisito(t, { classe: 'Guerreiro', nivel: 19 });
  assert.match(motivo, /Conjuração/);
});

test('motivoPreRequisito: família "Treinamento com Armadura ..."', () => {
  const leve = { prerequisito: 'Nível 4 ou superior, Treinamento com Armadura Leve' };
  assert.equal(motivoPreRequisito(leve, { nivel: 4, proficiencias_armaduras: ['Leve'] }), null);
  assert.match(motivoPreRequisito(leve, { nivel: 4, proficiencias_armaduras: [] }), /Armadura Leve/);

  const escudo = { prerequisito: 'Nível 4 ou superior, Treinamento com Escudo' };
  assert.equal(motivoPreRequisito(escudo, { nivel: 4, proficiencias_armaduras: ['Escudo'] }), null);
  assert.match(motivoPreRequisito(escudo, { nivel: 4, proficiencias_armaduras: [] }), /Escudo/);
});

test('deEstilosLuta: o estilo atual fica bloqueado', () => {
  const [a, b] = deEstilosLuta(
    [{ nome: 'Defensivo', descricao: '+1 CA' }, { nome: 'Duelismo', descricao: '+2 dano' }],
    { jaTem: new Set(['Defensivo']) });
  assert.equal(a.bloqueado.motivo, 'já é o seu estilo atual');
  assert.equal(b.resumo, '+2 dano');
});

test('rotuloPericia: acrescenta o atributo por extenso', () => {
  assert.equal(rotuloPericia('Furtividade'), 'Furtividade (Destreza)');
  assert.equal(rotuloPericia('Inexistente'), 'Inexistente');
});

test('deMagias: concentração a partir de duracao (fonte dados/magias/_indice.json)', () => {
  const [comConc, semConc] = deMagias([
    { nome: 'Bênção', circulo: 1, escola: 'Encantamento', duracao: 'Concentração, até 1 minuto' },
    { nome: 'Mísseis Mágicos', circulo: 1, escola: 'Evocação', duracao: 'Instantânea' },
  ]);
  assert.equal(comConc.resumo, '1º Círculo · Encantamento · Concentração');
  assert.equal(semConc.resumo, '1º Círculo · Evocação');
});

// Achado I2 da revisão final: `especial` (dados/classes/magias_<classe>.json
// -- a fonte que alimenta as trocas de magia/truque) é a OUTRA fonte de
// concentração, sem `duracao` nenhuma. Cobre as 7 formas reais do campo,
// levantadas em dados/classes/magias_*.json: 'C', '—', 'R', 'C, R', 'R, M',
// 'C, M', 'M'.
test('deMagias: concentração a partir de especial (fonte dados/classes/magias_<classe>.json)', () => {
  const [c, semNada, ritual, concRitual, ritualMaterial, concMaterial, material] = deMagias([
    { nome: 'Amigos', circulo: 0, escola: 'Encantamento', especial: 'C' },
    { nome: 'Bolha Ácida', circulo: 0, escola: 'Evocação', especial: '—' },
    { nome: 'Detectar Veneno e Doença', circulo: 1, escola: 'Adivinhação', especial: 'R' },
    { nome: 'Detectar Magia', circulo: 1, escola: 'Adivinhação', especial: 'C, R' },
    { nome: 'Identificar', circulo: 1, escola: 'Adivinhação', especial: 'R, M' },
    { nome: 'Círculo de Proteção', circulo: 3, escola: 'Abjuração', especial: 'C, M' },
    { nome: 'Symbol', circulo: 7, escola: 'Abjuração', especial: 'M' },
  ]);
  assert.equal(c.resumo, 'Truque · Encantamento · Concentração');
  assert.equal(semNada.resumo, 'Truque · Evocação');
  assert.equal(ritual.resumo, '1º Círculo · Adivinhação');
  // 'C, M' e 'C, R' precisam continuar reconhecendo o 'C' mesmo combinado
  // com outra letra -- comparar com `especial === 'C'` perderia os dois.
  assert.equal(concRitual.resumo, '1º Círculo · Adivinhação · Concentração');
  assert.equal(ritualMaterial.resumo, '1º Círculo · Adivinhação');
  assert.equal(concMaterial.resumo, '3º Círculo · Abjuração · Concentração');
  assert.equal(material.resumo, '7º Círculo · Abjuração');
});

test('deMagias: sem duracao nem especial, resumo não menciona concentração', () => {
  const [o] = deMagias([{ nome: 'Luz', circulo: 0, escola: 'Evocação' }]);
  assert.equal(o.resumo, 'Truque · Evocação');
});

test('deArmas: com maestria e descrição no Map, resumo e detalhe trazem dano, propriedades e a maestria', () => {
  const descricoesMaestria = new Map([
    ['Ágil', 'Ao acertar um ataque com uma arma Ágil, você pode se mover até 3 metros sem provocar Ataques de Oportunidade.'],
  ]);
  const [o] = deArmas([{
    nome: 'Adaga', categoria: 'Armas Simples Corpo a Corpo', dano: '1d4 Perfurante',
    propriedades: 'Acuidade, Arremesso (Alcance 6/18), Leve', maestria: 'Ágil',
    peso: '0,5 kg', custo: '2 PO',
  }], { descricoesMaestria });
  assert.equal(o.resumo, '1d4 Perfurante · Maestria: Ágil');
  assert.equal(o.detalhe,
    '<div><strong>Propriedades:</strong> Acuidade, Arremesso (Alcance 6/18), Leve</div>' +
    '<div style="margin-top:4px"><strong>Ágil:</strong> Ao acertar um ataque com uma arma Ágil, ' +
    'você pode se mover até 3 metros sem provocar Ataques de Oportunidade.</div>');
});

test('deArmas: sem maestria ou sem descrição correspondente no Map, resumo e detalhe não sobram lixo', () => {
  const [semMaestria, semDescricao] = deArmas([
    { nome: 'Bumerangue', categoria: 'Exótica', dano: '1d4 Contundente', propriedades: '', maestria: '', peso: '0,25 kg', custo: '1 PO' },
    { nome: 'Chicote', categoria: 'Armas Marciais Corpo a Corpo', dano: '1d4 Cortante', propriedades: 'Alcance, Leve', maestria: 'Lentidão', peso: '1,5 kg', custo: '2 PO' },
  ], { descricoesMaestria: new Map() });
  assert.equal(semMaestria.resumo, '1d4 Contundente');
  assert.equal(semMaestria.detalhe, '');
  assert.equal(semDescricao.resumo, '1d4 Cortante · Maestria: Lentidão');
  assert.equal(semDescricao.detalhe, '<div><strong>Propriedades:</strong> Alcance, Leve</div>');
  assert.ok(!semMaestria.detalhe.includes('undefined'));
  assert.ok(!semDescricao.detalhe.includes('undefined'));
});

test('deArmas: arma já possuída vira bloqueada com o motivo certo', () => {
  const [o] = deArmas([{
    nome: 'Espada Longa', categoria: 'Armas Marciais Corpo a Corpo', dano: '1d8 Cortante',
    propriedades: 'Versátil (1d10)', maestria: 'Trespassar', peso: '1,5 kg', custo: '15 PO',
  }], { jaTem: new Set(['Espada Longa']) });
  assert.equal(o.bloqueado.motivo, 'você já tem maestria nesta arma');
});

test('deManobras: descrição vira resumo; manobra já conhecida bloqueia', () => {
  const [a, b] = deManobras(
    [{ nome: 'Ataque Aparador', descricao: 'Reduza o dano recebido em uma jogada de Aparar bem-sucedida.' },
     { nome: 'Empurrão', descricao: 'Empurre o alvo até 3 metros ao acertar.' }],
    { jaTem: new Set(['Ataque Aparador']) });
  assert.equal(a.bloqueado.motivo, 'você já conhece esta manobra');
  assert.equal(b.resumo, 'Empurre o alvo até 3 metros ao acertar.');
  assert.equal(b.bloqueado, null);
});
