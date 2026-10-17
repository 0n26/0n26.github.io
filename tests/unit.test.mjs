import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolveBase } from '../src/base.js';
import { projects, filterProjects, filters } from '../src/data.js';
test('base path: local, user, project, custom domain, explicit override', () => {
  assert.equal(resolveBase({}), '/');
  assert.equal(resolveBase({GITHUB_REPOSITORY:'0n26/0n26.github.io'}), '/');
  assert.equal(resolveBase({GITHUB_REPOSITORY:'0n26/portfolio'}), '/portfolio/');
  assert.equal(resolveBase({GITHUB_REPOSITORY:'0n26/portfolio',BASE_PATH:''}), '/');
  assert.equal(resolveBase({BASE_PATH:'/portfolio/'}), '/portfolio/');
  assert.equal(resolveBase({BASE_PATH:'portfolio'}), '/portfolio/');
  assert.throws(() => resolveBase({BASE_PATH:'https://example.com'}));
  assert.throws(() => resolveBase({BASE_PATH:'../bad'}));
});
test('filters preserve stable project identity', () => {
  assert.equal(filterProjects('all').length,3);
  assert.deepEqual(filterProjects('tools').map(p=>p.id),['brik','vs-bansos']);
  assert.deepEqual(filterProjects('mods').map(p=>p.id),['k2-port']);
  assert.deepEqual(filterProjects('unknown'),[]);
});
test('every card has a local asset, unique ID and direct verified GitHub URL', () => {
  assert.equal(new Set(projects.map(p=>p.id)).size,projects.length);
  for (const p of projects) {
    assert.ok(existsSync(new URL(`../public/assets/${p.art}`,import.meta.url)));
    assert.equal(p.url,`https://github.com/0n26/${p.id}`);
    assert.ok(filters.some(f=>f.id===p.category));
    assert.ok(p.description && p.tags.length && p.note);
  }
  assert.match(projects.find(p=>p.id==='k2-port').note,/Krastorio2Assets/);
});
