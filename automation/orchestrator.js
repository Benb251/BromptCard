import { AnalysisError, parseModeResponse } from "../lib/schema.js";
import { imageTargetToPayload } from "../lib/image.js";
import { buildPromptText } from "../lib/prompt.js";
import { injectedAutomation } from "./inject.js";
import { createProviderFromMode } from "../providers/index.js";
import { getModeById, getSettings } from "../storage.js";

const READY_TIMEOUT_MS = 12000;
const PROVIDER_TAB_KEY_PREFIX = "pcProviderTab:";
/** Separate unfocused window so Gemini stays document.visibilityState=visible without stealing the user's tab. */
const GEMINI_BG_WINDOW_KEY = "pcGeminiBgWindowId";
const TRANSIENT_AUTOMATION_ERRORS = new Set(["NOT_READY", "SEND_UNAVAILABLE"]);

function providerTabKey(providerId) {
  return `${PROVIDER_TAB_KEY_PREFIX}${providerId}`;
}

function diagSuffix(diag) {
  if (!diag) {
    return "";
  }
  const steps = [
    `editor:${diag.editorFound ? "yes" : "no"}`,
    `text:${diag.editorText || 0}/${diag.expectedText || 0}`,
    `send:${diag.sendFound ? "yes" : "no"}`,
    `gen:${diag.sawGenerating ? "yes" : "no"}`
  ];
  return ` [${steps.join(" ")}]`;
}

function matchesProvider(provider, url) {
  if (!url) {
    return false;
  }
  return provider.urlPatterns.some((pattern) => {
    const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    return regex.test(url);
  });
}

function isGemConversationTab(tab) {
  return /^https:\/\/gemini\.google\.com\/gem\//.test(tab?.url || "");
}

async function rememberProviderTab(provider, tabId) {
  await chrome.storage.local.set({ [providerTabKey(provider.id)]: tabId });
}

async function forgetProviderTab(provider) {
  await chrome.storage.local.remove(providerTabKey(provider.id));
}

async function getRememberedProviderTab(provider) {
  const stored = await chrome.storage.local.get(providerTabKey(provider.id));
  const tabId = stored[providerTabKey(provider.id)];
  if (!Number.isInteger(tabId)) {
    return null;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!matchesProvider(provider, tab.url)) {
      await forgetProviderTab(provider);
      return null;
    }
    return tab;
  } catch {
    await forgetProviderTab(provider);
    return null;
  }
}

async function getRememberedOtherProviderTabIds(provider) {
  const settings = await getSettings();
  const keys = settings.gemModes
    .filter((item) => item.id !== provider.id)
    .map((item) => providerTabKey(item.id));
  if (!keys.length) {
    return new Set();
  }

  const stored = await chrome.storage.local.get(keys);
  return new Set(Object.values(stored).filter((value) => Number.isInteger(value)));
}

async function findProviderTab(provider) {
  const remembered = await getRememberedProviderTab(provider);
  if (remembered) {
    return remembered;
  }

  const tabs = await chrome.tabs.query({});
  const matching = tabs.filter((tab) => matchesProvider(provider, tab.url));
  if (provider.matchUrl) {
    const exact = matching.find((tab) => (tab.url || "").includes(provider.matchUrl));
    if (exact) {
      await rememberProviderTab(provider, exact.id);
      return exact;
    }

    const rememberedOtherTabIds = await getRememberedOtherProviderTabIds(provider);
    const reusableGemTabs = matching.filter(
      (tab) => tab.id && isGemConversationTab(tab) && !rememberedOtherTabIds.has(tab.id)
    );
    if (reusableGemTabs.length === 1) {
      await rememberProviderTab(provider, reusableGemTabs[0].id);
      return reusableGemTabs[0];
    }
    return null;
  }

  const fallback = matching[0] || null;
  if (fallback?.id) {
    await rememberProviderTab(provider, fallback.id);
  }
  return fallback;
}

async function ensureTabReady(tabId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") {
      return tab;
    }
    if (Date.now() > deadline) {
      return tab;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

async function openProviderTab(provider) {
  const tab = await chrome.tabs.create({ url: provider.homeUrl, active: false });
  await ensureTabReady(tab.id, READY_TIMEOUT_MS);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  await rememberProviderTab(provider, tab.id);
  return tab;
}

async function activateTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  if (typeof tab.windowId === "number") {
    await chrome.windows.update(tab.windowId, { focused: true });
  }
  await chrome.tabs.update(tabId, { active: true });
  await ensureTabReady(tabId, READY_TIMEOUT_MS);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** Keep Gemini usable without stealing window focus (avoids jarring tab switches). */
async function ensureGeminiTabAwake(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.discarded) {
      await chrome.tabs.reload(tabId);
      await ensureTabReady(tabId, READY_TIMEOUT_MS);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return;
    }
    if (tab.status !== "complete") {
      await ensureTabReady(tabId, READY_TIMEOUT_MS);
    }
  } catch {
    /* tab may have closed */
  }
}

