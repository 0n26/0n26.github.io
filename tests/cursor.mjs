import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { transform } from 'esbuild';
import React, { act } from 'react';
globalThis.React = React;
const dom = new JSDOM('<div id="root"></div><button class="target-btn" data-cursor-label="CLICK ME">Button</button>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let pointerFine = true;
window.matchMedia = query => ({
  matches: query.includes('pointer: fine') ? pointerFine : false,
  addEventListener: () => {},
  removeEventListener: () => {}
});

window.requestAnimationFrame = fn => setTimeout(fn, 16);
window.cancelAnimationFrame = id => clearTimeout(id);

const file = new URL('../src/.cursor-test.mjs', import.meta.url);
const source = readFileSync(new URL('../src/TargetCursor.jsx', import.meta.url), 'utf8').replace("import './target-cursor.css';", '');
writeFileSync(file, (await transform(source, { loader: 'jsx', format: 'esm' })).code);

try {
  const { default: TargetCursor } = await import(file.href);
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.querySelector('#root'));

  // 1. Mount with fine pointer
  await act(() => root.render(React.createElement(TargetCursor, { targetSelector: '.target-btn' })));
  const cursor = document.querySelector('.target-cursor');
  assert.ok(cursor, 'target-cursor rendered in DOM');

  const corners = document.querySelectorAll('.target-cursor-corner');
  assert.equal(corners.length, 4, 'renders 4 corners');

  const dot = document.querySelector('.target-cursor-dot');
  assert.ok(dot, 'renders center dot');

  const label = document.querySelector('.target-cursor-label');
  assert.ok(label, 'renders label element');

  // 2. Unmount clean up
  await act(() => root.unmount());
  assert.equal(document.querySelectorAll('.target-cursor').length, 0, 'cursor cleanly unmounted');

  console.log('PASS cursor: fine pointer detection, 4 corners, dot, label, cleanup on unmount.');
} finally {
  unlinkSync(file);
  dom.window.close();
}
