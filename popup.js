import {
  getModeById,
  isUrlAllowed,
  normalizeAllowedSiteInput,
  normalizeGemPathInput
} from "./storage.js";

const I18N = {
  vi: {
    heading: "Prompt Bridge",
    intro: "Chuột phải vào ảnh để chọn mode. Phân tích qua tab Gemini Gem đã đăng nhập.",
    statusLabel: "Trạng thái",
    providerLabel: "Mode mặc định",
    hoverActionsLabel: "Hiện nút Faithful/Style khi hover ảnh",
    hoverActionsHint: "Mặc định tắt. Chuột phải vào ảnh để chọn mode (kể cả ảnh nhỏ / custom).",
    hoverActionsSaved: "Đã cập nhật tùy chọn hover.",
    modesLabel: "Modes",
    modeNameLabel: "Tên mode",
    modeNamePlaceholder: "Ví dụ: Fashion Prompt",
    modeGemLabel: "Gem URL hoặc ID",
    modeGemPlaceholder: "Dán link Gemini Gem hoặc ID",
    modeKindLabel: "Loại mode",
    modeKindPrompt: "Prompt",
    modeKindStyle: "Style",
    modeFormatLabel: "Định dạng đầu ra",
    modeFormatPrompt: "Prompt chuẩn",
    modeFormatStyle: "Style JSON chuẩn",
    modeFormatCustom: "Custom JSON",
    modePrimaryFieldLabel: "Field chính",
    modePrimaryFieldPlaceholder: "Ví dụ: lighting_prompt",
    modeNegativeFieldLabel: "Field negative",
    modeNegativeFieldPlaceholder: "Ví dụ: negative_prompt",
    modeTagFieldsLabel: "Field tags",
    modeTagFieldsPlaceholder: "Ví dụ: mood,lighting.direction",
    modeMetaFieldsLabel: "Field meta",
    modeMetaFieldsPlaceholder: "Ví dụ: lighting.direction,color_temperature",
    modePrimaryFieldEmpty: "Nhập field chính cho Custom JSON trước.",
    modeNote:
      "Mỗi mode trỏ tới một Gemini Gem riêng. Prompt/Style dùng parser mặc định; Custom JSON map field riêng.",
    addMode: "Thêm mode",
    modeListEmpty: "Chưa có mode nào.",
    modeAdded: (name) => `Đã thêm mode ${name}.`,
    modeRemoved: (name) => `Đã xóa mode ${name}.`,
    modeNameEmpty: "Nhập tên mode trước.",
    modeGemInvalid: "Gem URL hoặc ID không hợp lệ.",
    modeDuplicateGem: "Gem này đã có trong danh sách mode.",
    modeMinimum: "Cần giữ lại ít nhất một mode.",
    modeRemove: "Gỡ",
    modeKindPromptShort: "Prompt",
    modeKindStyleShort: "Style",
    modeFormatPromptShort: "Prompt",
    modeFormatStyleShort: "Style JSON",
    modeFormatCustomShort: "Custom JSON",
    openProvider: "Mở hoặc chuyển tới tab Gemini Gem",
    openProviderGemini: "Mở hoặc chuyển tới tab Gemini Gem",
    openPanel: "Mở panel trên tab hiện tại",
    purchase: "Mua Pro",
    planPro: "Pro - không giới hạn",
    planFree: "Miễn phí - còn {n}/{limit} lượt hôm nay",
    planLicense: "Pro - {plan}",
    planExpires: "Hết hạn {date}",
    planChipPro: "Pro",
    planChipFree: "Free",
    licenseLabel: "Mã kích hoạt",
    licensePlaceholder: "Nhập mã kích hoạt",
    activateLicense: "Kích hoạt key",
    removeLicense: "Gỡ key",
    purchaseFailed: "Không mở được trang mua.",
    purchaseUnavailable: "Chưa cấu hình PURCHASE_URL.",
    licenseActivated: "Đã kích hoạt license thành công.",
    licenseRemoved: "Đã gỡ license khỏi thiết bị này.",
    licenseEmpty: "Nhập mã kích hoạt trước khi kích hoạt.",
    licenseInvalid: "Mã kích hoạt không hợp lệ.",
    licenseExpired: "Mã kích hoạt đã hết hạn.",
    licenseNetwork: "Không xác minh được mã kích hoạt. Kiểm tra mạng hoặc backend license.",
    licenseDisabled: "Billing/license hiện chưa được bật.",
    checking: "Đang kiểm tra tab Gemini Gem...",
    checkingGemini: "Đang kiểm tra tab Gemini Gem...",
    statusReadable: "Không đọc được trạng thái Gemini Gem.",
    tabReady: (name) => `${name} đang mở và sẵn sàng nhận ảnh.`,
    tabNotOpen: (name) => `Chưa có tab ${name}. Bấm nút bên dưới để mở và đăng nhập.`,
    providerSaved: "Đã đổi mode mặc định.",
    saveFailed: "Không thể lưu cài đặt.",
    unknownProvider: "Mode không xác định.",
    opened: (name) => `Đã mở ${name}. Nếu cần, hãy đăng nhập rồi chạy phân tích.`,
    openProviderFailed: "Không thể mở tab Gemini Gem.",
    panelOpened: "Đã mở panel trên tab hiện tại.",
    openPanelFailed: "Không thể mở panel.",
    sitesLabel: "Website được bật",
    siteInputLabel: "Thêm website",
    siteInputPlaceholder: "Dán URL hoặc domain, ví dụ behance.net",
    siteNote: "Bạn có thể dán full URL hoặc chỉ domain. Subdomain như www.behance.net cũng sẽ được áp dụng.",
    siteLoading: "Đang đọc website hiện tại...",
    siteAllowed: (host) => `${host} đang được bật.`,
    siteBlocked: (host) => `${host} chưa được bật. Hãy thêm site này trước khi dùng panel.`,
    siteUnknown: "Không đọc được website hiện tại.",
    siteAdded: (host) => `Đã bật ${host}.`,
    siteRemoved: (host) => `Đã tắt ${host}.`,
    siteExists: "Website này đã có trong danh sách.",
    siteInvalid: "URL hoặc domain không hợp lệ.",
    addSite: "Thêm website",
    addCurrentSite: "Bật website hiện tại",
    removeSite: "Gỡ",
    siteListEmpty: "Danh sách đang trống. BromptCard sẽ im cho tới khi bạn thêm website.",
    loadFailed: "Không thể tải cài đặt.",
    timedOut: (type) => `Hết thời gian chờ ${type}. Hãy tải lại tiện ích và thử lại.`
  },
  en: {
    heading: "Prompt Bridge",
    intro: "Right-click any image to pick a mode. Analysis runs through your signed-in Gemini Gem tab.",
    statusLabel: "Status",
    providerLabel: "Default mode",
    hoverActionsLabel: "Show Faithful/Style buttons on image hover",
    hoverActionsHint: "Off by default. Right-click any image to pick a mode (including small images / custom modes).",
    hoverActionsSaved: "Hover option updated.",
    modesLabel: "Modes",
    modeNameLabel: "Mode name",
    modeNamePlaceholder: "Example: Fashion Prompt",
    modeGemLabel: "Gem URL or ID",
    modeGemPlaceholder: "Paste a Gemini Gem link or ID",
    modeKindLabel: "Mode type",
    modeKindPrompt: "Prompt",
    modeKindStyle: "Style",
    modeFormatLabel: "Output format",
    modeFormatPrompt: "Standard prompt",
    modeFormatStyle: "Standard style JSON",
    modeFormatCustom: "Custom JSON",
    modePrimaryFieldLabel: "Primary field",
    modePrimaryFieldPlaceholder: "Example: lighting_prompt",
    modeNegativeFieldLabel: "Negative field",
    modeNegativeFieldPlaceholder: "Example: negative_prompt",
    modeTagFieldsLabel: "Tag fields",
    modeTagFieldsPlaceholder: "Example: mood,lighting.direction",
    modeMetaFieldsLabel: "Meta fields",
    modeMetaFieldsPlaceholder: "Example: lighting.direction,color_temperature",
    modePrimaryFieldEmpty: "Enter the primary field for Custom JSON first.",
    modeNote:
      "Each mode points to its own Gemini Gem. Prompt/Style use built-in parsers; Custom JSON maps your own fields.",
    addMode: "Add mode",
    modeListEmpty: "No modes yet.",
    modeAdded: (name) => `Added mode ${name}.`,
    modeRemoved: (name) => `Removed mode ${name}.`,
    modeNameEmpty: "Enter a mode name first.",
    modeGemInvalid: "Invalid Gem URL or ID.",
    modeDuplicateGem: "That Gem is already in the mode list.",
    modeMinimum: "Keep at least one mode.",
    modeRemove: "Remove",
    modeKindPromptShort: "Prompt",
    modeKindStyleShort: "Style",
    modeFormatPromptShort: "Prompt",
    modeFormatStyleShort: "Style JSON",
    modeFormatCustomShort: "Custom JSON",
    openProvider: "Open or focus Gemini Gem tab",
    openProviderGemini: "Open or focus Gemini Gem tab",
    openPanel: "Open panel on active tab",
    purchase: "Buy Pro",
    planPro: "Pro - unlimited",
    planFree: "Free - {n}/{limit} uses left today",
    planLicense: "Pro - {plan}",
    planExpires: "Expires {date}",
    planChipPro: "Pro",
    planChipFree: "Free",
    licenseLabel: "License key",
    licensePlaceholder: "Paste your license key",
    activateLicense: "Activate key",
    removeLicense: "Remove key",
    purchaseFailed: "Could not open the purchase page.",
    purchaseUnavailable: "PURCHASE_URL is not configured.",
    licenseActivated: "License activated successfully.",
    licenseRemoved: "License removed from this device.",
    licenseEmpty: "Enter a license key before activating.",
    licenseInvalid: "License key is invalid.",
    licenseExpired: "License key has expired.",
    licenseNetwork: "Could not verify the license key. Check the network or license backend.",
    licenseDisabled: "Billing/license is currently disabled.",
    checking: "Checking Gemini Gem tab...",
    checkingGemini: "Checking Gemini Gem tab...",
    statusReadable: "Could not read Gemini Gem status.",
    tabReady: (name) => `${name} is open and ready to receive images.`,
    tabNotOpen: (name) => `${name} is not open yet. Use the button below to open it and sign in.`,
    providerSaved: "Default mode updated.",
    saveFailed: "Could not save settings.",
    unknownProvider: "Unknown mode.",
    opened: (name) => `Opened ${name}. Sign in if needed, then run analysis.`,
    openProviderFailed: "Could not open the Gemini Gem tab.",
    panelOpened: "Panel opened on the active tab.",
    openPanelFailed: "Could not open the panel.",
    sitesLabel: "Enabled sites",
    siteInputLabel: "Add a site",
    siteInputPlaceholder: "Paste a URL or domain, e.g. behance.net",
    siteNote: "You can paste a full URL or just a domain. Subdomains such as www.behance.net are covered too.",
    siteLoading: "Reading the current site...",
    siteAllowed: (host) => `${host} is enabled.`,
    siteBlocked: (host) => `${host} is not enabled yet. Add it before opening the panel.`,
    siteUnknown: "Could not read the current site.",
    siteAdded: (host) => `Enabled ${host}.`,
    siteRemoved: (host) => `Disabled ${host}.`,
    siteExists: "That site is already in the list.",
    siteInvalid: "Invalid URL or domain.",
    addSite: "Add site",
    addCurrentSite: "Enable current site",
    removeSite: "Remove",
    siteListEmpty: "The list is empty. BromptCard stays quiet until you add a site.",
    loadFailed: "Could not load settings.",
    timedOut: (type) => `Request timed out while waiting for ${type}. Reload the extension and try again.`
  }
};

