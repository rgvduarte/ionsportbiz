import { ApiError } from './errors';

/** Implementação provisória: qualquer chamada falha com "Por implementar". */
export function todo<T extends object>(area: string): T {
  return new Proxy({} as T, {
    get: (_t, prop) => async () => {
      throw new ApiError('unknown', `${area}.${String(prop)}`, `Por implementar: ${area}.${String(prop)}`);
    },
  });
}
