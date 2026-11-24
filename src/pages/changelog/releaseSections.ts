import type { Element, Root } from 'hast';

// Group parsed headings, not lines: a Markdown example may itself contain `## 1.2.3`.
export function releaseSections() {
  return (tree: Root) => {
    const content: Root['children'] = [];
    let release: Element | undefined;
    for (const item of tree.children) {
      if (item.type === 'element' && (item.tagName === 'h1' || item.tagName === 'h2')) {
        release = undefined;
        const [first, date] = item.children;
        if (item.tagName === 'h1' && first?.type === 'text' && first.value === 'Changelog') continue;
        const link = first?.type === 'element' && first.tagName === 'a' ? first : undefined;
        const label = link?.children[0] ?? first;
        const heading = label?.type === 'text' ? label.value + (date?.type === 'text' ? date.value : '') : '';
        const match = /^(\d+\.\d+\.\d+(?:[-+][\w.+-]+)?)\s+\((\d{4}-\d{2}-\d{2})\)$/.exec(heading);
        if (item.tagName === 'h2' && match && Number.isFinite(Date.parse(match[2]))) {
          release = { type: 'element', tagName: 'section', properties: { dataVersion: match[1], dataDate: match[2] }, children: [] };
          if (link) release.children.push({ ...link, children: [{ type: 'text', value: 'Сравнить версии на GitHub ↗' }] });
          content.push(release);
          continue;
        }
      }
      if (release && item.type !== 'doctype') release.children.push(item);
      else content.push(item);
    }
    tree.children = content;
  };
}
