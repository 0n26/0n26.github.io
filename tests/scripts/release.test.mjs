import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { nextVersion } from '../../scripts/release.mjs';

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

it('includes intermediate commits once, preserves reviewed history, and keeps the latest metadata on a non-release deploy', () => {
  const temp = mkdtempSync(join(tmpdir(), 'release-test-'));
  try {
    const cwd = join(temp, 'site');
    const remote = join(temp, 'remote.git');
    const bin = join(temp, 'bin');
    const output = join(temp, 'output');
    const script = fileURLToPath(new URL('../../scripts/release.mjs', import.meta.url));
    mkdirSync(cwd);
    mkdirSync(bin);
    writeFileSync(join(temp, 'latest'), 'v0.7.0');
    writeFileSync(join(bin, 'gh'), `#!/bin/sh
set -eu
case "$1 $2" in
  'release view') cat "$RELEASE_TEST/latest" ;;
  'release create')
    git --git-dir="$RELEASE_TEST/remote.git" show-ref --verify "refs/tags/$3" >/dev/null
    cat > "$RELEASE_TEST/$3.md"
    printf '%s' "$3" > "$RELEASE_TEST/latest"
    printf '%s\\n' "$3" >> "$RELEASE_TEST/published"
    ;;
  *) exit 1 ;;
esac
`, { mode: 0o700 });
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, RELEASE_TEST: temp,
      GITHUB_REPOSITORY: repository, GITHUB_OUTPUT: output };
    const run = (command, ...args) => execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
    const git = (...args) => run('git', ...args);
    const release = (...args) => run(process.execPath, script, ...args);
    const put = (file, text) => writeFileSync(join(cwd, file), text);
    const commit = (title, body, ...args) => git('commit', '--quiet', '--no-gpg-sign', '-m', title, '-m', body, ...args);

    git('init', '--quiet', '-b', 'main');
    git('init', '--quiet', '--bare', remote);
    git('remote', 'add', 'origin', remote);
    git('config', 'user.name', 'Test');
    git('config', 'user.email', 'test@example.com');
    put('package.json', '{"name":"site","version":"0.7.0"}\n');
    put('package-lock.json', '{"version":"0.7.0","packages":{"":{"version":"0.7.0"}}}\n');
    put('changelog.md', '# Changelog\n\n## 0.7.0 (2026-11-20)\n\nПредыдущая запись.\n');
    git('add', '.');
    commit('chore: initialize', '');
    git('tag', 'v0.7.0');
    git('push', '--quiet', 'origin', 'main', 'v0.7.0');

    put('changelog.md', '# Changelog\n\n## 0.7.0 (2026-11-20)\n\nДополненная история.\n');
    git('add', 'changelog.md');
    commit('docs: дополнить историю (#20)', '');
    commit('docs(changelog): синхронизировать историю релизов (#21)',
      'Копия changelog.md из тега v0.7.0. Без повышения версии.', '--allow-empty');
    commit('refactor: разделить адаптеры', 'Общий каталог не знает об API источников.', '--allow-empty');
    const refactor = git('rev-parse', 'HEAD');
    put('feature.txt', 'fork contribution\n');
    git('add', 'feature.txt');
    commit('feat(catalog): выдача из форка (#22)', '## Изменения\n\nПохожее в карточке.\n\n## Проверка\n\nОтчёт CI.');
    const merged = git('rev-parse', 'HEAD');
    commit('ci(catalog): сохранить снимок (#23)', 'Снимок публикуется по расписанию.', '--allow-empty');
    commit('fix(catalog): сопоставить названия (#24)', '', '--allow-empty');
    const latest = git('rev-parse', 'HEAD');
    release('publish');
    expect(git('rev-parse', 'HEAD')).toBe(latest);
    expect(git('status', '--porcelain')).toBe('');
    git('fetch', '--quiet', '--tags', 'origin');
    expect(git('rev-parse', 'v0.8.0^')).toBe(merged);
    expect(git('show', 'v0.8.0:feature.txt')).toBe('fork contribution');
    expect(JSON.parse(git('show', 'v0.8.0:package.json')).version).toBe('0.8.0');
    expect(git('rev-parse', 'v0.8.1^')).toBe(latest);
    const notes = readFileSync(join(temp, 'v0.8.0.md'), 'utf8');
    expect(notes).toContain('https://github.com/example/site/pull/22');
    expect(notes).toContain('Похожее в карточке.');
    expect(notes).toContain('https://github.com/example/site/pull/20');
    expect(notes).toContain(`/commit/${refactor}`);
    expect(notes).toContain('Общий каталог не знает об API источников.');
    expect(notes).not.toMatch(/Отчёт CI|Дополненная история|Без повышения версии|сохранить снимок/);
    const patchNotes = readFileSync(join(temp, 'v0.8.1.md'), 'utf8');
    expect(patchNotes).toContain('https://github.com/example/site/pull/23');
    expect(patchNotes).toContain('https://github.com/example/site/pull/24');
    expect(patchNotes).not.toContain('разделить адаптеры');

    put('package.json', '{"name":"site","version":"0.7.0","description":"new docs"}\n');
    put('package-lock.json', '{"version":"0.7.0","packages":{"":{"version":"0.7.0"},"node_modules/added":{"version":"1.0.0"}}}\n');
    git('add', 'package.json', 'package-lock.json');
    commit('docs: документация (#25)', '');
    release('publish');
    expect(readFileSync(join(temp, 'published'), 'utf8')).toBe('v0.8.0\nv0.8.1\n');
    expect(readFileSync(output, 'utf8')).toBe('tag=v0.8.1\ntag=v0.8.1\n');

    release('materialize', 'v0.8.1');
    const json = (file) => JSON.parse(readFileSync(join(cwd, file), 'utf8'));
    const lock = json('package-lock.json');
    expect(json('package.json')).toMatchObject({ version: '0.8.1', description: 'new docs' });
    expect([lock.version, lock.packages[''].version, lock.packages['node_modules/added'].version]).toEqual(['0.8.1', '0.8.1', '1.0.0']);
    const changelog = readFileSync(join(cwd, 'changelog.md'), 'utf8');
    expect(changelog).toContain('Дополненная история.');
    expect(changelog).toContain(notes);
    expect(changelog).toContain(patchNotes);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}, 30_000);
