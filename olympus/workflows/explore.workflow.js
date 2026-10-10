export const meta = {
  name: 'explore-codebase',
  description: 'Map an unfamiliar codebase from four angles at once, then merge the four into one written narrative you could hand to someone on their first day. Only on request, only on a copy: its readers are the built-in Explore helper, which holds Bash',
  whenToUse: 'Reading code you did not write, or code you wrote long enough ago that you no longer remember why. Not for a codebase you already know: use /explain on the specific file instead.',
  phases: [
    { title: 'Map', detail: 'four readers, each blind to what the others find' },
    { title: 'Merge', detail: 'one narrative, written to be read once and re-explained' },
  ],
}

// ---------------------------------------------------------------------------
// The problem this solves, which is specific to working alone
//
// Working on your own projects, you never have to read code you did not write.
// So the skill of walking into an unfamiliar system and finding your footing
// never gets practised, and it is the skill that transfers furthest.
//
// Four readers, each given one angle and no knowledge of the others. That is
// the multi-modal sweep: one search angle finds what that angle finds and is
// structurally blind to the rest. Entry points tell you where control starts;
// data flow tells you what the system is actually about; tests tell you what
// the authors were afraid of; dependencies tell you what was borrowed and what
// was built. None of the four is derivable from the others.
//
// Then one merge. Not a concatenation of four reports, which is four reports.
// A single narrative, top-down, in the voice of somebody explaining rather than
// documenting.
// ---------------------------------------------------------------------------

const ANGLES = [
  {
    key: 'entry',
    label: 'entry points',
    ask: [
      'Find every way this system can be started or entered, and follow each far enough to say what happens next.',
      'Look for: a main or run script, CLI argument handling, web routes, scheduled jobs, and anything a user or another system triggers.',
      'For each one, say what it is for in plain words and name the first two or three things it calls.',
      'Finish with the single entry point somebody should read first, and why that one.',
    ].join(' '),
  },
  {
    key: 'data',
    label: 'data flow',
    ask: [
      'Trace what data enters this system, what it becomes, and where it ends up.',
      'Look for: the sources it reads, the shape it holds things in, where state is persisted, and where values are computed rather than stored.',
      'Name the single most important data structure and say what it represents.',
      'Say explicitly which parts are derived on demand and which are written down, because that distinction usually is the architecture.',
    ].join(' '),
  },
  {
    key: 'tests',
    label: 'tests',
    ask: [
      'Read the test suite as evidence of what the authors were afraid of.',
      'Say how many tests there are, how they are organised, and how they are run.',
      'Identify what is heavily tested and what is not tested at all, and say what that asymmetry tells you.',
      'Look specifically for regression tests naming real past bugs; those are the fastest possible education in where this system is fragile.',
    ].join(' '),
  },
  {
    key: 'deps',
    label: 'dependencies and conventions',
    ask: [
      'Establish what was borrowed and what was built here.',
      'Look for: the dependency manifest, what each significant dependency is actually used for, the language and runtime version, and the build or run commands.',
      'Then the unwritten conventions: naming patterns, file layout, how errors are handled, how configuration is passed around.',
      'Name anything that looks deliberately unusual, because an unusual choice is normally a decision somebody made for a reason.',
    ].join(' '),
  },
]

const MAP_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'two or three sentences: what you found from this angle' },
    findings: {
      type: 'array',
      description: 'the substantive points, each standing on its own',
      items: {
        type: 'object',
        properties: {
          point: { type: 'string' },
          evidence: { type: 'string', description: 'the file, and line where it helps, that supports this' },
        },
        required: ['point', 'evidence'],
      },
    },
    readFirst: {
      type: 'array',
      description: 'up to three files somebody should read first from this angle, most important first',
      items: { type: 'string' },
    },
    puzzles: {
      type: 'array',
      description: 'things you could not work out, or that look wrong. Empty is a valid answer; guessing is not',
      items: { type: 'string' },
    },
  },
  required: ['summary', 'findings', 'readFirst'],
}

// --- inputs ----------------------------------------------------------------
// args: { root, focus? }

