import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releaseHeading = /^## \[?\d+\.\d+\.\d+\b/m;
const breakingChange = /^BREAKING[ -]CHANGE:[ \t]+(\S[^\r\n]*)/m;
const sections = new Map([
  ['feat', 'Возможности'], ['fix', 'Исправления'], ['perf', 'Производительность'],
  ['revert', 'Отменённые изменения'], ['deps', 'Зависимости'],
]);

export function nextVersion(base, title, body) {
  const version = versionPattern.exec(base);
  const change = /^(feat|fix|perf|docs|style|refactor|test|build|ci|chore|revert|deps)(?:\([A-Za-z0-9._/-]+\))?(!)?: [^\s].*$/.exec(title);
  if (!version || !change) throw new Error('Некорректная версия или заголовок Conventional Commit.');
  const [major, minor, patch] = version.slice(1).map(Number);
  if (change[2] || breakingChange.test(body)) return `${major + 1}.0.0`;
  if (change[1] === 'feat') return `${major}.${minor + 1}.0`;
  return sections.has(change[1]) ? `${major}.${minor}.${patch + 1}` : base;
}

function releaseEntry(repository, base, version, { title, body, date, number }) {
  const url = `https://github.com/${repository}`;
  const type = title.match(/^[a-z]+/)[0];
  const subject = title.slice(title.indexOf(':') + 2);
  const migration = breakingChange.exec(body)?.[1];
  const describe = [describeBody(body), migration && `**Несовместимость:** ${migration}`].filter(Boolean).join('\n\n');
  const entry = `## [${version}](${url}/compare/v${base}...v${version}) (${date.slice(0, 10)})\n\n` +
    `### ${sections.get(type) ?? 'Несовместимые изменения'}\n\n` +
    `* ${subject} ([#${number}](${url}/pull/${number}))`;
  return describe ? `${entry}\n\n${describe.replace(/^(?=.)/gm, '  ')}` : entry;
}

function metadata(read, version, changelog) {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  pkg.version = lock.version = lock.packages[''].version = version;
  return {
    'package.json': `${JSON.stringify(pkg, null, 2)}\n`,
    'package-lock.json': `${JSON.stringify(lock, null, 2)}\n`,
    'changelog.md': changelog,
  };
}

function describeBody(message) {
  const body = message.replaceAll('\r\n', '\n');
  const section = /^##[ \t]+Изменения[ \t]*$/m.exec(body);
  const description = section
    ? body.slice(section.index + section[0].length).split(/^##[ \t]+/m, 1)[0]
    : body.split(/^##[ \t]+(?:Проверка|Риски)[ \t]*$/m, 1)[0];
  return description
    .split(/^(?:BREAKING[ -]CHANGE|Release-As|Co-authored-by|Signed-off-by|Reviewed-by|Refs|Fixes|Closes)(?::| #)/mi, 1)[0]
    .trim();
}

function command(executable, args, options) {
  return execFileSync(executable, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
}

function git(...args) {
  return command('git', args).trimEnd();
}

function tagVersion(tag) {
  if (!tag?.startsWith('v') || !versionPattern.test(tag.slice(1))) throw new Error(`Неизвестный тег релиза: ${tag}`);
  return tag.slice(1);
}

function snapshot(tag, source, date, files) {
  const temp = mkdtempSync(join(tmpdir(), 'release-index-'));
  try {
    // Build the tag tree without staging changes or touching main's checkout.
    const env = { ...process.env, GIT_INDEX_FILE: join(temp, 'index') };
    const index = (...args) => command('git', args, { env }).trim();
    index('read-tree', source);
    for (const [file, content] of Object.entries(files)) {
      const blob = command('git', ['hash-object', '-w', '--stdin'], { input: content }).trim();
      index('update-index', '--cacheinfo', `100644,${blob},${file}`);
    }
    return command('git', ['commit-tree', index('write-tree'), '-p', source, '-m', `Release snapshot: ${tag}`], {
      env: {
        ...env,
        GIT_AUTHOR_NAME: 'github-actions[bot]', GIT_AUTHOR_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
        GIT_COMMITTER_NAME: 'github-actions[bot]', GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
        GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date,
      },
    }).trim();
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function publish(repository) {
  let tag = command('gh', ['release', 'view', '--json', 'tagName', '--jq', '.tagName']).trim();
  let version = tagVersion(tag);
  const ref = `refs/tags/${tag}`;
  const source = git('show', '-s', '--format=%s', ref) === `Release snapshot: ${tag}` ? `${ref}^` : ref;
  git('merge-base', '--is-ancestor', source, 'HEAD');
  let changelog = git('show', `${ref}:changelog.md`) + '\n';
  const revisions = git('rev-list', '--first-parent', '--reverse', `${source}..HEAD`);
  for (const sha of revisions ? revisions.split('\n') : []) {
    const [subject, date, ...lines] = git('show', '-s', '--format=%s%n%cI%n%b', sha).split('\n');
    const pr = /^(.*) \(#([1-9]\d*)\)$/.exec(subject);
    const title = pr?.[1] ?? subject;
    const body = lines.join('\n');
    const next = nextVersion(version, title, body);
    if (next === version) continue;
    if (!pr) throw new Error(`В сообщении squash-коммита ${sha} нет номера PR.`);

    const entry = releaseEntry(repository, version, next, { title, body, date, number: pr[2] });
    const start = changelog.search(releaseHeading);
    if (start < 0) throw new Error(`В теге ${tag} нет истории релизов.`);
    changelog = `${changelog.slice(0, start)}${entry}\n\n${changelog.slice(start)}`;
    tag = `v${next}`;
    const commit = snapshot(tag, sha, date, metadata((file) => git('show', `${sha}:${file}`), next, changelog));
    git('-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', 'push', 'origin', `${commit}:refs/tags/${tag}`);
    command('gh', ['release', 'create', tag, '--verify-tag', '--latest', '--title', tag, '--notes-file', '-'], { input: entry });
    version = next;
  }
  appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
}

function materialize(tag) {
  const version = tagVersion(tag);
  const changelog = git('show', `refs/tags/${tag}:changelog.md`) + '\n';
  for (const [file, content] of Object.entries(metadata((file) => readFileSync(file, 'utf8'), version, changelog))) {
    writeFileSync(file, content);
  }
}

if (import.meta.main) {
  const [, , mode, tag] = process.argv;
  switch (mode) {
    case 'materialize':
      materialize(tag);
      break;
    case 'publish':
      publish(process.env.GITHUB_REPOSITORY);
      break;
    default:
      throw new Error('Укажите publish или materialize <tag>.');
  }
}
