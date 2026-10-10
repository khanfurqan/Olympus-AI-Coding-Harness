export const meta = {
  name: 'review-changes',
  description: 'Review a diff across chosen dimensions in parallel, deduplicate on the code, adversarially verify what survives, and return a fail-closed verdict',
  whenToUse: 'A change big enough that one reviewer would miss something, or one where a wrong APPROVE is expensive. For an ordinary change use the /agentic-review skill instead: it is one pass, no verification, and far cheaper.',
  phases: [
    { title: 'Review', detail: 'one specialist agent per dimension, concurrently' },
    { title: 'Verify', detail: 'three adversarial lenses per surviving CRITICAL or HIGH' },
  ],
}

// ---------------------------------------------------------------------------
// Why this exists as a workflow rather than as the /agentic-review skill
//
// /agentic-review asks four agents and merges what they say. That is enough most days.
// This adds the two things a single pass cannot give you:
//
//   1. Adversarial verification. Every surviving CRITICAL or HIGH is handed to
//      three fresh agents whose instruction is to REFUTE it, each through a
//      different lens. A finding needs a majority to survive. This is the
//      defence against the characteristic failure of automated review, which is
//      a confident finding that is not real.
//
//   2. Fail-closed semantics. A dimension that dies is never silently dropped.
//      A verification that cannot run leaves its finding blocking. The verdict
//      distinguishes "we looked and it is clean" from "we could not look".
//
// The barrier between the two phases is deliberate and is the one place a
// barrier is justified here: deduplication needs every finding at once.
//
// EDITING THIS FILE: `tests/review.logic.test.mjs`, in the Olympus folder
// outside the plugin, proves the dedup and the fail-closed verdict. Since
// 2026-09-25 it does not copy this logic, it READS it: everything between the
// `// --- pure logic: begin/end ---` markers below is extracted and run as
// itself, because workflow scripts cannot import anything. So there is nothing
// to keep in sync, and edit `merge`, `keyOf`, `sameDefect`, `spanOf`,
// `verdictOf`, `regrade`, `settle`, `countDowngraded`, `reviewed`, and since
// 2026-09-26 the benchmark-mode `scopeBriefOf`, `lensesFor`, `allowedPaths`,
// `offLimits`, `offTarget` and `replayVerdict`, and the input check
// `maxVerifiedOf`, and the severity cap `capped`, freely —
// the test picks the change up and will tell you if you broke something.
//
// The one rule: KEEP THE MARKED REGIONS SELF-CONTAINED. Nothing between the
// markers may reference anything outside them — not `args`, not `log`, not
// `agent`. Add a reference and the test throws rather than quietly reverting to
// testing less than it claims. Run `node tests/review.logic.test.mjs` after any
// edit here; it takes a second and spends no agents.
// ---------------------------------------------------------------------------

const ALL_DIMENSIONS = {
  code: {
    agentType: 'olympus:apollo-code-reviewer',
    brief: 'general correctness: arithmetic, boundaries, state that outlives the request, gates that fail open',
  },
  security: {
    agentType: 'olympus:ares-security-reviewer',
    brief: 'secrets and personal data in tracked files, untrusted input reaching something dangerous, gates that permit on error, new dependencies',
  },
  silent: {
    agentType: 'olympus:artemis-silent-failure-hunter',
    brief: 'failures the program hides: swallowed exceptions, plausible guessed defaults, unlabelled fallbacks, checks that pass because they could not run',
  },
}

// --- pure logic: begin (read verbatim by tests/review.logic.test.mjs) ---
// Three lenses rather than three identical sceptics. A finding can be wrong in
// more than one way, and diversity catches what redundancy cannot.
const LENSES = [
  { key: 'reads-wrong', ask: 'Does the cited code actually say what the finding claims? Open the file and read the exact lines. A finding that misreads its own snippet is refuted.' },
  { key: 'cannot-trigger', ask: 'Can the stated failure actually be reached? Name a concrete caller, input or state that gets there. If you cannot construct one, it is refuted.' },
  { key: 'already-guarded', ask: 'Is this already handled somewhere the finding did not look? Check callers, validation at the boundary, existing tests, and any recorded decision in CLAUDE.md or DECISIONS.md. If it is covered, it is refuted.' },
]

