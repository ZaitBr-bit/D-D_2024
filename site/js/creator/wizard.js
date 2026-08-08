// ============================================================
// Estado e navegacao do criador
//
// `personagem`, `stepAtual`, `dadosCache` e `containerRef` moram aqui
// porque e aqui que sao reatribuidos (renderWizard e avancar). Os
// setters do fim do arquivo existem so para renderCreator.
//
// ATENCAO: renderWizard monta o shell do criador. As classes
// wizard-steps-sticky, wizard-content-area, wizard-nav-fixed e
// wizard-nav-inner precisam bater com site/css/app.css -- foi
// exatamente aqui que a refatoracao anterior quebrou o layout.
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, CLASSES_INFO, POINT_BUY_CUSTOS, POINT_BUY_TOTAL } from '../dados-classes.js';
import { criarCarteiraVazia } from '../moedas.js';
import { validarEscolhasTalento } from '../regras-cobertura.js';
import { salvarPersonagem } from '../store.js';
import { calcMod, calcPVNivel1, getBonusTruquesOrdem, getEspacosMagia, getMagiaPreparadas, getTruquesConhecidos, magiaMagoEstaNoGrimorio, toast } from '../utils.js';
import { ANTECEDENTES_ESCOLHAS, CLASSES_ESCOLHAS, ESPECIES_TRACOS_ESCOLHA, FERRAMENTAS_TODAS, INSTRUMENTOS_MUSICAIS, obterTruquesEspecie } from './comum.js';
import { renderStepAntecedente } from './passo-antecedente.js';
import { renderStepAtributos } from './passo-atributos.js';
import { renderStepClasse } from './passo-classe.js';
import { coletarDetalhes, obterRegraIdiomasAtual, renderStepDetalhes } from './passo-detalhes.js';
import { renderStepEquipamento } from './passo-equipamento.js';
import { renderStepEspecie } from './passo-especie.js';
import { _contarInstanciasIM, _nomeBaseTalento, renderStepMagias } from './passo-magias.js';

const STEPS = [
  { id: 'classe', label: 'Classe' },
  { id: 'especie', label: 'Espécie' },
  { id: 'antecedente', label: 'Antecedente' },
  { id: 'atributos', label: 'Atributos' },
  { id: 'equipamento', label: 'Equipamento' },
  { id: 'magias', label: 'Magias' },
  { id: 'detalhes', label: 'Detalhes' }
];

export let personagem = null;
let stepAtual = 0;
export let dadosCache = {};
export let containerRef = null;

// Limpa os dados associados a um passo especifico do wizard
// Chamado ao voltar para um passo anterior, limpando os passos posteriores
function limparDadosDoPasso(stepIndex) {
  const stepId = STEPS[stepIndex]?.id;
  if (!stepId) return;

  switch (stepId) {
    case 'especie':
      personagem.especie = '';
      personagem.tracos_escolhidos = [];
      break;

    case 'antecedente':
      personagem.antecedente = '';
      personagem.talentos = [];
      personagem.escolhas_antecedente = {};
      personagem.bonus_antecedente = {};
      delete dadosCache.pericias_antecedente;
      delete dadosCache.atributos_antecedente;
      delete dadosCache.bonus2;
      delete dadosCache.bonus1;
      delete dadosCache.bonus111;
      break;

    case 'atributos':
      personagem.atributos = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };
      personagem.atributos_base = { forca: 10, destreza: 10, constituicao: 10, inteligencia: 10, sabedoria: 10, carisma: 10 };
      personagem.pericias_proficientes = [];
      delete dadosCache.attrMode;
      delete dadosCache.stdAssign;
      delete dadosCache.pbValues;
      delete dadosCache.rolagemValores;
      delete dadosCache.rolagemDados;
      delete dadosCache.rolagemAssign;
      delete dadosCache.pericias_classe_sel;
      break;

    case 'equipamento':
      personagem.inventario = [];
      personagem.escolha_equip_classe = null;
      personagem.escolha_equip_antecedente = null;
      personagem.instrumento_classe_escolhido = null;
      personagem.moedas = criarCarteiraVazia();
      break;

    case 'magias':
      personagem.magias_conhecidas = [];
      personagem.magias_preparadas = [];
      personagem.grimorio = [];
      personagem.espacos_magia = {};
      delete dadosCache.magiasClasse;
      delete dadosCache.indiceMagias;
      break;

    case 'detalhes':
      personagem.alinhamento = '';
      personagem.aparencia = '';
      personagem.personalidade = '';
      personagem.ideais = '';
      personagem.lacos = '';
      personagem.defeitos = '';
      personagem.historia_personagem = '';
      personagem.notas = '';
      personagem.tamanho = '';
      personagem.idiomas = ['Comum'];
      break;
  }
}

