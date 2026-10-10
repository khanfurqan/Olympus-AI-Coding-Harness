// Proves the behaviours review.workflow.js is supposed to guarantee:
// deduplication keys on the code rather than the title, a merged finding reads
// as one reviewer wrote it, a reviewer that cannot say what it read counts as
// dead, and the verdict fails closed. Runs in a second and spends no agents.
//
//     node tests/review.logic.test.mjs
//
// THIS TESTS THE REAL LOGIC, as of 2026-09-25. It used to test a hand-written
// copy, and carried a warning here to re-copy the functions after every edit —
// a rule that had to be remembered, which is the kind that eventually is not.
// The functions are now READ OUT of review.workflow.js at run time, from between
// its "pure logic" markers, and run as themselves. Editing the workflow alone is
// enough to fail this file, which was demonstrated by doing it.
//
// Workflow scripts still get no module access, so the workflow cannot export and
// this cannot import. Reading the file and evaluating the marked regions is the
// way round that, and it works only because everything between the markers
// depends on nothing outside itself. Keep it so. If a marker goes missing, or the
// block stops being self-contained, this file THROWS instead of falling back to a
// copy: a test that quietly stops testing the real thing is worse than none.
//
// TWO THINGS ARE STILL RESTATED rather than read, and are marked where they sit:
// `decide`, the kill rule in isolation, which the workflow only applies inside
// `settle`; and the dimension resolution, which is inline imperative code in the
// workflow rather than a function. The part of that deciding whether a reviewer
// is alive, `reviewed`, IS the real one.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// The logic below is READ OUT OF review.workflow.js, not copied from it. The two
// marked regions there hold every function that depends on nothing outside
// itself, which is what makes running them here possible at all. If the markers
// go missing, or the block stops being self-contained, this throws rather than
// falling back to a copy: a test that quietly stops testing the real thing is
// the exact failure this replaces.
const WORKFLOW = join(dirname(fileURLToPath(import.meta.url)), '..', 'olympus', 'workflows', 'review.workflow.js')
const BEGIN = '// --- pure logic: begin'
const END = '// --- pure logic: end ---'

// A marker counts only when it OPENS a line. Prose that mentions the markers —
// the editing note at the top of review.workflow.js does — is indented behind a
// comment of its own and must not be mistaken for one. That is not hypothetical:
// on 2026-09-25 the note was rewritten to describe this mechanism, the substring
// scan this replaced picked the sentence up as a region, swallowed the `await`
// below it, and the file refused to run. It failed loudly and correctly; this
// scan removes the trap rather than relying on nobody writing the words again.
const source = readFileSync(WORKFLOW, 'utf8')
const regions = []
let open = null
let lineNo = 0
for (const line of source.split('\n')) {
  lineNo++
  if (line.startsWith(BEGIN)) {
    if (open) throw new Error(`review.workflow.js:${lineNo}: a pure-logic region opened while one was already open`)
    open = []
  } else if (line.startsWith(END)) {
    if (!open) throw new Error(`review.workflow.js:${lineNo}: a pure-logic region closed without being opened`)
    regions.push(open.join('\n'))
    open = null
  } else if (open) {
    open.push(line)
  }
}
if (open) throw new Error('review.workflow.js: a pure-logic region was opened and never closed')
if (regions.length < 2) throw new Error(`review.workflow.js: expected 2 marked pure-logic regions, found ${regions.length}. The test cannot read the real logic, so it is not running.`)

const EXPORTS = ['LENSES', 'scopeBriefOf', 'lensesFor', 'reviewed', 'norm', 'keyOf', 'RANK', 'regrade', 'spanOf', 'sameDefect', 'bestFiling', 'merge', 'settle', 'countDowngraded', 'verdictOf', 'allowedPaths', 'offLimits', 'offTarget', 'replayVerdict', 'maxVerifiedOf', 'capped']
let real
try {
  real = new Function(`${regions.join('\n')}\nreturn { ${EXPORTS.join(', ')} }`)()
} catch (err) {
  throw new Error(`review.workflow.js: the marked regions did not evaluate on their own (${err.message}). Something in them now depends on code outside the markers.`)
}
const missing = EXPORTS.filter((k) => real[k] === undefined)
if (missing.length) throw new Error(`review.workflow.js: the marked regions no longer define ${missing.join(', ')}`)

const { scopeBriefOf, lensesFor, reviewed, keyOf, RANK, regrade, sameDefect, merge, settle, countDowngraded, verdictOf, allowedPaths, offLimits, offTarget, replayVerdict, maxVerifiedOf, capped } = real

// Two things are still restated here rather than read, and both are honest gaps.
// `decide` is the kill rule on its own, which the workflow only ever applies
// inside `settle`; Test 3 uses it to check that rule in isolation. And the
// dimension resolution below is inline imperative code in the workflow, not a
// function, so it cannot be read out — though the part of it that decides
// whether a reviewer is alive, `reviewed`, IS the real one.
const decide = (votes) => {
  const ran = votes.filter(Boolean)
  if (ran.length < 2) return true
  return ran.filter((v) => v.refuted).length < Math.ceil(ran.length / 2)
}