/**
 * Gemini's SPA often stays a black/frozen surface until the *window* is focused
 * at least once. Unfocused detached windows are not enough.
 *
 * Strategy:
 * 1) Dedicated mini "PiP" window (small, bottom-right of the user's work window).
 * 2) Focus only that mini window during paste→stream→read (not a full-size overlay).
 * 3) Caller restores the source window when done.
 */
// Chrome clamps popup windows to a platform minimum; these values aim for a
// titlebar-sized strip (like a tiny floating Chrome chrome bar).
const GEMINI_PIP_WIDTH = 200;
const GEMINI_PIP_HEIGHT = 72;
const GEMINI_PIP_MARGIN = 10;
/** If the user leaves the Gem PiP (e.g. clicks Pinterest), reclaim focus after this delay. */
const GEMINI_REFOCUS_AFTER_MS = 3000;
const GEMINI_FOCUS_POLL_MS = 500;

async function getGeminiPipBounds(sourceWindowId) {
  let left = 40;
  let top = 40;
  let workW = 1280;
  let workH = 720;

  try {
    if (Number.isInteger(sourceWindowId)) {
      const win = await chrome.windows.get(sourceWindowId);
      if (win) {
        left = typeof win.left === "number" ? win.left : left;
        top = typeof win.top === "number" ? win.top : top;
        workW = typeof win.width === "number" ? win.width : workW;
        workH = typeof win.height === "number" ? win.height : workH;
      }
    } else {
      const current = await chrome.windows.getLastFocused();
      if (current) {
        left = typeof current.left === "number" ? current.left : left;
        top = typeof current.top === "number" ? current.top : top;
        workW = typeof current.width === "number" ? current.width : workW;
        workH = typeof current.height === "number" ? current.height : workH;
      }
    }
  } catch {
    /* use defaults */
  }

  return {
    width: GEMINI_PIP_WIDTH,
    height: GEMINI_PIP_HEIGHT,
    // Bottom-right corner of the user's main browser window work area.
    left: Math.max(0, left + workW - GEMINI_PIP_WIDTH - GEMINI_PIP_MARGIN),
    top: Math.max(0, top + workH - GEMINI_PIP_HEIGHT - GEMINI_PIP_MARGIN)
  };
}

async function applyGeminiPipLayout(windowId, sourceWindowId, { focused = true } = {}) {
  const bounds = await getGeminiPipBounds(sourceWindowId);
  // Force normal state first so minimize/maximize leftovers don't keep a large frame.
  try {
    await chrome.windows.update(windowId, { state: "normal" });
  } catch {
    /* ignore */
  }
  await chrome.windows.update(windowId, {
    focused: Boolean(focused),
    state: "normal",
    width: bounds.width,
    height: bounds.height,
    left: bounds.left,
    top: bounds.top
  });
  // Re-apply once — some Chrome builds ignore the first tiny size request.
  try {
    await chrome.windows.update(windowId, {
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top
    });
  } catch {
    /* ignore */
  }
}

async function parkGeminiPipAfterRun(tabId, sourceWindowId) {
  try {
    const gemTab = await chrome.tabs.get(tabId);
    if (typeof gemTab.windowId !== "number") {
      return;
    }
    // Keep a titlebar-sized strip, unfocused, bottom-right — does not steal attention.
    await applyGeminiPipLayout(gemTab.windowId, sourceWindowId, { focused: false });
  } catch {
    /* gem window may have closed */
  }
}