let lang = "vi";
let currentSettings = null;
let activeTabSite = null;

function t(key, arg) {
  const table = I18N[lang] || I18N.vi;
  const value = table[key] != null ? table[key] : I18N.vi[key];
  return typeof value === "function" ? value(arg) : value;
}

function applyStaticI18n() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.getAttribute("data-i18n"));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.getAttribute("data-i18n-placeholder")));
  });
}

const hoverActionsEnabledInput = document.getElementById("hoverActionsEnabled");
const providerSelect = document.getElementById("provider");
const modeNameInput = document.getElementById("modeNameInput");
const modeGemInput = document.getElementById("modeGemInput");
const modeKindSelect = document.getElementById("modeKindSelect");
const modeFormatSelect = document.getElementById("modeFormatSelect");
const modeAdvancedFields = document.getElementById("modeAdvancedFields");
const modePrimaryFieldInput = document.getElementById("modePrimaryFieldInput");
const modeNegativeFieldInput = document.getElementById("modeNegativeFieldInput");
const modeTagFieldsInput = document.getElementById("modeTagFieldsInput");
const modeMetaFieldsInput = document.getElementById("modeMetaFieldsInput");
const addModeButton = document.getElementById("addModeButton");
const modeList = document.getElementById("modeList");
const statusBox = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const openProviderButton = document.getElementById("openProviderButton");
const openPanelButton = document.getElementById("openPanelButton");
const message = document.getElementById("message");
const siteSummary = document.getElementById("siteSummary");
const siteInput = document.getElementById("siteInput");
const addSiteButton = document.getElementById("addSiteButton");
const addCurrentSiteButton = document.getElementById("addCurrentSiteButton");
const siteList = document.getElementById("siteList");

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = `message${type ? ` is-${type}` : ""}`;
}

