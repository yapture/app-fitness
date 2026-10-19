import { afterEach, describe, expect, test } from 'bun:test';
import { load, save } from '../src/App';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('browser storage failures', () => {
  test('a blocked read starts with an empty workout', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => { throw new DOMException('blocked', 'SecurityError'); } },
    });
    expect(load()).toEqual([]);
  });

  test('a valid JSON value with the wrong shape cannot crash the workout', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => '{"exercises":[]}' },
    });
    expect(load()).toEqual([]);
  });

  test('malformed entries are discarded while valid exercises remain', () => {
    const valid = {
      id: 'one', raw: 'Squat #@legs', title: 'Squat', split: 'legs',
      routine: null, priority: null, meta: { weight: 100, reps: 5, sets: 3 },
      completed: false, createdAt: '2026-10-19T00:00:00.000Z',
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => JSON.stringify([null, { ...valid, meta: { weight: '100', reps: 5, sets: 3 } }, valid]) },
    });
    expect(load()).toEqual([valid]);
  });

  test('a blocked write reports failure without throwing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: () => { throw new DOMException('full', 'QuotaExceededError'); } },
    });
    expect(save([])).toBe(false);
  });

  test('a successful write reports success', () => {
    let written = '';
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem: (_key: string, value: string) => { written = value; } },
    });
    expect(save([])).toBe(true);
    expect(written).toBe('[]');
  });

  test('a malformed saved workout is never overwritten', () => {
    let writes = 0;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => '{"exercises":[]}', setItem: () => { writes++; } },
    });
    expect(save([])).toBe(false);
    expect(writes).toBe(0);
  });
});
