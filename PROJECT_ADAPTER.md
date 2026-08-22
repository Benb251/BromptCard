# Project Adapter — BromptCard

## Implementation complete

Allowed implementation edits for the current task are the source and metadata files:

- `manifest.json`
- `store/INSTALL.md`
- `store/LISTING.md`

The versioned store zip (`store/BromptCard-<version>.zip`) is a generated release artifact produced by the project packaging command. It is not a hand-edited source file. Do not create or copy that zip by hand as an implementation edit.

Forbidden unless separately authorized:

- Application or runtime JavaScript and other extension implementation files
- Weakening, replacing, or removing `scripts/verify-release.ps1` or `scripts/package-release.ps1`
- Unrelated source, docs, or configuration
- Generated junk or stray artifacts
- Commit, push, merge, or release

## Required verification

Once implementation is complete, run this project verification sequence from the repository root. These commands are project verification, not implementation edits.

1. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`
2. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\package-release.ps1`
3. `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-release.ps1`
4. `git status --short`
5. `git diff --stat`

A required command that fails remains FAIL evidence. Do not treat a failed required command as passed. Do not skip `package-release.ps1`. Do not replace a required failed command with a weaker proxy check.

`scripts/package-release.ps1` reads the version from `manifest.json` and writes `store/BromptCard-<version>.zip` from the extension runtime files. That zip is the generated store release artifact.

## Mutation authorization

No commit, push, tag, release, or lifecycle-state update unless separately requested.

## Workspace boundary

- Implementation scope is the current repository only.
- Do not inspect or modify files outside the current repository.
- External machine or workspace state is out of scope unless separately authorized.
