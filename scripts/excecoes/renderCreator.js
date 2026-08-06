
async function renderCreator(container) {
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