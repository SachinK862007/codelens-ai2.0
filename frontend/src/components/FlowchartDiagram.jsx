import React, { useMemo } from "react";

const COLORS = {
  stroke: "rgba(140, 110, 200, 0.45)",
  text: "#1b1233",
  muted: "#6e5a8f",
  fill: "rgba(255,255,255,0.75)",
  fillAlt: "rgba(237, 226, 255, 0.72)",
  accent: "#3b82f6",
  error: "#b42318"
};

const typeToShape = (type) => {
  const t = (type || "").toLowerCase();
  if (t === "condition" || t === "decision") return "diamond";
  if (t === "start" || t === "end") return "pill";
  return "box";
};

function wrapText(text, maxCharsPerLine) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = [];
  let count = 0;
  for (const w of words) {
    if (count + w.length + (line.length ? 1 : 0) > maxCharsPerLine) {
      lines.push(line.join(" "));
      line = [w];
      count = w.length;
    } else {
      line.push(w);
      count += w.length + (line.length > 1 ? 1 : 0);
    }
  }
  if (line.length) lines.push(line.join(" "));
  return lines.slice(0, 4);
}

export default function FlowchartDiagram({ flowchart }) {
  const model = useMemo(() => {
    const nodes = Array.isArray(flowchart) ? flowchart : [];
    const byId = new Map(nodes.map((n) => [String(n.id), n]));

    // Lay out nodes top-down following "next" pointers from the first node.
    const ordered = [];
    const seen = new Set();
    const start = nodes[0]?.id != null ? String(nodes[0].id) : null;
    let cur = start;
    while (cur && byId.has(cur) && !seen.has(cur) && ordered.length < 60) {
      const n = byId.get(cur);
      ordered.push(n);
      seen.add(cur);
      cur = n?.next != null ? String(n.next) : null;
    }
    // Add any remaining nodes (fallback)
    for (const n of nodes) {
      const id = String(n.id);
      if (!seen.has(id)) ordered.push(n);
    }

    const nodeW = 320;
    const nodeH = 84;
    const gapY = 34;
    const padX = 30;
    const padY = 26;

    const positioned = ordered.map((n, i) => ({
      ...n,
      __x: padX,
      __y: padY + i * (nodeH + gapY),
      __w: nodeW,
      __h: nodeH
    }));

    const width = nodeW + padX * 2;
    const height = positioned.length ? padY * 2 + positioned.length * nodeH + (positioned.length - 1) * gapY : 140;

    return { positioned, width, height };
  }, [flowchart]);

  if (!Array.isArray(flowchart) || flowchart.length === 0) {
    return <div className="empty-state">Flowchart appears here.</div>;
  }

  const byId = new Map(model.positioned.map((n) => [String(n.id), n]));

  const renderNode = (n) => {
    const shape = typeToShape(n.type);
    const x = n.__x;
    const y = n.__y;
    const w = n.__w;
    const h = n.__h;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const labelLines = wrapText(n.label, 28);

    const common = {
      fill: COLORS.fill,
      stroke: COLORS.stroke,
      strokeWidth: 1.2
    };

    let shapeEl = null;
    if (shape === "pill") {
      shapeEl = <rect x={x} y={y} width={w} height={h} rx={h / 2} {...common} />;
    } else if (shape === "diamond") {
      const p = [
        `${cx},${y}`,
        `${x + w},${cy}`,
        `${cx},${y + h}`,
        `${x},${cy}`
      ].join(" ");
      shapeEl = <polygon points={p} {...common} fill={COLORS.fillAlt} />;
    } else {
      shapeEl = <rect x={x} y={y} width={w} height={h} rx={14} {...common} />;
    }

    return (
      <g key={String(n.id)}>
        {shapeEl}
        <text x={cx} y={cy - (labelLines.length - 1) * 9} textAnchor="middle" fill={COLORS.text} fontSize="12" fontFamily="Inter, system-ui, Segoe UI, sans-serif">
          {labelLines.map((ln, idx) => (
            <tspan key={ln + idx} x={cx} dy={idx === 0 ? 0 : 18}>
              {ln}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  const renderArrow = (from, to) => {
    const fx = from.__x + from.__w / 2;
    const fy = from.__y + from.__h;
    const tx = to.__x + to.__w / 2;
    const ty = to.__y;
    const midY = (fy + ty) / 2;
    const d = `M ${fx} ${fy} C ${fx} ${midY} ${tx} ${midY} ${tx} ${ty - 8}`;
    return <path key={`${from.id}->${to.id}`} d={d} fill="none" stroke={COLORS.accent} strokeWidth="1.8" markerEnd="url(#arrow)" opacity="0.9" />;
  };

  const arrows = model.positioned
    .map((n) => {
      const nextId = n?.next != null ? String(n.next) : null;
      if (!nextId) return null;
      const to = byId.get(nextId);
      if (!to) return null;
      return renderArrow(n, to);
    })
    .filter(Boolean);

  return (
    <div className="flowchart-diagram">
      <svg viewBox={`0 0 ${model.width} ${model.height}`} width="100%" height="100%" role="img" aria-label="Flowchart">
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L9,3 z" fill={COLORS.accent} />
          </marker>
        </defs>
        {arrows}
        {model.positioned.map(renderNode)}
      </svg>
    </div>
  );
}

