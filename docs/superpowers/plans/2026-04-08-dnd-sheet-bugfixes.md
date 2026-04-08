# Plano de Correção — D&D Sheet Bugs & Features (2026-04-08)

## Visão Geral

Seis problemas identificados na ficha de personagem (`site/js/pages/sheet.js`).
Regras validadas em `Informacoes Separadas/` antes de cada tarefa.
Cada tarefa tem passos de verificação manual no navegador.

---

## TAREFA 1 — Deslocamento de Talentos não é somado

### Contexto
`getDeslocamentoFinal` (~linha 2168) calcula o deslocamento final do personagem. Verifica
bonus de classe (Bárbaro nível 5+, Guardião nível 6+, Monge) mas **ignora talentos**.

### Regras validadas
- **Velocista** (`Talentos.md` linha 738): "Seu Deslocamento aumenta em 3 metros" — permanente, incondicional.
- **Dádiva da Velocidade** (`Talentos.md` linha 890): "Seu Deslocamento aumenta em 9 metros" — permanente, incondicional.
- **Guardião nível 6 — Errante** (`Classes.md` ~linha 3335): Deslocamento +3m sem Armadura Pesada **E** velocidade de Escalada/Natação igual ao Deslocamento base (corrente). O +3m já está correto no código, mas as velocidades de Escalada e Natação não são exibidas.

### Passos de implementação

**1.1** Em `getDeslocamentoFinal` (sheet.js ~linha 2168), após o bloco do Monge e antes do
bloco de exaustão, adicionar checagem de talentos:

```js
// Verificar talentos que aumentam deslocamento
const _nomesTalentos = (char?.talentos || []).map(t => typeof t === 'string' ? t : t.nome);
if (_nomesTalentos.some(t => t === 'Velocista')) final += 3;
if (_nomesTalentos.some(t => t === 'Dádiva da Velocidade')) final += 9;
```

**1.2** No bloco do Guardião nível 6+ (~linha 2180), após `final += 3`, adicionar os `extras`
de Escalada e Natação. O valor usado deve ser `final` após o incremento (que já inclui o +3m
do Errante), pois a regra diz que elas igualam o Deslocamento atual:

```js
if (char?.classe === 'Guardião' && (char?.nivel || 1) >= 6 && !temArmaduraPesadaEquipada()) {
  final += 3;
  extras.push(`Escalada ${final}m`);  // NOVO
  extras.push(`Natação ${final}m`);   // NOVO
}
```

### Verificação manual
1. Abrir ficha de personagem Feiticeiro com talento **Velocista** (deslocamento base 9m).
   - Esperado: exibir **12m** no campo de deslocamento.
2. Trocar para talento **Dádiva da Velocidade** (deslocamento base 9m).
   - Esperado: exibir **18m**.
3. Personagem Guardião nível 6+, sem armadura pesada.
   - Esperado: deslocamento +3m E indicadores "Escalada Xm / Natação Xm" visíveis.
4. Personagem Bárbaro nível 5+ sem armadura pesada.
   - Esperado: +3m (já correto — assegurar que não regressou).

---

## TAREFA 2 — Bug de dinheiro (PO) — múltiplos modais ao clicar

### Contexto
`setupEventosInventarioSheet` (~linha 13681) usa `addEventListener` no elemento `btn-edit-po`
em vez de `.onclick`. O botão fica fora da div `#sheet-inventario`.

Quando o inventário é atualizado (`reRenderSheetInv`), a função `setupEventosInventarioSheet`
é chamada novamente. Como `btn-edit-po` não é substituído no DOM (está fora de
`#sheet-inventario`), ele acumula um novo handler a cada re-render. Resultado: ao clicar, N
modais se abrem empilhados.

### Passos de implementação

**2.1** Localizar (sheet.js ~linha 13681):
```js
document.getElementById('btn-edit-po')?.addEventListener('click', () => { ... });
```

**2.2** Substituir por atribuição direta de `.onclick`:
```js
const _btnEditPo = document.getElementById('btn-edit-po');
if (_btnEditPo) _btnEditPo.onclick = () => {
  abrirModal('Peças de Ouro', /* ... mesmo corpo HTML ... */,
    '<button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>' +
    '<button class="btn btn-primary" id="btn-salvar-po">Salvar Total</button>'
  );
  // ... restante dos handlers internos ao modal (btn-po-add, btn-po-sub, btn-salvar-po)
};
```

