# BromptCard Privacy Policy

Last updated: 2026-07-13

BromptCard turns an image that you explicitly select into a structured prompt by using the Gemini Gem tab that you have opened and signed in to. BromptCard has no developer-operated backend and does not require an API key.

## Data BromptCard handles

- **Selected images and screenshot crops.** The extension reads an image only after you choose an image action or confirm a screenshot crop.
- **The current page's URL and host.** This is used to check whether you enabled BromptCard for that site and to show its image controls only there.
- **Gemini input and response.** The selected image and the instruction are put into your Gemini Gem tab; BromptCard reads the structured response to display the prompt in its panel.
- **Local settings and history.** Enabled sites, settings, panel preferences, and recent results (including local thumbnails) are stored in Chrome extension storage on your device.

## How data is used and shared

The data above is used only to provide BromptCard's image-to-prompt feature. BromptCard does not send it to a server operated by the developer, sell it, use it for advertising, or allow people to read it.

When you run an analysis, the selected image and instruction are transferred to **Google Gemini** through the Gemini browser tab you are signed into. Google is the only third party that receives analysis input or output from BromptCard. Google's handling of that data is governed by Google's own terms and privacy policy. The extension may also request the selected image from the image host so it can prepare the image for analysis.

## Retention and control

BromptCard does not retain a copy of your data on a developer server. Local history and settings remain on your device until you delete the history, remove an enabled site, clear extension data, or uninstall the extension. You can remove a site's optional access permission from the BromptCard popup or Chrome's site-access controls.

## Permissions

- `contextMenus`, `activeTab`, `scripting`, and `tabs` provide the image right-click action, panel, screenshot crop, and interaction with the Gemini tab you chose to use.
- `storage` stores local settings and history.
- Access to `gemini.google.com` is required to use the Gemini tab.
- Pinterest access is included because Pinterest is the default supported site and the extension must fetch the image you select there. Access to every other website is requested as an **optional permission**, per site, only when you choose to enable it.

## Contact

For privacy questions, contact hungartdn@gmail.com.
