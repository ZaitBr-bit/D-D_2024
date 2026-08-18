// ============================================================
// Rota inexistente tem de cair na tela "Pagina nao encontrada" --
// inclusive quando o nome digitado coincide com um membro herdado de
// Object.prototype.
//
// O router monta `routes[pagina]` e `titulos[pagina]` a partir do hash,
// que e texto livre do usuario. Com objetos literais, essa busca sobe a
// cadeia de prototipos: `#toString` devolve `Object.prototype.toString`,
// uma funcao -- e o router, vendo algo truthy, trata como se fosse uma
// pagina de verdade. O resultado e uma tela em branco no lugar do erro, e
// o titulo do header recebendo o codigo-fonte da funcao.
//
// E o alerta #5 do CodeQL ("Unvalidated dynamic method call") descrito em
// termos do que o usuario ve. Nao e exploravel para roubar dado -- as
// funcoes de Object.prototype nao fazem nada util aqui --, mas e um bug
// visivel e o teste custa poucos segundos.
// ============================================================
import { test, expect } from '@playwright/test';
import { abrirSite } from './helpers-regras.mjs';

// `constructor` e `valueOf` cobrem os dois formatos de retorno herdado:
// um construtor e uma funcao comum. `naoexiste` e o controle -- ja
// funcionava antes, e tem de continuar funcionando.
const ROTAS = ['toString', 'constructor', 'valueOf', 'naoexiste'];

for (const rota of ROTAS) {
  test(`rota #${rota} cai na tela de pagina nao encontrada`, async ({ context }) => {
    const { page, erros } = await abrirSite(context, `#${rota}`);

    await expect(
      page.locator('#app-content'),
      `#${rota} deveria mostrar "Pagina nao encontrada"`
    ).toContainText('Pagina nao encontrada');

    // O titulo cai no padrao, e nao no codigo-fonte de uma funcao herdada.
    const titulo = await page.locator('#header-titulo').textContent();
    expect(titulo, 'o header recebeu algo que nao e um titulo').not.toContain('native code');
    expect(titulo).toContain('D&D 5.5 Ficha');

    expect(erros, `erros de console/pagina: ${erros.join('; ')}`).toEqual([]);
  });
}
