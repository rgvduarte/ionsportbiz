// Prazos dos pedidos de apagamento de dados (lógica pura, sem acesso aos dados).

/** Prazo de resposta: um mês após o pedido (artigo 12.º, n.º 3, do RGPD); 31 de janeiro dá o último dia de fevereiro. */
export function erasureDeadline(requestedAt: string | Date): Date {
  const from = new Date(requestedAt);
  const day = from.getDate();
  const out = new Date(from);
  out.setDate(1);
  out.setMonth(out.getMonth() + 1);
  const lastDay = new Date(out.getFullYear(), out.getMonth() + 1, 0).getDate();
  out.setDate(Math.min(day, lastDay));
  return out;
}

export interface DeadlineState {
  kind: 'overdue' | 'soon' | 'ok';
  /** Dias que faltam ou, se ultrapassado, há quantos dias terminou. */
  days: number;
}

const DAY = 864e5;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Dias de calendário até ao fim do prazo (0 = termina hoje); "soon" na última semana. */
export function deadlineState(requestedAt: string | Date, now: Date = new Date()): DeadlineState {
  const days = Math.round((startOfDay(erasureDeadline(requestedAt)) - startOfDay(now)) / DAY);
  if (days < 0) return { kind: 'overdue', days: -days };
  return { kind: days <= 7 ? 'soon' : 'ok', days };
}

/** "Termina hoje", "Faltam 3 dias", "Ultrapassado há 2 dias". */
export function deadlineLabel(state: DeadlineState): string {
  if (state.kind === 'overdue') return state.days === 1 ? 'Ultrapassado há 1 dia' : `Ultrapassado há ${state.days} dias`;
  if (state.days === 0) return 'Termina hoje';
  if (state.days === 1) return 'Termina amanhã';
  return `Faltam ${state.days} dias`;
}
