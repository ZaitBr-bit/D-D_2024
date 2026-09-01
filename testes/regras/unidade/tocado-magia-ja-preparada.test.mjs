// ============================================================
// Issue #31 -- Tocado Por Fadas / Tocado Pelas Sombras não marcam a magia
// ESCOLHIDA como sempre preparada/grátis quando o personagem já a tinha
// preparada por outra via (ex.: concedida pela classe).
//
// Causa raiz: o bloco de aplicação (regras-cobertura.js) usava
// `adicionarUnico`, que PULA a entrada quando já existe magia com aquele
// nome, em vez de promovê-la. A magia parceira fixa (Invisibilidade/Passo
// Nebuloso) funcionava só porque quase nenhum personagem já a tem preparada
// -- a assimetria do relato era um efeito colateral do dado de teste, não
// da regra (Talentos.md §Magia Sombria/§Magia Feérica: "Você tem essa
// magia e Invisibilidade/Passo Nebuloso sempre preparadas, podendo
// conjurá-las sem gastar espaço de magia" -- as duas recebem o MESMO
// tratamento).
//
// O gêmeo em site/js/levelup.js (aplicado durante a subida de nível) tinha
// o mesmo `if (... && !find(...))` que pula em vez de promover. O terceiro
// oráculo abaixo sobe um personagem de verdade (subirDeNivel) para provar
// que o caminho de levelup também sai correto -- embora, medido por
// reprodução direta, aplicarEfeitoTalento (chamado ANTES do bloco duplicado
// de levelup.js, dentro da mesma subida) já resolva a entrada por
// completo, tornando o bloco duplicado de levelup.js inerte na prática
// (ver task-4-report.md). Ainda assim os dois arquivos foram corrigidos
// com o mesmo padrão, por defesa contra uma reordenação futura das
// chamadas.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { modulosApp, personagemMulticlasse } from './harness.mjs';

const { regras, levelup } = await modulosApp();

test('aplicarEfeitoTalento: Tocado Pelas Sombras promove a magia escolhida já preparada pela classe', () => {
  const char = { nivel: 4, classe: 'Mago' };
  // Cenário B do relato: "Disfarçar-se" já está preparada pela classe --
  // sem `origem` e sem `gratis_usado`, exatamente como o app grava uma
  // magia normal da tabela da classe.
  char.magias_preparadas = [{ nome: 'Disfarçar-se', circulo: 1, classe: 'Mago' }];

  const r = regras.aplicarEfeitoTalento(char, 'Tocado Pelas Sombras',
    { atributo: 'inteligencia', magia: 'Disfarçar-se' });
  assert.equal(r.sucesso, true, `aplicarEfeitoTalento falhou: ${JSON.stringify(r)}`);

  const escolhida = char.magias_preparadas.find(m => m.nome === 'Disfarçar-se');
  assert.ok(escolhida, 'a entrada existente não pode desaparecer');
  assert.equal(escolhida.origem, 'tocado_pelas_sombras',
    'a magia escolhida tem de ficar sempre preparada, igual à parceira fixa');
  assert.equal(escolhida.gratis_usado, false,
    'a magia escolhida tem de ganhar o uso grátis, igual à parceira fixa');

  const parceira = char.magias_preparadas.find(m => m.nome === 'Invisibilidade');
  assert.ok(parceira, 'a magia parceira (Invisibilidade) precisa ser concedida');
  assert.equal(parceira.origem, 'tocado_pelas_sombras');
  assert.equal(parceira.gratis_usado, false);

  assert.equal(char.magias_preparadas.length, 2,
    'promove a entrada existente -- não duplica "Disfarçar-se"');
});

