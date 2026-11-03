// Extensão aditiva de Api['contacts'] (módulo de contactos): pedidos de apagamento de dados por tratar.
// Os dois adaptadores implementam-na; para a passar ao contrato basta acrescentar
// `erasureRequests(): Promise<ErasureRequest[]>;` a `contacts` em types.ts e apagar este ficheiro.

import type { Contact } from './types';

/** Pedido de apagamento feito pelo próprio, na página do convite, cujo contacto ainda não foi anonimizado. */
export interface ErasureRequest {
  contact_id: string;
  /** Primeiro pedido do contacto: é daí que conta o prazo de resposta (um mês, artigo 12.º, n.º 3, do RGPD). */
  requested_at: string;
  contact: Contact;
}

export interface ErasureRequestsApi {
  /** Pedidos por tratar, um por contacto, do mais antigo para o mais recente. */
  erasureRequests(): Promise<ErasureRequest[]>;
}
