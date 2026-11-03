import { describe, expect, it } from 'vitest';
import { buildEmailHtml, buildEmailText, escapeHtml, linkColor, splitParagraphs, textOnAccent } from './email-html';

const link = 'https://convites.exemplo.pt/c/abcdefghijklmnopqrstuv';

describe('escapeHtml', () => {
  it('escapa os caracteres especiais', () => {
    expect(escapeHtml(`<script>"a" & 'b'</script>`)).toBe('&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;');
  });
});

describe('splitParagraphs', () => {
  it('separa por linhas em branco e normaliza CRLF', () => {
    expect(splitParagraphs('A\r\nB\r\n\r\n\r\nC\n  \nD  ')).toEqual(['A\nB', 'C', 'D']);
  });
});

describe('buildEmailHtml', () => {
  const base = { subject: 'Convite — Encontro', ctaLabel: 'Abrir o convite', ctaUrl: link };

  it('escapa o texto do corpo e do assunto', () => {
    const html = buildEmailHtml({ ...base, subject: 'A & B <x>', bodyText: 'Olá <b>Ana</b> & "amigos"' });
    expect(html).toContain('<title>A &amp; B &lt;x&gt;</title>');
    expect(html).toContain('Olá &lt;b&gt;Ana&lt;/b&gt; &amp; &quot;amigos&quot;');
    expect(html).not.toContain('<b>Ana</b>');
  });

  it('converte mudanças de linha e parágrafos', () => {
    const html = buildEmailHtml({ ...base, bodyText: 'Linha 1\nLinha 2\n\nOutro parágrafo' });
    expect(html).toContain('Linha 1<br>Linha 2</p>');
    expect(html.match(/<p style="margin:0 0 18px/g)).toHaveLength(2);
  });

  it('põe o botão no lugar da linha que é só o link', () => {
    const html = buildEmailHtml({ ...base, bodyText: `Confirme aqui:\n${link}\n\nCumprimentos` });
    expect(html.match(/Abrir o convite/g)).toHaveLength(1);
    expect(html.indexOf('Abrir o convite')).toBeLessThan(html.indexOf('Cumprimentos'));
    // O endereço não aparece também como texto solto.
    expect(html.match(new RegExp(link.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'g'))).toHaveLength(1);
  });

  it('acrescenta o botão no fim se o corpo não tiver o link', () => {
    const html = buildEmailHtml({ ...base, bodyText: 'Texto sem link' });
    expect(html.indexOf('Texto sem link')).toBeLessThan(html.indexOf('Abrir o convite'));
    expect(html).toContain(`href="${link}"`);
  });

  it('transforma endereços no meio do texto em links', () => {
    const html = buildEmailHtml({ ...base, bodyText: 'Veja https://exemplo.pt/a?b=1&c=2.' });
    expect(html).toContain('<a href="https://exemplo.pt/a?b=1&amp;c=2"');
    expect(html).toContain('</a>.');
  });

  it('ignora cores e logótipos inválidos', () => {
    const html = buildEmailHtml({ ...base, bodyText: 'x', accent: 'red;background:url(x)', logoUrl: 'javascript:alert(1)' });
    expect(html).toContain('#13294b');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('red;background');
    const ok = buildEmailHtml({ ...base, bodyText: 'x', accent: '#8a1538', logoUrl: 'https://exemplo.pt/logo.png' });
    expect(ok).toContain('#8a1538');
    expect(ok).toContain('src="https://exemplo.pt/logo.png"');
  });

  it('mostra o rodapé escapado', () => {
    const html = buildEmailHtml({ ...base, bodyText: 'x', footer: 'Convite pessoal & intransmissível\nLisboa' });
    expect(html).toContain('Convite pessoal &amp; intransmissível<br>Lisboa');
  });
});

describe('buildEmailText', () => {
  it('mantém o corpo e não repete o link', () => {
    const text = buildEmailText({ bodyText: `Olá\n\n${link}`, ctaLabel: 'Abrir o convite', ctaUrl: link, footer: 'Rodapé' });
    expect(text).toBe(`Olá\n\n${link}\n\n--\nRodapé\n`);
  });

  it('acrescenta o link quando falta no corpo', () => {
    const text = buildEmailText({ bodyText: 'Olá', ctaLabel: 'Abrir o convite', ctaUrl: link });
    expect(text).toBe(`Olá\n\nAbrir o convite: ${link}\n`);
  });
});

describe('contraste da cor da marca', () => {
  it('botão: texto escuro sobre verde-lima, branco sobre azul-marinho', () => {
    expect(textOnAccent('#ccff00')).toBe('#101828');
    expect(textOnAccent('#13294b')).toBe('#ffffff');
  });

  it('links: o verde-lima é escurecido para se ler sobre branco', () => {
    expect(linkColor('#13294b')).toBe('#13294b');
    const c = linkColor('#ccff00');
    expect(c).not.toBe('#ccff00');
    expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});