> Os handlers internos ao modal (`btn-po-add`, `btn-po-sub`, `btn-salvar-po`) que usam
> `addEventListener` dentro do callback são aceitáveis, pois o modal é destruído e recriado
> a cada abertura.

### Verificação manual
1. Abrir inventário. Clicar em "Editar PO".
   - Esperado: um único modal abre.
2. Fechar o modal. Adicionar ou remover um item do inventário (provoca `reRenderSheetInv`).
3. Clicar novamente em "Editar PO".
   - Esperado: ainda um único modal. Nenhum empilhamento.
4. Adicionar PO, confirmar.
   - Esperado: saldo atualizado corretamente, sem precisar recarregar a página.

---

## TAREFA 3 — Permitir editar itens personalizados

### Contexto
`mostrarDetalheItemSheet(item)` (~linha 13925) mostra detalhes de um item. Para
`tipo === 'customizado'`, exibe as informações mas abre o modal **sem ações** — não há botão
de editar. Os itens customizados são criados via um formulário com campos nome, peso,
quantidade, valor, propriedades e descrição.

### Passos de implementação

**3.1** Criar a função `abrirModalEditarItemCustomizado(item, idx)` próxima de onde está a
lógica de criação de item (`btn-add-inv-custom` handler, ~linha 13600). A função deve:
- Abrir modal com os mesmos campos do formulário de criação.
- Pré-popular todos os campos com os valores do `item` existente.
- No clique de confirmar: validar nome, atualizar `char.inventario[idx]` com os novos valores,
  chamar `salvar()` e `renderFichaCompleta()`, mostrar toast de sucesso.

**3.2** Em `mostrarDetalheItemSheet`, na branch `tipo === 'customizado'`, alterar a chamada
de `abrirModal` para incluir botão de editar nas ações:

```js
// Encontrar índice do item no inventário para passar ao editor
const _idxItem = char.inventario.indexOf(item);
abrirModal(item.nome, corpo,
  `<button class="btn btn-secondary" onclick="fecharModal()">Fechar</button>
   <button class="btn btn-primary" id="btn-editar-item-custom">Editar</button>`
);
document.getElementById('btn-editar-item-custom')?.addEventListener('click', () => {
  window.fecharModal();
  abrirModalEditarItemCustomizado(item, _idxItem);
});
```

> Usar `addEventListener` aqui é seguro: o modal de detalhe é destruído ao fechar, portanto
> o handler não se acumula.

### Verificação manual
1. Criar um item personalizado (ex.: "Espada Mágica +1", peso 2, qtd 1, valor 500, descr "Concede +1 ao ataque").
2. Clicar no item para abrir o detalhe.
   - Esperado: botão "Editar" visível.
3. Clicar em "Editar".
   - Esperado: modal de edição abre com os campos pré-preenchidos com os valores atuais.
4. Alterar a descrição para "Concede +2 ao ataque". Confirmar.
   - Esperado: toast de sucesso, item atualizado na listagem com nova descrição.
5. Testar cancelamento — sem alterar nada.
   - Esperado: item permanece sem alteração.

---

## TAREFA 4 — Fonte de Magia: slots extras desaparecem e não resetam no descanso

### Contexto — raiz do bug

Em `renderFichaCompleta` (~linha 2301) existe um bloco de **sincronização de espaços de magia**
que a cada re-render faz:

```js
char.espacos_magia[circ].total = _espacosCorretos[circ].total; // valor da tabela da classe
```

Quando o Feiticeiro usa "PF → Slot" (`converter-ponto-slot`, ~linha 5043):

```js
char.espacos_magia[c].total += 1; // +1 slot extra
salvar();
renderFichaCompleta();             // AQUI: total é imediatamente sobrescrito de volta!
```

O slot extra é **apagado pelo próprio render** antes de o usuário poder usá-lo. O PF é gasto
sem benefício. No descanso longo, `usados` é resetado para 0 mas `total` volta ao valor da
tabela de qualquer forma (pelo sync do render).

