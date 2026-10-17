// Test the actual production bundle in a simulated DOM; this is not visual QA.
import { JSDOM } from 'jsdom';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { resolveBase } from '../src/base.js';
const js = readdirSync('dist/assets').find(p=>/^index-.*\.js$/.test(p));
const errors=[];
const dom = new JSDOM('<!doctype html><html lang="ru"><body><div id="root"></div></body></html>',{url:'https://example.com/',runScripts:'dangerously',pretendToBeVisual:true});
dom.window.addEventListener('error',event=>errors.push(event.message));
dom.window.eval(readFileSync(`dist/assets/${js}`,'utf8'));
await new Promise(resolve=>setTimeout(resolve,50));
const doc=dom.window.document;
assert.equal(doc.querySelector('h1').textContent,'0n26');
assert.equal(doc.querySelectorAll('.project-card').length,3);
for(const [label,count] of [['Моды',1],['Инструменты',2],['Все проекты',3]]){
 const button=[...doc.querySelectorAll('button')].find(b=>b.textContent.startsWith(label));
 button.click();await new Promise(resolve=>setTimeout(resolve,20));
 assert.equal(button.getAttribute('aria-pressed'),'true');
 assert.equal(doc.querySelectorAll('.project-card').length,count);
 assert.equal(doc.querySelector('[role="status"]').textContent,`Показано: ${count} из 3`);
}
assert.equal(doc.querySelectorAll('main').length,1);
assert.ok(doc.querySelector('a.skip[href="#main"]'));
assert.ok(doc.querySelector('#main'));
for(const img of doc.querySelectorAll('img')) assert.ok(img.hasAttribute('alt'));
for(const a of doc.querySelectorAll('a[href^="https://"]'))assert.ok(a.href.startsWith('https://github.com/0n26'));
const expectedBase=resolveBase({BASE_PATH:process.env.EXPECT_BASE || '/'});
for(const img of doc.querySelectorAll('img')) assert.ok(img.getAttribute('src').startsWith(`${expectedBase}assets/`));
assert.deepEqual(errors,[]);
dom.window.close();
console.log(`PASS production DOM (${expectedBase}): React mount, all filters/counts/pressed state, semantics, image alt, external links, asset base, no runtime errors.`);
