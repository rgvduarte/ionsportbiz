// Convites guardados na app ("Os meus convites"). Só se guarda o token do link pessoal
// e uma cópia do nome e da data do evento, para a lista aparecer mesmo sem rede.
// Na app nativa usa as Preferences do Capacitor; no browser, o localStorage.

import { isNative } from './platform';

export interface SavedInvitation {
  token: string;
  eventName: string;
  startsAt: string;
  timezone?: string;
  /** Quando foi guardado (ISO). */
  savedAt: string;
}

const KEY = 'convites.saved.v1';
const TOKEN = /^[A-Za-z0-9_-]{22}$/;

async function read(): Promise<string | null> {
  try {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      return (await Preferences.get({ key: KEY })).value;
    }
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

async function write(value: string): Promise<void> {
  try {
    if (isNative) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key: KEY, value });
      return;
    }
    localStorage.setItem(KEY, value);
  } catch {
    // Sem armazenamento disponível: a lista fica como estava.
  }
}

function isSaved(x: unknown): x is SavedInvitation {
  const s = x as SavedInvitation | null;
  return !!s && typeof s.token === 'string' && TOKEN.test(s.token)
    && typeof s.eventName === 'string' && typeof s.startsAt === 'string';
}

/** Convites guardados, do mais recente para o mais antigo (por data do evento). */
async function list(): Promise<SavedInvitation[]> {
  const raw = await read();
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSaved).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  } catch {
    return [];
  }
}

// Leitura e escrita são assíncronas: as alterações correm em fila para não se sobreporem.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

/** Guarda ou atualiza (pelo token) um convite. */
function add(item: Omit<SavedInvitation, 'savedAt'> & { savedAt?: string }): Promise<void> {
  if (!TOKEN.test(item.token)) return Promise.resolve();
  return serial(async () => {
    const all = await list();
    const existing = all.find((s) => s.token === item.token);
    const next: SavedInvitation = {
      token: item.token,
      eventName: item.eventName,
      startsAt: item.startsAt,
      ...((item.timezone ?? existing?.timezone) ? { timezone: item.timezone ?? existing?.timezone } : {}),
      // Um savedAt explícito (ex.: "Abrir a app do evento") passa este convite para o mais recente.
      savedAt: item.savedAt ?? existing?.savedAt ?? new Date().toISOString(),
    };
    if (existing && existing.eventName === next.eventName && existing.startsAt === next.startsAt && existing.timezone === next.timezone
      && existing.savedAt === next.savedAt) return;
    await write(JSON.stringify([next, ...all.filter((s) => s.token !== item.token)]));
  });
}

function remove(token: string): Promise<void> {
  return serial(async () => {
    const all = await list();
    await write(JSON.stringify(all.filter((s) => s.token !== token)));
  });
}

export const savedInvitations = { list, add, remove };
