import { expect, test } from 'bun:test';
import { parseExercise } from '../src/App';

test('weight, reps and sets reject incomplete, negative and non-finite values', () => {
  for (const field of ['weight', 'reps', 'sets']) {
    for (const value of ['-1', 'Infinity', '-Infinity', '1e309', 'NaN', 'word', '', '8:extra']) {
      expect(parseExercise(`Squat #@legs #*{weight:185,reps:5,sets:3,${field}:${value}}`)).toBeNull();
    }
  }
});

test('blank input has no draft', () => {
  expect(parseExercise('   ')).toBeNull();
});

test('ordinary exercises preserve tags and finite metadata', () => {
  expect(parseExercise('Squat #@legs #~strength #!high #*{weight:2.5,reps:0,sets:3}')).toEqual({
    raw: 'Squat #@legs #~strength #!high #*{weight:2.5,reps:0,sets:3}',
    title: 'Squat', split: 'legs', routine: 'strength', priority: 'high',
    meta: { weight: 2.5, reps: 0, sets: 3 },
  });
  expect(parseExercise('Walk')?.meta).toBeNull();
  expect(parseExercise('Light #*{weight:1e2,reps:2,sets:3}')?.meta?.weight).toBe(100);
  expect(parseExercise('Rest #*{weight:0,reps:0,sets:0}')?.meta).toBeNull();
  expect(parseExercise('Custom #*{note:word,weight:1,reps:2,sets:3}')?.meta).toEqual({ weight: 1, reps: 2, sets: 3 });
});
