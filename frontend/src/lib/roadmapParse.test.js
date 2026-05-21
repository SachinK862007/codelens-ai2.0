import { describe, it, expect } from "vitest";
import { formatFileStructure, parseRoadmapResponse } from "./roadmapParse.js";

describe("formatFileStructure", () => {
  it("formats nested object as tree", () => {
    const tree = formatFileStructure({
      src: { components: ["App.jsx"], api: ["client.js"] },
      public: ["index.html"]
    });
    expect(tree).toContain("src");
    expect(tree).toContain("components");
  });

  it("formats array of paths", () => {
    const tree = formatFileStructure(["src/", "  App.jsx", "package.json"]);
    expect(tree).toContain("App.jsx");
  });
});

describe("parseRoadmapResponse", () => {
  it("parses roadmap JSON with object file structure", () => {
    const raw = `{"project_title":"Todo App","project_description":"A task app","file_folder_structure":{"frontend":["src/App.jsx"],"backend":["server.js"]},"recommended_tech_stack":["React"],"recommended_apis":[],"research_references":[],"phases":[],"deployment":[]}`;
    const r = parseRoadmapResponse(raw);
    expect(r?.project_title).toBe("Todo App");
    expect(r?.file_folder_structure).toContain("frontend");
  });
});