const resolveDimensions = (chosen, all, raw) => {
  const dimensions = chosen.filter((k) => all[k])
  const unknown = chosen.filter((k) => !all[k])
  if (!dimensions.length) throw new Error('no valid dimensions selected')
  const failed = dimensions.filter((_, i) => !reviewed(raw[i]))
  const dead = [...unknown, ...failed]
  return { dimensions, unknown, dead, incomplete: dead.length > 0 }
}

let fail = 0
const ok = (name, cond, got) => {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  (got ${JSON.stringify(got)})`}`)
  if (!cond) fail++
}

console.log('Test 1 - dedup keys on the code, not the title')
const raw1 = [
  { severity: 'HIGH', file: 'a/b.py', line: 12, snippet: 'if not words:', what: 'x', why: 'short', foundBy: 'code' },
  { severity: 'CRITICAL', file: 'a\\b.py', line: 12, snippet: 'if  not   words:', what: 'y', why: 'much longer reason', foundBy: 'silent' },
  { severity: 'MEDIUM', file: 'A/B.PY', line: 12, snippet: 'IF NOT WORDS:', what: 'z', why: 'mid', foundBy: 'security' },
  { severity: 'LOW', file: 'c/d.py', line: 9, snippet: 'pass', what: 'w', why: 'w', foundBy: 'code' },
]
const u1 = merge(raw1)
ok('4 raw findings collapse to 2 unique', u1.length === 2, u1.length)
ok('stats.raw exceeds stats.unique (plan criterion)', raw1.length > u1.length, [raw1.length, u1.length])
ok('three wordings of one defect merge', u1[0].foundBy.length === 3, u1[0].foundBy)
ok('highest severity wins the merge', u1[0].severity === 'CRITICAL', u1[0].severity)
ok('longest explanation wins the merge', u1[0].why === 'much longer reason', u1[0].why)
ok('windows and posix separators unify', keyOf({ file: 'a\\b.py', snippet: 'x' }) === keyOf({ file: 'a/b.py', snippet: 'x' }), false)
ok('distinct defects stay distinct', u1[1].foundBy.length === 1, u1[1].foundBy)

console.log('\nTest 2 - fail-closed verdicts')
ok('dead dimension + no findings is INCOMPLETE', verdictOf([], true, []) === 'INCOMPLETE', verdictOf([], true, []))
ok('a dead dimension can never be CLEAN', verdictOf([], true, []) !== 'CLEAN', verdictOf([], true, []))
ok('complete and empty is CLEAN', verdictOf([], false, []) === 'CLEAN', verdictOf([], false, []))
ok('only medium/low is ADVISORY', verdictOf([], false, [{}]) === 'ADVISORY', verdictOf([], false, [{}]))
ok('a blocker and a dead reviewer are both reported', verdictOf([{}], true, [{}]) === 'BLOCKING + INCOMPLETE', verdictOf([{}], true, [{}]))
ok('a blocker with every reviewer alive reads as plain BLOCKING', verdictOf([{}], false, [{}]) === 'BLOCKING', verdictOf([{}], false, [{}]))
ok('the combined verdict still leads with BLOCKING', verdictOf([{}], true, [{}]).startsWith('BLOCKING'), verdictOf([{}], true, [{}]))

console.log('\nTest 3 - adversarial majority, and verifiers that die')
ok('2 of 3 refute, finding dies', decide([{ refuted: true }, { refuted: true }, { refuted: false }]) === false, true)
ok('1 of 3 refutes, finding survives', decide([{ refuted: true }, { refuted: false }, { refuted: false }]) === true, true)
ok('3 of 3 refute, finding dies', decide([{ refuted: true }, { refuted: true }, { refuted: true }]) === false, true)
ok('all verifiers died, survives by fail-closed', decide([null, null, null]) === true, true)
ok('one verifier ran and refuted, still survives', decide([null, null, { refuted: true }]) === true, true)

console.log('\nTest 4 - a lens can downgrade severity without killing the finding')
const M = { refuted: false, severityShouldBe: 'MEDIUM' }
const L = { refuted: false, severityShouldBe: 'LOW' }
const silent = { refuted: false }
ok('2 of 3 say MEDIUM, a HIGH becomes MEDIUM', regrade('HIGH', [M, M, silent]) === 'MEDIUM', regrade('HIGH', [M, M, silent]))
ok('1 of 3 is not a majority, HIGH stands', regrade('HIGH', [M, silent, silent]) === 'HIGH', regrade('HIGH', [M, silent, silent]))
ok('disagreeing downgrades take the least aggressive', regrade('HIGH', [M, L, silent]) === 'MEDIUM', regrade('HIGH', [M, L, silent]))
ok('a lens cannot raise severity', regrade('MEDIUM', [{ refuted: false, severityShouldBe: 'CRITICAL' }, { refuted: false, severityShouldBe: 'CRITICAL' }, silent]) === 'MEDIUM', regrade('MEDIUM', [{ refuted: false, severityShouldBe: 'CRITICAL' }, { refuted: false, severityShouldBe: 'CRITICAL' }, silent]))
ok('too few verifiers ran, severity stands by fail-closed', regrade('HIGH', [null, null, M]) === 'HIGH', regrade('HIGH', [null, null, M]))
ok('unanimous downgrade to LOW is honoured', regrade('CRITICAL', [L, L, L]) === 'LOW', regrade('CRITICAL', [L, L, L]))
ok('no proposals at all leaves severity alone', regrade('HIGH', [silent, silent, silent]) === 'HIGH', regrade('HIGH', [silent, silent, silent]))

