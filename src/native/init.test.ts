import { describe, expect, it } from 'vitest';
import { authLink, deepLinkPath, trustedUrl } from './init';

const T = 'AbCdEfGhIjKlMnOpQr_-12';

describe('deepLinkPath', () => {
  it('aceita o link pessoal https e o esquema convites://', () => {
    expect(deepLinkPath(`https://convites.exemplo.pt/c/${T}`)).toBe(`/c/${T}`);
    expect(deepLinkPath(`https://convites.exemplo.pt/c/${T}/`)).toBe(`/c/${T}`);
    expect(deepLinkPath(`https://convites.exemplo.pt/c/${T}?utm_source=email#rsvp`)).toBe(`/c/${T}`);
    expect(deepLinkPath(`convites://c/${T}`)).toBe(`/c/${T}`);
    expect(deepLinkPath(` convites://c/${T} `)).toBe(`/c/${T}`);
  });

  it('recusa outros endereços', () => {
    expect(deepLinkPath(`http://convites.exemplo.pt/c/${T}`)).toBeNull();
    expect(deepLinkPath(`https://convites.exemplo.pt/c/curto`)).toBeNull();
    expect(deepLinkPath(`https://convites.exemplo.pt/x/c/${T}`)).toBeNull();
    expect(deepLinkPath(`convites://c/${T}/extra`)).toBeNull();
    expect(deepLinkPath('')).toBeNull();
  });
});

describe('links do back-office', () => {
  it('abre /admin e as suas páginas', () => {
    expect(deepLinkPath('https://convites.exemplo.pt/admin')).toBe('/admin');
    expect(deepLinkPath('https://convites.exemplo.pt/admin/check-in/')).toBe('/admin/check-in');
    expect(deepLinkPath('https://convites.exemplo.pt/admin#access_token=a&refresh_token=b')).toBe('/admin');
    expect(deepLinkPath('https://convites.exemplo.pt/administracao')).toBeNull();
    expect(deepLinkPath('https://convites.exemplo.pt/admin/../c')).toBeNull();
  });

  it('lê as credenciais do link de acesso', () => {
    expect(authLink('https://x.pt/admin#access_token=A1&expires_in=3600&refresh_token=R1&type=invite'))
      .toEqual({ kind: 'session', access_token: 'A1', refresh_token: 'R1' });
    expect(authLink('https://x.pt/admin?token_hash=H1&type=magiclink'))
      .toEqual({ kind: 'otp', token_hash: 'H1', type: 'magiclink' });
    expect(authLink('https://x.pt/admin/?token_hash=H1&type=invite#x')).toMatchObject({ kind: 'otp', type: 'invite' });
    expect(authLink('https://x.pt/admin?token_hash=H1&type=outro')).toBeNull();
    expect(authLink('https://x.pt/admin#error=access_denied&error_code=otp_expired')).toBeNull();
    expect(authLink(`https://x.pt/c/${T}#access_token=A&refresh_token=R`)).toBeNull();
    expect(authLink('https://x.pt/admin')).toBeNull();
  });
});

describe('trustedUrl', () => {
  const PUBLIC = 'https://convites.exemplo.pt';

  it('aceita o domínio público e o esquema convites://', () => {
    expect(trustedUrl(`https://convites.exemplo.pt/c/${T}`, PUBLIC)).toBe(`https://convites.exemplo.pt/c/${T}`);
    expect(trustedUrl('https://CONVITES.exemplo.pt/admin#access_token=A&refresh_token=R', PUBLIC))
      .toBe('https://convites.exemplo.pt/admin#access_token=A&refresh_token=R');
    expect(trustedUrl(` convites://c/${T} `, PUBLIC)).toBe(`convites://c/${T}`);
    expect(trustedUrl(`convites://c/${T}`, 'capacitor://localhost')).toBe(`convites://c/${T}`);
  });

  it('recusa outros domínios, http e endereços enganadores', () => {
    expect(trustedUrl('https://evil.pt/admin#access_token=A&refresh_token=R', PUBLIC)).toBeNull();
    expect(trustedUrl(`http://convites.exemplo.pt/c/${T}`, PUBLIC)).toBeNull();
    expect(trustedUrl('https://convites.exemplo.pt.evil.pt/admin', PUBLIC)).toBeNull();
    expect(trustedUrl('https://convites.exemplo.pt@evil.pt/admin', PUBLIC)).toBeNull();
    expect(trustedUrl('https://user@convites.exemplo.pt/admin', PUBLIC)).toBeNull();
    expect(trustedUrl('https://evil.pt\\@convites.exemplo.pt/admin', PUBLIC)).toBeNull();
    expect(trustedUrl('https://convites.exemplo.pt:8443/admin', PUBLIC)).toBeNull();
    expect(trustedUrl('javascript:alert(1)', PUBLIC)).toBeNull();
    expect(trustedUrl('não é um endereço', PUBLIC)).toBeNull();
  });

  it('sem domínio público configurado só aceita convites://', () => {
    expect(trustedUrl('https://localhost/admin#access_token=A&refresh_token=R', 'https://localhost')).toBeNull();
    expect(trustedUrl('https://evil.pt/admin', 'capacitor://localhost')).toBeNull();
    expect(trustedUrl('https://evil.pt/admin', 'http://evil.pt')).toBeNull();
  });

  it('o endereço normalizado é o que se lê depois', () => {
    // A barra invertida conta como "/" no parser de URL: o domínio real é o público e o caminho deixa de ser /admin.
    const url = trustedUrl('https://convites.exemplo.pt\\evil/admin#access_token=A&refresh_token=R', PUBLIC);
    expect(url).toBe('https://convites.exemplo.pt/evil/admin#access_token=A&refresh_token=R');
    expect(deepLinkPath(url!)).toBeNull();
    expect(authLink(url!)).toBeNull();
  });
});
