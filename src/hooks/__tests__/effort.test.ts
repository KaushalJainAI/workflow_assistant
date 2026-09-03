import { describe as group, expect, it } from 'vitest';
import { EFFORT_HINTS, EFFORT_LABELS, EFFORT_LADDER } from '../useEffortSelection';

/**
 * The ladder is written down twice — here and in `Backend/llm/effort.py` — and
 * the two copies have to agree, for the same reason the cron wording does: the
 * backend snaps a level it does not recognise, silently, so a spelling that
 * drifted here would show up as a control that appears to work and quietly
 * runs at a different effort. Pinned as a literal rather than derived from
 * anything, so a rename has to be made in both places deliberately.
 *
 * `LADDER` in `llm/effort.py`, cheapest first:
 *     ("none", "minimal", "low", "medium", "high")
 */
group('EFFORT_LADDER', () => {
  it('matches the backend ladder, in the backend order', () => {
    expect([...EFFORT_LADDER]).toEqual(['none', 'minimal', 'low', 'medium', 'high']);
  });

  it('is ordered cheapest first', () => {
    // The picker renders this array left to right and the backend's tie-break
    // resolves downward; both assume the same direction.
    expect(EFFORT_LADDER[0]).toBe('none');
    expect(EFFORT_LADDER[EFFORT_LADDER.length - 1]).toBe('high');
  });
});

group('labels', () => {
  it('names every rung, plus the empty default', () => {
    // A rung with no label renders its raw API value in the UI — readable, but
    // `minimal` next to `Instant` and `High` is the kind of inconsistency that
    // looks like a bug.
    for (const level of ['', ...EFFORT_LADDER]) {
      expect(EFFORT_LABELS[level], level).toBeTruthy();
      expect(EFFORT_HINTS[level], level).toBeTruthy();
    }
  });

  it("calls the empty choice a default rather than an effort", () => {
    // `''` is not a rung: it means "we send no level and the model uses its
    // own". Labelling it 'None' would collide with the `none` rung, which is a
    // genuinely different request — think as little as possible, but do think.
    expect(EFFORT_LABELS['']).toBe('Default');
    expect(EFFORT_LABELS['']).not.toBe(EFFORT_LABELS.none);
  });
});
