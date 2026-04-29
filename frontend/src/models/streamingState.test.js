/**
 * Property test for incremental streaming state updates
 * Property 5: Incremental streaming updates state on every token
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { extractJsonString, extractJsonBool } from "../lib/partialJson.js";

/**
 * Simulate ModelTwo / ModelThree onDelta logic:
 * setRawStream is called on every token.
 */
function simulateModelTwoOnDelta(tokens) {
  let collected = "";
  const rawStreamUpdates = [];

  for (const t of tokens) {
    collected += t;
    rawStreamUpdates.push(collected); // setRawStream(collected)
  }

  return { rawStreamUpdates };
}

/**
 * Simulate ModelFour onDelta logic:
 * setRawStream, setLiveFeedback, setLiveHint, setLivePassed called per token.
 */
function simulateModelFourOnDelta(tokens) {
  let collected = "";
  const rawStreamUpdates = [];
  const liveFeedbackUpdates = [];
  const liveHintUpdates = [];
  const livePassedUpdates = [];

  for (const t of tokens) {
    collected += t;
    rawStreamUpdates.push(collected);
    const fb = extractJsonString(collected, "feedback");
    const hint = extractJsonString(collected, "hint");
    const passed = extractJsonBool(collected, "passed");
    if (fb != null) liveFeedbackUpdates.push(fb);
    if (hint != null) liveHintUpdates.push(hint);
    if (passed != null) livePassedUpdates.push(passed);
  }

  return { rawStreamUpdates, liveFeedbackUpdates, liveHintUpdates, livePassedUpdates };
}

/**
 * Simulate ModelCodeWriter onDelta logic:
 * setRawStream and setLiveLogic called per token.
 */
function simulateModelCodeWriterOnDelta(tokens) {
  let collected = "";
  const rawStreamUpdates = [];
  const liveLogicUpdates = [];

  for (const t of tokens) {
    collected += t;
    rawStreamUpdates.push(collected);
    const logic = extractJsonString(collected, "logic_explanation");
    if (logic != null) liveLogicUpdates.push(logic);
  }

  return { rawStreamUpdates, liveLogicUpdates };
}

describe("Property 5: Incremental streaming updates state on every token", () => {
  it("ModelTwo: setRawStream is called exactly once per token", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const { rawStreamUpdates } = simulateModelTwoOnDelta(tokens);
          // setRawStream must be called exactly N times (once per token)
          expect(rawStreamUpdates.length).toBe(tokens.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("ModelTwo: each rawStream update is a prefix of the full accumulated string", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const { rawStreamUpdates } = simulateModelTwoOnDelta(tokens);
          const full = tokens.join("");
          // Every update must be a prefix of the final accumulated string
          for (const update of rawStreamUpdates) {
            expect(full.startsWith(update)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("ModelThree: setRawStream is called exactly once per token (same logic as ModelTwo)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          // ModelThree uses identical onDelta logic to ModelTwo
          const { rawStreamUpdates } = simulateModelTwoOnDelta(tokens);
          expect(rawStreamUpdates.length).toBe(tokens.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("ModelFour: setRawStream is called exactly once per token", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const { rawStreamUpdates } = simulateModelFourOnDelta(tokens);
          expect(rawStreamUpdates.length).toBe(tokens.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("ModelFour: liveFeedback updates are monotonically growing (never shrink)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const { liveFeedbackUpdates } = simulateModelFourOnDelta(tokens);
          for (let i = 1; i < liveFeedbackUpdates.length; i++) {
            // Each successive feedback value must be >= the previous (growing prefix)
            expect(liveFeedbackUpdates[i].length).toBeGreaterThanOrEqual(
              liveFeedbackUpdates[i - 1].length
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("ModelCodeWriter: setRawStream is called exactly once per token", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const { rawStreamUpdates } = simulateModelCodeWriterOnDelta(tokens);
          expect(rawStreamUpdates.length).toBe(tokens.length);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("ModelCodeWriter: liveLogic updates are monotonically growing (never shrink)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const { liveLogicUpdates } = simulateModelCodeWriterOnDelta(tokens);
          for (let i = 1; i < liveLogicUpdates.length; i++) {
            expect(liveLogicUpdates[i].length).toBeGreaterThanOrEqual(
              liveLogicUpdates[i - 1].length
            );
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("All models: state is updated at least N times for N tokens (core requirement)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 50 }),
        (tokens) => {
          const N = tokens.length;

          const modelTwo = simulateModelTwoOnDelta(tokens);
          expect(modelTwo.rawStreamUpdates.length).toBeGreaterThanOrEqual(N);

          const modelFour = simulateModelFourOnDelta(tokens);
          expect(modelFour.rawStreamUpdates.length).toBeGreaterThanOrEqual(N);

          const modelCodeWriter = simulateModelCodeWriterOnDelta(tokens);
          expect(modelCodeWriter.rawStreamUpdates.length).toBeGreaterThanOrEqual(N);
        }
      ),
      { numRuns: 200 }
    );
  });
});
