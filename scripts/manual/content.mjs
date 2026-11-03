// Texto do manual (português de Portugal). Marcação: [[Rótulo]] = texto que aparece no ecrã (verde-lima),
// **x** = negrito, {{icon:Nome}} = ícone Lucide. Nas páginas de passos, `figs[].marks` associa o número de um passo
// a um alvo capturado em shots.mjs (opcionalmente [alvo, posição]: tl, tr, br, l, above); o texto do passo N é steps[N-1].

export const META = {
  title: 'Manual da plataforma ion',
  subtitle: 'Convite, app do evento, back-office e design system',
  short: 'Manual da plataforma ion',
  edition: 'Novembro 2026',
  appUrl: 'https://ionsportbiz.app',
};

export const PARTS = [
  { n: 1, title: 'Para os convidados', lead: 'Do convite à porta: responder, aguardar a aprovação e usar a credencial e a app do evento.' },
  { n: 2, title: 'Para a equipa ion', lead: 'O back-office: contactos, eventos, convites, aprovação, mensagens, check-in e equipa.' },
  { n: 3, title: 'Design system ion', lead: 'Marca, cor, tipografia, componentes, ícones, escrita e acessibilidade.' },
  { n: 4, title: 'Anexos', lead: 'Glossário, referência rápida e resolução de problemas.' },
];

export const CHAPTERS = [
  { n: '01', part: 1, title: 'Bem-vindo à ion' },
  { n: '02', part: 1, title: 'O seu convite' },
  { n: '03', part: 1, title: 'Confirmar a presença' },
  { n: '04', part: 1, title: 'Aprovação e credencial' },
  { n: '05', part: 1, title: 'A app do evento' },
  { n: '06', part: 1, title: 'Dicas para convidados' },
  { n: '07', part: 2, title: 'Entrar no back-office' },
  { n: '08', part: 2, title: 'Painel' },
  { n: '09', part: 2, title: 'Contactos e RGPD' },
  { n: '10', part: 2, title: 'Eventos' },
  { n: '11', part: 2, title: 'Acessos' },
  { n: '12', part: 2, title: 'Convidar e enviar' },
  { n: '13', part: 2, title: 'Aprovar convidados' },
  { n: '14', part: 2, title: 'Mensagens' },
  { n: '15', part: 2, title: 'Check-in à porta' },
  { n: '16', part: 2, title: 'Equipa' },
  { n: '17', part: 3, title: 'Marca' },
  { n: '18', part: 3, title: 'Cor' },
  { n: '19', part: 3, title: 'Tipografia' },
  { n: '20', part: 3, title: 'Componentes' },
  { n: '21', part: 3, title: 'Ícones e escrita' },
  { n: '22', part: 3, title: 'Acessibilidade' },
  { n: '23', part: 4, title: 'Referência rápida' },
  { n: '24', part: 4, title: 'Resolução de problemas' },
];

