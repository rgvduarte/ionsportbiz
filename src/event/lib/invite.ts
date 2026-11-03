// Regras do convite na app do evento (funções puras, testadas em invite.test.ts).
// A app é só para convidados: a entrada faz-se com o link pessoal (/c/<token>) e o tipo de acesso
// é decidido pela equipa ion no back-office, nunca pelo participante.

import type { GuestView } from '../../lib/api/types';
import type { Session } from '../data/types';

const TOKEN = /^[A-Za-z0-9_-]{22}$/;

/**
 * Token a partir do que o convidado colou: o link completo (com ou sem protocolo, com ou sem "#/",
 * parâmetros, barra ou pontuação no fim, como acontece ao copiar do WhatsApp) ou só o token.
 */
export function parseInviteToken(text: string): string | null {
  let value = text.trim();
  if (!value) return null;
  try {
    value = decodeURIComponent(value);
  } catch {
    // Link com "%" solto: lê-se como está.
  }
  if (TOKEN.test(value)) return value;
  const m = /(?:^|[/#])c\/([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(value);
  return m ? m[1]! : null;
}

export type GuestContact = GuestView['contact'];
export type PassInfo = NonNullable<GuestView['invitation']['pass_type']>;

/** "João Silva"; com o tratamento, "Dr. João Silva". */
export function guestName(c: Pick<GuestContact, 'salutation' | 'first_name' | 'last_name'>, withSalutation = false): string {
  return [withSalutation ? c.salutation : null, c.first_name, c.last_name]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(' ');
}

/** Em que ponto está o convidado, do convite à credencial. */
export type CredentialState = 'unconfirmed' | 'declined' | 'pending' | 'rejected' | 'approved';

export function credentialState(inv: Pick<GuestView['invitation'], 'status' | 'approval_status' | 'checkin_code'>): CredentialState {
  // A recusa do próprio convidado prevalece; depois, a decisão da equipa (mesmo antes de ele responder).
  if (inv.status === 'declined') return 'declined';
  if (inv.approval_status === 'rejected') return 'rejected';
  if (inv.status !== 'accepted') return 'unconfirmed';
  if (inv.approval_status === 'approved' && inv.checkin_code) return 'approved';
  return 'pending';
}

const VIP = /\bvip\b/i;

/** Sem regra explícita por sessão: um tipo de acesso cujo nome ou acessos falam em "VIP" conta como VIP. */
export function passIsVip(pass: Pick<PassInfo, 'name' | 'accesses'> | null | undefined): boolean {
  return !!pass && (VIP.test(pass.name) || pass.accesses.some((a) => VIP.test(a)));
}

/**
 * Se o convidado pode ir a uma sessão:
 *   open        — aberta a todos os convidados
 *   included    — reservada, e o tipo de acesso atribuído inclui-a
 *   notIncluded — reservada, e o tipo de acesso atribuído não a inclui
 *   unknown     — reservada, mas a equipa ainda não atribuiu o tipo de acesso
 */
export type SessionAccess = 'open' | 'included' | 'notIncluded' | 'unknown';

export function sessionAccess(session: Pick<Session, 'access'>, pass: Pick<PassInfo, 'name' | 'accesses'> | null | undefined): SessionAccess {
  if (!session.access) return 'open';
  if (!pass) return 'unknown';
  return passIsVip(pass) ? 'included' : 'notIncluded';
}

/** Convite guardado no dispositivo (o que interessa de savedInvitations). */
export interface SavedRef {
  token: string;
  savedAt: string;
}

/**
 * Que convite abre a app, entre os guardados neste dispositivo:
 *   1. um guardado depois de a app ter entrado com o atual (ex.: "Abrir a app do evento" noutro convite);
 *   2. o atual, se continuar guardado;
 *   3. o guardado mais recentemente.
 * null: nenhum (a app mostra a entrada).
 */
export function pickActiveToken(saved: SavedRef[], current: string | null, activatedAt: string | null): string | null {
  if (saved.length === 0) return null;
  const newest = [...saved].sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0]!;
  const stillSaved = !!current && saved.some((s) => s.token === current);
  if (stillSaved && activatedAt && newest.token !== current && newest.savedAt > activatedAt) return newest.token;
  if (stillSaved) return current;
  return newest.token;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Cor do tipo de acesso (vem da base de dados e entra em CSS: só #rgb ou #rrggbb) e cor do texto por cima. */
export function passColors(color: string | null | undefined): { accent: string; on: string } | null {
  const c = color?.trim();
  if (!c || !HEX.test(c)) return null;
  let h = c.slice(1);
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  // Preto sobre cores claras, branco sobre escuras (o que tiver mais contraste).
  return { accent: `#${h.toLowerCase()}`, on: (lum + 0.05) / 0.05 >= 1.05 / (lum + 0.05) ? '#000000' : '#ffffff' };
}

/** "V54BGGQFFT" → "V54BG-GQFFT": blocos de 5, como a equipa os vê na porta. */
export function groupCode(code: string): string {
  const clean = code.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return clean.match(/.{1,5}/g)?.join('-') ?? '';
}
