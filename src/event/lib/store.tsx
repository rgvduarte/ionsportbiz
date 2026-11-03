import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { Sector } from '../data/types';
import { MEETING_SLOTS } from '../data/people';
import { storage } from './storage';

export type Ticket = 'vip' | 'conference';

export interface Profile {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  sector: Sector;
  ticket: Ticket;
}

export type ConnStatus = 'outgoing' | 'incoming' | 'connected';

export interface Meeting {
  id: string;
  attendeeId: string;
  slot: string;
  status: 'outgoing' | 'incoming' | 'confirmed';
}

interface State {
  profile: Profile | null;
  favorites: string[];
  connections: Record<string, ConnStatus>;
  meetings: Meeting[];
}

type Action =
  | { type: 'signIn'; profile: Profile }
  | { type: 'updateProfile'; profile: Profile }
  | { type: 'signOut' }
  | { type: 'toggleFav'; id: string }
  | { type: 'connect'; id: string }
  | { type: 'acceptConn'; id: string }
  | { type: 'declineConn'; id: string }
  | { type: 'requestMeeting'; attendeeId: string; slot: string }
  | { type: 'acceptMeeting'; id: string }
  | { type: 'declineMeeting'; id: string };

const EMPTY: State = { profile: null, favorites: [], connections: {}, meetings: [] };

// A fresh demo account starts with something to respond to, so both sides
// of the networking flow can be tried without a backend.
const DEMO_SEED: Omit<State, 'profile'> = {
  favorites: ['c2', 'c8'],
  connections: { a2: 'incoming', a9: 'connected' },
  meetings: [{ id: 'm-seed', attendeeId: 'a5', slot: MEETING_SLOTS[3]!, status: 'incoming' }],
};

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'signIn':
      return { ...DEMO_SEED, profile: a.profile };
    case 'updateProfile':
      return { ...s, profile: a.profile };
    case 'signOut':
      return EMPTY;
    case 'toggleFav':
      return {
        ...s,
        favorites: s.favorites.includes(a.id) ? s.favorites.filter((f) => f !== a.id) : [...s.favorites, a.id],
      };
    case 'connect':
      return { ...s, connections: { ...s.connections, [a.id]: 'outgoing' } };
    case 'acceptConn':
      return { ...s, connections: { ...s.connections, [a.id]: 'connected' } };
    case 'declineConn': {
      const { [a.id]: _removed, ...rest } = s.connections;
      return { ...s, connections: rest };
    }
    case 'requestMeeting':
      return {
        ...s,
        meetings: [...s.meetings, { id: `m-${Date.now()}`, attendeeId: a.attendeeId, slot: a.slot, status: 'outgoing' }],
      };
    case 'acceptMeeting':
      return { ...s, meetings: s.meetings.map((m) => (m.id === a.id ? { ...m, status: 'confirmed' } : m)) };
    case 'declineMeeting':
      return { ...s, meetings: s.meetings.filter((m) => m.id !== a.id) };
  }
}

const Ctx = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...EMPTY, ...storage.get<State>('state') }));
  useEffect(() => {
    if (state.profile) storage.set('state', state);
    else storage.clear();
  }, [state]);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

export const pendingCount = (s: State) =>
  Object.values(s.connections).filter((c) => c === 'incoming').length +
  s.meetings.filter((m) => m.status === 'incoming').length;

export const newCredentialId = () =>
  'ION27-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