### Solução

Rastrear os slots extras em uma propriedade dedicada `char.espacos_magia_extras` separada do
sync da tabela da classe. O sync em `renderFichaCompleta` passa a somar os extras ao total base.

### Passos de implementação

**4.1** Em `converter-ponto-slot` (~linha 5043), substituir:
```js
// ANTES:
char.espacos_magia[c].total += 1;

// DEPOIS:
if (!char.espacos_magia_extras) char.espacos_magia_extras = {};
char.espacos_magia_extras[c] = (char.espacos_magia_extras[c] || 0) + 1;
```
Remover a linha `char.espacos_magia[c].total += 1` — o total correto será calculado pelo
sync de `renderFichaCompleta` no passo seguinte.

**4.2** No bloco de sincronização de espaços de magia de `renderFichaCompleta` (~linha 2301),
alterar o `forEach` que define `total` para incluir os extras:

```js
const _extras = char.espacos_magia_extras || {};

Object.keys(_espacosCorretos).forEach(circ => {
  const baseTotal = _espacosCorretos[circ].total;
  const extraTotal = _extras[circ] || 0;
  if (!char.espacos_magia[circ]) {
    char.espacos_magia[circ] = { total: baseTotal + extraTotal, usados: 0 };
  } else {
    char.espacos_magia[circ].total = baseTotal + extraTotal;
    if (char.espacos_magia[circ].usados > char.espacos_magia[circ].total) {
      char.espacos_magia[circ].usados = char.espacos_magia[circ].total;
    }
  }
});

// Slots extras em círculos que não existem na tabela base (ex.: círculo 1 para nível muito baixo)
Object.keys(_extras).forEach(circ => {
  if (!_espacosCorretos[circ] && _extras[circ] > 0) {
    if (!char.espacos_magia[circ]) {
      char.espacos_magia[circ] = { total: _extras[circ], usados: 0 };
    } else {
      char.espacos_magia[circ].total = _extras[circ];
    }
  }
});

// Remover círculos que não existem mais E não têm extras
Object.keys(char.espacos_magia).forEach(circ => {
  if (!_espacosCorretos[circ] && !(_extras[circ] > 0)) {
    delete char.espacos_magia[circ];
  }
});
```

**4.3** No handler do descanso longo (~linha 3936), após o loop que reseta `usados`, adicionar:

```js
// Remover slots extras criados por Fonte de Magia
char.espacos_magia_extras = {};
```

**4.4 (UX)** Na renderização dos "espaços de magia" em `renderSecaoMagias` (~linha 10683),
exibir indicação visual dos slots extras. Dentro do `.map` que gera as bolhas (`slot-bolha`),
calcular `baseTotal` a partir de `classeData` e distinguir slots extras:

```js
const _extrasCirculo = (char.espacos_magia_extras || {})[circ] || 0;
const _baseTotal = data.total - _extrasCirculo;

${Array.from({ length: data.total }, (_, i) => `
  <div class="slot-bolha ${i < data.usados ? 'usado' : ''} ${i >= _baseTotal ? 'slot-extra' : ''}"
       data-slot-circ="${circ}" data-slot-idx="${i}"></div>
`).join('')}
```

Adicionar ao CSS (`site/css/app.css`) a classe `.slot-extra` para diferenciar visualmente
(ex.: borda ou cor diferente):

```css
.slot-bolha.slot-extra {
  border-style: dashed;
  opacity: 0.8;
}
```

E no `<span>` de contagem abaixo das bolhas, exibir o breakdown quando houver extras:

```js
const _extrasCirculo = (char.espacos_magia_extras || {})[circ] || 0;
<span style="font-size:0.75rem;color:var(--text-muted)">
  ${data.total - data.usados}/${data.total}
  ${_extrasCirculo > 0 ? `<span style="color:var(--accent)">(+${_extrasCirculo} FM)</span>` : ''}
</span>
```

### Verificação manual
1. Abrir ficha de Feiticeiro nível 3. Anotar slots de 1º círculo (esperado: 4 total).
2. Usar Fonte de Magia → Criar Espaço de Magia → 1º círculo (custo 2 PF).
   - Esperado: slot de 1º círculo passa de 4 para **5**, com 1 bolha em estilo diferente "FM".
   - Contador exibe "5/5 (+1 FM)".