// The point of the downgrade: it moves a finding out of the blocking set, so a
// review with nothing genuinely blocking stops reporting BLOCKING.
const downgraded = { severity: regrade('HIGH', [M, M, silent]) }
const stillBlocking = [downgraded].filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
ok('a downgraded finding leaves the blocking set', stillBlocking.length === 0, stillBlocking.length)
ok('and the verdict falls to ADVISORY, not CLEAN', verdictOf(stillBlocking, false, [downgraded]) === 'ADVISORY', verdictOf(stillBlocking, false, [downgraded]))

// Refutation still outranks regrading: a dead finding is dead.
ok('a refuted finding dies even with downgrade votes', decide([{ refuted: true, severityShouldBe: 'MEDIUM' }, { refuted: true }, silent]) === false, true)

console.log('\nTest 5 - a reviewer that does not exist is a dead reviewer, not a skipped one')
const DIMS = { code: {}, python: {}, security: {}, silent: {} }
// Every live reviewer here carries a read list, because from 2026-09-25 a report
// that names nothing it read is a failed report. Test 10 covers that rule; these
// fixtures only have to satisfy it so they keep testing what they were written for.
const typo = resolveDimensions(['code', 'secruity'], DIMS, [{ findings: [], read: ['a/b.py'] }])
ok('a misspelt reviewer makes the review incomplete', typo.incomplete === true, typo.incomplete)
ok('the misspelt name is on the dead list', typo.dead.includes('secruity'), typo.dead)
ok('it is also reported as unknown, so a typo reads differently from a crash', typo.unknown.join() === 'secruity', typo.unknown)
ok('the reviewers that do exist still run', typo.dimensions.join() === 'code', typo.dimensions)
ok('with nothing found, a typo returns INCOMPLETE, never CLEAN', verdictOf([], typo.incomplete, []) === 'INCOMPLETE', verdictOf([], typo.incomplete, []))
const crash = resolveDimensions(['code', 'silent'], DIMS, [{ findings: [], read: ['a/b.py'] }, null])
ok('a reviewer that crashes is still dead', crash.dead.join() === 'silent' && crash.incomplete === true, crash)
const whole = resolveDimensions(['code', 'silent'], DIMS, [{ findings: [], read: ['a/b.py'] }, { findings: [], read: ['c/d.py'] }])
ok('every reviewer real and returned: complete', whole.incomplete === false && whole.dead.length === 0, whole)
let threw = false
try { resolveDimensions(['nope'], DIMS, []) } catch { threw = true }
ok('no real reviewer at all stops the review outright', threw, threw)

// Tests 6 to 8 are built from the 2026-09-11 snapshot run: one defect quoted by
// three reviewers from lines 106, 107 and 108, and the verifier votes it got.
console.log('\nTest 6 - one defect quoted from overlapping lines merges into one finding')
const F = 'tools/preflight_publish.py'
const raw6 = [
  { severity: 'CRITICAL', file: F, line: 106, snippet: 'try:\n    raw = (ROOT / rel).read_bytes()\nexcept (FileNotFoundError, OSError):\n    raw = b""', what: 'unread file scanned as empty', why: 'a push publishes it', foundBy: 'code' },
  { severity: 'MEDIUM', file: F, line: 107, snippet: 'raw = (ROOT / rel).read_bytes()\nexcept (FileNotFoundError, OSError):', what: 'degraded scan reads as clean', why: 'the summary line hides it', foundBy: 'silent' },
  { severity: 'MEDIUM', file: F, line: 108, snippet: 'except (FileNotFoundError, OSError):\n    raw = b""', what: 'missing file treated as empty', why: 'not surfaced', foundBy: 'python' },
  { severity: 'HIGH', file: F, line: 186, snippet: 'words = ([w.strip() for w in args.words.split(",") if w.strip()]', what: 'not lowercased', why: 'false pass', foundBy: 'security' },
]
const u6 = merge(raw6)
const g6 = u6.find((f) => f.foundBy.includes('code')) || {}
ok('three overlapping quotes of one defect become one finding', u6.length === 2, u6.length)
ok('every reviewer that saw it is kept', ['code', 'silent', 'python'].every((k) => (g6.foundBy || []).includes(k)), g6.foundBy)
ok("each reviewer's own grade is kept, not only the highest", (g6.filings || []).map((x) => x.severity).join() === 'CRITICAL,MEDIUM,MEDIUM', g6.filings)
ok("each reviewer's own claim is kept", (g6.filings || []).map((x) => x.what).includes('degraded scan reads as clean'), g6.filings)
ok('a defect on other lines stays separate', u6.some((f) => f.line === 186 && f.foundBy.length === 1), u6.map((f) => [f.line, f.foundBy]))
const adjacent = merge([
  { severity: 'LOW', file: F, line: 50, snippet: 'a = 1', what: 'p', foundBy: 'code' },
  { severity: 'LOW', file: F, line: 51, snippet: 'b = 2', what: 'q', foundBy: 'python' },
])
ok('neighbouring lines that do not overlap stay separate', adjacent.length === 2, adjacent.length)
const lineless = merge([
  { severity: 'LOW', file: F, snippet: 'x = 1', what: 'p', foundBy: 'code' },
  { severity: 'LOW', file: F, snippet: 'y = 2', what: 'q', foundBy: 'python' },
])
ok('findings without a line merge only on identical code', lineless.length === 2, lineless.length)

