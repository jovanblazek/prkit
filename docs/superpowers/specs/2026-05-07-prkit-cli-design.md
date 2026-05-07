# prkit CLI V1 Design

## Summary

`prkit` is a generic CLI for creating pull requests from ticket context. V1 targets:

- Node.js + TypeScript runtime
- Linear as the first ticket provider
- GitHub as the first PR provider
- `gh` as a hard runtime dependency for GitHub operations

The tool must be useful on its own for humans while remaining deterministic for coding agents. Interactive and non-interactive workflows share the same internal pipeline and differ only in how inputs are collected and how results are rendered.

## Goals

V1 must:

- infer a ticket ID from the current git branch
- fetch ticket data from Linear
- build a PR title, defaulting to `TICKET-ID: Ticket title`
- resolve a target/base branch
- generate or accept a PR description
- assign the PR to the authenticated GitHub user when configured
- request reviewers from repository config
- create the PR through `gh`
- support both interactive human use and non-interactive agent use

V1 is intentionally scoped to one ticket pattern, one default base branch, config-driven reviewer resolution, and a minimal normalized ticket payload.

## Non-Goals

V1 does not include:

- GitHub API fallback when `gh` is missing or unauthenticated
- CODEOWNERS integration
- Jira, GitLab, Bitbucket, or multiple provider implementations beyond Linear and GitHub
- generated PR prose from ticket descriptions, commits, or file diffs
- provider-driven reviewer resolution
- branch-to-base mapping rules
- categorized exit codes

## Command Model

## Primary commands

The primary entrypoint is:

```sh
prkit
```

V1 also supports:

```sh
prkit create
```

Both entrypoints invoke the same command flow.

## Modes

V1 supports:

- interactive mode by default
- non-interactive mode via explicit flag
- dry-run mode in both interactive and non-interactive flows

Interactive mode is intended for humans. Non-interactive mode is intended for agents and automation.

## Inputs

The command request is resolved from three layers:

1. discovered values from git and providers
2. config-derived defaults
3. explicit flags

Flags always win over config and discovered values.

Supported explicit overrides in V1:

- ticket ID
- base branch
- title
- body
- reviewers
- assignee
- draft state

## Body sources

V1 accepts PR body input from:

- `--body`
- `--body-file`
- stdin
- config template when no explicit body source is supplied

Exactly zero or one explicit body sources may be present. If more than one of `--body`, `--body-file`, or stdin is supplied, the command fails.

If no explicit body source is supplied:

- if a template is configured, its contents become the initial body
- if no template is configured, the initial body is empty

In interactive mode, the initial body is opened in `$EDITOR`.

In non-interactive mode, there is no editor step.

## Dry run

Dry run resolves the full request and stops before remote mutation.

Interactive dry run:

- shows a human-readable summary
- allows the same edit menu used by normal interactive flow
- stops before branch push and PR creation

Non-interactive dry run:

- emits structured JSON
- indicates that no PR was created

## Shared Pipeline

Both human and agent workflows run the same internal pipeline:

1. collect git context
2. infer ticket ID
3. fetch ticket data
4. resolve repository config
5. resolve base branch
6. resolve reviewers and assignee
7. build PR title
8. build or receive PR body
9. create PR
10. return result

The difference between modes is limited to input collection and output rendering. Pipeline steps themselves must remain mode-agnostic.

## Architecture

## Design choice

V1 uses a provider-oriented core rather than a single monolithic command implementation.

The structure should keep:

- orchestration generic
- provider-specific logic at the edges
- prompt and editor handling outside the core pipeline

## Core modules

Suggested module boundaries:

- `config`: load, merge, validate config
- `git`: repo discovery, branch name, base diff, push-state checks
- `ticketing`: provider interface plus Linear adapter
- `pr`: provider interface plus GitHub adapter backed by `gh`
- `resolve`: pure resolvers for ticket inference, title, reviewers, assignee, body source selection
- `pipeline`: typed create-PR pipeline orchestration
- `cli`: flag parsing, prompts, editor integration, human rendering, JSON rendering

## Provider interfaces

V1 should define generic interfaces such as:

- `TicketProvider`
- `PrProvider`

### TicketProvider

For V1, the normalized ticket payload only needs:

- `id`
- `title`

The Linear adapter is responsible for turning a ticket lookup into that normalized shape.

### PrProvider

For V1, the GitHub adapter should support:

- retrieving the authenticated GitHub username through `gh`
- checking whether the current branch is pushed
- pushing the current branch when the interactive flow approves it
- creating the PR through `gh`

Reviewer resolution must remain outside providers and stay entirely config-based in V1.

## Interactive layer

Interactive behavior must not be embedded inside pipeline steps.

The CLI layer is responsible for:

- prompting
- opening `$EDITOR`
- presenting the edit menu
- turning user changes into explicit overrides before pipeline execution

This keeps interactive and non-interactive execution on one implementation path.