const root = (args && args.root) || '.'
const focus = (args && args.focus) || ''

// --- phase 1: four blind readers -------------------------------------------

phase('Map')
log(`mapping ${root} from ${ANGLES.length} angles${focus ? `, focused on: ${focus}` : ''}`)

const maps = await parallel(
  ANGLES.map((a) => () =>
    agent(
      [
        `Map an unfamiliar codebase from ONE angle only. Repository root: ${root}`,
        focus ? `The reader particularly cares about: ${focus}` : '',
        ``,
        `YOUR ANGLE: ${a.label}`,
        a.ask,
        ``,
        `Stay in your lane. Other agents are covering the other angles and your report is merged with theirs, so material outside your angle is wasted effort and creates duplication to resolve.`,
        `Read the project's CLAUDE.md and README first if they exist, then verify what they claim against the code rather than repeating it. A document that has drifted from the code is itself a finding.`,
        `Cite a real file for every point. Never name a file you have not opened.`,
        `Where you could not work something out, put it in puzzles. Do not guess and do not fill space.`,
      ]
        .filter(Boolean)
        .join('\n'),
      { label: `map:${a.key}`, phase: 'Map', agentType: 'Explore', schema: MAP_SCHEMA },
    ),
  ),
)

const landed = ANGLES.map((a, i) => ({ angle: a, map: maps[i] })).filter((x) => x.map)
const missing = ANGLES.filter((_, i) => !maps[i]).map((a) => a.label)
if (missing.length) log(`ANGLE FAILED: ${missing.join(', ')}. The map below is missing that perspective.`)
if (!landed.length) throw new Error('every angle failed; nothing to merge')

// --- the barrier ------------------------------------------------------------
// Genuinely required: the merge is a single narrative written from all four
// angles at once. It cannot start before the last one lands, because its whole
// job is to reconcile them.

phase('Merge')
log(`merging ${landed.length} of ${ANGLES.length} angles into one narrative`)

const brief = landed
  .map(
    (x) =>
      [
        `### ${x.angle.label}`,
        x.map.summary,
        ...x.map.findings.map((f) => `- ${f.point}  [${f.evidence}]`),
        x.map.readFirst.length ? `Read first: ${x.map.readFirst.join(', ')}` : '',
        x.map.puzzles && x.map.puzzles.length ? `Unresolved: ${x.map.puzzles.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
  )
  .join('\n\n')

const narrative = await agent(
  [
    `Four readers each mapped this codebase from one angle. Merge their four reports into ONE written map.`,
    `Repository root: ${root}`,
    missing.length ? `MISSING PERSPECTIVE: the ${missing.join(' and ')} angle(s) failed. Say so plainly at the top; do not paper over the gap.` : '',
    ``,
    `Do not concatenate the four. Four reports stapled together is still four reports.`,
    `Write one narrative, working top-down: what the system is for, then how a request or a run moves through it, then the mechanism, then the file-by-file detail last.`,
    `Where two angles say the same thing, say it once. Where two angles disagree, say that they disagree and which you believe, with the evidence.`,
    `Verify anything load-bearing yourself before repeating it. These reports are hypotheses about a codebase, not established fact.`,
    ``,
    `End with three things:`,
    `  1. The reading order: the first four files somebody should open, and one line on why each.`,
    `  2. What is still unclear, gathered from every angle's unresolved list.`,
    `  3. The five-sentence version, no jargon and no file names. If you cannot write that, say so rather than shipping the long version anyway.`,
    ``,
    `THE FOUR REPORTS`,
    brief,
  ]
    .filter(Boolean)
    .join('\n'),
  { label: 'merge', phase: 'Merge', agentType: 'olympus:hermes-code-explainer' },
)

return {
  root,
  focus: focus || null,
  anglesRun: landed.map((x) => x.angle.key),
  anglesMissing: missing,
  complete: missing.length === 0,
  puzzles: landed.flatMap((x) => (x.map.puzzles || []).map((p) => ({ angle: x.angle.key, puzzle: p }))),
  readFirst: [...new Set(landed.flatMap((x) => x.map.readFirst))],
  map: narrative,
}
