// ============================================================
// Passo 7: detalhes pessoais e idiomas
// Extraido de site/js/pages/creator.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_NOMES, CLASSES_INFO } from '../dados-classes.js';
import { calcMod, calcPVNivel1, descreverCapacidadeCarga, escHtml, getTamanho, processarImagemArquivo, toast } from '../utils.js';
import { dadosCache, personagem } from './wizard.js';

// ============================================================
// PASSO 7: DETALHES
// ============================================================

// PHB 2024 (cap. 2): personagem conhece Comum + 2 idiomas da lista de Idiomas Comuns
const IDIOMAS_COMUNS_2024 = [
  'Comum', 'Língua de Sinais Comum', 'Dracônico', 'Anão', 'Élfico',
  'Gigante', 'Gnômico', 'Goblin', 'Pequenino', 'Orc'
];

export function obterRegraIdiomasAtual() {
  const antecedente = dadosCache.antecedentes?.find(a => a.nome === personagem.antecedente);
  const especie = dadosCache.especies?.find(e => e.nome === personagem.especie);

  const obrigatorios = new Set(['Comum']);
  let maxAdicionais = antecedente ? 2 : 0;
  let opcoes = new Set(IDIOMAS_COMUNS_2024.filter(i => i !== 'Comum'));

  // Extensível por dados: se no futuro os JSONs tiverem campos de idiomas, esta função já suporta
  const aplicarConfig = (obj) => {
    if (!obj) return;
    if (Array.isArray(obj.idiomas_obrigatorios)) {
      obj.idiomas_obrigatorios.forEach(i => obrigatorios.add(i));
    }
    if (Array.isArray(obj.idiomas_opcoes)) {
      opcoes = new Set(obj.idiomas_opcoes.filter(i => !obrigatorios.has(i)));
    }
    if (Array.isArray(obj.idiomas_extra_opcoes)) {
      obj.idiomas_extra_opcoes.forEach(i => { if (!obrigatorios.has(i)) opcoes.add(i); });
    }
    if (Number.isInteger(obj.idiomas_adicionais)) {
      maxAdicionais = Math.max(0, obj.idiomas_adicionais);
    }
    if (Number.isInteger(obj.idiomas_bonus)) {
      maxAdicionais += Math.max(0, obj.idiomas_bonus);
    }
  };

  aplicarConfig(antecedente);
  aplicarConfig(especie);

  return {
    obrigatorios: [...obrigatorios],
    opcoes: [...opcoes],
    maxAdicionais
  };
}

function sanitizarIdiomasSelecionados(listaIdiomas, regraIdiomas) {
  const obrigatoriosSet = new Set(regraIdiomas.obrigatorios);
  const opcoesSet = new Set(regraIdiomas.opcoes);
  const entrada = Array.isArray(listaIdiomas) ? listaIdiomas : [];

  const adicionais = [...new Set(
    entrada.filter(i => !obrigatoriosSet.has(i) && opcoesSet.has(i))
  )].slice(0, regraIdiomas.maxAdicionais);

  return [...regraIdiomas.obrigatorios, ...adicionais];
}

