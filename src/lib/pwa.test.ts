import { describe, expect, it } from 'vitest';
import { installPlatform } from './pwa';

describe('installPlatform', () => {
  it('reconhece iPhone, iPad (também o que se apresenta como Mac) e Android', () => {
    expect(installPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', false)).toBe('ios');
    expect(installPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', true)).toBe('ios');
    expect(installPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36', false)).toBe('android');
    expect(installPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36', false)).toBe('other');
  });
});