export const PAGES = [
  { type: 'cover' },
  { type: 'toc' },

  // ═══════════════════════════ PARTE 1 — CONVIDADOS ═══════════════════════════
  // 01 ─────────────────────────────────────────────
  { type: 'overview', chapter: '01', opener: true },
  { type: 'journey', chapter: '01' },

  // 02 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '02', opener: true, layout: 'row',
    title: 'Como chega o convite',
    intro: 'A ion é um evento apenas por convite. A equipa ion envia a cada convidado um **link pessoal**, por email ou por WhatsApp. É esse link que dá acesso ao convite: não há contas nem palavras-passe.',
    figs: [
      { shot: 'email', w: 92, min: 70, marks: { 1: ['subject', 'tl'], 2: 'greeting', 3: ['cta', 'tr'] } },
      { shot: 'whatsapp', w: 66, min: 50, marks: { 4: ['msg', 'tr'], 5: ['link', 'br'] } },
    ],
    steps: [
      'Por email, o assunto é [[Convite — ion Portugal 2027]] e o remetente é a organização da ion.',
      'O convite é nominal: começa pelo tratamento e pelo nome completo de V. Exa.',
      'Toque em [[Abrir o convite]] para abrir a sua página pessoal.',
      'Por WhatsApp, a mensagem é enviada por um elemento da equipa ion, com o texto do convite e o prazo de resposta.',
      'O endereço que termina em [[/c/…]] é o seu link pessoal. Toque nele para abrir o convite.',
    ],
    note: 'O link é pessoal e intransmissível: quem o tiver vê o seu convite e, depois de aprovado, a sua credencial. Não o reencaminhe. Se precisar de o recuperar, procure o email ou a mensagem original, ou contacte a organização.',
  },
  {
    type: 'steps', chapter: '02', layout: 'row',
    title: 'A página do convite',
    intro: 'O link abre o convite no browser do telemóvel ou do computador, sem instalar nada.',
    figs: [
      { shot: 'invite', marks: { 1: ['lang', 'l'], 2: 'greeting', 3: 'text', 4: 'name', 5: ['when', 'tr'], 6: 'dress' } },
      { shot: 'invite-rsvp', marks: { 7: 'deadline', 8: ['accept', 'tr'], 9: ['decline', 'tr'], 10: 'note' } },
    ],
    steps: [
      'Escolha o idioma: [[PT]] ou [[EN]].',
      'O convite dirige-se a V. Exa. pelo nome e tratamento registados pela equipa ion.',
      'Quem convida e para quê: o VIP Gala Dinner e a cerimónia dos ion Awards, a 22 de março, e a ion Conference, a 23 de março.',
      'O nome do evento.',
      'Data e hora, sempre na hora de Lisboa.',
      'O código de vestuário ([[Traje]]).',
      'O prazo para responder.',
      '[[Confirmo a minha presença]] abre o formulário de confirmação.',
      '[[Não poderei estar presente]] regista que não vai estar presente (pode deixar uma mensagem à organização).',
      'A presença fica sujeita a aprovação da equipa ion (ver o capítulo 04).',
    ],
    tip: 'Mais abaixo, na mesma página, encontra o [[Programa]], as [[Informações e contactos]] da organização e a secção [[Proteção de dados]].',
  },

  // 03 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '03', opener: true, layout: 'row',
    title: 'Responder ao convite',
    intro: 'Depois de tocar em [[Confirmo a minha presença]], o formulário abre na mesma página.',
    figs: [
      { shot: 'rsvp-form', marks: { 1: 'title', 2: ['companions', 'tr'], 3: ['extra', 'tr'] } },
      { shot: 'rsvp-submit', marks: { 4: ['note', 'tr'], 5: ['consent', 'tr'], 6: ['submit', 'tr'], 7: 'back' } },
    ],
    steps: [
      '[[Confirmação de presença]]: preencha os campos e confirme no fim.',
      '[[Far-se-á acompanhar?]] Escolha [[Sim]] e indique o nome completo do acompanhante. O número de acompanhantes é definido pela equipa ion para cada convite.',
      '[[Informações adicionais]]: restrições alimentares, estacionamento e necessidades de acessibilidade. Ajudam a equipa a preparar a sua receção.',
      '[[Mensagem para a organização]]: opcional.',
      'Consentimento para comunicações futuras: **opcional** e independente da resposta. Fica guardado com a data, como prova.',
      'Toque em [[Confirmar presença]].',
      '[[Voltar]] fecha o formulário sem enviar nada.',
    ],
    note: 'Se não puder estar presente, toque em [[Não poderei estar presente]] e depois em [[Enviar resposta]]. Até ao prazo de resposta pode sempre mudar de ideias com [[Alterar resposta]].',
  },

  // 04 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '04', opener: true, layout: 'row',
    title: 'A aguardar aprovação',
    intro: 'A ion é um evento apenas por convite: a equipa revê cada confirmação e escolhe o **tipo de acesso** de cada convidado. Até lá, a presença fica [[A aguardar aprovação]] e ainda não há código QR.',
    figs: [
      { shot: 'rsvp-awaiting', marks: { 1: 'status', 2: ['steps', 'tr'], 3: ['summary', 'tr'] } },
      { shot: 'app-pending', marks: { 4: 'card', 5: ['steps', 'tr'], 6: 'refresh' } },
    ],
    steps: [
      'No convite: [[Presença confirmada]] com o estado [[A aguardar aprovação]].',
      '[[Próximos passos]]: a presença está confirmada, a aprovação pela equipa da ion está [[Em análise]] e a credencial com o código QR ficará disponível nesta página.',
      'O resumo da sua resposta: acompanhantes e informações adicionais.',
      'Na app do evento, o separador [[Credencial]] mostra [[A aguardar aprovação da equipa ion]].',
      'Os quatro passos, do convite ao código QR. O passo atual aparece destacado.',
      '[[Verificar de novo]] consulta o estado. A app também verifica sozinha, de 30 em 30 segundos, enquanto este ecrã estiver aberto.',
    ],
    tip: 'Não precisa de fazer mais nada. Assim que a equipa aprovar, a credencial aparece no convite e na app; a equipa ion pode também avisá-lo(a) por email ou WhatsApp.',
  },
  {
    type: 'steps', chapter: '04', layout: 'row',
    title: 'A credencial com o código QR',
    intro: 'Depois de aprovada, a secção [[O seu acesso]] aparece no convite com o código QR e o tipo de acesso atribuído pela equipa ion.',
    figs: [
      { shot: 'ticket', marks: { 1: 'title', 2: ['qr', 'tr'], 3: 'code', 4: ['pass', 'tr'] } },
      { shot: 'ticket-more', marks: { 5: ['includes', 'tr'], 6: ['meta', 'tr'], 7: ['app', 'tr'], 8: 'calendar' } },
    ],
    steps: [
      '[[O seu acesso]]: o bilhete do evento.',
      'O código QR, que a equipa de receção lê à entrada.',
      'O código de entrada, em blocos de cinco caracteres. Serve se o QR não puder ser lido.',
      '[[Tipo de acesso]]: por exemplo, [[VIP Pass]] ou [[Conference Pass]].',
      '[[Inclui]]: os momentos do evento a que o seu acesso dá entrada.',
      'O seu nome, cargo e entidade, e os acompanhantes indicados.',
      '[[Abrir a app do evento]] abre a app já com a sua credencial.',
      '[[Adicionar ao calendário]] (ficheiro .ics) ou [[Google Calendar]].',
    ],
  },
  {
    type: 'states', chapter: '04', layout: 'row',
    title: 'Os estados da credencial',
    intro: 'O separador [[Credencial]] da app, e o convite, mostram sempre o ponto em que está a sua presença.',
    figs: [
      { shot: 'app-unconfirmed', w: 66, min: 50, marks: { 1: 'card', 2: ['confirm', 'tr'] } },
      { shot: 'app-rejected', w: 66, min: 50, marks: { 3: 'card', 4: ['contact', 'tr'] } },
    ],
    steps: [
      '[[Confirme a sua presença]]: ainda não respondeu ao convite.',
      '[[Confirmar presença]] abre o convite para responder.',
      'A equipa ion não pôde confirmar o seu lugar nesta edição.',
      '[[Contactar a organização]] para qualquer questão.',
    ],
    legend: 'credential',
  },

  // 05 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '05', opener: true, layout: 'row',
    title: 'Entrar na app do evento',
    intro: 'A app do evento ([[ionsportbiz.app]]) reúne o programa, os oradores, o networking e a credencial. É exclusiva para convidados: entra-se com o mesmo link pessoal do convite. No convite aprovado, [[Abrir a app do evento]] faz este passo por si.',
    figs: [
      { shot: 'welcome', marks: { 1: ['lang', 'l'], 2: 'exclusive', 3: ['cta', 'tr'], 4: 'contact' } },
      { shot: 'welcome-link', marks: { 5: ['field', 'tr'], 6: ['submit', 'tr'], 7: 'legal' } },
    ],
    steps: [
      'Escolha o idioma: [[PT]] ou [[EN]].',
      '[[Exclusiva para convidados]]: sem convite, a app não abre.',
      'Toque em [[Abrir o meu convite]].',
      '[[Não recebeu convite?]] Contacte a organização.',
      'Cole em [[Link do convite]] o link pessoal do email ou da mensagem de WhatsApp. O código no fim do link também serve.',
      'Toque em [[Continuar]]. A app abre no ecrã [[Início]] e fica guardada neste dispositivo.',
      'O link é pessoal: dá acesso à sua credencial. Não o partilhe.',
    ],
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'Início e navegação',
    figs: [
      { shot: 'home', marks: { 1: ['bell', 'tr'], 2: ['countdown', 'tr'], 3: 'alert' } },
      { shot: 'nav', marks: { 4: ['quick', 'tr'], 5: ['home', 'above'], 6: ['agenda', 'above'], 7: ['pass', 'above'], 8: ['network', 'above'], 9: ['more', 'above'], 10: ['badge', 'tr'] } },
    ],
    steps: [
      'O sino abre as [[Notícias]].',
      'A saudação com o seu nome e a contagem decrescente para o PT ’27.',
      'Pedidos de ligação ou de reunião por responder. Toque para os ver.',
      'Atalhos. O cartão [[Credencial]] mostra o tipo de acesso (ou, até à aprovação, o estado da presença).',
      '[[Início]]: resumo do evento.',
      '[[Agenda]]: o programa dos dois dias.',
      '[[Credencial]]: o botão central abre o seu código QR.',
      '[[Networking]]: pessoas, ligações e reuniões 1:1.',
      '[[Mais]]: perfil, oradores, parceiros, notícias, informações e idioma.',
      'O número vermelho conta os pedidos que aguardam a sua resposta.',
    ],
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'Agenda e o seu acesso',
    intro: 'Algumas sessões são reservadas (por exemplo, a noite de gala e o VIP Lunch). A agenda indica, sessão a sessão, se estão incluídas no tipo de acesso que a equipa ion lhe atribuiu.',
    figs: [
      { shot: 'agenda-vip', marks: { 1: 'days', 2: ['chips', 'tr'], 3: ['vip', 'tr'], 4: ['included', 'br'], 5: ['star', 'tr'] } },
      { shot: 'session-note', marks: { 6: ['note', 'tr'] } },
    ],
    steps: [
      'Escolha o dia: [[22]] (noite VIP) ou [[23]] (ion Conference).',
      '[[A minha agenda]] mostra só as sessões que marcou com estrela; os restantes filtros mostram um palco.',
      '[[VIP]]: sessão reservada.',
      '[[Incluído]]: o seu acesso inclui esta sessão. Com outro tipo de acesso aparece [[Não incluído]], e o cartão fica esbatido.',
      'A estrela adiciona a sessão à sua agenda.',
      'No detalhe de uma sessão reservada, a app diz se está incluída no seu acesso (aqui, com [[Conference Pass]]: [[Não incluído no seu acesso]]).',
    ],
    note: 'Enquanto a presença não estiver aprovada, as sessões reservadas indicam apenas que são exclusivas para convidados com acesso VIP. O tipo de acesso é sempre atribuído pela equipa ion.',
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'Sessões e oradores',
    figs: [
      { shot: 'session', marks: { 1: ['back', 'tr'], 2: 'facts', 3: 'fav', 4: ['cal', 'tr'], 5: ['speaker', 'tr'] } },
      { shot: 'speakers', marks: { 6: 'search', 7: 'card' } },
    ],
    steps: [
      'A seta volta ao ecrã anterior.',
      'Dia, horário e palco, seguidos da descrição.',
      '[[Adicionar à minha agenda]] marca a sessão com estrela.',
      '[[Adicionar ao calendário]] descarrega um ficheiro .ics para o calendário do telemóvel.',
      'Toque num orador para ver o perfil e as sessões dele.',
      'Em [[Mais]] › [[Oradores]], pesquise por nome, empresa ou cargo.',
      'Cada cartão abre o perfil do orador.',
    ],
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'A credencial na app',
    intro: 'O botão central [[Credencial]] abre o mesmo código QR do convite, a partir de qualquer ecrã.',
    figs: [
      { shot: 'app-cred', marks: { 1: ['type', 'tr'], 2: 'qr', 3: 'name', 4: 'plus', 5: ['code', 'tr'] } },
      { shot: 'app-cred-access', marks: { 6: 'hint', 7: ['access', 'tr'] } },
    ],
    steps: [
      'O tipo de acesso. O passe VIP tem o contorno com o gradiente da marca.',
      'O código QR a apresentar à entrada.',
      'O seu nome, cargo e entidade.',
      'Os acompanhantes ([[Com]]).',
      'O [[Código de entrada]], para ditar se o QR não puder ser lido.',
      'Aumente o brilho do ecrã antes de apresentar o código.',
      '[[Incluído no seu acesso]]: a lista definida pela equipa ion para o seu tipo de acesso.',
    ],
    tip: 'Abra a credencial uma vez com rede antes de sair: a app guarda-a neste dispositivo e mostra-a mesmo sem ligação, com o aviso [[Sem ligação — a mostrar a credencial guardada neste dispositivo]].',
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'Networking: pessoas e ligações',
    figs: [
      { shot: 'net-people', marks: { 1: 'tabs', 2: 'search', 3: ['chips', 'tr'], 4: 'person', 5: ['connect', 'tr'], 6: ['incoming', 'tr'] } },
      { shot: 'net-connections', marks: { 7: ['tab', 'tr'], 8: 'accept', 9: ['decline', 'tr'], 10: ['connected', 'tr'] } },
    ],
    steps: [
      'Três separadores: [[Pessoas]], [[Ligações]] e [[Reuniões]].',
      'Pesquise por nome, empresa, cargo ou interesse.',
      'Filtre por setor: [[Clubes & Ligas]], [[Investimento]], [[Media]], [[Marcas]], [[Tecnologia]], [[Saúde]], [[Setor público & Recintos]].',
      'Toque no nome para ver o perfil.',
      '[[Ligar]] envia um pedido de ligação.',
      'Pedido recebido: ✓ aceita, ✕ recusa.',
      '[[Ligações]]: pedidos recebidos e ligações aceites.',
      'Toque em ✓ para aceitar: a pessoa passa a [[Ligado]].',
      '✕ recusa o pedido.',
      'O ícone {{icon:UserCheck}} marca uma ligação aceite pelas duas partes.',
    ],
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'Reuniões 1:1',
    intro: 'As reuniões 1:1 decorrem no Networking Lounge, a 23 de março. Não é preciso estar ligado à pessoa para pedir uma reunião.',
    figs: [
      { shot: 'slot', marks: { 1: 'head', 2: 'slots', 3: ['chosen', 'tr'], 4: ['send', 'tr'] } },
      { shot: 'meetings', marks: { 5: ['tab', 'tr'], 6: 'outgoing', 7: 'incoming', 8: ['accept', 'tr'] } },
    ],
    steps: [
      'Abra o perfil da pessoa e toque em [[Pedir reunião 1:1]].',
      'Os horários livres. Os que já têm uma reunião ou um pedido (enviado ou recebido) aparecem esbatidos.',
      'Escolha o horário.',
      'Toque em [[Enviar pedido]].',
      '[[Reuniões]] lista as reuniões por ordem de horário.',
      'Pedido enviado: [[A aguardar resposta]].',
      'Pedido recebido, com contorno vermelho.',
      '[[Aceitar]] confirma a reunião; [[Recusar]] retira-a.',
    ],
  },
  {
    type: 'steps', chapter: '05', layout: 'row',
    title: 'Perfil, notícias e definições',
    figs: [
      { shot: 'more', w: 54, min: 44, marks: { 1: 'me', 2: 'menu', 3: ['lang', 'l'], 4: 'contact', 5: 'logout' } },
      { shot: 'profile', w: 54, min: 44, marks: { 6: ['invite', 'tr'], 7: ['sector', 'tr'], 8: ['interests', 'tr'] } },
      { shot: 'news', w: 54, min: 44, marks: { 9: 'item' } },
    ],
    steps: [
      'O seu nome, cargo, entidade e o tipo de acesso (ou o estado da presença).',
      '[[A minha agenda]], [[Oradores]], [[Parceiros]], [[Notícias]] e [[Informações & FAQ]].',
      '[[Idioma]]: [[PT]] ou [[EN]].',
      '[[Contactar a organização]].',
      '[[Sair deste dispositivo]] esquece o convite neste dispositivo (pede confirmação). Para voltar a entrar, use de novo o link pessoal.',
      '[[Do seu convite]]: nome, cargo e empresa vêm do convite. Para os corrigir, contacte a organização.',
      '[[Setor]], para o networking.',
      '[[Interesses]]: ajudam a sugerir pessoas. Ficam só neste dispositivo. Toque em [[Guardar]].',
      '[[Notícias]]: toque numa notícia para a ler.',
    ],
  },

  // 06 ─────────────────────────────────────────────
  { type: 'faq', chapter: '06', opener: true, items: 'guest' },

  // ═══════════════════════════ PARTE 2 — EQUIPA ═══════════════════════════
  // 07 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '07', opener: true, layout: 'side',
    title: 'Iniciar sessão',
    intro: 'O back-office está em [[ionsportbiz.app/admin]] e é reservado à equipa ion. As contas são criadas por convite de um administrador (capítulo 16).',
    wideExtras: true,
    figs: [{ shot: 'login', w: 92, min: 80, marks: { 1: 'email', 2: 'password', 3: ['submit', 'tr'], 4: ['link', 'tr'] } }],
    steps: [
      'Indique o email profissional.',
      'Escreva a palavra-passe.',
      'Clique em [[Entrar]].',
      'Sem palavra-passe? [[Receber link de acesso por email]] envia um link de entrada (abra-o no mesmo dispositivo).',
    ],
    roles: true,
  },

  // 08 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '08', opener: true, layout: 'stack',
    title: 'O painel do evento',
    intro: 'O [[Painel]] é a página inicial do back-office: o estado do evento em foco, num relance. O menu lateral dá acesso a [[Painel]], [[Eventos]], [[Contactos]], [[Check-in]] e, para administradores, [[Equipa]]; no fundo, o seu nome e o botão para terminar a sessão.',
    figs: [{ shot: 'dashboard', marks: { 1: ['event', 'tl'], 2: 'hero', 3: 'funnel', 4: ['approval', 'tr'], 5: ['approveAll', 'l'], 6: ['checkin', 'tl'] } }],
    steps: [
      'O evento em foco. Escolha outro na lista.',
      'Estado, datas, prazo de resposta e atalhos para [[Programa]], [[Acessos]], [[Mensagens]] e [[Definições]]. Por baixo: convidados, pessoas esperadas, taxa de resposta e convites vistos.',
      '[[Funil de respostas]]: convidados, enviados, vistos, responderam e confirmados; e o estado de todos os convites.',
      '[[Aprovação]]: quantos estão [[Por aprovar]], [[Aprovados]] e [[Não aprovados]], e as pessoas por tipo de acesso.',
      '[[Aprovar N confirmações]] abre a lista já filtrada nos que aguardam aprovação.',
      '[[Abrir check-in]] e [[Ver convidados]].',
    ],
    tip: 'Mais abaixo: [[Por vaga]], [[Por segmento]], [[A acompanhar]] (avisos, como convites por enviar ou confirmações por aprovar) e [[Atividade recente]].',
  },

  // 09 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '09', opener: true, layout: 'stack',
    title: 'Lista de contactos',
    intro: 'Os [[Contactos]] são o CRM da ion: cada pessoa existe uma só vez e é reutilizada de evento para evento, com o histórico de convites e respostas.',
    figs: [{ shot: 'contacts', marks: { 1: ['actions', 'tl'], 2: 'erasure', 3: 'filters', 4: 'table', 5: ['consent', 'tr'] } }],
    steps: [
      '[[Importar]] um ficheiro CSV, [[Exportar CSV]] a lista apresentada ou criar um [[Novo contacto]].',
      'Pedidos de eliminação de dados feitos pelos convidados, com o prazo de resposta (ver a página RGPD).',
      'Pesquisa por nome, email, entidade ou telemóvel, e filtros por [[Segmento]], [[Etiqueta]] e [[Comunicações]].',
      'Clique num contacto para abrir a ficha. Selecione vários para [[Convidar para evento…]] ou [[Exportar seleção]].',
      '[[Comunicações]]: se a pessoa aceitou receber comunicações futuras.',
    ],
  },
  {
    type: 'steps', chapter: '09', layout: 'stack',
    title: 'A ficha do contacto',
    figs: [{ shot: 'contact', marks: { 1: 'header', 2: ['actions', 'tr'], 3: 'data', 4: ['consent', 'tr'], 5: 'invites', 6: ['timeline', 'tr'] } }],
    steps: [
      'Nome, cargo, entidade e etiquetas.',
      '[[Convidar]] para um evento, [[Editar]] e [[Mais ações]] (RGPD).',
      '[[Dados do contacto]]: tratamento, email, telemóvel, segmento, idioma dos convites, responsável e origem.',
      '[[Comunicações futuras]]: o consentimento, com a data e o texto aceite.',
      '[[Convites]]: os eventos para que foi convidado, o estado e a aprovação.',
      '[[Linha do tempo]]: convites, envios, respostas, aprovações, entradas e notas da equipa. Escreva uma nota e clique em [[Acrescentar nota]].',
    ],
  },
  {
    type: 'steps', chapter: '09', layout: 'stack',
    title: 'Importar contactos (CSV)',
    intro: 'Em [[Contactos]] › [[Importar]]. Três passos: [[Ficheiro]], [[Colunas]] e [[Importação]].',
    figs: [{ shot: 'import-map', marks: { 1: 'steps', 2: ['map', 'tl'] } }],
    steps: [
      'Escolha ou arraste o ficheiro .csv. No Excel, guarde-o como [[CSV UTF-8 (delimitado por vírgulas)]]. A primeira linha tem os nomes das colunas.',
      'Confirme a correspondência entre cada coluna e o campo do contacto. O nome (ou o nome completo) é obrigatório. A pré-visualização mostra as primeiras linhas e os problemas encontrados.',
    ],
    box: {
      title: 'Sem repetidos',
      items: [
        'Os contactos são identificados pelo **email** ou, sem email, pelo **telemóvel**.',
        'Quem já existir é **atualizado apenas nos campos vazios**: nada do que já está no CRM é apagado.',
        'Telemóveis portugueses podem ir sem indicativo; os estrangeiros começam por + ou 00.',
        'Várias etiquetas na mesma célula separam-se por vírgulas.',
        'No passo [[Importação]] pode, opcionalmente, convidar logo os contactos para um evento, com a vaga e os acompanhantes.',
      ],
    },
  },
  {
    type: 'steps', chapter: '09', layout: 'side',
    title: 'Privacidade e RGPD',
    intro: 'Na ficha do contacto, [[Mais ações]] reúne as operações de proteção de dados.',
    figs: [
      { shot: 'contact-gdpr', w: 96, min: 80, marks: { 1: ['export', 'l'], 2: ['erase', 'l'] } },
    ],
    steps: [
      '[[Exportar dados (RGPD)]] descarrega um ficheiro com os dados pessoais da pessoa (direito de acesso).',
      '[[Apagar dados pessoais]] anonimiza o contacto: mantém-se só o registo anónimo dos convites, para as estatísticas não mudarem. Use esta opção para responder a um pedido de apagamento (artigo 17.º do RGPD).',
      '[[Eliminar contacto]] apaga a pessoa e os convites; as estatísticas dos eventos deixam de a contar.',
    ],
    box: {
      title: 'Pedidos dos convidados',
      items: [
        'No convite, em [[Proteção de dados]], o convidado pode [[Pedir a eliminação dos meus dados]].',
        'O pedido aparece em [[Contactos]], com o prazo de resposta: **um mês** (artigo 12.º do RGPD).',
        'Abra a ficha, confirme a identidade se houver dúvidas e use [[Apagar dados pessoais]]. O pedido sai da lista.',
        'Só um **Administrador** pode apagar dados pessoais.',
        'O consentimento para comunicações é separado, opcional e guardado com o texto e a data.',
      ],
    },
  },

  // 10 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '10', opener: true, layout: 'stack',
    title: 'Eventos e programa',
    figs: [
      { shot: 'events', marks: { 1: 'tabs', 2: 'card', 3: ['create', 'tl'] } },
      { shot: 'programme', marks: { 4: ['add', 'tl'], 5: 'day' } },
    ],
    steps: [
      '[[Próximos]], [[Anteriores]] e [[Arquivados]].',
      'Cada evento mostra a data, o estado, os convidados, as respostas e a lotação. Clique para abrir a lista de convidados.',
      '[[Novo evento]] cria um evento. Pode [[Partir de um evento anterior]]: copia o local, o contacto, as perguntas, a imagem e a informação de privacidade.',
      'No separador [[Programa]] do evento, [[Adicionar sessão]]: horário, título, local e oradores.',
      'As sessões aparecem por dia, na hora de Lisboa, e são visíveis na página do convite.',
    ],
  },
  {
    type: 'steps', chapter: '10', layout: 'stack',
    title: 'Definições do evento',
    intro: 'O separador [[Definições]] tem as secções [[Identificação]], [[Data e local]], [[Convidados e contacto]], [[Aprovação da equipa]], [[Formulário de resposta]], [[Imagem]], [[Privacidade (RGPD)]] e [[Estado]]. As alterações aparecem de imediato na página do convite.',
    grid: 2,
    figs: [
      { shot: 'settings-approval', w: 184, min: 140, span: true, marks: { 1: 'on', 2: ['off', 'tr'] } },
      { shot: 'settings-status', w: 90, min: 70, marks: {} },
      { shot: 'settings-privacy', w: 90, min: 70, marks: { 3: 'controller', 4: 'policy', 5: 'consent' } },
    ],
    steps: [
      '[[Com aprovação]] (recomendado para a ion): quem confirma fica [[Por aprovar]] até a equipa escolher o tipo de acesso; só então recebe o código QR e a lista de acessos.',
      '[[Sem aprovação]]: quem confirma recebe logo a credencial.',
      '[[Responsável pelo tratamento dos dados]]: a entidade, com morada. Obrigatório para abrir o evento.',
      '[[Política de privacidade]]: o endereço da página da entidade.',
      '[[Consentimento para comunicações futuras]]: o texto da caixa opcional que o convidado pode assinalar.',
    ],
    legend: 'event-status',
  },

  // 11 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '11', opener: true, layout: 'stack-side',
    title: 'Tipos de acesso',
    intro: 'Os tipos de acesso (por exemplo, [[VIP Pass]] e [[Conference Pass]]) definem o que cada convidado pode fazer no evento. São escolhidos pela equipa ao aprovar; o convidado nunca os escolhe. Separador [[Acessos]] do evento.',
    figs: [
      { shot: 'passes', w: 150, min: 110, marks: { 1: 'vip', 2: ['conf', 'tr'] } },
      { shot: 'pass-edit', w: 92, min: 72, marks: { 3: 'name', 4: 'accesses', 5: 'color', 6: ['preview', 'tr'] } },
    ],
    steps: [
      'Cada cartão mostra a descrição, o que inclui e quantos convidados aprovados o usam (e os pré-aprovados ainda sem resposta).',
      'O menu ⋯ do cartão permite editar ou eliminar (só sem convidados aprovados). Para criar outro, use [[Novo tipo de acesso]]; num evento novo, [[Criar VIP Pass e Conference Pass]] cria os dois habituais.',
      '[[Nome]] e [[Descrição]] (opcional), que o convidado vê.',
      '[[Acessos incluídos]], pela ordem em que o convidado os vê. Prima Enter para acrescentar; pode colar vários, um por linha.',
      '[[Cor]] e [[Ordem]]: a cor ajuda a receção a distinguir os acessos (por exemplo, pulseiras da mesma cor).',
      '[[Como o convidado vê]]: a pré-visualização da credencial.',
    ],
  },

  // 12 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '12', opener: true, layout: 'stack',
    title: 'A lista de convidados',
    intro: 'Abra o evento em [[Eventos]]. O separador [[Convidados]] é onde se trabalha no dia a dia.',
    figs: [{ shot: 'guests', marks: { 1: ['capacity', 'tl'], 2: ['actions', 'tl'], 3: 'alert', 4: 'status', 5: 'approval', 6: 'toolbar', 7: 'table' } }],
    steps: [
      'Pessoas esperadas (com acompanhantes) face à lotação.',
      '[[Adicionar convidados]] a partir do CRM e [[Enviar convites]] (o número indica os convites por enviar).',
      'Aviso das confirmações que aguardam aprovação, com [[Ver por aprovar]].',
      'Filtros por estado do convite: [[Por enviar]], [[Enviados]], [[Vistos]], [[Confirmados]], [[Recusados]], [[Cancelados]].',
      'Filtros por aprovação: [[Por aprovar]], [[Aprovados]], [[Não aprovados]].',
      'Pesquisa, filtro por vaga e [[Exportar]] (CSV para Excel).',
      'Colunas: convidado, estado, aprovação e tipo de acesso, vaga, acompanhantes, envio, resposta e entrada. Clique num nome para abrir a ficha do convidado.',
    ],
  },
  {
    type: 'steps', chapter: '12', layout: 'row',
    title: 'Adicionar convidados e enviar por email',
    figs: [
      { shot: 'add-guests', w: 72, min: 60, marks: { 1: 'search', 2: ['already', 'tr'], 3: 'wave', 4: ['submit', 'tr'] } },
      { shot: 'send-dialog', w: 108, min: 86, marks: { 5: 'template', 6: 'figures', 7: 'preview', 8: ['submit', 'tr'] } },
    ],
    steps: [
      'Pesquise e assinale os contactos. Quem já está na lista aparece como [[Já convidado]].',
      'Contactos já convidados não podem ser assinalados de novo.',
      '[[Vaga]] (opcional, ex.: Convidados de honra, 1.ª vaga) e [[Acompanhantes permitidos]].',
      'Clique em [[Adicionar]]: os convites ficam [[Por enviar]].',
      '[[Enviar convites]]: escolha o [[Modelo de email]] (editam-se em [[Mensagens]]).',
      'Quantos recebem o email, quantos não têm email registado e quantos são reenvios.',
      'A pré-visualização mostra o email de um dos convidados, com as variáveis já substituídas.',
      '[[Enviar N emails]]: cada convidado recebe o seu link pessoal; o envio fica no histórico do convite.',
    ],
    note: 'O evento tem de estar [[Aberto]] (em [[Definições]] › [[Estado]]) para os links abrirem. Com convidados selecionados na lista, pode enviar só a esses ou a todos os convites por enviar.',
  },
  {
    type: 'steps', chapter: '12', layout: 'side',
    title: 'Ficha do convidado: link pessoal e WhatsApp',
    intro: 'Clique no nome de um convidado para abrir a ficha.',
    figs: [{ shot: 'drawer-send', w: 92, min: 74, marks: { 1: ['identity', 'tr'], 2: 'link', 3: ['qr', 'tr'], 4: 'email', 5: ['whatsapp', 'tr'] } }],
    steps: [
      'Estado do convite, tipo de acesso, vaga, email e telemóvel, e [[Ver ficha do contacto]].',
      '[[Link pessoal]]: [[Copiar]] ou [[Pré-visualizar]] (abre o convite sem contar como aberto pelo convidado).',
      'Código QR do link, para impressão (convites em papel).',
      '[[Email]]: escolha o modelo e [[Enviar email]] (ou [[Reenviar email]]).',
      '[[WhatsApp]]: [[Ver mensagem]] mostra o texto; [[Enviar por WhatsApp]] abre o WhatsApp de quem envia com a mensagem escrita. O envio é confirmado no próprio WhatsApp e o convite fica marcado como enviado.',
    ],
    tip: 'Convite entregue em mão, por telefone ou pelo secretariado? Use [[Entregue por outra via? Marcar como enviado]]. Se a resposta chegar por telefone ou email, registe-a em [[Resposta]] › [[Registar resposta]].',
  },

  // 13 ─────────────────────────────────────────────
  { type: 'approval-flow', chapter: '13', opener: true },
  {
    type: 'steps', chapter: '13', layout: 'stack-side',
    title: 'Aprovar e escolher o tipo de acesso',
    figs: [
      { shot: 'guests-pending', marks: { 1: 'filter', 2: 'rows', 3: 'bulk', 4: ['approve', 'tl'] } },
      { shot: 'approve-dialog', w: 100, min: 80, marks: { 5: 'vip', 6: ['conference', 'tr'], 7: 'info', 8: ['submit', 'tl'] } },
    ],
    steps: [
      'Em [[Aprovação]], clique em [[Por aprovar]] (ou, no painel, em [[Aprovar N confirmações]]).',
      'Assinale os convidados a aprovar. [[Selecionar os N]] assinala todos os da lista.',
      'A barra de ações mostra quantos estão selecionados.',
      'Clique em [[Aprovar…]].',
      'Escolha o tipo de acesso. A descrição e a lista de acessos ajudam a escolher.',
      'Para convidados diferentes, aprove em grupos: um tipo de acesso por vez.',
      'O convidado só vê o código QR e a lista de acessos depois de aprovado. **Não é enviada nenhuma mensagem automática.**',
      'Clique em [[Aprovar com VIP Pass]] (o botão mostra o tipo escolhido).',
    ],
    tip: 'Para avisar os aprovados, selecione-os e envie um email com um modelo de [[Mensagens]], ou use o WhatsApp a partir da ficha de cada um.',
  },
  {
    type: 'steps', chapter: '13', layout: 'row',
    title: 'Não aprovar, repor e mudar o acesso',
    figs: [
      { shot: 'reject-dialog', w: 90, min: 70, marks: { 1: 'title', 2: 'reason', 3: ['submit', 'tr'] } },
      { shot: 'drawer-approval', w: 84, min: 64, marks: { 4: 'approval', 5: ['change', 'tr'], 6: 'checkin' } },
    ],
    steps: [
      '[[Mais ações]] › [[Não aprovar…]]: o convidado não recebe o código QR nem a lista de acessos e deixa de contar para a lotação.',
      '[[Motivo]] (opcional): fica no histórico e só a equipa o vê. O convidado não é avisado automaticamente.',
      'Clique em [[Não aprovar]].',
      'Na ficha do convidado, a secção [[Aprovação]] mostra o tipo de acesso, quem aprovou e quando.',
      '[[Mudar tipo de acesso…]], [[Não aprovar…]] ou [[Repor]] (volta a [[Por aprovar]] e o convidado deixa de ver o QR até nova aprovação).',
      '[[Entrada]]: o código de entrada e se o convidado já entrou.',
    ],
    note: '**Pré-aprovar.** Pode aprovar quem ainda não respondeu (por exemplo, convidados de honra): fica [[Pré-aprovado]] e o convite mostra [[O seu acesso VIP Pass já está reservado]]. Recebe a credencial assim que confirmar a presença. Depois de o convidado entrar no evento, a aprovação já não pode ser retirada.',
  },

  // 14 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '14', opener: true, layout: 'stack',
    title: 'Modelos de mensagem',
    intro: 'No separador [[Mensagens]] do evento estão os modelos de **email** (enviados pela plataforma, a partir do remetente institucional) e de **WhatsApp** (abertos no WhatsApp de quem envia). [[Novo modelo]] cria outro; clique num modelo para o editar.',
    figs: [{ shot: 'template-edit', w: 170, min: 130, marks: { 1: 'subject', 2: ['vars', 'tr'], 3: ['preview', 'tr'] } }],
    steps: [
      '[[Nome do modelo]], [[Canal]] (Email ou WhatsApp) e [[Assunto]] (só no email).',
      '[[Mensagem]]: clique numa variável para a inserir no ponto do cursor. Uma linha em branco separa parágrafos; a linha só com o {{link}} dá lugar ao botão [[Abrir o convite]].',
      '[[Pré-visualização]]: o email ou a mensagem tal como um convidado os recebe. Escolha outro convidado em [[Pré-visualizar para]].',
    ],
    variables: true,
  },

  // 15 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '15', opener: true, layout: 'row',
    title: 'Preparar a porta',
    intro: 'O check-in faz-se em [[ionsportbiz.app/admin/check-in]], no telemóvel ou no computador. O papel [[Receção]] vê só este ecrã.',
    figs: [
      { shot: 'checkin', marks: { 1: 'menu', 2: ['event', 'tr'], 3: ['count', 'tr'], 4: 'modes' } },
      { shot: 'checkin-code', marks: { 5: ['camera', 'tr'], 6: ['code', 'tr'], 7: 'recent' } },
    ],
    steps: [
      'O menu do back-office (no telemóvel).',
      'O evento. Confirme que é o de hoje (aparece um aviso se não for).',
      '[[Entradas]]: quantas pessoas já entraram, face às esperadas. Atualiza-se sozinho.',
      '[[Ler código]] usa a câmara; [[Pesquisar]] procura pelo nome, apelido, entidade ou acompanhante.',
      'Aponte a câmara ao código QR do bilhete (no convite ou na app). A leitura é automática e o convidado aparece logo.',
      '[[Introduzir código]]: os 10 caracteres por baixo do QR (espaços e hífenes são ignorados). Clique em [[Procurar]].',
      '[[Últimas entradas]] registadas neste dispositivo, para consulta rápida.',
    ],
    tip: 'Se a câmara não estiver disponível (sem autorização do browser ou ocupada por outra app), o ecrã oferece [[Tentar novamente]], [[Introduzir código]] e [[Pesquisar por nome]].',
  },
  {
    type: 'steps', chapter: '15', layout: 'row',
    title: 'Registar a entrada',
    figs: [
      { shot: 'checkin-result', marks: { 1: 'person', 2: ['pass', 'tr'], 3: ['companions', 'tr'], 4: ['cta', 'tr'] } },
      { shot: 'checkin-done', marks: { 5: ['done', 'tr'] } },
    ],
    steps: [
      'O convidado: tratamento, nome, entidade, estado e vaga.',
      '[[Tipo de acesso]] e o que inclui, para orientar o convidado (ex.: pulseira da cor do acesso).',
      '[[Acompanhantes]]: assinale os que chegaram.',
      '[[Registar entrada]] (o botão indica os acompanhantes).',
      '[[Entrada registada]], com a hora. O ecrã volta sozinho para o próximo convidado (ou clique em [[Próximo convidado]]).',
    ],
    note: 'Se o código já tiver sido usado, o ecrã avisa que a entrada já foi registada e a que horas: não volte a dar entrada; confirme a identidade se tiver dúvidas. Administradores e editores podem [[Anular entrada]].',
  },
  {
    type: 'steps', chapter: '15', layout: 'row',
    title: 'Avisos e entradas excecionais',
    intro: 'O ecrã de check-in avisa quando a pessoa não deve entrar sem indicação da organização.',
    figs: [
      { shot: 'checkin-warning', marks: { 1: ['notice', 'tr'], 2: ['cta', 'tr'] } },
      { shot: 'checkin-force', marks: { 3: ['dialog', 'tr'], 4: ['confirm', 'tr'] } },
    ],
    steps: [
      '[[Presença por aprovar]]: confirmou presença, mas a equipa ainda não aprovou nem atribuiu o tipo de acesso. Com [[Presença não aprovada pela equipa]], o aviso é vermelho.',
      '[[Dar entrada mesmo assim]], só com indicação da organização.',
      'É pedida confirmação: [[Dar entrada sem aprovação?]]',
      '[[Dar entrada]] regista a entrada forçada, assinalada na lista de [[Últimas entradas]].',
    ],
    legend: 'checkin',
  },

  // 16 ─────────────────────────────────────────────
  {
    type: 'steps', chapter: '16', opener: true, layout: 'stack-side',
    title: 'Equipa e papéis',
    intro: 'Só administradores veem [[Equipa]]. Cada membro entra com o seu email; o papel define o que pode ver e fazer.',
    figs: [
      { shot: 'team', marks: { 1: ['invite', 'tl'], 2: 'role', 3: ['active', 'tr'], 4: 'roles' } },
      { shot: 'team-invite', w: 92, min: 70, marks: { 5: ['role', 'tr'], 6: ['submit', 'tl'] } },
    ],
    steps: [
      '[[Convidar membro]].',
      'O papel de cada membro: [[Administrador]], [[Editor]], [[Receção]] ou [[Leitura]].',
      'Ativar ou desativar uma conta. Uma conta desativada deixa de entrar; o histórico mantém-se.',
      '[[Papéis e permissões]]: o quadro do que cada papel pode fazer.',
      'Indique o nome completo, o email profissional e o papel.',
      '[[Enviar convite]]: a pessoa recebe um email com um link para entrar. Não precisa de criar palavra-passe.',
    ],
    note: 'Tem de existir sempre pelo menos um administrador ativo.',
  },

  // ═══════════════════════════ PARTE 3 — DESIGN SYSTEM ═══════════════════════════
  { type: 'ds-brand', chapter: '17', opener: true },
  { type: 'ds-color', chapter: '18', opener: true },
  { type: 'ds-type', chapter: '19', opener: true },
  { type: 'ds-components', chapter: '20', opener: true },
  { type: 'ds-components-app', chapter: '20' },
  { type: 'ds-icons', chapter: '21', opener: true },
  { type: 'ds-a11y', chapter: '22', opener: true },

  // ═══════════════════════════ ANEXOS ═══════════════════════════
  { type: 'glossary', chapter: '23', opener: true },
  { type: 'reference', chapter: '23' },
  { type: 'faq', chapter: '24', opener: true, items: 'staff' },
  { type: 'back' },
];

