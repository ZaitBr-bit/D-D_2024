// ============================================================
// Características das 48 subclasses, transcritas do livro.
//
// Fonte: `Informacoes Separadas/Classes.md`, nas 12 seções de subclasse
// (`# Subclasses de Bárbaro:185`, `# Subclasses de Bardo:684`,
// `# Subclasses de Bruxo:1295`, `# Subclasses de Clérigo:1795`,
// `## Subclasses de Druida:2333`, `# Subclasses de Feiticeiro:2996`,
// `# Subclasses de Guardião:3466`, `# Subclasses de Guerreiro:3882`,
// `# Subclasses de Ladino:4302`, `# Subclasses de Mago:4958`,
// `# Subclasses de Monge:5286`, `## Subclasses de Paladino:5689`).
// O nível do heading varia entre `#` e `##` para o mesmo tipo de seção --
// é o mesmo motivo pelo qual lerHeadingsClasses() aceita #, ## e ###.
//
// REGRA DURA: cada valor aqui foi lido da seção do LIVRO. Nada foi copiado
// de `dados/classes/*.json` -- é exatamente a fonte que o motor
// (unidade/subclasses.test.mjs) confronta contra este arquivo. Um catálogo
// gerado a partir dela bateria 241/241 sem provar nada.
//
// O que este catálogo NÃO guarda: a prosa de cada característica. O livro
// descreve mecânica (usos, recarga, tabela de magias, escolha exigida) em
// texto corrido, e o app a lê por regex em runtime. Cada uma dessas
// perguntas vira um campo próprio, curado num plano próprio -- magias
// (Plano 2), escolha exigida (Plano 3), recurso/uso/recarga (Plano 4).
// Este plano transcreve só o que é objetivamente conferível: nível e nome.
// ============================================================

// Subclasse -> classe. Os 48 nomes são globalmente distintos (conferido:
// nenhum nome de subclasse se repete entre classes), então o mapa é
// unívoco nos dois sentidos.
export const CLASSE_DA_SUBCLASSE = {
  'Trilha da Árvore do Mundo': 'Bárbaro',
  'Trilha do Berserker': 'Bárbaro',
  'Trilha do Coração Selvagem': 'Bárbaro',
  'Trilha do Fanático': 'Bárbaro',
  'Colégio da Bravura': 'Bardo',
  'Colégio da Dança': 'Bardo',
  'Colégio do Conhecimento': 'Bardo',
  'Colégio do Glamour': 'Bardo',
  'Patrono Arquifada': 'Bruxo',
  'Patrono Celestial': 'Bruxo',
  'Patrono O Grande Antigo': 'Bruxo',
  'Patrono Ínfero': 'Bruxo',
  'Domínio da Guerra': 'Clérigo',
  'Domínio da Luz': 'Clérigo',
  'Domínio da Trapaça': 'Clérigo',
  'Domínio da Vida': 'Clérigo',
  'Círculo da Lua': 'Druida',
  'Círculo da Terra': 'Druida',
  'Círculo das Estrelas': 'Druida',
  'Círculo do Mar': 'Druida',
  'Feitiçaria Aberrante': 'Feiticeiro',
  'Feitiçaria Dracônica': 'Feiticeiro',
  'Feitiçaria Mecânica': 'Feiticeiro',
  'Feitiçaria Selvagem': 'Feiticeiro',
  'Andarilho Feérico': 'Guardião',
  'Caçador': 'Guardião',
  'Senhor das Feras': 'Guardião',
  'Vigilante das Sombras': 'Guardião',
  'Campeão': 'Guerreiro',
  'Cavaleiro Místico': 'Guerreiro',
  'Combatente Psíquico': 'Guerreiro',
  'Mestre da Batalha': 'Guerreiro',
  'Adaga Espiritual': 'Ladino',
  'Assassino': 'Ladino',
  'Ladrão': 'Ladino',
  'Trapaceiro Arcano': 'Ladino',
  'Abjurador': 'Mago',
  'Adivinhador': 'Mago',
  'Evocador': 'Mago',
  'Ilusionista': 'Mago',
  'Combatente da Mão Espalmada': 'Monge',
  'Combatente da Misericórdia': 'Monge',
  'Combatente das Sombras': 'Monge',
  'Combatente dos Elementos': 'Monge',
  'Juramento da Devoção': 'Paladino',
  'Juramento da Glória': 'Paladino',
  'Juramento da Vingança': 'Paladino',
  'Juramento dos Anciões': 'Paladino',
};

// Citação por subclasse: aponta para o heading `## <Nome>` sob o qual as
// características foram transcritas. Linhas em Classes.md (conferidas uma a
// uma no pré-voo, conferidas em 2026-08-17 -- é um retrato do arquivo nesta
// data e pode ficar desatualizado numa próxima edição de Classes.md; nenhum
// teste consome estes números, só os textos dos headings em `CITACOES`
// abaixo): Trilha da Árvore do Mundo 189, Trilha do Berserker 219,
// Trilha do Coração Selvagem 245, Trilha do Fanático 291, Colégio da
// Bravura 688, Colégio da Dança 718, Colégio do Conhecimento 754, Colégio
// do Glamour 778, Patrono Arquifada 1299, Patrono Celestial 1348, Patrono O
// Grande Antigo 1387, Patrono Ínfero 1436, Domínio da Guerra 1799, Domínio
// da Luz 1836, Domínio da Trapaça 1879, Domínio da Vida 1926, Círculo da
// Lua 2337, Círculo da Terra 2392, Círculo das Estrelas 2469, Círculo do
// Mar 2528, Feitiçaria Aberrante 3000, Feitiçaria Dracônica 3053,
// Feitiçaria Mecânica 3096, Feitiçaria Selvagem 3156, Andarilho Feérico
// 3470, Caçador 3531, Senhor das Feras 3565, Vigilante das Sombras 3696,
// Campeão 3886, Cavaleiro Místico 3922, Combatente Psíquico 3996, Mestre da
// Batalha 4053, Adaga Espiritual 4306, Assassino 4373, Ladrão 4407,
// Trapaceiro Arcano 4449, Abjurador 4962, Adivinhador 4996, Evocador 5032,
// Ilusionista 5064, Combatente da Mão Espalmada 5290, Combatente da
// Misericórdia 5322, Combatente das Sombras 5362, Combatente dos Elementos
// 5396, Juramento da Devoção 5695, Juramento da Glória 5749, Juramento da
// Vingança 5805, Juramento dos Anciões 5853.
export const CITACOES = {
  'Trilha da Árvore do Mundo': 'Classes.md §Trilha da Árvore do Mundo',
  'Trilha do Berserker': 'Classes.md §Trilha do Berserker',
  'Trilha do Coração Selvagem': 'Classes.md §Trilha do Coração Selvagem',
  'Trilha do Fanático': 'Classes.md §Trilha do Fanático',
  'Colégio da Bravura': 'Classes.md §Colégio da Bravura',
  'Colégio da Dança': 'Classes.md §Colégio da Dança',
  'Colégio do Conhecimento': 'Classes.md §Colégio do Conhecimento',
  'Colégio do Glamour': 'Classes.md §Colégio do Glamour',
  'Patrono Arquifada': 'Classes.md §Patrono Arquifada',
  'Patrono Celestial': 'Classes.md §Patrono Celestial',
  'Patrono O Grande Antigo': 'Classes.md §Patrono O Grande Antigo',
  'Patrono Ínfero': 'Classes.md §Patrono Ínfero',
  'Domínio da Guerra': 'Classes.md §Domínio da Guerra',
  'Domínio da Luz': 'Classes.md §Domínio da Luz',
  'Domínio da Trapaça': 'Classes.md §Domínio da Trapaça',
  'Domínio da Vida': 'Classes.md §Domínio da Vida',
  'Círculo da Lua': 'Classes.md §Círculo da Lua',
  'Círculo da Terra': 'Classes.md §Círculo da Terra',
  'Círculo das Estrelas': 'Classes.md §Círculo das Estrelas',
  'Círculo do Mar': 'Classes.md §Círculo do Mar',
  'Feitiçaria Aberrante': 'Classes.md §Feitiçaria Aberrante',
  'Feitiçaria Dracônica': 'Classes.md §Feitiçaria Dracônica',
  'Feitiçaria Mecânica': 'Classes.md §Feitiçaria Mecânica',
  'Feitiçaria Selvagem': 'Classes.md §Feitiçaria Selvagem',
  'Andarilho Feérico': 'Classes.md §Andarilho Feérico',
  'Caçador': 'Classes.md §Caçador',
  'Senhor das Feras': 'Classes.md §Senhor das Feras',
  'Vigilante das Sombras': 'Classes.md §Vigilante das Sombras',
  'Campeão': 'Classes.md §Campeão',
  'Cavaleiro Místico': 'Classes.md §Cavaleiro Místico',
  'Combatente Psíquico': 'Classes.md §Combatente Psíquico',
  'Mestre da Batalha': 'Classes.md §Mestre da Batalha',
  'Adaga Espiritual': 'Classes.md §Adaga Espiritual',
  'Assassino': 'Classes.md §Assassino',
  'Ladrão': 'Classes.md §Ladrão',
  'Trapaceiro Arcano': 'Classes.md §Trapaceiro Arcano',
  'Abjurador': 'Classes.md §Abjurador',
  'Adivinhador': 'Classes.md §Adivinhador',
  'Evocador': 'Classes.md §Evocador',
  'Ilusionista': 'Classes.md §Ilusionista',
  'Combatente da Mão Espalmada': 'Classes.md §Combatente da Mão Espalmada',
  'Combatente da Misericórdia': 'Classes.md §Combatente da Misericórdia',
  'Combatente das Sombras': 'Classes.md §Combatente das Sombras',
  'Combatente dos Elementos': 'Classes.md §Combatente dos Elementos',
  'Juramento da Devoção': 'Classes.md §Juramento da Devoção',
  'Juramento da Glória': 'Classes.md §Juramento da Glória',
  'Juramento da Vingança': 'Classes.md §Juramento da Vingança',
  'Juramento dos Anciões': 'Classes.md §Juramento dos Anciões',
};

// Características por subclasse, na ordem em que o livro as apresenta
// (crescente por nível). `nome` é o texto do heading DEPOIS de
// "Nível N: " -- sem o número, sem os dois-pontos.
//
// As 8 chaves abaixo (Bárbaro, Bardo, Bruxo, Clérigo, Druida, Feiticeiro,
// Guardião, Guerreiro) foram preenchidas nas Tasks 2 e 3; as 4 restantes
// (Ladino, Mago, Monge, Paladino) são preenchidas na Task 4.
//
// ARMADILHA (Bruxo, Patrono O Grande Antigo): em Classes.md:1393, a
// característica "Nível 3: Magias de Pacto do Grande Antigo" aparece como
// texto solto, SEM o heading `###` -- diferente das outras 47 subclasses,
// em que cada característica é sempre um heading `### Nível N: <Nome>`. A
// característica existe de fato no livro (parágrafo e tabela "Magias do
// Grande Antigo" logo abaixo) e por isso está transcrita aqui mesmo sem o
// `###`. Sem ela, Patrono O Grande Antigo teria 6 características em vez
// de 7, e Bruxo teria 21 em vez de 22.
export const SUBCLASSES_CARACTERISTICAS = {
  'Bárbaro': {
    'Trilha da Árvore do Mundo': [
      { nivel: 3, nome: 'Vitalidade da Árvore' },
      { nivel: 6, nome: 'Ramos da Árvore' },
      { nivel: 10, nome: 'Raízes Devastadoras' },
      { nivel: 14, nome: 'Percorrer a Árvore' },
    ],
    'Trilha do Berserker': [
      { nivel: 3, nome: 'Frenesi' },
      { nivel: 6, nome: 'Fúria Irracional' },
      { nivel: 10, nome: 'Retaliação' },
      { nivel: 14, nome: 'Presença Intimidante' },
    ],
    'Trilha do Coração Selvagem': [
      { nivel: 3, nome: 'Arauto da Fauna' },
      { nivel: 3, nome: 'Fúria dos Selvagens' },
      { nivel: 6, nome: 'Aspecto dos Selvagens' },
      { nivel: 10, nome: 'Arauto da Natureza' },
      { nivel: 14, nome: 'Poder dos Selvagens' },
    ],
    'Trilha do Fanático': [
      { nivel: 3, nome: 'Campeão dos Deuses' },
      { nivel: 3, nome: 'Fúria Divina' },
      { nivel: 6, nome: 'Concentração Fanática' },
      { nivel: 10, nome: 'Presença Zelosa' },
      { nivel: 14, nome: 'Fúria dos Deuses' },
    ],
  },
  'Bardo': {
    'Colégio da Bravura': [
      { nivel: 3, nome: 'Inspiração em Combate' },
      { nivel: 3, nome: 'Treinamento Marcial' },
      { nivel: 6, nome: 'Ataque Extra' },
      { nivel: 14, nome: 'Magia de Batalha' },
    ],
    'Colégio da Dança': [
      { nivel: 3, nome: 'Ginga Fascinante' },
      { nivel: 6, nome: 'Gingado Coordenado' },
      { nivel: 6, nome: 'Movimento Inspirador' },
      { nivel: 14, nome: 'Evasão Liderada' },
    ],
    'Colégio do Conhecimento': [
      { nivel: 3, nome: 'Palavras de Interrupção' },
      { nivel: 3, nome: 'Proficiências Bônus' },
      { nivel: 6, nome: 'Descobertas Mágicas' },
      { nivel: 14, nome: 'Perícia Inigualável' },
    ],
    'Colégio do Glamour': [
      { nivel: 3, nome: 'Magia Fascinante' },
      { nivel: 3, nome: 'Manto de Inspiração' },
      { nivel: 6, nome: 'Manto de Majestade' },
      { nivel: 14, nome: 'Majestade Inquebrável' },
    ],
  },
  'Bruxo': {
    'Patrono Arquifada': [
      { nivel: 3, nome: 'Magias de Pacto da Arquifada' },
      { nivel: 3, nome: 'Passos Feéricos' },
      { nivel: 6, nome: 'Fuga em Névoa' },
      { nivel: 10, nome: 'Defesas Sedutoras' },
      { nivel: 14, nome: 'Magia Sedutora' },
    ],
    'Patrono Celestial': [
      { nivel: 3, nome: 'Luz Medicinal' },
      { nivel: 3, nome: 'Magia de Pacto do Celestial' },
      { nivel: 6, nome: 'Alma Radiante' },
      { nivel: 10, nome: 'Resiliência Celestial' },
      { nivel: 14, nome: 'Vingança Calcinante' },
    ],
    'Patrono O Grande Antigo': [
      // Classes.md:1393 -- texto solto, sem `###` (ver comentário acima).
      { nivel: 3, nome: 'Magias de Pacto do Grande Antigo' },
      { nivel: 3, nome: 'Magias Psíquicas' },
      { nivel: 3, nome: 'Mente Desperta' },
      { nivel: 6, nome: 'Combatente Clarividente' },
      { nivel: 10, nome: 'Danação Mística' },
      { nivel: 10, nome: 'Escudo Mental' },
      { nivel: 14, nome: 'Criar Servo' },
    ],
    'Patrono Ínfero': [
      { nivel: 3, nome: 'Bênção do Tenebroso' },
      { nivel: 3, nome: 'Magias de Pacto do Ínfero' },
      { nivel: 6, nome: 'A Sorte do Próprio Tenebroso' },
      { nivel: 10, nome: 'Resistência Ínfera' },
      { nivel: 14, nome: 'Lançar no Inferno' },
    ],
  },
  'Clérigo': {
    'Domínio da Guerra': [
      { nivel: 3, nome: 'Magias de Domínio da Guerra' },
      { nivel: 3, nome: 'Ataque Direcionado' },
      { nivel: 3, nome: 'Sacerdote da Guerra' },
      { nivel: 6, nome: 'Bênção do Deus da Guerra' },
      { nivel: 17, nome: 'Avatar da Guerra' },
    ],
    'Domínio da Luz': [
      { nivel: 3, nome: 'Brilho do Amanhecer' },
      { nivel: 3, nome: 'Labareda Protetora' },
      { nivel: 3, nome: 'Magias de Domínio da Luz' },
      { nivel: 6, nome: 'Labareda Protetora Aprimorada' },
      { nivel: 17, nome: 'Coroa de Luz' },
    ],
    'Domínio da Trapaça': [
      { nivel: 3, nome: 'Magias de Domínio da Trapaça' },
      { nivel: 3, nome: 'Bênção do Trapaceiro' },
      { nivel: 3, nome: 'Invocar Duplicidade' },
      { nivel: 6, nome: 'Transposição do Trapaceiro' },
      { nivel: 17, nome: 'Duplicidade Aprimorada' },
    ],
    'Domínio da Vida': [
      { nivel: 3, nome: 'Magias de Domínio da Vida' },
      { nivel: 3, nome: 'Discípulo da Vida' },
      { nivel: 3, nome: 'Preservar a Vida' },
      { nivel: 6, nome: 'Curandeiro Abençoado' },
      { nivel: 17, nome: 'Cura Suprema' },
    ],
  },
  'Druida': {
    'Círculo da Lua': [
      { nivel: 3, nome: 'Formas Animais dos Círculos Druídicos' },
      { nivel: 3, nome: 'Magias do Círculo da Lua' },
      { nivel: 6, nome: 'Formas Animais dos Círculos Druídicos Aprimorada' },
      { nivel: 10, nome: 'Passo Lunar' },
      { nivel: 14, nome: 'Forma Lunar' },
    ],
    'Círculo da Terra': [
      { nivel: 3, nome: 'Auxílio da Terra' },
      { nivel: 3, nome: 'Magias do Círculo da Terra' },
      { nivel: 6, nome: 'Recuperação Natural' },
      { nivel: 10, nome: 'Proteção Natural' },
      { nivel: 14, nome: 'Santuário Natural' },
    ],
    'Círculo das Estrelas': [
      { nivel: 3, nome: 'Forma Estrelada' },
      { nivel: 3, nome: 'Mapa Estelar' },
      { nivel: 6, nome: 'Presságio Cósmico' },
      { nivel: 10, nome: 'Constelações Cintilantes' },
      { nivel: 14, nome: 'Repleto de Estrelas' },
    ],
    'Círculo do Mar': [
      { nivel: 3, nome: 'Ira do Mar' },
      { nivel: 3, nome: 'Magias do Círculo do Mar' },
      { nivel: 6, nome: 'Afinidade Aquática' },
      { nivel: 10, nome: 'Filho da Tempestade' },
      { nivel: 14, nome: 'Manifestação Oceânica' },
    ],
  },
  'Feiticeiro': {
    'Feitiçaria Aberrante': [
      { nivel: 3, nome: 'Fala Telepática' },
      { nivel: 3, nome: 'Magias Psiônicas' },
      { nivel: 6, nome: 'Defesas Psíquicas' },
      { nivel: 6, nome: 'Feitiçaria Psiônica' },
      { nivel: 14, nome: 'Revelação em Carne' },
      { nivel: 18, nome: 'Implosão de Distorção' },
    ],
    'Feitiçaria Dracônica': [
      { nivel: 3, nome: 'Magias Dracônicas' },
      { nivel: 3, nome: 'Resiliência Dracônica' },
      { nivel: 6, nome: 'Afinidade Elemental' },
      { nivel: 14, nome: 'Asas de Dragão' },
      { nivel: 18, nome: 'Companheiro Dracônico' },
    ],
    'Feitiçaria Mecânica': [
      { nivel: 3, nome: 'Magias Mecânicas' },
      { nivel: 3, nome: 'Restaurar Equilíbrio' },
      { nivel: 6, nome: 'Bastião da Lei' },
      { nivel: 14, nome: 'Transe da Ordem' },
      { nivel: 18, nome: 'Cavalgada Mecânica' },
    ],
    'Feitiçaria Selvagem': [
      { nivel: 3, nome: 'Marés do Caos' },
      { nivel: 3, nome: 'Surto de Magia Selvagem' },
      { nivel: 6, nome: 'Distorcer a Sorte' },
      { nivel: 14, nome: 'Caos Controlado' },
      { nivel: 18, nome: 'Surto Controlado' },
    ],
  },
  'Guardião': {
    'Andarilho Feérico': [
      { nivel: 3, nome: 'Glamour Transcendental' },
      { nivel: 3, nome: 'Golpes Terríveis' },
      { nivel: 3, nome: 'Magias do Andarilho Feérico' },
      { nivel: 7, nome: 'Detalhe Sedutor' },
      { nivel: 11, nome: 'Reforços Feéricos' },
      { nivel: 15, nome: 'Andarilho Nebuloso' },
    ],
    'Caçador': [
      { nivel: 3, nome: 'Conhecimento do Caçador' },
      { nivel: 3, nome: 'Presa do Caçador' },
      { nivel: 7, nome: 'Táticas Defensivas' },
      { nivel: 11, nome: 'Presa do Caçador Superior' },
      { nivel: 15, nome: 'Defesa do Caçador Superior' },
    ],
    'Senhor das Feras': [
      { nivel: 3, nome: 'Companheiro Primal' },
      { nivel: 7, nome: 'Treinamento Excepcional' },
      { nivel: 11, nome: 'Fúria Bestial' },
      { nivel: 15, nome: 'Compartilhar Magias' },
    ],
    'Vigilante das Sombras': [
      { nivel: 3, nome: 'Emboscador das Sombras' },
      { nivel: 3, nome: 'Magias do Vigilante das Sombras' },
      { nivel: 3, nome: 'Visão Umbrosa' },
      { nivel: 7, nome: 'Mente de Ferro' },
      { nivel: 11, nome: 'Torrente do Vigilante' },
      { nivel: 15, nome: 'Esquiva Sombria' },
    ],
  },
  'Guerreiro': {
    'Campeão': [
      { nivel: 3, nome: 'Atleta Extraordinário' },
      { nivel: 3, nome: 'Crítico Aprimorado' },
      { nivel: 7, nome: 'Estilo de Luta Adicional' },
      { nivel: 10, nome: 'Combatente Heroico' },
      { nivel: 15, nome: 'Crítico Superior' },
      { nivel: 18, nome: 'Sobrevivente' },
    ],
    'Cavaleiro Místico': [
      { nivel: 3, nome: 'Conjuração' },
      { nivel: 3, nome: 'Vínculo com Arma' },
      { nivel: 7, nome: 'Magia de Guerra' },
      { nivel: 10, nome: 'Golpe Místico' },
      { nivel: 15, nome: 'Investida Mística' },
      { nivel: 18, nome: 'Magia de Guerra Aprimorada' },
    ],
    'Combatente Psíquico': [
      { nivel: 3, nome: 'Poder Psiônico' },
      { nivel: 7, nome: 'Adepto Telecinético' },
      { nivel: 10, nome: 'Resguardo Mental' },
      { nivel: 15, nome: 'Baluarte de Energia' },
      { nivel: 18, nome: 'Mestre Telecinético' },
    ],
    'Mestre da Batalha': [
      { nivel: 3, nome: 'Estudioso da Guerra' },
      { nivel: 3, nome: 'Superioridade em Combate' },
      { nivel: 7, nome: 'Conheça Seu Inimigo' },
      { nivel: 10, nome: 'Superioridade em Combate Aprimorada' },
      { nivel: 15, nome: 'Implacável' },
      { nivel: 18, nome: 'Superioridade em Combate Suprema' },
    ],
  },
  'Ladino': {
    'Adaga Espiritual': [
      { nivel: 3, nome: 'Lâminas Psíquicas' },
      { nivel: 3, nome: 'Poder Psiônico' },
      { nivel: 9, nome: 'Lâminas da Alma' },
      { nivel: 13, nome: 'Véu Psíquico' },
      { nivel: 17, nome: 'Rasgar Mente' },
    ],
    'Assassino': [
      { nivel: 3, nome: 'Assassinar' },
      { nivel: 3, nome: 'Ferramentas de Assassino' },
      { nivel: 9, nome: 'Especialista em Infiltração' },
      { nivel: 13, nome: 'Armas Venenosas' },
      { nivel: 17, nome: 'Golpe Mortal' },
    ],
    'Ladrão': [
      { nivel: 3, nome: 'Andarilho de Telhados' },
      { nivel: 3, nome: 'Mão Leve' },
      { nivel: 9, nome: 'Furtividade Suprema' },
      { nivel: 13, nome: 'Usar Dispositivo Mágico' },
      { nivel: 17, nome: 'Reflexos de Ladrão' },
    ],
    'Trapaceiro Arcano': [
      { nivel: 3, nome: 'Conjuração' },
      { nivel: 3, nome: 'Mãos Mágicas Ligeiras' },
      { nivel: 9, nome: 'Emboscada Mágica' },
      { nivel: 13, nome: 'Trapaceiro Versátil' },
      { nivel: 17, nome: 'Ladrão de Magias' },
    ],
  },
  'Mago': {
    'Abjurador': [
      { nivel: 3, nome: 'Proteção Arcana' },
      { nivel: 3, nome: 'Versado em Abjuração' },
      { nivel: 6, nome: 'Proteção Projetada' },
      { nivel: 10, nome: 'Rompe-Magia' },
      { nivel: 14, nome: 'Resistência à Magia' },
    ],
    'Adivinhador': [
      { nivel: 3, nome: 'Prodígio' },
      { nivel: 3, nome: 'Versado em Adivinhação' },
      { nivel: 6, nome: 'Perito em Adivinhação' },
      { nivel: 10, nome: 'O Terceiro Olho' },
      { nivel: 14, nome: 'Prodígio Maior' },
    ],
    'Evocador': [
      { nivel: 3, nome: 'Truque Potente' },
      { nivel: 3, nome: 'Versado em Evocação' },
      { nivel: 6, nome: 'Esculpir Magias' },
      { nivel: 10, nome: 'Evocação Potencializada' },
      { nivel: 14, nome: 'Sobrecarga' },
    ],
    'Ilusionista': [
      { nivel: 3, nome: 'Ilusões Aprimoradas' },
      { nivel: 3, nome: 'Versado em Ilusão' },
      { nivel: 6, nome: 'Criaturas Espectrais' },
      { nivel: 10, nome: 'Autoimagem Ilusória' },
      { nivel: 14, nome: 'Realidade Ilusória' },
    ],
  },
  'Monge': {
    'Combatente da Mão Espalmada': [
      { nivel: 3, nome: 'Técnica da Mão Espalmada' },
      { nivel: 6, nome: 'Integridade Corporal' },
      { nivel: 11, nome: 'Passo Veloz' },
      { nivel: 17, nome: 'Palma Vibrante' },
    ],
    'Combatente da Misericórdia': [
      { nivel: 3, nome: 'Implementos de Misericórdia' },
      { nivel: 3, nome: 'Mão de Cura' },
      { nivel: 3, nome: 'Mão de Dolo' },
      { nivel: 6, nome: 'Toque de Médico' },
      { nivel: 11, nome: 'Torrente de Cura e Dolo' },
      { nivel: 17, nome: 'Mão da Misericórdia Final' },
    ],
    'Combatente das Sombras': [
      { nivel: 3, nome: 'Artes das Sombras' },
      { nivel: 6, nome: 'Passo da Sombra' },
      { nivel: 11, nome: 'Passo da Sombra Aprimorado' },
      { nivel: 17, nome: 'Manto da Sombra' },
    ],
    'Combatente dos Elementos': [
      { nivel: 3, nome: 'Manipular Elementos' },
      { nivel: 3, nome: 'Sintonia Elemental' },
      { nivel: 6, nome: 'Explosão Elemental' },
      { nivel: 11, nome: 'Passo dos Elementos' },
      { nivel: 17, nome: 'Ápice Elemental' },
    ],
  },
  'Paladino': {
    'Juramento da Devoção': [
      { nivel: 3, nome: 'Magias do Juramento da Devoção' },
      { nivel: 3, nome: 'Arma Sagrada' },
      { nivel: 7, nome: 'Aura de Devoção' },
      { nivel: 15, nome: 'Destruição Protetora' },
      { nivel: 20, nome: 'Resplendor Sagrado' },
    ],
    'Juramento da Glória': [
      { nivel: 3, nome: 'Atleta Inigualável' },
      { nivel: 3, nome: 'Destruição Inspiradora' },
      { nivel: 3, nome: 'Magias do Juramento da Glória' },
      { nivel: 7, nome: 'Aura de Vivacidade' },
      { nivel: 15, nome: 'Defesa Gloriosa' },
      { nivel: 20, nome: 'Lenda Viva' },
    ],
    'Juramento da Vingança': [
      { nivel: 3, nome: 'Magias do Juramento da Vingança' },
      { nivel: 3, nome: 'Voto de Inimizade' },
      { nivel: 7, nome: 'Vingador Implacável' },
      { nivel: 15, nome: 'Alma Vingativa' },
      { nivel: 20, nome: 'Anjo Vingador' },
    ],
    'Juramento dos Anciões': [
      { nivel: 3, nome: 'A Ira da Natureza' },
      { nivel: 3, nome: 'Magias do Juramento dos Anciões' },
      { nivel: 7, nome: 'Aura de Resistência' },
      { nivel: 15, nome: 'Sentinela Imortal' },
      { nivel: 20, nome: 'Campeão Ancestral' },
    ],
  },
};