async function moveGeminiToSessionWindow(tabId, { focused = true, sourceWindowId = null } = {}) {
  const stored = await chrome.storage.local.get(GEMINI_BG_WINDOW_KEY);
  const rememberedId = stored[GEMINI_BG_WINDOW_KEY];
  const bounds = await getGeminiPipBounds(sourceWindowId);

  if (Number.isInteger(rememberedId)) {
    try {
      const win = await chrome.windows.get(rememberedId);
      if (win?.id != null) {
        const gemTab = await chrome.tabs.get(tabId);
        if (gemTab.windowId !== win.id) {
          await chrome.tabs.move(tabId, { windowId: win.id, index: -1 });
        }
        await applyGeminiPipLayout(win.id, sourceWindowId, { focused });
        return win.id;
      }
    } catch {
      await chrome.storage.local.remove(GEMINI_BG_WINDOW_KEY);
    }
  }

  // "popup" = no tab strip → smaller chrome, less screen real-estate.
  const created = await chrome.windows.create({
    tabId,
    focused: Boolean(focused),
    type: "popup",
    state: "normal",
    ...bounds
  });
  if (created?.id != null) {
    await chrome.storage.local.set({ [GEMINI_BG_WINDOW_KEY]: created.id });
    // Re-apply bounds (some Chrome builds ignore size on create with tabId).
    try {
      await applyGeminiPipLayout(created.id, sourceWindowId, { focused });
    } catch {
      /* ignore */
    }
    return created.id;
  }
  return null;
}

async function waitForGeminiComposerReady(tabId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        world: "MAIN",
        func: () => {
          try {
            window.focus();
          } catch {
            /* ignore */
          }
          const selectors = [
            "rich-textarea [contenteditable='true']",
            "rich-textarea .ql-editor[contenteditable='true']",
            "div.ql-editor[contenteditable='true']",
            "div[contenteditable='true'][role='textbox']",
            "div[contenteditable='true']"
          ];
          for (const selector of selectors) {
            const node = document.querySelector(selector);
            if (node) {
              return {
                ready: true,
                hidden: document.hidden,
                hasFocus: document.hasFocus(),
                visibility: document.visibilityState
              };
            }
          }
          return {
            ready: false,
            hidden: document.hidden,
            hasFocus: document.hasFocus(),
            visibility: document.visibilityState,
            title: document.title || "",
            bodyTextLen: (document.body && (document.body.innerText || "").trim().length) || 0
          };
        }
      });
      const status = injection?.result;
      if (status?.ready) {
        return status;
      }
    } catch {
      /* tab may be mid-navigation */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return null;
}

async function prepareGeminiTabForAutomation(tabId, sourceTabId) {
  await ensureGeminiTabAwake(tabId);

  let gemTab = await chrome.tabs.get(tabId);
  let sourceTab = null;
  if (Number.isInteger(sourceTabId)) {
    try {
      sourceTab = await chrome.tabs.get(sourceTabId);
    } catch {
      sourceTab = null;
    }
  }

  const sourceWindowId = sourceTab && typeof sourceTab.windowId === "number" ? sourceTab.windowId : null;

  // Always park Gem in a tiny PiP window so a full-size window never covers the canvas.
  await moveGeminiToSessionWindow(tabId, { focused: true, sourceWindowId });
  gemTab = await chrome.tabs.get(tabId);

  await chrome.tabs.update(tabId, { active: true, autoDiscardable: false });

  if (typeof gemTab.windowId === "number") {
    // Real OS focus is required — keep it a corner PiP, not a large overlay.
    await applyGeminiPipLayout(gemTab.windowId, sourceWindowId, { focused: true });
  }

  await ensureTabReady(tabId, READY_TIMEOUT_MS);
  // Give the SPA time to paint after focus (black screen → UI).
  await new Promise((resolve) => setTimeout(resolve, 700));
  await waitForGeminiComposerReady(tabId, 20000);
  return sourceWindowId;
}

/**
 * While Gemini is generating, if the PiP window loses OS focus for ~3s
 * (user clicked Pinterest, another app, etc.), focus the PiP again so the SPA
 * keeps streaming. Stop when automation finishes so we can restore the source tab.
 */
function startGeminiFocusKeeper(tabId, sourceWindowId) {
  let stopped = false;
  let unfocusedSince = null;
  let tickInFlight = false;

  const timer = setInterval(() => {
    if (stopped || tickInFlight) {
      return;
    }
    tickInFlight = true;
    (async () => {
      try {
        const gemTab = await chrome.tabs.get(tabId);
        if (!gemTab?.id || gemTab.windowId == null) {
          return;
        }

        let win;
        try {
          win = await chrome.windows.get(gemTab.windowId);
        } catch {
          unfocusedSince = null;
          return;
        }

        // Window focused AND gem is the active tab → healthy.
        if (win.focused && gemTab.active) {
          unfocusedSince = null;
          return;
        }

        if (unfocusedSince == null) {
          unfocusedSince = Date.now();
          return;
        }

        if (Date.now() - unfocusedSince < GEMINI_REFOCUS_AFTER_MS) {
          return;
        }

        await chrome.tabs.update(tabId, { active: true, autoDiscardable: false });
        await applyGeminiPipLayout(gemTab.windowId, sourceWindowId, { focused: true });
        unfocusedSince = null;
      } catch {
        /* tab/window may have closed mid-run */
      } finally {
        tickInFlight = false;
      }
    })();
  }, GEMINI_FOCUS_POLL_MS);

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

async function restoreTab(tabId) {
  if (!Number.isInteger(tabId)) {
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (typeof tab.windowId === "number") {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    /* source tab may be closed */
  }
}

async function runInTab(tabId, world, config) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world,
    func: injectedAutomation,
    args: [config]
  });
  return result?.result;
}

