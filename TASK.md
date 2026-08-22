# Task: prepare BromptCard 0.3.1 release hygiene

Prepare the 0.3.1 store release. Faithful, Style, custom Gem modes, and Gemini Gem tab / compact-window handling are already implemented in the current source. This task is release hygiene and listing accuracy, not a runtime rewrite.

## Required updates

1. `manifest.json`
   - Change `version` from `0.3.0` to `0.3.1`.

2. `store/INSTALL.md`
   - Update the install download references so both Vietnamese and English instructions point at `BromptCard-0.3.1.zip`.
   - Leave the rest of the install and usage notes intact unless a wording change is required for that filename update.

3. `store/LISTING.md`
   - Update only the release-facing copy that does not match current behavior:
     - Faithful is a built-in mode
     - Style is a built-in mode
     - Users can add custom Gem modes
     - Analysis opens or reuses the correct Gemini Gem tab, keeps it in a compact window while paste/send/read runs, then restores the source tab
   - Do not rewrite unrelated listing sections (name, short summary, category, privacy, permission justifications that remain accurate, keywords).

## Constraints

- Preserve runtime implementation behavior.
- Do not modify application or runtime JavaScript unless actual source evidence shows this release task requires it.
- Do not weaken release validation.
- Do not commit, push, tag, or publish a release.

Follow the project's verification requirements in `PROJECT_ADAPTER.md`.
