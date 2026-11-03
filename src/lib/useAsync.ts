import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Volta a carregar mantendo os dados atuais visíveis. */
  reload: () => void;
  /** Substitui os dados localmente (ex.: depois de gravar). */
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/** Carrega dados de forma assíncrona; ignora respostas antigas quando as dependências mudam. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    fn().then(
      (value) => { if (id === run.current) { setData(value); setLoading(false); } },
      (err) => { if (id === run.current) { setError(err); setLoading(false); } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const set = useCallback((u: T | ((prev: T | undefined) => T)) => {
    setData((prev) => (typeof u === 'function' ? (u as (p: T | undefined) => T)(prev) : u));
  }, []);
  return { data, error, loading, reload, setData: set };
}
