import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // server.test.js is a manual integration test run via `node server.test.js`
    // not a vitest suite — exclude it so vitest only picks up unit tests
    exclude: ["server.test.js", "**/node_modules/**"],
    include: [
      "**/*.test.js",
      "../frontend/src/**/*.test.js"
    ]
  }
});