function setStatus(text, type = "") {
  statusBox.textContent = text;
  statusDot.className = `status-dot${type ? ` is-${type}` : ""}`;
}

function syncProviderUi() {
  if (hoverActionsEnabledInput) {
    hoverActionsEnabledInput.checked = Boolean(currentSettings?.hoverActionsEnabled);
  }
  if (openProviderButton) {
    openProviderButton.textContent = t("openProviderGemini");
  }
}

function setBusy(isBusy) {
  [
    hoverActionsEnabledInput,
    providerSelect,
    modeNameInput,
    modeGemInput,
    modeKindSelect,
    modeFormatSelect,
    modePrimaryFieldInput,
    modeNegativeFieldInput,
    modeTagFieldsInput,
    modeMetaFieldsInput,
    addModeButton,
    openProviderButton,
    openPanelButton,
    siteInput,
    addSiteButton,
    addCurrentSiteButton
  ].forEach((node) => {
    if (node) node.disabled = isBusy;
  });
}

function gemModes() {
  return Array.isArray(currentSettings?.gemModes) ? currentSettings.gemModes : [];
}

function allowedSites() {
  return Array.isArray(currentSettings?.allowedSites) ? currentSettings.allowedSites : [];
}

function selectedMode() {
  return getModeById(gemModes(), providerSelect.value);
}

