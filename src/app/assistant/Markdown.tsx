// Small, safe Markdown for chat replies: paragraphs, bullet and numbered lists, headings, **bold**,
// *italic*, `code` and links. Builds React elements, so nothing in a reply is ever treated as HTML.

import { Fragment, type ReactNode } from 'react';

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const k = `${key}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k}>{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!;
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer">{label}</a>);
    } else out.push(<em key={k}>{t.slice(1, -1)}</em>);
    last = m.index! + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const k = `b${i}`;
    if (line.startsWith('```')) {
      const code: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) code.push(lines[i]);
      i++;
      blocks.push(<pre key={k}><code>{code.join('\n')}</code></pre>);
    } else if (/^#{1,4}\s/.test(line)) {
      blocks.push(<p key={k} className="md-h">{inline(line.replace(/^#+\s/, ''), k)}</p>);
      i++;
    } else if (/^\s*([-*•]|\d+[.)])\s/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s/, ''));
      const List = ordered ? 'ol' : 'ul';
      blocks.push(<List key={k}>{items.map((t, j) => <li key={j}>{inline(t, `${k}-${j}`)}</li>)}</List>);
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i].trim() && !/^(\s*([-*•]|\d+[.)])\s|#{1,4}\s|```)/.test(lines[i])) para.push(lines[i++]);
      blocks.push(<p key={k}>{para.map((t, j) => <Fragment key={j}>{j > 0 && <br />}{inline(t, `${k}-${j}`)}</Fragment>)}</p>);
    }
  }
  return <>{blocks}</>;
}
