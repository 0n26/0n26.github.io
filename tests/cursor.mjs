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

const trans = async (file, replaceCss) => {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8').replace(replaceCss, '');
  const out = new URL(`../src/.test-${Math.random().toString(36).slice(2)}.mjs`, import.meta.url);
  writeFileSync(out, (await transform(source, { loader: 'jsx', format: 'esm' })).code);
  return out;
};

const cursorFile = await trans('../src/TargetCursor.jsx', "import './target-cursor.css';");
const decryptFile = await trans('../src/DecryptedText.jsx', '');
const spotlightFile = await trans('../src/SpotlightCard.jsx', "import './spotlight-card.css';");
const sparkFile = await trans('../src/ClickSpark.jsx', '');

try {
  const { default: TargetCursor } = await import(cursorFile.href);
  const { default: DecryptedText } = await import(decryptFile.href);
  const { default: SpotlightCard } = await import(spotlightFile.href);
  const { default: ClickSpark } = await import(sparkFile.href);
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(document.querySelector('#root'));

  // 1. TargetCursor
  await act(() => root.render(React.createElement(TargetCursor, { targetSelector: '.target-btn' })));
  assert.ok(document.querySelector('.target-cursor'), 'target-cursor rendered in DOM');
  assert.equal(document.querySelectorAll('.target-cursor-corner').length, 4, 'renders 4 corners');
  assert.ok(document.querySelector('.target-cursor-dot'), 'renders center dot');
  assert.ok(document.querySelector('.target-cursor-label'), 'renders label element');

  // 2. DecryptedText
  await act(() => root.render(React.createElement(DecryptedText, { text: '0n26 TEST' })));
  const decNode = document.querySelector('.decrypted-text');
  assert.ok(decNode, 'decrypted-text element rendered');
  assert.equal(decNode.textContent, '0n26 TEST');

  // 3. SpotlightCard
  await act(() => root.render(React.createElement(SpotlightCard, { className: 'test-card' }, 'Content')));
  const cardNode = document.querySelector('.spotlight-card.test-card');
  assert.ok(cardNode, 'spotlight card rendered');
  assert.ok(cardNode.querySelector('.spotlight-layer'), 'spotlight layer present');

  // 4. ClickSpark
  await act(() => root.render(React.createElement(ClickSpark)));
  assert.ok(document.querySelector('canvas'), 'click spark canvas mounted');

  // 5. Cleanup
  await act(() => root.unmount());
  assert.equal(document.querySelectorAll('.target-cursor, .spotlight-card, canvas').length, 0, 'clean unmount');

  console.log('PASS effects: TargetCursor, DecryptedText, SpotlightCard, ClickSpark.');
} finally {
  unlinkSync(cursorFile);
  unlinkSync(decryptFile);
  unlinkSync(spotlightFile);
  unlinkSync(sparkFile);
  dom.window.close();
}
