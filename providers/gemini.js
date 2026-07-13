export const GEMINI_SELECTORS = {
  editor: [
    "rich-textarea [contenteditable='true']",
    "rich-textarea .ql-editor[contenteditable='true']",
    "div.ql-editor[contenteditable='true']",
    "div[contenteditable='true'][role='textbox']",
    "div[contenteditable='true']",
    "textarea[aria-label]"
  ],
  sendButton: [
    "button.send-button",
    "button[aria-label='Send message']",
    "button[aria-label*='Send']",
    "button[aria-label*='Gửi']",
    "button[aria-label*='Run']",
    "button[mattooltip*='Send']",
    "button[mattooltip*='Gửi']",
    "button[mattooltip*='Run']"
  ],
  sendIcons: ["send"],
  stopButton: [
    "button.send-button.stop",
    "button[aria-label='Stop response']",
    "button[aria-label*='Stop']",
    "button[aria-label*='Dừng']",
    "button[aria-label*='Ngừng']",
    "button[mattooltip*='Stop']",
    "button[mattooltip*='Dừng']"
  ],
  stopIcons: ["stop"],
  response: [
    "message-content.model-response-text",
    "model-response .markdown",
    ".model-response-text .markdown",
    "message-content .markdown",
    "model-response message-content",
    "[id^='model-response-message-content']",
    "model-response .response-content",
    ".conversation-container message-content"
  ]
};

export const GEMINI_TIMING = {
  totalTimeoutMs: 180000,
  editorWaitMs: 15000,
  uploadSettleMs: 4000,
  attachmentWaitMs: 15000,
  attachmentStableMs: 1200,
  sendWaitMs: 30000,
  sendConfirmMs: 5000,
  responseStartMs: 25000,
  pollMs: 600,
  stableMs: 2200
};

export function createGeminiProvider(mode) {
  return {
    id: mode.id,
    name: mode.name,
    homeUrl: `https://gemini.google.com/gem/${mode.gemPath}?usp=sharing`,
    urlPatterns: ["https://gemini.google.com/*"],
    matchUrl: `gem/${mode.gemPath}`,
    sendPrompt: false,
    world: "MAIN",
    selectors: GEMINI_SELECTORS,
    timing: GEMINI_TIMING,
    resultKind: mode.resultKind || "prompt"
  };
}
