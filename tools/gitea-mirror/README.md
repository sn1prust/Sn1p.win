# gitea-mirror

Copies every repo on [git.sn1p.win](https://git.sn1p.win) to a matching GitHub repo, so work done on the self-hosted Gitea shows up on the GitHub contribution graph.

It sets up a Gitea **push mirror** per repo. After that Gitea does the copying itself: on every push, and again every 8 hours. Re-run the script only when you make a new repo; it skips ones already mirrored.

## Run

Needs Node 18+ and two tokens you create yourself:

- **GitHub**: fine-grained, all repositories, *Administration* and *Contents* read and write (or classic with `repo`).
- **Gitea**: Settings → Applications, scopes `write:repository` and `read:user`.

```
GITEA_TOKEN=xxx GITHUB_USER=sn1prust GITHUB_TOKEN=xxx node gitea-to-github.mjs --dry-run
```

Drop `--dry-run` to apply. `--public` makes new GitHub repos public (default private). `--only a,b` limits it to some repos.

## Why squares might not appear

GitHub counts a commit only if its author email belongs to your GitHub account, it's on the default branch, and the repo is not a fork. The script warns about commit emails that won't count. Set yours with:

```
git config --global user.email "sn1prust@users.noreply.github.com"
```

For private mirrors, turn on *Include private contributions on my profile* in GitHub settings.