// ─────────────────────────── Visão geral ───────────────────────────

export const AREAS = [
  { icon: 'Mail', title: 'Convite pessoal', where: 'ionsportbiz.app/c/…', who: 'Convidados', text: 'O convite nominal, a resposta, os acompanhantes, a aprovação e o bilhete com o código QR.' },
  { icon: 'Smartphone', title: 'App do evento', where: 'ionsportbiz.app', who: 'Convidados', text: 'Programa, oradores, networking com reuniões 1:1, notícias e a credencial sempre à mão.' },
  { icon: 'LayoutDashboard', title: 'Back-office', where: 'ionsportbiz.app/admin', who: 'Equipa ion', text: 'Contactos (CRM), eventos, convites por email e WhatsApp, aprovação, mensagens, check-in e equipa.' },
];

/** O percurso do convidado: quem faz cada passo e onde. */
export const JOURNEY = [
  { icon: 'Send', who: 'Equipa ion', title: 'Convite enviado', text: 'A equipa envia o link pessoal por email ou WhatsApp.', state: 'Enviado' },
  { icon: 'MailOpen', who: 'Convidado', title: 'Confirma a presença', text: 'No convite: acompanhantes, informações adicionais e consentimento opcional.', state: 'Confirmado' },
  { icon: 'Hourglass', who: 'Convidado', title: 'Aguarda aprovação', text: 'A presença fica por aprovar. Ainda sem código QR.', state: 'Por aprovar' },
  { icon: 'BadgeCheck', who: 'Equipa ion', title: 'Aprova e escolhe o acesso', text: 'A equipa aprova e atribui o tipo de acesso: VIP Pass, Conference Pass…', state: 'Aprovado' },
  { icon: 'QrCode', who: 'Convidado', title: 'Recebe a credencial', text: 'O código QR e a lista de acessos aparecem no convite e na app.', state: 'Credencial' },
  { icon: 'ScanLine', who: 'Receção', title: 'Check-in à porta', text: 'A receção lê o QR, vê o tipo de acesso e regista a entrada.', state: 'Entrou' },
];