console.log('\nTest 7 - refuting a merged finding does not erase a lower grade another reviewer gave')
const merged7 = {
  severity: 'CRITICAL', file: F, line: 106, snippet: 's', what: 'a push publishes it', why: 'wrong premise', foundBy: ['code', 'silent'],
  filings: [
    { severity: 'CRITICAL', file: F, line: 106, what: 'a push publishes it', why: 'wrong premise', foundBy: 'code' },
    { severity: 'MEDIUM', file: F, line: 107, what: 'degraded scan reads as clean', why: 'the summary line hides it', foundBy: 'silent' },
  ],
}
const realVotes = [{ refuted: false, severityShouldBe: 'LOW', reason: 'reads right' }, { refuted: true, reason: 'publish stages the deletion' }, { refuted: true, reason: 'orphan flow never ships it' }]
const s7 = settle(merged7, realVotes)
ok('refuted at CRITICAL but filed MEDIUM by another reviewer: it survives', s7.survives === true, s7.survives)
ok('it is kept at the lower grade that reviewer gave', s7.severity === 'MEDIUM', s7.severity)
ok("it shows that reviewer's claim, not the refuted one", s7.what === 'degraded scan reads as clean', s7.what)
ok('it records the grade it was refuted at', s7.filedAs === 'CRITICAL', s7.filedAs)
const allBlocking = { ...merged7, filings: [{ severity: 'CRITICAL', what: 'a', foundBy: 'code' }, { severity: 'HIGH', what: 'b', foundBy: 'security' }] }
ok('if every reviewer filed it blocking, a refutation still kills it', settle(allBlocking, realVotes).survives === false, settle(allBlocking, realVotes).survives)
ok('a finding with no record of its reviewers dies as before', settle({ severity: 'HIGH', what: 'x' }, realVotes).survives === false, true)
ok('unrefuted, it survives at its own grade', settle(merged7, [silent, silent, silent]).severity === 'CRITICAL', settle(merged7, [silent, silent, silent]).severity)
ok('fewer than two lenses ran: kept as filed', settle(merged7, [null, null, realVotes[1]]).survives === true, true)

console.log('\nTest 8 - stats.downgraded counts every severity verification lowered')
const hi = { refuted: false, severityShouldBe: 'HIGH' }
const toHigh = settle({ severity: 'CRITICAL', what: 'x' }, [hi, hi, silent])
ok('the regrade itself happens: CRITICAL becomes HIGH', toHigh.severity === 'HIGH', toHigh.severity)
ok('a CRITICAL regraded to HIGH counts as downgraded', countDowngraded([toHigh]) === 1, countDowngraded([toHigh]))
ok('a survivor at its filed grade does not count', countDowngraded([settle({ severity: 'HIGH', what: 'x' }, [silent, silent, silent])]) === 0, true)
ok('a refuted finding kept at a lower grade counts', countDowngraded([s7]) === 1, countDowngraded([s7]))

// Until 2026-09-25 a merged finding took its `what`, `snippet`, `line` and
// `principle` from whichever reviewer filed first and its `why` from whichever
// wrote the longest one. The maintainer then read a claim from one agent explained by a
// second agent's reasoning about, possibly, a different line: a sentence no
// reviewer ever wrote, and one nobody can be asked about.
console.log('\nTest 9 - a merged finding reads as one reviewer wrote it')
// The goal, not the mechanism: whatever rule picks the winner, the text that
// comes out has to match one filing on every field at once.
const isWholeFiling = (m) => (m.filings || []).some((g) =>
  g.what === m.what && g.why === m.why && g.snippet === m.snippet && g.line === m.line && g.principle === m.principle)
const raw9 = [
  { severity: 'MEDIUM', file: F, line: 12, snippet: 'if not words:', what: 'empty list slips through', why: 'short', principle: 'p-first', foundBy: 'code' },
  { severity: 'HIGH', file: F, line: 12, snippet: 'if not words:', what: 'the guard is inverted', why: 'a much longer and more specific account of the failure', principle: 'p-second', foundBy: 'python' },
]
const u9 = merge(raw9)
ok('the merged text is one reviewer report, whole', isWholeFiling(u9[0]), { what: u9[0].what, why: u9[0].why, principle: u9[0].principle })
ok('the reviewer who filed it highest is the one quoted', u9[0].what === 'the guard is inverted', u9[0].what)
ok('its principle travels with its claim', u9[0].principle === 'p-second', u9[0].principle)
ok('the merged severity is still the highest filed', u9[0].severity === 'HIGH', u9[0].severity)
// Severity cannot always decide. When it ties, the more specific report wins,
// and its own `what` comes with it rather than being left behind.
const tie9 = merge([
  { severity: 'HIGH', file: F, line: 30, snippet: 'x = 1', what: 'terse claim', why: 'short', principle: 'p-terse', foundBy: 'code' },
  { severity: 'HIGH', file: F, line: 30, snippet: 'x = 1', what: 'specific claim', why: 'a considerably longer and more specific account', principle: 'p-specific', foundBy: 'security' },
])
ok('on a tie the longer explanation wins, whole', isWholeFiling(tie9[0]) && tie9[0].what === 'specific claim', tie9[0].what)
// And none of this may be bought by throwing the other reports away: `filings`
// is what Test 7 uses to keep a refuted CRITICAL alive at the grade another reviewer filed.
ok('each filing is still kept whole', u9[0].filings.length === 2 && u9[0].foundBy.length === 2, u9[0].filings)
ok('a lone finding is trivially whole', isWholeFiling(merge([raw9[0]])[0]), true)

