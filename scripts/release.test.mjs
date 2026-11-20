import { expect, it } from 'vitest';
import { nextVersion, releaseFiles, verifiedRequest } from './release.mjs';

const repository = 'example/site';

it.each([
  ['feat(player): изменить меню', '', '0.7.0'],
  ['fix: вернуть звук', '', '0.6.1'],
  ['perf: ускорить поиск', '', '0.6.1'],
  ['docs!: удалить старый интерфейс', '', '1.0.0'],
  ['fix: изменить формат', 'BREAKING CHANGE: старый формат не поддерживается', '1.0.0'],
  ['docs: обновить правила', '', '0.6.0'],
])('calculates the version for %s', (title, body, version) => {
  expect(nextVersion('0.6.0', title, body)).toBe(version);
});

it('updates both npm versions and rewrites its own release notes without losing history', () => {
  const original = {
    'package.json': '{"version":"0.6.0"}',
    'package-lock.json': '{"version":"0.6.0","packages":{"":{"version":"0.6.0"}}}',
    'changelog.md': '# Changelog\n\n## 0.6.0 (2026-11-19)\n\nПредыдущая запись.\n',
  };
  const pr = {
    number: 17, created_at: '2026-11-20T12:00:00Z', title: 'fix(player): вернуть звук',
    body: '## Изменения\n\n- Звук сохраняется после паузы.\n\n## Проверка\n\nОтчёт CI.\n',
  };
  const { changes } = releaseFiles(repository, '0.6.0', pr, original);
  expect(JSON.parse(changes['package.json']).version).toBe('0.6.1');
  const lock = JSON.parse(changes['package-lock.json']);
  expect([lock.version, lock.packages[''].version]).toEqual(['0.6.1', '0.6.1']);
  const journal = changes['changelog.md'];
  expect(journal).toContain('https://github.com/example/site/compare/v0.6.0...v0.6.1');
  expect(journal).toContain('https://github.com/example/site/pull/17');
  expect(journal).toContain('\n  - Звук сохраняется после паузы.');
  expect(journal).not.toContain('Отчёт CI');
  expect(journal).toContain('## 0.6.0 (2026-11-19)\n\nПредыдущая запись.');

  expect(releaseFiles(repository, '0.6.0', pr, changes).changes).toEqual({});
  const edited = releaseFiles(repository, '0.6.0', { ...pr, body: 'Звук не сбрасывается.' }, changes);
  expect(edited.changes['changelog.md']).toContain('Звук не сбрасывается.');
  expect(edited.changes['changelog.md']).not.toContain('Звук сохраняется после паузы.');

  const docs = releaseFiles(repository, '0.6.0', { ...pr, title: 'docs: уточнить инструкцию' }, changes);
  expect(JSON.parse(docs.changes['package.json']).version).toBe('0.6.0');
  expect(docs.changes['changelog.md']).toBe(original['changelog.md']);
});

it('allows the bot after a release file mismatch, before tests run on the current internal PR head', () => {
  const repo = { full_name: repository };
  const base = { ref: 'main', sha: 'base', repo };
  const head = { ref: 'fix/sound', sha: 'head', repo };
  const pr = { number: 17, state: 'open', draft: false, base, head };
  const run = {
    event: 'pull_request', path: '.github/workflows/ci.yml', conclusion: 'failure',
    head_sha: 'head', pull_requests: [{ number: 17, base, head }],
  };
  const jobs = [{ name: 'verify', steps: [
    { name: 'Run all checks', conclusion: 'skipped' },
    { name: 'Verify release files', conclusion: 'failure' },
  ] }];
  expect(verifiedRequest(run, jobs, pr, repository)).toBe(true);
  expect(verifiedRequest(run, [{ name: 'verify', steps: [
    { name: 'Run all checks', conclusion: 'failure' },
    { name: 'Verify release files', conclusion: 'skipped' },
  ] }], pr, repository)).toBe(false);
  expect(verifiedRequest(run, [{ name: 'verify', steps: [
    { name: 'Run all checks', conclusion: 'success' },
    { name: 'Verify release files', conclusion: 'failure' },
  ] }], pr, repository)).toBe(false);
  expect(verifiedRequest(run, jobs, { ...pr, head: { ...head, sha: 'new' } }, repository)).toBe(false);
  expect(verifiedRequest(run, jobs, { ...pr, base: { ...base, sha: 'new' } }, repository)).toBe(false);
  expect(verifiedRequest(run, jobs, { ...pr, head: { ...head, repo: { full_name: 'fork/site' } } }, repository)).toBe(false);
});