// ─────────────────────────── Legendas e tabelas ───────────────────────────

export const CREDENTIAL_STATES = [
  { badge: 'Presença por confirmar', tone: 'warn', when: 'Ainda não respondeu ao convite.', shows: 'Botão para confirmar a presença no convite.' },
  { badge: 'A aguardar aprovação', tone: 'amber', when: 'Confirmou; a equipa ion ainda não decidiu.', shows: 'Os passos do processo. Sem código QR.' },
  { badge: 'Aprovado · VIP Pass', tone: 'lime', when: 'A equipa aprovou e atribuiu o tipo de acesso.', shows: 'O código QR, o tipo de acesso e o que inclui.' },
  { badge: 'Não aprovado', tone: 'muted', when: 'A equipa não pôde confirmar o lugar.', shows: 'Mensagem e contacto da organização.' },
  { badge: 'Não vai estar presente', tone: 'muted', when: 'Respondeu que não pode estar presente.', shows: 'Pode alterar a resposta até ao prazo.' },
];

export const EVENT_STATUS = [
  { label: 'Rascunho', tone: 'neutral', text: 'Os links dos convidados ainda não abrem. Prepare a lista à vontade.' },
  { label: 'Aberto', tone: 'success', text: 'Os convidados podem abrir o convite e responder.' },
  { label: 'Fechado', tone: 'warning', text: 'Veem o convite e o bilhete, mas já não respondem.' },
  { label: 'Arquivado', tone: 'neutral', text: 'Os links deixam de funcionar.' },
];

