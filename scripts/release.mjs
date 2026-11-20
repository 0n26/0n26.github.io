import { appendFileSync } from 'node:fs';
import { GitHub, Manifest, registerPlugin } from 'release-please';
import { ManifestPlugin } from 'release-please/build/src/plugin.js';

function describeCommit(message) {
  const text = message.replaceAll('\r\n', '\n');
  const newline = text.indexOf('\n');
  if (newline === -1) return '';

  const body = text.slice(newline + 1);
  const section = /^##[ \t]+Изменения[ \t]*$/m.exec(body);
  const description = section
    ? body.slice(section.index + section[0].length).split(/^##[ \t]+/m, 1)[0]
    : body.split(/^##[ \t]+(?:Проверка|Риски)[ \t]*$/m, 1)[0];
  return description
    .split(/^(?:BREAKING[ -]CHANGE|Release-As|Co-authored-by|Signed-off-by|Reviewed-by|Refs|Fixes|Closes)(?::| #)/mi, 1)[0]
    .trim()
    // Release Please reserves HTML details elements for multi-package release notes.
    .replace(/<(?=\/?details\b)/gi, '&lt;');
}

class CommitDetails extends ManifestPlugin {
  async preconfigure(strategies, commitsByPath) {
    for (const [path, { changelogNotes }] of Object.entries(strategies)) {
      const buildNotes = changelogNotes.buildNotes.bind(changelogNotes);
      changelogNotes.buildNotes = async (commits, options) => {
        const messages = new Map(commitsByPath[path].map(({ sha, message }) => [sha, message]));
        const notes = await buildNotes(commits, options);
        // Only extend entries selected by Release Please, using their full commit link.
        return notes.replace(/^\* .+ \(\[[\da-f]+\]\(https?:\/\/[^\s()]+\/commit\/([\da-f]{40})\)\)$/gm, (entry, sha) => {
          const message = messages.get(sha);
          if (!message) return entry;
          messages.delete(sha);
          const details = describeCommit(message);
          return details ? `${entry}\n\n${details.replace(/^(?=.)/gm, '  ')}` : entry;
        });
      };
    }
    return strategies;
  }
}

registerPlugin('commit-details', ({ github, targetBranch, repositoryConfig }) =>
  new CommitDetails(github, targetBranch, repositoryConfig));

if (import.meta.main) {
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');
  const github = await GitHub.create({ owner, repo, token: process.env.GH_TOKEN });
  const loadManifest = () => Manifest.fromManifest(github, github.repository.defaultBranch);

  const releases = await (await loadManifest()).createReleases();
  const release = releases.find((item) => item.path === '.');
  if (release) appendFileSync(process.env.GITHUB_OUTPUT, `tag=${release.tagName}\n`);

  await (await loadManifest()).createPullRequests();
}
