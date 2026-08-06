// ============================================================
// Secao de detalhes pessoais
// Extraido de site/js/pages/sheet.js sem alteracao de comportamento.
// ============================================================
import { _detalhesColapsada } from './colapso.js';
import { char, seloEdicao } from './estado.js';

// --- Detalhes pessoais ---
export function renderSecaoDetalhes() {
  const campos = [
    { key: 'aparencia', label: 'Aparencia' },
    { key: 'personalidade', label: 'Personalidade' },
    { key: 'ideais', label: 'Ideais' },
    { key: 'lacos', label: 'Lacos' },
    { key: 'defeitos', label: 'Defeitos' },
    { key: 'historia_personagem', label: 'Historia' },
    { key: 'notas', label: 'Notas' }
  ];

  const temConteudo = campos.some(c => char[c.key]);
  if (!temConteudo) return `
    <div class="card no-print">
      <div class="card-header"><h2>Detalhes</h2></div>
      <div style="text-align:center;color:var(--text-muted);font-size:0.85rem;padding:8px">
        Nenhum detalhe preenchido.
        <button class="btn btn-sm btn-secondary mt-1" id="btn-edit-detalhes">Editar</button>
      </div>
    </div>
  `;

  const colapsada = _detalhesColapsada;
  return `
    <div class="card">
      <div class="card-header detalhes-header-colapsavel${colapsada ? ' detalhes-header-colapsado' : ''}" data-toggle-detalhes>
        <h2>Detalhes</h2>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-sm btn-secondary no-print" id="btn-edit-detalhes">Editar</button>
          <span class="detalhes-chevron">&#9660;</span>
        </div>
      </div>
      <div id="detalhes-body"${colapsada ? ' class="detalhes-body-oculto"' : ''}>
        ${campos.filter(c => char[c.key]).map(c => `
          <div style="margin-bottom:8px">
            <div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;color:var(--text-muted)">${c.label}${seloEdicao(c.key)}</div>
            <div style="font-size:0.85rem">${char[c.key]}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}