export const CHECKIN_CASES = [
  { tone: 'success', label: 'Pronto', text: 'Confirmado e aprovado: [[Registar entrada]].' },
  { tone: 'warning', label: 'Por aprovar · por confirmar', text: 'Aviso amarelo. Só com indicação da organização.' },
  { tone: 'danger', label: 'Não aprovado · recusado · cancelado', text: 'Aviso vermelho. Só com indicação da organização.' },
  { tone: 'info', label: 'Já entrou', text: 'Mostra a hora da entrada. Não volte a dar entrada.' },
];

export const ROLES = [
  { role: 'Administrador', icon: 'ShieldCheck', text: 'Acesso total, incluindo a equipa e a eliminação de dados pessoais (RGPD).' },
  { role: 'Editor', icon: 'Pencil', text: 'Gere contactos, eventos, convites, aprovações e envios.' },
  { role: 'Receção', icon: 'ScanLine', text: 'Só faz check-in à porta. Não vê o CRM.' },
  { role: 'Leitura', icon: 'Eye', text: 'Consulta painel, eventos, contactos e respostas, sem alterar.' },
];

export const PERMISSIONS = [
  ['Consultar painel, eventos, contactos e respostas', ['Administrador', 'Editor', 'Leitura']],
  ['Criar e editar eventos, contactos e convites', ['Administrador', 'Editor']],
  ['Importar contactos e enviar convites', ['Administrador', 'Editor']],
  ['Aprovar convidados e atribuir o tipo de acesso', ['Administrador', 'Editor']],
  ['Registar entradas à porta', ['Administrador', 'Editor', 'Receção']],
  ['Anular entradas registadas', ['Administrador', 'Editor']],
  ['Gerir a equipa e apagar dados pessoais (RGPD)', ['Administrador']],
];