// ============================================================
// Magias que cada subclasse concede, por nível, transcritas do livro.
//
// EMENDA DE 2026-08-17 (registrada em `situação.txt` e no plano, seção
// "Interfaces" da Task 2): o desenho original tinha só duas listas
// (MAGIAS_SUBCLASSE / SUBCLASSES_SEM_MAGIA). A transcrição encontrou dois
// grupos que não cabem em "lista fixa de magias sempre preparadas", e
// forçá-los para dentro dela produziria LACUNA FALSA -- o erro que o guia
// trata como pior que lacuna faltando. Por isso o catálogo agora tem
// QUATRO listas, que juntas cobrem exatamente as 48 subclasses:
//   - MAGIAS_SUBCLASSE (aqui)        -- concede lista FIXA sempre preparada.
//   - SUBCLASSES_MAGIA_POR_ESCOLHA   -- concede, mas depende de escolha do
//     jogador (sem lista fixa a transcrever): Círculo da Terra (Druida,
//     escolhe 1 de 4 tabelas de terreno) e Colégio do Conhecimento (Bardo,
//     escolhe 2 magias de outra classe).
//   - SUBCLASSES_MAGIA_OUTRO_MECANISMO -- concede por OUTRO mecanismo do
//     livro (magia *conhecida*, ou conjurável só como Ritual), não por
//     "sempre preparada": Trilha do Coração Selvagem, Combatente das
//     Sombras, Combatente dos Elementos, Trapaceiro Arcano e (achado
//     nesta emenda, não citado no pedido original -- ver comentário junto
//     de Ilusionista abaixo) o nível 3 de Ilusionista.
//   - SUBCLASSES_SEM_MAGIA            -- não concede nada.
//
// Duas formas contam para ESTA lista (MAGIAS_SUBCLASSE), porque o livro
// usa as duas: a TABELA `| Nível | Magias |` dentro da descrição de uma
// característica, e a FRASE que nomeia uma magia sempre preparada (ex.:
// "Você sempre tem a magia X preparada"). Só isso -- a frase "você
// conhece a magia X" e a frase "pode conjurar a magia X, mas apenas como
// Ritual" são OUTRO mecanismo do livro e vão para
// SUBCLASSES_MAGIA_OUTRO_MECANISMO, não aqui: o motor deste plano
// (`obterMagiasDominioNivel` + `obterMagiasSemprePreparadasNivel`)
// confronta só a união de tabela + "sempre preparada"; exigir aqui uma
// magia que o app concede por outra origem ("conhecida", "subclasse_fixa"
// etc.) produziria uma lacuna falsa.
//
// Só aparecem aqui as subclasses que concedem lista FIXA sempre
// preparada. O motor exige que as QUATRO listas, juntas, cubram
// exatamente as 48 -- sem essa exigência, "esqueci de transcrever" e "não
// concede nada" seriam indistinguíveis, e o teste ficaria verde sobre uma
// subclasse esquecida.
//
// ARMADILHA (medida em 2026-08-17): rodando o app hoje, Círculo da Lua,
// Círculo do Mar e Vigilante das Sombras concedem ZERO magias -- um bug.
// O livro concede normalmente nas três (tabelas abaixo, transcritas de
// Classes.md). A divergência entre o que está aqui e o que o app faz é o
// achado que a Task 4 (schema) e os testes seguintes vão expor -- por
// isso as três estão transcritas do livro, não do comportamento do app.
//
// REGRA DURA: transcrito do LIVRO (Informacoes Separadas/Classes.md).
// Nada copiado de dados/classes/*.json.
export const MAGIAS_SUBCLASSE = {
  // Bárbaro: nenhuma subclasse concede lista fixa sempre preparada.
  // Trilha do Coração Selvagem concede por Ritual -- ver
  // SUBCLASSES_MAGIA_OUTRO_MECANISMO.

  // ---------------------------------------------------------------
  // Bardo
  // ---------------------------------------------------------------
  // "Magia Fascinante" (nível 3, Classes.md:786) e "Manto de Majestade"
  // (nível 6, Classes.md:798) -- as duas em prosa ("sempre está com as
  // magias... preparadas" / "tem sempre a magia... preparada").
  'Colégio do Glamour': {
    3: ['Enfeitiçar Pessoa', 'Reflexos'],
    6: ['Comando'],
  },

  // ---------------------------------------------------------------
  // Bruxo
  // ---------------------------------------------------------------
  'Patrono Arquifada': {
    3: ['Acalmar Emoções', 'Fogo das Fadas', 'Força Espectral', 'Passo Nebuloso', 'Sono'],
    5: ['Crescimento de Plantas', 'Piscar'],
    7: ['Dominar Fera', 'Invisibilidade Maior'],
    9: ['Dominar Pessoa', 'Similaridade'],
  },
  'Patrono Celestial': {
    3: ['Auxílio', 'Chama Sagrada', 'Curar Ferimentos', 'Luz', 'Raio Guia', 'Restauração Menor'],
    5: ['Luz do Dia', 'Revivificar'],
    7: ['Defensor da Fé', 'Muralha de Fogo'],
    9: ['Convocar Celestial', 'Restauração Maior'],
  },
  // ARMADILHA (mesma de SUBCLASSES_CARACTERISTICAS): a tabela "Magias de
  // Pacto do Grande Antigo" (nível 3, Classes.md:1397) está sob um texto
  // solto sem `###`, mas existe e é transcrita normalmente. Além dela,
  // "Danação Mística" (nível 10, Classes.md:1422-1424, "Você sempre tem a
  // magia Danação preparada") é uma concessão separada, em prosa, num
  // nível diferente -- por isso o nível 10 abaixo.
  'Patrono O Grande Antigo': {
    3: ['Detectar Pensamentos', 'Força Espectral', 'Gargalhada Nefasta de Tasha', 'Sussurros Dissonantes'],
    5: ['Clarividência', 'Fome de Hadar'],
    7: ['Confusão', 'Invocar Aberração'],
    9: ['Modificar Memória', 'Telecinese'],
    10: ['Danação'],
  },
  'Patrono Ínfero': {
    3: ['Comando', 'Mãos Flamejantes', 'Raio Ardente', 'Sugestão'],
    5: ['Bola de Fogo', 'Nuvem Fétida'],
    7: ['Escudo Ardente', 'Muralha de Fogo'],
    9: ['Missão', 'Praga de Insetos'],
  },

  // ---------------------------------------------------------------
  // Clérigo
  // ---------------------------------------------------------------
  'Domínio da Guerra': {
    3: ['Arma Espiritual', 'Arma Mágica', 'Escudo da Fé', 'Raio Guia'],
    5: ['Guardiões Espirituais', 'Manto do Cruzado'],
    7: ['Escudo Ardente', 'Movimentação Livre'],
    // "Golpe de Arço" é a grafia do livro (Classes.md:1818, e repetida na
    // lista de magias de Guardião e de Mago) -- transcrito como está.
    9: ['Golpe de Arço', 'Paralisar Monstro'],
  },
  'Domínio da Luz': {
    3: ['Fogo das Fadas', 'Mãos Flamejantes', 'Raio Ardente', 'Ver o Invisível'],
    5: ['Bola de Fogo', 'Luz do Dia'],
    7: ['Muralha de Fogo', 'Olho Arcano'],
    9: ['Coluna de Chamas', 'Vidência'],
  },
  'Domínio da Trapaça': {
    3: ['Disfarçar-se', 'Enfeitiçar Pessoa', 'Invisibilidade', 'Passo Sem Rastro'],
    5: ['Indetectável', 'Padrão Hipnótico'],
    7: ['Confusão', 'Porta Dimensional'],
    9: ['Dominar Pessoa', 'Modificar Memória'],
  },
  'Domínio da Vida': {
    3: ['Auxílio', 'Bênção', 'Curar Ferimentos', 'Restauração Menor'],
    5: ['Palavra Curativa em Massa', 'Revivificar'],
    7: ['Aura de Vida', 'Proteção Contra a Morte'],
    9: ['Curar Ferimentos em Massa', 'Restauração Maior'],
  },

  // ---------------------------------------------------------------
  // Druida
  // ---------------------------------------------------------------
  // ARMADILHA (medida em 2026-08-17): app concede ZERO magias aqui hoje.
  // O livro concede normalmente (Classes.md:2361-2368).
  'Círculo da Lua': {
    3: ['Curar Ferimentos', 'Fagulha Estelar', 'Raio Lunar'],
    5: ['Invocar Animais'],
    7: ['Fonte do Luar'],
    9: ['Curar Ferimentos em Massa'],
  },
  // Círculo da Terra NÃO entra aqui: "escolha um tipo de terreno" a cada
  // Descanso Longo -- ver SUBCLASSES_MAGIA_POR_ESCOLHA.
  //
  // "Mapa Estelar" (nível 3, Classes.md:2493): prosa, não tabela --
  // "você tem as magias Orientação e Raio Guia preparadas" enquanto
  // segura o mapa (item que a própria característica cria).
  'Círculo das Estrelas': {
    3: ['Orientação', 'Raio Guia'],
  },
  // ARMADILHA (medida em 2026-08-17): app concede ZERO magias aqui hoje.
  // O livro concede normalmente (Classes.md:2544-2551).
  'Círculo do Mar': {
    3: ['Despedaçar', 'Lufada de Vento', 'Névoa Obscurecente', 'Onda Trovejante', 'Raio de Gelo'],
    5: ['Relâmpago', 'Respirar na Água'],
    7: ['Controlar Água', 'Tempestade Glacial'],
    9: ['Invocar Elemental', 'Paralisar Monstro'],
  },

  // ---------------------------------------------------------------
  // Feiticeiro
  // ---------------------------------------------------------------
  'Feitiçaria Aberrante': {
    3: ['Acalmar Emoções', 'Braços de Hadar', 'Detectar Pensamentos', 'Sussurros Dissonantes', 'Talho Mental'],
    5: ['Fome de Hadar', 'Remeter'],
    7: ['Invocar Aberração', 'Tentáculos Negros de Evard'],
    9: ['Ligação Telepática de Rary', 'Telecinese'],
  },
  'Feitiçaria Dracônica': {
    3: ['Alterar-se', 'Comando', 'Orbe Cromático', 'Sopro de Dragão'],
    5: ['Medo', 'Voo'],
    7: ['Enfeitiçar Monstro', 'Olho Arcano'],
    9: ['Invocar Dragão', 'Lendas e Histórias'],
  },
  'Feitiçaria Mecânica': {
    3: ['Alarme', 'Auxílio', 'Proteção Contra o Bem e o Mal', 'Restauração Menor'],
    5: ['Dissipar Magia', 'Proteção Contra Energia'],
    7: ['Invocar Constructo', 'Movimentação Livre'],
    9: ['Muralha de Energia', 'Restauração Maior'],
  },
  // Feitiçaria Selvagem não entra: Surto de Magia Selvagem é uma tabela de
  // efeitos aleatórios (1d100), não uma lista de magias sempre preparadas.

  // ---------------------------------------------------------------
  // Guardião
  // ---------------------------------------------------------------
  'Andarilho Feérico': {
    3: ['Enfeitiçar Pessoa'],
    5: ['Passo Nebuloso'],
    9: ['Convocar Feérico'],
    13: ['Porta Dimensional'],
    17: ['Despistar'],
  },
  // ARMADILHA (medida em 2026-08-17): app concede ZERO magias aqui hoje.
  // O livro concede normalmente (Classes.md:3718-3724).
  'Vigilante das Sombras': {
    3: ['Disfarçar-se'],
    5: ['Corda Extradimensional'],
    9: ['Medo'],
    13: ['Invisibilidade Maior'],
    17: ['Similaridade'],
  },

  // ---------------------------------------------------------------
  // Guerreiro
  // ---------------------------------------------------------------
  // "Mestre Telecinético" (nível 18, Classes.md:4049): "Você sempre tem a
  // magia Telecinese preparada."
  'Combatente Psíquico': {
    18: ['Telecinese'],
  },

  // Ladino: nenhuma subclasse concede lista fixa sempre preparada.
  // Trapaceiro Arcano conhece Mãos Mágicas (não "sempre preparada") --
  // ver SUBCLASSES_MAGIA_OUTRO_MECANISMO; já coberto, com essa origem
  // exata, por unidade/subclasse-conjuradora.test.mjs.

  // ---------------------------------------------------------------
  // Mago
  // ---------------------------------------------------------------
  // "Rompe-Magia" (nível 10, Classes.md:4988): "Você sempre tem as magias
  // Contramagia e Dissipar Magia preparadas." "Versado em Abjuração"
  // (nível 3) NÃO entra: é escolha do jogador (duas magias de Abjuração
  // para o livro de magias), sem nome fixo -- mesmo padrão de Descobertas
  // Mágicas, repetido nas 4 subclasses de Mago.
  'Abjurador': {
    10: ['Contramagia', 'Dissipar Magia'],
  },
  // ACHADO NESTA EMENDA (não estava nos 4 casos citados no pedido, mas é
  // o mesmo mecanismo -- sinalizado aqui e no relatório): "Ilusões
  // Aprimoradas" (nível 3, Classes.md:5074) diz "Você também conhece o
  // truque Ilusão Menor" -- mesmo padrão "conhece" de Trapaceiro Arcano,
  // não "sempre preparada". Esse nível 3 SAI daqui e vai para
  // SUBCLASSES_MAGIA_OUTRO_MECANISMO. Mas "Criaturas Espectrais" (nível
  // 6, Classes.md:5084) usa a frase padrão: "Você sempre tem as magias
  // Convocar Feérico e Invocar Fera preparadas" -- essa fica AQUI. Logo,
  // Ilusionista aparece nas DUAS listas (MAGIAS_SUBCLASSE só com o nível
  // 6, e SUBCLASSES_MAGIA_OUTRO_MECANISMO com o motivo do nível 3) -- é a
  // única subclasse das 48 em que isso acontece; a verificação abaixo
  // trata esse caso à parte da regra de disjunção estrita.
  // "Versado em Ilusão" (nível 3) não entra pelo mesmo motivo de Versado
  // em Abjuração acima (escolha do jogador, sem nome fixo).
  'Ilusionista': {
    6: ['Convocar Feérico', 'Invocar Fera'],
  },

  // Monge: nenhuma subclasse concede lista fixa sempre preparada.
  // "Artes das Sombras" (Combatente das Sombras, nível 3) tem duas magias
  // citadas: a opção "Escuridão" (Classes.md:3372, "pode gastar 1 Ponto
  // de Foco para conjurar a magia Escuridão") é uma habilidade de gasto
  // de recurso, no mesmo padrão de várias outras características não
  // contadas neste catálogo (ex.: Passos Feéricos do Bruxo) -- não conta
  // de forma alguma. Já "Ilusão Sombria" (conhece a magia Ilusão Menor) e
  // "Manipular Elementos" (Combatente dos Elementos, conhece
  // Elementalismo) são concessões nomeadas e incondicionais, só que por
  // "conhece" -- ver SUBCLASSES_MAGIA_OUTRO_MECANISMO.

  // ---------------------------------------------------------------
  // Paladino
  // ---------------------------------------------------------------
  'Juramento da Devoção': {
    3: ['Escudo da Fé', 'Proteção Contra o Bem e o Mal'],
    5: ['Auxílio', 'Zona da Verdade'],
    9: ['Dissipar Magia', 'Sinal de Esperança'],
    13: ['Defensor da Fé', 'Movimentação Livre'],
    17: ['Coluna de Chamas', 'Comunhão'],
  },
  'Juramento da Glória': {
    3: ['Heroísmo', 'Raio Guia'],
    5: ['Aprimorar Atributo', 'Arma Mágica'],
    9: ['Celeridade', 'Proteção Contra Energia'],
    13: ['Compulsão', 'Movimentação Livre'],
    17: ['Lendas e Histórias', 'Presença Régia de Yolande'],
  },
  'Juramento da Vingança': {
    3: ['Marca do Caçador', 'Perdição'],
    5: ['Paralisar Pessoa', 'Passo Nebuloso'],
    9: ['Celeridade', 'Proteção Contra Energia'],
    13: ['Banimento', 'Porta Dimensional'],
    17: ['Paralisar Monstro', 'Vidência'],
  },
  'Juramento dos Anciões': {
    3: ['Falar com Animais', 'Golpe Constritor'],
    5: ['Passo Nebuloso', 'Raio Lunar'],
    9: ['Crescimento de Plantas', 'Proteção Contra Energia'],
    13: ['Pele-Rocha', 'Tempestade Glacial'],
    17: ['Comunhão com a Natureza', 'Passo Arbóreo'],
  },
};

// ============================================================
// Subclasses cuja concessão de magia depende de uma ESCOLHA do jogador --
// não há lista fixa a transcrever, então elas ficam fora da asserção de
// união do motor (que confronta MAGIAS_SUBCLASSE) e ganham asserção
// própria numa rodada futura. O valor é o motivo, exigido preenchido pelo
// teste de higiene (mesmo padrão de excecoes-escolha-repetida.mjs): cita
// `Classes.md:<linha>`, transcreve a frase do livro que caracteriza a
// escolha, e diz o que este motor NÃO afirma sobre a subclasse.
// ============================================================
export const SUBCLASSES_MAGIA_POR_ESCOLHA = {
  'Círculo da Terra':
    "Classes.md:2406 -- 'Sempre que completar um Descanso Longo, escolha " +
    "um tipo de terreno: árido, polar, temperado ou tropical... você tem " +
    "a lista de magias preparadas de seu nível de Druida e inferior.' São " +
    "QUATRO tabelas alternativas (Classes.md:2408-2442: Árido, Polar, " +
    "Temperado, Tropical), e o jogador recebe UMA por vez -- 6 magias no " +
    "total de uma tabela (3 no nível 3, 1 em cada um de 5/7/9), não as 4 " +
    "tabelas somadas. Este motor não afirma qual das 4 listas (nem a " +
    "união delas) a subclasse concede; é a divergência que a Task 4 " +
    "registra como lacuna -- CORRIGIDO na revisão da Task 6 (o número " +
    "\"20\" abaixo era de uma medição anterior que contava só " +
    "magias_preparadas, sem os truques em magias_conhecidas): dirigindo " +
    "escadaDeNivel de verdade até o nível 20 e contando por origem, o app " +
    "grava 24 magias com origem 'sempre' (0 com origem 'dominio' -- a " +
    "rota de domínio está MORTA para esta subclasse, porque a " +
    "característica se chama \"Magias DO Círculo da Terra\" e o regex de " +
    "obterMagiasDominioNivel exige \"Magias DE\"; as 24 saem da rota " +
    "'sempre preparada', que aqui passa da guarda porque a frase do livro " +
    "começa com \"Sempre que completar um Descanso Longo\" -- ver Causa 2 " +
    "em lacunas-conhecidas.mjs para a citação completa), somando as " +
    "quatro tabelas de terreno nos quatro níveis de concessão " +
    "(12 no nível 3 + 4 em cada um de 5/7/9); o livro dá 6 (uma tabela " +
    "escolhida: 3 no nível 3 + 1 em cada um de 5/7/9).",
  'Colégio do Conhecimento':
    "Classes.md:770 -- 'Você aprende duas magias à sua escolha' " +
    "(Descobertas Mágicas, nível 6); Classes.md:772 confirma: 'Você " +
    "sempre tem as magias escolhidas preparadas'. As magias vêm das " +
    "listas de Clérigo, Druida ou Mago, à escolha do jogador -- não há " +
    "lista fixa a transcrever. Este motor não afirma nenhum nome de " +
    "magia para esta subclasse.",
};

// ============================================================
// Quantas magias a concessão POR ESCOLHA pode render em cada nível, pelo
// livro. Não é lista de nomes (não existe uma: a escolha é do jogador) --
// é o TETO que torna a asserção falsificável. Círculo da Terra:
// Classes.md:2406 manda escolher um terreno entre quatro a cada Descanso
// Longo, e cada tabela de terreno concede 3 magias no nível 3 e 1 em cada
// um dos níveis 5, 7 e 9 (conferido nas quatro tabelas, Classes.md:2408-
// 2442: Árido, Polar, Temperado e Tropical concedem, cada uma, a mesma
// contagem). Colégio do Conhecimento: Classes.md:768-770, Descobertas
// Mágicas concede duas magias à escolha no nível 6 -- a característica
// permite trocá-las em níveis seguintes, mas não concede mais que duas.
// ============================================================
export const TETO_MAGIAS_POR_ESCOLHA = {
  'Círculo da Terra': { 3: 3, 5: 1, 7: 1, 9: 1 },
  'Colégio do Conhecimento': { 6: 2 },
};

