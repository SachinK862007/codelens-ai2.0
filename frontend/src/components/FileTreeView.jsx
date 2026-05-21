import React, { useMemo } from "react";

/**
 * Full scrollable file/folder tree for Idea Builder roadmaps.
 */
export default function FileTreeView({ structure, title = "Project structure" }) {
  const text = useMemo(() => {
    if (!structure) return "";
    return typeof structure === "string" ? structure : String(structure);
  }, [structure]);

  if (!text.trim()) {
    return <div className="empty-state">File structure will appear here.</div>;
  }

  const lineCount = text.split("\n").length;

  return (
    <div className="file-tree-view">
      <div className="file-tree-header">
        <span className="file-tree-title">{title}</span>
        <span className="file-tree-meta">{lineCount} lines</span>
      </div>
      <pre className="file-tree-content">{text}</pre>
    </div>
  );
}
