#!/usr/bin/env node
/**
 * Mirror every Gitea repo to a GitHub repo, so commits made on the
 * self-hosted instance show up on the GitHub contribution graph.
 *
 * Your tokens stay in your shell. Nothing is printed except a redacted summary.
 *
 *   GITEA_URL=https://git.sn1p.win \
 *   GITEA_TOKEN=xxx GITHUB_USER=sn1prust GITHUB_TOKEN=xxx \
 *   node gitea-to-github.mjs [--dry-run] [--public] [--only repo1,repo2]
 *
 * Needs Node 18+ (you have 22).
 */

const env = (k, d) => process.env[k] ?? d;
const argv = process.argv.slice(2);
const has = f => argv.includes(f);
const opt = f => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const GITEA_URL    = env('GITEA_URL', 'https://git.sn1p.win').replace(/\/+$/, '');
const GITEA_TOKEN  = env('GITEA_TOKEN');
const GITHUB_USER  = env('GITHUB_USER');
const GITHUB_TOKEN = env('GITHUB_TOKEN');
const INTERVAL     = env('INTERVAL', '8h');
const DRY          = has('--dry-run');
const PRIVATE      = !has('--public');
const ONLY         = (opt('--only') || '').split(',').map(s => s.trim()).filter(Boolean);

for (const [k, v] of Object.entries({ GITEA_TOKEN, GITHUB_USER, GITHUB_TOKEN })) {
  if (!v) { console.error('Missing ' + k + '. See the header of this file.'); process.exit(1); }
}

const gitea = (p, init = {}) => fetch(GITEA_URL + '/api/v1' + p, {
  ...init,
  headers: { Authorization: 'token ' + GITEA_TOKEN, 'Content-Type': 'application/json', ...(init.headers || {}) },
});

const github = (p, init = {}) => fetch('https://api.github.com' + p, {
  ...init,
  headers: {
    Authorization: 'Bearer ' + GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gitea-mirror-setup',
    ...(init.headers || {}),
  },
});

// A commit only earns a green square if GitHub can tie the author email to your account.
const countsOnGitHub = e =>
  /@users\.noreply\.github\.com$/i.test(e) || !/@noreply\./i.test(e);

async function allGiteaRepos() {
  const out = [];
  for (let page = 1; ; page++) {
    const r = await gitea('/user/repos?limit=50&page=' + page);
    if (!r.ok) throw new Error('Gitea /user/repos -> ' + r.status + ' ' + (await r.text()).slice(0, 160));
    const batch = await r.json();
    out.push(...batch);
    if (batch.length < 50) break;
  }
  return out;
}

async function ensureGithubRepo(name) {
  const probe = await github('/repos/' + GITHUB_USER + '/' + name);
  if (probe.ok) {
    const j = await probe.json();
    if (j.fork) return { ok: false, why: 'it is a fork on GitHub, and forks never count toward the graph' };
    return { ok: true, created: false };
  }
  if (probe.status !== 404) return { ok: false, why: 'GitHub lookup returned ' + probe.status };
  if (DRY) return { ok: true, created: true };

  // auto_init stays false: a push mirror force-pushes, so a README here would be clobbered.
  const mk = await github('/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name,
      private: PRIVATE,
      auto_init: false,
      description: 'Mirror of ' + GITEA_URL + '/' + name,
      has_issues: false, has_wiki: false, has_projects: false,
    }),
  });
  if (!mk.ok) return { ok: false, why: 'could not create GitHub repo (' + mk.status + ': ' + (await mk.text()).slice(0, 140) + ')' };
  return { ok: true, created: true };
}

async function ensurePushMirror(owner, name) {
  const remote = 'https://github.com/' + GITHUB_USER + '/' + name + '.git';
  const norm = s => (s || '').replace(/\.git$/, '').toLowerCase();

  const list = await gitea('/repos/' + owner + '/' + name + '/push_mirrors');
  if (list.ok) {
    const existing = await list.json();
    if (Array.isArray(existing) && existing.some(m => norm(m.remote_address) === norm(remote))) {
      return { ok: true, already: true };
    }
  }
  if (DRY) return { ok: true };

  const mk = await gitea('/repos/' + owner + '/' + name + '/push_mirrors', {
    method: 'POST',
    body: JSON.stringify({
      remote_address: remote,
      remote_username: GITHUB_USER,
      remote_password: GITHUB_TOKEN,   // Gitea stores this; it is never logged here
      interval: INTERVAL,
      sync_on_commit: true,
    }),
  });
  if (!mk.ok) return { ok: false, why: 'Gitea refused the mirror (' + mk.status + ': ' + (await mk.text()).slice(0, 140) + ')' };

  // kick off the first sync straight away rather than waiting for the interval
  await gitea('/repos/' + owner + '/' + name + '/push_mirrors-sync', { method: 'POST' }).catch(() => {});
  return { ok: true };
}