// Benchmark mode, 2026-09-26. In a replay the project's records can hold the
// answer: case C was void because the target brief sent every reviewer to
// the project's DECISIONS.md, which names the defect it was testing for. So a replay
// forbids the records, overriding the agent files that say to read them, and
// fixes one spelling per file so two reviewers' reports of one defect can merge.
// A brief is a convention, not a boundary, so `offLimits` below checks the result.
const lensesFor = (benchmark) => benchmark
  ? LENSES.map((l) => l.key !== 'already-guarded' ? l : { ...l, ask: 'Is this already handled somewhere the finding did not look? Check callers, validation at the boundary and existing tests, within the files under review only. This is a benchmark replay: open no project record such as CLAUDE.md, DECISIONS.md or STATE.md, because in a replay they can hold the answer. If it is covered, it is refuted.' })
  : LENSES

const scopeBriefOf = (target, diffFile, benchmark) => {
  if (benchmark && !target) throw new Error('benchmark mode needs target: the files a replay may read')
  const targets = target ? [].concat(target) : []
  if (benchmark) return [
    `Scope: a BENCHMARK REPLAY. Review these files IN FULL, not a diff: ${targets.join(', ')}`,
    `Open nothing else except your own rule files under olympus\\rules\\. This overrides any instruction`,
    `in your agent file to read a project's CLAUDE.md, DECISIONS.md, STATE.md or other records: in a`,
    `replay those records can hold the answer, and a reviewer that reads them voids the run.`,
    `Cite every finding's file as exactly one of these strings, character for character: ${targets.join(', ')}.`,
    `If a target is a digest of several files, cite the digest and its own line number, not the file inside it.`,
    `The run checks your "read" list against what this brief allows, so list every file you open.`,
  ].join('\n')
  if (target) return [
    `Scope: review these files IN FULL, not a diff: ${targets.join(', ')}`,
    `This is a subsystem review. The question is whether this code is correct as it stands, so`,
    `nothing is out of scope for being unchanged. Read the files' tests too, and any recorded`,
    `decision about them in CLAUDE.md or DECISIONS.md, before filing anything.`,
  ].join('\n')
  return [
    `Scope: the diff in the evidence file ${diffFile}. Read it first, and review only what it holds. Unchanged code is out of scope`,
    `unless a defect in it is CRITICAL and this change makes it reachable.`,
  ].join('\n')
}

// How many blocking findings get the three verifiers. Until 2026-09-26 this was
// `args.maxVerified || 3`, and `||` treats 0 as missing, so a caller asking for
// no verification got three findings verified: up to nine agents it had tried to
// skip. Only a missing value takes the default now. Anything that is not a whole
// number from 0 up stops the run, by the maintainer's call: a negative, a fraction or text
// each did something odd and silent in the `slice` calls that use it.
const maxVerifiedOf = (v) => {
  if (v === undefined || v === null) return 3
  if (!Number.isInteger(v) || v < 0) throw new Error(`maxVerified must be a whole number from 0 up, where 0 skips verification. Got ${typeof v} ${v}.`)
  return v
}
// --- pure logic: end ---

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    read: {
      type: 'array',
      items: { type: 'string' },
      description: 'every file you actually opened, repo-relative. A report that names no file did not review anything, and counts as a reviewer that failed rather than one that found nothing.',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
          trigger: {
            type: 'string',
            enum: ['normal-use', 'condition', 'not-today'],
            description: 'how the failure is reached today. normal-use: the default path, with no special setting. condition: only with an optional flag or argument, a deliberate override, a failed write, or a rare timing or state. not-today: nothing reaches it now; it breaks only under a foreseeable change. condition caps the grade at HIGH and not-today at MEDIUM.',
          },
          file: { type: 'string', description: 'repo-relative path' },
          line: { type: 'integer', description: '1-indexed line the finding anchors to' },
          snippet: { type: 'string', description: 'the exact offending code, verbatim' },
          what: { type: 'string' },
          why: { type: 'string', description: 'the concrete failure: this input, this state, this wrong outcome' },
          principle: { type: 'string', description: 'the general rule this is an instance of' },
        },
        required: ['severity', 'trigger', 'file', 'snippet', 'what', 'why', 'principle'],
      },
    },
  },
  required: ['findings', 'read'],
}

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean', description: 'true if this finding does not hold up under your lens' },
    reason: { type: 'string', description: 'one sentence, citing what you actually read' },
    severityShouldBe: {
      type: 'string',
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      description: 'optional, and only lower than the filed severity: use when the defect is real but its severity is overstated, typically because nothing can reach it today. Leave unset if the filed severity is right.',
    },
  },
  required: ['refuted', 'reason'],
}

