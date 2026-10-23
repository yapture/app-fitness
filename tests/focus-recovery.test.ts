import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createBackup, parseBackup, type Exercise } from '../src/backup';

const source = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const effect = source.match(/\/\* After a removal,[\s\S]*?useEffect\(\(\) => \{([\s\S]*?)\}, \[exercises\]\);/)?.[1];
if (!effect) throw new Error('Removal focus effect is missing');
const runEffect = new Function('document', 'pendingFocus',
  new Bun.Transpiler({ loader: 'ts' }).transformSync(effect));
const exercise: Exercise = {
  id: '', raw: 'Squat #@legs', title: 'Squat', split: 'legs', routine: null,
  priority: null, meta: null, completed: false, createdAt: '2026-10-21T00:00:00Z',
};

function fixture(id: string | null, available: string[], heading = true) {
  const focused: string[] = [], attempted: string[] = [];
  const controls = available.map(removeId => ({ dataset: { removeId }, disabled: false,
    matches(selector: string) { expect(selector).toBe(':disabled'); return this.disabled; },
    focus() { attempted.push(removeId); if (!this.disabled) focused.push(removeId); } }));
  const pending = { current: { id } as { id: string | null } | null };
  const root = {
    querySelectorAll(selector: string) {
      expect(selector).toBe('[data-remove-id]');
      return controls;
    },
    getElementById(key: string) {
      expect(key).toBe('today-heading');
      return heading ? { focus: () => { attempted.push('heading'); focused.push('heading'); } } : null;
    },
  };
  return { focused, attempted, controls, pending, run: () => runEffect(root, pending) };
}

for (const id of ['', '0', 'quote"slash\\id']) {
  test(`removal focuses the surviving control for accepted backup ID ${JSON.stringify(id)}`, () => {
    const restored = parseBackup(createBackup([{ ...exercise, id }])).exercises[0];
    const f = fixture(restored.id, [`${id}-other`, restored.id]);
    f.run();
    expect(f.focused).toEqual([id]);
    expect(f.pending.current).toBeNull();
    f.run();
    expect(f.focused).toEqual([id]);
  });
}

test('no surviving neighbour focuses the list heading', () => {
  const f = fixture(null, ['']); f.run();
  expect(f.focused).toEqual(['heading']);
});

test('missing neighbour falls back to the list heading', () => {
  const f = fixture('gone', ['other']); f.run();
  expect(f.focused).toEqual(['heading']);
});

test('unmounted controls and heading are a no-op', () => {
  const f = fixture('', [], false); f.run();
  expect(f.focused).toEqual([]);
  expect(f.pending.current).toBeNull();
});

for (const id of ['ordinary', '', '\0']) test('disabled surviving removal control falls back to the heading: ' + JSON.stringify(id), () => {
  const f=fixture(id,[id]); f.controls[0].disabled=true; f.run();
  expect(f.focused).toEqual(['heading']); expect(f.attempted).toEqual(['heading']); expect(f.pending.current).toBeNull();
});
test('disabled neighbour and absent heading do not attempt unusable focus',()=>{
 const f=fixture('book',['book'],false);f.controls[0].disabled=true;f.run();
 expect(f.focused).toEqual([]);expect(f.attempted).toEqual([]);expect(f.pending.current).toBeNull();
});