3. Usar o slot extra para conjurar uma magia.
   - Esperado: slot extra marcado como usado. Contador "4/5 (+1 FM)".
4. Descanso Longo.
   - Esperado: espaços de 1º círculo voltam para **4/4** (sem extras). Indicador FM desaparece.
5. Verificar PF: devem ter sido consumidos corretamente (2 PF no passo 2).

---

## TAREFA 5 — Metamagia indisponível após usar Fonte de Magia

### Contexto

Ligado diretamente ao Bug 4. O fluxo de conjuração (~linha 11731) só mostra o modal de
metamagia se `estadoFeit.pontosAtuais > 0`. Quando o usuário gasta PF usando Fonte de Magia
para criar um slot (que desaparecia imediatamente por causa do Bug 4), ficava com 0 PF.
Na próxima conjuração, a metamagic é silenciosamente ignorada sem feedback ao usuário.

A correção do Bug 4 resolve o problema principal (PF não serão gastos em vão), mas é
necessário adicionar feedback quando metamagia é pulada por falta de PF.

### Passos de implementação

**5.1** Após a correção do Bug 4 (Tarefa 4), confirmar que PF não são mais gastos sem retorno.

**5.2** Em `_iniciarConjuracaoComMetamagia` (~linha 11731), adicionar toast informativo quando
o feiticeiro tem metamagias conhecidas mas nenhum PF disponível:

```js
const estadoFeit = getEstadoRecursosFeiticeiro();
if (estadoFeit && estadoFeit.metamagias.length > 0 && estadoFeit.pontosAtuais > 0) {
  mostrarModalMetamagiaConjuracao(nome, circ, (metas, opcoesMeta) => {
    _metasAplicadas = metas || [];
    _opcoesMetaConj = opcoesMeta || {};
    _prosseguirConjuracao();
  });
  return;
}

// NOVO: feedback quando metamagia é pulada por falta de PF
if (estadoFeit && estadoFeit.metamagias.length > 0 && estadoFeit.pontosAtuais === 0) {
  toast('Metamagia indisponível: sem Pontos de Feitiçaria.', 'info');
}
```

### Verificação manual
1. Gastar todos os PF do Feiticeiro (descanso curto/longo para resetar, depois gastar todos via Converter Slot → PF ou usar metamagias).
2. Com PF = 0, conjurar uma magia preparada.
   - Esperado: magia conjurada normalmente, toast "Metamagia indisponível: sem Pontos de Feitiçaria." exibido.
3. Recuperar pelo menos 1 PF. Conjurar a mesma magia.
   - Esperado: modal de metamagia aparece normalmente.

---

## Ordem de execução sugerida

| Ordem | Tarefa | Complexidade | Dependências |
|-------|--------|-------------|--------------|
| 1 | Tarefa 2 — Bug PO dinheiro | Baixa | Nenhuma |
| 2 | Tarefa 1 — Deslocamento talentos | Baixa | Nenhuma |
| 3 | Tarefa 3 — Editar itens customizados | Média | Nenhuma |
| 4 | Tarefa 4 — Fonte de Magia / slots extras | Alta | Nenhuma |
| 5 | Tarefa 5 — Feedback metamagia sem PF | Baixa | Tarefa 4 deve ser feita antes |

---

## Notas técnicas gerais

- **Padrão de re-render**: após alterar `char`, sempre chamar `salvar()` e depois `renderFichaCompleta()`.
- **Modal system**: `abrirModal(titulo, corpo, acoes, onClose)`. Usar `.onclick` em botões fora do modal que persistem entre re-renders; `.addEventListener` é aceitável dentro de callbacks de modal (o elemento é destruído ao fechar).
- **`classeData`**: variável module-level de `sheet.js`, populada no `renderSheet` assíncrono. Está disponível em todos os handlers subsequentes.
- **`getEspacosMagia`**: importado de `utils.js`, disponível em `sheet.js`.
- **`char.talentos`**: cada entrada pode ser `string` ou `{ nome: string, ... }`. Sempre normalizar com `typeof t === 'string' ? t : t.nome`.
