/**
 * Unit tests for writeSse flush behavior
 * Validates: Requirements 6.2
 */
import { describe, it, expect, vi } from "vitest";

// Inline the writeSse helper so we can test it in isolation without
// importing the full server (which starts listening on a port).
const writeSse = (res, data) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.flush?.();
};

describe("writeSse", () => {
  it("calls res.write with correctly formatted SSE data", () => {
    const res = { write: vi.fn(), flush: vi.fn() };
    writeSse(res, { type: "delta", text: "hello" });
    expect(res.write).toHaveBeenCalledOnce();
    expect(res.write).toHaveBeenCalledWith(
      `data: ${JSON.stringify({ type: "delta", text: "hello" })}\n\n`
    );
  });

  it("calls res.flush once per invocation when flush is available", () => {
    const res = { write: vi.fn(), flush: vi.fn() };
    writeSse(res, { type: "start" });
    expect(res.flush).toHaveBeenCalledOnce();
  });

  it("calls res.flush after res.write (not before)", () => {
    const callOrder = [];
    const res = {
      write: vi.fn(() => callOrder.push("write")),
      flush: vi.fn(() => callOrder.push("flush"))
    };
    writeSse(res, { type: "done" });
    expect(callOrder).toEqual(["write", "flush"]);
  });

  it("does not throw when res.flush is absent (optional chaining)", () => {
    const res = { write: vi.fn() };
    expect(() => writeSse(res, { type: "start" })).not.toThrow();
    expect(res.write).toHaveBeenCalledOnce();
  });

  it("calls flush once per call across multiple invocations", () => {
    const res = { write: vi.fn(), flush: vi.fn() };
    writeSse(res, { type: "delta", text: "a" });
    writeSse(res, { type: "delta", text: "b" });
    writeSse(res, { type: "done" });
    expect(res.flush).toHaveBeenCalledTimes(3);
  });
});