// ============================================================
// Subclasses que concedem magia por OUTRO mecanismo do livro (magia
// *conhecida*, ou conjurável apenas como Ritual), não por "sempre
// preparada" -- fora do escopo do motor deste plano (a união de
// obterMagiasDominioNivel + obterMagiasSemprePreparadasNivel), registradas
// para o fato não se perder. Mesmo formato de motivo de
// SUBCLASSES_MAGIA_POR_ESCOLHA: cita a linha, transcreve a frase exata do
// livro, e diz o que este motor NÃO afirma.
//
// Ilusionista é a única subclasse das 48 que aparece TAMBÉM em
// MAGIAS_SUBCLASSE (nível 6, "Criaturas Espectrais") -- o nível 3 abaixo
// é uma concessão separada, por outra característica, com outro
// mecanismo. Ver o comentário junto de 'Ilusionista' em MAGIAS_SUBCLASSE.
// ============================================================
export const SUBCLASSES_MAGIA_OUTRO_MECANISMO = {
  'Trilha do Coração Selvagem':
    "Classes.md:253 (Arauto da Fauna, nível 3) -- 'Você pode conjurar as " +
    "magias Falar com Animais e Sentido Feral, mas apenas como Rituais.' " +
    "Classes.md:277 (Arauto da Natureza, nível 10) -- 'Você pode " +
    "conjurar a magia Comunhão com a Natureza, mas apenas como um " +
    "Ritual.' Concessão nomeada e incondicional, mas restrita a " +
    "conjuração Ritual -- verbo diferente de 'sempre preparada'. Este " +
    "motor não afirma que a subclasse tem essas magias sempre preparadas " +
    "nem cobra o app por não marcá-las com origem 'sempre'.",
  'Combatente das Sombras':
    "Classes.md:5374 (Artes das Sombras, opção Ilusão Sombria, nível 3) " +
    "-- 'Você conhece a magia Ilusão Menor.' Concessão por conhecimento " +
    "de truque, não por preparo -- este motor não afirma 'sempre " +
    "preparada' para esta magia nem cobra o app por não marcá-la com " +
    "essa origem.",
  'Combatente dos Elementos':
    "Classes.md:5404 (Manipular Elementos, nível 3) -- 'Você conhece a " +
    "magia Elementalismo.' Mesmo mecanismo do item acima: magia " +
    "conhecida, não preparada.",
  'Trapaceiro Arcano':
    "Classes.md:4459 (Conjuração, nível 3) -- 'Você conhece três " +
    "truques: Mãos Mágicas e dois outros truques à sua escolha.' Mãos " +
    "Mágicas é garantido (não é 'recomendado' como os truques de " +
    "Cavaleiro Místico), mas por conhecimento de truque, não por 'sempre " +
    "preparada'. Já coberto por unidade/subclasse-conjuradora.test.mjs, " +
    "que confere Mãos Mágicas com origem: 'subclasse_fixa' -- este motor " +
    "(a união sempre-preparada) não precisa e não deve cobrir esta magia " +
    "de novo.",
  'Ilusionista':
    "Classes.md:5074 (Ilusões Aprimoradas, nível 3) -- 'Você também " +
    "conhece o truque Ilusão Menor.' Mesmo mecanismo dos itens acima " +
    "(conhecimento de truque, não preparo). Diferença: Ilusionista " +
    "TAMBÉM concede lista fixa sempre preparada por outra característica " +
    "(Criaturas Espectrais, nível 6, Classes.md:5084: 'Você sempre tem " +
    "as magias Convocar Feérico e Invocar Fera preparadas'), que " +
    "permanece em MAGIAS_SUBCLASSE -- por isso esta subclasse aparece " +
    "nas duas listas. Este motivo cobre só o nível 3 (o truque conhecido, " +
    "fora do escopo do motor); o nível 6 é responsabilidade normal do " +
    "motor via MAGIAS_SUBCLASSE.",
};

// As subclasses que não concedem magia nenhuma, por nenhum mecanismo.
// Lista exigida como EXATA pelo motor, junto com as outras três: uma
// subclasse que sumisse das quatro listas não seria testada por ninguém.
// Conferido linha a linha em Classes.md (nenhuma tabela
// `| Nível | Magias |`, nenhuma frase de magia nomeada fixa -- "sempre
// preparada", "conhece" ou "apenas como Ritual" -- e nenhuma escolha de
// magia nas características dessas subclasses).
export const SUBCLASSES_SEM_MAGIA = [
  // Bárbaro
  'Trilha da Árvore do Mundo',
  'Trilha do Berserker',
  'Trilha do Fanático',
  // Bardo
  'Colégio da Bravura',
  'Colégio da Dança',
  // Guardião
  'Caçador',
  'Senhor das Feras',
  // Guerreiro -- Cavaleiro Místico fica aqui: os truques de Mago da sua
  // Conjuração são "recomendados", não garantidos (Classes.md:3932).
  'Campeão',
  'Cavaleiro Místico',
  'Mestre da Batalha',
  // Ladino
  'Adaga Espiritual',
  'Assassino',
  'Ladrão',
  // Mago -- Adivinhador e Evocador: "Versado em..." é escolha do jogador,
  // sem lista fixa, e nenhuma outra característica nomeia magia fixa.
  'Adivinhador',
  'Evocador',
  // Monge
  'Combatente da Mão Espalmada',
  'Combatente da Misericórdia',
  // Feiticeiro
  'Feitiçaria Selvagem',
];

// ============================================================
// Magias que a CLASSE BASE concede sempre preparadas, por nível.
//
// Este catálogo não é sobre subclasse -- ele existe porque
// obterMagiasSemprePreparadasNivel (site/js/levelup.js:583-604) varre
// também as características da classe, então sem ele a asserção de "nada
// a mais" da Task 4 acusaria falso em toda classe que concede algo por
// si. Classe sem nenhuma concessão simplesmente não aparece aqui.
//
// Método: lidas as 12 seções `## Características de Classe de <Classe>`
// de Classes.md por inteiro, procurando toda característica que nomeia
// (em itálico) uma magia sempre preparada. A prosa genérica da
// característica `Conjuração` de cada classe conjuradora ("se outra
// característica lhe der magias que você sempre tem preparadas...") NÃO
// nomeia magia nenhuma e por isso não entra.
//
// REGRA DURA: transcrito do LIVRO (Informacoes Separadas/Classes.md).
// Nada copiado de dados/classes/*.json.
export const MAGIAS_CLASSE_SEMPRE = {
  // "Palavras de Criação" (nível 20, Classes.md:484-486): "você sempre
  // tem as magias Palavra de Poder: Matar e Palavra de Poder: Salvar
  // preparadas".
  'Bardo': {
    20: ['Palavra de Poder: Matar', 'Palavra de Poder: Salvar'],
  },
  // "Contatar Patrono" (nível 9, Classes.md:926-928): "Você sempre tem a
  // magia Contato Extraplanar preparada."
  'Bruxo': {
    9: ['Contato Extraplanar'],
  },
  // ARMADILHA: a concessão está numa característica que não parece ser
  // sobre magia nenhuma pelo nome -- "Idioma Druídico" (nível 1,
  // Classes.md:2048-2050): "você também adquiriu a habilidade mágica de
  // se comunicar com animais; você sempre tem a magia Falar com Animais
  // preparada."
  'Druida': {
    1: ['Falar com Animais'],
  },
  // "Inimigo Favorito" (nível 1, Classes.md:3296-3298): "Você sempre tem
  // a magia Marca do Caçador preparada." Mesma armadilha do Druida acima
  // -- o nome da característica não sugere magia.
  'Guardião': {
    1: ['Marca do Caçador'],
  },
  // "Destruição do Paladino" (nível 2, Classes.md:5531-5533): "Você
  // sempre tem a magia Destruição Divina preparada." "Montaria Fiel"
  // (nível 5, Classes.md:5571-5573): "Você sempre tem a magia Convocar
  // Montaria preparada."
  'Paladino': {
    2: ['Destruição Divina'],
    5: ['Convocar Montaria'],
  },
  // Clérigo, Feiticeiro, Guardião (fora de Inimigo Favorito), Guerreiro,
  // Ladino, Mago, Monge: a única prosa da classe com "sempre"+"preparad"
  // é a genérica de Conjuração (ou, no caso do Mago, "Maestria de
  // Magias"/"Assinatura Mágica", níveis 18 e 20 -- "Escolha uma magia...
  // Você sempre tem essas magias preparadas": a magia é ESCOLHA do
  // jogador, sem nome fixo no livro, mesmo padrão de "Versado em
  // Abjuração" -- não nomeia magia nenhuma e por isso não entra aqui).
};

// ============================================================
// Plano 3 -- catálogo de ESCOLHAS e PROFICIÊNCIAS das 241 características de
// subclasse (Informacoes Separadas/Classes.md), em CINCO listas.
//
// EMENDA DE 2026-08-17 (task-2-brief.md do plano
// "2026-08-17-regras-subclasses-3-escolhas" descrevia só DUAS categorias --
// construção × em jogo. A leitura do livro provou isso insuficiente: uma
// característica automática (sem pergunta nenhuma) forçada em "construção"
// produz lacuna falsa ("o app não pergunta X"), e uma passiva numérica
// forçada em qualquer categoria de escolha produz a mesma lacuna falsa na
// direção oposta. Por isso são QUATRO listas -- ver a tabela completa na
// amenda do prompt desta tarefa, repetida em síntese abaixo:
//   - ESCOLHAS_SUBCLASSE             -- "à sua escolha", resultado fica na
//     ficha (o app pede -- pendência -- ou concede; e o campo cresce).
//   - CONCESSOES_AUTOMATICAS_SUBCLASSE -- "Você adquire proficiência em X",
//     sem escolha nenhuma; o campo cresce, mas NENHUMA pendência é exigida.
//   - ESCOLHAS_EM_JOGO               -- alvo, direção, tipo de dano, ou
//     opção entre efeitos nomeados, decididos na hora do uso; nada persiste
//     na ficha entre usos (ou persiste só até o próximo Descanso/turno, sem
//     virar um campo de personagem estável). Chave "<Subclasse>|<nível>|
//     <Nome>", valor = motivo com citação.
//   - PASSIVOS_FORA_DESTE_MOTOR      -- efeito numérico passivo (bônus fixo
//     a um teste, não proficiência nem escolha) -- domínio do motor de
//     passivas de subclasse (Plano 4), não deste catálogo.
//
// CORREÇÃO DE 2026-08-17 (rodada de revisão do coordenador, mesmo dia):
// a leitura inicial produziu uma QUINTA lista implícita, sem nome --
// ESCOLHAS_COSMETICAS, separada abaixo -- e uma falha real: `campoEsperado`
// tinha nomes de campo INVENTADOS (sete sub-chaves de `escolhas_classe.*`
// que não existem em `site/js/`), o que transforma o motor em medidor de
// arquitetura do app em vez de comportamento -- o erro nº 1 do
// GUIA-PROXIMOS-DOMINIOS.md, o mesmo que gerou 31 lacunas falsas na rodada
// de Talentos. Corrigido conforme a tabela "o app usa outro nome interno →
// erro de catálogo → corrigir o catálogo": todo `campoEsperado` que sobra
// abaixo foi conferido com `grep -ro "<campo>" site/js/ | wc -l` (contagem
// no relatório da correção); os que não bateram viraram `campoEsperado:
// null` com uma `observacao` explicando a ausência.
//   - ESCOLHAS_COSMETICAS            -- escolha real do livro ("escolha ou
//     determine aleatoriamente"), mas puramente descritiva: não muda número
//     nem opção disponível ao jogador (aparência, manifestação, formato de
//     um objeto de cena). Cobrar pendência aqui produziria lacuna falsa --
//     o livro deixa escolher um sabor, e um app que não pergunta não viola
//     regra nenhuma. Mesma forma de ESCOLHAS_EM_JOGO (chave "<Subclasse>|
//     <nível>|<Nome>", valor = motivo com citação).
//
// ESCOPO: só entram aqui as características cujo texto menciona uma escolha
// (a palavra "escolha"/"à sua escolha", ou uma enumeração explícita "um(a)
// d[oa]s seguintes ..." com opções nomeadas) OU concede proficiência OU
// concede conhecimento de magia/truque com uma escolha embutida. As 241
// características foram lidas por inteiro (não por regex); a maioria não
// menciona nada disso e por isso não aparece em nenhuma das cinco listas
// -- a invariante cobrada (por teste automático desde a correção pós-revisão
// de 2026-08-18, MENOR 6 -- "as cinco listas cobrem cada característica em
// exatamente uma", subclasses-escolhas.test.mjs) é só que TODA característica
// que MENCIONA escolha ou proficiência esteja em exatamente uma das cinco
// (exceto a dupla legítima, Andarilho Feérico|3|Glamour Transcendental), não
// que as 241 apareçam.
//
// REGRA DURA: cada `livro`/motivo cita `Classes.md:<linha>` da FRASE que
// contém a escolha/proficiência, não da linha do heading `### Nível N: ...`.
// ============================================================

// Escolhas de CONSTRUÇÃO que o livro exige: o jogador decide, e o resultado
// fica na ficha. `campoEsperado` é uma DICA de onde o resultado deveria
// aparecer -- NÃO é uma alegação de que o app DEVA usar esse nome de campo
// (mesmo estatuto que o campo `efeito` tem em classes-passivas.mjs, que o
// README já declara decorativo em 9 dos 11 blocos). Cada nome usado abaixo
// (`pericias_proficientes`, `proficiencias_ferramentas`, `magias_conhecidas`,
// `magias_preparadas`, `grimorio`, `manobras_conhecidas`, `resistencias`,
// `salvaguardas_proficientes`, `proficiencias_extra`,
// `escolhas_classe.estilo_luta`, `recursos.aspecto_selvagem`,
// `recursos.bruxo.subclasses.infero.resistencia_infera_escolha`,
// `recursos.feiticeiro.subclasses.draconica.afinidade_elemental`,
// `recursos.guardiao.subclasses.cacador.presa_escolha`,
// `recursos.guardiao.subclasses.cacador.taticas_escolha`,
// `recursos.guardiao.subclasses.feras.companheiro_tipo`,
// `recursos.mago.subclasses.adivinhador.terceiro_olho_escolha`) foi
// CONFERIDO com `grep -rn "<campo>" site/js/` antes de ficar aqui --
// evidência (arquivo:linha) na `observacao` de cada entrada. Onde a
// característica é mecanicamente real mas o app não tem NENHUM campo
// persistido para ela (confirmado pelo mesmo grep, contagem zero),
// `campoEsperado` é `null` e uma `observacao` documenta a ausência com a
// evidência -- isso não é desistir da asserção: o motor consumidor compara
// o personagem inteiro antes/depois do nível quando `campoEsperado` é
// `null`, em vez de olhar um campo específico (regra combinada com o
// coordenador nesta correção).
//
// MÉTODO (IMPORTANTE 2 da revisão independente de 2026-08-18): uma conclusão
// "não existe campo persistido" só vale alguma coisa se a busca negativa que
// a sustenta foi feita pelo BENEFÍCIO que o livro concede, não por um nome de
// campo CHUTADO. O caso que expôs isso: Treinamento Marcial (Colégio da
// Bravura) grepava `proficiencias_armas` -- um nome inventado, nunca escrito
// em lugar nenhum -- e concluiu "proficiência com categoria de arma não é
// dado variável guardado no app", quando o app guarda esse benefício sob um
// nome completamente diferente (`proficiencias_extra`, ver a entrada em
// CONCESSOES_AUTOMATICAS_SUBCLASSE, mais abaixo). A pergunta certa não é
// "existe uma variável chamada X?" -- é "onde o app grava ESTE benefício,
// para QUALQUER personagem que já o tenha por qualquer origem (mesmo uma
// diferente da característica em questão)?": Clérigo Protetor e Druida
// Protetor concedem "Armas Marciais"/"Armadura Média"/"Armadura Pesada" pelo
// mesmo mecanismo que Treinamento Marcial precisaria, então grepar o BENEFÍCIO
// ("proficiência com armas Marciais", "armadura Média") em vez do nome de
// campo acha o consumidor real (site/js/regras-equipamento.js,
// site/js/sheet/ficha.js, site/js/sheet/impressao.js) antes de declarar
// ausência. Toda `observacao` que conclui "não existe campo" precisa citar a
// busca pelo BENEFÍCIO (não só pelo nome adivinhado) que sustenta essa
// conclusão.
//
// CORREÇÃO CRÍTICA (revisão independente de 2026-08-17, achado CRÍTICO 1):
// seis entradas (Aspecto dos Selvagens, Resistência Ínfera, Afinidade
// Elemental, Presa do Caçador, Táticas Defensivas, Companheiro Primal)
// tinham `campoEsperado: null` (ou um nome errado, `resistencias`) porque a
// correção anterior grepou uma chave snake_case INVENTADA em vez do campo
// real -- e concluiu "nenhum mecanismo existe" sobre um mecanismo que
// existe de verdade, só que gravado por `char.recursos.*`. As seis foram
// corrigidas para o campo REAL (grep -rn na `observacao` de cada uma). As
// seis (mais `recursos.mago.subclasses.adivinhador.terceiro_olho_escolha`,
// já correta desde a Task 3) compartilham um LIMITE de verdade, não uma
// ausência de mecanismo: `char.recursos` só é criado pela FICHA
// (site/js/sheet/*.js, sob demanda, quando o jogador interage com o
// controle na tela) -- nunca por `criarPersonagemVazio()`
// (site/js/store.js:236-317) nem por nenhuma linha de site/js/levelup.js.
// O motor comportamental (subclasses-escolhas.test.mjs, Grupo 6) reconhece
// essa classe de campo -- ver o helper de "campo fora do esquema desta
// rota" nesse arquivo -- e não a confunde com "o app não implementa nada".
//
// Uma característica com DUAS escolhas de tipos diferentes (ex.: ferramenta
// E perícia em Estudioso da Guerra) vira DUAS entradas. Uma escolha que
// cresce em níveis seguintes (ex.: mais manobras em 7/10/15) permanece UMA
// entrada no nível em que a característica é adquirida, com o crescimento
// anotado no `livro`, porque SUBCLASSES_CARACTERISTICAS só indexa essa
// característica uma vez, nesse nível.
export const ESCOLHAS_SUBCLASSE = {
  'Colégio do Conhecimento': [
    { nivel: 3, caracteristica: 'Proficiências Bônus', oQue: 'perícia',
      quantidade: 3, campoEsperado: 'pericias_proficientes',
      livro: 'Classes.md:766 -- "Você adquire proficiência em três perícias à sua escolha."' },
    { nivel: 6, caracteristica: 'Descobertas Mágicas', oQue: 'magia',
      quantidade: 2, campoEsperado: 'magias_preparadas',
      livro: 'Classes.md:770 -- "Você aprende duas magias à sua escolha... Você sempre tem as magias escolhidas preparadas."' },
  ],
  'Mestre da Batalha': [
    { nivel: 3, caracteristica: 'Estudioso da Guerra', oQue: 'ferramenta de artesão',
      quantidade: 1, campoEsperado: 'proficiencias_ferramentas',
      livro: 'Classes.md:4061 -- "Você adquire proficiência com um tipo de Ferramentas de Artesão à sua escolha..."' },
    { nivel: 3, caracteristica: 'Estudioso da Guerra', oQue: 'perícia',
      quantidade: 1, campoEsperado: 'pericias_proficientes',
      livro: 'Classes.md:4061 -- "...e adquire proficiência em uma perícia à sua escolha das perícias disponíveis para Guerreiros no nível 1." (segunda escolha da MESMA característica -- entrada própria)' },
    { nivel: 3, caracteristica: 'Superioridade em Combate', oQue: 'manobra',
      quantidade: 3, campoEsperado: 'manobras_conhecidas',
      livro: 'Classes.md:4067 -- "Você aprende três manobras à sua escolha..." (cresce +2 manobras à escolha nos níveis 7, 10 e 15 -- Classes.md:4069 -- mesma característica, mesma entrada, pois SUBCLASSES_CARACTERISTICAS só indexa "Superioridade em Combate" no nível 3)' },
  ],
  'Trilha do Coração Selvagem': [
    { nivel: 6, caracteristica: 'Aspecto dos Selvagens', oQue: 'opção (Coruja, Pantera ou Salmão)',
      quantidade: 1, campoEsperado: 'recursos.aspecto_selvagem',
      observacao: 'Campo REAL, gravado por site/js/sheet/classes/barbaro.js:245 ("char.recursos.aspecto_selvagem = e.target.value || null"). LIMITE DECLARADO: `char.recursos` não é criado em nenhum ponto do caminho `subirDeNivel` (site/js/store.js:236-317 -- `criarPersonagemVazio()` não tem chave `recursos`; nenhuma linha de site/js/levelup.js atribui `personagem.recursos`) -- só a FICHA (o handler acima) cria `char.recursos = {}` sob demanda. O motor comportamental (Grupo 6) reconhece essa classe de campo e não a trata como "app sem mecanismo": ver `CAMINHO_FORA_DO_MOTOR` no motor.',
      livro: 'Classes.md:267 -- "Você recebe uma das seguintes opções à sua escolha. Sempre que completar um Descanso Longo, você pode alterar sua escolha." -- CASO-LIMITE do brief: escolha refeita a cada Descanso Longo é construção persistida temporariamente, não em jogo.' },
  ],
  'Patrono Ínfero': [
    { nivel: 10, caracteristica: 'Resistência Ínfera', oQue: 'tipo de dano',
      quantidade: 1, campoEsperado: 'recursos.bruxo.subclasses.infero.resistencia_infera_escolha',
      observacao: 'CORREÇÃO (revisão independente de 2026-08-17, CRÍTICO 1): a versão anterior citava `campoEsperado: \'resistencias\'` e concluía "nenhum mecanismo existe" por grep de uma chave snake_case inventada -- falso. O campo REAL é `recursos.bruxo.subclasses.infero.resistencia_infera_escolha`, gravado por site/js/sheet/habilidades.js:375 ("char.recursos.bruxo.subclasses.infero.resistencia_infera_escolha = el.value"). LIMITE DECLARADO: mesmo caso de Aspecto dos Selvagens acima -- `char.recursos` não existe no caminho `subirDeNivel`, só na ficha.',
      livro: 'Classes.md:1467 -- "Ao completar um Descanso Curto ou Longo, escolha um tipo de dano, exceto Energético. Você tem Resistência a esse tipo de dano até escolher um tipo de dano diferente com esta característica." -- mesmo padrão do Círculo da Terra: refeita a cada descanso, mas persistida até a próxima troca.' },
  ],
  'Feitiçaria Dracônica': [
    { nivel: 6, caracteristica: 'Afinidade Elemental', oQue: 'tipo de dano (Ácido, Elétrico, Gélido, Ígneo ou Venenoso)',
      quantidade: 1, campoEsperado: 'recursos.feiticeiro.subclasses.draconica.afinidade_elemental',
      observacao: 'CORREÇÃO (revisão independente de 2026-08-17, CRÍTICO 1): a versão anterior citava `campoEsperado: \'resistencias\'` e concluía "nenhum mecanismo existe" -- falso. O campo REAL é `recursos.feiticeiro.subclasses.draconica.afinidade_elemental`, gravado por site/js/sheet/habilidades.js:880 ("char.recursos.feiticeiro.subclasses.draconica.afinidade_elemental = ...value"). LIMITE DECLARADO: mesmo caso das duas entradas acima -- campo só existe via ficha, não via `subirDeNivel`.',
      livro: 'Classes.md:3080 -- "Escolha um desses tipos: Ácido, Elétrico, Gélido, Ígneo ou Venenoso." -- sem "sempre que" ou "a cada descanso": escolha única e permanente a partir do nível 6.' },
  ],
  'Círculo da Terra': [
    { nivel: 3, caracteristica: 'Magias do Círculo da Terra', oQue: 'tipo de terreno (árido, polar, temperado ou tropical)',
      quantidade: 1, campoEsperado: null,
      observacao: 'grep -ro "terreno_circulo_terra\\|escolhas_classe.*terreno" site/js/ | wc -l => 0. Não existe campo persistido para o terreno escolhido; a asserção compara o personagem inteiro antes/depois do nível.',
      livro: 'Classes.md:2406 -- "Sempre que completar um Descanso Longo, escolha um tipo de terreno: árido, polar, temperado ou tropical." -- CASO-LIMITE citado no próprio brief (Interfaces): mesma característica já coberta em SUBCLASSES_MAGIA_POR_ESCOLHA (Plano 2, conteúdo das magias); esta entrada cobre a PENDÊNCIA da escolha em si, domínio deste plano.' },
  ],
  'Caçador': [
    { nivel: 3, caracteristica: 'Presa do Caçador', oQue: 'opção (Assassino de Colossos ou Destruidor de Hordas)',
      quantidade: 1, campoEsperado: 'recursos.guardiao.subclasses.cacador.presa_escolha',
      observacao: 'CORREÇÃO (revisão independente de 2026-08-17, CRÍTICO 1): a versão anterior grepou "presa_do_cacador" (chave inventada, 0 ocorrências) e concluiu "nenhum mecanismo existe" -- falso. O campo REAL é `recursos.guardiao.subclasses.cacador.presa_escolha`, gravado por site/js/sheet/habilidades.js:428 ("char.recursos.guardiao.subclasses.cacador.presa_escolha = el.value"). LIMITE DECLARADO: mesmo caso de Aspecto dos Selvagens -- `char.recursos` não existe no caminho `subirDeNivel`, só na ficha.',
      livro: 'Classes.md:3543 -- "Você recebe uma das seguintes opções de características à sua escolha. Ao completar um Descanso Curto ou Longo, você pode substituir a opção escolhida pela outra."' },
    { nivel: 7, caracteristica: 'Táticas Defensivas', oQue: 'opção (Defesa Contra Ataques Múltiplos ou Escapar de Hordas)',
      quantidade: 1, campoEsperado: 'recursos.guardiao.subclasses.cacador.taticas_escolha',
      observacao: 'CORREÇÃO (revisão independente de 2026-08-17, CRÍTICO 1): a versão anterior grepou "taticas_defensivas" (chave inventada, 0 ocorrências) -- falso. O campo REAL é `recursos.guardiao.subclasses.cacador.taticas_escolha`, gravado por site/js/sheet/habilidades.js:432 ("char.recursos.guardiao.subclasses.cacador.taticas_escolha = el.value"). LIMITE DECLARADO: mesmo caso acima -- campo só existe via ficha.',
      livro: 'Classes.md:3551 -- "Você recebe uma das seguintes opções de características à sua escolha. Ao completar um Descanso Curto ou Longo, você pode substituir a opção escolhida pela outra."' },
  ],
  'Senhor das Feras': [
    { nivel: 3, caracteristica: 'Companheiro Primal', oQue: 'bloco de estatísticas e tipo de animal da fera (Fera da Terra, do Céu ou do Mar)',
      quantidade: 1, campoEsperado: 'recursos.guardiao.subclasses.feras.companheiro_tipo',
      observacao: 'CORREÇÃO (revisão independente de 2026-08-17, CRÍTICO 1): a versão anterior grepou "companheiro_primal" (chave inventada, 0 ocorrências) -- falso. O campo REAL é `recursos.guardiao.subclasses.feras.companheiro_tipo`, gravado por site/js/sheet/habilidades.js:436 ("char.recursos.guardiao.subclasses.feras.companheiro_tipo = el.value"). LIMITE DECLARADO: mesmo caso das entradas do Caçador -- campo só existe via ficha, não via `subirDeNivel`.',
      livro: 'Classes.md:3573 -- "Escolha o bloco de estatísticas da fera: Fera da Terra, Fera do Céu ou Fera do Mar. Você também determina o tipo de animal..." -- persiste até ser trocada em um Descanso Longo (Classes.md:3581).' },
  ],
  'Andarilho Feérico': [
    { nivel: 3, caracteristica: 'Glamour Transcendental', oQue: 'perícia (Atuação, Enganação ou Persuasão)',
      quantidade: 1, campoEsperado: 'pericias_proficientes',
      livro: 'Classes.md:3480 -- "Você também adquire proficiência em uma dessas perícias à sua escolha: Atuação, Enganação ou Persuasão." -- a MESMA característica também concede um bônus numérico passivo (Classes.md:3478), que fica declarado em PASSIVOS_FORA_DESTE_MOTOR; as duas frases não podem ser fundidas numa só categoria sem enterrar uma das duas (ver self-review).' },
  ],
  'Campeão': [
    { nivel: 7, caracteristica: 'Estilo de Luta Adicional', oQue: 'estilo de luta',
      quantidade: 1, campoEsperado: 'escolhas_classe.estilo_luta',
      livro: 'Classes.md:3904 -- "Você adquire outro talento de Estilo de Luta à sua escolha."' },
  ],
  'Cavaleiro Místico': [
    { nivel: 3, caracteristica: 'Conjuração', oQue: 'truque da lista de magias de Mago',
      quantidade: 2, campoEsperado: 'magias_conhecidas',
      livro: 'Classes.md:3932 -- "Você conhece dois truques à sua escolha da lista de magias de Mago... Raio de Gelo e Toque Chocante são recomendados." (cresce +1 truque à escolha no nível 10 -- Classes.md:3934)' },
    { nivel: 3, caracteristica: 'Conjuração', oQue: 'magia de Mago de 1º círculo',
      quantidade: 3, campoEsperado: 'magias_preparadas',
      livro: 'Classes.md:3962 -- "Para começar, escolha três magias de 1º círculo da lista de magias de Mago. Escudo Arcano, Mãos Flamejantes e Salto são recomendadas." (segunda escolha da MESMA característica -- entrada própria; cresce em níveis seguintes conforme a tabela Conjuração de Cavaleiro Místico, Classes.md:3964)' },
  ],
  'Trapaceiro Arcano': [
    { nivel: 3, caracteristica: 'Conjuração', oQue: 'truque da lista de magias de Mago (além de Mãos Mágicas, que é automático)',
      quantidade: 2, campoEsperado: 'magias_conhecidas',
      livro: 'Classes.md:4459 -- "Você conhece três truques: Mãos Mágicas e dois outros truques à sua escolha da lista de magias de Mago... Ilusão Menor e Talho Mental são recomendadas." (cresce +1 truque à escolha no nível 10 -- Classes.md:4463; Mãos Mágicas em si já está coberto por SUBCLASSES_MAGIA_OUTRO_MECANISMO -- este plano cobre só a pendência dos DOIS truques à escolha)' },
    { nivel: 3, caracteristica: 'Conjuração', oQue: 'magia de Mago de 1º círculo',
      quantidade: 3, campoEsperado: 'magias_preparadas',
      livro: 'Classes.md:4467 -- "Para começar, escolha três magias de Mago de 1º círculo. Disfarçar-se, Enfeitiçar Pessoa e Névoa Obscurecente são recomendadas." (segunda escolha da MESMA característica -- entrada própria; cresce em níveis seguintes, Classes.md:4469)' },
  ],
  'Abjurador': [
    { nivel: 3, caracteristica: 'Versado em Abjuração', oQue: 'magia de Mago da escola de Abjuração (2º círculo ou inferior)',
      quantidade: 2, campoEsperado: 'grimorio',
      livro: 'Classes.md:4978 -- "Escolha duas magias de Mago da escola de Abjuração, cada uma deve ser de 2º círculo ou inferior e adicione-as gratuitamente ao seu livro de magias." (cresce +1 magia à escolha a cada novo círculo de espaços de magia -- mesmo parágrafo)' },
  ],
  'Adivinhador': [
    { nivel: 3, caracteristica: 'Versado em Adivinhação', oQue: 'magia de Mago da escola de Adivinhação (2º círculo ou inferior)',
      quantidade: 2, campoEsperado: 'grimorio',
      livro: 'Classes.md:5010 -- "Escolha duas magias de Mago da escola de Adivinhação, cada uma deve ser de 2º círculo ou inferior, e adicione-as gratuitamente ao seu livro de magias." (mesmo padrão de crescimento de Versado em Abjuração)' },
    { nivel: 10, caracteristica: 'O Terceiro Olho', oQue: 'benefício (Compreensão Superior, Ver o Invisível ou Visão no Escuro)',
      quantidade: 1, campoEsperado: 'recursos.mago.subclasses.adivinhador.terceiro_olho_escolha',
      livro: 'Classes.md:5020 -- "escolha um dos seguintes benefícios, que dura até você iniciar um Descanso Curto ou Longo. Você não pode usar essa característica novamente até completar um Descanso Curto ou Longo." MOVIDA de ESCOLHAS_EM_JOGO na revisão independente de 2026-08-17: mesma cadência de Patrono Ínfero\'s Resistência Ínfera (uso gastado por Descanso, efeito persiste até o próximo Descanso Curto ou Longo, não só até o fim do turno/Fúria/forma ativa) -- por isso construção, não em jogo, apesar da ativação em si ser uma Ação Bônus. Campo REAL conferido em site/js/sheet/classes/mago.js:100,110 e site/js/sheet/habilidades.js:2068-2070 (grep -ro "terceiro_olho_escolha" site/js/ | wc -l => 8).' },
  ],
  'Evocador': [
    { nivel: 3, caracteristica: 'Versado em Evocação', oQue: 'magia de Mago da escola de Evocação (2º círculo ou inferior)',
      quantidade: 2, campoEsperado: 'grimorio',
      livro: 'Classes.md:5044 -- "Escolha duas magias de Mago da escola de Evocação, cada uma deve ser de 2º círculo ou inferior, e adicione-as gratuitamente ao seu livro de magias." (mesmo padrão de crescimento de Versado em Abjuração)' },
  ],
  'Ilusionista': [
    { nivel: 3, caracteristica: 'Versado em Ilusão', oQue: 'magia de Mago da escola de Ilusão (2º círculo ou inferior)',
      quantidade: 2, campoEsperado: 'grimorio',
      livro: 'Classes.md:5078 -- "Escolha duas magias de Mago da escola de Ilusão, cada uma deve ser de 2º círculo ou inferior e adicione-as gratuitamente ao seu livro de magias." (mesmo padrão de crescimento de Versado em Abjuração)' },
  ],
};

