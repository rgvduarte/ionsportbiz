import type { DayId, Partner, Session, Speaker, Stage } from './types';

/**
 * Event content. Speakers, sessions, attendees and stage names are
 * placeholders until the official ion 2027 programme is published —
 * replace them here (or feed them from an API) without touching the UI.
 */
export const DEMO_CONTENT = true;

export const EVENT = {
  name: 'ion',
  fullName: 'International Business & Sports Conference',
  edition: "PT '27",
  start: '2027-03-22T18:30:00+00:00',
  timeZone: 'Europe/Lisbon',
  location: 'Portugal',
  website: 'https://www.ionsportsbiz.com/',
  contact: 'https://www.ionsportsbiz.com/contact',
  markets: ['PT', 'UAE', 'HK', 'WW'],
  stats: [
    { value: '5', key: 'stats.stages' },
    { value: '90+', key: 'stats.speakers' },
    { value: '650', key: 'stats.guests' },
  ],
} as const;

export const DAYS: { id: DayId; image: string; highlights: string[] }[] = [
  { id: '2027-03-22', image: 'images/day-22.webp', highlights: ['VIP GALA DINNER', 'AWARDS CEREMONY'] },
  { id: '2027-03-23', image: 'images/day-23.webp', highlights: ['ion CONFERENCE', 'VIP LUNCH'] },
];

export const STAGES: Stage[] = [
  { id: 'main', name: 'ion Main Stage', color: '#CCFF00' },
  { id: 'football', name: 'Business of Football', color: '#E2E86A' },
  { id: 'invest', name: 'Capital & Ownership', color: '#DAAC1B' },
  { id: 'media', name: 'Media, Tech & Fans', color: '#E77A2E' },
  { id: 'health', name: 'Performance & Health', color: '#EB473D' },
  { id: 'gala', name: 'Gala Venue', color: '#FFFFFF' },
  { id: 'lounge', name: 'Networking Lounge', color: '#9A9A9A' },
];

export const stageById = (id: string) => STAGES.find((s) => s.id === id)!;

export const SPEAKERS: Speaker[] = [
  { id: 'sp1', name: 'Helena Sá', role: 'Chief Strategy Officer', company: 'Atlântico Sports Capital', country: 'PT', bio: 'Leads strategy for a sports-focused investment platform with holdings across football, padel and live events in Southern Europe.' },
  { id: 'sp2', name: 'James Whitford', role: 'Managing Partner', company: 'Northline Sport Partners', country: 'UK', bio: 'Advises leagues and federations on media rights, governance and international expansion.' },
  { id: 'sp3', name: 'Yousef Haddad', role: 'Director', company: 'Gulf Sport Ventures', country: 'UAE', bio: 'Builds partnerships between Gulf capital and European sports properties.' },
  { id: 'sp4', name: 'Grace Leung', role: 'CEO', company: 'Harbour Sports Media', country: 'HK', bio: 'Runs one of Asia’s fastest-growing sports content networks, reaching fans across 12 markets.' },
  { id: 'sp5', name: 'Daniel Okafor', role: 'Head of Partnerships', company: 'Meridian Tech', country: 'WW', bio: 'Connects sports organisations with data, AI and fan-engagement technology.' },
  { id: 'sp6', name: 'Rui Cardoso', role: 'Commercial Director', company: 'Lusitânia Football Group', country: 'PT', bio: 'Responsible for sponsorship, hospitality and international commercial growth.' },
  { id: 'sp7', name: 'Inês Calado', role: 'Director of Women’s Football', company: 'Liga Norte', country: 'PT', bio: 'Drives the professionalisation and commercial strategy of women’s football competitions.' },
  { id: 'sp8', name: 'Thomas Berger', role: 'Partner', company: 'Alpine Equity', country: 'CH', bio: 'Invests in multi-club structures, sports infrastructure and performance tech.' },
  { id: 'sp9', name: 'Sofia Marques', role: 'Head of Digital', company: 'StreamPlay', country: 'PT', bio: 'Builds streaming and creator-led products for a new generation of sports fans.' },
  { id: 'sp10', name: 'Dr. Pedro Alvim', role: 'Sports Medicine Director', company: 'Clínica Atlântica', country: 'PT', bio: 'Specialist in athlete health, concussion protocols and return-to-play science.' },
  { id: 'sp11', name: 'André Lopes', role: 'Olympian & Founder', company: 'Next Level Academy', country: 'PT', bio: 'Former Olympic athlete turned entrepreneur, working on leadership and high-performance culture.' },
  { id: 'sp12', name: 'Laura Kim', role: 'VP Venues', company: 'ArenaOne', country: 'US', bio: 'Turns stadiums and arenas into year-round entertainment and business destinations.' },
];