export function renderStepDetalhes(el) {
  const info = CLASSES_INFO[personagem.classe];
  const modCon = calcMod(personagem.atributos.constituicao);
  const pvCalc = info ? calcPVNivel1(info.dado_vida, modCon) 
    + (personagem.especie === 'Anão' ? (personagem.nivel || 1) : 0) 
    + ((personagem.talentos || []).some(t => (typeof t === 'string' ? t : t.nome) === 'Vigoroso') ? (personagem.nivel || 1) * 2 : 0)
    : 0;
  const regraIdiomas = obterRegraIdiomasAtual();
  const obrigatoriosIdiomasSet = new Set(regraIdiomas.obrigatorios);

  // Saneamento: aplica a regra atual de idiomas ao estado do personagem
  personagem.idiomas = sanitizarIdiomasSelecionados(personagem.idiomas, regraIdiomas);

  // Detectar se a espécie permite escolha de tamanho
  const espData = dadosCache.especies?.find(e => e.nome === personagem.especie);
  const textoEsp = espData?.texto_completo || '';
  const permiteTamanhoEscolha = /Médio.*ou Pequeno|Pequeno.*ou Médio/i.test(textoEsp);

  // Tamanho: usar o salvo, ou detectar do texto da espécie
  if (!personagem.tamanho && espData) {
    if (permiteTamanhoEscolha) {
      personagem.tamanho = 'Médio'; // padrao quando ha escolha
    } else {
      personagem.tamanho = getTamanho(textoEsp) || 'Médio';
    }
  }

  // Construir HTML de escolha de tamanho (fora do template literal para evitar conflito de backticks)
  let tamanhoCardHtml = '';
  if (permiteTamanhoEscolha) {
    const matchMedio = textoEsp.match(/Médio\s*\(([^)]+)\)/);
    const matchPequeno = textoEsp.match(/Pequeno\s*\(([^)]+)\)/);
    const alturaMedio = matchMedio ? matchMedio[1] : 'cerca de 1,20-2,10 metros';
    const alturaPequeno = matchPequeno ? matchPequeno[1] : 'cerca de 0,60-1,20 metro';
    const borderMedio = personagem.tamanho === 'Médio' ? 'var(--primary)' : 'var(--border-light)';
    const borderPequeno = personagem.tamanho === 'Pequeno' ? 'var(--primary)' : 'var(--border-light)';
    const _forcaCarga = personagem.atributos?.forca || 0;
    tamanhoCardHtml = `
    <div class="card mb-2">
      <div class="card-header"><h3>Tamanho da Criatura</h3></div>
      <div class="info-box info" style="font-size:0.85rem">
        A espécie <strong>${personagem.especie}</strong> permite escolher entre Médio ou Pequeno.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
        <div style="border:2px solid ${borderMedio};border-radius:8px;padding:10px;cursor:pointer;transition:border-color 0.2s" data-tamanho-card="Médio">
          <label class="form-check" style="font-weight:700;font-size:0.95rem;margin-bottom:4px">
            <input type="radio" name="det-tamanho" value="Médio" ${personagem.tamanho === 'Médio' ? 'checked' : ''}> Médio
          </label>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            <div>Altura: ${alturaMedio}</div>
            <div>Espaco em combate: 1,5 x 1,5 m</div>
            <div>Capacidade de carga: <strong>${descreverCapacidadeCarga(_forcaCarga, 'Médio')}</strong></div>
          </div>
        </div>
        <div style="border:2px solid ${borderPequeno};border-radius:8px;padding:10px;cursor:pointer;transition:border-color 0.2s" data-tamanho-card="Pequeno">
          <label class="form-check" style="font-weight:700;font-size:0.95rem;margin-bottom:4px">
            <input type="radio" name="det-tamanho" value="Pequeno" ${personagem.tamanho === 'Pequeno' ? 'checked' : ''}> Pequeno
          </label>
          <div style="font-size:0.8rem;color:var(--text-muted)">
            <div>Altura: ${alturaPequeno}</div>
            <div>Espaco em combate: 1,5 x 1,5 m</div>
            <div>Capacidade de carga: <strong>${descreverCapacidadeCarga(_forcaCarga, 'Pequeno')}</strong></div>
          </div>
        </div>
      </div>
      <div class="info-box" style="font-size:0.78rem;margin-top:8px;background:var(--bg-hover)">
        <strong>Diferenças de tamanho:</strong> Ambos ocupam o mesmo espaco em combate e possuem a mesma capacidade de carga.
        Algumas habilidades e magias referenciam o tamanho relativo da criatura (ex: mover-se pelo espaco de criaturas maiores, Imobilizar, Empurrar).
      </div>
    </div>
    `;
  } else {
    // Especie com tamanho fixo - exibir informacao somente leitura
    const matchAltura = textoEsp.match(/(?:Médio|Pequeno|Grande)\s*\(([^)]+)\)/);
    const alturaFixa = matchAltura ? matchAltura[1] : '';
    const tamanhoFixo = personagem.tamanho || 'Médio';
    const espacoCombate = tamanhoFixo === 'Pequeno' ? '1,5 x 1,5 m' : (tamanhoFixo === 'Grande' ? '3 x 3 m' : '1,5 x 1,5 m');
    const _forcaCargaFixo = personagem.atributos?.forca || 0;
    const _capFixo = descreverCapacidadeCarga(_forcaCargaFixo, tamanhoFixo);
    tamanhoCardHtml = `
    <div class="card mb-2">
      <div class="card-header"><h3>Tamanho da Criatura</h3></div>
      <div style="border:2px solid var(--primary);border-radius:8px;padding:10px;margin-top:4px">
        <div style="font-weight:700;font-size:0.95rem;margin-bottom:4px">${tamanhoFixo}</div>
        <div style="font-size:0.8rem;color:var(--text-muted)">
          ${alturaFixa ? '<div>Altura: ' + alturaFixa + '</div>' : ''}
          <div>Espaco em combate: ${espacoCombate}</div>
          <div>Capacidade de carga: <strong>${_capFixo}</strong></div>
        </div>
      </div>
    </div>
    `;
  }

  el.innerHTML = `
    <h3 style="margin-bottom:12px">Detalhes do Personagem</h3>

    <div class="card mb-2">
      <div class="row gap-1">
        <div class="col" style="flex:2">
          <div class="form-group">
            <label class="form-label">Nome do Personagem</label>
            <input type="text" class="form-input" id="det-nome" value="${escHtml(personagem.nome)}" placeholder="Nome do seu personagem">
          </div>
        </div>
        <div class="col" style="flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px">
          <div class="char-avatar" id="det-imagem-preview" style="width:56px;height:56px;font-size:1.4rem">
            ${personagem.imagem ? `<img src="${escHtml(personagem.imagem)}" alt="">` : escHtml((personagem.nome || personagem.classe || '?').charAt(0).toUpperCase() || '?')}
          </div>
          <div style="display:flex;gap:4px">
            <button type="button" class="btn btn-sm btn-secondary" id="det-imagem-btn">Foto</button>
            <button type="button" class="btn btn-sm btn-danger" id="det-imagem-remover" title="Remover imagem" style="${personagem.imagem ? '' : 'display:none'}">&times;</button>
          </div>
          <input type="file" accept="image/*" id="det-imagem-input" style="display:none">
        </div>
      </div>

      <div class="info-box success">
        <strong>Resumo:</strong>
        ${escHtml(personagem.especie)} ${escHtml(personagem.classe)} ${personagem.subclasse ? `(${escHtml(personagem.subclasse)})` : ''} |
        Antecedente: ${escHtml(personagem.antecedente)} |
        PV: ${pvCalc} |
        Talento: ${escHtml(personagem.talentos.join(', ')) || 'Nenhum'}
        ${(personagem.iniciado_em_magia_instancias || []).filter(im => im.lista).map(im => `<br>Iniciado em Magia (${escHtml(im.lista)}): Atributo ${escHtml(ATRIBUTOS_NOMES[im.atributo] || im.atributo)} | Truques: ${escHtml((im.truques||[]).join(', '))} | Magia: ${escHtml(im.magia)}`).join('')}
      </div>
    </div>

    <!-- Tamanho da Criatura -->
    ${tamanhoCardHtml}

    <!-- Idiomas -->
    <div class="card mb-2">
      <div class="card-header"><h3>Idiomas</h3></div>
      <div class="info-box info" style="font-size:0.85rem">
        Regra validada pelo Livro do Jogador 2024: idiomas da origem (Comum + adicionais).
        <div id="det-idiomas-contador" style="margin-top:4px">Selecionados: <strong>${personagem.idiomas.filter(i => !obrigatoriosIdiomasSet.has(i)).length}/${regraIdiomas.maxAdicionais}</strong></div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px" id="det-idiomas-grid">
        ${[...regraIdiomas.obrigatorios, ...regraIdiomas.opcoes].map(idioma => {
          const selecionado = personagem.idiomas.includes(idioma);
          const ehObrigatorio = obrigatoriosIdiomasSet.has(idioma);
          const atingiuLimite = personagem.idiomas.filter(i => !obrigatoriosIdiomasSet.has(i)).length >= regraIdiomas.maxAdicionais;
          return `
            <label class="form-check" style="min-width:160px;${ehObrigatorio ? 'opacity:0.6' : ''}">
              <input type="checkbox" data-idioma="${idioma}" ${selecionado ? 'checked' : ''} ${ehObrigatorio ? 'disabled' : ''} ${(!ehObrigatorio && !selecionado && atingiuLimite) ? 'disabled' : ''}> ${idioma}
            </label>`;
        }).join('')}
      </div>
    </div>

    <!-- Alinhamento -->
    <div class="card mb-2">
      <div class="card-header"><h3>Alinhamento</h3></div>
      <div class="info-box info" style="font-size:0.85rem">
        O alinhamento descreve as atitudes eticas e morais do personagem.
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px" id="det-alinhamento-grid">
        ${[
          { valor: 'OB', label: 'Ordeiro e Bom' },
          { valor: 'NB', label: 'Neutro e Bom' },
          { valor: 'CB', label: 'Caotico e Bom' },
          { valor: 'ON', label: 'Ordeiro e Neutro' },
          { valor: 'N',  label: 'Neutro' },
          { valor: 'CN', label: 'Caotico e Neutro' },
          { valor: 'OM', label: 'Ordeiro e Mau' },
          { valor: 'NM', label: 'Neutro e Mau' },
          { valor: 'CM', label: 'Caotico e Mau' }
        ].map(a => `
          <div class="opcao-card ${personagem.alinhamento === a.valor ? 'selecionada' : ''}" data-alinhamento="${a.valor}" style="cursor:pointer;text-align:center;padding:8px 4px">
            <div class="opcao-nome" style="font-size:0.8rem">${a.label}</div>
            <div class="opcao-resumo" style="font-size:0.7rem;color:var(--text-muted)">${a.valor}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card mb-2">
      <div class="card-header"><h3>Aparencia e Personalidade</h3></div>
      <div class="form-group">
        <label class="form-label">Aparencia</label>
        <textarea class="form-textarea" id="det-aparencia" rows="2" placeholder="Descreva a aparencia...">${escHtml(personagem.aparencia)}</textarea>
      </div>
      <div class="row gap-1">
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Tracos de Personalidade</label>
            <textarea class="form-textarea" id="det-personalidade" rows="2">${escHtml(personagem.personalidade)}</textarea>
          </div>
        </div>
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Ideais</label>
            <textarea class="form-textarea" id="det-ideais" rows="2">${escHtml(personagem.ideais)}</textarea>
          </div>
        </div>
      </div>
      <div class="row gap-1">
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Lacos</label>
            <textarea class="form-textarea" id="det-lacos" rows="2">${escHtml(personagem.lacos)}</textarea>
          </div>
        </div>
        <div class="col-2">
          <div class="form-group">
            <label class="form-label">Defeitos</label>
            <textarea class="form-textarea" id="det-defeitos" rows="2">${escHtml(personagem.defeitos)}</textarea>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="form-group">
        <label class="form-label">Historia do Personagem</label>
        <textarea class="form-textarea" id="det-historia" rows="4" placeholder="Conte a historia do seu personagem...">${escHtml(personagem.historia_personagem)}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-textarea" id="det-notas" rows="3" placeholder="Notas livres...">${escHtml(personagem.notas)}</textarea>
      </div>
    </div>
  `;

  // Validação interativa de idiomas por regra dinâmica
  const atualizarEstadoIdiomas = () => {
    const checks = [...document.querySelectorAll('[data-idioma]')];
    const selecionadosAdicionais = checks.filter(c => !obrigatoriosIdiomasSet.has(c.dataset.idioma) && c.checked).length;

    checks.forEach(c => {
      const ehObrigatorio = obrigatoriosIdiomasSet.has(c.dataset.idioma);
      if (ehObrigatorio) return;
      if (!c.checked && selecionadosAdicionais >= regraIdiomas.maxAdicionais) c.disabled = true;
      else c.disabled = false;
    });

    const contador = document.getElementById('det-idiomas-contador');
    if (contador) {
      contador.innerHTML = `Selecionados: <strong>${selecionadosAdicionais}/${regraIdiomas.maxAdicionais}</strong>`;
    }
  };

  document.querySelectorAll('[data-idioma]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checks = [...document.querySelectorAll('[data-idioma]')];
      const selecionadosAdicionais = checks.filter(c => !obrigatoriosIdiomasSet.has(c.dataset.idioma) && c.checked).length;
      if (selecionadosAdicionais > regraIdiomas.maxAdicionais) {
        cb.checked = false;
        toast(`Você pode selecionar no máximo ${regraIdiomas.maxAdicionais} idioma(s) adicional(is).`, 'error');
      }
      atualizarEstadoIdiomas();
    });
  });

  atualizarEstadoIdiomas();

  // Eventos de selecao de tamanho (click no card seleciona o radio e atualiza visual)
  document.querySelectorAll('[data-tamanho-card]').forEach(card => {
    card.addEventListener('click', () => {
      const valor = card.dataset.tamanhoCard;
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      personagem.tamanho = valor;
      // Atualizar bordas visuais
      document.querySelectorAll('[data-tamanho-card]').forEach(c => {
        c.style.borderColor = c.dataset.tamanhoCard === valor ? 'var(--primary)' : 'var(--border-light)';
      });
    });
  });

  // Eventos de selecao de alinhamento
  document.querySelectorAll('[data-alinhamento]').forEach(card => {
    card.addEventListener('click', () => {
      const valor = card.dataset.alinhamento;
      personagem.alinhamento = valor;
      document.querySelectorAll('[data-alinhamento]').forEach(c => {
        c.classList.toggle('selecionada', c.dataset.alinhamento === valor);
      });
    });
  });

  document.getElementById('det-imagem-btn')?.addEventListener('click', () => {
    document.getElementById('det-imagem-input')?.click();
  });

  const detImagemInicial = () => (personagem.nome || personagem.classe || '?').charAt(0).toUpperCase() || '?';

  document.getElementById('det-imagem-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await processarImagemArquivo(file, 300);
    if (!dataUrl) {
      toast('Não foi possível processar essa imagem', 'error');
      return;
    }
    personagem.imagem = dataUrl;
    const preview = document.getElementById('det-imagem-preview');
    if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="">`;
    const btnRemover = document.getElementById('det-imagem-remover');
    if (btnRemover) btnRemover.style.display = '';
  });

  document.getElementById('det-imagem-remover')?.addEventListener('click', () => {
    personagem.imagem = '';
    const preview = document.getElementById('det-imagem-preview');
    if (preview) preview.textContent = detImagemInicial();
    const btnRemover = document.getElementById('det-imagem-remover');
    if (btnRemover) btnRemover.style.display = 'none';
  });
}