// Concessões AUTOMÁTICAS: o livro concede sem perguntar nada -- "Você
// adquire proficiência em X", sem "à sua escolha". Exigir pendência aqui
// produziria lacuna falsa ("o app não pergunta qual arma/armadura/perícia")
// para uma regra que o livro não manda perguntar; por isso não têm `oQue`.
export const CONCESSOES_AUTOMATICAS_SUBCLASSE = {
  'Colégio da Bravura': [
    { nivel: 3, caracteristica: 'Treinamento Marcial', quantidade: 3,
      campoEsperado: 'proficiencias_extra',
      observacao: 'CORREÇÃO (revisão independente de 2026-08-18, CRÍTICO 1 + IMPORTANTE 2): a versão anterior grepava o nome INVENTADO `proficiencias_armas` (0 ocorrências), concluía "não é dado variável guardado no app" e apontava `campoEsperado` para `proficiencias_armaduras` -- as duas coisas são falsas. `proficiencias_armaduras` (site/js/levelup.js:115) é só LIDO (checagem de pré-requisito de talento), nenhuma linha de site/js/ jamais ESCREVE nele -- campo morto para gravação, não o lugar onde esta concessão apareceria. O campo REAL onde o app grava proficiência extra de arma/armadura por categoria é `proficiencias_extra`: criado como `[]` por `store.criarPersonagemVazio()` (site/js/store.js:255), escrito com os literais \'Armas Marciais\'/\'Armadura Média\'/\'Armadura Pesada\' só por site/js/creator/wizard.js:453-460 (ramos de Clérigo Protetor e Druida Protetor -- a busca que confirma a ausência é pelo BENEFÍCIO, não pelo nome: `grep -rn "Treinamento Marcial" site/js/` => 0 ocorrências, e nenhum outro ponto de site/js/ empurra "Armas Marciais"/"Armadura Média"/"Escudo" para `proficiencias_extra`), e lido por site/js/regras-equipamento.js:17,74, site/js/sheet/ficha.js:579 e site/js/sheet/impressao.js:233. `CLASSES_INFO[\'Bardo\'].armaduras === [\'Leve\']` e `.armas === [\'Simples\']` (site/js/dados-classes.js:17-22) -- nenhuma rota do app soma Marcial/Média/Escudo a um Bardo Colégio da Bravura, em nível nenhum. Isto é uma divergência REAL confirmada (ver CAUSA_ESCOLHA_SUBCLASSE, Causa 3, em subclasses-escolhas.test.mjs), não uma impossibilidade arquitetural da rota -- diferente de `recursos.*` (ver comentário de RAIZES_FORA_DA_ROTA_SUBIRDENIVEL no motor), `proficiencias_extra` já existe em todo personagem desde `criarPersonagemVazio()` e está plenamente alcançável por `subirDeNivel`.',
      livro: 'Classes.md:704 -- "Você adquire proficiência com armas Marciais, armaduras Médias e treinamento com Escudos." -- três concessões nomeadas, nenhuma "à sua escolha".' },
  ],
  'Combatente da Misericórdia': [
    { nivel: 3, caracteristica: 'Implementos de Misericórdia', quantidade: 3,
      campoEsperado: 'pericias_proficientes',
      observacao: 'A parte de perícias (Intuição, Medicina) usa `pericias_proficientes` (grep -ro "pericias_proficientes" site/js/ | wc -l => 80). A parte do Kit de Herbalismo usa `proficiencias_ferramentas` (grep -ro "proficiencias_ferramentas" site/js/ | wc -l => 23) -- campo real, mas diferente do principal listado aqui.',
      livro: 'Classes.md:5330 -- "Você adquire proficiência nas perícias Intuição e Medicina e proficiência com o Kit de Herbalismo." -- três concessões nomeadas, nenhuma escolha.' },
  ],
  'Assassino': [
    { nivel: 3, caracteristica: 'Ferramentas de Assassino', quantidade: 2,
      campoEsperado: 'proficiencias_ferramentas',
      livro: 'Classes.md:4389 -- "Você adquire um Kit de Disfarce e um Kit de Veneno, e tem proficiência com eles." -- itens nomeados, nenhuma escolha.' },
  ],
  'Vigilante das Sombras': [
    { nivel: 7, caracteristica: 'Mente de Ferro', quantidade: 1,
      campoEsperado: 'salvaguardas_proficientes',
      livro: 'Classes.md:3734 -- "Você desenvolveu a capacidade de resistir a poderes que alteram a mente. Você adquire proficiência em salvaguardas de Sabedoria." -- AUTOMÁTICA COM RAMO CONDICIONAL (amenda desta tarefa): a frase seguinte -- "Se você já tem essa proficiência, adquire proficiência em salvaguardas de Carisma ou Inteligência (à sua escolha)" -- só vira escolha para quem JÁ tem proficiência em salvaguardas de Sabedoria por outra fonte, o que um Guardião puro não tem (as proficiências de salvaguarda de Guardião são Força e Destreza). Este catálogo NÃO afirma a escolha Carisma/Inteligência para o Guardião puro; registra só a condição. CORREÇÃO: `campoEsperado` era `proficiencias_salvaguardas` (0 ocorrências); o nome real é `salvaguardas_proficientes` (grep -ro "salvaguardas_proficientes" site/js/ | wc -l => 9 arquivos distintos).' },
  ],
  'Ilusionista': [
    { nivel: 3, caracteristica: 'Ilusões Aprimoradas', quantidade: 1,
      campoEsperado: 'magias_conhecidas',
      livro: 'Classes.md:5074 -- "Você também conhece o truque Ilusão Menor." -- AUTOMÁTICA COM RAMO CONDICIONAL, mesmo padrão de Mente de Ferro: "Se já o conhece, você aprende um truque de Mago diferente à sua escolha" só vira escolha se o Ilusionista já conhecer Ilusão Menor por outra fonte. CORREÇÃO: a versão anterior chamava essa pré-condição de "incomum", o que é falso -- Ilusão Menor está na lista de truques de Mago (Classes.md:4675) e é a escolha recomendada pelo livro para a característica irmã do Trapaceiro Arcano (Classes.md:4459), então é plausível e comum, não rara. A classificação não muda por isso: o livro condiciona o ramo a um fato que este catálogo não pode determinar por classe/subclasse sozinha (se o Mago específico já conhece Ilusão Menor por outra origem), então continua sem ser afirmado como pendência incondicional; só o parêntese sobre frequência estava errado.' },
  ],
};

// Escolhas COSMÉTICAS (ACHADO 2 da correção de 2026-08-17): o livro deixa o
// jogador escolher, mas a escolha não muda nenhum número nem nenhuma opção
// disponível ao jogador -- só aparência/manifestação de algo. Cobrar
// pendência aqui produziria lacuna falsa (o app não está descumprindo regra
// nenhuma ao não perguntar um sabor). Critério usado: "muda algum número ou
// alguma opção disponível ao jogador?" -- se não, é cosmética.
//
// ACHADO ESPECÍFICO sobre 'Feitiçaria Mecânica' (Manifestação da Ordem): o
// coordenador apontou que o app já implementa algo chamado
// `escolhas_classe.ordem_divina` / `escolhas_classe.ordem_primal` e propôs
// usá-los aqui. CONFERIDO e DESCARTADO -- `ordem_divina`/`ordem_primal` são
// a característica de NÍVEL 1 DA CLASSE BASE "Ordem Divina" (Clérigo,
// Classes.md:1562, opções Protetor/Taumaturgo) e "Ordem Primal" (Druida,
// Classes.md:2054), não a tabela "Manifestações da Ordem" da SUBCLASSE
// Feitiçaria Mecânica do Feiticeiro (Classes.md:3115-3127) -- são classes
// diferentes, características diferentes, mesmo nome "ordem" por
// coincidência temática. Usar esses campos aqui alegaria contra o campo
// errado. Ver observação na entrada abaixo.
export const ESCOLHAS_COSMETICAS = {
  'Andarilho Feérico|3|Magias do Andarilho Feérico':
    'Classes.md:3500 -- "Você também possui uma bênção feérica. Escolha-a na tabela de Dádivas de Faéria ou determine-a aleatoriamente." A tabela (Classes.md:3502-3511) só tem efeitos descritivos (borboletas ilusórias, flores no cabelo, cheiro de canela, chifres, mudança de cor de pele/cabelo) -- nenhuma linha muda número ou opção de jogo.',
  'Feitiçaria Mecânica|3|Magias Mecânicas':
    'Classes.md:3115 -- "consulte a tabela Manifestações da Ordem e escolha ou determine aleatoriamente a maneira como sua conexão com a ordem se manifesta enquanto você conjura suas magias de Feiticeiro." A tabela (Classes.md:3117-3126) só tem efeitos visuais (engrenagens espectrais, ponteiros de relógio nos olhos, brilho acobreado) -- nenhuma linha muda número ou opção de jogo. NÃO usa `ordem_divina`/`ordem_primal` -- ver nota acima sobre por que esses campos são de OUTRA característica, de OUTRA classe.',
  'Círculo das Estrelas|3|Mapa Estelar':
    'Classes.md:2491 -- "Você determina sua forma jogando na tabela Mapa Estelar ou escolhendo uma." A tabela (Classes.md:2497-2506) só descreve o objeto físico (pergaminho, tabuleta de pedra, pele de urso-coruja) -- os efeitos mecânicos de Mapa Estelar (magias sempre preparadas, usos de Raio Guia) não dependem do formato escolhido.',
};

