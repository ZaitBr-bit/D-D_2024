// ============================================================
// As 10 espécies do livro, transcritas de Informacoes Separadas/Espécies.md.
//
// "Dez espécies são apresentadas nesta seção em ordem alfabética: Aasimar,
// Anão, Draconato, Elfo, Gnomo, Golias, Humano, Orc, Pequenino e Tiferino."
// (D&D 5.5 - Livro do Jogador (2024) 5.3.7.md:8554, repetido em :1588)
//
// `dados/origens/especies.json` traz uma 11ª, Kenku, que o livro não tem --
// ver FORA_DO_LIVRO, abaixo.
//
// Todas as citações de linha foram EXTRAÍDAS do arquivo, não estimadas: os
// traços são as linhas `**Nome.**` dentro de cada `### Traços de <Espécie>`,
// e os três campos de cabeçalho são as linhas `**Tipo de Criatura:**`,
// `**Tamanho:**` e `**Deslocamento:**` da mesma seção.
// ============================================================

/**
 * Espécie que o app oferece e o livro não tem. Não é "esquecimento do
 * catálogo": é uma diferença real entre app e livro, deixada FORA da
 * validação por decisão do usuário (2026-08-18). Fica declarada para a
 * bijeção do Grupo 1 não acusar ausência falsa nem fingir que não existe.
 */
export const FORA_DO_LIVRO = [
  { nome: 'Kenku',
    motivo: 'Não está entre as dez espécies do PHB 2024 (Livro do Jogador:8554 e :1588 ' +
      'listam as dez, e Kenku não é uma delas). É conteúdo extra do app; validá-la contra ' +
      'o livro não é possível, porque não existe texto de livro para confrontar.' },
];

/**
 * Campos de cabeçalho e traços de cada espécie.
 *
 * `tamanho` guarda a forma NORMALIZADA que `getTamanho` (site/js/utils.js:439)
 * produz -- 'Médio', 'Pequeno' ou 'Médio ou Pequeno' --, não a frase inteira
 * do livro (que inclui a faixa de altura entre parênteses). A frase completa
 * fica na citação.
 *
 * `deslocamento: null` significa que o LIVRO não declara o campo -- não que o
 * app esteja errado. O Tiferino é o caso vivo: nem `Espécies.md` nem o PHB
 * completo trazem linha de Deslocamento para ele. O motor pula a asserção
 * dessa célula em vez de inventar um valor para comparar.
 *
 * `nivel` num traço é o nível de PERSONAGEM em que ele passa a valer. Ausente
 * = vale desde o nível 1.
 */