async function authorEmails(owner, name) {
  try {
    const r = await gitea('/repos/' + owner + '/' + name + '/commits?limit=50');
    if (!r.ok) return [];
    const commits = await r.json();
    if (!Array.isArray(commits)) return [];
    return [...new Set(commits.map(c => c && c.commit && c.commit.author && c.commit.author.email).filter(Boolean))];
  } catch { return []; }
}

(async () => {
  const me = await gitea('/user');
  if (!me.ok) { console.error('Gitea token rejected (' + me.status + ').'); process.exit(1); }
  const giteaUser = (await me.json()).login;

  const ghMe = await github('/user');
  if (!ghMe.ok) { console.error('GitHub token rejected (' + ghMe.status + ').'); process.exit(1); }
  const ghLogin = (await ghMe.json()).login;
  if (ghLogin.toLowerCase() !== GITHUB_USER.toLowerCase()) {
    console.error('GITHUB_USER is "' + GITHUB_USER + '" but the token belongs to "' + ghLogin + '".');
    process.exit(1);
  }

  console.log('Gitea   ' + GITEA_URL + '  as ' + giteaUser);
  console.log('GitHub  github.com/' + ghLogin + '  (new repos: ' + (PRIVATE ? 'private' : 'public') + ')');
  if (DRY) console.log('\nDRY RUN - nothing will be changed.');

  let repos = (await allGiteaRepos()).filter(r => r.owner && r.owner.login === giteaUser);
  if (ONLY.length) repos = repos.filter(r => ONLY.includes(r.name));
  if (!repos.length) { console.log('\nNo repositories found on Gitea for this account.'); return; }

  const badEmails = new Set();
  const rows = [];

  for (const r of repos) {
    if (r.empty)  { rows.push([r.name, 'skipped', 'repo is empty']); continue; }
    if (r.mirror) { rows.push([r.name, 'skipped', 'this is a pull mirror of something else']); continue; }

    for (const e of await authorEmails(giteaUser, r.name)) {
      if (!countsOnGitHub(e)) badEmails.add(e);
    }

    const gh = await ensureGithubRepo(r.name);
    if (!gh.ok) { rows.push([r.name, 'FAILED', gh.why]); continue; }

    const pm = await ensurePushMirror(giteaUser, r.name);
    if (!pm.ok) { rows.push([r.name, 'FAILED', pm.why]); continue; }

    rows.push([
      r.name,
      DRY ? 'would set up' : pm.already ? 'already mirrored' : 'mirroring',
      'github.com/' + ghLogin + '/' + r.name + (gh.created ? '  (repo created)' : ''),
    ]);
  }

  const w = Math.max(4, ...rows.map(r => r[0].length));
  console.log('\n' + 'REPO'.padEnd(w) + '  STATUS            DETAIL');
  for (const [a, b, c] of rows) console.log(a.padEnd(w) + '  ' + b.padEnd(16) + '  ' + c);

  if (badEmails.size) {
    console.log('\n!  These commit author emails will NOT count on GitHub:');
    for (const e of badEmails) console.log('     ' + e);
    console.log('   GitHub counts a commit only when the author email belongs to your account.');
    console.log('   Fix for future commits:');
    console.log('     git config --global user.email "' + ghLogin + '@users.noreply.github.com"');
    console.log('   and set the same address in Gitea under Settings -> Account.');
    console.log('   Commits already made keep their old email and will not backfill.');
  }

  console.log('\nIf the GitHub repos are private, also turn on');
  console.log('  github.com/settings/profile -> "Include private contributions on my profile".');
})().catch(e => { console.error('Failed: ' + e.message); process.exit(1); });
