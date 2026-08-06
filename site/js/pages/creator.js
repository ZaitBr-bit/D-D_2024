// ============================================================
// Wizard de Criação de Personagem (7 passos)
// ============================================================
import { getAntecedentes, getEspecies } from '../db.js';
import { criarPersonagemVazio } from '../store.js';
import { definirPersonagem, definirStep, definirDadosCache, definirContainer } from '../creator/wizard.js';
import { dadosCache, renderWizard } from '../creator/wizard.js';

export async function renderCreator(container) {
  definirContainer(container);
  definirPersonagem(criarPersonagemVazio());
  definirDadosCache({});
  definirStep(0);

  // Pré-carregar dados essenciais
  const [antecedentes, especies] = await Promise.all([
    getAntecedentes(),
    getEspecies()
  ]);
  dadosCache.antecedentes = antecedentes?.antecedentes || [];
  dadosCache.especies = especies?.especies || [];

  renderWizard();
}