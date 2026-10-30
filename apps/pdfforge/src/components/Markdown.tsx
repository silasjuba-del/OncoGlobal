// Renderizador de Markdown seguro (gera elementos React, nunca innerHTML).
// Blocos de código HTML ganham prévia em iframe isolado (sandbox sem mesma origem).
import { Fragment, useState, type ReactNode } from 'react';

interface Block {
  type: 'code' | 'heading' | 'list' | 'table' | 'para' | 'quote' | 'hr';
  lang?: string;
  level?: number;
  ordered?: boolean;
  lines: string[];
}

function parse(md: string): Block[] {
  const lines = md.replace(/\r/g, '').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*([\w-]*)/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      blocks.push({ type: 'code', lang: fence[1].toLowerCase(), lines: body });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      blocks.push({ type: 'heading', level: h[1].length, lines: [h[2]] });
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push({ type: 'hr', lines: [] });
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      blocks.push({ type: 'table', lines: rows });
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+[.)]/.test(line);
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++]);
      blocks.push({ type: 'list', ordered, lines: items });
      continue;
    }
    if (line.startsWith('>')) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', lines: q });
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*\||\s*([-*•]|\d+[.)])\s+|>)/.test(lines[i])) para.push(lines[i++]);
    blocks.push({ type: 'para', lines: para });
  }
  return blocks;
}

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\]|\[p\. ?\d+\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) out.push(<strong key={k++}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else out.push(<span key={k++} className="cite">{t}</span>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export interface CodeAction {
  label: string;
  onClick(code: string, lang: string): void;
}

export function Markdown({ text, codeActions = [] }: { text: string; codeActions?: CodeAction[] }) {
  return (
    <div className="md">
      {parse(text).map((b, idx) => {
        switch (b.type) {
          case 'code':
            return <CodeBlock key={idx} code={b.lines.join('\n')} lang={b.lang ?? ''} actions={codeActions} />;
          case 'heading': {
            const Tag = (`h${Math.min(6, (b.level ?? 1) + 2)}` as unknown) as 'h3';
            return <Tag key={idx}>{inline(b.lines[0])}</Tag>;
          }
          case 'hr':
            return <hr key={idx} />;
          case 'quote':
            return <blockquote key={idx}>{inline(b.lines.join(' '))}</blockquote>;
          case 'list': {
            const L = b.ordered ? 'ol' : 'ul';
            return (
              <L key={idx}>
                {b.lines.map((l, j) => (
                  <li key={j} style={{ marginLeft: (l.match(/^\s*/)![0].length >= 2 ? 1 : 0) * 18 }}>
                    {inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ''))}
                  </li>
                ))}
              </L>
            );
          }
          case 'table': {
            const rows = b.lines
              .filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r))
              .map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
            return (
              <div key={idx} className="md-table">
                <table>
                  <thead>
                    <tr>{rows[0]?.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.slice(1).map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          default:
            return (
              <p key={idx}>
                {b.lines.map((l, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {inline(l)}
                  </Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}

function CodeBlock({ code, lang, actions }: { code: string; lang: string; actions: CodeAction[] }) {
  const [preview, setPreview] = useState(false);
  const isHtml = lang === 'html' || /^\s*<!doctype html|^\s*<html/i.test(code);
  return (
    <div className="md-code">
      <div className="md-code-bar">
        <span>{lang || 'texto'}</span>
        <div>
          {isHtml && (
            <button className="link" onClick={() => setPreview((p) => !p)}>
              {preview ? 'Ocultar prévia' : 'Prévia do app'}
            </button>
          )}
          <button className="link" onClick={() => navigator.clipboard.writeText(code)}>
            Copiar
          </button>
          {actions.map((a) => (
            <button key={a.label} className="link" onClick={() => a.onClick(code, lang)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
      {preview ? (
        <iframe className="app-preview" title="Prévia do app gerado" sandbox="allow-scripts allow-forms allow-modals" srcDoc={code} />
      ) : (
        <pre>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
