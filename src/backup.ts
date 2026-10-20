export interface ExerciseMeta { weight: number; reps: number; sets: number }

export interface Exercise {
  id: string; raw: string; title: string;
  split: 'push' | 'pull' | 'legs' | null;
  routine: string | null; priority: string | null;
  meta: ExerciseMeta | null; completed: boolean; createdAt: string;
}

export const MAX_BACKUP_BYTES = 1024 * 1024;

export function isExercise(value: unknown): value is Exercise {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const exercise = value as Record<string, unknown>;
  const nullableString = (field: string) => exercise[field] === null || typeof exercise[field] === 'string';
  const meta = exercise.meta;
  const validMeta = meta === null || (typeof meta === 'object' && meta !== null && !Array.isArray(meta)
    && ['weight', 'reps', 'sets'].every((field) => {
      const amount = (meta as Record<string, unknown>)[field];
      return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;
    }));
  return typeof exercise.id === 'string'
    && typeof exercise.raw === 'string'
    && typeof exercise.title === 'string'
    && typeof exercise.createdAt === 'string'
    && (exercise.split === null || exercise.split === 'push' || exercise.split === 'pull' || exercise.split === 'legs')
    && nullableString('routine') && nullableString('priority')
    && typeof exercise.completed === 'boolean' && validMeta;
}

export interface FitnessBackup {
  app: 'yapture-fitness';
  schemaVersion: 1;
  exportedAt: string;
  exercises: Exercise[];
}

export function createBackup(exercises: Exercise[]): string {
  const serialized = JSON.stringify({ app: 'yapture-fitness', schemaVersion: 1,
    exportedAt: new Date().toISOString(), exercises }, null, 2);
  if (new TextEncoder().encode(serialized).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 1 MiB');
  return serialized;
}

export function parseBackup(text: string): FitnessBackup {
  if (new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds 1 MiB');
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new Error('Backup is not valid JSON'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid backup');
  const backup = value as Record<string, unknown>;
  if (backup.app !== 'yapture-fitness' || backup.schemaVersion !== 1
    || typeof backup.exportedAt !== 'string' || Number.isNaN(Date.parse(backup.exportedAt))
    || !Array.isArray(backup.exercises) || !backup.exercises.every(isExercise)) {
    throw new Error('Invalid or unsupported Fitness backup');
  }
  const ids = new Set((backup.exercises as Exercise[]).map((exercise) => exercise.id));
  if (ids.size !== backup.exercises.length) throw new Error('Backup contains duplicate exercise IDs');
  createBackup(backup.exercises as Exercise[]);
  return backup as unknown as FitnessBackup;
}
