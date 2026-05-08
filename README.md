# prkit

CLI for creating GitHub pull requests from ticket context.

## Requirements

- Node.js 22+ with `pnpm`
- `gh` installed and authenticated against GitHub
- [schpet/linear-cli](https://github.com/schpet/linear-cli) installed and authenticated for ticket lookup
- Run `prkit` inside a git repository with an `origin` remote that points to GitHub
- Push the current branch before running a real non-interactive PR create

Authenticate Linear before using `prkit`:

```sh
linear auth login
```

## Configuration

`prkit` loads config from the first matching file in each location:

- `.prkit.yml` or `.prkit.yaml` in the repository root
- `~/.config/prkit/config.yml` or `~/.config/prkit/config.yaml`

Repo-local values override global values.

Minimum required config:

```yaml
ticketBranchPattern: "^feature/(ENG-\\d+)-"
baseBranch: main
```

Full example:

```yaml
ticketProvider: linear
ticketBranchPattern: "^feature/(ENG-\\d+)-"
baseBranch: main
titleFormat: "{id}: {title}"
descriptionTemplatePath: .github/pull_request_template.md
defaultReviewers:
  - alice
  - bob
reviewerRules:
  - pattern: "src/cli/**"
    reviewers:
      - carol
draftByDefault: false
assignToCurrentUser: true
```

Field reference:

- `ticketProvider`: currently only `linear`
- `ticketBranchPattern`: regex with one capture group used to extract the ticket ID from the branch name
- `baseBranch`: default target branch for the PR
- `titleFormat`: optional PR title template
- `descriptionTemplatePath`: optional path to a PR body template
- `defaultReviewers`: reviewers always requested by default
- `reviewerRules`: path-based reviewer rules matched against changed files
- `draftByDefault`: open PRs as drafts unless overridden
- `assignToCurrentUser`: assign the PR to the authenticated GitHub user by default

## Body Sources

Non-interactive body content can come from exactly one explicit source:

- `--body`
- `--body-file`
- piped stdin

If none is supplied, `prkit` falls back to the configured description template path when available.

## Examples

```sh
pnpm build
prkit create --dry-run
prkit create --non-interactive --ticket-id ENG-42 --base-branch main
printf 'Release notes\n' | prkit create --non-interactive --dry-run
prkit create --non-interactive --body-file ./body.md
```
