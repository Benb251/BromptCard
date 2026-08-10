import {
  MENU_ID,
  MENU_ROOT_ID,
  MENU_SCREENSHOT_ID,
  menuModeId,
  parseMenuModeId
} from "./constants.js";
import { AnalysisError } from "./lib/schema.js";
import { analyzeWithProvider, statusForProvider } from "./automation/orchestrator.js";
import { getSettings, saveSettings, isUrlAllowed, getModeById } from "./storage.js";

const CONTENT_SCRIPT_ID = "bromptcard-content";
const CONTENT_EXCLUDE_MATCHES = [
  "https://gemini.google.com/*",
  "https://accounts.google.com/*",
  "https://*.accounts.google.com/*",
  "https://oauth.googleusercontent.com/*",
  "https://*.oauth.googleusercontent.com/*",
  "https://checkout.link.com/*",
  "https://*.checkout.link.com/*",
  "https://checkout.stripe.com/*",
  "https://*.checkout.stripe.com/*",
  "https://buy.stripe.com/*",
  "https://*.buy.stripe.com/*",
  "https://billing.stripe.com/*",
  "https://*.billing.stripe.com/*",
  "https://pay.stripe.com/*",
  "https://*.pay.stripe.com/*"
];

const BG_I18N = {
  vi: {
    menuAnalyze: "Phân tích ảnh với BromptCard",
    menuRoot: "BromptCard",
    menuScreenshot: "BromptCard · Cắt ảnh màn hình",
    siteDisabled: "BromptCard đang tắt trên website này. Hãy thêm site trong popup trước.",
    analysisFailed: "Phân tích thất bại.",
    providerStatusFailed: "Không thể đọc trạng thái provider.",
    saveSettingsFailed: "Không thể lưu cài đặt.",
    captureFailed: "Không thể chụp tab hiện tại.",
    activeTabMissing: "Không tìm thấy tab hiện tại.",
    openPanelFailed: "Không thể mở panel."
  },
  en: {
    menuAnalyze: "Analyze image with BromptCard",
    menuRoot: "BromptCard",
    menuScreenshot: "BromptCard · Screenshot crop",
    siteDisabled: "BromptCard is disabled on this site. Add the site in the popup first.",
    analysisFailed: "Analysis failed.",
    providerStatusFailed: "Could not read provider status.",
    saveSettingsFailed: "Could not save settings.",
    captureFailed: "Could not capture the visible tab.",
    activeTabMissing: "Could not find the active tab.",
    openPanelFailed: "Could not open the panel."
  }
};

function bgT(language, key) {
  const lang = language === "en" ? "en" : "vi";
  return BG_I18N[lang][key] || BG_I18N.en[key] || key;
}

function allowedSitePatterns(allowedSites) {
  const list = Array.isArray(allowedSites) ? allowedSites : [];
  const patterns = [];
  for (const host of list) {
    patterns.push(`http://${host}/*`);
    patterns.push(`https://${host}/*`);
    patterns.push(`http://*.${host}/*`);
    patterns.push(`https://*.${host}/*`);
  }
  return patterns;
}

async function createContextMenu() {
  const settings = await getSettings();
  const documentUrlPatterns = allowedSitePatterns(settings.allowedSites);
  const lang = settings.language;
  const modes = Array.isArray(settings.gemModes) ? settings.gemModes : [];

  chrome.contextMenus.removeAll(() => {
    if (!documentUrlPatterns.length) {
      return;
    }

    // Image + link: pin cards often wrap <img> in <a>, so Chrome only fires "link"
    // context — not "image" — when the user right-clicks the tile.
    const analyzeContexts = ["image", "link"];

    chrome.contextMenus.create({
      id: MENU_ROOT_ID,
      title: bgT(lang, "menuRoot"),
      contexts: analyzeContexts,
      documentUrlPatterns
    });

    for (const mode of modes) {
      if (!mode?.id || !mode?.name) {
        continue;
      }
      chrome.contextMenus.create({
        id: menuModeId(mode.id),
        parentId: MENU_ROOT_ID,
        title: mode.name,
        contexts: analyzeContexts,
        documentUrlPatterns
      });
    }

    // Page area (not on an image/link): screenshot crop only.
    chrome.contextMenus.create({
      id: MENU_SCREENSHOT_ID,
      title: bgT(lang, "menuScreenshot"),
      contexts: ["page"],
      documentUrlPatterns
    });
  });
}

async function registerContentScript() {
  const settings = await getSettings();
  const matches = allowedSitePatterns(settings.allowedSites);
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  } catch {
    /* The script is not registered yet. */
  }
  if (!matches.length) return;
  await chrome.scripting.registerContentScripts([{
    id: CONTENT_SCRIPT_ID,
    matches,
    excludeMatches: CONTENT_EXCLUDE_MATCHES,
    js: ["content.js"],
    runAt: "document_idle",
    persistAcrossSessions: true
  }]);
}

