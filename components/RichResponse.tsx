"use client";

import { Check, Code2, Copy, PencilLine, Save, Sigma, X } from "lucide-react";
import { memo, useMemo, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

type RichResponseProps = {
  content: string;
  onEditCode?: (blockIndex: number, code: string) => void;
};

type CodePanelProps = {
  code: string;
  language: string;
  onSave?: (nextCode: string) => void;
};

function CodePanel({ code, language, onSave }: CodePanelProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(editing ? draft : code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  function beginEdit() {
    setDraft(code);
    setEditing(true);
  }

  function saveEdit() {
    onSave?.(draft);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(code);
    setEditing(false);
  }

  const lineCount = (editing ? draft : code).split("\n").length;

  return (
    <section className="response-code-panel">
      <header className="code-panel-header">
        <span className="code-language">
          <Code2 size={14} />
          {language || "code"}
        </span>
        <span className="code-lines">{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
        <div className="code-panel-actions">
          {editing ? (
            <>
              <button type="button" onClick={cancelEdit} aria-label="Cancel code edit">
                <X size={14} /> Cancel
              </button>
              <button type="button" className="save-code" onClick={saveEdit} aria-label="Save code edit">
                <Save size={14} /> Save
              </button>
            </>
          ) : (
            <button type="button" onClick={beginEdit} aria-label="Edit code block">
              <PencilLine size={14} /> Edit
            </button>
          )}
          <button type="button" onClick={() => void copyCode()} aria-label="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </header>

      {editing ? (
        <textarea
          className="code-editor"
          value={draft}
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Edit ${language || "code"} code`}
        />
      ) : (
        <pre className="code-panel-pre">
          <code className={language ? `language-${language}` : undefined}>{code}</code>
        </pre>
      )}
    </section>
  );
}

function RichResponse({ content, onEditCode }: RichResponseProps) {
  const hasCode = /```[\s\S]*?```/.test(content);
  const hasDisplayMath = /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/.test(content);
  const hasInlineMath = /(^|[^$])\$[^$\n]+\$(?!\$)/.test(content);
  const hasMath = hasDisplayMath || hasInlineMath;

  const components = useMemo<Components>(() => {
    let blockIndex = 0;

    return {
      pre({ children }) {
        return <>{children}</>;
      },
      code({ className, children, ...props }) {
        const raw = String(children ?? "");
        const isBlock =
          Boolean(className?.startsWith("language-")) ||
          raw.includes("\n") ||
          raw.endsWith("\n");

        if (!isBlock) {
          return (
            <code className="inline-code" {...props}>
              {children}
            </code>
          );
        }

        const currentIndex = blockIndex++;
        const language = className?.replace(/^language-/, "") ?? "text";
        const code = raw.replace(/\n$/, "");

        return (
          <CodePanel
            key={`code-${currentIndex}`}
            language={language}
            code={code}
            onSave={onEditCode ? (nextCode) => onEditCode(currentIndex, nextCode) : undefined}
          />
        );
      },
      a({ children, ...props }) {
        return (
          <a {...props} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      },
    };
  }, [onEditCode]);

  return (
    <div className={`rich-response ${hasMath ? "contains-math" : ""} ${hasCode ? "contains-code" : ""}`}>
      {(hasMath || hasCode) && (
        <div className="response-category-bar">
          {hasMath && (
            <span className="response-category math">
              <Sigma size={13} /> Mathematics
            </span>
          )}
          {hasCode && (
            <span className="response-category programming">
              <Code2 size={13} /> Programming
            </span>
          )}
        </div>
      )}

      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        skipHtml
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}

export default memo(RichResponse);
