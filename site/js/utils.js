// ============================================================
// Utilitários de cálculo D&D 5.5 e helpers gerais
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTO_NOME_PARA_KEY, PERICIAS, CLASSES_INFO } from './dados-classes.js';

// --- Cálculos D&D ---

/** Calcula modificador de atributo */
export function calcMod(valor) {
  return Math.floor((valor - 10) / 2);
}

/** Formata modificador com sinal (+/-) */
export function fmtMod(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

/** Bônus de proficiência por nível do personagem */
export function bonusProficiencia(nivel) {
  return Math.ceil(nivel / 4) + 1;
}

/** Calcula PV máximo no nível 1 */
export function calcPVNivel1(dadoVida, modCon) {
  return dadoVida + modCon;
}

/** Calcula PV máximo total (nível 1 + subida simples) */
export function calcPVTotal(dadoVida, nivel, modCon) {
  // Nível 1: dado de vida máximo + mod CON
  // Níveis subsequentes: média do dado + mod CON por nível
  const mediaSubida = Math.floor(dadoVida / 2) + 1;
  return dadoVida + modCon + (nivel - 1) * (mediaSubida + modCon);
}

/** Calcula CA baseado na armadura equipada */
export function calcCA(personagem) {
  const modDes = calcMod(personagem.atributos.destreza);
  const modCon = calcMod(personagem.atributos.constituicao);
  const modSab = calcMod(personagem.atributos.sabedoria);
  const modCar = calcMod(personagem.atributos.carisma);
  const inv = personagem.inventario || [];

  // Verificar armadura equipada
  const armadura = inv.find(i => i.equipado && i.tipo === 'armadura' && i.nome !== 'Escudo');
  const escudo = inv.find(i => i.equipado && (i.nome === 'Escudo' || i.tipo === 'escudo'));

  let ca = 10 + modDes; // Sem armadura

  // Bárbaro: Defesa sem Armadura = 10 + Des + Con
  if (personagem.classe === 'Bárbaro' && !armadura) {
    ca = 10 + modDes + modCon;
  }
  // Monge: Defesa sem Armadura = 10 + Des + Sab
  if (personagem.classe === 'Monge' && !armadura) {
    ca = 10 + modDes + modSab;
  }
  // Bardo (Colégio da Dança): Defesa sem Armadura = 10 + Des + Car
  if (personagem.classe === 'Bardo' && personagem.subclasse === 'Colégio da Dança' && (personagem.nivel || 1) >= 3 && !armadura && !escudo) {
    ca = 10 + modDes + modCar;
  }
  // Feiticeiro (Feitiçaria Dracônica): Resiliência Dracônica = 10 + Des + Car (sem armadura)
  if (
    personagem.classe === 'Feiticeiro' &&
    personagem.subclasse === 'Feitiçaria Dracônica' &&
    (personagem.nivel || 1) >= 3 &&
    !armadura
  ) {
    ca = 10 + modDes + modCar;
  }

  if (armadura) {
    const caStr = armadura.dados?.ca || '';
    const caBase = parseInt(caStr) || 0;

    if (armadura.dados?.categoria === 'Leve') {
      ca = caBase + modDes;
    } else if (armadura.dados?.categoria === 'Média') {
      ca = caBase + Math.min(modDes, 2);
    } else if (armadura.dados?.categoria === 'Pesada') {
      ca = caBase;
    } else {
      // Tentar parsear formato "XX + modificador de Des"
      const match = caStr.match(/^(\d+)/);
      if (match) {
        const base = parseInt(match[1]);
        if (caStr.includes('máx. 2') || caStr.includes('max. 2')) {
          ca = base + Math.min(modDes, 2);
        } else if (caStr.includes('Des')) {
          ca = base + modDes;
        } else {
          ca = base;
        }
      }
    }
  }

  // Escudo: +2
  if (escudo) {
    ca += 2;
  }

  // Estilo de Luta: Defensivo (+1 CA enquanto usa armadura)
  const estiloLuta = personagem.escolhas_classe?.estilo_luta?.[0] || '';
  if (estiloLuta === 'Defensivo' && armadura) {
    ca += 1;
  }

  // Bônus de CA de itens customizados
  inv.filter(i => i.equipado && i.dados?.bonus_ca).forEach(i => {
    ca += parseInt(i.dados.bonus_ca) || 0;
  });

  // Efeitos mágicos ativos que afetam CA
  const efeitos = personagem.efeitos_magicos || [];
  for (const ef of efeitos) {
    if (ef.tipo_efeito === 'bonus') {
      ca += ef.valor || 0;
    } else if (ef.tipo_efeito === 'base') {
      // CA base substitui (ex: Armadura Arcana = 13 + Des)
      const caBase = (ef.valor || 13) + modDes;
      if (caBase > ca) ca = caBase;
    } else if (ef.tipo_efeito === 'minimo') {
      // CA mínima (ex: Pele-Casca = mín 17)
      if ((ef.valor || 0) > ca) ca = ef.valor;
    }
  }

  return ca;
}

/** Calcula CD de magia */
export function calcCDMagia(personagem) {
  const info = CLASSES_INFO[personagem.classe];
  if (!info || !info.atributo_conjuracao) return 0;
  const key = ATRIBUTO_NOME_PARA_KEY[info.atributo_conjuracao];
  const modAttr = calcMod(personagem.atributos[key]);
  let cd = 8 + bonusProficiencia(personagem.nivel) + modAttr;

  // Feiticeiro: Feitiçaria Inata ativa aumenta CD em +1
  if (personagem.classe === 'Feiticeiro' && personagem?.recursos?.feiticeiro?.feiticaria_inata_ativa) {
    cd += 1;
  }

  return cd;
}

/** Calcula bônus de ataque de magia */
export function calcAtaqueMagia(personagem) {
  const info = CLASSES_INFO[personagem.classe];
  if (!info || !info.atributo_conjuracao) return 0;
  const key = ATRIBUTO_NOME_PARA_KEY[info.atributo_conjuracao];
  const modAttr = calcMod(personagem.atributos[key]);
  return bonusProficiencia(personagem.nivel) + modAttr;
}

/** Calcula Percepção Passiva */
export function calcPercepcaoPassiva(personagem) {
  const modSab = calcMod(personagem.atributos.sabedoria);
  const prof = (personagem.pericias_proficientes || []).includes('Percepção');
  const exp = (personagem.pericias_expertise || []).includes('Percepção');
  let bonus = modSab;
  if (prof) bonus += bonusProficiencia(personagem.nivel);
  if (exp) bonus += bonusProficiencia(personagem.nivel);
  if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {
    bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);
  }
  return 10 + bonus;
}

