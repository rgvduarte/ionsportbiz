export type DayId = '2027-03-22' | '2027-03-23';

export interface Stage {
  id: string;
  name: string;
  color: string;
}

export interface Session {
  id: string;
  day: DayId;
  start: string; // ISO 8601 with offset
  end: string;
  title: string;
  description: string;
  stageId: string;
  speakerIds: string[];
  kind: 'talk' | 'panel' | 'keynote' | 'social' | 'logistics';
  access?: 'vip';
}

export interface Speaker {
  id: string;
  name: string;
  role: string;
  company: string;
  country: string;
  bio: string;
}

export interface Attendee {
  id: string;
  name: string;
  role: string;
  company: string;
  country: string;
  sector: Sector;
  bio: string;
  interests: string[];
}

export type Sector = 'clubs' | 'investment' | 'media' | 'brands' | 'tech' | 'health' | 'public';

export interface NewsItem {
  id: string;
  date: string;
  title: string;
  summary: string;
  body: string[];
  image: string;
}

export interface Partner {
  id: string;
  name: string;
  tier: 'institutional' | 'gold' | 'silver';
  logo?: string;
  url?: string;
}
