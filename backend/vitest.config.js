import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // server.test.js is a manual integration test run via `node server.test.js`
    // not a vitest suite — exclude it so vitest only picks up writeSse.test.js
    exclude: ["server.test.js", "**/node_modules/**"]
  }
});
