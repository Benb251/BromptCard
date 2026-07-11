import { DEFAULT_GEM_MODES, DEFAULT_SETTINGS } from "./constants.js";

function normalizeHost(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "")
    .replace(/^www\./, "");
}

export function normalizeAllowedSiteInput(value) {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }

  try {
    const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withScheme);
    if (!/^https?:$/i.test(url.protocol)) {
      return "";
    }
    return normalizeHost(url.hostname);
  } catch {
    return "";
  }
}

export function normalizeAllowedSites(value, { fallbackToDefault = true } = {}) {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set();
  const output = [];

  for (const item of list) {
    const host = normalizeAllowedSiteInput(item);
    if (!host || seen.has(host)) {
      continue;
    }
    seen.add(host);
    output.push(host);
  }

  if (output.length) {
    return output;
  }

  return fallbackToDefault ? [...DEFAULT_SETTINGS.allowedSites] : [];
}

export function isUrlAllowed(url, allowedSites) {
  try {
    const host = normalizeHost(new URL(String(url || "")).hostname);
    const list =
      allowedSites === undefined
        ? [...DEFAULT_SETTINGS.allowedSites]
        : normalizeAllowedSites(allowedSites, { fallbackToDefault: false });
    return list.some(
      (allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`)
    );
  } catch {
    return false;
  }
}

export function normalizeGemPathInput(value) {
  const input = String(value || "").trim();
  if (!input) {
    return "";
  }

  const direct = input.replace(/^\/+|\/+$/g, "");
  if (/^[A-Za-z0-9_-]{8,}$/.test(direct)) {
    return direct;
  }

  const match = input.match(/gem\/([A-Za-z0-9_-]{8,})/i);
  if (match) {
    return match[1];
  }

  try {
    const withScheme = /^[a-z]+:\/\//i.test(input) ? input : `https://${input}`;
    const url = new URL(withScheme);
    const pathMatch = `${url.pathname}${url.search}`.match(/gem\/([A-Za-z0-9_-]{8,})/i);
    return pathMatch ? pathMatch[1] : "";
  } catch {
    return "";
  }
}

function normalizeModeName(value) {
  return String(value || "").trim().slice(0, 40);
}

function normalizeResultKind(value) {
  return value === "style" ? "style" : "prompt";
}

function normalizeOutputFormat(value, resultKind) {
  if (value === "custom_json") {
    return "custom_json";
  }
  if (value === "style") {
    return "style";
  }
  if (value === "prompt") {
    return "prompt";
  }
  return resultKind === "style" ? "style" : "prompt";
}

function normalizeFieldName(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function normalizeFieldList(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const seen = new Set();
  const output = [];
  for (const item of list) {
    const normalized = normalizeFieldName(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function fallbackModeId(index) {
  return `mode_${index + 1}`;
}

function normalizeModeItem(mode, index) {
  if (!mode || typeof mode !== "object") {
    return null;
  }

  const name = normalizeModeName(mode.name);
  const gemPath = normalizeGemPathInput(mode.gemPath || mode.gemUrl || mode.url);
  if (!name || !gemPath) {
    return null;
  }

  const rawId = typeof mode.id === "string" ? mode.id.trim() : "";
  const resultKind = normalizeResultKind(mode.resultKind);
  return {
    id: rawId || fallbackModeId(index),
    name,
    gemPath,
    resultKind,
    outputFormat: normalizeOutputFormat(mode.outputFormat, resultKind),
    primaryField: normalizeFieldName(mode.primaryField),
    negativeField: normalizeFieldName(mode.negativeField),
    tagFields: normalizeFieldList(mode.tagFields),
    metaFields: normalizeFieldList(mode.metaFields),
    rawFallback: mode.rawFallback !== false
  };
}

export function normalizeGemModes(value, { fallbackToDefault = true } = {}) {
  const list = Array.isArray(value) ? value : [];
  const usedIds = new Set();
  const usedPaths = new Set();
  const output = [];

  for (const [index, item] of list.entries()) {
    const normalized = normalizeModeItem(item, index);
    if (!normalized || usedIds.has(normalized.id) || usedPaths.has(normalized.gemPath)) {
      continue;
    }
    usedIds.add(normalized.id);
    usedPaths.add(normalized.gemPath);
    output.push(normalized);
  }

  if (output.length) {
    return output;
  }

  return fallbackToDefault ? DEFAULT_GEM_MODES.map((mode) => ({ ...mode })) : [];
}

export function getModeById(modes, id) {
  const normalized = normalizeGemModes(modes);
  return normalized.find((mode) => mode.id === id) || normalized[0] || null;
}

export async function getSettings() {
  const stored = await chrome.storage.local.get([
    "provider",
    "language",
    "allowedSites",
    "gemModes",
    "hoverActionsEnabled"
  ]);
  const gemModes =
    stored.gemModes === undefined
      ? DEFAULT_GEM_MODES.map((mode) => ({ ...mode }))
      : normalizeGemModes(stored.gemModes, { fallbackToDefault: false });
  const fallbackModes = gemModes.length ? gemModes : DEFAULT_GEM_MODES.map((mode) => ({ ...mode }));
  const provider =
    typeof stored.provider === "string" && fallbackModes.some((mode) => mode.id === stored.provider)
      ? stored.provider
      : fallbackModes[0].id;

  return {
    provider,
    language: typeof stored.language === "string" ? stored.language : DEFAULT_SETTINGS.language,
    allowedSites:
      stored.allowedSites === undefined || stored.allowedSites === null
        ? [...DEFAULT_SETTINGS.allowedSites]
        : normalizeAllowedSites(stored.allowedSites, { fallbackToDefault: false }),
    gemModes,
    hoverActionsEnabled:
      typeof stored.hoverActionsEnabled === "boolean"
        ? stored.hoverActionsEnabled
        : DEFAULT_SETTINGS.hoverActionsEnabled
  };
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = { ...current };

  if (partial.gemModes !== undefined) {
    next.gemModes = normalizeGemModes(partial.gemModes, { fallbackToDefault: false });
  }
  const modesForValidation = next.gemModes.length ? next.gemModes : DEFAULT_GEM_MODES;

  if (typeof partial.provider === "string" && modesForValidation.some((mode) => mode.id === partial.provider)) {
    next.provider = partial.provider;
  } else if (!modesForValidation.some((mode) => mode.id === next.provider)) {
    next.provider = modesForValidation[0].id;
  }

  if (typeof partial.language === "string") {
    next.language = partial.language;
  }
  if (partial.allowedSites !== undefined) {
    next.allowedSites = normalizeAllowedSites(partial.allowedSites, { fallbackToDefault: false });
  }
  if (partial.hoverActionsEnabled !== undefined) {
    next.hoverActionsEnabled = Boolean(partial.hoverActionsEnabled);
  }

  await chrome.storage.local.set({
    provider: next.provider,
    language: next.language,
    allowedSites: next.allowedSites,
    gemModes: next.gemModes,
    hoverActionsEnabled: next.hoverActionsEnabled
  });
  return next;
}
