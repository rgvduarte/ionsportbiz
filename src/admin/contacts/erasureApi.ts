import { api } from '../../lib/api';
import type { ErasureRequest, ErasureRequestsApi } from '../../lib/api/erasure';

export type { ErasureRequest };

/**
 * Pedidos de apagamento por tratar. `erasureRequests` ainda não está em Api['contacts'] (types.ts),
 * mas os dois adaptadores implementam-na (ver lib/api/erasure.ts).
 */
export function pendingErasureRequests(): Promise<ErasureRequest[]> {
  return (api.contacts as typeof api.contacts & ErasureRequestsApi).erasureRequests();
}