export const ESPECIES = [
  { nome: 'Aasimar', livro: 'Espécies.md:13',
    tipo: 'Humanoide', tamanho: 'Médio ou Pequeno', deslocamento: '9 metros',
    tracos: [
      { nome: 'Resistência Celestial', livro: 'Espécies.md:21' },
      { nome: 'Visão no Escuro', livro: 'Espécies.md:23' },
      { nome: 'Mãos Curativas', livro: 'Espécies.md:25' },
      { nome: 'Portador da Luz', livro: 'Espécies.md:27' },
      { nome: 'Revelação Celestial', nivel: 3, livro: 'Espécies.md:29' },
      { nome: 'Asas Celestiais', livro: 'Espécies.md:35' },
      { nome: 'Manto Necrótico', livro: 'Espécies.md:37' },
      { nome: 'Transfiguração Radiante', livro: 'Espécies.md:39' },
    ] },
  { nome: 'Anão', livro: 'Espécies.md:49',
    tipo: 'Humanoide', tamanho: 'Médio', deslocamento: '9 metros',
    tracos: [
      { nome: 'Visão no Escuro', livro: 'Espécies.md:57' },
      { nome: 'Resistência a Toxinas', livro: 'Espécies.md:59' },
      { nome: 'Tenacidade Anã', livro: 'Espécies.md:61' },
      { nome: 'Conhecimento de Pedras', livro: 'Espécies.md:63' },
    ] },
  { nome: 'Draconato', livro: 'Espécies.md:73',
    tipo: 'Humanoide', tamanho: 'Médio', deslocamento: '9 metros',
    tracos: [
      { nome: 'Herança Dracônica', livro: 'Espécies.md:81' },
      { nome: 'Ataque de Sopro', livro: 'Espécies.md:98' },
      { nome: 'Resistência a Dano', livro: 'Espécies.md:102' },
      { nome: 'Visão no Escuro', livro: 'Espécies.md:104' },
      { nome: 'Voo Dracônico', nivel: 5, livro: 'Espécies.md:106' },
    ] },
  { nome: 'Elfo', livro: 'Espécies.md:130',
    tipo: 'Humanoide', tamanho: 'Médio', deslocamento: '9 metros',
    tracos: [
      { nome: 'Visão no Escuro', livro: 'Espécies.md:138' },
      { nome: 'Linhagem Élfica', livro: 'Espécies.md:140' },
      { nome: 'Ancestralidade Feérica', livro: 'Espécies.md:154' },
      { nome: 'Sentidos Aguçados', livro: 'Espécies.md:156' },
      { nome: 'Transe', livro: 'Espécies.md:158' },
    ] },
  { nome: 'Gnomo', livro: 'Espécies.md:166',
    tipo: 'Humanoide', tamanho: 'Pequeno', deslocamento: '9 metros',
    tracos: [
      { nome: 'Visão no Escuro', livro: 'Espécies.md:174' },
      { nome: 'Astúcia de Gnomo', livro: 'Espécies.md:176' },
      { nome: 'Linhagem Gnômica', livro: 'Espécies.md:178' },
      { nome: 'Gnomo das Rochas', livro: 'Espécies.md:180' },
      { nome: 'Gnomo do Bosque', livro: 'Espécies.md:182' },
    ] },
  { nome: 'Golias', livro: 'Espécies.md:190',
    tipo: 'Humanoide', tamanho: 'Médio', deslocamento: '10,5 metros',
    tracos: [
      { nome: 'Ancestralidade Gigante', livro: 'Espécies.md:198' },
      { nome: 'Arrepio do Gelo (Gigante do Gelo)', livro: 'Espécies.md:200' },
      { nome: 'Queimadura de Fogo (Gigante de Fogo)', livro: 'Espécies.md:202' },
      { nome: 'Resistência da Pedra (Gigante da Pedra)', livro: 'Espécies.md:204' },
      { nome: 'Salto da Nuvem (Gigante das Nuvens)', livro: 'Espécies.md:206' },
      { nome: 'Tombo da Colina (Gigante da Colina)', livro: 'Espécies.md:208' },
      { nome: 'Trovão da Tempestade (Gigante da Tempestade)', livro: 'Espécies.md:210' },
      { nome: 'Forma Grande', nivel: 5, livro: 'Espécies.md:212' },
      { nome: 'Porte Poderoso', livro: 'Espécies.md:214' },
    ] },
  { nome: 'Humano', livro: 'Espécies.md:222',
    tipo: 'Humanoide', tamanho: 'Médio ou Pequeno', deslocamento: '9 metros',
    tracos: [
      { nome: 'Eficiente', livro: 'Espécies.md:230' },
      { nome: 'Hábil', livro: 'Espécies.md:232' },
      { nome: 'Versátil', livro: 'Espécies.md:234' },
    ] },
  { nome: 'Orc', livro: 'Espécies.md:242',
    tipo: 'Humanoide', tamanho: 'Médio', deslocamento: '9 metros',
    tracos: [
      { nome: 'Pico de Adrenalina', livro: 'Espécies.md:250' },
      { nome: 'Visão no Escuro', livro: 'Espécies.md:254' },
      { nome: 'Vigor Implacável', livro: 'Espécies.md:256' },
    ] },
  { nome: 'Pequenino', livro: 'Espécies.md:268',
    tipo: 'Humanoide', tamanho: 'Pequeno', deslocamento: '9 metros',
    tracos: [
      { nome: 'Corajoso', livro: 'Espécies.md:276' },
      { nome: 'Agilidade Pequenina', livro: 'Espécies.md:278' },
      { nome: 'Sorte', livro: 'Espécies.md:280' },
      { nome: 'Furtividade Natural', livro: 'Espécies.md:282' },
    ] },
  { nome: 'Tiferino', livro: 'Espécies.md:302',
    tipo: 'Humanoide', tamanho: 'Médio ou Pequeno',
    // O LIVRO não declara Deslocamento para o Tiferino -- conferido tanto em
    // Espécies.md quanto no PHB completo. Não é omissão desta transcrição.
    deslocamento: null,
    tracos: [
      { nome: 'Visão no Escuro', livro: 'Espécies.md:308' },
      { nome: 'Legado Ínfero', livro: 'Espécies.md:310' },
      { nome: 'Presença Sobrenatural', livro: 'Espécies.md:322' },
    ] },
];