/** Calcula Intuicao Passiva (10 + bonus pericia Intuicao) */
export function calcIntuicaoPassiva(personagem) {
  return 10 + calcBonusPericia(personagem, 'Intuição');
}

/** Calcula Investigacao Passiva (10 + bonus pericia Investigacao) */
export function calcInvestigacaoPassiva(personagem) {
  return 10 + calcBonusPericia(personagem, 'Investigação');
}

/** Calcula bônus de uma perícia */
export function calcBonusPericia(personagem, nomePericia, opcoes = {}) {
  const pericia = PERICIAS.find(p => p.nome === nomePericia);
  if (!pericia) return 0;

  const emFuria = !!opcoes.emFuria;
  const forcaPrimordialAtiva = !!opcoes.forcaPrimordialAtiva;
  const periciasConhecimentoPrimordial = ['Acrobacia', 'Furtividade', 'Intimidação', 'Percepção', 'Sobrevivência'];

  const usarForcaPrimordial = emFuria && forcaPrimordialAtiva && periciasConhecimentoPrimordial.includes(nomePericia);
  const key = usarForcaPrimordial ? 'forca' : ATRIBUTO_NOME_PARA_KEY[pericia.atributo];
  const mod = calcMod(personagem.atributos[key]);
  const prof = (personagem.pericias_proficientes || []).includes(nomePericia);
  const exp = (personagem.pericias_expertise || []).includes(nomePericia);
  let bonus = mod;
  if (prof) bonus += bonusProficiencia(personagem.nivel);
  if (exp) bonus += bonusProficiencia(personagem.nivel);
  // Bardo: Pau pra Toda Obra (metade da proficiência em perícias sem proficiência)
  if (personagem.classe === 'Bardo' && (personagem.nivel || 1) >= 2 && !prof && !exp) {
    bonus += Math.floor(bonusProficiencia(personagem.nivel) / 2);
  }

  // Clérigo (Ordem Divina: Taumaturgo) - bônus em Arcanismo e Religião
  if (
    personagem.classe === 'Clérigo' &&
    personagem.ordem_divina === 'Taumaturgo' &&
    (nomePericia === 'Arcanismo' || nomePericia === 'Religião')
  ) {
    bonus += Math.max(1, calcMod(personagem.atributos.sabedoria));
  }

  // Druida (Ordem Primal: Xamã) - bônus em Arcanismo e Natureza
  const ordemPrimal = personagem.ordem_primal || personagem.escolhas_classe?.ordem_primal?.[0] || '';
  if (
    personagem.classe === 'Druida' &&
    ordemPrimal === 'Xamã' &&
    (nomePericia === 'Arcanismo' || nomePericia === 'Natureza')
  ) {
    bonus += Math.max(1, calcMod(personagem.atributos.sabedoria));
  }

  // Efeitos magicos: bonus numerico de pericia (ex: Passo Sem Rastro +10 Furtividade)
  const efMag = personagem.efeitos_magicos || [];
  for (const ef of efMag) {
    if (ef.tipo === 'bonus_pericia' && typeof ef.bonus === 'number' && ef.pericia === nomePericia) {
      bonus += ef.bonus;
    }
  }

  return bonus;
}

