// ============================================================
// Confronto: um talento não pode oferecer, na MESMA aquisição ou numa
// repetição, uma escolha que não concede nada ao personagem --
// proficiência repetida, maestria repetida, perícia já com
// Especialização etc. O livro nunca proíbe isso com todas as letras
// (é um princípio implícito, não uma frase citável por talento); por
// isso o motor não compara contra uma lista de talentos esperados --
// ele aplica o efeito de verdade e confronta o app contra o próprio
// estado que acabou de criar.
//
// Desenho: para cada talento com `escolhas` no catálogo, aplica
// exemplo_valido a um personagem limpo (aplicarEfeitoTalento) até
// atingir um ponto fixo (ver `LIMITE_ITERACOES_SATURACAO` abaixo), e
// então valida a MESMA escolha de novo (validarEscolhasTalento). Sem
// exceção registrada, a revalidação precisa ser RECUSADA -- se for
// aceita, o app está oferecendo uma escolha morta. Escopo decidido
// pelos DADOS (algum array do personagem cresceu?), não por uma lista
// de nomes -- um talento novo no catálogo entra automaticamente.
//
// O que este motor NÃO testa: se a TELA oferece a opção já possuída
// no <select> (isso é ramo hard-coded de levelup-ui.js, fora do
// alcance de um motor de unidade -- mesmo limite documentado em
// escolhas.test.mjs). Aqui a confrontação é só contra
// validarEscolhasTalento/aplicarEfeitoTalento, a função central que
// TODAS as quatro vias de aquisição chamam.
// ============================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_TALENTOS } from '../catalogo/talentos.mjs';
import { modulosApp, charBase } from './harness.mjs';
import { excecaoEscolhaRepetida } from '../excecoes-escolha-repetida.mjs';

const { regras } = await modulosApp();

// Teto de segurança do laço de saturação logo abaixo. Nenhum talento do
// catálogo hoje precisa de mais de 3 aplicações para estabilizar --
// Analítico/Mente Aguçada, os únicos com benefício em DOIS estágios,
// saturam na 3ª (ver comentário no laço). Um valor bem acima disso é só
// uma rede de segurança contra laço infinito se um talento futuro tiver um
// padrão diferente; se algum dia estourar, o teste falha alto e explícito
// em vez de rodar para sempre.
const LIMITE_ITERACOES_SATURACAO = 10;

// Percorre recursivamente um personagem (dado plano, sem ciclos -- ver
// store.js:criarPersonagemVazio) e devolve um mapa "caminho -> tamanho"
// para TODO array encontrado, inclusive aninhado (ex.:
// talentos_parametros.dadiva_resistencia_energia, ou
// iniciado_em_magia_instancias[0].truques). Generalizar por CAMINHO, em vez
// de listar campos por talento, é o que deixa o motor achar crescimento em
// qualquer talento do catálogo sem hardcode de nome de campo.
function instantaneoArrays(valor, caminho = '', mapa = new Map()) {
  if (Array.isArray(valor)) {
    mapa.set(caminho, valor.length);
    valor.forEach((item, indice) => instantaneoArrays(item, `${caminho}[${indice}]`, mapa));
  } else if (valor && typeof valor === 'object') {
    for (const [chave, sub] of Object.entries(valor)) {
      instantaneoArrays(sub, caminho ? `${caminho}.${chave}` : chave, mapa);
    }
  }
  return mapa;
}

// Compara dois instantâneos: verdadeiro se ALGUM caminho cresceu (era menor
// -- ou não existia -- e agora é maior). Um array que só perdeu itens, ou
// que trocou de conteúdo sem crescer, não conta como "concedeu algo".
function algumArrayCresceu(antes, depois) {
  for (const [caminho, tamanho] of depois) {
    if (tamanho > (antes.get(caminho) || 0)) return true;
  }
  return false;
}