/**
 * As 5 escolhas de linhagem: o livro manda escolher uma opção de uma tabela,
 * e a escolha muda o que o personagem ganha.
 *
 * As opções vêm da TABELA do livro, não dos headings `###`. Os headings de
 * Elfo usam plural ("Altos Elfos", "Elfos Silvestres") e a tabela usa singular
 * ("Alto Elfo", "Elfo Silvestre") -- transcrever do heading criaria uma
 * divergência falsa contra o app, que usa o singular da tabela.
 */
export const ESCOLHAS_LINHAGEM = [
  { especie: 'Draconato', traco: 'Herança Dracônica', livro: 'Espécies.md:81',
    opcoes: ['Azul', 'Branco', 'Bronze', 'Cobre', 'Latão', 'Negro', 'Ouro', 'Prata', 'Verde', 'Vermelho'] },
  { especie: 'Elfo', traco: 'Linhagem Élfica', livro: 'Espécies.md:140',
    opcoes: ['Alto Elfo', 'Drow', 'Elfo Silvestre'],
    magiasPorNivel: {
      'Alto Elfo': { 3: 'Detectar Magia', 5: 'Passo Nebuloso' },
      'Drow': { 3: 'Fogo das Fadas', 5: 'Escuridão' },
      'Elfo Silvestre': { 3: 'Passos Largos', 5: 'Passo Sem Rastro' },
    } },
  { especie: 'Gnomo', traco: 'Linhagem Gnômica', livro: 'Espécies.md:178',
    opcoes: ['Gnomo das Rochas', 'Gnomo do Bosque'] },
  { especie: 'Golias', traco: 'Ancestralidade Gigante', livro: 'Espécies.md:198',
    opcoes: ['Arrepio do Gelo (Gigante do Gelo)', 'Queimadura de Fogo (Gigante de Fogo)',
             'Resistência da Pedra (Gigante da Pedra)', 'Salto da Nuvem (Gigante das Nuvens)',
             'Tombo da Colina (Gigante da Colina)', 'Trovão da Tempestade (Gigante da Tempestade)'] },
  { especie: 'Tiferino', traco: 'Legado Ínfero', livro: 'Espécies.md:310',
    opcoes: ['Abissal', 'Ctônico', 'Infernal'],
    magiasPorNivel: {
      'Abissal': { 3: 'Raio Nauseante', 5: 'Paralisar Pessoa' },
      'Ctônico': { 3: 'Vitalidade Vazia', 5: 'Raio do Enfraquecimento' },
      'Infernal': { 3: 'Repreensão Diabólica', 5: 'Escuridão' },
    } },
];

/** Traços que só passam a valer num nível > 1. Derivado de ESPECIES. */
export const TRACOS_POR_NIVEL = ESPECIES.flatMap((e) =>
  e.tracos.filter((t) => t.nivel).map((t) => ({ especie: e.nome, ...t })));
