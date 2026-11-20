import { Manifest } from 'release-please';
import { expect, it } from 'vitest';
import config from '../release-please-config.json';
import './release.mjs';

it('publishes commit descriptions in the release PR, changelog, and GitHub Release', async () => {
  const previous = { sha: '0'.repeat(40), tagName: 'v0.5.0', name: 'v0.5.0' };
  const commits = [
    {
      sha: '1'.repeat(40),
      message: [
        'feat(catalog): обновить каталог (#21)', '',
        '## Изменения', '',
        'Каталог показывает новые серии.', '', '- Открыть серию можно из выдачи.', '',
        '## Проверка', '', 'Служебный отчёт CI.', '',
        '## Риски', '', 'Служебное примечание.',
      ].join('\n'),
    },
    {
      sha: '2'.repeat(40),
      message: 'fix(player): вернуть звук\r\n\r\nЗвук сохраняется после паузы.\r\n\r\nCo-authored-by: Author <author@example.com>',
    },
    { sha: '3'.repeat(40), message: 'fix: исправить название' },
    { sha: '4'.repeat(40), message: 'docs: обновить правила\n\nНе входит в релиз.' },
  ];
  let merged;
  const github = {
    repository: { owner: 'example', repo: 'site', defaultBranch: 'main' },
    async getFileJson(path) {
      return { 'release-please-config.json': config, '.release-please-manifest.json': { '.': '0.5.0' } }[path];
    },
    async getFileContentsOnBranch() {
      return { parsedContent: '{"name":"site","version":"0.5.0"}' };
    },
    async *releaseIterator() { yield previous; },
    async *mergeCommitIterator() {
      for (const commit of commits) yield { ...commit, files: ['src/app/App.tsx'] };
      yield previous;
    },
    async *pullRequestIterator() { yield merged; },
  };
  const manifest = await Manifest.fromManifest(github, 'main');
  const [pr] = await manifest.buildPullRequests();
  const notes = pr.body.releaseData[0].notes;
  const repository = 'https://github.com/example/site';
  expect(notes).toContain(`${repository}/compare/v0.5.0...v0.6.0`);
  expect(notes).toContain(`${repository}/commit/${commits[0].sha}))\n\n  Каталог показывает новые серии.\n\n  - Открыть серию можно из выдачи.`);
  expect(notes).toContain(`${repository}/commit/${commits[1].sha}))\n\n  Звук сохраняется после паузы.`);
  expect(notes).toContain('исправить название');
  expect(notes).not.toMatch(/Служебн|Co-authored-by|Не входит в релиз/);

  const history = '# Changelog\n\n## 0.5.0 (2026-11-20)\n\nПредыдущая запись.\n';
  const changelog = pr.updates.find(({ path }) => path === 'changelog.md').updater.updateContent(history);
  expect(changelog).toContain(`${notes}\n\n## 0.5.0 (2026-11-20)\n\nПредыдущая запись.`);

  merged = {
    number: 22, sha: '5'.repeat(40), title: pr.title.toString(), body: pr.body.toString(),
    labels: pr.labels, headBranchName: pr.headRefName,
  };
  const [release] = await manifest.buildReleases();
  expect(release.tag.toString()).toBe('v0.6.0');
  expect(release.notes).toBe(notes);
});