function parseFieldList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function modeFormatLabel(value) {
  if (value === "style") return t("modeFormatStyleShort");
  if (value === "custom_json") return t("modeFormatCustomShort");
  return t("modeFormatPromptShort");
}

function modeKindLabel(value) {
  return value === "style" ? t("modeKindStyleShort") : t("modeKindPromptShort");
}

function syncModeFormatControls() {
  const isCustom = modeFormatSelect.value === "custom_json";
  modeAdvancedFields.hidden = !isCustom;
  modePrimaryFieldInput.required = isCustom;
}

function fillProviders() {
  providerSelect.innerHTML = "";
  for (const mode of gemModes()) {
    const option = document.createElement("option");
    option.value = mode.id;
    option.textContent = mode.name;
    providerSelect.appendChild(option);
  }
  providerSelect.value = currentSettings?.provider || gemModes()[0]?.id || "";
}

function renderModeList() {
  const modes = gemModes();
  if (!modes.length) {
    modeList.innerHTML = `<div class="site-empty">${t("modeListEmpty")}</div>`;
    return;
  }
  const defaultId = currentSettings?.provider || modes[0].id;
  modeList.innerHTML = modes.map((mode) => {
    const parts = [modeFormatLabel(mode.outputFormat), modeKindLabel(mode.resultKind), `gem/${mode.gemPath}`];
    if (mode.outputFormat === "custom_json" && mode.primaryField) parts.unshift(mode.primaryField);
    const meta = parts.join(" · ");
    const label = mode.id === defaultId ? `${mode.name} · ${t("providerLabel")}` : mode.name;
    return `
      <div class="site-item">
        <div class="site-item-copy">
          <div class="site-host">${label}</div>
          <div class="site-meta">${meta}</div>
        </div>
        <button class="ghost site-remove" type="button" data-remove-mode="${mode.id}">${t("modeRemove")}</button>
      </div>
    `;
  }).join("");

  modeList.querySelectorAll("[data-remove-mode]").forEach((button) => {
    button.addEventListener("click", () => removeMode(button.getAttribute("data-remove-mode")));
  });
}

async function getActiveTabSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = typeof tab?.url === "string" ? tab.url : "";
  const host = normalizeAllowedSiteInput(url);
  return { url, host };
}

function renderSiteSummary() {
  if (!activeTabSite?.host) {
    siteSummary.textContent = t("siteUnknown");
    addCurrentSiteButton.disabled = true;
    return;
  }
  const enabled = isUrlAllowed(activeTabSite.url, allowedSites());
  siteSummary.textContent = enabled ? t("siteAllowed", activeTabSite.host) : t("siteBlocked", activeTabSite.host);
  addCurrentSiteButton.disabled = enabled;
}