// Until 2026-09-25 a reviewer could return `findings: []` having opened nothing
// at all, and it counted as a clean dimension. The agentic-review skill has said
// since 2026-09-18 that "FINDINGS: none with an empty READ is a failed review";
// the workflow, the expensive path, did not enforce it.
console.log('\nTest 10 - a reviewer that cannot say what it read did not review anything')
const emptyRead = resolveDimensions(['code', 'silent'], DIMS, [{ findings: [], read: ['a/b.py'] }, { findings: [], read: [] }])
ok('a reviewer listing nothing it read is a dead reviewer', emptyRead.dead.join() === 'silent', emptyRead.dead)
ok('and that review can never be CLEAN', verdictOf([], emptyRead.incomplete, []) === 'INCOMPLETE', verdictOf([], emptyRead.incomplete, []))
const missingRead = resolveDimensions(['code'], DIMS, [{ findings: [] }])
ok('a missing read list counts the same as an empty one', missingRead.incomplete === true, missingRead)
ok('it is a failure, not an unknown name', missingRead.unknown.length === 0 && missingRead.dead.join() === 'code', missingRead)
// A required field invites padding: a reviewer under pressure to return one can
// fill it rather than leave it out, and `.length > 0` counts elements, not content.
// Empty and whitespace-only entries are the half of that this code can close.
const paddedRead = resolveDimensions(['code'], DIMS, [{ findings: [], read: ['', '  '] }])
ok('a read list of blank strings is no read list', paddedRead.incomplete === true, paddedRead)
const oneReal = resolveDimensions(['code'], DIMS, [{ findings: [], read: ['', 'a/b.py'] }])
ok('one real entry among blanks is still a reviewer that read something', oneReal.incomplete === false, oneReal)
const wrongType = resolveDimensions(['code'], DIMS, [{ findings: [], read: 'a/b.py' }])
ok('a read given as a string, not a list, is a dead reviewer', wrongType.incomplete === true, wrongType)
// The other half of the same defect this code CANNOT close: a list of real-looking
// filenames the reviewer never opened passes, because a workflow script has no
// filesystem access to check one against. Stated here so the gap is on the record
// rather than mistaken for coverage.

// The other half, or "mark every reviewer dead" would pass everything above.
const realClean = resolveDimensions(['code'], DIMS, [{ findings: [], read: ['a/b.py'] }])
ok('findings none with a real read list is a genuine clean result', realClean.incomplete === false && realClean.dead.length === 0, realClean)
ok('a reviewer that found something and said what it read is alive', resolveDimensions(['code'], DIMS, [{ findings: [{ severity: 'LOW' }], read: ['a/b.py'] }]).incomplete === false, true)

// Phase 3b step 2 (2026-09-25) considered F2's rule that "the 3 lenses are 3
// questions, not 3 votes", under which each lens rules alone and any single
// refutation kills a finding. Replayed against the recorded votes it fixed
// nothing and made the 2026-09-07 case strictly worse: a real defect that one
// lens called unreachable went from surviving at an inflated grade to not being
// reported at all. Rejected, and pinned here so it cannot come back unnoticed.
console.log('\nTest 11 - one lens, ruling alone, cannot kill a finding')
const loneRefusal = [{ refuted: true, reason: 'I cannot reach it' }, { refuted: false, reason: 'reads as claimed' }, { refuted: false, reason: 'nothing guards it' }]
const lone = settle({ severity: 'HIGH', what: 'real but unreachable today', filings: [{ severity: 'HIGH', what: 'real but unreachable today', foundBy: 'code' }] }, loneRefusal)
ok('1 of 3 refuting leaves the finding standing', lone.survives === true, lone.survives)
ok('and it is still reported, not silently dropped', lone.what === 'real but unreachable today', lone.what)
// The lens that cannot reach a defect has a better move than refusing it, and
// this is the one the 2026-09-07 case was actually missing.
const viaDowngrade = settle(
  { severity: 'HIGH', what: 'real but unreachable today', filings: [{ severity: 'HIGH', what: 'real but unreachable today', foundBy: 'code' }] },
  [{ refuted: false, severityShouldBe: 'LOW', reason: 'nothing can reach it' }, { refuted: false, severityShouldBe: 'LOW', reason: 'reads as claimed' }, { refuted: false, reason: 'nothing guards it' }],
)
ok('a majority saying "real but overrated" downgrades instead of killing', viaDowngrade.survives === true && viaDowngrade.severity === 'LOW', viaDowngrade.severity)
ok('and the grade it was filed at is kept on the record', viaDowngrade.filedAs === 'HIGH', viaDowngrade.filedAs)

