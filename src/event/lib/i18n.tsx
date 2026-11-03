import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { storage } from './storage';

const en = {
  'tab.home': 'Home',
  'tab.agenda': 'Agenda',
  'tab.credential': 'Pass',
  'tab.networking': 'Network',
  'tab.more': 'More',

  'common.back': 'Back',
  'common.seeAll': 'See all',
  'common.search': 'Search',
  'common.all': 'All',
  'common.save': 'Save',
  'common.saved': 'Saved',
  'common.cancel': 'Cancel',
  'common.demo': 'Provisional programme — demo content',
  'common.vipOnly': 'VIP',

  'welcome.kicker': 'International Business & Sports Conference',
  'welcome.title': 'the best in sports unite with the best in business',
  'welcome.cta': 'Get my credential',
  'welcome.name': 'Full name',
  'welcome.email': 'Email',
  'welcome.company': 'Company',
  'welcome.role': 'Job title',
  'welcome.sector': 'Sector',
  'welcome.ticket': 'Access type (demo)',
  'welcome.submit': 'Enter',
  'welcome.legal': 'Demo build: your data stays on this device.',

  'home.countdown': 'Countdown to PT ’27',
  'home.live': 'ion is live',
  'home.days': 'days',
  'home.hours': 'hrs',
  'home.min': 'min',
  'home.sec': 'sec',
  'home.about': 'What began as an annual event in Portugal in 2021 has evolved into diverse networking events in four converging markets around the world in 2027',
  'home.quick.credential': 'My credential',
  'home.quick.agenda': 'Agenda',
  'home.quick.networking': 'Networking',
  'home.quick.speakers': 'Speakers',
  'home.twoDays': 'Two days. One ecosystem.',
  'home.mySessions': 'My sessions',
  'home.mySessionsEmpty': 'Star sessions in the agenda to build your personal schedule.',
  'home.pieces': 'Pieces of 2026',
  'home.news': 'News',
  'home.partner': 'Institutional partner',
  'home.requests': 'pending requests in Networking',

  'stats.stages': 'Themed stages',
  'stats.speakers': 'Renowned speakers',
  'stats.guests': 'Guests',

  'agenda.title': 'Agenda',
  'agenda.favOnly': 'My agenda',
  'agenda.empty': 'No sessions match these filters.',
  'agenda.addCal': 'Add to calendar',
  'agenda.fav': 'Add to my agenda',
  'agenda.unfav': 'In my agenda',
  'agenda.speakers': 'Speakers',
  'agenda.vipNote': 'Reserved for VIP pass holders.',

  'speakers.title': 'Speakers',
  'speakers.sessions': 'Sessions',

  'cred.title': 'Credential',
  'cred.brightness': 'Turn up your screen brightness and show this code at the entrance.',
  'cred.access': 'Access',
  'cred.vip': 'VIP Pass',
  'cred.conference': 'Conference Pass',
  'cred.id': 'Credential ID',
  'cred.nominal': 'Personal and non-transferable credential.',

  'net.title': 'Networking',
  'net.people': 'People',
  'net.connections': 'Connections',
  'net.meetings': 'Meetings',
  'net.connect': 'Connect',
  'net.pending': 'Pending',
  'net.connected': 'Connected',
  'net.accept': 'Accept',
  'net.decline': 'Decline',
  'net.incoming': 'Wants to connect',
  'net.requestMeeting': 'Request 1:1 meeting',
  'net.pickSlot': 'Choose a slot — Networking Lounge, 23 March',
  'net.send': 'Send request',
  'net.noConnections': 'No connections yet. Browse people and tap Connect.',
  'net.noMeetings': 'No meetings yet. Open a profile to request a 1:1.',
  'net.meetingWith': 'Meeting with',
  'net.meetingIncoming': 'Meeting request',
  'net.meetingPending': 'Awaiting reply',
  'net.meetingConfirmed': 'Confirmed',
  'net.interests': 'Interests',
  'net.toastConnect': 'Connection request sent',
  'net.toastMeeting': 'Meeting request sent',
  'net.toastAccepted': 'Accepted',

  'sector.clubs': 'Clubs & Leagues',
  'sector.investment': 'Investment',
  'sector.media': 'Media',
  'sector.brands': 'Brands',
  'sector.tech': 'Tech',
  'sector.health': 'Health',
  'sector.public': 'Public & Venues',

  'more.title': 'More',
  'more.profile': 'Edit profile',
  'more.myAgenda': 'My agenda',
  'more.partners': 'Partners',
  'more.news': 'News',
  'more.info': 'Info & FAQ',
  'more.language': 'Language',
  'more.website': 'ionsportsbiz.com',
  'more.contact': 'Contact the organisation',
  'more.logout': 'Sign out (clears demo data)',

  'partners.title': 'Partners',
  'partners.institutional': 'Institutional partner',
  'partners.tba': 'More partners to be announced',

  'info.title': 'Info & FAQ',
  'info.when': 'When',
  'info.whenValue': '22–23 March 2027',
  'info.where': 'Where',
  'info.whereValue': 'Portugal — venue to be announced',
  'info.faq1q': 'How do I get into the event?',
  'info.faq1a': 'Your credential lives in this app. Show the QR code in the Pass tab at the entrance. Credentials are personal.',
  'info.faq2q': 'What does each pass include?',
  'info.faq2a': 'The Conference Pass gives access to all five themed stages, the networking lunch and the closing cocktail on 23 March. The VIP Pass includes the conference and the closing cocktail, plus the VIP Gala Dinner and Awards Ceremony on 22 March and, on 23 March, the VIP Lunch instead of the networking lunch.',
  'info.faq3q': 'How do 1:1 meetings work?',
  'info.faq3a': 'Open a profile in Networking, request a slot and wait for the other person to accept. Meetings take place in the Networking Lounge.',
  'info.faq4q': 'Where is ion happening beyond Portugal?',
  'info.faq4a': 'In 2027 ion runs networking events in four converging markets: Portugal, the United Arab Emirates, Hong Kong and worldwide.',

  'news.title': 'News',
};

