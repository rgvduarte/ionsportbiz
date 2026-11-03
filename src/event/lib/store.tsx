import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import type { GuestResponse, GuestView } from '../../lib/api/types';
import { savedInvitations } from '../../native/savedInvitations';
import type { Sector } from '../data/types';
import { MEETING_SLOTS } from '../data/people';
import { guestName, pickActiveToken, type PassInfo } from './invite';
import { useI18n } from './i18n';
import { storage } from './storage';

/**
 * Perfil do participante. Nome, empresa e cargo vêm do convite (definidos pela equipa ion);
 * setor e interesses são do participante, para o networking, e ficam só neste dispositivo.
 * Não há email: o convidado entra com o link pessoal, não com uma conta.
 */
export interface Profile {
  /** Nome e apelido, sem o tratamento (no convite o tratamento é o de carta, ex.: "Exmo. Senhor"). */
  name: string;
  firstName: string;
  company: string;
  role: string;
  sector: Sector;
  interests: string[];
}

export interface Prefs {
  sector: Sector;
  interests: string[];
}

export type ConnStatus = 'outgoing' | 'incoming' | 'connected';

export interface Meeting {
  id: string;
  attendeeId: string;
  slot: string;
  status: 'outgoing' | 'incoming' | 'confirmed';
}

interface State {
  v: 2;
  /** Token do convite com que a app entrou (link pessoal /c/<token>). */
  token: string | null;
  activatedAt: string | null;
  /** Última resposta do servidor para esse convite: a app continua a mostrar a credencial sem rede. */
  view: GuestView | null;
  /**
   * Pré-visualização da equipa (/c/<token>?preview=1): o convite fica só em memória e nesta janela
   * (sessionStorage). Nada vai para o localStorage nem para a lista de convites do dispositivo.
   */
  preview?: true;
  fetchedAt: string | null;
  prefs: Prefs;
  favorites: string[];
  connections: Record<string, ConnStatus>;
  meetings: Meeting[];
}

type Action =
  | { type: 'activate'; token: string; view?: GuestView | null }
  | { type: 'preview'; token: string; view: GuestView }
  | { type: 'restore'; state: State }
  | { type: 'setView'; token: string; view: GuestView | null }
  | { type: 'updatePrefs'; prefs: Prefs }
  | { type: 'signOut' }
  | { type: 'toggleFav'; id: string }
  | { type: 'connect'; id: string }
  | { type: 'acceptConn'; id: string }
  | { type: 'declineConn'; id: string }
  | { type: 'requestMeeting'; attendeeId: string; slot: string }
  | { type: 'acceptMeeting'; id: string }
  | { type: 'declineMeeting'; id: string };

const DEFAULT_PREFS: Prefs = { sector: 'clubs', interests: [] };

const EMPTY: State = {
  v: 2, token: null, activatedAt: null, view: null, fetchedAt: null, prefs: DEFAULT_PREFS,
  favorites: [], connections: {}, meetings: [],
};

// A fresh demo account starts with something to respond to, so both sides
// of the networking flow can be tried without a backend.
const DEMO_SEED: Pick<State, 'favorites' | 'connections' | 'meetings'> = {
  favorites: ['c2', 'c8'],
  connections: { a2: 'incoming', a9: 'connected' },
  meetings: [{ id: 'm-seed', attendeeId: 'a5', slot: MEETING_SLOTS[3]!, status: 'incoming' }],
};

const now = () => new Date().toISOString();

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'activate':
      if (a.token === s.token && !s.preview) return a.view === undefined ? s : { ...s, view: a.view, fetchedAt: now() };
      // Outro convite (outra pessoa), ou o fim de uma pré-visualização: começa de novo.
      return { ...EMPTY, ...DEMO_SEED, token: a.token, activatedAt: now(), view: a.view ?? null, fetchedAt: a.view ? now() : null };
    case 'preview':
      return { ...EMPTY, ...DEMO_SEED, token: a.token, activatedAt: now(), view: a.view, fetchedAt: now(), preview: true };
    case 'restore':
      return a.state;
    case 'setView':
      return a.token === s.token ? { ...s, view: a.view, fetchedAt: now() } : s;
    case 'updatePrefs':
      return { ...s, prefs: a.prefs };
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

/** Estado guardado. Versões antigas (registo livre com tipo de acesso escolhido) são descartadas. */
function loadSaved(): State {
  const saved = storage.get<Partial<State>>('state');
  if (!saved || saved.v !== 2 || typeof saved.token !== 'string') return EMPTY;
  const { preview: _ignored, ...rest } = saved;
  return { ...EMPTY, ...rest, prefs: { ...DEFAULT_PREFS, ...saved.prefs } };
}