// Escolhas EM JOGO: alvo, direção, tipo de dano, ou uma opção entre efeitos
// nomeados, decididos no momento do uso (ataque, conjuração, reação) --
// nada persiste na ficha entre usos, ou persiste só até o fim do turno/da
// Fúria/da forma ativa, nunca virando um campo estável de personagem.
// Cobrar que o app pergunte e grave isso produziria lacuna falsa. Chave
// "<Subclasse>|<nível>|<Nome>", valor = motivo com citação.
//
// CRITÉRIO DE FRONTEIRA (adicionado na revisão independente de 2026-08-17,
// depois de Adivinhador|10|O Terceiro Olho ter sido encontrado do lado
// errado): a pergunta não é "a ativação é limitada a um uso por Descanso?",
// é "o EFEITO da escolha persiste até o próximo Descanso, ou só até o fim
// do turno/da Fúria/da forma ativa?" Uma característica pode gastar um uso
// por Descanso (como O Terceiro Olho, ou como Baluarte de Energia abaixo) e
// ainda assim ser EM JOGO, se o efeito escolhido dura só minutos/um turno.
// Só quando o efeito escolhido dura ATÉ O PRÓXIMO DESCANSO é que a escolha
// vira construção (mesmo padrão de Resistência Ínfera) -- porque só nesse
// caso a escolha é algo que fica "verdadeiro sobre o personagem" por tempo
// suficiente para caber num campo da ficha, em vez de ser consumida no
// próprio uso.
export const ESCOLHAS_EM_JOGO = {
  'Trilha da Árvore do Mundo|3|Vitalidade da Árvore':
    'Classes.md:199 -- "Força Revigorante. No início de cada um dos seus turnos enquanto sua Fúria estiver ativa, você pode escolher outra criatura a até 3 metros de você para receber Pontos de Vida Temporários.": alvo escolhido a cada turno enquanto a Fúria está ativa, nada persiste além do turno. Achado na revisão independente de 2026-08-17 (estava fora de todas as cinco listas na versão anterior).',
  'Trilha da Árvore do Mundo|14|Percorrer a Árvore':
    'Classes.md:215 -- "Cada criatura se teleporta para um espaço desocupado à sua escolha a até 3 metros do seu destino.": espaço de destino escolhido no momento do teleporte, nada persiste.',
  'Trilha do Berserker|14|Presença Intimidante':
    'Classes.md:239 -- "cada criatura à sua escolha em uma Emanação de 9 metros originada de você": alvos escolhidos no momento de usar a Ação Bônus.',
  'Trilha do Coração Selvagem|3|Fúria dos Selvagens':
    'Classes.md:257 -- "Sempre que você ativar sua Fúria, adquire uma das seguintes opções à sua escolha." (Águia/Lobo/Urso): refeita a CADA ativação de Fúria (não a cada Descanso Longo, ao contrário de Aspecto dos Selvagens no nível 6 da mesma subclasse), nada persiste entre Fúrias.',
  'Trilha do Coração Selvagem|14|Poder dos Selvagens':
    'Classes.md:281 -- "Sempre que você ativar sua Fúria, recebe uma das seguintes opções à sua escolha." (Carneiro/Falcão/Leão): mesmo padrão de Fúria dos Selvagens -- refeita a cada ativação de Fúria.',
  'Trilha do Fanático|3|Fúria Divina':
    'Classes.md:307 -- "O dano adicional é do tipo Necrótico ou Radiante, à sua escolha, cada vez que causar dano.": tipo de dano escolhido a cada acerto.',
  'Trilha do Fanático|10|Presença Zelosa':
    'Classes.md:315 -- "Até dez outras criaturas à sua escolha a até 18 metros de você": alvos escolhidos no momento de usar a Ação Bônus.',
  'Colégio da Bravura|3|Inspiração em Combate':
    'Classes.md:696 -- "uma criatura que possui um dado de Inspiração de Bardo seu pode utilizá-lo para um dos seguintes efeitos" (Defensivo/Ofensivo): escolhida pela criatura no momento de gastar o dado, nada persiste.',
  'Colégio da Dança|6|Movimento Inspirador':
    'Classes.md:744 -- "um aliado à sua escolha a até 9 metros de você também pode se mover": alvo escolhido no momento de executar a Reação.',
  'Colégio do Glamour|3|Magia Fascinante':
    'Classes.md:788 -- "o alvo tem a condição Amedrontado ou Enfeitiçado (à sua escolha) por 1 minuto": condição escolhida no momento de conjurar a magia de Encantamento ou Ilusão.',
  'Colégio do Glamour|3|Manto de Inspiração':
    'Classes.md:794 -- "Escolha um número de criaturas a até 18 metros de você igual ao seu modificador de Carisma": alvos escolhidos no momento de usar a Ação Bônus.',
  'Patrono Arquifada|3|Passos Feéricos':
    'Classes.md:1322 -- "ao conjurar essa magia, você pode escolher um dos seguintes efeitos adicionais" (Passo Provocante/Passo Revigorante): escolhido a cada conjuração de Passo Nebuloso.',
  'Patrono Arquifada|6|Fuga em Névoa':
    'Classes.md:1336 -- "Criaturas a até 1,5 metro do espaço que você deixou ou do espaço em que você aparece (à sua escolha)": escolha de qual dos dois espaços feita a cada uso de Passo Terrível.',
  'Patrono Celestial|10|Resiliência Celestial':
    'Classes.md:1379 -- "escolha até cinco criaturas à sua vista quando receber os pontos": alvos escolhidos a cada vez que a característica é acionada.',
  'Patrono Celestial|14|Vingança Calcinante':
    'Classes.md:1383 -- "Cada criatura à sua escolha que esteja a até 9 metros da criatura sofre dano Radiante": alvos escolhidos no momento de usar a Reação.',
  'Patrono O Grande Antigo|3|Mente Desperta':
    'Classes.md:1412 -- "escolha uma criatura à sua vista a até 9 metros de você": alvo do vínculo telepático escolhido a cada uso da Ação Bônus.',
  'Patrono O Grande Antigo|10|Danação Mística':
    'Classes.md:1424 -- "Ao conjurar Danação e escolher um atributo, o alvo também tem Desvantagem nas salvaguardas do atributo escolhido pela duração da magia.": o atributo é escolhido a cada conjuração da magia Danação (a escolha é do próprio feitiço, não desta característica em separado), nada persiste entre conjurações. Achado na revisão independente de 2026-08-17.',
  'Domínio da Luz|3|Brilho do Amanhecer':
    'Classes.md:1846 -- "cada criatura à sua escolha nessa área deve realizar uma salvaguarda de Constituição": alvos escolhidos no momento de usar a característica.',
  'Domínio da Trapaça|3|Bênção do Trapaceiro':
    'Classes.md:1902 -- "você pode escolher a si ou a uma criatura voluntária a até 9 metros de você para ter Vantagem": alvo escolhido a cada uso.',
  'Domínio da Trapaça|17|Duplicidade Aprimorada':
    'Classes.md:1924 -- "você ou uma criatura à sua escolha a até 1,5 metro dela recupera um número de Pontos de Vida": alvo escolhido quando a ilusão termina.',
  'Domínio da Vida|3|Preservar a Vida':
    'Classes.md:1953 -- "Escolha criaturas Sangrando a até 9 metros de você... e divida esses Pontos de Vida entre elas.": alvos e divisão escolhidos no momento de usar Canalizar Divindade.',
  'Círculo da Lua|6|Formas Animais dos Círculos Druídicos Aprimorada':
    'Classes.md:2374 -- "Cada um de seus ataques na Forma Selvagem pode causar seu tipo de dano normal ou dano Radiante. Você escolhe cada vez que acerta com esses ataques.": tipo de dano escolhido a cada acerto.',
  'Círculo da Terra|3|Auxílio da Terra':
    'Classes.md:2400 -- "Cada criatura à sua escolha na Esfera deve realizar uma salvaguarda... Uma criatura à sua escolha na área restaura 2d6 Pontos de Vida.": alvos escolhidos no momento de usar a característica.',
  'Círculo da Terra|6|Recuperação Natural':
    'Classes.md:2448 -- "ao completar um Descanso Curto, pode escolher recuperar espaços de magia gastos": decisão de QUAIS espaços recuperar, feita no momento do Descanso Curto; não é um campo de personagem que fique registrado (o resultado é só a quantidade de espaços disponíveis).',
  'Círculo das Estrelas|3|Forma Estrelada':
    'Classes.md:2481 -- "Sempre que você assumir sua forma estrelada, escolha qual das constelações a seguir brilha em seu corpo" (Arqueiro/Dragão/Taça): refeita a CADA ativação da Forma Estrelada (e, a partir do nível 10, pode mudar a cada turno -- Classes.md:2522), nada persiste entre ativações.',
  'Círculo do Mar|3|Ira do Mar':
    'Classes.md:2538 -- "você pode escolher outra criatura à sua vista na Emanação": alvo escolhido a cada Ação Bônus enquanto a Emanação está ativa.',
  'Feitiçaria Aberrante|3|Fala Telepática':
    'Classes.md:3010 -- "escolha uma criatura que esteja à sua vista e a até 9 metros de você": alvo do vínculo telepático escolhido a cada uso da Ação Bônus.',
  'Feitiçaria Aberrante|14|Revelação em Carne':
    'Classes.md:3037 -- "você adquire um dos seguintes benefícios à sua escolha, cujos efeitos duram até que a alteração termine": escolhido a cada ativação (dura só 10 minutos), nada persiste além disso.',
  'Feitiçaria Selvagem|3|Surto de Magia Selvagem':
    'Classes.md:3189 -- ex.: "Você e até três criaturas à sua escolha a até 9 metros de você têm a condição Invisível" (linha 3189), "Até três criaturas à sua escolha... sofrem 1d10 pontos de dano Necrótico" (linha 3199) e outras entradas da tabela 1d100 Surto de Magia Selvagem: alvos escolhidos no momento em que o resultado aleatório exige um alvo -- a escolha é sobre QUEM, nunca sobre QUAL efeito (esse é sorteado).',
  'Feitiçaria Selvagem|6|Distorcer a Sorte':
    'Classes.md:3206 -- "aplicar o resultado jogado como bônus ou penalidade (à sua escolha) no teste de d20": escolhido a cada uso da Reação.',
  'Feitiçaria Selvagem|18|Surto Controlado':
    'Classes.md:3214 -- "você pode criar um efeito à sua escolha da tabela Surto de Magia Selvagem em vez de jogar na tabela": efeito escolhido a cada conjuração com espaço de magia.',
  'Feitiçaria Mecânica|18|Cavalgada Mecânica':
    'Classes.md:3150 -- "Cura. Os espíritos restauram até 100 Pontos de Vida, divididos conforme você escolher entre qualquer número de criaturas à sua escolha no Cubo." e Classes.md:3152 "Dissipar... em criaturas e objetos à sua escolha no Cubo.": alvos e divisão escolhidos no momento de usar a característica.',
  'Andarilho Feérico|7|Detalhe Sedutor':
    'Classes.md:3517 -- "o alvo tem a condição Amedrontado ou Enfeitiçado (à sua escolha) por 1 minuto": condição escolhida a cada uso da Reação.',
  'Andarilho Feérico|15|Andarilho Nebuloso':
    'Classes.md:3529 -- "Essa criatura se teleporta para um espaço desocupado à sua escolha a até 1,5 metro do seu destino.": espaço escolhido a cada conjuração de Passo Nebuloso.',
  'Senhor das Feras|7|Treinamento Excepcional':
    'Classes.md:3684 -- "ela pode causar dano Energético ou o tipo de dano normal dela, à sua escolha": tipo de dano escolhido a cada acerto da fera.',
  'Vigilante das Sombras|11|Torrente do Vigilante':
    'Classes.md:3738 -- "ao usar o efeito Golpe Terrível... você pode causar um dos seguintes efeitos adicionais" (Golpe Repentino/Medo em Massa): escolhido a cada uso de Golpe Terrível.',
  'Combatente Psíquico|3|Poder Psiônico':
    'Classes.md:4023 -- "Movimento Telecinético... escolha um alvo à sua vista a até 9 metros de você": alvo escolhido a cada uso da ação Usar Magia.',
  'Combatente Psíquico|15|Baluarte de Energia':
    'Classes.md:4043 -- "Como uma Ação Bônus, você pode escolher criaturas, incluindo você mesmo, a até 9 metros, até um número de criaturas igual ao seu modificador de Inteligência (mínimo de uma criatura).": alvos escolhidos a cada uso da Ação Bônus; o efeito (Cobertura Parcial) dura só "1 minuto ou até você ter a condição Incapacitado" -- ao contrário de O Terceiro Olho (ESCOLHAS_SUBCLASSE), não persiste até o próximo Descanso. Achado na revisão independente de 2026-08-17 (estava fora de todas as cinco listas na versão anterior).',
  'Ladrão|3|Mão Leve':
    'Classes.md:4423 -- "Como uma Ação Bônus, você pode executar uma das seguintes coisas." (Prestidigitação/Usar Objeto): escolhido a cada Ação Bônus.',
  'Combatente da Mão Espalmada|3|Técnica da Mão Espalmada':
    'Classes.md:5298 -- "você pode impor um dos seguintes efeitos ao alvo" (Derrubar/Desorientar/Empurrar): escolhido a cada ataque da Torrente de Golpes.',
  'Combatente da Misericórdia|6|Toque de Médico':
    'Classes.md:5344 -- "Ao usar Mão de Cura, você também pode encerrar uma das seguintes condições na criatura que você curar": condição escolhida a cada uso de Mão de Cura.',
  'Adaga Espiritual|3|Poder Psiônico':
    'Classes.md:4349 -- "Sussurros Psíquicos... escolha até um número de criaturas igual ao seu Bônus de Proficiência que estejam à vista": alvos escolhidos a cada uso da ação Usar Magia.',
  'Evocador|6|Esculpir Magias':
    'Classes.md:5050 -- "você pode escolher um número delas igual a 1 mais o círculo da magia": criaturas protegidas escolhidas a cada conjuração de uma magia de Evocação.',
  'Adivinhador|3|Prodígio':
    'Classes.md:5004 -- "Você pode substituir qualquer Teste de D20 realizado por você ou por uma criatura à sua vista com uma dessas jogadas de previsão. Você deve escolher fazer isso antes da jogada do Teste de D20...": decisão de USAR ou não uma jogada de previsão, tomada a cada Teste de D20 (no máximo uma vez por turno); as próprias jogadas de previsão são um recurso consumível por Descanso Longo (2 ou 3 dados fixos, sem opções nomeadas entre as quais escolher), não uma escolha de construção. Achado na revisão independente de 2026-08-17 (estava fora de todas as cinco listas na versão anterior). NOTA: `Círculo da Terra|10|Proteção Natural` (Classes.md:2452) tem forma parecida mas fica corretamente FORA de todas as cinco listas -- não é uma escolha nova, só deriva do terreno já escolhido em Magias do Círculo da Terra (ESCOLHAS_SUBCLASSE).',
  'Ilusionista|14|Realidade Ilusória':
    'Classes.md:5094 -- "você pode escolher um objeto inanimado e não mágico que faça parte da ilusão": objeto escolhido a cada conjuração de uma magia de Ilusão.',
  'Combatente dos Elementos|3|Sintonia Elemental':
    'Classes.md:5410 -- "Ataques Elementais... você pode causar com ele, à sua escolha, dano Ácido, Elétrico, Gélido, Ígneo ou Trovejante": tipo de dano escolhido a cada Ataque Desarmado, enquanto a Sintonia estiver ativa.',
  'Combatente dos Elementos|6|Explosão Elemental':
    'Classes.md:5416 -- "Escolha um tipo de dano: Ácido, Elétrico, Gélido, Ígneo ou Trovejante.": escolhido a cada uso da ação Usar Magia.',
  'Combatente dos Elementos|17|Ápice Elemental':
    'Classes.md:5430 -- "Passo Destrutivo... qualquer criatura à sua escolha sofre dano... O tipo de dano fica à sua escolha" e Classes.md:5432 "Resistência a Dano... Você adquire Resistência a um dos seguintes tipos de dano à sua escolha... No início de cada um dos seus turnos, você pode alterar essa escolha.": alvo, tipo de dano do Passo Destrutivo e resistência mudam a cada turno -- mais frequente que qualquer caso de construção persistida deste catálogo, por isso em jogo.',
  'Juramento da Glória|3|Destruição Inspiradora':
    'Classes.md:5767 -- "distribuir Pontos de Vida Temporários para criaturas à sua escolha a até 9 metros de si... dividido entre as criaturas escolhidas, como preferir.": alvos e divisão escolhidos no momento de usar Canalizar Divindade.',
  'Juramento dos Anciões|3|A Ira da Natureza':
    'Classes.md:5867 -- "Cada criatura à sua escolha que você possa ver a até 4,5 metros de você deve ser bem-sucedida em uma salvaguarda de Força": alvos escolhidos no momento de usar Canalizar Divindade.',
};

// Características que este domínio declara fora de escopo por serem efeito
// numérico passivo (bônus fixo a um teste, não proficiência nem escolha
// persistida) -- domínio do motor de passivas de subclasse (Plano 4).
export const PASSIVOS_FORA_DESTE_MOTOR = {
  'Andarilho Feérico|3|Glamour Transcendental':
    'Classes.md:3478 -- "Sempre que você realiza um teste de Carisma, recebe um bônus no teste igual ao seu modificador de Sabedoria (mínimo de +1)." -- efeito numérico passivo, sem proficiência nem escolha. ATENÇÃO: a MESMA característica também tem uma frase de escolha de perícia (Classes.md:3480), que NÃO fica enterrada aqui -- tem entrada própria em ESCOLHAS_SUBCLASSE (Andarilho Feérico, Glamour Transcendental) porque enterrá-la nesta lista seria cobertura perdida em silêncio, o erro que o self-review deste plano proíbe.',
};

