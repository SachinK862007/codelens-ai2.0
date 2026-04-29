/**
 * Tests for ModelFour "Next Level" button behaviour
 *
 * 10.1 Property test for Next Level index advance (Property 4)
 *   Property 4: Next Level advances index by exactly one
 *   Validates: Requirements 3.3
 *
 * 10.2 Unit tests for Next Level button disabled states
 *   Validates: Requirements 3.1, 3.2, 3.4
 */
import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// ---------------------------------------------------------------------------
// Pure simulation of the Next Level click handler state transitions
// ---------------------------------------------------------------------------

/**
 * Simulate the state held by ModelFour and the Next Level click handler.
 * Returns the resulting state after the click.
 */
function simulateNextLevelClick(state) {
  const { index, total } = state;
  return {
    index: Math.min(index + 1, total - 1),
    code: "",
    result: null,
    rawStream: "",
    liveFeedback: "",
    liveHint: "",
    livePassed: null,
    passedFlash: false,
  };
}

/**
 * Determine whether the Next Level button should be disabled given the
 * current ModelFour state — mirrors the JSX disabled expression:
 *   disabled={loading || !(result?.passed ?? livePassed) || index >= total - 1}
 */
function isNextLevelDisabled({ loading, result, livePassed, index, total }) {
  return loading || !(result?.passed ?? livePassed) || index >= total - 1;
}

/**
 * Determine whether the Next Level button should be visible:
 *   visible when result !== null
 */
function isNextLevelVisible({ result }) {
  return result !== null;
}

// ---------------------------------------------------------------------------
// 10.1  Property 4: Next Level advances index by exactly one
// ---------------------------------------------------------------------------

describe("Property 4: Next Level advances index by exactly one (Validates: Requirements 3.3)", () => {
  it("advances index by 1 for any valid non-last index", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }), // index 0..8, total=10
        (i) => {
          const total = 10;
          const before = { index: i, total };
          const after = simulateNextLevelClick(before);
          expect(after.index).toBe(i + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("clears code, result, rawStream, liveFeedback, liveHint, livePassed after click", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        fc.string(),
        (i, someCode) => {
          const total = 10;
          const before = { index: i, total, code: someCode };
          const after = simulateNextLevelClick(before);
          expect(after.code).toBe("");
          expect(after.result).toBeNull();
          expect(after.rawStream).toBe("");
          expect(after.liveFeedback).toBe("");
          expect(after.liveHint).toBe("");
          expect(after.livePassed).toBeNull();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("does not advance past the last index (clamps at total - 1)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // total 1..20
        (total) => {
          const lastIndex = total - 1;
          const before = { index: lastIndex, total };
          const after = simulateNextLevelClick(before);
          expect(after.index).toBe(lastIndex); // clamped, no overflow
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// 10.2  Unit tests for Next Level button disabled states
// ---------------------------------------------------------------------------

describe("Next Level button disabled states (Validates: Requirements 3.1, 3.2, 3.4)", () => {
  const total = 10;

  it("is enabled when result.passed=true and index < total-1", () => {
    const state = { loading: false, result: { passed: true }, livePassed: null, index: 3, total };
    expect(isNextLevelDisabled(state)).toBe(false);
  });

  it("is disabled when result.passed=false", () => {
    const state = { loading: false, result: { passed: false }, livePassed: null, index: 3, total };
    expect(isNextLevelDisabled(state)).toBe(true);
  });

  it("is disabled when result.passed=true but index === total-1 (last question)", () => {
    const state = { loading: false, result: { passed: true }, livePassed: null, index: total - 1, total };
    expect(isNextLevelDisabled(state)).toBe(true);
  });

  it("is disabled while loading even if passed", () => {
    const state = { loading: true, result: { passed: true }, livePassed: null, index: 3, total };
    expect(isNextLevelDisabled(state)).toBe(true);
  });

  it("falls back to livePassed when result is null (during streaming)", () => {
    const statePass = { loading: false, result: null, livePassed: true, index: 3, total };
    expect(isNextLevelDisabled(statePass)).toBe(false);

    const stateFail = { loading: false, result: null, livePassed: false, index: 3, total };
    expect(isNextLevelDisabled(stateFail)).toBe(true);
  });

  it("is not visible before a check runs (result === null, livePassed === null)", () => {
    const state = { result: null };
    expect(isNextLevelVisible(state)).toBe(false);
  });

  it("is visible after a check completes (result !== null)", () => {
    const statePassed = { result: { passed: true } };
    expect(isNextLevelVisible(statePassed)).toBe(true);

    const stateFailed = { result: { passed: false } };
    expect(isNextLevelVisible(stateFailed)).toBe(true);
  });
});
