// ============================================================
// Geracao do PDF da ficha (cartao + blocos de detalhe)
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { ATRIBUTOS_KEYS, ATRIBUTOS_NOMES, CLASSES_INFO } from '../dados-classes.js';
import { bonusProficiencia, calcAtaqueMagia, calcBonusPericia, calcCA, calcCDMagia, calcIntuicaoPassiva, calcInvestigacaoPassiva, calcMod, calcPercepcaoPassiva, fmtMod, getDeslocamento, toast } from '../utils.js';
import { forcaPrimordialAtiva, getDeslocamentoFinal, getModIniciativa } from './combate.js';
import { char, especiesCache, passivosTalentosCache } from './estado.js';
import { gerarHtmlImpressao } from './impressao.js';

/* ===========================================================================
   GERACAO DE PDF (pdf-lib)
   Gera o PDF da ficha desenhando bytes no cliente com pdf-lib, sem depender de
   window.print(), html2canvas ou navigator.share — APIs que o container do app
   instalado (WKWebView iOS em standalone) bloqueia. Funciona igual no navegador
   e no app. Gera a ficha completa: cartao estilizado (1a pagina) + descricoes de
   talentos/caracteristicas/magias fluindo nas paginas seguintes.
   =========================================================================== */

let _pdfLibPromise = null;
function carregarPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!_pdfLibPromise) {
    _pdfLibPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/vendor/pdf-lib.min.js';
      script.onload = () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('PDFLib nao carregou'));
      script.onerror = () => reject(new Error('Falha ao carregar pdf-lib'));
      document.head.appendChild(script);
    });
  }
  return _pdfLibPromise;
}

// Pontuacao Unicode que a fonte Helvetica (WinAnsi/CP1252) consegue codificar.
// Qualquer outro caractere fora de Latin-1 vira '?' para nao estourar o drawText.
const _PDF_UNICODE_OK = new Set(['–', '—', '‘', '’', '“', '”', '…', '•', '€', '™']);
function _sanitizePdfText(t) {
  if (t == null) return '';
  let out = '';
  for (const ch of String(t)) {
    const cp = ch.codePointAt(0);
    if (cp <= 0xFF || _PDF_UNICODE_OK.has(ch)) out += ch;
    else out += '?';
  }
  return out;
}

/**
 * Reune os dados da ficha num objeto estruturado para o cartao desenhado do PDF
 * (cabecalho, stats de combate, atributos, salvaguardas, pericias, sentidos,
 * defesas, equipado). Talentos/caracteristicas/magias com descricao vem depois,
 * do HTML de impressao (ver _extrairBlocosDetalhe).
 */