/** Variáveis dos modelos de mensagem (supabase/functions/_shared/template.ts). */
export const VARIABLES = [
  ['tratamento', 'Exma. Senhora'], ['nome', 'Carolina'], ['apelido', 'Oliveira Ferreira'], ['nome_completo', 'Carolina Oliveira Ferreira'],
  ['entidade', 'Montado Seguros'], ['evento', 'ion Portugal 2027'], ['anfitriao', 'A organização da ion…'], ['texto_convite', 'tem a honra de convidar V. Exa. …'],
  ['data', 'segunda-feira, 22 de março de 2027, às 19:00'], ['hora', '19:00'], ['local', 'Nome do local, morada'], ['prazo', '8 de março de 2027'], ['link', 'O link pessoal do convidado'],
];

// ─────────────────────────── Glossário ───────────────────────────

export const GLOSSARY = {
  invitation: [
    ['Por enviar', 'neutral', 'O convite existe na lista, mas ainda não foi enviado.'],
    ['Enviado', 'info', 'Enviado por email, WhatsApp ou outra via; ainda não foi aberto.'],
    ['Visto', 'accent', 'O convidado abriu o convite, mas ainda não respondeu.'],
    ['Confirmado', 'success', 'O convidado confirmou a presença.'],
    ['Recusado', 'danger', 'O convidado indicou que não poderá estar presente.'],
    ['Cancelado', 'neutral', 'A equipa cancelou o convite: o link deixa de funcionar (pode ser reativado).'],
  ],
  approval: [
    ['Por aprovar', 'warning', 'Confirmou presença e aguarda a decisão da equipa. Ainda não vê o código QR.'],
    ['Aprovado', 'success', 'A equipa aprovou e atribuiu o tipo de acesso. Vê o QR e a lista de acessos.'],
    ['Pré-aprovado', 'accent', 'Aprovado antes de responder. Recebe a credencial assim que confirmar.'],
    ['Não aprovado', 'danger', 'Não recebe o QR nem a lista de acessos; não conta para a lotação.'],
  ],
  terms: [
    ['Link pessoal', 'Endereço único de cada convite (/c/…). É a credencial do convidado: não há contas.'],
    ['Código de entrada', 'Os 10 caracteres por baixo do QR, em dois blocos de cinco.'],
    ['Tipo de acesso', 'O passe atribuído pela equipa (ex.: VIP Pass, Conference Pass) e o que inclui.'],
    ['Vaga', 'Grupo de envio (ex.: Convidados de honra, 1.ª vaga), para organizar e filtrar.'],
    ['Acompanhante', 'Pessoa indicada pelo convidado, até ao número permitido no convite.'],
    ['Lotação', 'Pessoas no total, com acompanhantes. Com a lotação completa, novas confirmações são recusadas.'],
  ],
};