export function coletarDetalhes() {
  personagem.nome = document.getElementById('det-nome')?.value?.trim() || personagem.nome;
  personagem.aparencia = document.getElementById('det-aparencia')?.value || '';
  personagem.personalidade = document.getElementById('det-personalidade')?.value || '';
  personagem.ideais = document.getElementById('det-ideais')?.value || '';
  personagem.lacos = document.getElementById('det-lacos')?.value || '';
  personagem.defeitos = document.getElementById('det-defeitos')?.value || '';
  personagem.historia_personagem = document.getElementById('det-historia')?.value || '';
  personagem.notas = document.getElementById('det-notas')?.value || '';

  // Alinhamento ja eh salvo interativamente via evento de clique

  // Coletar idiomas selecionados
  const idiomasSelecionados = [];
  document.querySelectorAll('[data-idioma]').forEach(cb => {
    if (cb.checked) idiomasSelecionados.push(cb.dataset.idioma);
  });
  const regraIdiomas = obterRegraIdiomasAtual();
  personagem.idiomas = sanitizarIdiomasSelecionados(idiomasSelecionados, regraIdiomas);

  // Coletar tamanho escolhido
  const tamanhoSel = document.querySelector('[name="det-tamanho"]:checked');
  if (tamanhoSel) personagem.tamanho = tamanhoSel.value;
}