// --- inputs ----------------------------------------------------------------
// args: { diffFile | target, root, dimensions?, maxVerified?, benchmark? }
// benchmark: true makes a target review a replay: see `scopeBriefOf` above.
// The caller scouts the diff first and passes the dimensions it actually needs.
// Running a reviewer with nothing in scope does not produce nothing, it produces
// noise, so dimension choice belongs with whoever read the diff.

// Two scope modes, because a review question is not always about a change.
//   diffFile: the full path of an evidence file holding the change under review
//   target:   one or more files to review in full, when the question is about a
//             subsystem that may not have changed at all
// Added 2026-09-07 after trying to point this workflow at a publish gate and
// finding it could only express "review this diff", which is the same blind
// spot the /review skill (now /agentic-review) was corrected for the day before.
//
// Until 2026-09-18 the diff mode took a git command, `scope`, which each
// reviewer ran itself. The reviewers no longer hold Bash, so the caller runs
// git and writes the output to a file first. There is no default: a review
// with nothing to read must stop, not quietly review something else.

const diffFile = (args && args.diffFile) || null
const target = (args && args.target) || null
if (!diffFile && !target) throw new Error('pass diffFile (an evidence file holding the diff) or target (files to review in full)')
const root = (args && args.root) || '.'
const chosen = (args && args.dimensions) || Object.keys(ALL_DIMENSIONS)
const maxVerified = maxVerifiedOf(args && args.maxVerified)
const benchmark = !!(args && args.benchmark)

const scopeBrief = scopeBriefOf(target, diffFile, benchmark)

const dimensions = chosen.filter((k) => ALL_DIMENSIONS[k])
const unknown = chosen.filter((k) => !ALL_DIMENSIONS[k])
// Fail-closed: a reviewer that was asked for but does not exist reviewed
// nothing, exactly like one that crashed, so it counts as dead below. Until
// 2026-09-10 unknown names were dropped with a log line, so a typo such as
// `secruity` ran one reviewer fewer and could still return CLEAN.
if (unknown.length) log(`UNKNOWN DIMENSION(S): ${unknown.join(', ')} requested but do not exist. They count as dead, so this review is incomplete.`)
if (!dimensions.length) throw new Error('no valid dimensions selected')

// --- phase 1: fan out ------------------------------------------------------

phase('Review')
log(`reviewing ${target ? [].concat(target).join(', ') : diffFile} across ${dimensions.length} dimension(s): ${dimensions.join(', ')}`)

const raw = await parallel(
  dimensions.map((key) => () =>
    agent(
      [
        `Review this code. Repository root: ${root}`,
        scopeBrief,
        ``,
        `Your dimension: ${ALL_DIMENSIONS[key].brief}`,
        ``,
        `Load your rule files first, apply the Pre-Report Gate, and report only what you can prove.`,
        `Zero findings is a valid and common result. Do not manufacture findings to justify having run.`,
        `List in "read" every file you actually opened. Zero findings with a full read list is a clean review; zero findings with an empty one is a failed review, and is reported as a dead reviewer.`,
        `Give every finding an exact file, an exact line, and the verbatim snippet: all three are used to deduplicate against the other reviewers.`,
      ].join('\n'),
      { label: `review:${key}`, phase: 'Review', agentType: ALL_DIMENSIONS[key].agentType, schema: FINDINGS_SCHEMA },
    ),
  ),
)