async function sendToTab(tabId, message) {
  return chrome.tabs.sendMessage(tabId, message);
}

async function ensurePanel(tabId, payload) {
  try {
    await sendToTab(tabId, { type: "PROMPTCARD_OPEN_PANEL", payload });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"]
    });
    await sendToTab(tabId, { type: "PROMPTCARD_OPEN_PANEL", payload });
  }
}

async function resolveCaptureWindowId(preferredWindowId) {
  if (typeof preferredWindowId === "number") {
    return preferredWindowId;
  }
  try {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (typeof active?.windowId === "number") {
      return active.windowId;
    }
  } catch {
    /* fall through */
  }
  const win = await chrome.windows.getLastFocused();
  return win?.id ?? null;
}

async function captureVisibleTab(windowId) {
  const resolvedId = await resolveCaptureWindowId(windowId);
  if (typeof resolvedId !== "number") {
    throw new Error("Could not resolve the window to capture.");
  }
  // Requires the selected site's optional host permission, or activeTab from a
  // browser-action / context-menu user gesture.
  return chrome.tabs.captureVisibleTab(resolvedId, { format: "png" });
}

function ok(sendResponse, data) {
  sendResponse({ ok: true, data });
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
  registerContentScript();
});
chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
  registerContentScript();
});

createContextMenu();
registerContentScript();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) {
    return;
  }
  const menuId = String(info.menuItemId || "");
  if (menuId === MENU_ROOT_ID) {
    return;
  }

  const settings = await getSettings();
  if (!isUrlAllowed(tab.url, settings.allowedSites)) {
    return;
  }

  if (menuId === MENU_SCREENSHOT_ID) {
    await ensurePanel(tab.id, {
      startMode: "screenshot",
      pageUrl: info.pageUrl || tab.url || ""
    });
    return;
  }

  const modeFromMenu = parseMenuModeId(menuId);
  const isLegacyAnalyze = menuId === MENU_ID;
  if (!modeFromMenu && !isLegacyAnalyze) {
    return;
  }

  const modeId =
    modeFromMenu ||
    (getModeById(settings.gemModes, settings.provider)?.id ?? settings.provider);

  // Prefer native image src; for pin cards (link context) the content script resolves
  // the img under the cursor / inside the anchor — never "largest on page".
  if (info.srcUrl) {
    await ensurePanel(tab.id, {
      srcUrl: info.srcUrl,
      pageUrl: info.pageUrl || tab.url || "",
      startMode: "image",
      modeId
    });
    return;
  }

  if (info.linkUrl) {
    await ensurePanel(tab.id, {
      linkUrl: info.linkUrl,
      pageUrl: info.pageUrl || tab.url || "",
      startMode: "resolve-image",
      modeId
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PROMPTCARD_RUN_ANALYSIS") {
    (async () => {
      try {
        const settings = await getSettings();
        if (!isUrlAllowed(sender.tab?.url, settings.allowedSites)) {
          throw new Error(bgT(settings.language, "siteDisabled"));
        }
        const providerId = message.payload?.provider || settings.provider;
        const analysis = await analyzeWithProvider(
          providerId,
          message.payload.target,
          sender.tab?.id ?? null
        );
        ok(sendResponse, { analysis });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : bgT("en", "analysisFailed"),
          code: error instanceof AnalysisError ? error.code : "ANALYSIS_FAILED"
        });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_PROVIDER_STATUS") {
    (async () => {
      try {
        const settings = await getSettings();
        const providerId = message.payload?.provider || settings.provider;
        const status = await statusForProvider(providerId);
        ok(sendResponse, { status });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "providerStatusFailed") });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_GET_SETTINGS") {
    (async () => ok(sendResponse, { settings: await getSettings() }))();
    return true;
  }

  if (message?.type === "PROMPTCARD_SAVE_SETTINGS") {
    (async () => {
      try {
        const settings = await saveSettings(message.payload || {});
        await createContextMenu();
        await registerContentScript();
        ok(sendResponse, { settings });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "saveSettingsFailed") });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_CAPTURE_VISIBLE_TAB") {
    (async () => {
      try {
        const dataUrl = await captureVisibleTab(sender.tab?.windowId);
        ok(sendResponse, { dataUrl });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "captureFailed") });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_OPEN_ACTIVE_PANEL") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          throw new Error(bgT("en", "activeTabMissing"));
        }
        const settings = await getSettings();
        if (!isUrlAllowed(tab.url, settings.allowedSites)) {
          throw new Error(bgT(settings.language, "siteDisabled"));
        }
        await ensurePanel(tab.id, { startMode: "panel", pageUrl: tab.url || "" });
        ok(sendResponse, { opened: true });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "openPanelFailed") });
      }
    })();
    return true;
  }

  return false;
});