## Configuration

## File locations

V1 loads at most two YAML config files:

- global: `~/.config/prkit/config.yml` or `~/.config/prkit/config.yaml`
- repo-local: `.prkit.yml` or `.prkit.yaml` at repository root

If both exist:

- both are loaded
- repo-local values override global values

## Validation

Unknown config fields are validation errors. Startup should fail fast rather than warn or ignore unsupported fields.

## Schema

V1 config supports:

- ticket provider
- ticket ID branch pattern
- default base branch
- title format
- PR description template path
- default reviewers
- path-based reviewer rules
- draft-by-default
- assign-to-current-user

Reviewer rules are explicit config entries, not CODEOWNERS-derived behavior.

## Reviewer rules

Path-based reviewer rules use glob patterns.

Reviewer resolution is computed from:

1. changed files in the diff between the current branch and the resolved base branch
2. all matching glob rules
3. the union of all reviewers from matching rules plus default reviewers
4. deduplication
5. filtering of author and assignee

Uncommitted working tree changes do not affect reviewer resolution.

## Template paths

Template path resolution depends on config origin:

- relative paths in repo-local config resolve from the repository root
- relative paths in global config resolve from the global config directory

If a configured template path does not exist, the command fails.

V1 does not inject ticket data into templates and does not generate prose from templates.

## Resolution Rules

## Ticket inference

V1 supports exactly one configured regex pattern with one capture group for ticket extraction from the current branch name.

Examples of valid branch conventions include forms like:

- `feature/ABC-123-something`
- `linear/ENG-42`

If inference fails and no explicit ticket override is supplied:

- interactive mode should surface the problem and allow a manual ticket override before continuing
- non-interactive mode must fail with a structured JSON error

## Base branch

V1 supports one configured default base branch.

There are no branch-to-base mapping rules in V1.

An explicit flag may override the resolved base branch.

## Title

Default title format:

```txt
TICKET-ID: Ticket title
```

V1 allows config or flag-based customization of title format. Humans may also edit the final title interactively to any value. The CLI does not enforce ticket ID inclusion after a human edit.

## Assignee

If assignment is enabled, the GitHub adapter resolves the assignee from the currently authenticated `gh` user.

An explicit assignee flag may override this behavior.

## GitHub and Repository Assumptions

V1 requires:

- execution inside a git repository
- an `origin` remote pointing to GitHub
- `gh` installed
- `gh` authenticated for the current repo

If any of these assumptions fail, the command stops with a clear error.

## Branch push behavior

Before PR creation, V1 checks whether the current branch is pushed.

If the branch is not pushed:

- interactive mode offers to push before continuing
- non-interactive mode fails

Automatic push in non-interactive mode is out of scope for V1.

## Interactive UX

Interactive mode should show the resolved:

- ticket
- title
- base branch
- reviewers
- assignee
- draft state

Before creation, users get a small menu that allows editing selected fields. PR body editing happens through `$EDITOR`.

The final step is an explicit confirmation before any remote mutation.

## Non-Interactive UX

Non-interactive mode should:

- skip all prompts
- skip editor integration
- fail clearly when required data is missing
- produce deterministic JSON output

This mode is intended for agent callers that want a single command execution with machine-readable success or failure.

## Output Contracts

## Success output

Interactive mode should render a human-readable summary.

Non-interactive mode should emit JSON only.

The JSON shape should be stable and include enough information for agents to identify:

- whether the run was a dry run
- the resolved ticket ID
- the resolved base branch
- the resolved title
- the resolved reviewers
- the resolved assignee
- whether a PR was created
- created PR identifier and URL when applicable

## Error output

Non-interactive failures must:

- exit non-zero
- emit structured JSON

The error payload should include:

- a machine-readable error kind
- a human-readable message
- relevant detail for debugging

V1 only needs `0` and non-`0` exit semantics as long as the JSON error payload is structured and stable.

## Testing Strategy

V1 should be tested at three layers:

- pure unit tests for config merging, validation, inference, title formatting, reviewer resolution, and body source precedence
- adapter tests for Linear and GitHub command construction with subprocess mocking
- end-to-end CLI tests for interactive and non-interactive flows, including dry run

Important scenarios:

- valid repo-local and global config merge behavior
- unknown config field failure
- missing `gh`
- invalid or missing template path
- ticket inference failure
- multiple body source error
- branch not pushed in interactive and non-interactive mode
- reviewer union from multiple matching glob rules
- filtering author and assignee from reviewer list
- dry-run JSON output

## Open Extension Seams

V1 should leave room for future additions without redesigning the core:

- more ticket providers such as Jira
- more PR providers such as GitLab or Bitbucket
- richer normalized ticket payloads
- provider-specific hooks where justified later
- agent-facing context export beyond the create-PR flow

The extension seam should exist in interfaces and module boundaries, not in partially implemented V1 features.