type Key = keyof typeof en;

const pt: Record<Key, string> = {
  'tab.home': 'Início',
  'tab.agenda': 'Agenda',
  'tab.credential': 'Credencial',
  'tab.networking': 'Networking',
  'tab.more': 'Mais',

  'common.back': 'Voltar',
  'common.seeAll': 'Ver tudo',
  'common.search': 'Pesquisar',
  'common.all': 'Todos',
  'common.save': 'Guardar',
  'common.saved': 'Guardado',
  'common.cancel': 'Cancelar',
  'common.demo': 'Programa provisório — conteúdo de demonstração',
  'common.vipOnly': 'VIP',

  'welcome.kicker': 'International Business & Sports Conference',
  'welcome.title': 'the best in sports unite with the best in business',
  'welcome.cta': 'Obter a minha credencial',
  'welcome.name': 'Nome completo',
  'welcome.email': 'Email',
  'welcome.company': 'Empresa',
  'welcome.role': 'Cargo',
  'welcome.sector': 'Setor',
  'welcome.ticket': 'Tipo de acesso (demo)',
  'welcome.submit': 'Entrar',
  'welcome.legal': 'Versão demo: os seus dados ficam apenas neste dispositivo.',

  'home.countdown': 'Contagem decrescente PT ’27',
  'home.live': 'A ion está a decorrer',
  'home.days': 'dias',
  'home.hours': 'h',
  'home.min': 'min',
  'home.sec': 'seg',
  'home.about': 'O que começou em 2021 como um evento anual em Portugal evoluiu para vários eventos de networking em quatro mercados convergentes em todo o mundo em 2027',
  'home.quick.credential': 'Credencial',
  'home.quick.agenda': 'Agenda',
  'home.quick.networking': 'Networking',
  'home.quick.speakers': 'Oradores',
  'home.twoDays': 'Dois dias. Um ecossistema.',
  'home.mySessions': 'As minhas sessões',
  'home.mySessionsEmpty': 'Marque sessões com estrela na agenda para criar o seu programa.',
  'home.pieces': 'Pieces of 2026',
  'home.news': 'Notícias',
  'home.partner': 'Parceiro institucional',
  'home.requests': 'pedidos pendentes no Networking',

  'stats.stages': 'Palcos temáticos',
  'stats.speakers': 'Oradores de renome',
  'stats.guests': 'Convidados',

  'agenda.title': 'Agenda',
  'agenda.favOnly': 'A minha agenda',
  'agenda.empty': 'Nenhuma sessão corresponde a estes filtros.',
  'agenda.addCal': 'Adicionar ao calendário',
  'agenda.fav': 'Adicionar à minha agenda',
  'agenda.unfav': 'Na minha agenda',
  'agenda.speakers': 'Oradores',
  'agenda.vipNote': 'Exclusivo para titulares de passe VIP.',

  'speakers.title': 'Oradores',
  'speakers.sessions': 'Sessões',

  'cred.title': 'Credencial',
  'cred.brightness': 'Aumente o brilho do ecrã e apresente este código à entrada.',
  'cred.access': 'Acesso',
  'cred.vip': 'Passe VIP',
  'cred.conference': 'Passe Conferência',
  'cred.id': 'ID da credencial',
  'cred.nominal': 'Credencial nominal e intransmissível.',

  'net.title': 'Networking',
  'net.people': 'Pessoas',
  'net.connections': 'Ligações',
  'net.meetings': 'Reuniões',
  'net.connect': 'Ligar',
  'net.pending': 'Pendente',
  'net.connected': 'Ligado',
  'net.accept': 'Aceitar',
  'net.decline': 'Recusar',
  'net.incoming': 'Quer ligar-se a si',
  'net.requestMeeting': 'Pedir reunião 1:1',
  'net.pickSlot': 'Escolha um horário — Networking Lounge, 23 de março',
  'net.send': 'Enviar pedido',
  'net.noConnections': 'Ainda sem ligações. Explore as pessoas e toque em Ligar.',
  'net.noMeetings': 'Ainda sem reuniões. Abra um perfil para pedir uma reunião 1:1.',
  'net.meetingWith': 'Reunião com',
  'net.meetingIncoming': 'Pedido de reunião',
  'net.meetingPending': 'A aguardar resposta',
  'net.meetingConfirmed': 'Confirmada',
  'net.interests': 'Interesses',
  'net.toastConnect': 'Pedido de ligação enviado',
  'net.toastMeeting': 'Pedido de reunião enviado',
  'net.toastAccepted': 'Aceite',

  'sector.clubs': 'Clubes & Ligas',
  'sector.investment': 'Investimento',
  'sector.media': 'Media',
  'sector.brands': 'Marcas',
  'sector.tech': 'Tecnologia',
  'sector.health': 'Saúde',
  'sector.public': 'Setor público & Recintos',

  'more.title': 'Mais',
  'more.profile': 'Editar perfil',
  'more.myAgenda': 'A minha agenda',
  'more.partners': 'Parceiros',
  'more.news': 'Notícias',
  'more.info': 'Informações & FAQ',
  'more.language': 'Idioma',
  'more.website': 'ionsportsbiz.com',
  'more.contact': 'Contactar a organização',
  'more.logout': 'Terminar sessão (apaga dados demo)',

  'partners.title': 'Parceiros',
  'partners.institutional': 'Parceiro institucional',
  'partners.tba': 'Mais parceiros a anunciar',

  'info.title': 'Informações & FAQ',
  'info.when': 'Quando',
  'info.whenValue': '22–23 de março de 2027',
  'info.where': 'Onde',
  'info.whereValue': 'Portugal — local a anunciar',
  'info.faq1q': 'Como entro no evento?',
  'info.faq1a': 'A sua credencial está nesta app. Apresente o código QR do separador Credencial à entrada. As credenciais são nominais.',
  'info.faq2q': 'O que inclui cada passe?',
  'info.faq2a': 'O Passe Conferência dá acesso, a 23 de março, aos cinco palcos temáticos, ao almoço de networking e ao cocktail de encerramento. O Passe VIP inclui a conferência e o cocktail de encerramento e ainda o VIP Gala Dinner e a Awards Ceremony a 22 de março e, a 23 de março, o VIP Lunch em vez do almoço de networking.',
  'info.faq3q': 'Como funcionam as reuniões 1:1?',
  'info.faq3a': 'Abra um perfil no Networking, peça um horário e aguarde que a outra pessoa aceite. As reuniões decorrem no Networking Lounge.',
  'info.faq4q': 'Onde acontece a ion além de Portugal?',
  'info.faq4a': 'Em 2027 a ion realiza eventos de networking em quatro mercados convergentes: Portugal (PT), Emirados Árabes Unidos (UAE), Hong Kong (HK) e Worldwide (WW), com eventos internacionais.',

  'news.title': 'Notícias',
};

export type Lang = 'pt' | 'en';
const dict: Record<Lang, Record<Key, string>> = { en, pt };

interface I18n {
  lang: Lang;
  locale: string;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
}

const Ctx = createContext<I18n | null>(null);

function initialLang(): Lang {
  const saved = storage.get<Lang>('lang');
  if (saved === 'pt' || saved === 'en') return saved;
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.set('lang', l);
  }, []);
  const value = useMemo<I18n>(
    () => ({ lang, locale: lang === 'pt' ? 'pt-PT' : 'en-GB', setLang, t: (k) => dict[lang][k] ?? k }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

export type { Key as I18nKey };