function _montarDadosCartao() {
  const info = CLASSES_INFO[char.classe] || {};
  const prof = bonusProficiencia(char.nivel);
  const ca = calcCA(char, passivosTalentosCache);
  const ini = getModIniciativa();
  const esp = especiesCache?.especies?.find(e => e.nome === char.especie);
  const desloc = getDeslocamentoFinal(getDeslocamento(esp?.texto_completo || ''));

  const stats = [
    { label: 'CA', value: String(ca) },
    { label: 'PV', value: `${char.pv_atual ?? 0}/${char.pv_max ?? 0}` },
    { label: 'Iniciativa', value: fmtMod(ini.valor) },
    { label: 'Deslocam.', value: desloc },
    { label: 'Prof.', value: `+${prof}` },
  ];
  if (char.pv_temp) stats.push({ label: 'PV Temp', value: `+${char.pv_temp}` });
  if (info.conjurador) {
    stats.push({ label: 'CD Magia', value: String(calcCDMagia(char)) });
    stats.push({ label: 'Atq Magia', value: fmtMod(calcAtaqueMagia(char)) });
  }

  const atributos = ATRIBUTOS_KEYS.map(k => ({
    nome: ATRIBUTOS_NOMES[k],
    mod: fmtMod(calcMod(char.atributos[k])),
    val: String(char.atributos[k]),
  }));

  const saves = ATRIBUTOS_KEYS.map(k => {
    const m = calcMod(char.atributos[k]);
    const p = (char.salvaguardas_proficientes || []).includes(ATRIBUTOS_NOMES[k]);
    return { nome: ATRIBUTOS_NOMES[k], bonus: fmtMod(m + (p ? prof : 0)), prof: p };
  });

  const listaBase = ['Percepção','Intuição','Investigação','Religião','História','Prestidigitação','Furtividade','Persuasão','Atletismo','Medicina','Acrobacia','Enganação','Arcanismo','Sobrevivência','Natureza','Atuação','Intimidação','Lidar com Animais'];
  const pericias = listaBase.map(n => {
    const p = (char.pericias_proficientes || []).includes(n);
    const e = (char.pericias_expertise || []).includes(n);
    const bn = calcBonusPericia(char, n, { emFuria: false, forcaPrimordialAtiva: false });
    return { nome: n, bonus: fmtMod(bn), prof: p, exp: e };
  });

  const sentidos = [
    ['Percepção', calcPercepcaoPassiva(char)],
    ['Intuição', calcIntuicaoPassiva(char)],
    ['Investigação', calcInvestigacaoPassiva(char)],
  ].map(([n, v]) => `${n} ${v}`);

  const defesas = [];
  if ((char.resistencias || []).length) defesas.push(`Resist.: ${char.resistencias.join(', ')}`);
  if ((char.vulnerabilidades || []).length) defesas.push(`Vulner.: ${char.vulnerabilidades.join(', ')}`);
  if ((char.imunidades || []).length) defesas.push(`Imun.: ${char.imunidades.join(', ')}`);

  const inv = char.inventario || [];
  const equipado = inv.filter(i => i.equipado && (i.quantidade ?? 1) > 0)
    .map(i => `${i.nome}${(i.quantidade ?? 1) > 1 ? ` x${i.quantidade}` : ''}`);

  return {
    nome: char.nome || 'Sem Nome',
    sub: `${char.especie || ''} ${char.classe || ''}${char.subclasse ? ` (${char.subclasse})` : ''} — Nível ${char.nivel}${char.antecedente ? ` | ${char.antecedente}` : ''}${char.alinhamento ? ` | ${char.alinhamento}` : ''}`,
    // Data URL gravado pelo "Trocar foto" da edicao (sempre JPEG, ver
    // processarImagemArquivo em utils.js). Vai embutido no PDF.
    imagem: typeof char.imagem === 'string' && char.imagem.trim() ? char.imagem : '',
    stats, atributos, saves, pericias, sentidos, defesas, equipado,
  };
}

/**
 * Extrai blocos de texto das secoes detalhadas do HTML de impressao (talentos,
 * caracteristicas, tracos, magias com descricao, inventario, detalhes),
 * reaproveitando gerarHtmlImpressao() em vez de reimplementar a logica. Pula as
 * secoes de pagina 1 que ja vao no resumo.
 */
function _extrairBlocosDetalhe(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const pular = new Set(['Atributos', 'Salvaguardas', 'Pericias', 'Perícias', 'Sentidos Passivos', 'Defesas', 'Equipamento']);
  const blocos = [];
  const limpar = s => (s || '').replace(/\s+/g, ' ').trim();

  doc.querySelectorAll('.print-section').forEach(sec => {
    const titulo = limpar(sec.querySelector('.print-section-title')?.textContent);
    if (!titulo || pular.has(titulo)) return;
    blocos.push({ t: 'h2', text: titulo });

    const feats = sec.querySelectorAll('.print-feature');
    const spells = sec.querySelectorAll('.print-spell');
    if (feats.length) {
      feats.forEach(f => {
        const nome = limpar(f.querySelector('.print-feature-name')?.textContent);
        if (nome) blocos.push({ t: 'name', text: nome });
        f.querySelectorAll('.print-feature-desc').forEach(d => {
          const tx = limpar(d.textContent);
          if (tx) blocos.push({ t: 'p', text: tx });
        });
      });
    } else if (spells.length) {
      spells.forEach(s => {
        const nome = limpar(s.querySelector('.print-spell-name')?.textContent);
        const meta = limpar(s.querySelector('.print-spell-meta')?.textContent);
        const desc = limpar(s.querySelector('.print-spell-desc')?.textContent);
        if (nome) blocos.push({ t: 'name', text: nome });
        if (meta) blocos.push({ t: 'meta', text: meta });
        if (desc) blocos.push({ t: 'p', text: desc });
      });
    } else {
      const clone = sec.cloneNode(true);
      clone.querySelector('.print-section-title')?.remove();
      const tx = limpar(clone.textContent);
      if (tx) blocos.push({ t: 'p', text: tx });
    }
  });
  return blocos;
}

