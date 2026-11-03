import type { Attendee, Sector } from './types';

export const SECTORS: Sector[] = ['clubs', 'investment', 'media', 'brands', 'tech', 'health', 'public'];

/** Demo attendee directory. In production this comes from the registration backend. */
export const ATTENDEES: Attendee[] = [
  { id: 'a1', name: 'Carolina Mendes', role: 'Head of Partnerships', company: 'Lusitânia Football Group', country: 'PT', sector: 'clubs', bio: 'Looking for brand partners for international pre-season tours.', interests: ['Sponsorship', 'Hospitality', 'Tours'] },
  { id: 'a2', name: 'Faisal Rahman', role: 'Investment Manager', company: 'Gulf Sport Ventures', country: 'UAE', sector: 'investment', bio: 'Minority stakes in European clubs and sports infrastructure.', interests: ['M&A', 'Infrastructure', 'Football'] },
  { id: 'a3', name: 'Mei Chen', role: 'Commercial Director', company: 'Harbour Sports Media', country: 'HK', sector: 'media', bio: 'Acquiring European football content for Asian markets.', interests: ['Media rights', 'Content', 'Asia'] },
  { id: 'a4', name: 'Tiago Ferreira', role: 'Founder', company: 'PadelPro', country: 'PT', sector: 'brands', bio: 'Building a padel equipment brand; open to athlete ambassadors.', interests: ['Padel', 'Ambassadors', 'Retail'] },
  { id: 'a5', name: 'Sarah Collins', role: 'VP Business Development', company: 'Meridian Tech', country: 'UK', sector: 'tech', bio: 'Fan-data platforms for clubs and leagues.', interests: ['Data', 'CRM', 'AI'] },
  { id: 'a6', name: 'Miguel Rocha', role: 'CEO', company: 'Rocha & Filhos Construções', country: 'PT', sector: 'public', bio: 'Stadium and training-ground construction and refurbishment.', interests: ['Stadiums', 'Infrastructure'] },
  { id: 'a7', name: 'Aisha Al Nuaimi', role: 'Director of Events', company: 'Gulf Events Authority', country: 'UAE', sector: 'public', bio: 'Bringing international fixtures and tournaments to the Gulf.', interests: ['Events', 'Tourism', 'Football'] },
  { id: 'a8', name: 'Lucas Martin', role: 'Partner', company: 'Alpine Equity', country: 'CH', sector: 'investment', bio: 'Growth capital for sports-tech companies.', interests: ['Sports-tech', 'Venture', 'SaaS'] },
  { id: 'a9', name: 'Beatriz Nunes', role: 'Marketing Director', company: 'Onda Bebidas', country: 'PT', sector: 'brands', bio: 'Activations and sponsorship across football and surf.', interests: ['Activation', 'Sponsorship', 'Surf'] },
  { id: 'a10', name: 'Kenji Watanabe', role: 'Head of International', company: 'Kanto Pro League', country: 'JP', sector: 'clubs', bio: 'Exploring partnerships with Portuguese clubs and academies.', interests: ['Academies', 'Scouting', 'Partnerships'] },
  { id: 'a11', name: 'Dr. Joana Pires', role: 'Medical Director', company: 'Clínica Atlântica', country: 'PT', sector: 'health', bio: 'Sports medicine services for clubs and federations.', interests: ['Medicine', 'Performance', 'Recovery'] },
  { id: 'a12', name: 'Oliver Grant', role: 'Head of Sport', company: 'StreamPlay', country: 'UK', sector: 'media', bio: 'Live and short-form rights for digital-first platforms.', interests: ['Streaming', 'Rights', 'Creators'] },
  { id: 'a13', name: 'Ricardo Alves', role: 'Sporting Director', company: 'CD Atlântico', country: 'PT', sector: 'clubs', bio: 'Player development and multi-club collaboration.', interests: ['Scouting', 'Academies'] },
  { id: 'a14', name: 'Wing Lam', role: 'Founder', company: 'KickOff Labs', country: 'HK', sector: 'tech', bio: 'Computer-vision analytics for youth football.', interests: ['AI', 'Analytics', 'Youth'] },
  { id: 'a15', name: 'Marta Lopes', role: 'Senior Associate', company: 'Vieira & Associados', country: 'PT', sector: 'investment', bio: 'Sports law: transfers, club acquisitions and governance.', interests: ['Legal', 'M&A', 'Governance'] },
  { id: 'a16', name: 'Hassan Karim', role: 'Head of Sponsorship', company: 'Falcon Logistics', country: 'UAE', sector: 'brands', bio: 'Global sponsorship portfolio in football and motorsport.', interests: ['Sponsorship', 'Motorsport', 'Football'] },
];

export const attendeeById = (id: string) => ATTENDEES.find((a) => a.id === id);

/** Meeting slots offered on conference day (Networking Lounge). */
export const MEETING_SLOTS = [
  '2027-03-23T11:00:00+00:00',
  '2027-03-23T11:30:00+00:00',
  '2027-03-23T12:00:00+00:00',
  '2027-03-23T13:00:00+00:00',
  '2027-03-23T13:30:00+00:00',
  '2027-03-23T14:00:00+00:00',
  '2027-03-23T15:30:00+00:00',
  '2027-03-23T16:00:00+00:00',
  '2027-03-23T17:30:00+00:00',
  '2027-03-23T18:00:00+00:00',
];