async function removeAllowedSite(host) {
  const nextSites = allowedSites().filter((item) => item !== host);
  await saveAllowedSites(nextSites, t("siteRemoved", host));
}

function renderSiteList() {
  const sites = allowedSites();
  if (!sites.length) {
    siteList.innerHTML = `<div class="site-empty">${t("siteListEmpty")}</div>`;
    return;
  }
  siteList.innerHTML = sites.map((site) => `
    <div class="site-item">
      <div class="site-item-copy"><div class="site-host">${site}</div></div>
      <button class="ghost site-remove" type="button" data-remove-site="${site}">${t("removeSite")}</button>
    </div>
  `).join("");
  siteList.querySelectorAll("[data-remove-site]").forEach((button) => {
    button.addEventListener("click", () => removeAllowedSite(button.getAttribute("data-remove-site")));
  });
}

function renderSiteControls() {
  renderSiteSummary();
  renderSiteList();
}

function renderModeControls() {
  fillProviders();
  renderModeList();
  syncModeFormatControls();
}

async function rpc(type, payload) {
  return Promise.race([
    chrome.runtime.sendMessage({ type, payload }),
    new Promise((_, reject) => setTimeout(() => reject(new Error(t("timedOut", type))), 20000))
  ]);
}

async function loadSettings() {
  const response = await rpc("PROMPTCARD_GET_SETTINGS");
  const settings = response?.data?.settings || {};
  lang = settings.language === "en" ? "en" : "vi";
  currentSettings = settings;
  applyStaticI18n();
  syncProviderUi();
  renderModeControls();
  activeTabSite = await getActiveTabSite();
  renderSiteControls();
  await refreshStatus();
}

async function refreshStatus() {
  setStatus(t("checkingGemini"));
  try {
    const mode = selectedMode();
    if (!mode) throw new Error(t("unknownProvider"));
    const response = await rpc("PROMPTCARD_PROVIDER_STATUS", { provider: mode.id });
    if (!response?.ok) throw new Error(response?.error || t("statusReadable"));
    const status = response.data.status;
    if (status.open) setStatus(t("tabReady", status.providerName), "success");
    else setStatus(t("tabNotOpen", status.providerName), "warn");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("statusReadable"), "error");
  }
}

async function saveSettingsPatch(patch, successMessage = "") {
  try {
    const response = await rpc("PROMPTCARD_SAVE_SETTINGS", patch);
    if (!response?.ok) throw new Error(response?.error || t("saveFailed"));
    currentSettings = response.data?.settings || currentSettings;
    syncProviderUi();
    renderModeControls();
    activeTabSite = await getActiveTabSite();
    renderSiteControls();
    if (successMessage) setMessage(successMessage, "success");
    await refreshStatus();
    return true;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("saveFailed"), "error");
    return false;
  }
}

async function saveProviderSelection(showNotice = false) {
  const mode = selectedMode();
  if (!mode) {
    setMessage(t("unknownProvider"), "error");
    return;
  }
  await saveSettingsPatch({ provider: mode.id }, showNotice ? t("providerSaved") : "");
}

function buildNewMode() {
  const name = modeNameInput.value.trim();
  if (!name) throw new Error(t("modeNameEmpty"));
  const gemPath = normalizeGemPathInput(modeGemInput.value);
  if (!gemPath) throw new Error(t("modeGemInvalid"));
  if (gemModes().some((mode) => mode.gemPath === gemPath)) throw new Error(t("modeDuplicateGem"));
  const outputFormat = modeFormatSelect.value === "custom_json" ? "custom_json" : modeFormatSelect.value === "style" ? "style" : "prompt";
  const resultKind = modeKindSelect.value === "style" ? "style" : "prompt";
  const primaryField = modePrimaryFieldInput.value.trim();
  if (outputFormat === "custom_json" && !primaryField) throw new Error(t("modePrimaryFieldEmpty"));
  return {
    id: `mode_${crypto.randomUUID()}`,
    name,
    gemPath,
    resultKind,
    outputFormat,
    primaryField,
    negativeField: modeNegativeFieldInput.value.trim(),
    tagFields: parseFieldList(modeTagFieldsInput.value),
    metaFields: parseFieldList(modeMetaFieldsInput.value),
    rawFallback: true
  };
}

