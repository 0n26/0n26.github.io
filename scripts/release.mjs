import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releaseHeading = /^## \[?\d+\.\d+\.\d+\b/m;
const breakingChange = /^BREAKING[ -]CHANGE:[ \t]+(\S[^\r\n]*)/m;
const sections = new Map([
  ['feat', 'Возможности'], ['fix', 'Исправления'], ['perf', 'Производительность'],
  ['revert', 'Отменённые изменения'], ['deps', 'Зависимости'],
]);
const files = ['package.json', 'package-lock.json', 'changelog.md'];

export function nextVersion(base, title, body) {
  const version = versionPattern.exec(base);
  const change = /^(feat|fix|perf|docs|style|refactor|test|build|ci|chore|revert|deps)(?:\([A-Za-z0-9._/-]+\))?(!)?: [^\s].*$/.exec(title);
  if (!version || !change) throw new Error('Некорректная версия или заголовок Conventional Commit.');
  const [major, minor, patch] = version.slice(1).map(Number);
  if (change[2] || breakingChange.test(body)) return `${major + 1}.0.0`;
  if (change[1] === 'feat') return `${major}.${minor + 1}.0`;
  return sections.has(change[1]) ? `${major}.${minor}.${patch + 1}` : base;
}

function firstRelease(changelog) {
  const start = changelog.search(releaseHeading);
  if (start < 0) return { before: changelog, entry: '', after: '' };
  const next = changelog.slice(start + 3).search(releaseHeading);
  const end = next < 0 ? changelog.length : start + 3 + next;
  return { before: changelog.slice(0, start), entry: changelog.slice(start, end), after: changelog.slice(end) };
}

function releaseEntry(repository, base, version, pr) {
  const url = `https://github.com/${repository}`;
  const type = pr.title.match(/^[a-z]+/)[0];
  const subject = pr.title.slice(pr.title.indexOf(':') + 2);
  const body = pr.body ?? '';
  const migration = breakingChange.exec(body)?.[1];
  const describe = [describeBody(body), migration && `**Несовместимость:** ${migration}`].filter(Boolean).join('\n\n');
  const entry = `## [${version}](${url}/compare/v${base}...v${version}) (${pr.created_at.slice(0, 10)})\n\n` +
    `<!-- version-pr: ${pr.number} -->\n\n### ${sections.get(type) ?? 'Несовместимые изменения'}\n\n` +
    `* ${subject} ([#${pr.number}](${url}/pull/${pr.number}))`;
  return describe ? `${entry}\n\n${describe.replace(/^(?=.)/gm, '  ')}` : entry;
}

