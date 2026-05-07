import React from "react";

/**
 * Premium Markdown-to-JSX renderer.
 * Handles: headings, bold, italic, inline code, code blocks,
 * bullet/numbered lists, blockquotes, tables, links, horizontal rules,
 * and auto-formatting of JSON key-value pairs from LLM output.
 *
 * Used as the main formatter when AI returns non-JSON responses —
 * displays beautifully formatted content instead of raw text.
 */
export default function MarkdownRenderer({ text }) {
  if (!text || typeof text !== "string") {
    return <div className="markdown-body empty-state">No content to display.</div>;
  }

  // Clean up common LLM preamble patterns
  const cleaned = cleanLlmPreamble(text.trim());
  const blocks = parseBlocks(cleaned);

  return (
    <div className="markdown-body ai-result-enter">
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

/* ── LLM output cleanup ─────────────────────────────────── */

function cleanLlmPreamble(text) {
  let cleaned = text;

  // Remove "Sure, here is..." / "Here's the..." preamble (only the first line if it's a preamble)
  cleaned = cleaned.replace(
    /^(?:Sure[,!.]?\s*)?(?:Here(?:'s| is| are)\s+(?:the\s+)?(?:response|answer|result|output|code|json|information|details|analysis|roadmap|feedback|solution)\s*[:.]?\s*)/i,
    ""
  );

  // Remove "I hope this helps!" / "Let me know..." trailing patterns
  cleaned = cleaned.replace(
    /\n+(?:I hope this helps|Let me know if you (?:need|have|want)|Feel free to|Please let me know|Is there anything else)[^]*$/i,
    ""
  );

  return cleaned.trim();
}

/* ── Block-level parsing ─────────────────────────────────── */

function parseBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (line.trim().startsWith("```")) {
      const langMatch = line.trim().match(/^```(\w*)/);
      const lang = langMatch?.[1] || "";
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: "code", lang, content: codeLines.join("\n") });
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, content: headingMatch[2] });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    // Blockquote
    if (line.trim().startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith("> ")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", content: quoteLines.join("\n") });
      continue;
    }

    // Table (line starts with |)
    if (line.trim().startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().match(/^\|[\s-:|]+\|/)) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: "table", lines: tableLines });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s/, ""));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s/, ""));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // Key-value pair detection (common in LLM output like "Language: Python")
    const kvMatch = line.match(/^([A-Za-z_][\w\s]{0,30}):\s+(.+)$/);
    if (kvMatch && !line.startsWith("http") && !line.includes("://")) {
      const kvItems = [];
      while (i < lines.length) {
        const kvLine = lines[i].match(/^([A-Za-z_][\w\s]{0,30}):\s+(.+)$/);
        if (kvLine && !lines[i].startsWith("http") && !lines[i].includes("://")) {
          kvItems.push({ key: kvLine[1].trim(), value: kvLine[2].trim() });
          i++;
        } else {
          break;
        }
      }
      if (kvItems.length >= 2) {
        blocks.push({ type: "kvpairs", items: kvItems });
      } else {
        // Single key-value, treat as paragraph
        blocks.push({ type: "paragraph", content: line });
        i = i; // already incremented
      }
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph — accumulate adjacent non-empty lines
    const paraLines = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: "paragraph", content: paraLines.join(" ") });
  }

  return blocks;
}

function isBlockStart(line) {
  if (line.trim().startsWith("```")) return true;
  if (/^#{1,3}\s/.test(line)) return true;
  if (/^[-*_]{3,}\s*$/.test(line.trim())) return true;
  if (line.trim().startsWith("|")) return true;
  if (/^\s*[-*+]\s/.test(line)) return true;
  if (/^\s*\d+[.)]\s/.test(line)) return true;
  if (line.trim().startsWith("> ")) return true;
  return false;
}

/* ── Block rendering ─────────────────────────────────────── */

function renderBlock(block, key) {
  switch (block.type) {
    case "heading":
      return renderHeading(block, key);
    case "paragraph":
      return <p key={key} className="md-paragraph">{renderInline(block.content)}</p>;
    case "code":
      return (
        <div key={key} className="md-codeblock">
          {block.lang && <div className="md-codeblock-lang">{block.lang}</div>}
          <pre className="md-codeblock-pre"><code>{block.content}</code></pre>
        </div>
      );
    case "blockquote":
      return (
        <blockquote key={key} className="md-blockquote">
          {renderInline(block.content)}
        </blockquote>
      );
    case "ul":
      return (
        <ul key={key} className="md-list">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="md-list md-list-ordered">
          {block.items.map((item, j) => (
            <li key={j}>{renderInline(item)}</li>
          ))}
        </ol>
      );
    case "kvpairs":
      return (
        <div key={key} className="md-kvpairs">
          {block.items.map((kv, j) => (
            <div key={j} className="md-kvpair">
              <span className="md-kvpair-key">{kv.key}</span>
              <span className="md-kvpair-value">{renderInline(kv.value)}</span>
            </div>
          ))}
        </div>
      );
    case "table":
      return renderTable(block.lines, key);
    case "hr":
      return <hr key={key} className="md-hr" />;
    default:
      return null;
  }
}

function renderHeading(block, key) {
  const Tag = `h${block.level}`;
  return <Tag key={key} className={`md-heading md-h${block.level}`}>{renderInline(block.content)}</Tag>;
}

function renderTable(lines, key) {
  const parseRow = (line) =>
    line.split("|").map(c => c.trim()).filter(c => c !== "");

  const header = parseRow(lines[0]);
  // Skip the separator line (index 1)
  const rows = lines.slice(2).map(parseRow);

  return (
    <div key={key} className="md-table-wrapper">
      <table className="md-table">
        <thead>
          <tr>
            {header.map((h, i) => <th key={i}>{renderInline(h)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => <td key={ci}>{renderInline(cell)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Inline rendering ────────────────────────────────────── */

function renderInline(text) {
  if (!text) return null;

  const parts = [];
  let remaining = text;
  let keyCounter = 0;

  while (remaining.length > 0) {
    // Link: [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      if (linkMatch[1]) parts.push(renderFormattedText(linkMatch[1], keyCounter++));
      parts.push(
        <a
          key={`a${keyCounter++}`}
          href={linkMatch[3]}
          className="md-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkMatch[2]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Inline code: `...`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(renderFormattedText(codeMatch[1], keyCounter++));
      parts.push(<code key={`c${keyCounter++}`} className="md-inline-code">{codeMatch[2]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold: **...**
    const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*/);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(renderFormattedText(boldMatch[1], keyCounter++));
      parts.push(<strong key={`b${keyCounter++}`}>{boldMatch[2]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic: *...*
    const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*/);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(renderFormattedText(italicMatch[1], keyCounter++));
      parts.push(<em key={`i${keyCounter++}`}>{italicMatch[2]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // No more inline patterns — output the rest
    parts.push(<span key={`t${keyCounter++}`}>{remaining}</span>);
    break;
  }

  return parts.length === 1 ? parts[0] : parts;
}

function renderFormattedText(text, key) {
  return <span key={`ft${key}`}>{text}</span>;
}
