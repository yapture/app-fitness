import { useCallback, useMemo, useState, type FormEvent } from 'react';

/* -- Types ---------------------------------------------------------------- */

interface ExerciseMeta { weight: number; reps: number; sets: number }

interface Exercise {
  id: string; raw: string; title: string;
  split: 'push' | 'pull' | 'legs' | null;
  routine: string | null; priority: string | null;
  meta: ExerciseMeta | null; completed: boolean; createdAt: string;
}

type Split = 'push' | 'pull' | 'legs';
type DayName = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

/* -- Constants ------------------------------------------------------------ */

/* Split colors mapped to token semantics: push=accent, pull=success, legs=warning */
const SPLIT_C: Record<Split, string> = {
  push: 'var(--yap-accent)',
  pull: 'var(--yap-success)',
  legs: 'var(--yap-warning)',
};
const SPLIT_BG: Record<Split, string> = {
  push: 'var(--yap-info-bg)',
  pull: 'var(--yap-success-bg)',
  legs: 'var(--yap-warning-bg)',
};
const DAYS: DayName[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_SPLIT: Record<DayName, Split | 'rest'> = {
  Mon: 'push', Tue: 'pull', Wed: 'legs', Thu: 'push', Fri: 'pull', Sat: 'legs', Sun: 'rest',
};
const STORAGE_KEY = 'yapture.app-fitness.exercises.v1';

/* -- Persistence ---------------------------------------------------------- */

function load(): Exercise[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
function save(items: Exercise[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }

/* -- Parser --------------------------------------------------------------- */

function parse(text: string): Omit<Exercise, 'id' | 'completed' | 'createdAt'> {
  let split: Exercise['split'] = null, routine: string | null = null,
      priority: string | null = null, meta: ExerciseMeta | null = null;

  const mm = text.match(/#\*\{([^}]*)}/);
  if (mm) {
    const o: Record<string, number> = {};
    for (const p of mm[1].split(',')) { const [k, v] = p.split(':').map(s => s.trim()); if (k && v) o[k] = Number(v); }
    if (o.weight || o.reps || o.sets) meta = { weight: o.weight || 0, reps: o.reps || 0, sets: o.sets || 0 };
  }

  const tr = /#([!@+^~$?])?(\w[\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = tr.exec(text)) !== null) {
    const [, px, val] = m;
    if (px === '@' && (val === 'push' || val === 'pull' || val === 'legs')) split = val;
    else if (px === '~') routine = val;
    else if (px === '!') priority = val;
  }

  const title = text.replace(/#[!@+^~$?]?\w[\w-]*/g, '').replace(/#\*\{[^}]*}/g, '').replace(/\bdue:\S+/g, '').trim();
  return { raw: text, title: title || text, split, routine, priority, meta };
}

/* -- Example templates ---------------------------------------------------- */

const PUSH_EX = [
  'Bench Press #@push #!high #*{weight:185,reps:8,sets:3}',
  'Overhead Press #@push #*{weight:115,reps:8,sets:3}',
  'Lateral Raises #@push #*{weight:25,reps:12,sets:3}',
  'Tricep Dips #@push #*{weight:0,reps:12,sets:3}',
];
const PULL_EX = [
  'Deadlift #@pull #!high #*{weight:275,reps:5,sets:3}',
  'Barbell Rows #@pull #*{weight:155,reps:8,sets:3}',
  'Pull-ups #@pull #*{weight:0,reps:10,sets:3}',
  'Bicep Curls #@pull #*{weight:35,reps:12,sets:3}',
];
const LEG_EX = [
  'Squat #@legs #!high #*{weight:225,reps:6,sets:4}',
  'Leg Press #@legs #*{weight:360,reps:10,sets:3}',
  'Lunges #@legs #*{weight:50,reps:10,sets:3}',
  'Calf Raises #@legs #*{weight:135,reps:15,sets:4}',
];

/* -- Helpers -------------------------------------------------------------- */

function todayName(): DayName {
  return (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as DayName[])[new Date().getDay()];
}

/* -- Component ------------------------------------------------------------ */

export function App() {
  const [exercises, setExercises] = useState<Exercise[]>(load);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'today' | 'calendar' | 'prs'>('today');

  const persist = useCallback((n: Exercise[]) => { setExercises(n); save(n); }, []);

  const addExercise = useCallback((text: string) => {
    if (!text.trim()) return;
    const p = parse(text);
    persist([{ id: crypto.randomUUID(), ...p, completed: false, createdAt: new Date().toISOString() }, ...exercises]);
  }, [exercises, persist]);

  const toggle = useCallback((id: string) => {
    persist(exercises.map(ex => ex.id === id ? { ...ex, completed: !ex.completed } : ex));
  }, [exercises, persist]);

  const remove = useCallback((id: string) => { persist(exercises.filter(ex => ex.id !== id)); }, [exercises, persist]);

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); addExercise(input); setInput(''); };

  const loadTemplate = (items: string[]) => {
    const nw = items.map(t => ({ id: crypto.randomUUID(), ...parse(t), completed: false, createdAt: new Date().toISOString() }) as Exercise);
    persist([...nw, ...exercises]);
  };

  const splitGroups = useMemo(() => {
    const g: Record<Split, Exercise[]> = { push: [], pull: [], legs: [] };
    for (const ex of exercises) if (ex.split && g[ex.split]) g[ex.split].push(ex);
    return g;
  }, [exercises]);

  const dn = todayName();
  const ts = DAY_SPLIT[dn];
  const todayEx = useMemo(() => ts === 'rest' ? [] : exercises.filter(ex => ex.split === ts), [exercises, ts]);
  const done = todayEx.filter(ex => ex.completed).length;

  const prs = useMemo(() => {
    const best = new Map<string, number>();
    for (const ex of exercises) {
      if (ex.meta?.weight && ex.meta.weight > 0) {
        const k = ex.title.toLowerCase();
        if ((ex.meta.weight) > (best.get(k) ?? 0)) best.set(k, ex.meta.weight);
      }
    }
    return Array.from(best.entries()).map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
  }, [exercises]);

  const preview = useMemo(() => input.trim() ? parse(input) : null, [input]);

  /* -- Render helpers ----------------------------------------------------- */

  const metaLabel = (m: ExerciseMeta) => `${m.sets}×${m.reps}${m.weight > 0 ? ` @ ${m.weight} lbs` : ''}`;

  const renderCard = (ex: Exercise, checkbox: boolean) => (
    <div key={ex.id} style={S.card}>
      <div style={S.cardRow}>
        {checkbox && <button type="button" onClick={() => toggle(ex.id)} style={{
          ...S.ckbox, background: ex.completed ? 'var(--yap-success)' : 'var(--yap-border-subtle)',
          borderColor: ex.completed ? 'var(--yap-success)' : 'var(--yap-border)',
          boxShadow: ex.completed ? 'var(--yap-shadow-xs)' : 'none',
        }} title={ex.completed ? 'Mark incomplete' : 'Mark completed'}>
          {ex.completed && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 3.5L3.5 6L9 1" stroke="#080b10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>}
        <span style={{ ...S.cardTitle, ...(ex.completed ? { textDecoration: 'line-through', opacity: 0.45 } : {}) }}>{ex.title}</span>
        <button type="button" onClick={() => remove(ex.id)} style={S.removeBtn}>&times;</button>
      </div>
      <div style={S.badges}>
        {ex.meta && <span style={S.metaBadge}>{metaLabel(ex.meta)}</span>}
        {ex.split && <span style={{ ...S.badge, background: SPLIT_BG[ex.split], color: SPLIT_C[ex.split] }}>@{ex.split}</span>}
        {ex.priority && <span style={{ ...S.badge, ...S.bPri }}>{ex.priority}</span>}
        {ex.routine && <span style={{ ...S.badge, ...S.bRtn }}>~{ex.routine}</span>}
      </div>
    </div>
  );

  const renderDay = (day: DayName) => {
    const ds = DAY_SPLIT[day], isToday = day === dn, rest = ds === 'rest';
    const exs = rest ? [] : splitGroups[ds] || [];
    const bc = rest ? 'var(--yap-border)' : SPLIT_C[ds];
    return (
      <div key={day} style={{ ...S.calDay, borderTopColor: bc, ...(isToday ? S.calToday : {}) }}>
        <div style={S.calHead}>
          <span style={{ ...S.calName, ...(isToday ? { color: 'var(--yap-success)' } : {}) }}>{day}</span>
          <span style={{ ...S.calSplit, ...(rest ? {} : { color: SPLIT_C[ds] }) }}>{rest ? 'rest' : ds}</span>
        </div>
        <div style={S.calBody}>
          {rest ? <div style={S.calRest}>Rest Day</div>
           : exs.length === 0 ? <div style={S.calEmpty}>No exercises</div>
           : exs.map(ex => (
            <div key={ex.id} style={S.calEx}>
              <span style={S.calExN}>{ex.title}</span>
              {ex.meta && <span style={S.calExM}>{ex.meta.sets}&times;{ex.meta.reps}{ex.meta.weight > 0 ? ` @ ${ex.meta.weight}` : ''}</span>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={S.root}>
      <style>{CSS}</style>
      <header style={S.header}><div style={S.hInner}>
        <h1 style={S.logo}><span style={{ color: 'var(--yap-success)' }}>Fitness</span><span style={S.logoSub}>by Yapture</span></h1>
        <a href="https://yapture.com/market/fitness" style={S.mLink}>View on Market &rarr;</a>
      </div></header>

      <main style={S.main}>
        {/* Composer */}
        <form onSubmit={handleSubmit} style={S.form}>
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            placeholder="Add exercise -- try: Bench Press #@push #!high #*{weight:185,reps:8,sets:3}" style={S.input} />
          <button type="submit" disabled={!input.trim()} style={S.addBtn}>Add</button>
        </form>

        {preview && <div style={S.preview}>
          <span style={S.prevTitle}>{preview.title}</span>
          {preview.meta && <span style={S.metaBadge}>{metaLabel(preview.meta)}</span>}
          {preview.split && <span style={{ ...S.badge, background: SPLIT_BG[preview.split], color: SPLIT_C[preview.split] }}>@{preview.split}</span>}
          {preview.priority && <span style={{ ...S.badge, ...S.bPri }}>{preview.priority}</span>}
          {preview.routine && <span style={{ ...S.badge, ...S.bRtn }}>~{preview.routine}</span>}
        </div>}

        {/* Template buttons */}
        <div style={S.actions}>
          <button type="button" onClick={() => loadTemplate(PUSH_EX)} style={S.tplBtn}>
            <span style={{ ...S.tplDot, background: SPLIT_C.push }} />Push Day</button>
          <button type="button" onClick={() => loadTemplate(PULL_EX)} style={S.tplBtn}>
            <span style={{ ...S.tplDot, background: SPLIT_C.pull }} />Pull Day</button>
          <button type="button" onClick={() => loadTemplate(LEG_EX)} style={S.tplBtn}>
            <span style={{ ...S.tplDot, background: SPLIT_C.legs }} />Leg Day</button>
          <span style={S.count}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Tabs */}
        <div style={S.tabBar}>
          {(['today', 'calendar', 'prs'] as const).map(t => (
            <button key={t} type="button" onClick={() => setTab(t)}
              style={{ ...S.tab, ...(tab === t ? S.tabOn : {}) }}>
              {t === 'today' ? "Today's Workout" : t === 'calendar' ? 'Weekly Plan' : 'PR Tracker'}
            </button>
          ))}
        </div>

        {/* Today's Workout */}
        {tab === 'today' && <div>
          <div style={S.todayHead}>
            <div>
              <h2 style={S.todayTitle}>{ts === 'rest' ? 'Rest Day' : `${ts[0].toUpperCase() + ts.slice(1)} Day`}</h2>
              <p style={S.todaySub}>{ts === 'rest' ? 'Take it easy -- recovery is growth.' : `${dn} -- ${done}/${todayEx.length} completed`}</p>
            </div>
            {ts !== 'rest' && todayEx.length > 0 && <div style={S.ring}>
              <svg width="56" height="56" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--yap-border-subtle)" strokeWidth="4" />
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--yap-success)" strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={`${(done / todayEx.length) * 150.8} 150.8`} transform="rotate(-90 28 28)"
                  style={{ transition: 'stroke-dasharray .4s ease' }} />
              </svg>
              <span style={S.ringTxt}>{Math.round((done / todayEx.length) * 100)}%</span>
            </div>}
          </div>
          {ts === 'rest'
            ? <div style={S.restCard}><p style={S.restTxt}>No exercises scheduled. Use this time for active recovery, stretching, or mobility work.</p></div>
            : todayEx.length === 0
            ? <div style={S.empty}><p style={S.emptyTxt}>No exercises for {ts} day yet.</p>
                <p style={S.emptyHint}>Use the "{ts[0].toUpperCase() + ts.slice(1)} Day" template above to get started.</p></div>
            : <div style={S.exList}>{todayEx.map(ex => renderCard(ex, true))}</div>}
        </div>}

        {/* Weekly Calendar */}
        {tab === 'calendar' && <div className="fitness-calendar" style={S.calGrid}>{DAYS.map(renderDay)}</div>}

        {/* PR Tracker */}
        {tab === 'prs' && <div>
          <h2 style={S.prHead}>Personal Records</h2>
          {prs.length === 0
            ? <div style={S.empty}><p style={S.emptyTxt}>No PRs recorded yet.</p>
                <p style={S.emptyHint}>Add exercises with weight metadata (#*&#123;weight:185,...&#125;) to track your bests.</p></div>
            : <div style={S.prList}>{prs.map((pr, i) => (
                <div key={pr.name} style={S.prRow}>
                  <span style={S.prRank}>#{i + 1}</span>
                  <span style={S.prName}>{pr.name}</span>
                  <span style={S.prWt}>{pr.weight} lbs</span>
                  <div style={{ ...S.prBar, width: `${(pr.weight / (prs[0]?.weight || 1)) * 100}%` }} />
                </div>))}</div>}
        </div>}
      </main>

      <footer style={S.footer}>
        <span>Built on{' '}<a href="https://yapture.com" style={S.fLink}>Yapture</a> Script and list primitives</span>
        <span>&middot;</span>
        <a href="https://yapture.com/docs/script" style={S.fLink}>Script docs</a>
        <span>&middot;</span>
        <a href="https://yapture.com/.well-known/yapture-api.md" style={S.fLink}>API reference</a>
      </footer>
    </div>
  );
}

/* -- Responsive CSS ------------------------------------------------------- */

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #080b10; }
  .fitness-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
  @media (max-width: 768px) { .fitness-calendar { grid-template-columns: 1fr !important; } }
`;

/* -- Styles --------------------------------------------------------------- */

const S: Record<string, React.CSSProperties> = {
  root: { minHeight: '100vh', background: '#080b10', color: 'var(--yap-fg)', fontFamily: 'var(--yap-font-sans)', display: 'flex', flexDirection: 'column' },
  header: { borderBottom: '1px solid var(--yap-border)', padding: '16px 0' },
  hInner: { maxWidth: 1120, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  logo: { fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'baseline', gap: 8 },
  logoSub: { fontSize: 13, fontWeight: 400, color: 'var(--yap-fg-muted)' },
  mLink: { fontSize: 14, color: 'var(--yap-success)', textDecoration: 'none', fontWeight: 500 },
  main: { flex: 1, maxWidth: 1120, margin: '0 auto', padding: '32px 24px', width: '100%', boxSizing: 'border-box' as const },
  form: { display: 'flex', gap: 12, marginBottom: 12 },
  input: { flex: 1, padding: '12px 16px', borderRadius: 10, border: '1px solid var(--yap-input-border)', background: 'var(--yap-input-bg)', color: 'var(--yap-fg)', fontSize: 15, fontFamily: 'var(--yap-font-mono)', outline: 'none' },
  addBtn: { padding: '12px 24px', borderRadius: 10, border: 'none', background: 'var(--yap-success)', color: '#080b10', fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  preview: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', marginBottom: 16, borderRadius: 8, background: 'var(--yap-success-bg)', border: '1px solid var(--yap-success)', fontSize: 14, flexWrap: 'wrap' as const },
  prevTitle: { color: 'var(--yap-fg)', fontWeight: 500 },
  actions: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 20, alignItems: 'center' },
  tplBtn: { padding: '8px 16px', borderRadius: 8, border: '1px solid var(--yap-border-subtle)', background: 'rgba(255,255,255,.04)', color: 'var(--yap-fg-muted)', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 },
  tplDot: { display: 'inline-block', width: 8, height: 8, borderRadius: '50%' },
  count: { marginLeft: 'auto', fontSize: 13, color: 'var(--yap-fg-faint)' },
  tabBar: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--yap-border-subtle)', paddingBottom: 0 },
  tab: { padding: '10px 20px', borderRadius: '8px 8px 0 0', border: 'none', background: 'transparent', color: 'var(--yap-fg-faint)', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', borderBottom: '2px solid transparent', marginBottom: -1 },
  tabOn: { color: 'var(--yap-success)', borderBottomColor: 'var(--yap-success)', background: 'var(--yap-success-bg)' },
  todayHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  todayTitle: { fontSize: 22, fontWeight: 700, color: 'var(--yap-fg)', margin: 0 },
  todaySub: { fontSize: 14, color: 'var(--yap-fg-muted)', marginTop: 4 },
  ring: { position: 'relative' as const, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ringTxt: { position: 'absolute' as const, fontSize: 13, fontWeight: 700, color: 'var(--yap-success)', fontFamily: 'var(--yap-font-mono)' },
  exList: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  card: { padding: 14, borderRadius: 12, border: '1px solid var(--yap-border)', background: 'var(--yap-card-bg)', transition: 'transform .15s, box-shadow .15s' },
  cardRow: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 },
  ckbox: { width: 20, height: 20, borderRadius: 5, border: '2px solid', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s, box-shadow .2s' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: 500, lineHeight: 1.35 },
  removeBtn: { border: 'none', background: 'none', color: 'var(--yap-fg-faint)', fontSize: 18, cursor: 'pointer', padding: '0 4px', flexShrink: 0 },
  badges: { display: 'flex', flexWrap: 'wrap' as const, gap: 5, paddingLeft: 30 },
  badge: { padding: '2px 7px', borderRadius: 5, fontSize: 12, fontWeight: 600, fontFamily: 'var(--yap-font-mono)' },
  metaBadge: { padding: '2px 7px', borderRadius: 5, fontSize: 12, fontWeight: 600, fontFamily: 'var(--yap-font-mono)', background: 'var(--yap-border-subtle)', color: 'var(--yap-fg-muted)' },
  bPri: { background: 'var(--yap-warning-bg)', color: 'var(--yap-warning-fg)' },
  bRtn: { background: 'var(--yap-accent-muted)', color: 'var(--yap-accent-hover)' },
  empty: { padding: '40px 20px', textAlign: 'center' as const },
  emptyTxt: { fontSize: 15, color: 'var(--yap-fg-faint)', marginBottom: 8 },
  emptyHint: { fontSize: 13, color: 'var(--yap-fg-faint)' },
  restCard: { padding: 24, borderRadius: 12, background: 'var(--yap-card-bg)', border: '1px solid var(--yap-border)', textAlign: 'center' as const },
  restTxt: { fontSize: 15, color: 'var(--yap-fg-muted)', lineHeight: 1.5 },
  calGrid: {},
  calDay: { borderTop: '3px solid', borderRadius: 10, background: 'var(--yap-card-bg)', border: '1px solid var(--yap-border-subtle)', borderTopWidth: 3, borderTopStyle: 'solid' as const, overflow: 'hidden', minHeight: 140 },
  calToday: { background: 'var(--yap-bg-elevated)', boxShadow: 'var(--yap-shadow-xs)' },
  calHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid var(--yap-border-subtle)' },
  calName: { fontSize: 13, fontWeight: 700, color: 'var(--yap-fg-muted)', fontFamily: 'var(--yap-font-mono)', textTransform: 'uppercase' as const, letterSpacing: '.05em' },
  calSplit: { fontSize: 11, fontWeight: 600, color: 'var(--yap-fg-faint)', fontFamily: 'var(--yap-font-mono)', textTransform: 'uppercase' as const },
  calBody: { padding: '8px 10px', display: 'flex', flexDirection: 'column' as const, gap: 6 },
  calEx: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 },
  calExN: { fontSize: 13, fontWeight: 500, color: 'var(--yap-fg)', lineHeight: 1.3 },
  calExM: { fontSize: 11, color: 'var(--yap-fg-faint)', whiteSpace: 'nowrap' as const, fontFamily: 'var(--yap-font-mono)' },
  calEmpty: { fontSize: 12, color: 'var(--yap-fg-faint)', padding: '8px 0', textAlign: 'center' as const },
  calRest: { fontSize: 13, color: 'var(--yap-fg-faint)', padding: '16px 0', textAlign: 'center' as const, fontStyle: 'italic' },
  prHead: { fontSize: 18, fontWeight: 700, color: 'var(--yap-fg)', marginBottom: 20, fontFamily: 'var(--yap-font-mono)' },
  prList: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  prRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'var(--yap-card-bg)', border: '1px solid var(--yap-border-subtle)', position: 'relative' as const, overflow: 'hidden' },
  prRank: { fontSize: 13, fontWeight: 700, color: 'var(--yap-fg-faint)', minWidth: 28, fontFamily: 'var(--yap-font-mono)' },
  prName: { flex: 1, fontSize: 15, fontWeight: 500, color: 'var(--yap-fg)', textTransform: 'capitalize' as const, zIndex: 1 },
  prWt: { fontSize: 14, fontWeight: 700, color: 'var(--yap-success)', fontFamily: 'var(--yap-font-mono)', zIndex: 1 },
  prBar: { position: 'absolute' as const, left: 0, top: 0, bottom: 0, background: 'var(--yap-success-bg)', opacity: 0.5, transition: 'width .4s ease' },
  footer: { borderTop: '1px solid var(--yap-border)', padding: '20px 24px', display: 'flex', justifyContent: 'center', gap: 12, fontSize: 13, color: 'var(--yap-fg-faint)' },
  fLink: { color: 'var(--yap-success)', textDecoration: 'none' },
};
