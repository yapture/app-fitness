import { describe, expect, test } from 'bun:test';
import { createBackup, MAX_BACKUP_BYTES, parseBackup, type Exercise } from '../src/backup';

const exercise: Exercise = {
  id: 'squat-1', raw: 'Squat #@legs #*{weight:185,reps:5,sets:3}', title: 'Squat',
  split: 'legs', routine: 'strength', priority: 'high',
  meta: { weight: 185, reps: 5, sets: 3 }, completed: true,
  createdAt: '2026-10-19T00:00:00.000Z',
};

describe('Fitness backup', () => {
  test('round trips all exercise fields', () => {
    const backup = parseBackup(createBackup([exercise]));
    expect(backup.app).toBe('yapture-fitness');
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exercises).toEqual([exercise]);
  });

  test('rejects malformed, foreign and future formats without dropping rows', () => {
    const valid = JSON.parse(createBackup([exercise]));
    for (const changed of [
      { ...valid, app: 'other' },
      { ...valid, schemaVersion: 2 },
      { ...valid, exercises: [exercise, { ...exercise, meta: { weight: '185', reps: 5, sets: 3 } }] },
      { ...valid, exercises: [exercise, exercise] },
    ]) expect(() => parseBackup(JSON.stringify(changed))).toThrow();
    expect(() => parseBackup('{')).toThrow();
  });

  test('caps imported and exported backup bytes', () => {
    expect(() => parseBackup(' '.repeat(MAX_BACKUP_BYTES + 1))).toThrow('1 MiB');
    expect(() => createBackup([{ ...exercise, title: 'x'.repeat(MAX_BACKUP_BYTES) }])).toThrow('1 MiB');
  });
});