// ============================================================
// PLANO 4 -- Recurso / Uso / Recarga das 241 características de subclasse.
//
// Fonte: `Informacoes Separadas/Classes.md`, mesmas 48 subclasses de
// SUBCLASSES_CARACTERISTICAS. Cada uma das 241 entradas ali cai em
// EXATAMENTE uma das duas listas abaixo -- RECURSOS_SUBCLASSE (concede algo
// com número de usos limitado, ou recarga, ou ambos) ou
// SEM_RECURSO_SUBCLASSE (não concede). REGRA DURA de sempre: transcrito do
// LIVRO, nunca de `dados/classes/*.json`.
//
// ------------------------------------------------------------
// Campos de RECURSOS_SUBCLASSE
// ------------------------------------------------------------
//   nivel, caracteristica -- mesma chave de SUBCLASSES_CARACTERISTICAS.
//   usos     -- quantidade que o livro concede: número, fórmula
//     ('mod. Carisma (mín. 1)'), ou null para ilimitado (usado só quando o
//     limite real está no `recarga`/`livro`, como em Sobrecarga do Evocador).
//   recarga  -- 'curto' | 'longo' | 'curto-ou-longo' | 'outro' (gatilho
//     escrito no `livro`) | null.
//   base     -- 'custo-declarado' (o livro nomeia Ação/recurso/limite),
//     'ausencia-de-custo' (o livro é explícito quanto à ausência) ou
//     'julgamento' (leitura, não fato) -- mesmo enum de `classes-passivas.mjs`.
//     LÁ o campo varia nos três valores ao longo de 174 linhas (é dado que
//     carrega informação). AQUI ele é constante por construção, e por isso
//     NÃO prova nada sozinho: o próprio teste de admissão nesta lista É "o
//     livro declara um custo/limite preso à característica" -- relatar
//     "quase todas são custo-declarado" é a definição da lista se repetindo,
//     não um achado. Das 72 entradas abaixo, 71 são 'custo-declarado'; a
//     única exceção é Ilusionista|6|Criaturas Espectrais -- 'julgamento',
//     porque o livro é claro sobre A RECARGA (Descanso Longo) mas ambíguo
//     sobre O NÚMERO de usos (1 total ou 2, um por magia). O discriminador
//     que carrega informação de verdade neste catálogo é `composta` (ver
//     abaixo), não `base` -- achado da revisão independente de 2026-08-17.
//   composta -- true quando a característica empacota, sob um nome só,
//     cláusulas de natureza diferente: um trecho passivo ao lado do
//     limitado, várias sub-habilidades nomeadas, OU -- gatilho deliberado
//     para este campo, não um alargamento silencioso da definição -- uma
//     via ALTERNATIVA de recarga que gasta um recurso diferente do da
//     recarga principal (ex.: "não pode usar novamente até completar um
//     Descanso Longo, a menos que gaste um espaço de Magia de Pacto...").
//     As duas hipóteses recebem o mesmo `composta: true` pela mesma razão:
//     cada uma soma uma SEGUNDA alegação sobre o livro à alegação principal
//     da entrada, e uma entrada composta não sustenta lacuna sozinha --
//     mesmo tratamento de 'julgamento'. 45 das 72 entradas abaixo são
//     `composta: true`; as outras 27 têm uma única cláusula, sem ambiguidade
//     de natureza -- só essas 27 sustentam uma alegação sozinhas.
//   livro    -- cita `Classes.md:<linha>` da SENTENÇA que declara o
//     limite/custo (nunca da linha do heading `### Nível N: <Nome>`).
//   recargaTambemPor -- CAMPO NOVO (fix da revisão independente de
//     2026-08-18, Critical 1). Só existe quando `recarga: 'outro'` E o
//     próprio texto citado em `livro` admite, ao lado do gatilho principal,
//     um Descanso como via ALTERNATIVA de recarga ('curto'|'longo'|
//     'curto-ou-longo'). `recarga: 'outro'` documenta que o gatilho
//     PRINCIPAL não é um Descanso -- nunca documentou "nenhum Descanso
//     recarrega isto" (a versão anterior deste plano tratava as duas coisas
//     como sinônimas, produzindo uma falsa acusação contra Marés do Caos,
//     ver task-3-report.md, seção "Fix report"). Das entradas 'outro' deste
//     catálogo, só Marés do Caos tem essa via alternativa citável
//     (`recargaTambemPor: 'longo'` -- "...ou completar um Descanso Longo
//     antes de poder usar esta característica novamente").
//   ativa, ativaBase, ativaMotivo -- CAMPOS NOVOS (fix da revisão
//     independente de 2026-08-18, Critical 2/3), curados só nas 27 entradas
//     que já eram citáveis por `base`/`composta` (a pergunta de
//     ativa/passiva é DIFERENTE da pergunta de usos/recarga que `base`
//     responde aqui -- ver "CHAMADA JULGADA" abaixo -- por isso não dá para
//     reaproveitar `base` para as duas). `ativaBase` usa o MESMO enum de
//     `classes-passivas.mjs` (custo-declarado/ausencia-de-custo/julgamento),
//     mas respondendo à pergunta DAQUELE catálogo ("há uma frase de CUSTO
//     DE ATIVAÇÃO -- Ação/Ação Bônus/Reação/recurso nomeado/verbo de
//     decisão do jogador -- presa ao benefício sendo classificado?"), não à
//     pergunta deste ("o livro nomeia um limite?"). `ativa` é o
//     `ativa === (ativaBase === 'custo-declarado')` de `classes-passivas.mjs`
//     -- mesmo invariante. `ativaMotivo` cita a frase decisiva (mesma
//     característica de `livro`, geralmente o mesmo parágrafo; quando a
//     frase de ativação está numa sentença diferente da de recarga, a
//     citação de linha é a de `livro`, que aponta para o mesmo Classes.md
//     da característica). Das 27, 21 são `ativaBase: 'custo-declarado'`
//     (Ação/Ação Bônus/Reação declaradas, ou um verbo de decisão do jogador
//     -- "você pode conjurar/manipular/liberar/executar..." -- presos ao
//     próprio benefício); 5 são `ativaBase: 'julgamento'` (Concentração
//     Fanática, Surto de Magia Selvagem, Golpes Terríveis, Presa do Caçador
//     Superior, Implacável -- todas "uma vez por turno/Fúria ativa, você
//     pode causar/jogar X" sem custo nomeado nem Ação declarada, MESMO
//     padrão que `classes-passivas.mjs` classifica como julgamento para
//     Ataque Furtivo/Golpes Abençoados, ver nota cruzada acima na CHAMADA
//     JULGADA); 1 é `ativaBase: 'ausencia-de-custo'` (Sentinela Imortal --
//     gatilho inteiramente automático, "Ao ser reduzido a 0 Pontos de
//     Vida...", sem nenhum verbo de decisão do jogador; o "não pode
//     utilizá-la novamente até completar um Descanso Longo" limita a
//     FREQUÊNCIA de um efeito automático, não custeia uma escolha -- por
//     isso `ativaBase` diverge de `base` para esta entrada especificamente,
//     que continua `custo-declarado` para a pergunta de usos/recarga).
//
// ------------------------------------------------------------
// A REGRA DO "RECURSO JÁ EXISTENTE" (por que 41 das 171 características de
// SEM_RECURSO_SUBCLASSE que gastam Canalizar Divindade/Inspiração de
// Bardo/Forma Selvagem/Pontos de Feitiçaria/Ponto de Foco/Dado de Energia
// Psiônica/Golpe Astuto NÃO estão em RECURSOS_SUBCLASSE -- contagem
// corrigida na revisão independente de 2026-08-17: a versão anterior deste
// comentário dizia "~110", quase o triplo do valor real; ver
// task-2-report.md, seção "Fix report", para o script de contagem)
// ------------------------------------------------------------
// Muitas características de subclasse dizem "gaste um uso de seu Canalizar
// Divindade" (Clérigo/Paladino), "gaste um uso da sua Inspiração de Bardo"
// (Bardo), "gaste um uso de sua Forma Selvagem" (Druida), "gaste N Pontos
// de Feitiçaria" (Feiticeiro), "gaste 1 Ponto de Foco" (Monge) ou "gaste um
// Dado de Energia Psiônica" (Guerreiro/Ladino). Esses são recursos da
// CLASSE BASE, concedidos e contados em outro lugar (fora do escopo das 241
// características de subclasse deste catálogo). Uma característica de
// subclasse que apenas GASTA um recurso já existente, sem declarar seu
// próprio número de usos ou sua própria recarga, não "concede um recurso"
// no sentido deste plano -- ela consome um. Só entram em
// RECURSOS_SUBCLASSE as características que declaram um limite PRÓPRIO
// (um número de usos citável, ou uma frase "não pode usar novamente até
// completar um Descanso X" presa à própria característica), mesmo que essa
// característica também ofereça, como via alternativa, gastar um recurso
// já existente para restaurar esse uso próprio (aí sim -- `composta: true`
// -- porque a via alternativa é uma segunda alegação, sobre um recurso
// diferente).
//
// ------------------------------------------------------------
// A ARMADILHA DE "DESCANSO LONGO" -- as quatro formas, medidas
// ------------------------------------------------------------
// "Descanso Longo" ou "Descanso Curto" aparece em dezenas das 241
// descrições. Só uma das quatro formas abaixo é `recarga`:
//   1. RECARGA -- "não pode usar novamente até completar um Descanso X":
//      vira `recarga: 'curto'|'longo'|'curto-ou-longo'`.
//   2. JANELA/DURAÇÃO -- "dura até você completar um Descanso Longo" ou "ou
//      até usar esta característica novamente": o Descanso delimita a
//      DURAÇÃO de um efeito já em curso, não a disponibilidade de um novo
//      uso. Exemplos: Bênção do Trapaceiro (Clérigo), Bastião da Lei
//      (Feiticeiro).
//   3. RESET DE ESCOLHA -- "sempre que completar um Descanso Longo, você
//      pode alterar/substituir": não há contagem de usos que se esgota; há
//      uma escolha permanente que pode ser trocada no Descanso. Exemplos:
//      Aspecto dos Selvagens (Bárbaro), Resistência Ínfera (Bruxo), Magias
//      do Círculo da Terra (Druida -- já coberta como escolha em
//      SUBCLASSES_MAGIA_POR_ESCOLHA, plano 2), Táticas Defensivas
//      (Guardião), Companheiro Primal (Guardião -- troca de besta, não
//      contagem de uso). Presa do Caçador (Guardião, nível 3) TEM essa
//      mesma forma -- mas não é o único motivo de Descanso na
//      característica: uma das duas opções escolhíveis também declara "uma
//      vez por turno" (forma 1 disfarçada, ver CHAMADA JULGADA abaixo), por
//      isso a entrada inteira vai para RECURSOS_SUBCLASSE com `composta:
//      true`, não para esta lista.
//   4. GATILHO -- o Descanso apenas DISPARA um efeito automático, sem
//      limitar nenhum uso. Exemplo: Resiliência Celestial (Bruxo -- PV
//      Temporários "sempre que... completar um Descanso Curto ou Longo",
//      sem cap).
// As formas 2, 3 e 4 recebem `recarga: null` quando a característica
// aparece em RECURSOS_SUBCLASSE por outro motivo, ou vão inteiras para
// SEM_RECURSO_SUBCLASSE quando essa é a ÚNICA menção a Descanso na
// característica (é o caso das quatro citadas acima, e mais alguns). O
// relatório desta tarefa lista, à parte, cada uma dessas ocorrências.
//
// ------------------------------------------------------------
// CHAMADA JULGADA: "uma vez por turno" / "uma vez por [ativação de outro
// recurso]" sem custo declarado
// ------------------------------------------------------------
// Um pequeno grupo de características (Alma Radiante do Bruxo, Concentração
// Fanática do Bárbaro, Surto de Magia Selvagem do Feiticeiro, Golpes
// Terríveis, Presa do Caçador e Presa do Caçador Superior do Guardião,
// Implacável do Guerreiro, Mão de Dolo do Monge, parte de Ápice Elemental
// do Monge, parte de Forma Lunar do Druida, parte de Lenda Viva do
// Paladino) diz "uma vez em cada um dos seus turnos, você pode..." ou "uma
// vez por Fúria ativa, você pode...", sem gastar nenhum recurso nomeado.
// `classes-passivas.mjs` (Plano de Classes/Passivas) classifica o padrão
// idêntico de Ataque Furtivo/Golpe Divino como 'julgamento' -- mas aquele
// catálogo responde a uma pergunta diferente (há uma frase de CUSTO DE
// ATIVAÇÃO para decidir ativa/passiva?). Este catálogo responde "o livro
// nomeia um LIMITE?" -- e a própria definição de `base: 'custo-declarado'`
// deste plano diz "o livro nomeia... uma Ação, um recurso nomeado, OU UM
// LIMITE" (não exige que o limite tenha custo). "Uma vez em cada um dos
// seus turnos" é um limite citável e inequívoco. Por isso essas entradas
// ficam em RECURSOS_SUBCLASSE com `recarga: 'outro'` e o gatilho ("reinicia
// a cada turno seu" ou "reinicia a cada nova ativação da Fúria") escrito no
// `livro`. É uma leitura diferente da do catálogo irmão -- documentada aqui
// e, com a ponte recíproca, em `classes-passivas.mjs` -- não um erro de
// cópia.
//
// CONSISTÊNCIA CORRIGIDA (revisão independente de 2026-08-17): a versão
// anterior deste catálogo aplicava a regra acima a oito características,
// mas deixava Caçador|3|Presa do Caçador em SEM_RECURSO_SUBCLASSE com a
// MESMA frase ("Destruidor de Hordas. Uma vez em cada um dos seus turnos,
// você pode realizar outro ataque...", Classes.md:3547) rotulada como
// "frequência sem custo, não recurso desta característica" -- o cabeçalho
// afirmando uma regra e a entrada negando-a. Resolvido a favor do
// CABEÇALHO (não da entrada): Presa do Caçador foi para RECURSOS_SUBCLASSE,
// como as outras nove admitidas por esta mesma frase (as oito acima, mais
// Golpe Infalível dentro do bundle de Lenda Viva, Classes.md:5801). Não a
// direção oposta -- não fazia sentido reverter nove entradas já corretas
// (cada uma citando a MESMA forma de limite que Ápice Elemental e Lenda
// Viva, já corretamente classificadas) para desfazer uma única exceção mal
// classificada.
// ============================================================
export const RECURSOS_SUBCLASSE = {
  'Trilha da Árvore do Mundo': [
    { nivel: 14, caracteristica: 'Percorrer a Árvore', usos: 1, recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:215 -- "uma vez por Fúria, você pode aumentar o alcance desse teleporte..." (reinicia a cada nova ativação da Fúria); o teleporte básico da Ação Bônus (Classes.md:213), enquanto a Fúria está ativa, continua ilimitado.' },
  ],
  'Trilha do Berserker': [
    { nivel: 14, caracteristica: 'Presença Intimidante', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:241 -- "Uma vez que você usa essa característica, não pode usá-la novamente até completar um Descanso Longo, a menos que gaste um uso de sua Fúria (nenhuma ação é necessária) para restaurar o uso." (via alternativa gasta a Fúria, recurso da classe base).' },
  ],
  'Trilha do Fanático': [
    { nivel: 3, caracteristica: 'Campeão dos Deuses', usos: 4, recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma Ação Bônus, você pode gastar dados da reserva, jogá-los e recuperar..." -- Ação Bônus declarada.',
      livro: 'Classes.md:299,301 -- "você tem uma reserva de quatro d12s"; "Sua reserva restaura todos os dados gastos ao completar um Descanso Longo." O máximo cresce para 5 no nível 6, 6 no nível 12 e 7 no nível 17 de Bárbaro (Classes.md:303).' },
    { nivel: 6, caracteristica: 'Concentração Fanática', usos: 1, recarga: 'outro', base: 'custo-declarado',
      ativa: false, ativaBase: 'julgamento',
      ativaMotivo: '"Uma vez por Fúria ativa, se você falhar em uma salvaguarda, pode jogá-la novamente..." -- mesmo padrão de Ataque Furtivo/Golpes Abençoados (classes-passivas.mjs): "você pode" sem custo nomeado nem Ação/Ação Bônus/Reação declarada, só um limite de frequência.',
      livro: 'Classes.md:311 -- "Uma vez por Fúria ativa, se você falhar em uma salvaguarda, pode jogá-la novamente..." (reinicia a cada nova ativação da Fúria).' },
    { nivel: 10, caracteristica: 'Presença Zelosa', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:317 -- mesma frase de recarga de Presença Intimidante (Berserker): "não pode usá-la novamente até completar um Descanso Longo, a menos que gaste um uso de sua Fúria... para restaurar o uso."' },
    { nivel: 14, caracteristica: 'Fúria dos Deuses', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:321 -- "Uma vez que você use essa característica, não pode fazê-lo novamente até completar um Descanso Longo." Bundle: a forma dura 1 minuto ou até 0 PV (Classes.md:321), e a Revivificação dentro dela (Classes.md:327) gasta um uso separado de Fúria.' },
  ],
  'Colégio do Glamour': [
    { nivel: 3, caracteristica: 'Magia Fascinante', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:790 -- "Depois de usar este benefício, você não pode utilizá-lo novamente até completar um Descanso Longo. Você também pode restaurar um uso gastando uma Inspiração de Bardo."' },
    { nivel: 6, caracteristica: 'Manto de Majestade', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:804 -- "Após usar esta característica, você não pode utilizá-la novamente até completar um Descanso Longo. Você também pode restaurar seu uso gastando um espaço de magia de 3º círculo ou superior."' },
    { nivel: 14, caracteristica: 'Majestade Inquebrável', usos: 1, recarga: 'curto-ou-longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma Ação Bônus, você pode assumir uma presença majestosamente mágica..." -- Ação Bônus declarada.',
      livro: 'Classes.md:812 -- "Uma vez que você assume essa presença majestosa, não pode fazê-lo novamente até completar um Descanso Curto ou Longo."' },
  ],
  'Patrono Arquifada': [
    { nivel: 3, caracteristica: 'Passos Feéricos', usos: 'mod. Carisma (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Você pode conjurar Passo Nebuloso sem gastar um espaço de magia..." -- conjuração é ação do jogador, decisão de usar a característica.',
      // METADE FALTANTE DO CRITICAL 4 (fix da re-revisão de 2026-08-18): o
      // valor exibido na ficha NÃO vem de `detectarUsosMaximos` -- vem de um
      // ramo dedicado em `renderFeatureItem` (habilidades.js:3238-3243, `if
      // (ehArquifadaPassos...)`), que lê `estadoBruxoSub.passosFeericosMax`,
      // calculado em `sheet/classes/bruxo.js:127` (`modCar = Math.max(1,
      // calcMod(carisma))`) e atribuído em `:142`. Um vermelho do Grupo 2
      // nesta entrada seria sobre a heurística GENÉRICA, não sobre o que o
      // jogador vê -- a ficha já calcula certo, do estado do personagem.
      ramoDedicado: 'habilidades.js:3238-3243 (estadoBruxoSub.passosFeericosMax) <- bruxo.js:127,142',
      livro: 'Classes.md:1320 -- "Você pode conjurar Passo Nebuloso sem gastar um espaço de magia um número de vezes igual ao seu modificador de Carisma (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
    { nivel: 10, caracteristica: 'Defesas Sedutoras', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:1342 -- "Após executar esta Reação, você não pode usá-la novamente até completar um Descanso Longo, a menos que gaste um espaço de Magia de Pacto... para restaurar seu uso." Bundle: imunidade passiva à condição Enfeitiçado, sem custo (Classes.md:1340).' },
  ],
  'Patrono Celestial': [
    { nivel: 3, caracteristica: 'Luz Medicinal', usos: '1 + nível de Bruxo (dados de d6)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma Ação Bônus, você pode curar a si ou uma criatura..." -- Ação Bônus declarada.',
      livro: 'Classes.md:1356 -- "Você tem uma reserva de d6s... O número de dados na reserva é igual a 1 mais seu nível de Bruxo."; Classes.md:1358 -- "Sua reserva recupera todos os dados gastos ao completar um Descanso Longo."' },
    { nivel: 6, caracteristica: 'Alma Radiante', usos: 1, recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:1375 -- "Uma vez por turno, quando conjurar uma magia que cause dano Ígneo ou Radiante, você pode adicionar seu modificador de Carisma ao dano..." (reinicia a cada turno seu). Bundle: Resistência a Dano Radiante, passiva.' },
    { nivel: 14, caracteristica: 'Vingança Calcinante', usos: 1, recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode liberar energia radiante para salvar a criatura." -- verbo de decisão do jogador preso ao benefício.',
      livro: 'Classes.md:1385 -- "Você pode usar esta característica novamente após completar um Descanso Longo."' },
  ],
  'Patrono O Grande Antigo': [
    { nivel: 6, caracteristica: 'Combatente Clarividente', usos: 1, recarga: 'curto-ou-longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:1420 -- "Você pode usar esta característica novamente após completar um Descanso Curto ou Longo ou gastar um espaço de magia de Pacto... para restaurar seu uso."' },
  ],
  'Patrono Ínfero': [
    { nivel: 6, caracteristica: 'A Sorte do Próprio Tenebroso', usos: 'mod. Carisma (mín. 1), no máximo 1x por jogada', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode usar essa característica para adicionar 1d10 à sua jogada." -- "você pode usar" explícito.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3367-3373 (`if (ehInferoSorte...)`) lê
      // `estadoBruxoSub.sorteTenebrosoMax`, de `sheet/classes/bruxo.js:127,153`
      // (`modCar = Math.max(1, calcMod(carisma))`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:3367-3373 (estadoBruxoSub.sorteTenebrosoMax) <- bruxo.js:127,153',
      livro: 'Classes.md:1463 -- "Você pode usar essa característica um número de vezes igual ao seu modificador de Carisma (mínimo de uma vez), no máximo uma vez por jogada, e restaura todos os usos gastos ao completar um Descanso Longo." Cap por jogada registrado junto do total, mesmo tratamento de Emboscador das Sombras (corrigido na revisão independente de 2026-08-17, que apontou o cap ausente).' },
    { nivel: 14, caracteristica: 'Lançar no Inferno', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:1473 -- "Você pode usar esta característica novamente após completar um Descanso Longo, a menos que gaste um espaço de Magia de Pacto... para restaurar seu uso." Bundle: o gatilho em si é "Uma vez por turno" (Classes.md:1471 -- corrigido na revisão independente de 2026-08-17, que apontou 1469 como a linha do heading "### Nível 14: Lançar no Inferno", não da sentença).' },
  ],
  'Domínio da Guerra': [
    { nivel: 3, caracteristica: 'Sacerdote da Guerra', usos: 'mod. Sabedoria (mín. 1)', recarga: 'curto-ou-longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma Ação Bônus, você pode realizar um ataque com uma arma..." -- Ação Bônus declarada.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3599-3605 (`if (ehGuerraSacerdote...)`) lê
      // `estadoSubclassesClerigo.guerra.sacerdoteUsosMax`, de
      // `sheet/classes/clerigo.js:83,86` (`modSab = Math.max(1,
      // calcMod(sabedoria))`; `sacerdoteMax = modSab`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:3599-3605 (estadoSubclassesClerigo.guerra.sacerdoteUsosMax) <- clerigo.js:83,86',
      livro: 'Classes.md:1826 -- "Você pode usar essa Ação Bônus um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez). Você restaura todos os usos gastos ao completar um Descanso Curto ou Longo."' },
  ],
  'Domínio da Luz': [
    { nivel: 3, caracteristica: 'Labareda Protetora', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode executar uma Reação para impor Desvantagem..." -- Reação declarada.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3620-3626 (`if (ehLuzLabareda...)`) lê
      // `estadoSubclassesClerigo.luz.labaredaUsosMax`, de
      // `sheet/classes/clerigo.js:83,89` (`modSab = Math.max(1,
      // calcMod(sabedoria))`; `labaredaMax = modSab`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:3620-3626 (estadoSubclassesClerigo.luz.labaredaUsosMax) <- clerigo.js:83,89',
      livro: 'Classes.md:1852 -- "Você pode usar essa característica um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
    { nivel: 6, caracteristica: 'Labareda Protetora Aprimorada', usos: 'compartilha o total de Labareda Protetora (nível 3)', recarga: 'curto-ou-longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:1869 -- "Você restaura todos os usos gastos da sua Labareda Protetora ao completar um Descanso Curto ou Longo." (upgrade da recarga de Longo, no nível 3, para Curto ou Longo). Bundle: PV Temporários adicionais ao usar Labareda Protetora (Classes.md:1871).' },
    { nivel: 17, caracteristica: 'Coroa de Luz', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma ação Usar Magia, você emite uma aura de luz solar..." -- Ação declarada.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3627-3633 (`if (ehLuzCoroa...)`) lê
      // `estadoSubclassesClerigo.luz.coroaUsosMax`, de
      // `sheet/classes/clerigo.js:83,92` (`modSab = Math.max(1,
      // calcMod(sabedoria))`; `coroaMax = modSab`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:3627-3633 (estadoSubclassesClerigo.luz.coroaUsosMax) <- clerigo.js:83,92',
      livro: 'Classes.md:1877 -- "Você pode usar esta característica um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
  ],
  'Círculo da Lua': [
    { nivel: 10, caracteristica: 'Passo Lunar', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:2382 -- "Você pode usar essa característica um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo. Você também pode recuperar usos gastando um espaço de magia de 2º círculo ou superior."' },
    { nivel: 14, caracteristica: 'Forma Lunar', usos: 1, recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:2388 -- "Radiância Lunar Aprimorada. Uma vez por turno, você pode causar 2d10 pontos de dano Radiante adicional..." (reinicia a cada turno seu). Bundle: Luar Compartilhado (Classes.md:2390), extensão passiva de Passo Lunar, sem custo próprio.' },
  ],
  'Círculo da Terra': [
    { nivel: 6, caracteristica: 'Recuperação Natural', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:2446 -- "Você pode conjurar uma das magias... sem gastar um espaço de magia, e deve completar um Descanso Longo antes de fazê-lo novamente."; Classes.md:2448 -- "Após recuperar espaços de magia com esta característica, você não pode fazê-lo novamente até completar um Descanso Longo." Duas sub-habilidades distintas (conjuração grátis; recuperação de espaços em Descanso Curto), cada uma 1x/Descanso Longo.' },
  ],
  'Círculo das Estrelas': [
    { nivel: 3, caracteristica: 'Mapa Estelar', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...pode conjurá-la dessa forma..." (Raio Guia sem espaço de magia) -- conjuração é ação do jogador.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3454-3459 (`if (ehEstrelasMapa...)`) lê
      // `estadoDruidaSub.mapaEstelarMax`, de `sheet/classes/druida.js:60,76`
      // (`modSab = Math.max(1, calcMod(sabedoria))`) -- não vem de
      // `detectarUsosMaximos`. NOTA: isto é sobre o `usosMax` (Grupo 2); a
      // red de RECARGA (Grupo 3) desta mesma entrada é outro mecanismo,
      // documentado acima nesta característica (nota do Important 1).
      ramoDedicado: 'habilidades.js:3454-3459 (estadoDruidaSub.mapaEstelarMax) <- druida.js:60,76',
      // NOTA (fix Important 1, revisão independente de 2026-08-18): esta
      // entrada é a Mapa Estelar do Grupo 3 (recarga) que sobrevive como
      // red -- o texto tem um SEGUNDO parágrafo, alheio ao gatilho de
      // recarga real ("Se você perder o mapa, pode realizar uma cerimônia
      // de 1 hora... Essa cerimônia pode ser realizada durante um Descanso
      // Curto ou Longo..."), sobre uma ação DIFERENTE (recriar o mapa
      // perdido). detectarRecarga (busca cega por substring no texto
      // inteiro) funde as duas menções e devolve 'curto_ou_longo' contra o
      // 'longo' real de Raio Guia. Aparentado à causa aberta
      // 'classes-passivas-descanso-curto-janela' (lacunas-conhecidas.mjs) --
      // mesmo mecanismo de fundo (detectarRecarga não isola cláusulas) --
      // mas não idêntico (a causa 4 é sobre janela/reset presa à MESMA
      // característica; aqui a segunda menção é sobre uma ação
      // completamente diferente). Registrado como possível mesmo call site,
      // a confirmar na Task 6.
      livro: 'Classes.md:2493 -- "pode conjurá-la dessa forma um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez), e restaura todos os usos gastos ao completar um Descanso Longo."' },
    { nivel: 6, caracteristica: 'Presságio Cósmico', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:2516 -- "Você pode usar essa Reação um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo." Bundle: o gatilho de Descanso Longo que concede QUAL Reação você tem acesso (Classes.md:2510) é uma cláusula de natureza diferente (escolha/sorteio, não contagem de uso).' },
  ],
  'Feitiçaria Aberrante': [
    { nivel: 18, caracteristica: 'Implosão de Distorção', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3051 -- "Você pode usar esta característica novamente após completar um Descanso Longo ou gastando 5 Pontos de Feitiçaria."' },
  ],
  'Feitiçaria Dracônica': [
    { nivel: 14, caracteristica: 'Asas de Dragão', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3088 -- "Você pode usar esta característica novamente após completar um Descanso Longo ou gastando 3 Pontos de Feitiçaria... para restaurar seu uso."' },
    { nivel: 18, caracteristica: 'Companheiro Dracônico', usos: 1, recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...pode conjurá-la uma vez sem gastar um espaço de magia..." -- conjuração é ação do jogador.',
      livro: 'Classes.md:3092 -- "pode conjurá-la uma vez sem gastar um espaço de magia, recuperando a capacidade de conjurá-la deste modo ao completar um Descanso Longo."' },
  ],
  'Feitiçaria Mecânica': [
    { nivel: 3, caracteristica: 'Restaurar Equilíbrio', usos: 'mod. Carisma (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode executar uma Reação para evitar que o teste seja afetado..." -- Reação declarada.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3792-3799 (`if (ehRestaurarEquilibrio...)`) lê
      // `estadoFeiticeiro.modCar`, de `sheet/classes/feiticeiro.js:75`
      // (`modCar = Math.max(1, calcMod(carisma))`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:3792-3799 (estadoFeiticeiro.modCar) <- feiticeiro.js:75,86',
      livro: 'Classes.md:3132 -- "Você pode usar essa característica um número de vezes igual ao seu modificador de Carisma (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
    { nivel: 14, caracteristica: 'Transe da Ordem', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3144 -- "Você pode usar esta característica novamente após completar um Descanso Longo ou gastando 5 Pontos de Feitiçaria... para restaurar seu uso."' },
    { nivel: 18, caracteristica: 'Cavalgada Mecânica', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3148 -- "Você pode executar esta ação novamente após completar um Descanso Longo ou gastando 7 Pontos de Feitiçaria... para restaurar seu uso."' },
  ],
  'Feitiçaria Selvagem': [
    { nivel: 3, caracteristica: 'Marés do Caos', usos: 1, recarga: 'outro', base: 'custo-declarado',
      // CRITICAL 1 (fix da revisão independente de 2026-08-18): 'outro' aqui
      // documenta que o gatilho PRINCIPAL não é um Descanso (é conjurar uma
      // magia de Feiticeiro com espaço) -- não documenta "nenhum Descanso
      // recarrega isto". O próprio texto abaixo admite Descanso Longo como
      // via ALTERNATIVA e mais lenta ("...ou completar um Descanso
      // Longo..."). `recargaTambemPor` registra essa via -- o app
      // detectando 'longo' aqui não é falso positivo, é a via alternativa
      // real sendo lida corretamente.
      recargaTambemPor: 'longo',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Você pode manipular o próprio caos para conceder a si Vantagem..." -- verbo de decisão do jogador antes de jogar o d20.',
      livro: 'Classes.md:3164 -- "você deve conjurar uma magia de Feiticeiro com um espaço de magia ou completar um Descanso Longo antes de poder usar esta característica novamente" (reinicia ao conjurar com espaço de magia OU ao completar Descanso Longo, o que ocorrer primeiro).' },
    { nivel: 3, caracteristica: 'Surto de Magia Selvagem', usos: 1, recarga: 'outro', base: 'custo-declarado',
      ativa: false, ativaBase: 'julgamento',
      ativaMotivo: '"Uma vez por turno, você pode jogar 1d20 imediatamente após conjurar..." -- mesmo padrão de Concentração Fanática/Golpes Terríveis: "você pode" sem custo nomeado nem Ação declarada, só um limite de frequência.',
      livro: 'Classes.md:3170 -- "Uma vez por turno, você pode jogar 1d20 imediatamente após conjurar uma magia de Feiticeiro com um espaço de magia." (reinicia a cada turno seu).' },
    { nivel: 18, caracteristica: 'Surto Controlado', usos: 1, recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Imediatamente após conjurar uma magia... você pode criar um efeito à sua escolha..." -- verbo de decisão do jogador.',
      livro: 'Classes.md:3216 -- "Você pode usar esta característica novamente após completar um Descanso Longo."' },
  ],
  'Andarilho Feérico': [
    { nivel: 3, caracteristica: 'Golpes Terríveis', usos: 1, recarga: 'outro', base: 'custo-declarado',
      ativa: false, ativaBase: 'julgamento',
      ativaMotivo: '"Uma vez por turno, ao atingir uma criatura com uma arma, você pode causar 1d4 pontos de dano Psíquico adicional." -- mesmo padrão de Ataque Furtivo/Golpes Abençoados (classes-passivas.mjs): "você pode causar" sem custo nomeado nem Ação declarada.',
      livro: 'Classes.md:3484 -- "Uma vez por turno, ao atingir uma criatura com uma arma, você pode causar 1d4 pontos de dano Psíquico adicional." (reinicia a cada turno seu).' },
    { nivel: 11, caracteristica: 'Reforços Feéricos', usos: 1, recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...pode conjurá-la uma vez sem um espaço de magia..." -- conjuração é ação do jogador.',
      livro: 'Classes.md:3521 -- "pode conjurá-la uma vez sem um espaço de magia, e restaura a capacidade de conjurá-la deste modo ao completar um Descanso Longo."' },
    { nivel: 15, caracteristica: 'Andarilho Nebuloso', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Você pode fazer isso [conjurar Passo Nebuloso sem gastar espaço de magia]..." -- conjuração é ação do jogador.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:3490-3497 (`if (ehAndarilhoNebuloso...)`) lê
      // `estadoGuardiaoSub.andarilhoNebulosoMax`, de
      // `sheet/classes/guardiao.js:64,90` (`modSab = Math.max(1,
      // calcMod(sabedoria))`) -- não vem de `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:3490-3497 (estadoGuardiaoSub.andarilhoNebulosoMax) <- guardiao.js:64,90',
      livro: 'Classes.md:3527 -- "Você pode fazer isso um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
  ],
  'Caçador': [
    { nivel: 3, caracteristica: 'Presa do Caçador', usos: 1, recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3545 -- "Assassino de Colossos... você causa 1d8 pontos de dano adicional. Você pode causar esse dano adicional apenas uma vez por turno."; Classes.md:3547 -- "Destruidor de Hordas. Uma vez em cada um dos seus turnos, ao realizar um ataque com uma arma, você pode realizar outro ataque com a mesma arma..." Mesma frase de limite (reinicia a cada turno seu) que admitiu Ápice Elemental (Classes.md:5428) e Golpe Infalível de Lenda Viva (Classes.md:5801) nesta lista -- corrigido na revisão independente de 2026-08-17, que apontou a entrada anterior em SEM_RECURSO_SUBCLASSE como contradição com a regra do cabeçalho ("CHAMADA JULGADA" acima). Bundle: escolha entre as duas opções (Assassino de Colossos / Destruidor de Hordas), trocável ao completar um Descanso Curto ou Longo (Classes.md:3543) -- reset de escolha, não um segundo recurso; qualquer que seja a opção ativa, o limite de "uma vez por turno" se aplica.' },
    { nivel: 11, caracteristica: 'Presa do Caçador Superior', usos: 1, recarga: 'outro', base: 'custo-declarado',
      ativa: false, ativaBase: 'julgamento',
      ativaMotivo: '"Uma vez por turno, ao causar dano..., você também pode causar dano adicional..." -- mesmo padrão de Ataque Furtivo/Golpes Abençoados: "você pode causar" sem custo nomeado nem Ação declarada.',
      livro: 'Classes.md:3559 -- "Uma vez por turno, ao causar dano a uma criatura marcada pela Marca do Caçador, você também pode causar dano adicional..." (reinicia a cada turno seu).' },
  ],
  'Vigilante das Sombras': [
    { nivel: 3, caracteristica: 'Emboscador das Sombras', usos: 'mod. Sabedoria (mín. 1), no máximo 1x por turno', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3708 -- "Golpe Terrível... Você pode usar este benefício uma vez por turno e um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo." Bundle: Bônus de Iniciativa e Impulso do Emboscador, ambos passivos e sem custo (Classes.md:3706,3710).' },
  ],
  'Cavaleiro Místico': [
    { nivel: 3, caracteristica: 'Conjuração', usos: 'tabela de Espaços de Magia por nível de Guerreiro (Classes.md:3938-3960)', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:3936 -- "A tabela Conjuração de Cavaleiro Místico apresenta quantos espaços de magia você tem... Você restaura todos os espaços gastos ao completar um Descanso Longo." Bundle: truques conhecidos (sem custo) e escolha de magias preparadas (Plano de escolhas).' },
  ],
  'Combatente Psíquico': [
    { nivel: 3, caracteristica: 'Poder Psiônico', usos: 'tabela de Dados de Energia Psiônica por nível (Classes.md:4008-4015)', recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4019 -- "Você recupera um de seus Dados de Energia Psiônica gastos ao completar um Descanso Curto, e restaura todos ao completar um Descanso Longo." Bundle: três sub-habilidades nomeadas -- Golpe Psiônico (gasta 1 Dado), Movimento Telecinético (Classes.md:4025, recarga própria: "não pode fazer isso novamente até completar um Descanso Curto ou Longo, a menos que gaste um Dado... para recuperar o uso"), e Vínculo Protetivo (gasta 1 Dado via Reação).' },
    { nivel: 7, caracteristica: 'Adepto Telecinético', usos: 1, recarga: 'curto-ou-longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4035 -- "Salto com Impulsão Psíquica... Após executar essa Ação Bônus, você não pode fazer isso novamente até completar um Descanso Curto ou Longo, a menos que gaste um Dado de Energia Psiônica... para recuperar o uso." Bundle: Estocada Telecinética, passiva sem custo (Classes.md:4033).' },
    { nivel: 15, caracteristica: 'Baluarte de Energia', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4045 -- "Após usar essa característica, você não pode fazer isso novamente até completar um Descanso Longo, a menos que gaste um Dado de Energia Psiônica... para recuperar seu uso."' },
    { nivel: 18, caracteristica: 'Mestre Telecinético', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4051 -- "Após conjurar a magia por meio dessa característica, você não pode fazer isso deste modo até completar um Descanso Longo, a menos que gaste um Dado de Energia Psiônica... para recuperar o uso."' },
  ],
  'Mestre da Batalha': [
    { nivel: 3, caracteristica: 'Superioridade em Combate', usos: 4, recarga: 'curto-ou-longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4071 -- "Você tem quatro Dados de Superioridade... Você restaura todos os Dados de Superioridade gastos quando completa um Descanso Curto ou Longo." Cresce para 5 no nível 7 e 6 no nível 15 de Guerreiro (Classes.md:4073). Bundle: aprendizado de manobras, sem custo.' },
    { nivel: 7, caracteristica: 'Conheça Seu Inimigo', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4081 -- "Após usar essa característica, você não pode fazer isso novamente até completar um Descanso Longo. Você também pode recuperar um uso... gastando um Dado de Superioridade."' },
    { nivel: 15, caracteristica: 'Implacável', usos: 1, recarga: 'outro', base: 'custo-declarado',
      ativa: false, ativaBase: 'julgamento',
      ativaMotivo: '"Uma vez por turno, ao usar uma manobra, você pode jogar 1d8..." -- mesmo padrão de Ataque Furtivo/Golpes Abençoados: "você pode jogar" sem custo nomeado nem Ação declarada (é, ao contrário, uma alternativa a NÃO gastar um Dado de Superioridade).',
      livro: 'Classes.md:4089 -- "Uma vez por turno, ao usar uma manobra, você pode jogar 1d8 e usar o resultado em vez de gastar um Dado de Superioridade." (reinicia a cada turno seu).' },
  ],
  'Adaga Espiritual': [
    { nivel: 3, caracteristica: 'Poder Psiônico', usos: 'tabela de Dados de Energia Psiônica por nível (Classes.md:4334-4341)', recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4345 -- "Você recupera um de seus Dados de Energia Psiônica gastos ao completar um Descanso Curto, e restaura todos ao completar um Descanso Longo." Bundle: Aptidão Reforçada Psiquicamente e Sussurros Psíquicos, ambas gastando 1 Dado.' },
    { nivel: 13, caracteristica: 'Véu Psíquico', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4365 -- "Você pode usar esta característica novamente gastando um Dado de Energia Psiônica... ou após completar um Descanso Longo."' },
    { nivel: 17, caracteristica: 'Rasgar Mente', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4371 -- "Você pode usar esta característica novamente gastando três Dados de Energia Psiônica... ou após completar um Descanso Longo."' },
  ],
  'Trapaceiro Arcano': [
    { nivel: 3, caracteristica: 'Conjuração', usos: 'tabela de Espaços de Magia por nível de Ladino (Classes.md:4479-4498)', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4465 -- "A tabela Conjuração de Trapaceiro Arcano apresenta quantos espaços de magia você tem... Você restaura todos os espaços gastos ao completar um Descanso Longo." Bundle: truques conhecidos (sem custo) e escolha de magias preparadas.' },
    { nivel: 17, caracteristica: 'Ladrão de Magias', usos: 1, recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode executar uma Reação para forçá-la a realizar uma salvaguarda..." -- Reação declarada.',
      livro: 'Classes.md:4518 -- "Após roubar uma magia com essa característica, você não pode usar esta característica novamente até completar um Descanso Longo."' },
  ],
  'Abjurador': [
    { nivel: 3, caracteristica: 'Proteção Arcana', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:4974 -- "Após conjurar a proteção, você não pode conjurá-la novamente até completar um Descanso Longo." Bundle: restauração de PV da proteção ao conjurar Abjuração ou via Ação Bônus com espaço de magia (Classes.md:4972).' },
  ],
  'Adivinhador': [
    { nivel: 3, caracteristica: 'Prodígio', usos: '2 (cresce para 3 no nível 14, ver Prodígio Maior)', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5004 -- "Ao completar um Descanso Longo, jogue dois d20s e registre os números obtidos."; Classes.md:5006 -- "Ao completar um Descanso Longo você perde quaisquer jogadas de previsão não utilizadas." Bundle: limite de "apenas uma vez por turno" para USAR uma jogada já guardada (Classes.md:5004) -- cláusula de decisão, não de recarga. O total de jogadas cresce para três no nível 14 (Classes.md:5030, entrada própria em Prodígio Maior, abaixo) -- corrigido na revisão independente de 2026-08-17, que apontou `usos: 2` fixo como faltando a escala do livro.' },
    { nivel: 10, caracteristica: 'O Terceiro Olho', usos: 1, recarga: 'curto-ou-longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma Ação Bônus, escolha um dos seguintes benefícios..." -- Ação Bônus declarada.',
      livro: 'Classes.md:5020 -- "Você não pode usar essa característica novamente até completar um Descanso Curto ou Longo."' },
    { nivel: 14, caracteristica: 'Prodígio Maior', usos: 'compartilha a reserva de Prodígio (nível 3), elevada de 2 para 3 d20s', recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5030 -- "Jogue três d20s para sua característica Prodígio em vez de dois." Upgrade que eleva o total de uma característica de nível inferior já com recurso próprio -- mesmo tratamento de Domínio da Luz|6|Labareda Protetora Aprimorada. A recarga (Descanso Longo) é herdada de Prodígio (Classes.md:5004,5006); esta característica só declara o novo total.' },
  ],
  'Evocador': [
    { nivel: 14, caracteristica: 'Sobrecarga', usos: null, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5060 -- "Se usar esta característica novamente antes de completar um Descanso Longo, você sofre 2d12 pontos de dano Necrótico para cada círculo do espaço de magia..."; Classes.md:5062 -- "Toda vez que você usa esta característica novamente antes de completar um Descanso Longo, o dano Necrótico por círculo de magia aumenta em 1d12." Uso ilimitado, mas com custo crescente cujo contador reinicia só no Descanso Longo -- não é um número de usos fixo, por isso `usos: null`.' },
  ],
  'Ilusionista': [
    { nivel: 6, caracteristica: 'Criaturas Espectrais', usos: '1 (leitura conservadora -- ver nota) ou 2, um por magia', recarga: 'longo', base: 'julgamento',
      composta: true,
      livro: 'Classes.md:5084 -- "Você pode conjurar a versão Ilusão de cada magia sem gastar um espaço de magia... Após conjurar qualquer uma das magias sem um espaço de magia, você deve completar um Descanso Longo antes de conjurar novamente a magia desta forma." A RECARGA (Descanso Longo) é citável e inequívoca -- por isso a entrada continua em RECURSOS_SUBCLASSE; mas "a magia" (singular) admite duas leituras igualmente razoáveis: recarga POR magia (2 usos totais, um para *Convocar Feérico* e outro para *Invocar Fera*) ou recarga COMPARTILHADA (1 uso total, qualquer uma das duas consumindo o mesmo limite). Sem frase que resolva qual -- por isso `julgamento`, não `custo-declarado` (achado da revisão independente de 2026-08-17; as magias em si já estão sempre preparadas, sem limite, ver MAGIAS_SUBCLASSE).' },
    { nivel: 10, caracteristica: 'Autoimagem Ilusória', usos: 1, recarga: 'curto-ou-longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5090 -- "Após usar esta característica, você não pode utilizá-la novamente até completar um Descanso Curto ou Longo. Você também pode restaurar seu uso gastando um espaço de magia de 2º círculo ou superior."' },
  ],
  'Combatente da Mão Espalmada': [
    { nivel: 6, caracteristica: 'Integridade Corporal', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"Como uma Ação Bônus, você pode jogar seu dado de Artes Marciais." -- Ação Bônus declarada.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:4463-4470 (`if (ehEspalmadaIntegridade...)`) lê
      // `estadoMongeSub.integridadeMax`, de `sheet/classes/monge.js:80`
      // (`integridadeMax = Math.max(1, sabMod)`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:4463-4470 (estadoMongeSub.integridadeMax) <- monge.js:80',
      livro: 'Classes.md:5310 -- "Você pode usar essa característica um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
  ],
  'Combatente da Misericórdia': [
    { nivel: 3, caracteristica: 'Mão de Dolo', usos: 1, recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5338 -- "Uma vez por turno, ao atingir uma criatura com um Ataque Desarmado e causar dano, você pode gastar 1 Ponto de Foco para causar dano Necrótico adicional..." (reinicia a cada turno seu; o gasto de 1 Ponto de Foco é o recurso da classe base). Corrigido na revisão independente de 2026-08-17, que apontou 5336 como a linha do heading "### Nível 3: Mão de Dolo", não da sentença -- única citação desta entrada.' },
    { nivel: 11, caracteristica: 'Torrente de Cura e Dolo', usos: 'mod. Sabedoria (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode usar Mão de Dolo com esse ataque sem gastar um Ponto de Foco..." -- "você pode usar" explícito.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos): ramo dedicado em
      // habilidades.js:4484-4491 (`if (ehMisericordiaTorrente...)`) lê
      // `estadoMongeSub.torrenteMax`, de `sheet/classes/monge.js:95`
      // (`torrenteMax = Math.max(1, sabMod)`) -- não vem de
      // `detectarUsosMaximos`.
      ramoDedicado: 'habilidades.js:4484-4491 (estadoMongeSub.torrenteMax) <- monge.js:95',
      livro: 'Classes.md:5354 -- "Você pode usar esses benefícios um número de vezes igual ao seu modificador de Sabedoria (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
    { nivel: 17, caracteristica: 'Mão da Misericórdia Final', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5360 -- "Após usar essa característica, você não pode usá-la novamente até completar um Descanso Longo." Bundle: gasto de 5 Pontos de Foco para ativar (Classes.md:5358).' },
  ],
  'Combatente dos Elementos': [
    { nivel: 17, caracteristica: 'Ápice Elemental', usos: 1, recarga: 'outro', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5428 -- "Golpes Potencializados. Uma vez em cada um dos seus turnos, você pode causar dano adicional..." (reinicia a cada turno seu). Bundle: Passo Destrutivo e a escolha de tipo de dano de Resistência a Dano (Classes.md:5430,5432) -- essas cláusulas de escolha já estão cobertas por ESCOLHAS_SUBCLASSE (plano 3), fora do escopo deste campo.' },
  ],
  'Juramento da Devoção': [
    { nivel: 20, caracteristica: 'Resplendor Sagrado', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5741 -- "Após usar esta característica, você não pode utilizá-la novamente até completar um Descanso Longo. Você também pode recuperar seu uso gastando um espaço de magia de 5º círculo."' },
  ],
  'Juramento da Glória': [
    { nivel: 15, caracteristica: 'Defesa Gloriosa', usos: 'mod. Carisma (mín. 1)', recarga: 'longo', base: 'custo-declarado',
      ativa: true, ativaBase: 'custo-declarado',
      ativaMotivo: '"...você pode executar uma Reação para conceder um bônus à CA..." -- Reação declarada.',
      // METADE FALTANTE DO CRITICAL 4 (ver nota completa em Patrono
      // Arquifada|3|Passos Feéricos, primeira ocorrência): valor exibido na
      // ficha vem de ramo dedicado, não de `detectarUsosMaximos`. Aqui o
      // ramo (habilidades.js:4282-4294, `if (ehGloriaDefesaGloriosa...)`)
      // calcula `modCar = Math.max(1, calcMod(carisma))` INLINE, dentro do
      // próprio `habilidades.js` -- não delega a `sheet/classes/paladino.js`
      // (que só expõe `modCar` para o bônus de Aura, campo diferente).
      ramoDedicado: 'habilidades.js:4282-4294 (modCar calculado inline no próprio ramo, não em paladino.js)',
      livro: 'Classes.md:5793 -- "Você pode usar essa característica um número de vezes igual ao seu modificador de Carisma (mínimo de uma vez) e restaura todos os usos gastos ao completar um Descanso Longo."' },
    { nivel: 20, caracteristica: 'Lenda Viva', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5797 -- "Após usar essa característica, você não pode utilizá-la novamente até completar um Descanso Longo. Você também pode recuperar seu uso gastando um espaço de magia de 5º círculo." Bundle: Golpe Infalível, limitado a "Uma vez em cada um dos seus turnos" (Classes.md:5801), e Jogar Novamente a Salvaguarda, ilimitado (Classes.md:5803).' },
  ],
  'Juramento da Vingança': [
    { nivel: 20, caracteristica: 'Anjo Vingador', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5847 -- "Após usar esta característica, você não pode utilizá-la novamente até completar um Descanso Longo. Você também pode recuperar seu uso gastando um espaço de magia de 5º círculo."' },
  ],
  'Juramento dos Anciões': [
    { nivel: 15, caracteristica: 'Sentinela Imortal', usos: 1, recarga: 'longo', base: 'custo-declarado',
      // CRITICAL 3 (fix da revisão independente de 2026-08-18): `base`
      // continua 'custo-declarado' (a pergunta de usos/recarga -- o livro
      // nomeia um limite -- continua respondida "sim"), mas `ativaBase`
      // diverge: o texto real ("Ao ser reduzido a 0 Pontos de Vida e não
      // morto imediatamente, você fica com 1 Ponto de Vida e recupera...")
      // não tem NENHUM verbo de decisão do jogador -- é um gatilho
      // inteiramente automático (uma salvaguarda contra a morte, não uma
      // característica que o jogador escolhe ativar). "não pode utilizá-la
      // novamente até completar um Descanso Longo" limita a FREQUÊNCIA
      // desse efeito automático, não custeia uma escolha -- mesmo
      // raciocínio das causas 'classes-passivas-ativa-no-turno'/
      // '...-recarga-troca-escolha' (lacunas-conhecidas.mjs): uma cláusula
      // de Descanso presa a algo que não é, em si, uma ativação.
      ativa: false, ativaBase: 'ausencia-de-custo',
      ativaMotivo: '"Ao ser reduzido a 0 Pontos de Vida e não morto imediatamente, você fica com 1 Ponto de Vida..." -- gatilho automático, nenhum verbo de decisão do jogador.',
      livro: 'Classes.md:5889 -- "Após usar essa característica, você não pode utilizá-la novamente até completar um Descanso Longo."' },
    { nivel: 20, caracteristica: 'Campeão Ancestral', usos: 1, recarga: 'longo', base: 'custo-declarado',
      composta: true,
      livro: 'Classes.md:5895 -- "Após usar esta característica, você não pode utilizá-la novamente até completar um Descanso Longo. Você também pode restaurar seu uso gastando um espaço de magia de 5º círculo."' },
  ],
};

// ============================================================
// As 169 características restantes: não concedem recurso (usos/recarga)
// próprio. Chave `"<Subclasse>|<nível>|<Nome>"`, valor é o motivo, sempre
// citando `Classes.md:<linha>` da sentença decisiva. Quatro padrões se
// repetem (ver cabeçalho de RECURSOS_SUBCLASSE acima para a regra por
// trás de cada um):
//   (a) benefício passivo/contínuo, sem custo nem limite;
//   (b) Ação Bônus/Reação sem número de usos ou recarga própria declarados;
//   (c) a característica GASTA um recurso já existente da classe base
//       (Canalizar Divindade, Inspiração de Bardo, Forma Selvagem, Pontos
//       de Feitiçaria, Ponto de Foco, Dado de Energia Psiônica, Golpe
//       Astuto), sem declarar limite ou recarga PRÓPRIOS -- 41 das 169
//       abaixo (contagem corrigida, ver "A REGRA DO RECURSO JÁ EXISTENTE"
//       no cabeçalho de RECURSOS_SUBCLASSE);
//   (d) concede magia(s) sempre preparada(s), por Ritual, ou conhecida --
//       não é recurso de uso limitado (é conteúdo do Plano 2, magias).
// As entradas marcadas "ARMADILHA" são as que mencionam Descanso Curto ou
// Longo mas foram classificadas `SEM_RECURSO_SUBCLASSE` porque a menção é
// janela/duração, reset de escolha, gatilho, ou menção incidental (sabor
// cosmético, ou janela de tempo para um Ritual) -- não recarga. São 10 ao
// todo nesta lista (a revisão independente de 2026-08-17 contou 11 na
// versão anterior do arquivo, mas uma delas -- Presa do Caçador -- migrou
// para RECURSOS_SUBCLASSE junto com a correção do Critical 1, ver
// CONSISTÊNCIA CORRIGIDA no cabeçalho de RECURSOS_SUBCLASSE; ver a tabela
// equivalente no relatório desta tarefa).
// ============================================================
export const SEM_RECURSO_SUBCLASSE = {
  // ---------------------------------------------------------------
  // Bárbaro
  // ---------------------------------------------------------------
  'Trilha da Árvore do Mundo|3|Vitalidade da Árvore':
    'Classes.md:199 -- "Força Revigorante"/"Surto de Vitalidade" concedem PV Temporários sem limite de vezes enquanto/ao ativar a Fúria; benefício passivo, sem custo, usos ou recarga próprios.',
  'Trilha da Árvore do Mundo|6|Ramos da Árvore':
    'Classes.md:205 -- Reação sem número de usos ou recarga declarados; disponível sempre que o gatilho ocorrer.',
  'Trilha da Árvore do Mundo|10|Raízes Devastadoras':
    'Classes.md:209 -- benefício passivo e contínuo durante o turno, sem custo, usos ou recarga.',
  'Trilha do Berserker|3|Frenesi':
    'Classes.md:227 -- dano adicional passivo enquanto a Fúria está ativa e Ataque Imprudente é usado; sem custo ou limite próprio.',
  'Trilha do Berserker|6|Fúria Irracional':
    'Classes.md:231 -- imunidade passiva enquanto a Fúria está ativa; sem custo, usos ou recarga.',
  'Trilha do Berserker|10|Retaliação':
    'Classes.md:235 -- Reação sem número de usos ou recarga declarados.',
  'Trilha do Coração Selvagem|3|Arauto da Fauna':
    'Classes.md:253 -- conjuração como Ritual, sem limite de usos ou recarga.',
  'Trilha do Coração Selvagem|3|Fúria dos Selvagens':
    'Classes.md:257 -- escolha entre três opções renovada a cada ativação da Fúria; não há contagem de usos própria desta característica.',
  'Trilha do Coração Selvagem|6|Aspecto dos Selvagens':
    'ARMADILHA (reset de escolha). Classes.md:267 -- "Sempre que completar um Descanso Longo, você pode alterar sua escolha." Não há usos que se esgotam: é uma escolha permanente entre três opções, trocável no Descanso Longo.',
  'Trilha do Coração Selvagem|10|Arauto da Natureza':
    'Classes.md:277 -- conjuração como Ritual, sem limite de usos ou recarga.',
  'Trilha do Coração Selvagem|14|Poder dos Selvagens':
    'Classes.md:281 -- escolha entre três opções renovada a cada ativação da Fúria; sem contagem de usos própria.',
  'Trilha do Fanático|3|Fúria Divina':
    'Classes.md:307 -- dano adicional passivo, todo turno, enquanto a Fúria está ativa; sem custo ou limite próprio.',
  // ---------------------------------------------------------------
  // Bardo
  // ---------------------------------------------------------------
  'Colégio da Bravura|3|Inspiração em Combate':
    'Classes.md:696 -- consome um dado de Inspiração de Bardo já existente (recurso da classe base); a característica não introduz usos ou recarga próprios.',
  'Colégio da Bravura|3|Treinamento Marcial':
    'Classes.md:704 -- proficiências concedidas de forma permanente; sem custo, usos ou recarga.',
  'Colégio da Bravura|6|Ataque Extra':
    'Classes.md:710 -- benefício passivo e contínuo; sem custo, usos ou recarga.',
  'Colégio da Bravura|14|Magia de Batalha':
    'Classes.md:716 -- benefício passivo e contínuo; sem custo, usos ou recarga.',
  'Colégio da Dança|3|Ginga Fascinante':
    'Classes.md:734 -- "Golpes Ágeis" consome um uso de Inspiração de Bardo já existente; os demais benefícios são passivos. Sem limite próprio.',
  'Colégio da Dança|6|Gingado Coordenado':
    'Classes.md:738 -- consome um uso de Inspiração de Bardo já existente; sem limite próprio adicional.',
  'Colégio da Dança|6|Movimento Inspirador':
    'Classes.md:744 -- Reação que consome um uso de Inspiração de Bardo já existente; sem limite próprio adicional.',
  'Colégio da Dança|14|Evasão Liderada':
    'Classes.md:750 -- benefício passivo, condicionado a não estar Incapacitado; sem custo, usos ou recarga.',
  'Colégio do Conhecimento|3|Palavras de Interrupção':
    'Classes.md:762 -- Reação que consome um uso de Inspiração de Bardo já existente; sem limite próprio adicional.',
  'Colégio do Conhecimento|3|Proficiências Bônus':
    'Classes.md:766 -- proficiências concedidas de forma permanente; sem custo, usos ou recarga.',
  'Colégio do Conhecimento|6|Descobertas Mágicas':
    'Classes.md:770 -- concede magias sempre preparadas por escolha do jogador; não é recurso de uso limitado (ver SUBCLASSES_MAGIA_POR_ESCOLHA, Plano 2).',
  'Colégio do Conhecimento|14|Perícia Inigualável':
    'Classes.md:776 -- consome um uso de Inspiração de Bardo já existente (devolvido se a jogada falhar); sem limite próprio adicional.',
  'Colégio do Glamour|3|Manto de Inspiração':
    'Classes.md:794 -- consome um uso de Inspiração de Bardo já existente; sem limite próprio adicional.',
  // ---------------------------------------------------------------
  // Bruxo
  // ---------------------------------------------------------------
  'Patrono Arquifada|3|Magias de Pacto da Arquifada':
    'Classes.md:1307 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Patrono Arquifada|6|Fuga em Névoa':
    'Classes.md:1330 -- amplia o gatilho e as opções de Passos Feéricos (nível 3); não introduz usos ou recarga próprios adicionais.',
  'Patrono Arquifada|14|Magia Sedutora':
    'Classes.md:1346 -- permite conjurar Passo Nebuloso sem gastar espaço de magia, sem limite de vezes declarado, após conjurar Encantamento/Ilusão.',
  'Patrono Celestial|3|Magia de Pacto do Celestial':
    'Classes.md:1362 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Patrono Celestial|10|Resiliência Celestial':
    'ARMADILHA (gatilho). Classes.md:1379 -- "Você recebe Pontos de Vida Temporários sempre que usar sua característica Astúcia Mágica ou completar um Descanso Curto ou Longo." O Descanso dispara o efeito automaticamente; não há um número de usos que se esgota.',
  'Patrono O Grande Antigo|3|Magias de Pacto do Grande Antigo':
    'Classes.md:1395 -- concede magias sempre preparadas por nível (texto solto, sem heading `###`, ver comentário em SUBCLASSES_CARACTERISTICAS); não é recurso de uso limitado.',
  'Patrono O Grande Antigo|3|Magias Psíquicas':
    'Classes.md:1408 -- benefício passivo (muda tipo de dano; remove componentes) sempre disponível; sem custo, usos ou recarga.',
  'Patrono O Grande Antigo|3|Mente Desperta':
    'Classes.md:1414 -- Ação Bônus com duração própria, sem número de usos ou recarga declarados.',
  'Patrono O Grande Antigo|10|Danação Mística':
    'Classes.md:1424 -- concede a magia Danação sempre preparada, com efeito passivo adicional; não é recurso de uso limitado.',
  'Patrono O Grande Antigo|10|Escudo Mental':
    'Classes.md:1428 -- benefício passivo e contínuo; sem custo, usos ou recarga.',
  'Patrono O Grande Antigo|14|Criar Servo':
    'Classes.md:1432 -- modifica passivamente a magia Invocar Aberração quando conjurada; sem custo ou limite próprio.',
  'Patrono Ínfero|3|Bênção do Tenebroso':
    'Classes.md:1444 -- benefício passivo automático ao reduzir um inimigo a 0 PV; sem custo, usos ou recarga.',
  'Patrono Ínfero|3|Magias de Pacto do Ínfero':
    'Classes.md:1448 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Patrono Ínfero|10|Resistência Ínfera':
    'ARMADILHA (reset de escolha). Classes.md:1467 -- "Ao completar um Descanso Curto ou Longo, escolha um tipo de dano... Você tem Resistência a esse tipo de dano até escolher um tipo de dano diferente." Não há usos que se esgotam: é uma escolha renovada no Descanso.',
  // ---------------------------------------------------------------
  // Clérigo
  // ---------------------------------------------------------------
  'Domínio da Guerra|3|Magias de Domínio da Guerra':
    'Classes.md:1809 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Domínio da Guerra|3|Ataque Direcionado':
    'Classes.md:1822 -- consome um uso de Canalizar Divindade já existente (recurso da classe base); sem limite próprio adicional.',
  'Domínio da Guerra|6|Bênção do Deus da Guerra':
    'Classes.md:1830 -- consome um uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Domínio da Guerra|17|Avatar da Guerra':
    'Classes.md:1834 -- resistências passivas e permanentes; sem custo, usos ou recarga.',
  'Domínio da Luz|3|Brilho do Amanhecer':
    'Classes.md:1846 -- consome um uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Domínio da Luz|3|Magias de Domínio da Luz':
    'Classes.md:1856 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Domínio da Trapaça|3|Magias de Domínio da Trapaça':
    'Classes.md:1889 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Domínio da Trapaça|3|Bênção do Trapaceiro':
    'ARMADILHA (janela/duração). Classes.md:1902 -- "Essa bênção permanece até você completar um Descanso Longo ou usar esta característica novamente." Sem limite de vezes por dia declarado; o Descanso Longo delimita a DURAÇÃO do efeito, não a disponibilidade de um novo uso.',
  'Domínio da Trapaça|3|Invocar Duplicidade':
    'Classes.md:1906 -- consome um uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Domínio da Trapaça|6|Transposição do Trapaceiro':
    'Classes.md:1916 -- benefício passivo, ligado à Ação Bônus de Invocar Duplicidade (nível 3); sem custo ou limite próprio.',
  'Domínio da Trapaça|17|Duplicidade Aprimorada':
    'Classes.md:1920 -- benefícios passivos que aprimoram Invocar Duplicidade; sem custo ou limite próprio.',
  'Domínio da Vida|3|Magias de Domínio da Vida':
    'Classes.md:1936 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Domínio da Vida|3|Discípulo da Vida':
    'Classes.md:1949 -- benefício passivo automático ao conjurar magia de cura com espaço de magia; sem custo, usos ou recarga.',
  'Domínio da Vida|3|Preservar a Vida':
    'Classes.md:1953 -- consome o uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Domínio da Vida|6|Curandeiro Abençoado':
    'Classes.md:1957 -- benefício passivo automático ao curar outra criatura; sem custo, usos ou recarga.',
  'Domínio da Vida|17|Cura Suprema':
    'Classes.md:1961 -- modificador passivo e permanente às jogadas de cura; sem custo, usos ou recarga.',
  // ---------------------------------------------------------------
  // Druida
  // ---------------------------------------------------------------
  'Círculo da Lua|3|Formas Animais dos Círculos Druídicos':
    'Classes.md:2347 -- modificações passivas à Forma Selvagem; sem custo, usos ou recarga próprios.',
  'Círculo da Lua|3|Magias do Círculo da Lua':
    'Classes.md:2357 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Círculo da Lua|6|Formas Animais dos Círculos Druídicos Aprimorada':
    'Classes.md:2372 -- benefícios passivos enquanto em Forma Selvagem; sem custo, usos ou recarga.',
  'Círculo da Terra|3|Auxílio da Terra':
    'Classes.md:2400 -- consome um uso de Forma Selvagem já existente (recurso da classe base); sem limite próprio adicional.',
  'Círculo da Terra|3|Magias do Círculo da Terra':
    'ARMADILHA (reset de escolha). Classes.md:2406 -- "Sempre que completar um Descanso Longo, escolha um tipo de terreno: árido, polar, temperado ou tropical..." Não é recurso de uso: é escolha de qual das quatro tabelas de magia fica ativa, renovada no Descanso Longo -- já coberta como escolha em SUBCLASSES_MAGIA_POR_ESCOLHA (Plano 2).',
  'Círculo da Terra|10|Proteção Natural':
    'Classes.md:2452 -- imunidade e resistência passivas, derivadas do terreno já escolhido (nível 3); sem custo, usos ou recarga próprios.',
  'Círculo da Terra|14|Santuário Natural':
    'Classes.md:2465 -- consome um uso de Forma Selvagem já existente; sem limite próprio adicional.',
  'Círculo das Estrelas|3|Forma Estrelada':
    'Classes.md:2477 -- consome um uso de Forma Selvagem já existente; a escolha de constelação é renovada a cada ativação, sem contagem de usos própria.',
  'Círculo das Estrelas|10|Constelações Cintilantes':
    'Classes.md:2522 -- benefícios passivos, mais a troca de constelação no início de cada turno (sem custo, sem relação com Descanso); sem usos ou recarga.',
  'Círculo das Estrelas|14|Repleto de Estrelas':
    'Classes.md:2526 -- benefício passivo enquanto em Forma Estrelada; sem custo, usos ou recarga.',
  'Círculo do Mar|3|Ira do Mar':
    'Classes.md:2536 -- consome um uso de Forma Selvagem já existente; sem limite próprio adicional.',
  'Círculo do Mar|3|Magias do Círculo do Mar':
    'Classes.md:2542 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Círculo do Mar|6|Afinidade Aquática':
    'Classes.md:2555 -- benefícios passivos que aprimoram Ira do Mar; sem custo ou limite próprio.',
  'Círculo do Mar|10|Filho da Tempestade':
    'Classes.md:2561 -- benefícios passivos enquanto Ira do Mar está ativa; sem custo ou limite próprio.',
  'Círculo do Mar|14|Manifestação Oceânica':
    'Classes.md:2571 -- modifica passivamente Ira do Mar (gasta mais usos de Forma Selvagem, recurso já existente, para afetar duas criaturas); sem limite próprio adicional.',
  // ---------------------------------------------------------------
  // Feiticeiro
  // ---------------------------------------------------------------
  'Feitiçaria Aberrante|3|Fala Telepática':
    'Classes.md:3010 -- Ação Bônus com duração própria, sem número de usos ou recarga declarados.',
  'Feitiçaria Aberrante|3|Magias Psiônicas':
    'Classes.md:3016 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Feitiçaria Aberrante|6|Defesas Psíquicas':
    'Classes.md:3029 -- resistência e vantagem passivas; sem custo, usos ou recarga.',
  'Feitiçaria Aberrante|6|Feitiçaria Psiônica':
    'Classes.md:3033 -- permite gastar Pontos de Feitiçaria já existentes em vez de espaço de magia; sem limite próprio adicional.',
  'Feitiçaria Aberrante|14|Revelação em Carne':
    'Classes.md:3037 -- gasta 1+ Pontos de Feitiçaria já existentes; sem limite próprio adicional.',
  'Feitiçaria Dracônica|3|Magias Dracônicas':
    'Classes.md:3061 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Feitiçaria Dracônica|3|Resiliência Dracônica':
    'Classes.md:3074 -- benefícios passivos e permanentes; sem custo, usos ou recarga.',
  'Feitiçaria Dracônica|6|Afinidade Elemental':
    'Classes.md:3080 -- resistência e bônus de dano passivos; sem custo, usos ou recarga.',
  'Feitiçaria Mecânica|3|Magias Mecânicas':
    'Classes.md:3104 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Feitiçaria Mecânica|6|Bastião da Lei':
    'ARMADILHA (janela/duração). Classes.md:3138 -- "A proteção dura até você completar um Descanso Longo ou até usar esta característica novamente." Sem limite de vezes por dia declarado (o custo por uso é em Pontos de Feitiçaria, recurso já existente); o Descanso Longo delimita a DURAÇÃO da proteção, não um novo uso.',
  'Feitiçaria Selvagem|6|Distorcer a Sorte':
    'Classes.md:3206 -- gasta 1 Ponto de Feitiçaria já existente; sem limite próprio adicional.',
  'Feitiçaria Selvagem|14|Caos Controlado':
    'Classes.md:3210 -- benefício passivo ao rolar na tabela Surto de Magia Selvagem; sem custo, usos ou recarga.',
  // ---------------------------------------------------------------
  // Guardião
  // ---------------------------------------------------------------
  'Andarilho Feérico|3|Glamour Transcendental':
    'Classes.md:3478 -- bônus passivo em testes de Carisma, mais proficiência permanente; sem custo, usos ou recarga.',
  'Andarilho Feérico|3|Magias do Andarilho Feérico':
    'Classes.md:3488 -- concede magias sempre preparadas por nível, mais uma bênção feérica cosmética permanente; não é recurso de uso limitado. ARMADILHA (menção de sabor, sem recarga): Classes.md:3506 -- "Borboletas ilusórias flutuam ao seu redor enquanto você realiza um Descanso Curto ou Longo." (uma das seis dádivas cosméticas da tabela; descreve a aparência do personagem DURANTE o Descanso, não concede nem limita usos). Rotulada na revisão independente de 2026-08-17.',
  'Andarilho Feérico|7|Detalhe Sedutor':
    'Classes.md:3517 -- vantagem passiva, mais Reação sem número de usos ou recarga declarados.',
  'Caçador|3|Conhecimento do Caçador':
    'Classes.md:3539 -- conhecimento passivo, condicionado à Marca do Caçador (magia da classe base); sem custo, usos ou recarga.',
  'Caçador|7|Táticas Defensivas':
    'ARMADILHA (reset de escolha). Classes.md:3551 -- mesmo padrão de Presa do Caçador: escolha entre duas opções passivas, trocável a cada Descanso Curto ou Longo.',
  'Caçador|15|Defesa do Caçador Superior':
    'Classes.md:3563 -- Reação sem número de usos ou recarga declarados.',
  'Senhor das Feras|3|Companheiro Primal':
    'ARMADILHA (reset de escolha). Classes.md:3581 -- "Sempre que completar um Descanso Longo, você pode invocar uma Fera primal diferente..." Não é contagem de usos: é a troca do bloco de estatísticas da fera, disponível sem limite a cada Descanso Longo. "Restaurar ou Substituir a Fera" (Classes.md:3579) gasta um espaço de magia, recurso já existente.',
  'Senhor das Feras|7|Treinamento Excepcional':
    'Classes.md:3682 -- benefícios passivos que ampliam os comandos da fera; sem custo, usos ou recarga.',
  'Senhor das Feras|11|Fúria Bestial':
    'Classes.md:3688 -- benefício passivo (a fera ataca duas vezes quando comandada); sem custo, usos ou recarga.',
  'Senhor das Feras|15|Compartilhar Magias':
    'Classes.md:3694 -- benefício passivo ao conjurar magia em si mesmo; sem custo, usos ou recarga.',
  'Vigilante das Sombras|3|Magias do Vigilante das Sombras':
    'Classes.md:3714 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Vigilante das Sombras|3|Visão Umbrosa':
    'Classes.md:3728 -- benefícios passivos e permanentes; sem custo, usos ou recarga.',
  'Vigilante das Sombras|7|Mente de Ferro':
    'Classes.md:3734 -- proficiência permanente; sem custo, usos ou recarga.',
  'Vigilante das Sombras|11|Torrente do Vigilante':
    'Classes.md:3738 -- amplia passivamente o dano e as opções do Golpe Terrível (nível 3, que já tem recurso próprio); não introduz usos ou recarga adicionais.',
  'Vigilante das Sombras|15|Esquiva Sombria':
    'Classes.md:3746 -- Reação sem número de usos ou recarga declarados.',
  // ---------------------------------------------------------------
  // Guerreiro
  // ---------------------------------------------------------------
  'Campeão|3|Atleta Extraordinário':
    'Classes.md:3894 -- benefícios passivos e permanentes; sem custo, usos ou recarga.',
  'Campeão|3|Crítico Aprimorado':
    'Classes.md:3900 -- modificador passivo e permanente; sem custo, usos ou recarga.',
  'Campeão|7|Estilo de Luta Adicional':
    'Classes.md:3904 -- concede um talento permanente; sem custo, usos ou recarga.',
  'Campeão|10|Combatente Heroico':
    'Classes.md:3908 -- concede Inspiração Heroica automaticamente a cada turno sem ela; sem limite acumulável nem recarga a rastrear.',
  'Campeão|15|Crítico Superior':
    'Classes.md:3912 -- modificador passivo e permanente; sem custo, usos ou recarga.',
  'Campeão|18|Sobrevivente':
    'Classes.md:3918 -- benefícios passivos e permanentes (Desafie a Morte, Regeneração Heroica); sem custo, usos ou recarga.',
  'Cavaleiro Místico|3|Vínculo com Arma':
    'Classes.md:3978 -- vínculo permanente (até dois de cada vez); invocar a arma vinculada não tem limite de vezes declarado. ARMADILHA (Ritual cronometrado durante um Descanso, sem recarga): Classes.md:3974 -- "Você realiza o ritual ao longo de 1 hora, o que pode ser concluído durante um Descanso Curto." (o Descanso é só a janela de tempo disponível para o Ritual de vínculo, não uma recarga de uso). Rotulada na revisão independente de 2026-08-17.',
  'Cavaleiro Místico|7|Magia de Guerra':
    'Classes.md:3982 -- benefício passivo, sem limite de vezes declarado.',
  'Cavaleiro Místico|10|Golpe Místico':
    'Classes.md:3986 -- benefício passivo automático ao acertar com arma; sem custo, usos ou recarga.',
  'Cavaleiro Místico|15|Investida Mística':
    'Classes.md:3990 -- benefício passivo ligado ao Surto de Ação (recurso da classe base); sem limite próprio adicional.',
  'Cavaleiro Místico|18|Magia de Guerra Aprimorada':
    'Classes.md:3994 -- benefício passivo, sem limite de vezes declarado.',
  'Combatente Psíquico|10|Resguardo Mental':
    'Classes.md:4039 -- resistência passiva, mais o gasto de um Dado de Energia Psiônica já existente para encerrar condições; sem limite próprio adicional.',
  'Mestre da Batalha|3|Estudioso da Guerra':
    'Classes.md:4061 -- proficiências concedidas de forma permanente; sem custo, usos ou recarga.',
  'Mestre da Batalha|10|Superioridade em Combate Aprimorada':
    'Classes.md:4085 -- upgrade passivo do tamanho do dado (nível 3, que já tem recurso próprio); não introduz usos ou recarga adicionais.',
  'Mestre da Batalha|18|Superioridade em Combate Suprema':
    'Classes.md:4093 -- upgrade passivo do tamanho do dado; não introduz usos ou recarga adicionais.',
  // ---------------------------------------------------------------
  // Ladino
  // ---------------------------------------------------------------
  'Adaga Espiritual|3|Lâminas Psíquicas':
    'Classes.md:4326 -- manifestação de arma passiva e ilimitada; o segundo ataque bônus também não tem limite declarado.',
  'Adaga Espiritual|9|Lâminas da Alma':
    'Classes.md:4359 -- novos usos das Lâminas Psíquicas gastando Dados de Energia Psiônica já existentes; sem limite próprio adicional.',
  'Assassino|3|Assassinar':
    'Classes.md:4381 -- vantagem e dano adicional passivos e automáticos na primeira rodada de combate; sem custo, usos ou recarga.',
  'Assassino|3|Ferramentas de Assassino':
    'Classes.md:4389 -- concede equipamento e proficiência; sem custo, usos ou recarga.',
  'Assassino|9|Especialista em Infiltração':
    'Classes.md:4397 -- benefícios passivos; sem custo, usos ou recarga.',
  'Assassino|13|Armas Venenosas':
    'Classes.md:4401 -- amplia passivamente a opção Envenenar do Golpe Astuto (recurso já existente); sem limite próprio adicional.',
  'Assassino|17|Golpe Mortal':
    'Classes.md:4405 -- efeito passivo automático ao acertar Ataque Furtivo na primeira rodada; sem custo, usos ou recarga.',
  'Ladrão|3|Andarilho de Telhados':
    'Classes.md:4419 -- benefícios passivos e permanentes; sem custo, usos ou recarga.',
  'Ladrão|3|Mão Leve':
    'Classes.md:4427 -- Ação Bônus sem número de usos ou recarga declarados.',
  'Ladrão|9|Furtividade Suprema':
    'Classes.md:4433 -- nova opção do Golpe Astuto (gasta 1d6 do próprio Golpe Astuto, recurso já existente); sem limite próprio adicional.',
  'Ladrão|13|Usar Dispositivo Mágico':
    'Classes.md:4443 -- benefícios passivos; sem custo, usos ou recarga.',
  'Ladrão|17|Reflexos de Ladrão':
    'Classes.md:4447 -- benefício passivo (turno extra na primeira rodada); sem custo, usos ou recarga.',
  'Trapaceiro Arcano|3|Mãos Mágicas Ligeiras':
    'Classes.md:4502 -- modifica passivamente a conjuração de Mãos Mágicas; sem custo, usos ou recarga.',
  'Trapaceiro Arcano|9|Emboscada Mágica':
    'Classes.md:4506 -- benefício passivo automático enquanto Invisível; sem custo, usos ou recarga.',
  'Trapaceiro Arcano|13|Trapaceiro Versátil':
    'Classes.md:4510 -- amplia passivamente a opção Tropeço do Golpe Astuto (recurso já existente); sem limite próprio adicional.',
  // ---------------------------------------------------------------
  // Mago
  // ---------------------------------------------------------------
  'Abjurador|3|Versado em Abjuração':
    'Classes.md:4980 -- adiciona magias ao livro de magias, concessão permanente; sem custo, usos ou recarga.',
  'Abjurador|6|Proteção Projetada':
    'Classes.md:4984 -- Reação sem número de usos ou recarga próprios (usa os PV já existentes da Proteção Arcana).',
  'Abjurador|10|Rompe-Magia':
    'Classes.md:4990 -- concede magias sempre preparadas, mais benefício passivo de não gastar o espaço em caso de falha; não é recurso de uso limitado.',
  'Abjurador|14|Resistência à Magia':
    'Classes.md:4994 -- vantagem e resistência passivas e permanentes; sem custo, usos ou recarga.',
  'Adivinhador|3|Versado em Adivinhação':
    'Classes.md:5012 -- adiciona magias ao livro de magias, concessão permanente; sem custo, usos ou recarga.',
  'Adivinhador|6|Perito em Adivinhação':
    'Classes.md:5016 -- recupera automaticamente um espaço de magia inferior a cada conjuração de Adivinhação; sem limite de vezes declarado.',
  'Evocador|3|Truque Potente':
    'Classes.md:5040 -- benefício passivo e automático ao conjurar truques de dano; sem custo, usos ou recarga.',
  'Evocador|3|Versado em Evocação':
    'Classes.md:5046 -- adiciona magias ao livro de magias, concessão permanente; sem custo, usos ou recarga.',
  'Evocador|6|Esculpir Magias':
    'Classes.md:5050 -- benefício passivo e automático ao conjurar Evocação; sem custo, usos ou recarga.',
  'Evocador|10|Evocação Potencializada':
    'Classes.md:5054 -- bônus de dano passivo; sem custo, usos ou recarga.',
  'Ilusionista|3|Ilusões Aprimoradas':
    'Classes.md:5074 -- benefício passivo (alcance de Ilusão) mais um truque conhecido (concessão permanente, não "sempre preparada" -- ver SUBCLASSES_MAGIA_OUTRO_MECANISMO); sem custo, usos ou recarga.',
  'Ilusionista|3|Versado em Ilusão':
    'Classes.md:5080 -- adiciona magias ao livro de magias, concessão permanente; sem custo, usos ou recarga.',
  'Ilusionista|14|Realidade Ilusória':
    'Classes.md:5094 -- benefício passivo ligado a uma magia de Ilusão já em curso; sem número de usos ou recarga próprios.',
  // ---------------------------------------------------------------
  // Monge
  // ---------------------------------------------------------------
  'Combatente da Mão Espalmada|3|Técnica da Mão Espalmada':
    'Classes.md:5304 -- escolha de efeito a cada ataque da Torrente de Golpes (recurso já existente); sem limite próprio adicional.',
  'Combatente da Mão Espalmada|11|Passo Veloz':
    'Classes.md:5314 -- benefício passivo ligado ao Passo do Vento (recurso já existente); sem limite próprio adicional.',
  'Combatente da Mão Espalmada|17|Palma Vibrante':
    'Classes.md:5320 -- gasta 4 Pontos de Foco já existentes; limitado a uma criatura afetada por vez, não a um número de usos por Descanso.',
  'Combatente da Misericórdia|3|Implementos de Misericórdia':
    'Classes.md:5330 -- proficiências concedidas de forma permanente; sem custo, usos ou recarga.',
  'Combatente da Misericórdia|3|Mão de Cura':
    'Classes.md:5334 -- gasta 1 Ponto de Foco já existente (ou nenhum, via Torrente de Golpes); sem limite próprio adicional.',
  'Combatente da Misericórdia|6|Toque de Médico':
    'Classes.md:5346 -- amplia passivamente Mão de Cura e Mão de Dolo (níveis 3, que já têm o próprio custo em Ponto de Foco); não introduz limite adicional.',
  'Combatente das Sombras|3|Artes das Sombras':
    'Classes.md:5372 -- "Escuridão" gasta 1 Ponto de Foco já existente; "Ilusão Sombria" é magia conhecida (permanente); "Visão no Escuro" é passiva. Nenhuma cláusula introduz limite próprio.',
  'Combatente das Sombras|6|Passo da Sombra':
    'Classes.md:5380 -- Ação Bônus sem número de usos ou recarga declarados (condicionada a estar em Meia-luz/Escuridão).',
  'Combatente das Sombras|11|Passo da Sombra Aprimorado':
    'Classes.md:5384 -- gasta 1 Ponto de Foco já existente para remover uma restrição de Passo da Sombra; sem limite próprio adicional.',
  'Combatente das Sombras|17|Manto da Sombra':
    'Classes.md:5388 -- gasta 3 Pontos de Foco já existentes; duração própria (1 minuto), sem número de usos por Descanso declarado.',
  'Combatente dos Elementos|3|Manipular Elementos':
    'Classes.md:5404 -- concede um truque conhecido, concessão permanente; sem custo, usos ou recarga.',
  'Combatente dos Elementos|3|Sintonia Elemental':
    'Classes.md:5408 -- gasta 1 Ponto de Foco já existente; duração própria (10 minutos), sem número de usos por Descanso declarado.',
  'Combatente dos Elementos|6|Explosão Elemental':
    'Classes.md:5416 -- gasta 2 Pontos de Foco já existentes; sem limite próprio adicional.',
  'Combatente dos Elementos|11|Passo dos Elementos':
    'Classes.md:5422 -- benefício passivo enquanto Sintonia Elemental está ativa; sem custo, usos ou recarga.',
  // ---------------------------------------------------------------
  // Paladino
  // ---------------------------------------------------------------
  'Juramento da Devoção|3|Magias do Juramento da Devoção':
    'Classes.md:5711 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Juramento da Devoção|3|Arma Sagrada':
    'Classes.md:5725 -- consome um uso de Canalizar Divindade já existente; duração própria (10 minutos ou até reuso), sem número de usos por Descanso declarado.',
  'Juramento da Devoção|7|Aura de Devoção':
    'Classes.md:5733 -- imunidade passiva enquanto na Aura de Proteção; sem custo, usos ou recarga.',
  'Juramento da Devoção|15|Destruição Protetora':
    'Classes.md:5737 -- benefício passivo automático ao conjurar Destruição Divina; sem custo, usos ou recarga.',
  'Juramento da Glória|3|Atleta Inigualável':
    'Classes.md:5763 -- consome um uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Juramento da Glória|3|Destruição Inspiradora':
    'Classes.md:5767 -- consome um uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Juramento da Glória|3|Magias do Juramento da Glória':
    'Classes.md:5771 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Juramento da Glória|7|Aura de Vivacidade':
    'Classes.md:5787 -- benefícios passivos de Deslocamento; sem custo, usos ou recarga.',
  'Juramento da Vingança|3|Magias do Juramento da Vingança':
    'Classes.md:5819 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Juramento da Vingança|3|Voto de Inimizade':
    'Classes.md:5833 -- consome um uso de Canalizar Divindade já existente; duração própria (1 minuto ou até reuso), sem número de usos por Descanso declarado.',
  'Juramento da Vingança|7|Vingador Implacável':
    'Classes.md:5839 -- benefício passivo automático ao acertar Ataque de Oportunidade; sem custo, usos ou recarga.',
  'Juramento da Vingança|15|Alma Vingativa':
    'Classes.md:5843 -- Reação sem número de usos ou recarga declarados.',
  'Juramento dos Anciões|3|A Ira da Natureza':
    'Classes.md:5867 -- consome um uso de Canalizar Divindade já existente; sem limite próprio adicional.',
  'Juramento dos Anciões|3|Magias do Juramento dos Anciões':
    'Classes.md:5871 -- concede magias sempre preparadas por nível; não é recurso de uso limitado.',
  'Juramento dos Anciões|7|Aura de Resistência':
    'Classes.md:5885 -- resistências passivas enquanto na Aura de Proteção; sem custo, usos ou recarga.',
};