// Limpa todos os passos de (stepAlvo + 1) ate stepAtual (inclusive)
// Exemplo: de step 4 voltando para step 1 -> limpa steps 2, 3, 4
function limparPassosPosteriores(stepAlvo) {
  for (let i = stepAlvo + 1; i <= stepAtual; i++) {
    limparDadosDoPasso(i);
  }
}

export function renderWizard() {
  const container = containerRef;
  container.innerHTML = `
    <div class="wizard-steps wizard-steps-sticky">
      ${STEPS.map((s, i) => `
        <div class="wizard-step ${i === stepAtual ? 'active' : ''} ${i < stepAtual ? 'done' : ''}"
             data-step="${i}">
          <div class="wizard-step-num">${i < stepAtual ? '&#10003;' : i + 1}</div>
          <div class="wizard-step-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
    <div id="wizard-content" class="wizard-content-area"></div>
    <div class="wizard-nav-fixed">
      <div class="wizard-nav-inner">
        <button class="btn btn-secondary" id="btn-prev" ${stepAtual === 0 ? 'disabled' : ''}>
          &#8592; Anterior
        </button>
        <span style="font-size:0.8rem;color:var(--text-muted)">
          ${stepAtual + 1} de ${STEPS.length}
        </span>
        ${stepAtual === STEPS.length - 1
          ? '<button class="btn btn-success" id="btn-finalizar">Criar Personagem &#10003;</button>'
          : '<button class="btn btn-primary" id="btn-next">Pr\u00f3ximo &#8594;</button>'
        }
      </div>
    </div>
  `;

  // Eventos dos botões de navegação
  document.getElementById('btn-prev')?.addEventListener('click', () => {
    // Limpar dados do passo atual antes de voltar
    limparDadosDoPasso(stepAtual);
    stepAtual--;
    renderWizard();
  });
  document.getElementById('btn-next')?.addEventListener('click', () => avancar());
  document.getElementById('btn-finalizar')?.addEventListener('click', () => finalizar());

  // Clique nas steps para navegar diretamente (somente para passos já visitados)
  container.querySelectorAll('.wizard-step').forEach(el => {
    el.addEventListener('click', () => {
      const target = parseInt(el.dataset.step);
      if (target < stepAtual) {
        // Limpar dados de todos os passos posteriores ao destino
        limparPassosPosteriores(target);
        stepAtual = target;
        renderWizard();
      }
    });
  });

  // Rolar ao topo ao trocar de passo
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Renderizar conteudo do passo atual
  const stepContent = document.getElementById('wizard-content');
  renderStep(stepContent);
}

function renderStep(el) {
  switch (STEPS[stepAtual].id) {
    case 'classe': renderStepClasse(el); break;
    case 'especie': renderStepEspecie(el); break;
    case 'antecedente': renderStepAntecedente(el); break;
    case 'atributos': renderStepAtributos(el); break;
    case 'equipamento': renderStepEquipamento(el); break;
    case 'magias': renderStepMagias(el); break;
    case 'detalhes': renderStepDetalhes(el); break;
  }
}

function avancar() {
  // Validar passo atual antes de avançar
  if (!validarStep()) return;
  stepAtual++;
  renderWizard();
}

function validarStep() {
  switch (STEPS[stepAtual].id) {
    case 'classe':
      if (!personagem.classe) { toast('Selecione uma classe', 'error'); return false; }
      // Validar escolhas obrigatórias da classe
      const classeEscolhas = CLASSES_ESCOLHAS[personagem.classe];
      if (classeEscolhas) {
        for (const [chave, config] of Object.entries(classeEscolhas)) {
          // Ignorar escolhas com nivel minimo acima do nivel atual
          const nivelMin = parseInt(config.nivelMinimo || 1);
          if ((personagem.nivel || 1) < nivelMin) continue;
          const selecionados = personagem.escolhas_classe?.[chave] || [];
          if (selecionados.length < config.maxEscolhas) {
            toast(`Selecione ${config.maxEscolhas} opção(ões) de ${config.titulo}`, 'error');
            return false;
          }
        }
      }
      // Compatibilidade: verificar ordem_divina também
      if (personagem.classe === 'Clérigo' && !personagem.ordem_divina && !personagem.escolhas_classe?.ordem_divina?.length) {
        toast('Selecione sua Ordem Divina (Protetor ou Taumaturgo)', 'error');
        return false;
      }
      return true;
    case 'especie':
      if (!personagem.especie) { toast('Selecione uma espécie', 'error'); return false; }
      // Validar seleção de traços obrigatórios
      const escolhaConfig = ESPECIES_TRACOS_ESCOLHA[personagem.especie];
      if (escolhaConfig) {
        const selecionados = personagem.tracos_escolhidos || [];
        if (selecionados.length < escolhaConfig.maxEscolhas) {
          toast(`Selecione ${escolhaConfig.maxEscolhas} traço(s) de ${escolhaConfig.titulo}`, 'error');
          return false;
        }
      }
      return true;
    case 'antecedente':
      if (!personagem.antecedente) { toast('Selecione um antecedente', 'error'); return false; }
      // Validar escolhas de antecedente (ferramenta/instrumento)
      const antEscolha = ANTECEDENTES_ESCOLHAS[personagem.antecedente];
      if (antEscolha && !personagem.escolhas_antecedente?.[antEscolha.campo]) {
        toast(`Selecione ${antEscolha.titulo}`, 'error');
        return false;
      }
      // Validar distribuicao de bonus de atributos do antecedente
      {
        const bonusKeys = Object.keys(personagem.bonus_antecedente || {});
        const bonusTotal = Object.values(personagem.bonus_antecedente || {}).reduce((s, v) => s + v, 0);
        if (bonusTotal < 3) {
          toast('Distribua os bônus de atributos do antecedente (+2/+1 ou +1/+1/+1)', 'error');
          return false;
        }
      }
      return true;
    case 'atributos': {
      const modo = dadosCache.attrMode || 'standard';

      // Validacao especifica por modo de distribuicao
      if (modo === 'standard') {
        // Conjunto Padrao: todos os 6 atributos devem estar atribuidos via stdAssign
        const assignKeys = Object.keys(dadosCache.stdAssign || {});
        if (assignKeys.length < 6) {
          toast(`Distribua todos os valores do Conjunto Padrão (${assignKeys.length}/6 atribuídos)`, 'error');
          return false;
        }
      } else if (modo === 'pointbuy') {
        // Compra de Pontos: todos os pontos devem ter sido gastos (restante = 0)
        const custoTotal = ATRIBUTOS_KEYS.reduce((sum, k) => sum + (POINT_BUY_CUSTOS[dadosCache.pbValues?.[k] ?? 8] || 0), 0);
        const restante = POINT_BUY_TOTAL - custoTotal;
        if (restante > 0) {
          toast(`Gaste todos os pontos de Compra de Pontos (${restante} restantes)`, 'error');
          return false;
        }
        if (restante < 0) {
          toast('Você excedeu o limite de pontos na Compra de Pontos', 'error');
          return false;
        }
      } else if (modo === 'rolagem') {
        // Rolagem 4d6: todos os 6 atributos devem ter sido rolados
        const rolados = Object.keys(dadosCache.rolagemValores || {});
        if (rolados.length < 6) {
          toast(`Role os dados para todos os atributos (${rolados.length}/6 rolados)`, 'error');
          return false;
        }
      }

      // Verificar pericias da classe
      const infoAttr = CLASSES_INFO[personagem.classe];
      const periciasSel = dadosCache.pericias_classe_sel || [];
      if (infoAttr && periciasSel.length < infoAttr.num_pericias) {
        toast(`Selecione ${infoAttr.num_pericias} perícias da classe (${periciasSel.length} selecionadas)`, 'error');
        return false;
      }
      return true;
    }
    case 'equipamento': {
      // Verificar se o equipamento inicial da classe foi selecionado (quando ha opcoes)
      const classeDataEq = dadosCache.classeData;
      const equipTexto = classeDataEq?.tracos_basicos?.['Equipamento Inicial'] || '';
      const temOpcoesClasse = equipTexto.match(/Escolha\s+[A-Z]/i);
      if (temOpcoesClasse && !personagem.escolha_equip_classe) {
        toast('Selecione o equipamento inicial da classe', 'error');
        return false;
      }
      // Verificar se requer escolha de instrumento musical
      if (/instrumento musical à sua escolha/i.test(equipTexto) && !personagem.instrumento_classe_escolhido) {
        toast('Escolha um Instrumento Musical para o equipamento da classe', 'error');
        return false;
      }
      // Verificar equip do antecedente
      const antEq = dadosCache.antecedentes?.find(a => a.nome === personagem.antecedente);
      const equipAntTexto = antEq?.equipamento?.replace(/\*/g, '') || '';
      const temOpcoesAnt = equipAntTexto.match(/Escolha\s+[A-Z]/i);
      if (temOpcoesAnt && !personagem.escolha_equip_antecedente) {
        toast('Selecione o equipamento do antecedente', 'error');
        return false;
      }
      return true;
    }
    case 'magias': {
      // Validar seleção de truques e magias para conjuradores
      const infoMagia = CLASSES_INFO[personagem.classe];
      const _temIM = (personagem.talentos || []).some(t => _nomeBaseTalento(t) === 'Iniciado em Magia');

      if (infoMagia?.conjurador) {
        const tabelaCaract = dadosCache.classeData?.tabela_caracteristicas;
        if (!tabelaCaract) return true;

        let truquesNecessarios = getTruquesConhecidos(tabelaCaract, personagem.nivel);
        const preparadasNecessarias = getMagiaPreparadas(tabelaCaract, personagem.nivel);

        // Bonus de truques do Clerigo Taumaturgo / Druida Xama (utils.js,
        // mesma função que o resto do app -- ver getBonusTruquesOrdem)
        truquesNecessarios += getBonusTruquesOrdem(personagem);

        const truquesSelecionados = (personagem.magias_conhecidas || []).filter(m => m.circulo === 0).length;
        const preparadasSelecionadas = (personagem.magias_preparadas || []).length;

        if (truquesNecessarios > 0 && truquesSelecionados < truquesNecessarios) {
          toast(`Selecione ${truquesNecessarios} truques (${truquesSelecionados} selecionados)`, 'error');
          return false;
        }
        if (preparadasNecessarias > 0 && preparadasSelecionadas < preparadasNecessarias) {
          toast(`Selecione ${preparadasNecessarias} magias (${preparadasSelecionadas} selecionadas)`, 'error');
          return false;
        }
        if (personagem.classe === 'Mago' && personagem.nivel === 1) {
          const grimorio = Array.isArray(personagem.grimorio) ? personagem.grimorio : [];
          const preparadas = Array.isArray(personagem.magias_preparadas) ? personagem.magias_preparadas : [];
          if (grimorio.length !== 6 || grimorio.some(m => Number(m?.circulo) !== 1)) {
            toast(`Selecione 6 magias de 1º círculo para o grimório (${grimorio.length} selecionadas)`, 'error');
            return false;
          }
          if (preparadas.length !== 4 || preparadas.some(m => !magiaMagoEstaNoGrimorio(personagem, m?.nome))) {
            toast('Selecione 4 magias preparadas que também estejam no grimório', 'error');
            return false;
          }
        }
      }

      // Validar Iniciado em Magia (todas as instâncias)
      if (_temIM) {
        const instancias = personagem.iniciado_em_magia_instancias || [];
        const numEsperado = _contarInstanciasIM();
        for (let i = 0; i < numEsperado; i++) {
          const im = instancias[i];
          const rotulo = numEsperado > 1 ? `Iniciado em Magia (${i + 1})` : 'Iniciado em Magia';
          if (!im?.lista) { toast(`${rotulo}: selecione a lista de magias`, 'error'); return false; }
          if (!im?.atributo) { toast(`${rotulo}: selecione o atributo de conjuração`, 'error'); return false; }
          if ((im?.truques || []).length < 2) { toast(`${rotulo}: selecione 2 truques`, 'error'); return false; }
          if (!im?.magia) { toast(`${rotulo}: selecione 1 magia de 1o círculo`, 'error'); return false; }
          const personagemSemInstanciaAtual = {
            ...personagem,
            iniciado_em_magia_instancias: instancias.filter((_, indice) => indice !== i)
          };
          const validacaoIM = validarEscolhasTalento(personagemSemInstanciaAtual, 'Iniciado em Magia', {
            iniciado_em_magia: im
          });
          if (!validacaoIM.valido) {
            toast(`${rotulo}: ${validacaoIM.erro}`, 'error');
            return false;
          }
        }
        // Listas devem ser diferentes entre instâncias
        const listas = instancias.slice(0, numEsperado).map(i => i.lista);
        if (new Set(listas).size < listas.length) {
          toast('Iniciado em Magia: cada instância deve usar uma lista de magias diferente', 'error');
          return false;
        }
      }
      return true;
    }
    case 'detalhes':
      return true;
  }
  return true;
}

// Validacao final antes de criar o personagem
function validarFinal() {
  coletarDetalhes();
  if (!personagem.nome || personagem.nome === 'Sem Nome') {
    toast('Informe o nome do personagem', 'error');
    return false;
  }
  // Verificar idiomas (deve ter pelo menos Comum + os adicionais obrigatorios)
  const regraVal = obterRegraIdiomasAtual();
  const idiomasSel = (personagem.idiomas || []).filter(i => i !== 'Comum');
  if (regraVal.maxAdicionais > 0 && idiomasSel.length < regraVal.maxAdicionais) {
    toast(`Selecione ${regraVal.maxAdicionais} idiomas adicionais (${idiomasSel.length} selecionados)`, 'error');
    return false;
  }
  return true;
}

async function finalizar() {
  // Validar dados finais antes de criar
  if (!validarFinal()) return;

  // Calcular PV
  const info = CLASSES_INFO[personagem.classe];
  if (info) {
    const modCon = calcMod(personagem.atributos.constituicao);
    personagem.pv_max = calcPVNivel1(info.dado_vida, modCon);
    // Tenacidade Anã: +1 PV por nível
    if (personagem.especie === 'Anão') {
      personagem.pv_max += personagem.nivel || 1;
      personagem.bonus_pv_anao_aplicado = personagem.nivel || 1;
    }
    // Vigoroso: +2 PV por nível
    const _temVigoroso = (personagem.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Vigoroso');
    if (_temVigoroso) {
      const _bonusVig = (personagem.nivel || 1) * 2;
      personagem.pv_max += _bonusVig;
      personagem.bonus_pv_vigoroso_aplicado = _bonusVig;
    }
    personagem.pv_atual = personagem.pv_max;
    personagem.dados_vida_total = personagem.nivel;
    personagem.salvaguardas_proficientes = info.salvaguardas;
  }

  // Calcular espaços de magia
  if (info?.conjurador && dadosCache.classeData?.tabela_caracteristicas) {
    personagem.espacos_magia = getEspacosMagia(dadosCache.classeData.tabela_caracteristicas, personagem.nivel);
  }

  // Aplicar Ordem Divina do Clérigo
  if (personagem.classe === 'Clérigo' && personagem.ordem_divina === 'Protetor') {
    // Adicionar proficiência em armas Marciais e Armadura Pesada
    if (!personagem.proficiencias_extra) personagem.proficiencias_extra = [];
    personagem.proficiencias_extra.push('Armas Marciais', 'Armadura Pesada');
  }

  // Aplicar Ordem Primal do Druida
  if (personagem.classe === 'Druida' && (personagem.ordem_primal === 'Protetor' || personagem.escolhas_classe?.ordem_primal?.[0] === 'Protetor')) {
    if (!personagem.proficiencias_extra) personagem.proficiencias_extra = [];
    personagem.proficiencias_extra.push('Armas Marciais', 'Armadura Média');
  }

  // Aplicar expertise de classes que escolhem na criação
  if (!personagem.pericias_expertise) personagem.pericias_expertise = [];

  // Ladino: 2 perícias para Especialização (nível 1)
  if (personagem.classe === 'Ladino' && personagem.escolhas_classe?.especialista?.length) {
    personagem.escolhas_classe.especialista.forEach(p => {
      if (!personagem.pericias_expertise.includes(p)) {
        personagem.pericias_expertise.push(p);
      }
    });
  }

  // Guardião: Explorador Hábil - 1 perícia para Especialização (nível 2)
  if (personagem.classe === 'Guardião' && personagem.escolhas_classe?.especialista?.length) {
    personagem.escolhas_classe.especialista.forEach(p => {
      if (!personagem.pericias_expertise.includes(p)) {
        personagem.pericias_expertise.push(p);
      }
    });
  }

  // Mago: Acadêmico - 2 perícias de conhecimento para Especialização (nível 2)
  if (personagem.classe === 'Mago' && personagem.escolhas_classe?.academico?.length) {
    personagem.escolhas_classe.academico.forEach(p => {
      if (!personagem.pericias_expertise.includes(p)) {
        personagem.pericias_expertise.push(p);
      }
    });
  }

  if (!personagem.nome) personagem.nome = 'Sem Nome';

  // Aplicar resistencias/vulnerabilidades/imunidades da especie
  // Mapeamento baseado no Livro do Jogador 2024
  const resistenciasEspecie = [];
  const especie = personagem.especie;
  const tracosEscolhidos = personagem.tracos_escolhidos || [];

  if (especie === 'Aasimar') {
    // Resistência Celestial: Necrótico e Radiante
    resistenciasEspecie.push('Necrótico', 'Radiante');
  } else if (especie === 'Anão') {
    // Resistência a Toxinas: Venenoso
    resistenciasEspecie.push('Venenoso');
  } else if (especie === 'Draconato') {
    // Resistência ao tipo de dano da Herança Dracônica
    const herancaMap = {
      'Azul': 'Elétrico', 'Branco': 'Gélido', 'Bronze': 'Elétrico',
      'Cobre': 'Ácido', 'Latão': 'Ígneo', 'Negro': 'Ácido',
      'Ouro': 'Ígneo', 'Prata': 'Gélido', 'Verde': 'Venenoso', 'Vermelho': 'Ígneo'
    };
    const dragao = tracosEscolhidos[0];
    if (dragao && herancaMap[dragao]) {
      resistenciasEspecie.push(herancaMap[dragao]);
    }
  } else if (especie === 'Tiferino') {
    // Resistência pelo Legado Ínfero
    const legadoMap = {
      'Abissal': 'Venenoso', 'Ctônico': 'Necrótico', 'Infernal': 'Ígneo'
    };
    const legado = tracosEscolhidos[0];
    if (legado && legadoMap[legado]) {
      resistenciasEspecie.push(legadoMap[legado]);
    }
  }

  // Aplicar resistencias da especie (sem duplicar existentes)
  if (resistenciasEspecie.length > 0) {
    if (!personagem.resistencias) personagem.resistencias = [];
    for (const r of resistenciasEspecie) {
      if (!personagem.resistencias.includes(r)) {
        personagem.resistencias.push(r);
      }
    }
  }

  // Aplicar pericias de especie (Kenku: Memória Kenku — 2 pericias à escolha)
  if (personagem.pericias_especie?.length) {
    if (!personagem.pericias_proficientes) personagem.pericias_proficientes = [];
    personagem.pericias_especie.forEach(p => {
      if (p && !personagem.pericias_proficientes.includes(p)) {
        personagem.pericias_proficientes.push(p);
      }
    });
  }

  // Adicionar truques concedidos pela espécie/traço (sem duplicar)
  const truquesEspecie = obterTruquesEspecie(especie, tracosEscolhidos);
  if (truquesEspecie.length > 0) {
    if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
    for (const nome of truquesEspecie) {
      if (!personagem.magias_conhecidas.find(m => m.nome === nome)) {
        personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'especie' });
      }
    }
  }

  // Adicionar magias do Iniciado em Magia (truques e magia de 1o circulo) — todas as instâncias
  for (const im of (personagem.iniciado_em_magia_instancias || [])) {
    if (!im?.lista) continue;
    if (!personagem.magias_conhecidas) personagem.magias_conhecidas = [];
    for (const nome of (im.truques || [])) {
      if (!personagem.magias_conhecidas.find(m => m.nome === nome)) {
        personagem.magias_conhecidas.push({ nome, circulo: 0, origem: 'iniciado_em_magia' });
      }
    }
    // A magia de 1o circulo fica sempre preparada (origem especial, 1 uso grátis por descanso longo)
    if (im.magia) {
      if (!personagem.magias_preparadas) personagem.magias_preparadas = [];
      const existenteIM = personagem.magias_preparadas.find(m => m.nome === im.magia);
      if (existenteIM) {
        existenteIM.origem = 'iniciado_em_magia';
        existenteIM.gratis_usado = false;
      } else {
        personagem.magias_preparadas.push({ nome: im.magia, circulo: 1, origem: 'iniciado_em_magia', gratis_usado: false });
      }
    }
  }

  // Distribuir escolhas de talentos nas arrays de proficiência corretas
  if (personagem.escolhas_talento) {
    if (!personagem.proficiencias_ferramentas) personagem.proficiencias_ferramentas = [];
    if (!personagem.proficiencias_instrumentos) personagem.proficiencias_instrumentos = [];
    for (const contexto of Object.keys(personagem.escolhas_talento)) {
      const escolhas = personagem.escolhas_talento[contexto];
      if (!Array.isArray(escolhas)) continue;
      for (const escolha of escolhas) {
        if (INSTRUMENTOS_MUSICAIS.includes(escolha) && !personagem.proficiencias_instrumentos.includes(escolha)) {
          personagem.proficiencias_instrumentos.push(escolha);
        } else if (FERRAMENTAS_TODAS.includes(escolha) && !personagem.proficiencias_ferramentas.includes(escolha)) {
          personagem.proficiencias_ferramentas.push(escolha);
        }
      }
    }
  }

  personagem.configuracao_criacao = {
    atributos: {
      metodo: dadosCache.attrMode || 'manual',
      valoresBase: { ...personagem.atributos_base },
      rolagens: dadosCache.attrMode === 'rolagem' ? { ...(dadosCache.rolagemValores || {}) } : null
    }
  };
  salvarPersonagem(personagem);
  toast('Personagem criado com sucesso!', 'success');
  window.navegar(`ficha/${personagem.id}`);
}

// --- Setters -------------------------------------------------------------
// Modulos ES nao permitem atribuir a um binding importado. Estas quatro
// funcoes sao a UNICA adicao de codigo do criador (spec 3.1); todas sao
// chamadas exclusivamente por renderCreator, uma vez cada, ao abrir o wizard.
// renderWizard e avancar continuam reatribuindo `stepAtual` diretamente --
// moram neste mesmo modulo, entao nao passam por setter.

/** Define o personagem em construcao. Chamado so por renderCreator. */
export function definirPersonagem(valor) { personagem = valor; }

/** Define o passo atual do wizard. Chamado so por renderCreator. */
export function definirStep(valor) { stepAtual = valor; }

/** Define o cache de dados dos passos. Chamado so por renderCreator. */
export function definirDadosCache(valor) { dadosCache = valor; }

/** Define o conteiner raiz do criador. Chamado so por renderCreator. */
export function definirContainer(valor) { containerRef = valor; }