// Case C, 2026-09-26: reviewers named one file three ways, so two of them agreeing
// on one defect read as two defects. Three rules to merge across spellings were
// tried the same day, and review broke each: any file name merged unrelated files
// quoting `pass` at one line, and "one path is the other's tail end" merged a root
// `utils.py` with `app/utils.py`, and bridged two READMEs through a bare
// `README.md`. So a file named two ways is two files here, and the cure belongs at
// the source, in what reviewers are told to cite. A defect listed twice costs a
// reader a moment; a merge that swallows a second file's defect hides it with no
// signal. These pin the safe side, so widening the merge must break one on purpose.
console.log('\nTest 12 - a file named two ways is two files, never one defect by guess')
const DIGEST = 'C:/Temp/claude/session-example/scratchpad/caseC/2026-09-11-codebase.md'
const exitViaFull = { severity: 'HIGH', file: DIGEST, line: 1687, snippet: '    def shutdown(self) -> None:\n        if self.worker is not None:\n            self.worker.stop()\n        os._exit(0)', foundBy: 'security' }
const exitViaShort = { ...exitViaFull, file: 'scratchpad\\caseC\\2026-09-11-codebase.md', snippet: 'def shutdown(self) -> None:\n    if self.worker is not None:\n        self.worker.stop()\n    os._exit(0)', foundBy: 'code' }
const exitViaSource = { ...exitViaShort, file: 'app.py' }
// Known gaps: each pair below is truly one defect, and both reviewers stay listed.
ok('known gap: a full path and its tail end stay two', sameDefect(exitViaFull, exitViaShort) === false, true)
ok('known gap: the case C digest-versus-source pair stays two', sameDefect(exitViaFull, exitViaSource) === false, true)
ok('and neither reviewer is lost from the report', merge([exitViaFull, exitViaShort, exitViaSource]).length === 3, merge([exitViaFull, exitViaShort, exitViaSource]).length)
// Two files each. The first rule tried, any file name, joins the unrelated pair;
// the tail-end rules join the other two.
ok('one short quote at one line of two unrelated files stays two', sameDefect({ file: 'auth.py', line: 42, snippet: 'pass' }, { file: 'parser.py', line: 42, snippet: 'pass' }) === false, true)
ok('a root file and a nested file of the same name stay two', sameDefect({ file: 'utils.py', line: 7, snippet: 'return None' }, { file: 'app/utils.py', line: 7, snippet: 'return None' }) === false, true)
const readmes = [
  { severity: 'HIGH', file: 'olympus/rules/README.md', line: 12, snippet: 'except Exception: pass', foundBy: 'security' },
  { severity: 'MEDIUM', file: 'README.md', line: 12, snippet: 'except Exception: pass', foundBy: 'code' },
  { severity: 'HIGH', file: 'archive/agents-archive/README.md', line: 12, snippet: 'except Exception: pass', foundBy: 'silent' },
]
ok('a bare name cannot bridge two different files into one group', merge(readmes).length === 3, merge(readmes).length)
// These two touch at line 432, one quote ending where the other starts, and are
// two defects: a leaking error message and a stream that can end early. Line
// overlap needs the file named identically, which is why this passes; let two
// spellings of a path count as one file and it fails, as it would have under the
// suffix rule first queued for case C.
// The 432 quote is 22 lines in the record; its first line is real, the rest only
// give it that length, which is all the overlap arithmetic reads.
const leak = { severity: 'MEDIUM', file: DIGEST, line: 429, snippet: '            if response.status_code != 200:\n                raise ServiceError(\n                    f"Service returned {response.status_code}: {response.text[:200]}"\n                )', foundBy: 'security' }
const truncated = { severity: 'HIGH', file: 'scratchpad/caseC/2026-09-11-codebase.md', line: 432, snippet: '            parts: list[str] = []' + '\n'.repeat(21), foundBy: 'silent' }
ok('quotes that only touch, under two spellings of one path, stay two', sameDefect(leak, truncated) === false, true)

// Case C, 2026-09-26, was void: the target-mode brief told reviewers to read the
// project's recorded decisions, and the project's DECISIONS.md names the defect. A
// replay needs a brief that forbids the records, and a check on what was read,
// because the brief is a convention: reviewers can open any file on the machine.
console.log('\nTest 13 - benchmark mode reads only its targets, and says so when a reviewer did not')
const T = ['C:/bench/caseC/2026-09-11-codebase.md', 'C:/bench/caseC/notes.md']
const benchBrief = scopeBriefOf(T, null, true)
const plainBrief = scopeBriefOf(T, null, false)
ok('the benchmark brief names every target', T.every((t) => benchBrief.includes(t)), benchBrief)
ok('it never tells a reviewer to read recorded decisions', !/CLAUDE\.md or DECISIONS\.md/.test(benchBrief), benchBrief)
ok('it overrides the agent file, which says to read them', /overrides/i.test(benchBrief), benchBrief)
ok('an ordinary target review still reads the records', /CLAUDE\.md or DECISIONS\.md/.test(plainBrief), plainBrief)
let refused = false
try { scopeBriefOf(null, 'C:/evidence/review-diff.txt', true) } catch { refused = true }
ok('benchmark mode without targets is refused', refused, refused)
const guarded = (ls) => ls.find((l) => l.key === 'already-guarded').ask
ok('the already-guarded lens drops the records in a replay', !/recorded decision in CLAUDE\.md or DECISIONS\.md/.test(guarded(lensesFor(true))), guarded(lensesFor(true)))
ok('and forbids DECISIONS.md by name, the file that voided case C', /open no project record such as CLAUDE\.md, DECISIONS\.md/.test(guarded(lensesFor(true))), guarded(lensesFor(true)))
ok('and keeps them in a real review', /recorded decision in CLAUDE\.md or DECISIONS\.md/.test(guarded(lensesFor(false))), guarded(lensesFor(false)))
ok('the other lenses are unchanged', lensesFor(true).filter((l) => l.key !== 'already-guarded').every((l, i) => l.ask === lensesFor(false).filter((m) => m.key !== 'already-guarded')[i].ask), false)