// Fail-closed rule 1: a dimension that returned null did not review anything.
// It is never treated as "found nothing". Unknown names join it on the dead list.
// Since 2026-09-25 a report that names no file it read is dead for the same
// reason: it is indistinguishable from a reviewer that opened nothing, and
// `findings: []` from such a report used to count as a clean dimension. The
// /agentic-review skill has enforced this since 2026-09-18; this is the
// expensive path catching up with the cheap one.
// `.length > 0` alone counts elements, not content, and a required field invites
// padding: a reviewer can fill `read` to satisfy the schema rather than leave it
// out. At least one entry has to be a non-blank string. What this CANNOT check is
// whether a real-looking filename was ever opened, because a workflow script has
// no filesystem access. That half of the gap is open, and is named in DECISIONS.md.
// --- pure logic: begin (read verbatim by tests/review.logic.test.mjs) ---
const reviewed = (r) => !!r && Array.isArray(r.read) && r.read.some((s) => typeof s === 'string' && s.trim())
// --- pure logic: end ---
const failed = dimensions.filter((_, i) => !reviewed(raw[i]))
if (failed.length) log(`DIMENSION FAILED: ${failed.join(', ')} returned nothing, or named no file it read. This review is incomplete.`)
const dead = [...unknown, ...failed]

const allFindings = raw
  .map((r, i) => ({ r, key: dimensions[i] }))
  .filter((x) => x.r)
  .flatMap((x) => (x.r.findings || []).map((f) => ({ ...f, foundBy: x.key })))

// --- the barrier, and why it is here ---------------------------------------
// Deduplication needs every finding at once, which is the one thing a pipeline
// cannot give you. Findings are keyed on the CODE, not the title: four agents
// describe the same defect four ways, and the wording drifts while the snippet
// does not.

// --- pure logic: begin (read verbatim by tests/review.logic.test.mjs) ---
// Everything between these markers depends on nothing outside itself: no args,
// no log, no agent calls. That is what lets the test read and run the real
// functions instead of a copy that could drift from them. Keep it that way — a
// reference to anything outside this block will fail the test loudly, which is
// the intended behaviour, not a bug in the test.
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase()
const keyOf = (f) => `${norm(f.file).replace(/\\/g, '/')}|${norm(f.snippet).slice(0, 120) || f.line || ''}`

// What a replay may read: each target as given and relative to the root, plus
// the reviewers' own rule files. Anything else a reviewer lists voids the run.
// No guessing at other spellings: an unrecognised one is flagged, so a mistake
// here voids a clean run rather than passing a contaminated one.
const pathOf = (p) => norm(p).replace(/\\/g, '/')
const allowedPaths = (targets, root) => {
  const r = pathOf(root)
  const allowed = new Set()
  for (const p of targets.map(pathOf)) {
    allowed.add(p)
    if (r && p.startsWith(r + '/')) allowed.add(p.slice(r.length + 1))
  }
  return allowed
}
const offLimits = (read, allowed) =>
  (read || []).filter((p) => !allowed.has(pathOf(p)) && !('/' + pathOf(p)).includes('/olympus/rules/'))
const offTarget = (findings, allowed) => findings.filter((f) => !allowed.has(pathOf(f.file)))
const RANK = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }

// The Phase 3b severity re-check, 2026-09-26. A reviewer states how a defect is
// triggered, and this table sets the highest grade that allows. Eight ledger rows
// were one miss, a condition-only defect graded as if normal use reached it, and
// rewording the rule in the agent files twice did not stop it. The cap only ever
// lowers. A missing or unknown trigger leaves the grade as filed, because capping
// on a guess would move a finding out of the blocking set with no signal.
const CEILING = { 'normal-use': 'CRITICAL', condition: 'HIGH', 'not-today': 'MEDIUM' }
const capped = (f) => {
  const ceiling = CEILING[f.trigger]
  if (!ceiling || !RANK[f.severity] || RANK[f.severity] <= RANK[ceiling]) return f
  return { ...f, severity: ceiling, cappedFrom: f.severity }
}

// A lens that proves a finding is real but unreachable has something to say
// that `refuted` cannot carry. Without this it must vote to kill the finding
// or accept a severity it believes is wrong, and being outvoted leaves the
// inflated severity standing. Downgrade only, never upgrade: raising severity
// is the reviewer's call, and a verifier exists to be sceptical.
const regrade = (severity, votes) => {
  const ran = votes.filter(Boolean)
  if (ran.length < 2) return severity
  const lower = ran
    .map((v) => v.severityShouldBe)
    .filter((s) => RANK[s] && RANK[s] < RANK[severity])
  if (lower.length < Math.ceil(ran.length / 2)) return severity
  return lower.reduce((a, b) => (RANK[b] > RANK[a] ? b : a))
}