/** Quebra texto em linhas que cabem em maxW, medindo com a fonte. */
function _quebrarLinhas(text, font, size, maxW) {
  const linhas = [];
  for (const paragrafo of String(text).split('\n')) {
    const palavras = paragrafo.split(/\s+/).filter(Boolean);
    let cur = '';
    for (const w of palavras) {
      const teste = cur ? cur + ' ' + w : w;
      if (font.widthOfTextAtSize(teste, size) > maxW && cur) { linhas.push(cur); cur = w; }
      else cur = teste;
    }
    linhas.push(cur);
  }
  return linhas;
}

// ---- Primitivas de desenho do PDF (recebem o contexto ctx) ----

function _pdfTxt(ctx, text, x, yBaseline, font, size, color) {
  ctx.page.drawText(_sanitizePdfText(text), { x, y: yBaseline, size, font, color });
}
function _pdfCen(ctx, text, cx, yBaseline, font, size, color) {
  const t = _sanitizePdfText(text);
  const w = font.widthOfTextAtSize(t, size);
  ctx.page.drawText(t, { x: cx - w / 2, y: yBaseline, size, font, color });
}
/** Trunca com reticencias para caber em maxW. */
function _pdfFit(text, font, size, maxW) {
  let t = _sanitizePdfText(text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + '…', size) > maxW) t = t.slice(0, -1);
  return t + '…';
}
/** Cabecalho de secao: faixa vinho com titulo branco. */
function _pdfSecHead(ctx, titulo) {
  ctx.ensure(28);
  const h = 15;
  ctx.page.drawRectangle({ x: ctx.M, y: ctx.y - h, width: ctx.maxW, height: h, color: ctx.C.maroon });
  _pdfTxt(ctx, titulo.toUpperCase(), ctx.M + 6, ctx.y - 11, ctx.fontB, 8.5, ctx.C.white);
  ctx.y -= h + 5;
}
/** Marca de proficiencia: circulo vinho. Vazio = nao proficiente, cheio =
 * proficiente, anel duplo = expertise. Desenhado (glyphs ●○◆ nao existem em WinAnsi). */
function _pdfDot(ctx, cx, cy, filled, expertise) {
  if (expertise) {
    ctx.page.drawCircle({ x: cx, y: cy, size: 3.1, borderColor: ctx.C.maroon, borderWidth: 0.8 });
    ctx.page.drawCircle({ x: cx, y: cy, size: 1.5, color: ctx.C.maroon });
  } else if (filled) {
    ctx.page.drawCircle({ x: cx, y: cy, size: 2.4, color: ctx.C.maroon, borderColor: ctx.C.maroon, borderWidth: 0.8 });
  } else {
    ctx.page.drawCircle({ x: cx, y: cy, size: 2.4, borderColor: ctx.C.maroon, borderWidth: 0.8 });
  }
}
/** Texto com quebra de linha e paginacao. */
function _pdfWrap(ctx, text, size, color, bold) {
  const f = bold ? ctx.fontB : ctx.font;
  const lh = size + 3;
  for (const ln of _quebrarLinhas(_sanitizePdfText(text), f, size, ctx.maxW - 4)) {
    ctx.ensure(lh);
    _pdfTxt(ctx, ln, ctx.M + 2, ctx.y - size, f, size, color || ctx.C.ink);
    ctx.y -= lh;
  }
}

/**
 * Converte o data URL da foto em bytes e embute no documento.
 *
 * `processarImagemArquivo` (utils.js) grava sempre JPEG, mas fichas
 * importadas ou antigas podem trazer PNG -- os dois formatos que o PDFLib
 * aceita. Qualquer outro (ou dado corrompido) devolve null: o PDF sai sem
 * foto, que é muito melhor do que o botão "Gerar PDF" parar de funcionar
 * por causa de uma imagem.
 */
