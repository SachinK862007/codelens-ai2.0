import { describe, it, expect } from "vitest";
import { parsePracticeResponse, parseProsePractice } from "./practiceParse.js";

describe("parsePracticeResponse", () => {
  it("parses strict JSON", () => {
    const raw = '{"passed": true, "feedback": "Good job", "hint": ""}';
    expect(parsePracticeResponse(raw)).toEqual({
      passed: true,
      feedback: "Good job",
      hint: ""
    });
  });

  it("parses prose evaluation (user-reported format)", () => {
    const raw = `Here is an evaluation of the user's code:

Passed: true Feedback: The code correctly prints a greeting message to the console. Hint: None, as the code solves the problem correctly.

The code uses print function to output "Hello".`;
    const r = parsePracticeResponse(raw);
    expect(r?.passed).toBe(true);
    expect(r?.feedback).toMatch(/greeting/i);
    expect(r?.hint).toBe("");
  });

  it("parses failed prose with hint", () => {
    const raw = "Passed: false Feedback: Missing sum logic. Hint: Read two integers first.";
    const r = parseProsePractice(raw);
    expect(r?.passed).toBe(false);
    expect(r?.hint).toMatch(/integers/i);
  });
});
