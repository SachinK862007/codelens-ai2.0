import { describe, it, expect } from "vitest";
import { parseDebuggerResponse, buildCorrectedProgram } from "./debuggerParse.js";

describe("parseDebuggerResponse", () => {
  it("parses debugger JSON with array execution_output and bad escapes", () => {
    const raw = `{ "errors": [ { "error_type": "SyntaxError", "line_number": 4, "wrong_line": " for j in range(i+1):", "corrected_line": " for j in range(5-i):", "explanation": "The inner loop should iterate from i to 0, not from i+1" } ], "corrected_code": " for i in range(5): for j in range(5-i): print(\\"*\\") print(\\\\"\\n\\\\") ", "language": "python", "execution_output": [ "*", "", "*", "**", "***", "\\n" ] }`;

    const r = parseDebuggerResponse(raw);
    expect(r).not.toBeNull();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].error_type).toBe("SyntaxError");
    expect(r.errors[0].line_number).toBe(4);
    expect(r.execution_output).toContain("*");
    expect(r.corrected_code).toMatch(/range\(5\)/);
  });

  it("merges line fixes into source when AI returns fragments", () => {
    const source = "for i in range(5):\n    for j in range(i+1):\n        print('*')";
    const normalized = {
      corrected_code: " for j in range(5-i):",
      errors: [
        {
          error_type: "LogicError",
          line_number: 2,
          wrong_line: "    for j in range(i+1):",
          corrected_line: "    for j in range(5-i):",
          explanation: "wrong inner loop"
        }
      ]
    };
    const merged = buildCorrectedProgram(source, normalized);
    expect(merged).toContain("range(5-i)");
    expect(merged).toContain("for i in range(5)");
  });
});
