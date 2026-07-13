# BromptCard

Chrome Extension (MV3) that turns images into structured Vietnamese + English prompts by driving your already-logged-in **Gemini Gem** tab. No API key, no account, no hosted backend.

## How it works

1. Open a Gemini Gem tab and sign in normally.
2. Enable one or more websites in the popup and approve Chrome's per-site access request (default: `pinterest.com`).
3. On an enabled site, right-click an image and pick a mode (Faithful / Style / custom), or use screenshot crop / optional hover chips.
4. BromptCard extracts the image, automates your Gem tab (paste → send → read), and parses the structured reply into the in-page panel.

## Site allowlist

- Enabled on `pinterest.com` by default.
- Paste a full URL or domain in the popup to add more sites. Chrome asks for access only to that site.
- Subdomains are covered automatically.

## Backend

| Backend | Session | Mechanism |
|---------|---------|-----------|
| Gemini Gem | `gemini.google.com/gem/...` | UI automation (`automation/inject.js`, selectors in `providers/gemini.js`) |

## Project layout

- `manifest.json` — MV3 manifest
- `background.js` — context menu, panel routing, allowlist
- `automation/orchestrator.js` — find/open Gem tab and run automation
- `automation/inject.js` — MAIN-world paste/send/read
- `providers/` — Gemini Gem config
- `lib/schema.js` — JSON parse / style + prompt validators
- `lib/image.js` / `lib/prompt.js` — image prep and optional instruction text
- `content.js` — panel, history, hover (optional), dock, screenshot crop
- `popup.*` / `storage.js` / `constants.js` — settings and system prompts

## Load in Chrome

1. `chrome://extensions` → Developer mode → Load unpacked → this folder  
2. Open Gemini Gem and sign in  
3. Confirm enabled sites in the popup  

## Notes

- Keep the Gem tab signed in. Automation needs the composer to paint (compact PiP window during gen).
- Web UIs change often — update selectors in `providers/gemini.js` if Gemini breaks.
- Personal use; subject to Google’s terms for the Gemini web app.