export const speakerById = (id: string) => SPEAKERS.find((s) => s.id === id);

const d22 = (t: string) => `2027-03-22T${t}:00+00:00`;
const d23 = (t: string) => `2027-03-23T${t}:00+00:00`;

export const SESSIONS: Session[] = [
  // 22 March — VIP evening
  { id: 'g1', day: '2027-03-22', start: d22('18:30'), end: d22('19:30'), title: 'Accreditation & Welcome Cocktail', description: 'Collect your credential through the app and join the welcome cocktail.', stageId: 'gala', speakerIds: [], kind: 'logistics', access: 'vip' },
  { id: 'g2', day: '2027-03-22', start: d22('19:30'), end: d22('21:30'), title: 'VIP Gala Dinner', description: 'An evening where the best in sports unite with the best in business. Seated dinner for VIP guests, speakers and partners.', stageId: 'gala', speakerIds: [], kind: 'social', access: 'vip' },
  { id: 'g3', day: '2027-03-22', start: d22('21:30'), end: d22('22:30'), title: 'ion Awards Ceremony', description: 'Celebrating the leaders, clubs and projects that shaped the business of sport this year.', stageId: 'gala', speakerIds: ['sp11'], kind: 'social', access: 'vip' },
  { id: 'g4', day: '2027-03-22', start: d22('22:30'), end: '2027-03-23T00:30:00+00:00', title: 'After-Dinner Networking', description: 'Informal networking to close the first night.', stageId: 'gala', speakerIds: [], kind: 'social', access: 'vip' },

  // 23 March — ion Conference
  { id: 'c1', day: '2027-03-23', start: d23('08:30'), end: d23('09:30'), title: 'Accreditation & Welcome Coffee', description: 'Show the QR code on your credential at the entrance.', stageId: 'lounge', speakerIds: [], kind: 'logistics' },
  { id: 'c2', day: '2027-03-23', start: d23('09:30'), end: d23('10:00'), title: 'Opening Keynote: Sports as the Entry Point to Business', description: 'Why sport opens the conversations that drive partnerships, influence, investment and growth.', stageId: 'main', speakerIds: ['sp1', 'sp2'], kind: 'keynote' },
  { id: 'c3', day: '2027-03-23', start: d23('10:00'), end: d23('10:45'), title: 'Four Markets, One Conversation', description: 'Portugal, the UAE, Hong Kong and the world: how converging markets create new deal flow in sport.', stageId: 'main', speakerIds: ['sp3', 'sp4', 'sp5'], kind: 'panel' },
  { id: 'c4', day: '2027-03-23', start: d23('10:15'), end: d23('11:00'), title: 'Revenue Beyond Matchday', description: 'Hospitality, content, licensing and data — the new commercial playbook for clubs.', stageId: 'football', speakerIds: ['sp6', 'sp7'], kind: 'panel' },
  { id: 'c5', day: '2027-03-23', start: d23('10:15'), end: d23('11:00'), title: 'Multi-Club Ownership: Promise and Pitfalls', description: 'What investors have learned from a decade of multi-club structures.', stageId: 'invest', speakerIds: ['sp8', 'sp3'], kind: 'panel' },
  { id: 'c6', day: '2027-03-23', start: d23('10:15'), end: d23('11:00'), title: 'Fan Engagement in the Streaming Era', description: 'Short-form, creators and second screens: where attention is going.', stageId: 'media', speakerIds: ['sp9'], kind: 'talk' },
  { id: 'c7', day: '2027-03-23', start: d23('10:15'), end: d23('11:00'), title: 'Protecting the Athlete: Concussion and Performance', description: 'From pitch-side protocols to long-term health — what every organisation should have in place.', stageId: 'health', speakerIds: ['sp10'], kind: 'talk' },
  { id: 'c8', day: '2027-03-23', start: d23('11:15'), end: d23('12:00'), title: 'Keynote: Building a Winning Culture', description: 'In sports and business, the greatest leaders focus their energy on turning tough decisions into winning decisions.', stageId: 'main', speakerIds: ['sp11'], kind: 'keynote' },
  { id: 'c9', day: '2027-03-23', start: d23('11:15'), end: d23('12:00'), title: 'Sponsorship That Sells: Measuring ROI', description: 'Moving from logo exposure to measurable business outcomes.', stageId: 'football', speakerIds: ['sp12', 'sp6'], kind: 'panel' },
  { id: 'c10', day: '2027-03-23', start: d23('11:15'), end: d23('12:00'), title: 'Sport as an Asset Class', description: 'Valuations, liquidity and the institutionalisation of sports investment.', stageId: 'invest', speakerIds: ['sp8', 'sp2'], kind: 'panel' },
  { id: 'c11', day: '2027-03-23', start: d23('11:15'), end: d23('12:00'), title: 'Data, AI and the Next Fan', description: 'Personalisation at scale and what it means for rights holders.', stageId: 'media', speakerIds: ['sp9', 'sp5'], kind: 'panel' },
  { id: 'c12', day: '2027-03-23', start: d23('12:15'), end: d23('13:00'), title: 'Women’s Sport: The Growth Opportunity', description: 'Audiences, sponsorship and investment in the fastest-growing segment of sport.', stageId: 'main', speakerIds: ['sp7', 'sp4'], kind: 'panel' },
  { id: 'c13', day: '2027-03-23', start: d23('13:00'), end: d23('14:30'), title: 'VIP Lunch', description: 'Private lunch for VIP guests, speakers and partners.', stageId: 'lounge', speakerIds: [], kind: 'social', access: 'vip' },
  { id: 'c14', day: '2027-03-23', start: d23('13:00'), end: d23('14:30'), title: 'Networking Lunch', description: 'Lunch and open networking. Use the app to book 1:1 meetings.', stageId: 'lounge', speakerIds: [], kind: 'social' },
  { id: 'c15', day: '2027-03-23', start: d23('14:30'), end: d23('15:15'), title: 'Stadiums as 365-Day Destinations', description: 'Designing venues that generate value every day of the year.', stageId: 'football', speakerIds: ['sp12'], kind: 'talk' },
  { id: 'c16', day: '2027-03-23', start: d23('14:30'), end: d23('15:15'), title: 'Gulf Capital and Global Sport', description: 'How investment from the Gulf is reshaping the global sports economy.', stageId: 'invest', speakerIds: ['sp3', 'sp1'], kind: 'panel' },
  { id: 'c17', day: '2027-03-23', start: d23('14:30'), end: d23('15:15'), title: 'Creators, Rights and New Media', description: 'Who owns the moment when every fan is a broadcaster?', stageId: 'media', speakerIds: ['sp9', 'sp4'], kind: 'panel' },
  { id: 'c18', day: '2027-03-23', start: d23('14:30'), end: d23('15:15'), title: 'Mental Performance at the Top', description: 'What elite sport teaches executives about pressure and recovery.', stageId: 'health', speakerIds: ['sp10', 'sp11'], kind: 'panel' },
  { id: 'c19', day: '2027-03-23', start: d23('15:30'), end: d23('16:15'), title: 'Leagues as Global Brands', description: 'International expansion, overseas fixtures and building fan bases abroad.', stageId: 'main', speakerIds: ['sp2', 'sp6', 'sp4'], kind: 'panel' },
  { id: 'c20', day: '2027-03-23', start: d23('16:30'), end: d23('17:15'), title: 'Closing Keynote: From Conversation to Partnership', description: 'Business is a team sport, one in which you’re never going to win on your own.', stageId: 'main', speakerIds: ['sp1'], kind: 'keynote' },
  { id: 'c21', day: '2027-03-23', start: d23('17:15'), end: d23('19:00'), title: 'Closing Networking Cocktail', description: 'Close the day with the people who move markets.', stageId: 'lounge', speakerIds: [], kind: 'social' },
];

export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id);
export const sessionsForSpeaker = (id: string) => SESSIONS.filter((s) => s.speakerIds.includes(id));

export const PARTNERS: Partner[] = [
  { id: 'liga', name: 'Liga Portugal', tier: 'institutional', logo: 'images/logo-liga-portugal.webp', url: 'https://www.ligaportugal.pt/' },
];

export const QUOTES = [
  { image: 'images/quote-yaeger.webp', text: 'In sports and business, the greatest leaders are the ones who focus their energy on turning tough decisions into winning decisions.', author: 'Don Yaeger' },
  { image: 'images/quote-dib.webp', text: 'Business is a team sport, one in which you’re never going to win on your own.', author: 'Allan Dib' },
];

export const GALLERY = [
  'images/gallery-1.webp',
  'images/gallery-2.webp',
  'images/gallery-3.webp',
  'images/gallery-4.webp',
  'images/gallery-5.webp',
];
