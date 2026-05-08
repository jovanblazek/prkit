# prkit

CLI for creating GitHub pull requests from ticket context.

## Requirements

- Node.js 22+ with `pnpm`
- `gh` installed and authenticated against GitHub
- `linear` CLI installed and authenticated for ticket lookup
- Run `prkit` inside a git repository with an `origin` remote that points to GitHub
- Push the current branch before running a real non-interactive PR create

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
