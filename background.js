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
import { ensureAllowed, consume, getQuota, QuotaError } from "./lib/entitlement.js";
import { syncProStatus, activateLicense, removeLicense, licenseInfo } from "./lib/billing.js";

const RESET_TOKEN = "reset-2026-06-01";
const RESET_TOKEN_KEY = "pcResetToken";

const RESETTABLE_DEFAULTS = {
  provider: null,
  language: null,
  allowedSites: ["pinterest.com"],
  pcPro: false,
  pcUsage: null,
  pcLicenseKey: null,
  pcLicenseState: null
};

const BG_I18N = {
  vi: {
    menuAnalyze: "Phân tích ảnh với BromptCard",
    menuRoot: "BromptCard",
    menuScreenshot: "BromptCard · Cắt ảnh màn hình",
    siteDisabled: "BromptCard đang tắt trên website này. Hãy thêm site trong popup trước.",
    analysisFailed: "Phân tích thất bại.",
    activateLicenseFailed: "Không thể kích hoạt license.",
    removeLicenseFailed: "Không thể gỡ license.",
    licenseInfoFailed: "Không thể đọc thông tin license.",
    quotaReadFailed: "Không thể đọc quota.",
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
    activateLicenseFailed: "Could not activate the license.",
    removeLicenseFailed: "Could not remove the license.",
    licenseInfoFailed: "Could not read license info.",
    quotaReadFailed: "Could not read quota.",
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

async function resetDefaultsOnce() {
  try {
    const stored = await chrome.storage.local.get(RESET_TOKEN_KEY);
    if (stored[RESET_TOKEN_KEY] === RESET_TOKEN) {
      return;
    }
    const nextState = { [RESET_TOKEN_KEY]: RESET_TOKEN };
    for (const [key, value] of Object.entries(RESETTABLE_DEFAULTS)) {
      nextState[key] = value;
    }
    await chrome.storage.local.set(nextState);
  } catch {
    /* ignore */
  }
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
  // Requires host permission for the page URL (see host_permissions <all_urls>),
  // or activeTab from a browser-action / context-menu user gesture.
  return chrome.tabs.captureVisibleTab(resolvedId, { format: "png" });
}

function ok(sendResponse, data) {
  sendResponse({ ok: true, data });
}

chrome.runtime.onInstalled.addListener(() => {
  resetDefaultsOnce();
  createContextMenu();
  syncProStatus();
});
chrome.runtime.onStartup.addListener(() => {
  resetDefaultsOnce();
  createContextMenu();
  syncProStatus();
});

resetDefaultsOnce();
syncProStatus();
createContextMenu();

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
        const selectedMode = getModeById(settings.gemModes, providerId);
        const entitlementMode = selectedMode?.resultKind === "style" ? "style" : "analyze";
        await ensureAllowed(entitlementMode);
        const analysis = await analyzeWithProvider(
          providerId,
          message.payload.target,
          entitlementMode,
          sender.tab?.id ?? null
        );
        await consume(entitlementMode);
        const quota = await getQuota();
        ok(sendResponse, { analysis, quota });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : bgT("en", "analysisFailed"),
          code:
            error instanceof QuotaError
              ? error.code
              : error instanceof AnalysisError
                ? error.code
                : "ANALYSIS_FAILED",
          quota: error instanceof QuotaError ? error.quota : undefined
        });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_ACTIVATE_LICENSE") {
    (async () => {
      try {
        const result = await activateLicense(message.payload?.key);
        const quota = await getQuota();
        const info = await licenseInfo();
        ok(sendResponse, { result, quota, license: info });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "activateLicenseFailed") });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_REMOVE_LICENSE") {
    (async () => {
      try {
        await removeLicense();
        ok(sendResponse, { quota: await getQuota(), license: await licenseInfo() });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "removeLicenseFailed") });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_LICENSE_INFO") {
    (async () => {
      try {
        await syncProStatus();
        ok(sendResponse, { quota: await getQuota(), license: await licenseInfo() });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "licenseInfoFailed") });
      }
    })();
    return true;
  }

  if (message?.type === "PROMPTCARD_GET_QUOTA") {
    (async () => {
      try {
        ok(sendResponse, { quota: await getQuota() });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : bgT("en", "quotaReadFailed") });
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