/** Calcula espaços de magia com base na tabela da classe */
export function getEspacosMagia(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas || nivel < 1) return {};
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  if (!row) return {};
  const espacos = {};
  for (let i = 1; i <= 9; i++) {
    const val = row[String(i)];
    if (val && val !== '—' && val !== '-') {
      espacos[i] = { total: parseInt(val) || 0, usados: 0 };
    }
  }
  return espacos;
}

/** Quantidade de truques por nível (da tabela da classe) */
export function getTruquesConhecidos(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas) return 0;
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  return row ? (parseInt(row['Truques']) || 0) : 0;
}

/** Magias preparadas por nível (da tabela da classe) */
export function getMagiaPreparadas(tabelaCaracteristicas, nivel) {
  if (!tabelaCaracteristicas) return 0;
  const row = tabelaCaracteristicas.find(r => parseInt(r['Nível']) === nivel);
  return row ? (parseInt(row['Magias Preparadas']) || 0) : 0;
}

/** Deslocamento padrão da espécie (extraído do texto_completo) */
export function getDeslocamento(especieTexto) {
  if (!especieTexto) return '9 metros';
  const textoLimpo = especieTexto.replace(/\*\*/g, '');
  const match = textoLimpo.match(/Deslocamento:\s*(\d+(?:[\.,]\d+)?\s*metros?)/i);
  return match ? match[1].trim() : '9 metros';
}

/** Tamanho da espécie */
export function getTamanho(especieTexto) {
  if (!especieTexto) return 'Médio';
  const textoLimpo = especieTexto.replace(/\*\*/g, '');
  const match = textoLimpo.match(/Tamanho:\s*([^\n]+)/i);
  if (!match) return 'Médio';
  const linha = match[1].trim();

  if (/Médio\s*\(.+?\)\s*ou\s*Pequeno|Pequeno\s*\(.+?\)\s*ou\s*Médio/i.test(linha)) {
    return 'Médio ou Pequeno';
  }

  const tamanhoBase = linha.match(/\b(Pequeno|Médio|Grande)\b/i);
  return tamanhoBase ? tamanhoBase[1] : 'Médio';
}

// --- Renderizador simples de Markdown ---

/** Formata notação de dados (ex: 3d6, 2D8) como 🎲3d6🎲 */
export function formatarDados(texto) {
  if (!texto) return texto;
  return texto.replace(/(\d+)[dD](\d+)/g, '🎲$1d$2🎲');
}

/** Converte markdown básico para HTML */
export function mdParaHtml(texto) {
  if (!texto) return '';
  let html = texto
    // Escapar HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Formatar dados (🎲XdY🎲) antes de outras transformações
    .replace(/(\d+)[dD](\d+)/g, '🎲$1d$2🎲')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // Negrito e itálico
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Listas
    .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
    // Tabelas simples (pipes)
    .replace(/\|(.+)\|/g, (match) => {
      const cells = match.split('|').filter(c => c.trim());
      if (cells.every(c => /^[\s-:]+$/.test(c))) return ''; // Separador
      const tag = cells.some(c => /^\*\*.+\*\*$/.test(c.trim())) ? 'th' : 'td';
      return '<tr>' + cells.map(c => `<${tag}>${c.trim().replace(/\*\*/g, '')}</${tag}>`).join('') + '</tr>';
    });

  // Agrupar <li> em <ul>
  html = html.replace(/((?:<li>.+<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Agrupar <tr> em <table>
  html = html.replace(/((?:<tr>.+<\/tr>\n?)+)/g, '<div class="table-wrapper"><table>$1</table></div>');

  // Parágrafos (linhas que não são tags)
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<')) return trimmed;
    return `<p>${trimmed}</p>`;
  }).join('\n');

  return html;
}

// --- Helpers gerais ---

/**
 * Detecta tipo de recarga de uma habilidade pela descrição.
 * Retorna 'curto', 'longo', 'curto_ou_longo' ou null (passiva).
 */
export function detectarRecarga(descricao) {
  if (!descricao) return null;
  const d = descricao.toLowerCase();
  if (d.includes('descanso curto ou longo') || d.includes('descanso longo ou curto'))
    return 'curto_ou_longo';
  // Check for short rest recharge
  const temCurto = d.includes('descanso curto');
  const temLongo = d.includes('descanso longo');
  if (temCurto && temLongo) return 'curto_ou_longo';
  if (temCurto) return 'curto';
  if (temLongo) return 'longo';
  return null;
}

/**
 * Detecta se uma habilidade é ativa (tem ação, reação, etc.) vs passiva.
 */
export function ehHabilidadeAtiva(descricao, nome) {
  if (!descricao) return false;
  // Habilidades que sao descritivas por natureza (listas de magias, conjuracao), nao importa o conteudo
  if (nome) {
    const n = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('conjuracao') || n.includes('pacto magico') || n.includes('magia de pacto') || n.startsWith('magias d')) return false;
  }
  const d = descricao.toLowerCase();
  const recarga = detectarRecarga(descricao);
  if (recarga) return true;
  const acoes = ['como uma ação', 'como ação bônus', 'como uma reação', 'você pode usar', 'você pode gastar', 'no seu turno'];
  return acoes.some(a => d.includes(a));
}