const allowed = allowedPaths(T, 'C:/bench/caseC')
const caseCRead = [
  'C:\\bench\\caseC\\2026-09-11-codebase.md',
  '2026-09-11-codebase.md',
  '~/.claude/skills/olympus/rules/common/code-review.md',
  'C:\\Projects\\example-app\\DECISIONS.md',
  'example-app/CLAUDE.md',
]
const flagged = offLimits(caseCRead, allowed)
ok('case C\'s DECISIONS.md read is caught', flagged.some((p) => /decisions\.md$/i.test(p)), flagged)
ok('and its CLAUDE.md read', flagged.some((p) => /claude\.md$/i.test(p)), flagged)
ok('a target is allowed whatever its slashes or capitals', !flagged.some((p) => /codebase\.md$/i.test(p)), flagged)
ok('a reviewer rule file is allowed', !flagged.some((p) => /rules/.test(p)), flagged)
ok('exactly the two records are flagged', flagged.length === 2, flagged)
// Loud on doubt: a spelling the check cannot tie to a target is flagged, never
// waved through, so a mistake here voids a clean run instead of passing a dirty one.
ok('an unrecognised spelling of a target is flagged, not guessed', offLimits(['caseC/2026-09-11-codebase.md'], allowed).length === 1, offLimits(['caseC/2026-09-11-codebase.md'], allowed))
ok('a missing read list flags nothing and does not throw', offLimits(undefined, allowed).length === 0, offLimits(undefined, allowed))
const cited = [
  { file: 'C:/bench/caseC/2026-09-11-codebase.md', line: 1687, foundBy: 'security' },
  { file: 'app.py', line: 1687, foundBy: 'code' },
]
const strays = offTarget(cited, allowed)
ok('a finding cited against a file inside the digest is listed off-target', strays.length === 1 && strays[0].file === 'app.py', strays)
// The verdict is what a scorecard reads, so a void replay must say so there, not
// only in a side field: otherwise a run whose reviewers read the answer key and
// a clean run return the same verdict.
ok('a void replay says so in the verdict', replayVerdict('BLOCKING', { void: true }) === 'BLOCKING + REPLAY VOID', replayVerdict('BLOCKING', { void: true }))
ok('and the verdict still leads with what was found', replayVerdict('BLOCKING + INCOMPLETE', { void: true }).startsWith('BLOCKING + INCOMPLETE'), replayVerdict('BLOCKING + INCOMPLETE', { void: true }))
ok('a clean replay leaves the verdict alone', replayVerdict('CLEAN', { void: false }) === 'CLEAN', replayVerdict('CLEAN', { void: false }))
ok('a real review, with no replay, is untouched', replayVerdict('ADVISORY', null) === 'ADVISORY', replayVerdict('ADVISORY', null))

// Found 2026-09-26 while costing a replay: the inputs read `args.maxVerified || 3`,
// and `||` treats 0 as missing, so asking for no verification quietly bought up to
// nine verifier agents. A value that makes no sense stops the run, by the maintainer's call
// the same day, because every one of them otherwise did something odd and silent.
console.log('\nTest 14 - maxVerified: 0 means none, missing means 3, nonsense stops the run')
ok('0 stays 0, so a caller can skip verification', maxVerifiedOf(0) === 0, maxVerifiedOf(0))
ok('a missing value becomes 3', maxVerifiedOf(undefined) === 3, maxVerifiedOf(undefined))
ok('null counts as missing', maxVerifiedOf(null) === 3, maxVerifiedOf(null))
ok('an ordinary value is kept', maxVerifiedOf(1) === 1, maxVerifiedOf(1))
const throwsOn = (v) => { try { maxVerifiedOf(v); return false } catch { return true } }
for (const bad of [-1, 1.5, 'two', '3', NaN]) ok(`${typeof bad} ${String(bad)} stops the run`, throwsOn(bad), 'no error')
// The function above can be right while the workflow still reads the number the
// old way, so check the one line outside the regions that uses it.
ok('the workflow reads maxVerified through maxVerifiedOf', /^const maxVerified = maxVerifiedOf\(/m.test(source) && !/args\.maxVerified\)\s*\|\|/.test(source), source.split('\n').find((l) => l.startsWith('const maxVerified =')))

