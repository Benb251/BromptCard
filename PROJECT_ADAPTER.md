# Project Adapter — BromptCard

## Required verification

After implementation of the current task, run this sequence from the repository root:

1. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`
2. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1`
3. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`
4. `git status --short`
5. `git diff --stat`

A required command that fails remains FAIL evidence. Do not treat a failed required command as passed. Do not skip `package-release.ps1`. Do not replace a required failed command with a weaker proxy check.

`scripts/package-release.ps1` reads the version from `manifest.json` and writes `store/BromptCard-<version>.zip` from the extension runtime files. That zip is the generated store release artifact.

## Mutation scope

Allowed when needed for the current task:

- `manifest.json`
- `store/INSTALL.md`
- `store/LISTING.md`
- `store/BromptCard-0.3.1.zip`

Forbidden unless separately authorized:

- Application or runtime JavaScript and other extension implementation files
- Weakening, replacing, or removing `scripts/verify-release.ps1` or `scripts/package-release.ps1`
- Unrelated source, docs, or configuration
- Generated junk or stray artifacts
- Commit, push, merge, or release

## Mutation authorization

No commit, push, tag, release, or lifecycle-state update unless separately requested.

## Workspace boundary

- Implementation scope is the current repository only.
- Do not inspect or modify files outside the current repository.
- External machine or workspace state is out of scope unless separately authorized.