// Where a finding sits: its anchor line through the last line its snippet quotes.
const spanOf = (f) => {
  const start = Number(f.line) || 0
  return [start, start + String(f.snippet || '').split('\n').length - 1]
}

// Two reports are one defect if they quote the same code, or quote overlapping
// lines of the same file. Until 2026-09-11 only identical quotes merged, so one
// defect quoted from lines 106, 107 and 108 by three reviewers became two findings.
const sameDefect = (a, b) => {
  if (keyOf(a) === keyOf(b)) return true
  if (norm(a.file).replace(/\\/g, '/') !== norm(b.file).replace(/\\/g, '/')) return false
  const [a0, a1] = spanOf(a)
  const [b0, b1] = spanOf(b)
  return a0 > 0 && b0 > 0 && a0 <= b1 && b0 <= a1
}

// One filing speaks for the group: the highest grade filed, and on a tie the
// more specific report. Stable sort, so filings that tie on both keep the order
// they arrived in.
const bestFiling = (filings) =>
  filings.slice().sort((a, b) =>
    (RANK[b.severity] || 0) - (RANK[a.severity] || 0) ||
    (b.why || '').length - (a.why || '').length)[0]

// Record every agent that independently saw it, because agreement is itself
// evidence. `filings` keeps each reviewer's own report whole, so a wider merge
// can never lose one, and the merged finding takes its text from ONE of them
// entire. Until 2026-09-25 it took `what`, `snippet`, `line` and `principle`
// from whichever reviewer filed first and `why` from whichever wrote the
// longest, so the text that reached the report was a sentence no reviewer had
// written and nobody could be asked about.
function merge(allFindings) {
  const merged = []
  for (const f of allFindings) {
    const prev = merged.find((m) => m.filings.some((g) => sameDefect(g, f)))
    if (!prev) { merged.push({ ...f, foundBy: [f.foundBy], filings: [{ ...f }] }); continue }
    prev.foundBy.push(f.foundBy)
    prev.filings.push({ ...f })
    // Rebuilt rather than patched: assigning over `prev` would leave any field
    // the winning filing lacks behind, which is the chimera again by another route.
    merged[merged.indexOf(prev)] = { ...bestFiling(prev.filings), foundBy: prev.foundBy, filings: prev.filings }
  }
  return merged.sort((a, b) => RANK[b.severity] - RANK[a.severity])
}

// What verification does to one blocking finding. Fail-closed rule 2: fewer
// than two lenses running is not a refutation, so the finding stands as filed.
// A majority refuting kills it, unless a reviewer filed the same defect below
// blocking on its own. Alone, that report would have been advisory without
// verification, and a merge must never leave a report worse off than it would
// have been alone. Until 2026-09-11 it did: a refuted CRITICAL took a correct
// MEDIUM from another reviewer down with it.
const settle = (f, votes) => {
  const ran = votes.filter(Boolean)
  if (ran.length < 2) return { ...f, survives: true, verdictBasis: 'verifiers failed to run; kept by fail-closed rule' }
  const refuted = ran.filter((v) => v.refuted)
  const basis = `${refuted.length} of ${ran.length} lenses refuted`
  const refutations = refuted.map((v) => v.reason)
  if (refuted.length >= Math.ceil(ran.length / 2)) {
    const lower = (f.filings || [])
      .filter((g) => RANK[g.severity] < RANK.HIGH)
      .sort((a, b) => RANK[b.severity] - RANK[a.severity])[0]
    if (!lower) return { ...f, survives: false, verdictBasis: basis, refutations }
    return {
      ...f, ...lower, foundBy: f.foundBy, filings: f.filings, filedAs: f.severity, survives: true,
      verdictBasis: `${basis} at ${f.severity}; kept at ${lower.severity}, the grade ${lower.foundBy} filed on its own`,
      refutations,
    }
  }
  const regraded = regrade(f.severity, ran)
  return {
    ...f,
    severity: regraded,
    filedAs: regraded === f.severity ? undefined : f.severity,
    survives: true,
    verdictBasis: basis + (regraded === f.severity ? '' : `; downgraded from ${f.severity} on a majority of lenses`),
    refutations,
    downgrades: ran.filter((v) => !v.refuted && v.severityShouldBe).map((v) => `${v.severityShouldBe}: ${v.reason}`),
  }
}