async function addMode() {
  try {
    const nextModes = [...gemModes(), buildNewMode()];
    const saved = await saveSettingsPatch({ gemModes: nextModes }, t("modeAdded", nextModes[nextModes.length - 1].name));
    if (saved) {
      modeNameInput.value = "";
      modeGemInput.value = "";
      modeKindSelect.value = "prompt";
      modeFormatSelect.value = "prompt";
      modePrimaryFieldInput.value = "";
      modeNegativeFieldInput.value = "";
      modeTagFieldsInput.value = "";
      modeMetaFieldsInput.value = "";
      syncModeFormatControls();
    }
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("saveFailed"), "warn");
  }
}

async function removeMode(modeId) {
  const modes = gemModes();
  if (modes.length <= 1) {
    setMessage(t("modeMinimum"), "warn");
    return;
  }
  const mode = modes.find((item) => item.id === modeId);
  const nextModes = modes.filter((item) => item.id !== modeId);
  await saveSettingsPatch(
    { gemModes: nextModes, provider: currentSettings?.provider === modeId ? nextModes[0].id : currentSettings?.provider },
    t("modeRemoved", mode?.name || modeId)
  );
}

async function saveAllowedSites(nextSites, successMessage = "") {
  await saveSettingsPatch({ allowedSites: nextSites }, successMessage);
}

async function addAllowedSite(rawValue) {
  const host = normalizeAllowedSiteInput(rawValue);
  if (!host) {
    setMessage(t("siteInvalid"), "warn");
    return;
  }
  if (allowedSites().includes(host)) {
    setMessage(t("siteExists"), "warn");
    return;
  }
  await saveAllowedSites([...allowedSites(), host], t("siteAdded", host));
  siteInput.value = "";
}

function modeHomeUrl(mode) {
  return `https://gemini.google.com/gem/${mode.gemPath}?usp=sharing`;
}

async function openProviderTab() {
  setBusy(true);
  setMessage("");
  try {
    const mode = selectedMode();
    if (!mode) throw new Error(t("unknownProvider"));
    const response = await rpc("PROMPTCARD_PROVIDER_STATUS", { provider: mode.id });
    const status = response?.ok ? response.data?.status : null;
    const label = status?.providerName || mode.name;
    if (status?.open && Number.isInteger(status.tabId)) {
      const tab = await chrome.tabs.get(status.tabId);
      if (typeof tab.windowId === "number") await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.tabs.update(status.tabId, { active: true });
    } else {
      await chrome.tabs.create({ url: modeHomeUrl(mode), active: true });
    }
    setMessage(t("opened", label), "success");
    await refreshStatus();
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("openProviderFailed"), "error");
  } finally {
    setBusy(false);
  }
}

async function openPanel() {
  setBusy(true);
  setMessage("");
  try {
    const response = await rpc("PROMPTCARD_OPEN_ACTIVE_PANEL");
    if (!response?.ok) throw new Error(response?.error || t("openPanelFailed"));
    setMessage(t("panelOpened"), "success");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : t("openPanelFailed"), "error");
  } finally {
    setBusy(false);
  }
}

applyStaticI18n();
syncModeFormatControls();
syncProviderUi();

hoverActionsEnabledInput?.addEventListener("change", () => {
  setMessage("");
  saveSettingsPatch(
    { hoverActionsEnabled: Boolean(hoverActionsEnabledInput.checked) },
    t("hoverActionsSaved")
  );
});

openProviderButton.addEventListener("click", openProviderTab);
openPanelButton.addEventListener("click", openPanel);
addModeButton.addEventListener("click", () => {
  setMessage("");
  addMode();
});
modeFormatSelect.addEventListener("change", syncModeFormatControls);
modeKindSelect.addEventListener("change", () => {
  if (modeFormatSelect.value !== "custom_json") {
    modeFormatSelect.value = modeKindSelect.value === "style" ? "style" : "prompt";
    syncModeFormatControls();
  }
});
modeGemInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addMode();
  }
});
modeNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addMode();
  }
});
addSiteButton.addEventListener("click", () => {
  setMessage("");
  addAllowedSite(siteInput.value);
});
addCurrentSiteButton.addEventListener("click", () => {
  setMessage("");
  addAllowedSite(activeTabSite?.url || activeTabSite?.host || "");
});
siteInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addAllowedSite(siteInput.value);
  }
});
providerSelect.addEventListener("change", () => {
  setMessage("");
  saveProviderSelection(true);
});

loadSettings().catch((error) => {
  setStatus(t("loadFailed"), "error");
  setMessage(error instanceof Error ? error.message : t("loadFailed"), "error");
});
