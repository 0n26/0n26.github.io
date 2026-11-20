import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import { expect, it } from 'vitest';
import { releaseSections } from './releaseSections';

it('keeps linked and plain releases separate without swallowing examples or standalone notes', () => {
  const source = `# Changelog

## [1.1.0](https://example.org/compare) (2026-11-20)

### Исправления

Исправлено в [PR](https://example.org/pull/1).

\`\`\`md
## 8.0.0 (2026-01-01)
\`\`\`

## 1.0.0 (2026-10-01)

Первый выпуск.

## Примечание

Общий текст.`;
  const html = renderToStaticMarkup(<Markdown skipHtml rehypePlugins={[releaseSections]}>{source}</Markdown>);
  const releases = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)].map(([section]) => section);
  expect(releases).toHaveLength(2);
  expect(releases[0]).toContain('href="https://example.org/compare"');
  expect(releases[0]).toContain('href="https://example.org/pull/1"');
  expect(releases[0]).toContain('## 8.0.0');
  expect(releases[1]).toContain('Первый выпуск.');
  expect(html.slice(html.lastIndexOf('</section>'))).toContain('<h2>Примечание</h2>');
});
