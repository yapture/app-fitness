import { describe, expect, test } from 'bun:test';
import { parseExercise } from '../src/App';
import { createBackup, isExercise, parseBackup, type Exercise } from '../src/backup';

const complete = (draft: NonNullable<ReturnType<typeof parseExercise>>): Exercise => ({
  ...draft, id: 'draft', completed: false, createdAt: '2026-10-21T00:00:00Z',
});

describe('exercise numeric input before preview and storage', () => {
  for (const field of ['weight', 'reps', 'sets']) {
    for (const value of ['-1', 'Infinity', '-Infinity', '1e309', 'NaN', 'word', '', '8:extra']) {
      test(`${field}:${value} remains an editable input error`, () => {
        expect(parseExercise(`Squat #@legs #*{weight:185,reps:5,sets:3,${field}:${value}}`)).toBeNull();
      });
    }
  }

  test('an empty composer has no exercise draft', () => {
    expect(parseExercise('   ')).toBeNull();
  });

  for (const text of [
    'Bench Press #@push #!high #*{weight:185,reps:8,sets:3}',
    'Squat #@legs #~strength #*{weight:2.5,reps:0,sets:3}',
    'Pull-ups #@pull #*{weight:0,reps:10,sets:3}',
    'Walk',
    'Light #*{weight:1e2,reps:2,sets:3}',
    'Rest #*{weight:0,reps:0,sets:0}',
    'Custom #*{note:word,weight:1,reps:2,sets:3}',
  ]) {
    test(`valid draft remains accepted by durable storage and backup: ${text}`, () => {
      const draft = parseExercise(text);
      expect(draft).not.toBeNull();
      const exercise = complete(draft!);
      expect(isExercise(exercise)).toBe(true);
      expect(parseBackup(createBackup([exercise])).exercises).toEqual([exercise]);
      expect(exercise.raw).toBe(text);
    });
  }

  test('valid metadata keeps its exact values and tags', () => {
    expect(parseExercise('Squat #@legs #~strength #!high #*{weight:2.5,reps:0,sets:3}')).toMatchObject({
      title: 'Squat', split: 'legs', routine: 'strength', priority: 'high',
      meta: { weight: 2.5, reps: 0, sets: 3 },
    });
  });
});