// Pré-visualização da equipa: só nesta janela do browser (sessionStorage), nunca no localStorage.
const PREVIEW_KEY = 'ion:preview';
const previewStore = {
  get(): State | null {
    try {
      const raw = sessionStorage.getItem(PREVIEW_KEY);
      const s = raw ? (JSON.parse(raw) as Partial<State>) : null;
      return s && s.v === 2 && typeof s.token === 'string' && s.view ? { ...EMPTY, ...s, prefs: { ...DEFAULT_PREFS, ...s.prefs }, preview: true } : null;
    } catch {
      return null;
    }
  },
  set(s: State) {
    try { sessionStorage.setItem(PREVIEW_KEY, JSON.stringify(s)); } catch { /* sem sessionStorage: fica só em memória */ }
  },
  clear() {
    try { sessionStorage.removeItem(PREVIEW_KEY); } catch { /* ignore */ }
  },
};

const load = (): State => previewStore.get() ?? loadSaved();

/** Estado da última consulta ao servidor (não se guarda). */
export type Sync = 'idle' | 'loading' | 'ok' | 'offline' | 'unavailable';

interface Store {
  state: State;
  dispatch: (a: Action) => void;
  /** false enquanto se lê a lista de convites guardados no dispositivo. */
  ready: boolean;
  sync: Sync;
  /** Volta a pedir o convite ao servidor. */
  refresh: () => Promise<void>;
  /** Entra com um convite já validado (guarda-o no dispositivo e passa a ser o convite ativo). */
  signIn: (token: string, view: GuestView) => Promise<void>;
  /** Sai: esquece o convite neste dispositivo e os dados locais. */
  signOut: () => Promise<void>;
  /** Pré-visualização da equipa: mostra o convite sem o guardar nem o registar como aberto. */
  enterPreview: (token: string, view: GuestView) => void;
  /** Termina a pré-visualização e volta ao convite deste dispositivo (se houver). */
  exitPreview: () => void;
  /** Responde ao convite (confirmar, recusar ou alterar). Na pré-visualização não envia nada. */
  respond: (input: GuestResponse) => Promise<GuestView>;
  /** Pede à organização a eliminação dos dados pessoais. */
  requestErasure: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

const saveCopy = (token: string, v: GuestView, savedAt?: string) =>
  savedInvitations.add({ token, eventName: v.event.name, startsAt: v.event.starts_at, timezone: v.event.timezone, ...(savedAt ? { savedAt } : {}) });

/** Erro de quem tenta enviar algo na pré-visualização (os ecrãs desativam os botões antes disso). */
export class PreviewError extends Error {
  constructor() { super('preview'); this.name = 'PreviewError'; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<Sync>('idle');
  const tokenRef = useRef(state.token);
  tokenRef.current = state.token;
  const previewRef = useRef(!!state.preview);
  previewRef.current = !!state.preview;
  // Muda a cada entrada ou saída: uma leitura do dispositivo já ultrapassada (ex.: o link pessoal
  // entrou entretanto) não pode repor o convite anterior.
  const epoch = useRef(0);
  const { setLang } = useI18n();

  useEffect(() => {
    if (state.preview) {
      previewStore.set(state);
      return;
    }
    previewStore.clear();
    if (state.token) storage.set('state', state);
    else storage.clear();
  }, [state]);

  // Um pedido de cada vez: ao abrir a credencial, o arranque e o ecrã pedem o mesmo convite.
  const inflight = useRef<{ token: string; run: Promise<void> } | null>(null);
  const fetchView = useCallback((token: string): Promise<void> => {
    if (inflight.current?.token === token) return inflight.current.run;
    setSync('loading');
    const run = (async () => {
      await Promise.resolve(); // inflight fica registado antes de o pedido poder terminar
      try {
        const v = await api.guest.view(token, { track: false });
        if (tokenRef.current !== token) return;
        dispatch({ type: 'setView', token, view: v });
        setSync(v ? 'ok' : 'unavailable');
        if (v && !previewRef.current) void saveCopy(token, v);
      } catch {
        if (tokenRef.current === token) setSync('offline');
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = { token, run };
    return run;
  }, []);

  // Que convite está guardado neste dispositivo (o link pessoal guarda-o ao abrir a app).
  const boot = useCallback(async (alive: () => boolean, current: Pick<State, 'token' | 'activatedAt'>) => {
    const at = epoch.current;
    const saved = await savedInvitations.list();
    if (!alive() || at !== epoch.current) return;
    const token = pickActiveToken(saved, current.token, current.activatedAt);
    if (!token) {
      dispatch({ type: 'signOut' });
    } else {
      dispatch({ type: 'activate', token });
      tokenRef.current = token;
      void fetchView(token);
    }
    setReady(true);
  }, [fetchView]);

  useEffect(() => {
    let alive = true;
    if (state.preview && state.token) {
      // Pré-visualização: só se atualiza o convite (sem registar a abertura), sem tocar no dispositivo.
      void fetchView(state.token);
      setReady(true);
    } else {
      void boot(() => alive, state);
    }
    return () => { alive = false; };
    // Só ao montar: o estado inicial vem do localStorage (ou da pré-visualização desta janela).
  }, []);

  // Sem idioma escolhido, a app fala a língua do convidado (definida no convite).
  // Na pré-visualização não: setLang guarda a escolha no dispositivo.
  const language = state.preview ? undefined : state.view?.contact.language;
  useEffect(() => {
    if (language && !storage.get('lang')) setLang(language);
  }, [language, setLang]);

  const refresh = useCallback(async () => {
    if (tokenRef.current) await fetchView(tokenRef.current);
  }, [fetchView]);

  const signIn = useCallback(async (token: string, view: GuestView) => {
    // savedAt de agora: este passa a ser o convite ativo neste dispositivo, mesmo que já estivesse guardado.
    epoch.current += 1;
    await saveCopy(token, view, new Date().toISOString());
    tokenRef.current = token;
    previewRef.current = false;
    dispatch({ type: 'activate', token, view });
    setReady(true);
    setSync('ok');
  }, []);

  const enterPreview = useCallback((token: string, view: GuestView) => {
    epoch.current += 1;
    tokenRef.current = token;
    previewRef.current = true;
    dispatch({ type: 'preview', token, view });
    setReady(true);
    setSync('ok');
  }, []);

  const exitPreview = useCallback(() => {
    epoch.current += 1;
    previewStore.clear();
    const saved = loadSaved();
    tokenRef.current = saved.token;
    previewRef.current = false;
    dispatch({ type: 'restore', state: saved });
    setSync('idle');
    setReady(false);
    void boot(() => true, saved);
  }, [boot]);

  const signOut = useCallback(async () => {
    // Na pré-visualização, "sair" é só terminá-la: o convite deste dispositivo (se houver) fica como estava.
    if (previewRef.current) return exitPreview();
    const token = tokenRef.current;
    epoch.current += 1;
    if (token) await savedInvitations.remove(token);
    tokenRef.current = null;
    dispatch({ type: 'signOut' });
    setSync('idle');
  }, [exitPreview]);

  const respond = useCallback(async (input: GuestResponse) => {
    const token = tokenRef.current;
    if (previewRef.current) throw new PreviewError();
    if (!token) throw new Error('no invitation');
    const v = await api.guest.respond(token, input);
    if (tokenRef.current === token) {
      dispatch({ type: 'setView', token, view: v });
      setSync('ok');
    }
    return v;
  }, []);

  const requestErasure = useCallback(async () => {
    const token = tokenRef.current;
    if (previewRef.current) throw new PreviewError();
    if (!token) throw new Error('no invitation');
    await api.guest.requestErasure(token);
  }, []);

  const value = useMemo(
    () => ({ state, dispatch, ready, sync, refresh, signIn, signOut, enterPreview, exitPreview, respond, requestErasure }),
    [state, ready, sync, refresh, signIn, signOut, enterPreview, exitPreview, respond, requestErasure],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}

/** Perfil a partir do convite (nome, empresa, cargo) e das preferências locais (setor, interesses). */
export function useProfile(): Profile {
  const { state } = useStore();
  const c = state.view?.contact;
  return useMemo(
    () => ({
      name: c ? guestName(c) : '',
      firstName: c?.first_name.trim() ?? '',
      company: c?.organization?.trim() ?? '',
      role: c?.job_title?.trim() ?? '',
      sector: state.prefs.sector,
      interests: state.prefs.interests,
    }),
    [c, state.prefs],
  );
}

/** Tipo de acesso atribuído pela equipa (null enquanto não for aprovado). */
export function usePass(): PassInfo | null {
  const { state } = useStore();
  return state.view?.invitation.pass_type ?? null;
}

export const pendingCount = (s: State) =>
  Object.values(s.connections).filter((c) => c === 'incoming').length +
  s.meetings.filter((m) => m.status === 'incoming').length;