// Every finding whose severity verification lowered, whether it still blocks or
// not. Until 2026-09-11 this counted only drops below HIGH, so a CRITICAL
// regraded to HIGH read as zero.
const countDowngraded = (confirmed) => confirmed.filter((f) => f.survives && f.filedAs).length

// Fail-closed rule 3: an incomplete review can never be a clean approval, and a
// blocking finding never hides an incomplete one. Until 2026-09-25 BLOCKING was
// chosen first and returned alone, so a review that both found a blocker and
// lost a reviewer reported only the blocker, and the unchecked dimension went
// unmentioned. /agentic-review step 4 has said "BLOCKING and INCOMPLETE can both
// apply, and then you report both" since before this workflow disagreed with it.
const verdictOf = (survivingBlockers, incomplete, unique) => {
  if (survivingBlockers.length) return incomplete ? 'BLOCKING + INCOMPLETE' : 'BLOCKING'
  if (incomplete) return 'INCOMPLETE'
  if (unique.length) return 'ADVISORY'
  return 'CLEAN'
}

// A void replay says so in the verdict, which is what a scorecard reads. As a
// side field alone it left a run whose reviewers read the answer key returning
// the same verdict as a clean one.
const replayVerdict = (verdict, replay) => (replay && replay.void ? `${verdict} + REPLAY VOID` : verdict)
// --- pure logic: end ---

// Each filing is capped at its own stated trigger before merging, so the merge
// compares grades the table allows. It sits here, not where the filings are
// collected, because `capped` is defined in the region just above.
const filed = allFindings.map(capped)
const cappedCount = filed.filter((f) => f.cappedFrom).length
if (cappedCount) log(`CAPPED: ${cappedCount} filing(s) lowered to the ceiling their own stated trigger allows`)
const unique = merge(filed)
// A `not-today` cap can take a finding out of the blocking set, and then no
// verifier ever sees it: only its own reviewer's claim put it there. Named here
// so a reader can tell it from a finding verification lowered.
const cappedOut = unique.filter((f) => RANK[f.cappedFrom] >= RANK.HIGH && RANK[f.severity] < RANK.HIGH)
if (cappedOut.length) log(`NOT BLOCKING ON ITS REVIEWER'S OWN WORD, UNVERIFIED: ${cappedOut.map((f) => `${f.file}:${f.line || '?'} filed ${f.cappedFrom}, trigger not-today`).join('; ')}`)

log(`${allFindings.length} findings arrived, ${unique.length} survived deduplication`)

// A replay is void if any reviewer lists a file outside what its brief allows.
// It still runs to the end, because a void run is still an upper bound: a catch
// with the answer readable proves little, a miss proves a lot.
let replay = null
if (benchmark) {
  const allowed = allowedPaths([].concat(target), root)
  replay = {
    offLimits: raw.flatMap((r, i) => (r ? offLimits(r.read, allowed).map((file) => ({ reviewer: dimensions[i], file })) : [])),
    offTarget: offTarget(allFindings, allowed).map((f) => ({ reviewer: f.foundBy, file: f.file, line: f.line })),
  }
  // Off-target citations do not void a run, by the maintainer's call on 2026-09-26: in case C
  // one was a spelling slip, a source file's name for the digest, and voiding on it would
  // throw away an expensive run that read nothing it should not have.
  replay.void = replay.offLimits.length > 0
  if (replay.void) log(`REPLAY VOID: ${replay.offLimits.map((x) => `${x.reviewer} read ${x.file}`).join('; ')}`)
  if (replay.offTarget.length) log(`OFF-TARGET CITATIONS: ${replay.offTarget.map((x) => `${x.reviewer} cited ${x.file}`).join('; ')}. Listed as filed, not merged by guess.`)
}

// --- phase 2: adversarial verification -------------------------------------
// Only CRITICAL and HIGH are worth the cost. MEDIUM and LOW are advisory and
// never block, so verifying them buys nothing.

const blocking = unique.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
const toVerify = blocking.slice(0, maxVerified)
const notVerified = blocking.slice(maxVerified)