/** Gera UUID v4 simples */
export function gerarId() {
  return 'xxxx-xxxx-xxxx'.replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );
}

/** Formata data para exibição */
export function fmtData(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Mostra toast de notificação */
export function toast(msg, tipo = '') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/** Debounce simples */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/** Remove acentos para busca */
export function semAcento(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Contador de sub-modais ativos */
let _subModalCount = 0;
/** Callback opcional ao fechar o modal principal */
let _onModalClose = null;

/** Abre modal global. onClose é chamado quando o modal principal é fechado. */
export function abrirModal(titulo, corpoHtml, acoesHtml = '', onClose = null) {
  const overlay = document.getElementById('modal-overlay');
  const tituloEl = document.getElementById('modal-titulo');
  const corpoEl = document.getElementById('modal-corpo');
  const acoesEl = document.getElementById('modal-acoes');

  // Se ja existe modal aberto, abrir como sub-modal (overlay empilhado)
  if (overlay.style.display === 'flex') {
    _subModalCount++;
    const sub = document.createElement('div');
    sub.className = 'modal-overlay sub-modal-overlay';
    sub.id = `sub-modal-overlay-${_subModalCount}`;
    sub.style.display = 'flex';
    sub.style.zIndex = 200 + _subModalCount;
    sub.innerHTML = `
      <div class="modal-container" style="animation:slideUp 0.2s">
        <div class="modal-header" style="position:sticky;top:0;background:var(--bg-card);z-index:1">
          <h2 style="font-size:1rem;font-weight:700">${titulo}</h2>
          <button class="modal-fechar" data-fechar-sub="true">&times;</button>
        </div>
        <div class="modal-corpo" style="padding:16px">${corpoHtml}</div>
        <div class="modal-acoes" style="padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border-light)">${acoesHtml}</div>
      </div>
    `;
    document.body.appendChild(sub);
    // Fechar sub-modal ao clicar fora ou no X
    sub.addEventListener('click', (e) => {
      if (e.target === sub || e.target.closest('[data-fechar-sub]')) {
        sub.remove();
        _subModalCount--;
      }
    });
    // Substituir onclick="fecharModal()" nos botões do sub-modal
    sub.querySelectorAll('[onclick*="fecharModal"]').forEach(btn => {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', () => { sub.remove(); _subModalCount--; });
    });
    return;
  }

  tituloEl.textContent = titulo;
  corpoEl.innerHTML = corpoHtml;
  acoesEl.innerHTML = acoesHtml;
  overlay.style.display = 'flex';
  _onModalClose = onClose;
  document.getElementById('modal-container').scrollTop = 0;
}

/** Fecha modal global */
export function fecharModal() {
  // Se existem sub-modais, fechar o mais recente
  if (_subModalCount > 0) {
    const sub = document.getElementById(`sub-modal-overlay-${_subModalCount}`);
    if (sub) sub.remove();
    _subModalCount--;
    return;
  }
  document.getElementById('modal-overlay').style.display = 'none';
  if (_onModalClose) { const cb = _onModalClose; _onModalClose = null; cb(); }
}

/** Fecha todos os modais (principal + sub-modais) */
export function fecharModalTodos() {
  // Remover todos sub-modais
  document.querySelectorAll('.sub-modal-overlay').forEach(el => el.remove());
  _subModalCount = 0;
  document.getElementById('modal-overlay').style.display = 'none';
  if (_onModalClose) { const cb = _onModalClose; _onModalClose = null; cb(); }
}
// Expor para onclick inline
window.fecharModal = fecharModal;
window.fecharModalTodos = fecharModalTodos;

/** Extrai número base de uma string de CA (ex: "14 + Modificador de Des (máx. 2)" -> 14) */
export function parsearCA(caStr) {
  if (!caStr) return 10;
  const match = caStr.match(/^[+]?(\d+)/);
  return match ? parseInt(match[1]) : 10;
}
