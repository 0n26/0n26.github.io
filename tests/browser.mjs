// First run npm run build and npm run preview. Override TEST_URL for a repo base.
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 const failed=[];page.on('response',r=>{if(r.status()>=400)failed.push(r.url())});
 await page.goto(process.env.TEST_URL || 'http://localhost:4173/',{waitUntil:'networkidle'});
 assert.equal(await page.title(),'0n26 — Код. Инструменты. Моды.');
 assert.equal(await page.locator('h1').innerText(),'0n26');
 assert.equal(await page.locator('.project-card').count(),3);
 assert.equal(await page.locator('html').getAttribute('lang'),'ru');
 await page.keyboard.press('Tab');
 assert.equal(await page.locator('.skip').evaluate(el=>el===document.activeElement),true);
 await page.getByRole('button',{name:'Моды'}).click();
 assert.equal(await page.locator('.project-card').count(),1);
 assert.equal(await page.getByRole('button',{name:'Моды'}).getAttribute('aria-pressed'),'true');
 assert.match(await page.locator('.project-card').innerText(),/Krastorio2Assets/);
 await page.getByRole('button',{name:'Инструменты'}).click();assert.equal(await page.locator('.project-card').count(),2);
 await page.getByRole('button',{name:'Все проекты'}).click();
 await page.evaluate(()=>scrollTo(0,0));
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/desktop.png',fullPage:true});
 for (const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
   assert.equal(await page.locator('img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
   if(width===390)await page.screenshot({path:'test-results/mobile.png',fullPage:true});
 }
 await page.getByRole('button',{name:'Приостановить анимацию робота'}).click();
 assert.equal(await page.locator('.mascot').getAttribute('data-paused'),'true');
 await page.getByRole('button',{name:'Скрыть робота'}).click();
 assert.equal(await page.locator('.mascot').count(),0);
 await page.getByRole('button',{name:'Показать робота 0n26'}).click();
 assert.equal(await page.locator('.mascot').count(),1);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.mascot').getAttribute('data-paused'),'true');
 assert.equal(await page.locator('.mascot').getAttribute('data-face'),'idle');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'auto');
 for(const link of await page.locator('a[href^="https://"]').evaluateAll(els=>els.map(a=>a.href)))assert.ok(link.startsWith('https://github.com/0n26'));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 console.log('PASS: filters, keyboard skip link, project attribution, assets, external links, 320/390/768/1440 layouts, reduced motion, no browser errors.');
} finally {await browser.close();}
