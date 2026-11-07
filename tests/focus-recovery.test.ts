import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const effect = source.match(/\/\* After a removal,[\s\S]*?useEffect\(\(\) => \{([\s\S]*?)\}, \[exercises\]\);/)?.[1];
if (!effect) throw new Error('Removal focus effect is missing');
const runEffect = new Function('document', 'pendingFocus', new Bun.Transpiler({ loader: 'ts' }).transformSync(effect));

function fixture(id: string | null, available: string[], heading = true) {
  const focused: string[] = [];
  const pending = { current: { id } as { id: string | null } | null };
  const root = {
    querySelectorAll(selector: string) {
      expect(selector).toBe('[data-remove-id]');
      return available.map(removeId => ({ dataset: { removeId }, focus: () => focused.push(removeId) }));
    },
    getElementById: () => heading ? { focus: () => focused.push('heading') } : null,
  };
  return { focused, pending, run: () => runEffect(root, pending) };
}

test('removal finds opaque neighbour IDs exactly, including empty strings', () => {
  for (const id of ['', '0', 'quote"slash\\id', 'line\nbreak']) {
    const f = fixture(id, [`${id}-other`, id]);
    f.run();
    expect(f.focused).toEqual([id]);
    expect(f.pending.current).toBeNull();
    f.run();
    expect(f.focused).toEqual([id]);
  }
});

test('absent neighbours fall back to the heading and unmounted controls do nothing', () => {
  for (const id of [null, 'gone']) {
    const f = fixture(id, ['other']); f.run();
    expect(f.focused).toEqual(['heading']);
  }
  const f = fixture('', [], false); f.run();
  expect(f.focused).toEqual([]);
  expect(f.pending.current).toBeNull();
});