// Entradas começadas por '~' são descrições, não rótulos do ecrã.
export const REFERENCE = {
  guest: [
    ['Responder ao convite', ['~Link pessoal', 'Confirmo a minha presença']],
    ['Mudar a resposta', ['~Convite', 'Alterar resposta']],
    ['Ver o código QR', ['~Convite', 'O seu acesso'], ['Credencial']],
    ['Saber o que inclui o meu acesso', ['Credencial', 'Incluído no seu acesso']],
    ['Entrar na app do evento', ['Abrir o meu convite', '~colar o link']],
    ['Pedir uma reunião 1:1', ['Networking', '~perfil', 'Pedir reunião 1:1']],
    ['Pedir a eliminação dos dados', ['~Convite', 'Proteção de dados']],
  ],
  staff: [
    ['Importar uma lista', ['Contactos', 'Importar']],
    ['Convidar contactos', ['~Evento', 'Convidados', 'Adicionar convidados']],
    ['Enviar convites por email', ['~Evento', 'Enviar convites']],
    ['Enviar por WhatsApp', ['~Ficha do convidado', 'Enviar por WhatsApp']],
    ['Aprovar confirmações', ['~Evento', 'Por aprovar', 'Aprovar…']],
    ['Criar tipos de acesso', ['~Evento', 'Acessos', 'Novo tipo de acesso']],
    ['Ativar a aprovação', ['~Evento', 'Definições', 'Aprovação da equipa']],
    ['Abrir o evento aos convidados', ['~Evento', 'Definições', 'Estado', 'Aberto']],
    ['Editar o texto do email', ['~Evento', 'Mensagens']],
    ['Registar uma entrada', ['Check-in', '~QR, código ou nome']],
    ['Responder a um pedido RGPD', ['~Ficha do contacto', 'Apagar dados pessoais']],
    ['Convidar um membro da equipa', ['Equipa', 'Convidar membro']],
  ],
};

