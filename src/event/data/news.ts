import type { NewsItem } from './types';

export const NEWS: NewsItem[] = [
  {
    id: 'n1',
    date: '2026-10-15T09:00:00+00:00',
    title: 'ion goes global: four converging markets in 2027',
    summary: 'From an annual event in Portugal to networking events in Portugal, the UAE, Hong Kong and worldwide.',
    image: 'images/world-map.webp',
    body: [
      'What began as an annual event in Portugal in 2021 has evolved into diverse networking events in four converging markets around the world in 2027.',
      'ion is built as a high-value international business platform where sports are the entry point to conversations that drive partnerships, influence, investment and growth.',
      'Enter a business ecosystem with direct access to people who move markets, public opinion and strategic opportunities.',
    ],
  },
  {
    id: 'n2',
    date: '2026-10-08T09:00:00+00:00',
    title: "Save the date: PT '27 on 22–23 March",
    summary: 'A VIP Gala Dinner and Awards Ceremony on the 22nd, the ion Conference and VIP Lunch on the 23rd.',
    image: 'images/pt-27.webp',
    body: [
      'The Portuguese edition returns in March 2027 with two days that bring the best in sports together with the best in business.',
      '22 March: VIP Gala Dinner and Awards Ceremony.',
      '23 March: ion Conference across five themed stages, with 90+ renowned speakers, 650 guests and a VIP Lunch.',
    ],
  },
  {
    id: 'n3',
    date: '2026-09-30T09:00:00+00:00',
    title: 'Pieces of 2026',
    summary: 'Moments from last edition — the stages, the people and the conversations.',
    image: 'images/gallery-1.webp',
    body: [
      'A look back at the 2026 edition: keynotes, press moments, partners and the people who made it happen.',
      'Browse the full gallery on the home screen.',
    ],
  },
];

export const newsById = (id: string) => NEWS.find((n) => n.id === id);