test('aplicarEfeitoTalento: Tocado Por Fadas promove a magia escolhida já preparada pela classe', () => {
  const char = { nivel: 4, classe: 'Bardo' };
  char.magias_preparadas = [{ nome: 'Sono', circulo: 1, classe: 'Bardo' }];

  const r = regras.aplicarEfeitoTalento(char, 'Tocado Por Fadas',
    { atributo: 'carisma', magia: 'Sono' });
  assert.equal(r.sucesso, true, `aplicarEfeitoTalento falhou: ${JSON.stringify(r)}`);

  const escolhida = char.magias_preparadas.find(m => m.nome === 'Sono');
  assert.equal(escolhida.origem, 'tocado_por_fadas',
    'a magia escolhida tem de ficar sempre preparada, igual à parceira fixa');
  assert.equal(escolhida.gratis_usado, false,
    'a magia escolhida tem de ganhar o uso grátis, igual à parceira fixa');

  const parceira = char.magias_preparadas.find(m => m.nome === 'Passo Nebuloso');
  assert.ok(parceira, 'a magia parceira (Passo Nebuloso) precisa ser concedida');
  assert.equal(parceira.origem, 'tocado_por_fadas');
  assert.equal(parceira.gratis_usado, false);

  assert.equal(char.magias_preparadas.length, 2,
    'promove a entrada existente -- não duplica "Sono"');
});

test('subirDeNivel: Tocado Pelas Sombras promove a magia escolhida ao ser adquirido no levelup (site/js/levelup.js)', async () => {
  const p = await personagemMulticlasse([{ classe: 'Mago', nivel: 3 }]);
  // Mesmo cenário B, agora no personagem que sobe de nível de verdade.
  p.magias_preparadas = [{ nome: 'Disfarçar-se', circulo: 1 }];

  const r = await levelup.subirDeNivel(p, {
    ignorar_xp: true,
    classe: 'Mago',
    talento: 'Tocado Pelas Sombras',
    talento_tipo_escolha: 'tocado_sombras',
    talento_asi: 'inteligencia',
    escolhas_talento_levelup: ['Disfarçar-se'],
    // Pendência independente do mesmo nível (grimório do Mago) -- resolvida
    // aqui só para não mascarar o resultado que este oráculo mede.
    grimorio_selecionados: ['Armadura Arcana', 'Escudo Arcano'],
  });
  assert.equal(r.sucesso, true, `subida falhou: ${JSON.stringify(r)}`);

  const escolhida = p.magias_preparadas.find(m => m.nome === 'Disfarçar-se');
  assert.equal(escolhida.origem, 'tocado_pelas_sombras',
    'a magia escolhida tem de sair da subida já sempre preparada');
  assert.equal(escolhida.gratis_usado, false,
    'a magia escolhida tem de sair da subida já com o uso grátis');
});

test('aplicarEfeitoTalento: Conjurador Ritualista promove um ritual já preparado pela classe', () => {
  // Mesmo furo do bloco de Tocado (adicionarUnico pulando em vez de
  // promover), incluído por ser o mesmo padrão de correção -- ver
  // task-4-brief.md, "Conjurador Ritualista usa o mesmo adicionarUnico".
  // Bônus de Proficiência do nível 4 é +2 (validarEscolhasTalento exige a
  // quantidade exata) -- por isso duas escolhas: uma já preparada pela
  // classe (cenário B), outra nova.
  const char = { nivel: 4, classe: 'Mago' };
  char.magias_preparadas = [{ nome: 'Alarme', circulo: 1, classe: 'Mago' }];

  const r = regras.aplicarEfeitoTalento(char, 'Conjurador Ritualista',
    { atributo: 'inteligencia', rituais: ['Alarme', 'Detectar Magia'] });
  assert.equal(r.sucesso, true, `aplicarEfeitoTalento falhou: ${JSON.stringify(r)}`);

  const ritual = char.magias_preparadas.find(m => m.nome === 'Alarme');
  assert.equal(ritual.origem, 'conjurador_ritualista',
    'o ritual escolhido tem de ficar sempre preparado, igual a qualquer outro ritual do talento');
  assert.equal(char.magias_preparadas.length, 2,
    'promove a entrada existente ("Alarme") e adiciona a nova ("Detectar Magia") -- não duplica');
});