for (const [nome, e] of Object.entries(CATALOGO_TALENTOS)) {
  if (e.escolhas.length === 0) continue;

  test(`escolha-morta: ${nome}`, async (t) => {
    // Talentos cuja ÚNICA escolha é o atributo do ASI embutido
    // (atributo_talento/atributo_conjuracao) não têm item de LISTA para
    // repetir -- não existe "a mesma escolha" no sentido que este motor
    // testa. Investigado nesta rodada: Envenenador e Telecinético têm um
    // efeito FIXO que aplicarEfeitoTalento sempre aplica (Kit de Veneno;
    // a magia Mãos Mágicas) e que faria um array crescer mesmo sem
    // depender do valor escolhido -- mas nenhum dos dois declara uma
    // escolha de lista no catálogo para esse efeito (ele não é uma
    // escolha, é automático). Reaquisição do TALENTO em si (não desta
    // escolha) já é barrada nas quatro vias de aquisição pelo campo
    // `repetivel`, confrontado contra as 75 entradas do catálogo por
    // talentos-repetivel.spec.mjs -- então o cenário "escolher nada e
    // ganhar o mesmo fixo de novo" não é alcançável pela UI real. Excluir
    // aqui não é uma exceção por nome (não é excecoes-escolha-repetida.mjs)
    // -- é decidido pelo TIPO das escolhas no catálogo, o mesmo dado que
    // guia todo o resto deste motor.
    const apenasAtributoAsi = e.escolhas.every((esc) =>
      esc.tipo === 'atributo_talento' || esc.tipo === 'atributo_conjuracao');
    if (apenasAtributoAsi) {
      t.skip(`${nome}: só tem escolha de atributo do ASI embutido, sem item de lista -- ` +
        'reaquisição do talento (não desta escolha) já é barrada por `repetivel`, confrontado em ' +
        'talentos-repetivel.spec.mjs.');
      return;
    }

    const char = await charBase();
    let anterior = instantaneoArrays(char);
    let cresceuAlgumaVez = false;

    // Satura o personagem: aplica a MESMA escolha repetidamente até não
    // haver mais crescimento em nenhum array (ponto fixo). Necessário
    // porque alguns talentos concedem em DOIS estágios -- Analítico e
    // Mente Aguçada dão proficiência na primeira aquisição da perícia e
    // Especialização na segunda (Talentos.md §Analítico/§Mente Aguçada).
    // Aplicar só uma vez pararia no meio do primeiro estágio, e reavaliar
    // a MESMA escolha ali seria uma alegação ERRADA -- o segundo estágio é
    // um ganho real (Especialização), não uma escolha morta; só o
    // TERCEIRO estágio (já proficiente E já com Especialização) é morto.
    // `aplicado: false` -- que aplicarEfeitoTalento devolve para
    // Resiliente/Especialista em Perícia/Dádiva da Proficiência em
    // Perícia/Iniciado em Magia quando o estado-base já satisfaz a
    // condição, sem mutar nada -- e uma recusa direta na 2ª aplicação
    // (Habilidoso e os demais já corrigidos, cuja validarEscolhasTalento
    // recusa a repetição de cara) chegam aqui como "sem crescimento nesta
    // iteração": o mesmo sinal de ponto fixo, tratado de forma uniforme,
    // sem precisar de um caso especial por talento ou por formato de
    // retorno.
    for (let iteracao = 0; iteracao < LIMITE_ITERACOES_SATURACAO; iteracao += 1) {
      const resultado = regras.aplicarEfeitoTalento(char, nome, e.exemplo_valido);
      if (iteracao === 0) {
        assert.ok(resultado.sucesso,
          `${nome}: aplicarEfeitoTalento recusou o exemplo_valido do catálogo na primeira ` +
          `aplicação, contra um personagem ainda "limpo": ${resultado.erro}`);
      }
      if (!resultado.sucesso) break; // validação já recusa a repetição -- ponto fixo alcançado
      const atual = instantaneoArrays(char);
      if (!algumArrayCresceu(anterior, atual)) break; // aplicado:false ou idempotente -- ponto fixo
      cresceuAlgumaVez = true;
      anterior = atual;
    }

    if (!cresceuAlgumaVez) {
      t.skip(`${nome}: aplicarEfeitoTalento não fez nenhum array do personagem crescer -- este ` +
        'talento não concede nada em formato de lista (fora do escopo deste motor).');
      return;
    }

    const excecao = excecaoEscolhaRepetida(nome);
    const revalidacao = regras.validarEscolhasTalento(char, nome, e.exemplo_valido);
    if (excecao) {
      // Lista de exceções (excecoes-escolha-repetida.mjs): para estes o
      // livro concede algo A MAIS na repetição -- expectativa invertida,
      // no mesmo espírito de comLacuna (harness.mjs): se isto começar a
      // falhar, o app passou a recusar de verdade, e a entrada precisa
      // sair da lista.
      assert.equal(revalidacao.valido, true,
        `${nome}: está em excecoes-escolha-repetida.mjs (${excecao.motivo}), mas a MESMA escolha ` +
        'voltou a ser recusada -- remova a entrada se o app deixou de conceder o benefício extra ' +
        'que a justificava.');
    } else {
      assert.equal(revalidacao.valido, false,
        `${nome}: escolher de novo exatamente o que o talento acabou de conceder foi ACEITO -- ` +
        'escolha morta. Se há ganho real na repetição segundo o livro, verifique Talentos.md e ' +
        'registre uma entrada em excecoes-escolha-repetida.mjs; caso contrário, é um bug real do app.');
    }
  });
}