export function releaseFiles(repository, base, pr, current) {
  const version = nextVersion(base, pr.title, pr.body ?? '');
  const pkg = JSON.parse(current['package.json']);
  const lock = JSON.parse(current['package-lock.json']);
  const changes = {};
  if (pkg.version !== version) {
    pkg.version = version;
    changes['package.json'] = `${JSON.stringify(pkg, null, 2)}\n`;
  }
  if (lock.version !== version || lock.packages[''].version !== version) {
    lock.version = lock.packages[''].version = version;
    changes['package-lock.json'] = `${JSON.stringify(lock, null, 2)}\n`;
  }

  const changelog = current['changelog.md'];
  const { before, entry, after } = firstRelease(changelog);
  const marker = `<!-- version-pr: ${pr.number} -->`;
  const history = entry.split('\n')[2] === marker ? after : entry + after;
  const next = version === base ? '' :
    `${releaseEntry(repository, base, version, pr)}\n\n`;
  const updated = `${before}${next}${history}`.trimEnd() + '\n';
  if (updated !== changelog) changes['changelog.md'] = updated;
  return { version, changes };
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

function command(executable, args, input) {
  return execFileSync(executable, args, { encoding: 'utf8', input, maxBuffer: 8 * 1024 * 1024 });
}

function git(...args) {
  return command('git', args).trimEnd();
}

function github(...args) {
  return command('gh', ['api', ...args]);
}

function gitVersion(ref) {
  return JSON.parse(git('show', `${ref}:package.json`)).version;
}

function verify(repository, pr) {
  const current = Object.fromEntries(files.map((file) => [file, readFileSync(file, 'utf8')]));
  const { version, changes } = releaseFiles(repository, gitVersion(pr.base.sha), pr, current);
  const pending = Object.keys(changes);
  if (pending.length) {
    console.error(`Для ${version} нужно обновить ${pending.join(', ')}. Бот обновит ветку PR после успешных тестов.`);
    process.exitCode = 1;
  }
}

export function verifiedRequest(run, jobs, pr, repository) {
  const request = run.pull_requests.find(({ number }) => number === pr.number);
  const steps = jobs.find(({ name }) => name === 'verify')?.steps ?? [];
  return run.event === 'pull_request' && run.path === '.github/workflows/ci.yml' &&
    run.conclusion === 'failure' && run.head_sha === pr.head.sha && request?.base.sha === pr.base.sha &&
    steps.some(({ name, conclusion }) => name === 'Run all checks' && conclusion === 'success') &&
    steps.some(({ name, conclusion }) => name === 'Verify release files' && conclusion === 'failure') &&
    pr.state === 'open' && !pr.draft && pr.base.ref === 'main' && pr.head.ref !== 'main' &&
    pr.base.repo.full_name === repository && pr.head.repo?.full_name === repository;
}

function prepare(repository, run) {
  const [request] = run.pull_requests;
  if (!request || run.pull_requests.length !== 1) return;
  const api = `repos/${repository}`;
  const pr = JSON.parse(github(`${api}/pulls/${request.number}`));
  const { jobs } = JSON.parse(github(`${api}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`));
  if (!verifiedRequest(run, jobs, pr, repository)) return;
  const { status } = JSON.parse(github(`${api}/compare/${pr.base.sha}...${pr.head.sha}`, '--jq', '{status}'));
  if (status !== 'ahead') {
    console.log('Обновите ветку PR из main, чтобы пересчитать версию.');
    return;
  }
  const content = (file, sha) => {
    const response = JSON.parse(github(`${api}/contents/${file}?ref=${sha}`));
    return Buffer.from(response.content, 'base64').toString('utf8');
  };
  const base = JSON.parse(content('package.json', pr.base.sha)).version;
  const current = Object.fromEntries(files.map((file) => [file, content(file, pr.head.sha)]));
  const { version, changes } = releaseFiles(repository, base, pr, current);
  const additions = Object.entries(changes).map(([path, text]) => ({
    path, contents: Buffer.from(text).toString('base64'),
  }));
  if (!additions.length) return;
  writeFileSync(join(process.env.RUNNER_TEMP, 'version-commit.json'), JSON.stringify({
    query: 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
    variables: { input: {
      branch: { repositoryNameWithOwner: repository, branchName: pr.head.ref },
      expectedHeadOid: pr.head.sha,
      message: { headline: `chore(release): синхронизировать версию ${version}` },
      fileChanges: { additions },
    } },
  }));
  appendFileSync(process.env.GITHUB_OUTPUT, 'pending=true\n');
}

function publish() {
  const latest = command('gh', ['release', 'view', '--json', 'tagName', '--jq', '.tagName']).trim();
  if (!latest.startsWith('v') || !versionPattern.test(latest.slice(1))) throw new Error(`Неизвестный тег релиза: ${latest}`);
  let version = latest.slice(1);
  let tag;
  const revisions = git('log', '--first-parent', '--reverse', '--format=%H', `${latest}..HEAD`, '--', 'package.json');
  for (const sha of revisions ? revisions.split('\n') : []) {
    const next = gitVersion(sha);
    if (next === version) continue;
    const [title, ...lines] = git('show', '-s', '--format=%s%n%b', sha).split('\n');
    if (nextVersion(version, title, lines.join('\n')) !== next) {
      throw new Error(`Версия ${next} не совпадает с сообщением squash-коммита ${sha}.`);
    }
    const { entry } = firstRelease(git('show', `${sha}:changelog.md`));
    if (!versionPattern.test(next) || !entry.startsWith(`## [${next}]`)) {
      throw new Error(`Для ${sha} нет заметок версии ${next}.`);
    }
    tag = `v${next}`;
    command('gh', ['release', 'create', tag, '--target', sha, '--title', tag, '--notes-file', '-'], entry.trimEnd());
    version = next;
  }
  if (tag) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
}

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY;
  switch (process.argv[2]) {
    case 'verify':
      verify(repository, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).pull_request);
      break;
    case 'prepare':
      prepare(repository, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).workflow_run);
      break;
    case 'publish':
      publish();
      break;
    default:
      throw new Error('Укажите verify, prepare или publish.');
  }
}