async function _embutirFoto(doc, dataUrl) {
  try {
    const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec((dataUrl || '').trim());
    if (!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return m[1].toLowerCase() === 'png' ? doc.embedPng(bytes) : doc.embedJpg(bytes);
  } catch (err) {
    console.error('Não foi possível embutir a foto no PDF:', err);
    return null;
  }
}

/** Desenha o cartao estilizado da ficha (primeira pagina, tema do app). */
function _desenharCartao(ctx, dados) {
  const C = ctx.C;

  // Faixa de cabecalho (sangria total no topo)
  const bandH = 60;
  ctx.page.drawRectangle({ x: 0, y: ctx.H - bandH, width: ctx.W, height: bandH, color: C.maroon });

  // Foto do personagem, quando houver: quadrada, à direita da faixa. O
  // texto perde essa largura para não passar por baixo dela.
  const fotoLado = 44;
  const temFoto = !!ctx.fotoEmbutida;
  if (temFoto) {
    ctx.page.drawImage(ctx.fotoEmbutida, {
      x: ctx.W - ctx.M - fotoLado,
      y: ctx.H - bandH + (bandH - fotoLado) / 2,
      width: fotoLado,
      height: fotoLado,
    });
  }
  const larguraTexto = ctx.maxW - (temFoto ? fotoLado + 10 : 0);

  _pdfTxt(ctx, _pdfFit(dados.nome, ctx.fontB, 20, larguraTexto), ctx.M, ctx.H - 30, ctx.fontB, 20, C.white);
  _pdfTxt(ctx, _pdfFit(dados.sub, ctx.font, 9.5, larguraTexto), ctx.M, ctx.H - 46, ctx.font, 9.5, C.subWhite);
  ctx.y = ctx.H - bandH - 12;

  // Linha de stats de combate
  {
    const n = dados.stats.length, gap = 6, h = 36;
    const w = (ctx.maxW - (n - 1) * gap) / n;
    let x = ctx.M;
    for (const s of dados.stats) {
      ctx.page.drawRectangle({ x, y: ctx.y - h, width: w, height: h, color: C.softBg, borderColor: C.line, borderWidth: 1 });
      _pdfCen(ctx, s.label, x + w / 2, ctx.y - 11, ctx.font, 6.5, C.gray);
      const vs = ctx.fontB.widthOfTextAtSize(s.value, 13) > w - 4 ? 8.5 : 13;
      _pdfCen(ctx, s.value, x + w / 2, ctx.y - 29, ctx.fontB, vs, C.ink);
      x += w + gap;
    }
    ctx.y -= h + 10;
  }

  // Atributos
  _pdfSecHead(ctx, 'Atributos');
  {
    const n = 6, gap = 6, h = 44;
    const w = (ctx.maxW - (n - 1) * gap) / n;
    let x = ctx.M;
    for (const a of dados.atributos) {
      ctx.page.drawRectangle({ x, y: ctx.y - h, width: w, height: h, color: C.softBg, borderColor: C.line, borderWidth: 1 });
      _pdfCen(ctx, a.nome.slice(0, 3).toUpperCase(), x + w / 2, ctx.y - 11, ctx.fontB, 7, C.maroon);
      _pdfCen(ctx, a.mod, x + w / 2, ctx.y - 30, ctx.fontB, 16, C.ink);
      _pdfCen(ctx, a.val, x + w / 2, ctx.y - 40, ctx.font, 7.5, C.gray);
      x += w + gap;
    }
    ctx.y -= h + 8;
  }

  // Salvaguardas (uma linha, 6 colunas)
  _pdfSecHead(ctx, 'Salvaguardas');
  {
    const cw = ctx.maxW / 6;
    ctx.ensure(16);
    dados.saves.forEach((s, i) => {
      const cx = ctx.M + i * cw;
      _pdfDot(ctx, cx + 5, ctx.y - 8, s.prof, false);
      _pdfTxt(ctx, `${s.nome.slice(0, 3)} ${s.bonus}`, cx + 12, ctx.y - 10, ctx.font, 8.5, C.ink);
    });
    ctx.y -= 18;
  }

  // Pericias (3 colunas, indicador de proficiencia)
  _pdfSecHead(ctx, 'Perícias');
  {
    const cols = 3, rh = 12.5;
    const rows = Math.ceil(dados.pericias.length / cols);
    const cw = ctx.maxW / cols;
    ctx.ensure(rows * rh + 2);
    dados.pericias.forEach((p, i) => {
      const col = Math.floor(i / rows), row = i % rows;
      const cx = ctx.M + col * cw;
      const cy = ctx.y - 10 - row * rh;
      _pdfDot(ctx, cx + 5, cy + 2.5, p.prof || p.exp, p.exp);
      _pdfTxt(ctx, `${p.nome} ${p.bonus}`, cx + 12, cy, ctx.font, 8, C.ink);
    });
    ctx.y -= rows * rh + 4;
  }

  // Sentidos passivos
  _pdfSecHead(ctx, 'Sentidos Passivos');
  ctx.ensure(14);
  _pdfTxt(ctx, dados.sentidos.join('    '), ctx.M + 2, ctx.y - 10, ctx.font, 8.5, C.ink);
  ctx.y -= 16;

  // Defesas (se houver)
  if (dados.defesas.length) {
    _pdfSecHead(ctx, 'Defesas');
    dados.defesas.forEach(d => _pdfWrap(ctx, d, 8.5, C.ink));
    ctx.y -= 2;
  }

  // Equipamento
  if (dados.equipado.length) {
    _pdfSecHead(ctx, 'Equipamento');
    _pdfWrap(ctx, dados.equipado.map(e => '• ' + e).join('    '), 8.5, C.ink);
    ctx.y -= 2;
  }
}

/** Faz o texto detalhado (modo completo) fluir com o mesmo estilo do cartao. */
function _fluirBlocos(ctx, blocos) {
  for (const b of blocos) {
    if (b.t === 'h2') { ctx.y -= 4; _pdfSecHead(ctx, b.text); }
    else if (b.t === 'name') { ctx.y -= 2; _pdfWrap(ctx, b.text, 9.5, ctx.C.ink, true); }
    else if (b.t === 'meta') { _pdfWrap(ctx, b.text, 7.5, ctx.C.gray); }
    else if (b.t === 'p') { _pdfWrap(ctx, b.text, 8.5, ctx.C.ink); ctx.y -= 2; }
  }
}

/** Cria o documento, desenha o cartao e o detalhamento. Devolve bytes. */
async function _renderizarPdf(PDFLib, dados, detalhes) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontB = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 36;
  const C = {
    maroon: rgb(0.482, 0.176, 0.149),
    white: rgb(1, 1, 1),
    subWhite: rgb(0.93, 0.9, 0.88),
    ink: rgb(0.13, 0.13, 0.13),
    gray: rgb(0.45, 0.45, 0.45),
    line: rgb(0.78, 0.76, 0.73),
    softBg: rgb(0.965, 0.95, 0.93),
  };
  const ctx = { doc, page: null, y: 0, W, H, M, maxW: W - 2 * M, font, fontB, C };
  ctx.newPage = () => { ctx.page = doc.addPage([W, H]); ctx.y = H - M; };
  ctx.ensure = h => { if (ctx.y - h < M) ctx.newPage(); };
  // Embutir a foto ANTES de desenhar: _desenharCartao é síncrona, e o
  // embed do PDFLib não é.
  ctx.fotoEmbutida = dados.imagem ? await _embutirFoto(doc, dados.imagem) : null;
  ctx.newPage();

  _desenharCartao(ctx, dados);
  if (detalhes && detalhes.length) { ctx.y -= 6; _fluirBlocos(ctx, detalhes); }

  return doc.save();
}

async function gerarPdfFicha() {
  const PDFLib = await carregarPdfLib();
  const dados = _montarDadosCartao();
  const detalhes = _extrairBlocosDetalhe(await gerarHtmlImpressao());
  return _renderizarPdf(PDFLib, dados, detalhes);
}

/**
 * Gera o PDF completo da ficha e entrega via Blob + link de download. No iOS
 * standalone o link abre o PDF no visor nativo (com botao de compartilhar), sem
 * os bloqueios de print/share do container.
 */
export async function baixarPdfFicha() {
  toast('Gerando PDF...', 'info');
  try {
    const bytes = await gerarPdfFicha();
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const nome = `Ficha ${char.nome || 'personagem'}.pdf`.replace(/[\\/:*?"<>|]/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    console.error('Erro ao gerar PDF:', err);
    toast('Erro ao gerar PDF', 'danger');
  }
}

