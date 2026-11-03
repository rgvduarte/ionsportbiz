import { describe, expect, it } from 'vitest';
import { credentialState, groupCode, guestName, passColors, passIsVip, pickActiveToken, parseInviteToken, sessionAccess } from './invite';

const T = 'aB3_dE5-gH7iJ9kL1mN0pQ'; // 22 caracteres
const U = 'Zz9_yY8-xX7wW6vV5uU4tT';

describe('parseInviteToken', () => {
  it('aceita o token sozinho', () => {
    expect(parseInviteToken(T)).toBe(T);
    expect(parseInviteToken(`  ${T}\n`)).toBe(T);
  });

  it('aceita o link completo, com ou sem "#/", protocolo, parâmetros ou barra final', () => {
    expect(parseInviteToken(`https://convites.ionsportsbiz.com/c/${T}`)).toBe(T);
    expect(parseInviteToken(`https://user.github.io/osint/#/c/${T}`)).toBe(T);
    expect(parseInviteToken(`convites.ionsportsbiz.com/c/${T}/`)).toBe(T);
    expect(parseInviteToken(`https://x.pt/c/${T}?utm_source=whatsapp`)).toBe(T);
    expect(parseInviteToken(`https://x.pt/c/${T}#programa`)).toBe(T);
    expect(parseInviteToken(`convites://c/${T}`)).toBe(T);
    expect(parseInviteToken(`c/${T}`)).toBe(T);
  });

  it('encontra o link no meio da mensagem e ignora pontuação colada ao fim', () => {
    expect(parseInviteToken(`Olá João, o seu convite: https://x.pt/c/${T}. Até breve!`)).toBe(T);
    expect(parseInviteToken(`<https://x.pt/c/${T}>`)).toBe(T);
    expect(parseInviteToken(`(https://x.pt/#/c/${T})`)).toBe(T);
  });

  it('aceita links codificados', () => {
    expect(parseInviteToken(`https%3A%2F%2Fx.pt%2Fc%2F${T}`)).toBe(T);
    expect(parseInviteToken('https://x.pt/c/%zz')).toBeNull();
  });

  it('recusa tokens incompletos, compridos demais ou outros endereços', () => {
    expect(parseInviteToken('')).toBeNull();
    expect(parseInviteToken('   ')).toBeNull();
    expect(parseInviteToken(T.slice(1))).toBeNull();
    expect(parseInviteToken(`${T}x`)).toBeNull();
    expect(parseInviteToken(`https://x.pt/c/${T.slice(2)}`)).toBeNull();
    expect(parseInviteToken(`https://x.pt/c/${T}A`)).toBeNull();
    expect(parseInviteToken(`https://x.pt/admin/${T}`)).toBeNull();
    expect(parseInviteToken(`https://x.pt/abc/${T}`)).toBeNull();
    expect(parseInviteToken('https://x.pt/c/')).toBeNull();
  });
});

describe('guestName', () => {
  const c = { salutation: 'Dr.', first_name: 'João', last_name: 'Silva' };
  it('junta nome e apelido, com o tratamento só quando pedido', () => {
    expect(guestName(c)).toBe('João Silva');
    expect(guestName(c, true)).toBe('Dr. João Silva');
    expect(guestName({ salutation: null, first_name: ' Ana ', last_name: null }, true)).toBe('Ana');
  });
});

describe('credentialState', () => {
  const inv = (status: string, approval_status: string, checkin_code: string | null = null) =>
    credentialState({ status, approval_status, checkin_code } as Parameters<typeof credentialState>[0]);
  it('segue o convite: confirmar, aguardar aprovação, aprovado', () => {
    expect(inv('sent', 'pending')).toBe('unconfirmed');
    expect(inv('opened', 'approved')).toBe('unconfirmed');
    expect(inv('accepted', 'pending')).toBe('pending');
    expect(inv('accepted', 'approved', 'ABCDE12345')).toBe('approved');
    expect(inv('accepted', 'rejected')).toBe('rejected');
    expect(inv('declined', 'approved')).toBe('declined');
  });
  it('a decisão da equipa vale mesmo antes da resposta; a recusa do convidado prevalece', () => {
    expect(inv('opened', 'rejected')).toBe('rejected');
    expect(inv('declined', 'rejected')).toBe('declined');
  });
  it('sem código não há credencial, mesmo aprovado', () => {
    expect(inv('accepted', 'approved', null)).toBe('pending');
  });
});

describe('acessos', () => {
  const vip = { name: 'VIP Pass', accesses: ['VIP Gala Dinner', 'ion Conference'] };
  const gala = { name: 'Gala', accesses: ['VIP Gala Dinner'] };
  const conf = { name: 'Conference Pass', accesses: ['ion Conference (5 palcos)', 'Zona de networking'] };
  it('reconhece tipos VIP pelo nome ou pelos acessos', () => {
    expect(passIsVip(vip)).toBe(true);
    expect(passIsVip(gala)).toBe(true);
    expect(passIsVip({ name: 'vip', accesses: [] })).toBe(true);
    expect(passIsVip(conf)).toBe(false);
    expect(passIsVip({ name: 'Vipers Club', accesses: [] })).toBe(false);
    expect(passIsVip(null)).toBe(false);
  });
  it('decide o acesso a cada sessão', () => {
    expect(sessionAccess({}, null)).toBe('open');
    expect(sessionAccess({}, conf)).toBe('open');
    expect(sessionAccess({ access: 'vip' }, null)).toBe('unknown');
    expect(sessionAccess({ access: 'vip' }, vip)).toBe('included');
    expect(sessionAccess({ access: 'vip' }, conf)).toBe('notIncluded');
  });
});

describe('pickActiveToken', () => {
  const s = (token: string, savedAt: string) => ({ token, savedAt });
  it('sem convites guardados não há sessão', () => {
    expect(pickActiveToken([], T, '2026-01-01T00:00:00Z')).toBeNull();
  });
  it('mantém o convite atual enquanto estiver guardado', () => {
    expect(pickActiveToken([s(T, '2026-01-01T00:00:00Z'), s(U, '2025-01-01T00:00:00Z')], T, '2026-02-01T00:00:00Z')).toBe(T);
  });
  it('muda para um convite guardado depois de a app ter entrado', () => {
    expect(pickActiveToken([s(T, '2026-01-01T00:00:00Z'), s(U, '2026-03-01T00:00:00Z')], T, '2026-02-01T00:00:00Z')).toBe(U);
  });
  it('sem convite atual (ou removido), usa o guardado mais recentemente', () => {
    expect(pickActiveToken([s(T, '2026-01-01T00:00:00Z'), s(U, '2026-03-01T00:00:00Z')], null, null)).toBe(U);
    expect(pickActiveToken([s(T, '2026-01-01T00:00:00Z')], U, '2026-02-01T00:00:00Z')).toBe(T);
  });
});

describe('passColors', () => {
  it('aceita só cores #rgb ou #rrggbb e escolhe texto legível', () => {
    expect(passColors('#ccff00')).toEqual({ accent: '#ccff00', on: '#000000' });
    expect(passColors('#123')).toEqual({ accent: '#112233', on: '#ffffff' });
    expect(passColors('red')).toBeNull();
    expect(passColors('#ccff00;background:url(x)')).toBeNull();
    expect(passColors(null)).toBeNull();
  });
});

describe('groupCode', () => {
  it('agrupa em blocos de 5', () => {
    expect(groupCode('v54bggqfft')).toBe('V54BG-GQFFT');
  });
});