async function statusForGemini(providerId) {
  const settings = await getSettings();
  const mode = getModeById(settings.gemModes, providerId);
  const provider = createProviderFromMode(mode);
  const tab = await findProviderTab(provider);
  return {
    providerId: provider.id,
    providerName: provider.name,
    open: Boolean(tab),
    tabId: tab?.id || null
  };
}

export async function statusForProvider(providerId) {
  return statusForGemini(providerId);
}

async function analyzeWithGemini(providerId, target, sourceTabId) {
  const settings = await getSettings();
  const selectedMode = getModeById(settings.gemModes, providerId);
  const provider = createProviderFromMode(selectedMode);
  const payload = await imageTargetToPayload(target);

  let tab = await findProviderTab(provider);
  let openedHere = false;
  if (!tab) {
    tab = await openProviderTab(provider);
    openedHere = true;
  } else {
    await ensureTabReady(tab.id, READY_TIMEOUT_MS);
    await rememberProviderTab(provider, tab.id);
  }

  if (!tab?.id) {
    throw new AnalysisError(`Could not open ${provider.name}.`, "PROVIDER_TAB_FAILED");
  }

  const baseConfig = {
    base64: payload.data,
    mimeType: payload.mimeType,
    selectors: provider.selectors,
    timing: provider.timing
  };

  const usesGem = provider.sendPrompt === false;
  const promptText = usesGem ? "" : buildPromptText(target);
  const canRestoreSource = Number.isInteger(sourceTabId) && sourceTabId !== tab.id;
  const FOCUS_FALLBACK_ERRORS = new Set([
    "NOT_READY",
    "SEND_UNAVAILABLE",
    "NO_RESPONSE",
    "TEXT_NOT_SET",
    ...TRANSIENT_AUTOMATION_ERRORS
  ]);

  // Gemini must stay focused for the whole paste→stream→read cycle (unfocused = black freeze).
  // Uses a titlebar-sized PiP; if focus is lost ~3s, reclaim PiP, then restore user tab when done.
  let result;
  let stopFocusKeeper = null;
  let sourceWindowId = null;
  try {
    sourceWindowId = await prepareGeminiTabForAutomation(tab.id, sourceTabId);
    stopFocusKeeper = startGeminiFocusKeeper(tab.id, sourceWindowId);

    result = await runInTab(tab.id, provider.world, {
      ...baseConfig,
      promptText
    });

    if (!result?.ok && FOCUS_FALLBACK_ERRORS.has(result.error)) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await activateTab(tab.id);
      try {
        const gemTab = await chrome.tabs.get(tab.id);
        if (typeof gemTab.windowId === "number") {
          await applyGeminiPipLayout(gemTab.windowId, sourceWindowId, { focused: true });
        }
      } catch {
        /* ignore */
      }
      await waitForGeminiComposerReady(tab.id, 12000);
      result = await runInTab(tab.id, provider.world, {
        ...baseConfig,
        promptText
      });
    }
  } finally {
    if (typeof stopFocusKeeper === "function") {
      stopFocusKeeper();
    }
    await parkGeminiPipAfterRun(tab.id, sourceWindowId);
    if (canRestoreSource) {
      await restoreTab(sourceTabId);
    }
  }

  if (!result) {
    throw new AnalysisError(`${provider.name} automation did not return a result.`, "AUTOMATION_FAILED");
  }
  if (!result.ok) {
    const code = result.error || "AUTOMATION_FAILED";
    const hint = openedHere ? ` A new ${provider.name} tab was opened; sign in there and try again.` : "";
    throw new AnalysisError((result.message || "Automation failed.") + hint + diagSuffix(result.diag), code);
  }

  return parseModeResponse(result.text, selectedMode);
}

export async function analyzeWithProvider(providerId, target, _mode = "analyze", sourceTabId = null) {
  return analyzeWithGemini(providerId, target, sourceTabId);
}
