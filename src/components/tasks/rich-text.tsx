"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Renderizador de texto das anotações.
 *
 * Aceita uma marcação leve (títulos, listas, citação, bloco de código, negrito,
 * itálico, código e link) e devolve ELEMENTOS REACT — nunca HTML por
 * `dangerouslySetInnerHTML`.
 *
 * Isso não é preciosismo: a anotação é texto que o usuário cola de qualquer
 * lugar, e transformá-la em HTML abriria injeção de script na própria conta.
 * Como cada trecho vira um nó React, o conteúdo é sempre escapado por
 * construção. Links ainda passam por uma checagem de protocolo, porque `href`
 * aceita `javascript:` mesmo em JSX.
 */

const INLINE_PATTERN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\))/g;

function isSafeUrl(url: string) {
  return /^(https?:\/\/|mailto:)/i.test(url);
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = new RegExp(INLINE_PATTERN.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${match.index}`;

    if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      if (link && isSafeUrl(link[2])) {
        nodes.push(
          <a
            key={key}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            {link[1]}
          </a>
        );
      } else {
        // Link com protocolo estranho fica como texto puro, visível e inerte.
        nodes.push(token);
      }
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function RichText({ content }: { content: string }) {
  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">Nenhuma anotação ainda.</p>;
  }

  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];

  let bullets: string[] = [];
  let numbers: string[] = [];
  let code: string[] | null = null;

  function flushBullets(key: string) {
    if (bullets.length === 0) return;
    const items = bullets;
    bullets = [];
    blocks.push(
      <ul key={key} className="ml-4 list-disc space-y-1">
        {items.map((item, index) => (
          <li key={index}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </ul>
    );
  }

  function flushNumbers(key: string) {
    if (numbers.length === 0) return;
    const items = numbers;
    numbers = [];
    blocks.push(
      <ol key={key} className="ml-4 list-decimal space-y-1">
        {items.map((item, index) => (
          <li key={index}>{renderInline(item, `${key}-${index}`)}</li>
        ))}
      </ol>
    );
  }

  lines.forEach((line, index) => {
    const key = `b${index}`;

    if (line.trimStart().startsWith("```")) {
      if (code === null) {
        flushBullets(`${key}-u`);
        flushNumbers(`${key}-o`);
        code = [];
      } else {
        blocks.push(
          <pre
            key={key}
            className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre"
          >
            {code.join("\n")}
          </pre>
        );
        code = null;
      }
      return;
    }

    if (code !== null) {
      code.push(line);
      return;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushNumbers(`${key}-o`);
      bullets.push(bullet[1]);
      return;
    }

    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (numbered) {
      flushBullets(`${key}-u`);
      numbers.push(numbered[1]);
      return;
    }

    flushBullets(`${key}-u`);
    flushNumbers(`${key}-o`);

    if (!line.trim()) return;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = renderInline(heading[2], key);
      blocks.push(
        level === 1 ? (
          <h3 key={key} className="text-base font-semibold">
            {text}
          </h3>
        ) : level === 2 ? (
          <h4 key={key} className="text-sm font-semibold">
            {text}
          </h4>
        ) : (
          <h5 key={key} className="text-sm font-medium text-muted-foreground">
            {text}
          </h5>
        )
      );
      return;
    }

    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      blocks.push(
        <blockquote key={key} className="border-l-2 pl-3 text-muted-foreground italic">
          {renderInline(quote[1], key)}
        </blockquote>
      );
      return;
    }

    blocks.push(<p key={key}>{renderInline(line, key)}</p>);
  });

  flushBullets("tail-u");
  flushNumbers("tail-o");
  if (code !== null) {
    blocks.push(
      <pre key="tail-code" className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre">
        {(code as string[]).join("\n")}
      </pre>
    );
  }

  return (
    <div className="space-y-2 text-sm leading-relaxed break-words">
      {blocks.map((block, index) => (
        <Fragment key={index}>{block}</Fragment>
      ))}
    </div>
  );
}