// ─────────────────────────── Resolução de problemas ───────────────────────────

export const FAQ = {
  guest: [
    { q: 'Não encontro o meu convite', a: 'Procure o email com o assunto «Convite — ion Portugal 2027» (veja também a pasta de spam) ou a mensagem de WhatsApp da equipa ion. Se não o encontrar, contacte a organização: o link pode ser enviado de novo.' },
    { q: 'O link diz «Este convite não está disponível»', a: 'O link pode estar incompleto (acontece ao copiar de algumas apps) ou o convite pode ter sido cancelado. Abra o link completo a partir do email ou da mensagem. Se o problema continuar, contacte a organização.' },
    { q: 'Confirmei, mas não vejo o código QR', a: 'A presença fica [[A aguardar aprovação]] até a equipa ion a aprovar e escolher o tipo de acesso. Não precisa de fazer mais nada: o código QR aparece no convite e no separador [[Credencial]] da app logo que a presença for aprovada.' },
    { q: 'Quero mudar a resposta ou os acompanhantes', a: 'No convite, toque em [[Alterar resposta]]. Pode fazê-lo até ao prazo de resposta indicado no convite. Depois disso, contacte a organização.' },
    { q: 'O meu acesso não inclui uma sessão', a: 'O tipo de acesso é atribuído pela equipa ion ao aprovar a presença. A agenda indica [[Incluído]] ou [[Não incluído]] em cada sessão reservada. Para qualquer questão, contacte a organização.' },
    { q: 'O código QR não é lido à entrada', a: 'Aumente o brilho do ecrã e segure o telemóvel a 15–20 cm do leitor, sem reflexos. Se não funcionar, dite o [[Código de entrada]] que aparece por baixo do QR, ou indique o seu nome à equipa de receção.' },
    { q: 'Estou sem rede à porta', a: 'Abra a credencial uma vez antes de sair, com rede: a app guarda-a no dispositivo e mostra-a sem ligação. Em último caso, a receção encontra-o pelo nome.' },
    { q: 'A app voltou ao ecrã de entrada', a: 'Toque em [[Abrir o meu convite]] e cole de novo o link pessoal. Acontece depois de [[Sair deste dispositivo]], ao apagar os dados do browser ou ao usar outro telemóvel.' },
    { q: 'Os meus dados estão errados', a: 'O nome, o cargo e a empresa vêm do convite. Para os corrigir, use [[Contactar a organização]] na app ou os contactos no fim do convite.' },
  ],
  staff: [
    { q: 'O convidado diz que o link não abre', a: 'Confirme que o evento está [[Aberto]] (Definições › Estado) e que o convite não está [[Cancelado]]. Na ficha do convidado, [[Pré-visualizar]] abre o convite tal como ele o vê; [[Copiar]] dá o link para reenviar.' },
    { q: 'Um convidado confirmou, mas não tem QR', a: 'Está [[Por aprovar]]. Filtre a lista por [[Por aprovar]], selecione-o e use [[Aprovar…]] com o tipo de acesso. Depois, avise-o por email ou WhatsApp: a aprovação não envia mensagens.' },
    { q: 'O email de convite não chegou', a: 'Verifique o endereço na ficha do contacto e reenvie. Peça ao convidado para ver o spam. Em alternativa, envie por WhatsApp ou copie o link pessoal.' },
    { q: 'Enviar convites está desativado', a: 'O evento está em [[Rascunho]] ou [[Arquivado]]. Mude o estado para [[Aberto]] em [[Definições]] › [[Estado]].' },
    { q: 'Aprovei com o tipo de acesso errado', a: 'Na ficha do convidado, secção [[Aprovação]], use [[Mudar tipo de acesso…]]. O convidado passa a ver o novo tipo de imediato.' },
    { q: 'A importação criou repetidos', a: 'A importação deteta repetidos pelo email (ou, sem email, pelo telemóvel). Contactos sem nenhum dos dois não podem ser comparados: acrescente o email no ficheiro antes de importar.' },
    { q: 'A câmara não lê os códigos', a: 'Autorize a câmara no browser e limpe a lente. Use [[Introduzir código]] (10 caracteres, por baixo do QR) ou [[Pesquisar]] pelo nome.' },
    { q: 'Dei entrada à pessoa errada', a: 'Um administrador ou editor pode abrir o convidado no check-in e usar [[Anular entrada]]. Fica registado na linha do tempo.' },
    { q: 'Um membro da equipa não consegue entrar', a: 'Em [[Equipa]], confirme que a conta está ativa e o papel certo. Peça-lhe para usar [[Receber link de acesso por email]] no ecrã de entrada.' },
  ],
};