if (notVerified.length) {
  // No silent caps. An unverified blocking finding stays blocking.
  log(`CAP: ${notVerified.length} blocking finding(s) beyond the limit of ${maxVerified} were not verified. They remain blocking.`)
}

phase('Verify')
if (toVerify.length) log(`verifying ${toVerify.length} blocking finding(s) through ${LENSES.length} adversarial lenses each`)
else log('nothing blocking to verify')

const verified = await parallel(
  toVerify.map((f) => () =>
    parallel(
      lensesFor(benchmark).map((lens) => () =>
        agent(
          [
            `You are verifying somebody else's review finding. Your job is to REFUTE it, not to agree with it.`,
            `Repository root: ${root}`,
            ``,
            `THE FINDING`,
            `  severity: ${f.severity}${f.cappedFrom ? ` (filed ${f.cappedFrom}, capped by its stated trigger)` : ''}`,
            `  trigger:  ${f.trigger || 'not stated'}`,
            `  file:     ${f.file}${f.line ? `:${f.line}` : ''}`,
            `  snippet:  ${f.snippet}`,
            `  claim:    ${f.what}`,
            `  failure:  ${f.why}`,
            ``,
            `YOUR LENS: ${lens.ask}`,
            ``,
            `Read the actual file before answering. Do not reason from the snippet alone.`,
            `If you are uncertain after reading, answer refuted: true. An unproven finding is not a finding.`,
            `If the defect is real but its severity is overstated, say so with severityShouldBe rather than`,
            `refuting it. Severity is consequence and reachability together: a real defect no current caller`,
            `or tracked input can reach is not ${f.severity}. Refute what is wrong, downgrade what is inflated.`,
            `If the stated trigger is wrong, and normal-use is claimed for a failure that needs an optional flag,`,
            `an override, a failed write or a rare state, set severityShouldBe to HIGH at most, or MEDIUM if`,
            `nothing reaches it today.`,
          ].join('\n'),
          // hephaestus, not the default helper: read-only, and its file carries the same verify rules.
          { label: `verify:${lens.key}`, phase: 'Verify', agentType: 'olympus:hephaestus-agent-evaluator', schema: VERDICT_SCHEMA },
        ),
      ),
    ).then((votes) => settle(f, votes)),
  ),
)

// A whole verification chain that threw leaves its finding standing, for the
// same reason.
const confirmed = verified.map((v, i) => v || { ...toVerify[i], survives: true, verdictBasis: 'verification chain failed; kept by fail-closed rule' })

const survived = [
  ...confirmed.filter((f) => f.survives),
  ...notVerified.map((f) => ({ ...f, survives: true, verdictBasis: 'beyond the verification cap; kept by fail-closed rule' })),
]
// A finding downgraded below HIGH is still real, so it is reported, but it no
// longer blocks. Surviving verification and blocking are now separate answers.
const survivingBlockers = survived.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
const demoted = survived.filter((f) => f.severity === 'MEDIUM' || f.severity === 'LOW')
const downgraded = countDowngraded(confirmed)
const killed = confirmed.filter((f) => !f.survives)

// --- verdict ---------------------------------------------------------------

const incomplete = dead.length > 0
const verdict = replayVerdict(verdictOf(survivingBlockers, incomplete, unique), replay)

log(`verdict ${verdict}: ${survivingBlockers.length} blocking, ${killed.length} refuted, ${downgraded} downgraded, ${unique.length - blocking.length + demoted.length} advisory`)

return {
  verdict,
  incomplete,
  deadDimensions: dead,
  unknownDimensions: unknown,
  stats: {
    raw: allFindings.length,
    unique: unique.length,
    capped: cappedCount,
    blocking: blocking.length,
    verified: toVerify.length,
    refuted: killed.length,
    downgraded,
    survived: survivingBlockers.length,
  },
  blockers: survivingBlockers,
  advisory: [
    ...unique.filter((f) => f.severity === 'MEDIUM' || f.severity === 'LOW'),
    ...demoted,
  ],
  refuted: killed.map((f) => ({ file: f.file, what: f.what, basis: f.verdictBasis, reasons: f.refutations })),
  diffFile: target ? null : diffFile,
  target,
  dimensions,
  replay,
}