// The Phase 3b severity re-check, 2026-09-26. Eight ledger rows (9, 10, 11, 24,
// 28, 29, 34, 46) are one miss: a reviewer grades a defect that needs a condition
// as if normal use reached it, often after writing down that it needs one. The
// rule was reworded twice and broke again, so the reviewer now states the trigger
// as a fact and a fixed table sets the highest grade that fact allows.
console.log('\nTest 15 - the stated trigger caps the grade, and never raises it')
const A1 = { severity: 'CRITICAL', file: F, line: 186, snippet: 'words = ...', what: '--words not lowercased', foundBy: 'code' }
ok('only under a condition: CRITICAL is capped at HIGH', capped({ ...A1, trigger: 'condition' }).severity === 'HIGH', capped({ ...A1, trigger: 'condition' }).severity)
ok('and the grade it was filed at is kept', capped({ ...A1, trigger: 'condition' }).cappedFrom === 'CRITICAL', capped({ ...A1, trigger: 'condition' }).cappedFrom)
ok("can't happen today: CRITICAL is capped at MEDIUM", capped({ ...A1, trigger: 'not-today' }).severity === 'MEDIUM', capped({ ...A1, trigger: 'not-today' }).severity)
ok("can't happen today: HIGH is capped at MEDIUM", capped({ ...A1, severity: 'HIGH', trigger: 'not-today' }).severity === 'MEDIUM', capped({ ...A1, severity: 'HIGH', trigger: 'not-today' }).severity)
ok('normal use: CRITICAL stands', capped({ ...A1, trigger: 'normal-use' }).severity === 'CRITICAL', capped({ ...A1, trigger: 'normal-use' }).severity)
ok('a grade already under its ceiling is untouched', capped({ ...A1, severity: 'MEDIUM', trigger: 'condition' }).cappedFrom === undefined && capped({ ...A1, severity: 'MEDIUM', trigger: 'condition' }).severity === 'MEDIUM', capped({ ...A1, severity: 'MEDIUM', trigger: 'condition' }))
ok('the cap never raises a grade', capped({ ...A1, severity: 'LOW', trigger: 'not-today' }).severity === 'LOW', capped({ ...A1, severity: 'LOW', trigger: 'not-today' }).severity)
// A missing or misspelt trigger leaves the grade as filed. Capping on a guess
// would move a finding the wrong way, out of the blocking set, with no signal.
ok('a missing trigger leaves the grade as filed', capped(A1).severity === 'CRITICAL', capped(A1).severity)
ok('an unknown trigger leaves the grade as filed', capped({ ...A1, trigger: 'sometimes' }).severity === 'CRITICAL', capped({ ...A1, trigger: 'sometimes' }).severity)
// A1, graded as helios graded it on 2026-09-18 and as the key says it should be:
// the cap lowers the grade but the finding still blocks, because HIGH blocks.
const a1Merged = merge([capped({ ...A1, trigger: 'condition' })])
ok('capped A1 still blocks', verdictOf(a1Merged.filter((f) => RANK[f.severity] >= RANK.HIGH), false, a1Merged) === 'BLOCKING', a1Merged.map((f) => f.severity))
// One reviewer saying normal use outweighs another saying condition: the merge
// keeps the highest grade, so the cap cannot hide a reviewer's stronger claim.
const twoClaims = merge([capped({ ...A1, trigger: 'condition' }), capped({ ...A1, trigger: 'normal-use', foundBy: 'security' })])
ok('a normal-use filing of the same defect keeps it CRITICAL', twoClaims.length === 1 && twoClaims[0].severity === 'CRITICAL', twoClaims.map((f) => f.severity))
// The function can be right while the workflow never calls it or never asks for
// the trigger, so check the two lines outside the regions that make it real.
ok('every filing passes through the cap before merging', /^const filed = allFindings\.map\(capped\)$/m.test(source) && /^const unique = merge\(filed\)$/m.test(source), source.split('\n').filter((l) => /^const (filed|unique) =/.test(l)))
ok('the report schema requires a trigger', /required: \['severity', 'trigger',/.test(source), source.split('\n').find((l) => l.includes("required: ['severity'")))

// Found by review the same day: the first version called `capped` at line 252 and
// defined it at line 298, inside a later region. Every check above passed, because
// they run the regions on their own, while the real workflow would have stopped on
// its first review with "Cannot access 'capped' before initialization". CLAUDE.md
// states the rule in prose; this makes it a check. For each name a region defines,
// no code line outside the regions may use it before that region has ended.
console.log('\nTest 16 - the workflow uses nothing from a marked region before that region has run')
const srcLines = source.split('\n')
const spans = []
srcLines.forEach((l, i) => {
  if (l.startsWith(BEGIN)) spans.push({ start: i })
  else if (l.startsWith(END)) spans[spans.length - 1].end = i
})
const inRegion = (i) => spans.some((s) => i > s.start && i < s.end)
const early = []
for (const s of spans) {
  const names = srcLines.slice(s.start, s.end).map((l) => (l.match(/^(?:const|function)\s+(\w+)/) || [])[1]).filter(Boolean)
  for (const name of names) {
    const use = srcLines.findIndex((l, i) => i < s.end && !inRegion(i) && !l.trim().startsWith('//') && new RegExp(`\\b${name}\\b`).test(l))
    if (use >= 0) early.push(`${name} used at line ${use + 1}, before its region ends at line ${s.end + 1}`)
  }
}
ok('no function is called before the region defining it has run', early.length === 0, early)

console.log(fail ? `\n${fail} ASSERTION(S) FAILED` : '\nall assertions passed')
process.exit(fail ? 1 : 0)
