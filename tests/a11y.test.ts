import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Source-level WCAG 2.2 AA regression checks for the single-screen SPA (src/App.tsx).
const ROOT = resolve(import.meta.dir, '..');
const src = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8');

describe('a11y (source-level)', () => {
  test('no outline:none without a :focus-visible replacement rule', () => {
    if (/outline:\s*['"]none['"]/.test(src)) {
      expect(src).toMatch(/input:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--yap-ring\)/);
    }
    expect(src).toMatch(/input:focus-visible,\s*select:focus-visible,\s*textarea:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--yap-ring\)/);
  });

  test('every x remove button has an aria-label and an aria-hidden glyph', () => {
    const buttons = [...src.matchAll(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*?<\/button>/g)].map(m => m[0]).filter(b => /&times;/.test(b) && !/\d&times;|&times;\{/.test(b));
    expect(buttons.length).toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b).toMatch(/aria-label=\{`Remove /);
      expect(b).toMatch(/<span aria-hidden="true">&times;<\/span>/);
    }
  });

  test('main input has a programmatic label', () => {
    expect(src).toMatch(/<label htmlFor="exercise-input"[^>]*>Add exercise<\/label>/);
    expect(src).toMatch(/<input id="exercise-input"/);
  });

  test('always-mounted polite status region exists', () => {
    expect(src).toMatch(/<p role="status" aria-live="polite"[^>]*className="sr-only"/);
    expect(src).toContain('.sr-only {');
  });

  test('completion toggle exposes aria-pressed and an accessible name', () => {
    expect(src).toMatch(/aria-pressed=\{ex\.completed\}/);
    expect(src).toMatch(/aria-label=\{`Completed: \$\{ex\.title\}`\}/);
  });

  test('tab buttons expose aria-pressed', () => {
    expect(src).toMatch(/onClick=\{\(\) => setTab\(t\)\} aria-pressed=\{tab === t\}/);
  });

  test('footer links are underlined; faint text token is not used for text', () => {
    expect(src).toMatch(/fLink: \{[^}]*textDecoration: 'underline'/);
    expect(src).not.toMatch(/(?<![a-zA-Z])color: 'var\(--yap-fg-faint\)'/);
  });
});
