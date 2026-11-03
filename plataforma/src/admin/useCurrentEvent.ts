import { useCallback, useMemo, useState } from 'react';
import { api, type EventRecord } from '../lib/api';
import { useAsync } from '../lib/useAsync';

const KEY = 'convites.currentEvent';

function readStored(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

/**
 * Evento em foco (painel e check-in). Lembra a última escolha neste browser;
 * por omissão escolhe o próximo evento aberto, ou o mais recente.
 */
export function useCurrentEvent() {
  const events = useAsync(() => api.events.list(), []);
  const [chosen, setChosen] = useState<string | null>(readStored);

  const current = useMemo<EventRecord | null>(() => {
    const list = events.data ?? [];
    if (!list.length) return null;
    const stored = list.find((e) => e.id === chosen && e.status !== 'archived');
    if (stored) return stored;
    const now = Date.now();
    const upcoming = list
      .filter((e) => e.status === 'open' && new Date(e.ends_at ?? e.starts_at).getTime() >= now - 864e5)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return upcoming[0] ?? [...list].sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  }, [events.data, chosen]);

  const select = useCallback((id: string) => {
    setChosen(id);
    try { localStorage.setItem(KEY, id); } catch { /* sem armazenamento: só nesta sessão */ }
  }, []);

  return { events: events.data ?? [], loading: events.loading, error: events.error, reload: events.reload, current, select };
}
