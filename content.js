(function () {
  if (window.__promptCardMvpLoaded) {
    return;
  }
  window.__promptCardMvpLoaded = true;

  const ROOT_ID = "promptcard-mvp-root";
  const HISTORY_KEY = "promptcardMvpHistory";
  const HISTORY_VISIBLE_KEY = "promptcardMvpHistoryVisible";
  const PANEL_SIZE_KEY = "promptcardMvpPanelSize";
  const OVERLAY_ENABLED_KEY = "promptcardMvpOverlayEnabled";
  const HOVER_ACTIONS_KEY = "hoverActionsEnabled";
  const ALLOWED_SITES_KEY = "allowedSites";
  const SETTINGS_KEYS = ["provider", "language", "gemModes", "hoverActionsEnabled"];
  const HISTORY_LIMIT = 18;
  const PANEL_MIN_W = 380;
  const PANEL_MIN_H = 460;
  const DEFAULT_ALLOWED_SITES = ["pinterest.com"];
  const DOCK_SNAP_EDGE = 12;

  let root;
  let shadow;
  let hoveredImage = null;
  let historyLoaded = false;
  let dockTrayOpen = false;
  /** Last right-click point — used when context menu is on a pin link, not the img itself. */
  let lastContextPoint = { x: 0, y: 0 };
  const panelOffset = { x: 0, y: 0 };
  const panelSize = { width: 0, height: 0 };

  const state = {
    panelOpen: false,
    status: "idle",
    error: "",
    result: null,
    target: null,
    mode: "mode_faithful",
    language: "vi",
    provider: "mode_faithful",
    modes: [],
    history: [],
    activeHistoryId: null,
    historyVisible: true,
    minimized: false,
    // Synced with settings.hoverActionsEnabled (default off — avoids mis-clicks).
    overlayEnabled: false,
    quota: null,
    siteAllowed: false,
    progress: 0,
    progressLabel: ""
  };

  let progressTimer = null;

  const I18N = {
    vi: {
      titleResult: "Kết quả phân tích",
      copy: "Sao chép",
      copiedLabel: "Đã chép",
      copyFailed: "Không thể sao chép vào clipboard.",
      history: "Lịch sử",
      local: "Cục bộ",
      screenshotCrop: "Cắt ảnh màn hình",
      close: "Đóng",
      clearHistory: "Xóa lịch sử",
      toggleHistory: "Ẩn/hiện lịch sử",
      deleteEntry: "Xóa khỏi lịch sử",
      minimize: "Thu nhỏ",
      overlayLabel: "Nút hover Faithful/Style",
      expandPanel: "Mở bảng điều khiển",
      exitQuickAccess: "Ẩn nút tròn",
      dockScreenshot: "Cắt màn hình",
      hoverAnalyze: "Faithful",
      modeFaithful: "Faithful",
      modeStyle: "Style",
      hoverStyle: "Style",
      quotaLeft: "Còn {n} lượt miễn phí hôm nay",
      quotaPro: "Pro - không giới hạn",
      quotaExhausted: "Đã hết lượt miễn phí hôm nay. Nâng cấp Pro để dùng tiếp.",
      styleLoading: "Đang trích xuất phong cách từ ảnh. Giữ tab Gemini Gem luôn đăng nhập.",
      styleTransfer: "Prompt chuyển phong cách",
      styleNegative: "Negative prompt",
      styleNotCopy: "Không sao chép",
      styleReplace: "Hướng dẫn thay thế",
      styleDomain: "Loại nội dung",
      styleFamily: "Họ phong cách",
      stylePriority: "Ưu tiên chuyển",
      dragHint: "Kéo để chọn một vùng, rồi bấm Phân tích",
      selRetry: "Chọn lại",
      selConfirm: "Phân tích",
      selCancel: "Hủy",
      loading: "Đang gửi ảnh tới tab Gemini Gem và đọc phản hồi. Hãy giữ tab đó luôn đăng nhập.",
      progressTitle: "Đang phân tích ảnh",
      progressPrepare: "Đang chuẩn bị ảnh…",
      progressSend: "Đang gửi tới Gemini…",
      progressWait: "Đang tạo prompt…",
      progressParse: "Đang đọc kết quả…",
      analysisFailed: "Phân tích thất bại.",
      setupNote: "Chuột phải vào ảnh → chọn mode (Faithful / Style / custom). Nút hover có thể bật trong popup hoặc nút tròn. Cắt màn hình từ panel hoặc menu trang. Mở Gemini Gem và đăng nhập trước. Lịch sử lưu cục bộ.",
      analyzeLargest: "Phân tích ảnh lớn nhất trên trang",
      historyEmpty: "Chưa có lịch sử cục bộ. Phân tích một ảnh và nó sẽ hiện ở đây.",
      noImage: "Không có nguồn ảnh.",
      noContextImage: "Không tìm thấy ảnh trong thẻ này. Thử chuột phải trực tiếp lên hình, hoặc dùng Cắt màn hình.",
      noLargeImage: "Không tìm thấy ảnh lớn nào hiển thị trên trang này.",
      screenshotFailed: "Không thể phân tích ảnh màn hình.",
      untitled: "Phân tích chưa đặt tên",
      captureFailed: "Không thể chụp tab hiện tại.",
      loadShotFailed: "Không thể tải ảnh chụp màn hình.",
      cropFailed: "Không thể chuẩn bị vùng cắt.",
      contextLost: "BromptCard vừa được tải lại. Hãy làm mới trang này (F5) để kết nối lại tiện ích."
    },
    en: {
      titleResult: "Analysis result",
      copy: "Copy",
      copiedLabel: "Copied",
      copyFailed: "Could not copy to clipboard.",
      history: "History",
      local: "Local",
      screenshotCrop: "Screenshot crop",
      close: "Close",
      clearHistory: "Clear history",
      toggleHistory: "Toggle history",
      deleteEntry: "Remove from history",
      minimize: "Minimize",
      overlayLabel: "Hover Faithful/Style buttons",
      expandPanel: "Open panel",
      exitQuickAccess: "Hide dock",
      dockScreenshot: "Screenshot crop",
      hoverAnalyze: "Faithful",
      modeFaithful: "Faithful",
      modeStyle: "Style",
      hoverStyle: "Style",
      quotaLeft: "{n} free uses left today",
      quotaPro: "Pro - unlimited",
      quotaExhausted: "Out of free uses today. Upgrade to Pro to continue.",
      styleLoading: "Extracting the visual style from the image. Keep the Gemini Gem tab signed in.",
      styleTransfer: "Style transfer prompt",
      styleNegative: "Negative prompt",
      styleNotCopy: "Do not copy",
      styleReplace: "Replacement instructions",
      styleDomain: "Content domain",
      styleFamily: "Style family",
      stylePriority: "Transfer priority",
      dragHint: "Drag to crop an area, then click Analyze",
      selRetry: "Retry",
      selConfirm: "Analyze",
      selCancel: "Cancel",
      loading: "Sending the image to your Gemini Gem tab and reading the reply. Keep that tab signed in.",
      progressTitle: "Analyzing image",
      progressPrepare: "Preparing image…",
      progressSend: "Sending to Gemini…",
      progressWait: "Building your prompt…",
      progressParse: "Reading the result…",
      analysisFailed: "Analysis failed.",
      setupNote: "Right-click any image → pick a mode (Faithful / Style / custom). Hover chips are optional (popup or dock toggle). Screenshot from the panel or page menu. Open Gemini Gem and sign in first. History stays local.",
      analyzeLargest: "Analyze largest image on page",
      historyEmpty: "No local history yet. Analyze an image and it will appear here.",
      noImage: "No image source was provided.",
      noContextImage: "Could not find an image in this card. Right-click the picture itself, or use Screenshot crop.",
      noLargeImage: "No large visible image was found on this page.",
      screenshotFailed: "Could not analyze screenshot.",
      untitled: "Untitled analysis",
      captureFailed: "Could not capture the visible tab.",
      loadShotFailed: "Could not load the screenshot.",
      cropFailed: "Could not prepare the screenshot crop.",
      contextLost: "BromptCard was reloaded. Refresh this page (F5) to reconnect the extension."
    }
  };

  function uiLang() {
    return state.language === "en" ? "en" : "vi";
  }

  function t(key) {
    const lang = uiLang();
    if (key === "disabledSite") {
      return lang === "en"
        ? "BromptCard is disabled on this site. Add the site in the popup first."
        : "BromptCard dang tat tren website nay. Hay them site trong popup truoc.";
    }
    return (I18N[lang] && I18N[lang][key]) || I18N.vi[key] || key;
  }

  function contextLostMessage() {
    return t("contextLost");
  }

  function normalizeModeName(value) {
    return String(value || "").trim().slice(0, 40);
  }

  function normalizeModeResultKind(value) {
    return value === "style" ? "style" : "prompt";
  }

  function fallbackModes() {
    return [
      { id: "mode_faithful", name: t("modeFaithful"), resultKind: "prompt", outputFormat: "prompt" },
      { id: "mode_style", name: t("modeStyle"), resultKind: "style", outputFormat: "style" }
    ];
  }

  function normalizeModeList(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    const output = [];
    for (const [index, item] of list.entries()) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim() : `mode_${index + 1}`;
      if (seen.has(id)) {
        continue;
      }
      const name = normalizeModeName(item.name);
      if (!name) {
        continue;
      }
      seen.add(id);
      output.push({
        id,
        name,
        resultKind: normalizeModeResultKind(item.resultKind),
        outputFormat: typeof item.outputFormat === "string" ? item.outputFormat : normalizeModeResultKind(item.resultKind)
      });
    }
    return output.length ? output : fallbackModes();
  }

  function modes() {
    return state.modes.length ? state.modes : fallbackModes();
  }

  function modeById(modeId) {
    return modes().find((item) => item.id === modeId) || modes()[0];
  }

  function resolveResultKind(result) {
    if (result?.kind === "style") {
      return "style";
    }
    if (result?.kind === "mapped") {
      return result.resultKind === "style" ? "style" : "prompt";
    }
    return "prompt";
  }

  async function refreshRuntimeSettings() {
    if (!isExtensionAlive()) {
      state.modes = fallbackModes();
      state.provider = fallbackModes()[0].id;
      state.mode = state.provider;
      state.language = "vi";
      return;
    }

    try {
      const stored = await chrome.storage.local.get([...SETTINGS_KEYS, OVERLAY_ENABLED_KEY]);
      state.modes = normalizeModeList(stored.gemModes);
      state.provider =
        typeof stored.provider === "string" && state.modes.some((mode) => mode.id === stored.provider)
          ? stored.provider
          : state.modes[0].id;
      state.mode = state.modes.some((mode) => mode.id === state.mode) ? state.mode : state.provider;
      state.language = stored.language === "en" ? "en" : "vi";
      // Prefer shared settings key; fall back to legacy overlay key once.
      if (typeof stored.hoverActionsEnabled === "boolean") {
        state.overlayEnabled = stored.hoverActionsEnabled;
      } else if (typeof stored[OVERLAY_ENABLED_KEY] === "boolean") {
        state.overlayEnabled = stored[OVERLAY_ENABLED_KEY];
      }
    } catch {
      state.modes = fallbackModes();
      state.provider = state.modes[0].id;
      state.mode = state.provider;
      state.language = "vi";
    }
  }

  function normalizeHost(host) {
    return String(host || "")
      .trim()
      .toLowerCase()
      .replace(/^\.+|\.+$/g, "")
      .replace(/^www\./, "");
  }

  function normalizeAllowedSites(value) {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set();
    const output = [];
    for (const item of list) {
      let host = "";
      try {
        const raw = String(item || "").trim();
        if (!raw) {
          continue;
        }
        const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
        host = normalizeHost(new URL(withScheme).hostname);
      } catch {
        host = "";
      }
      if (!host || seen.has(host)) {
        continue;
      }
      seen.add(host);
      output.push(host);
    }
    return output.length ? output : [...DEFAULT_ALLOWED_SITES];
  }

  function currentHost() {
    try {
      return normalizeHost(location.hostname);
    } catch {
      return "";
    }
  }

  function isCurrentSiteAllowed(allowedSites) {
    const host = currentHost();
    const list = normalizeAllowedSites(allowedSites);
    return list.some((allowedHost) => host === allowedHost || host.endsWith(`.${allowedHost}`));
  }

  function isExtensionAlive() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch {
      return false;
    }
  }

  function isContextLostError(error) {
    const message = error instanceof Error ? error.message : String(error || "");
    return /Extension context invalidated|context invalidated|message port closed|receiving end does not exist/i.test(
      message
    );
  }

  async function sendMessageSafe(message) {
    if (!isExtensionAlive()) {
      throw new Error(contextLostMessage());
    }
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      if (isContextLostError(error) || !isExtensionAlive()) {
        throw new Error(contextLostMessage());
      }
      throw error;
    }
  }

  function ensureRoot() {
    if (root) {
      return;
    }

    root = document.createElement("div");
    root.id = ROOT_ID;
    document.documentElement.appendChild(root);
    shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host, * {
          box-sizing: border-box;
        }

        .overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483646;
          pointer-events: none;
          font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
          color: #f4f6f8;
        }

        .workspace {
          position: fixed;
          top: 24px;
          left: 24px;
          display: none;
          gap: 16px;
          align-items: stretch;
          pointer-events: none;
        }

        .workspace.open {
          display: flex;
        }

        @keyframes pc-pop-in {
          0% { transform: scale(0.92); opacity: 0; }
          60% { transform: scale(1.015); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        .workspace.open .main-panel {
          animation: pc-pop-in 0.42s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .icon-button[aria-pressed="true"] {
          background: rgba(255, 255, 255, 0.26);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .main-panel,
        .history-rail {
          pointer-events: auto;
          border-radius: 28px;
          overflow: hidden;
          background:
            linear-gradient(180deg, rgba(165, 172, 179, 0.86), rgba(122, 130, 138, 0.84));
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow:
            0 28px 90px rgba(0, 0, 0, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(22px) saturate(1.08);
          -webkit-backdrop-filter: blur(22px) saturate(1.08);
        }

        .main-panel {
          position: relative;
          width: min(520px, calc(100vw - 132px));
          min-height: min(760px, calc(100vh - 48px));
          max-height: calc(100vh - 48px);
          display: flex;
          flex-direction: column;
        }

        .history-rail {
          position: absolute;
          top: 0;
          left: calc(100% + 16px);
          height: 100%;
          width: min(206px, calc(100vw - 32px));
          display: flex;
          flex-direction: column;
          transform-origin: left center;
          transform: translateX(0) scale(1);
          opacity: 1;
          transition:
            transform 0.44s cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 0.3s ease;
        }

        .workspace.history-hidden .history-rail {
          transform: translateX(-28px) scale(0.84);
          opacity: 0;
          pointer-events: none;
          transition:
            transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.2s ease;
        }

        .panel-header,
        .history-header {
          padding: 18px 22px 10px;
        }

        .panel-header {
          cursor: grab;
          touch-action: none;
        }

        .workspace.dragging .panel-header {
          cursor: grabbing;
        }

        .workspace.dragging {
          user-select: none;
        }

        .header-actions {
          cursor: default;
        }

        .panel-topline,
        .history-topline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .eyebrow {
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: 12px;
          font-weight: 700;
          color: rgba(244, 246, 248, 0.86);
        }

        .header-actions,
        .history-actions {
          display: flex;
          gap: 8px;
        }

        .icon-button {
          appearance: none;
          border: 0;
          width: 36px;
          height: 36px;
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.92);
          background: rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.18s ease, transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .icon-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .icon-button:active {
          transform: scale(0.9);
        }

        .pc-icon {
          width: 17px;
          height: 17px;
          display: block;
          pointer-events: none;
        }

        .title {
          margin: 10px 0 12px;
          font-size: 52px;
          line-height: 0.96;
          font-weight: 820;
          letter-spacing: -0.04em;
          color: rgba(255, 255, 255, 0.96);
        }

        .body {
          flex: 1;
          overflow: auto;
          padding: 0 22px 16px;
        }

        .resize-handle {
          position: absolute;
          right: 6px;
          bottom: 6px;
          width: 20px;
          height: 20px;
          cursor: nwse-resize;
          pointer-events: auto;
          opacity: 0.55;
          transition: opacity 0.2s ease;
          background:
            linear-gradient(135deg, transparent 0 45%, rgba(255,255,255,0.85) 45% 55%, transparent 55% 70%, rgba(255,255,255,0.85) 70% 80%, transparent 80%);
          border-radius: 0 0 12px 0;
        }

        .resize-handle:hover {
          opacity: 0.95;
        }

        .workspace:not(.history-hidden) .resize-handle {
          display: none;
        }

        .workspace.resizing,
        .workspace.resizing * {
          user-select: none;
        }

        .lead,
        .error,
        .analysis-text,
        .setup-note {
          margin: 0;
          color: rgba(245, 247, 249, 0.94);
          font-size: 15px;
          line-height: 1.7;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .error {
          color: #ffe6e0;
        }

        .hint-card,
        .preview-card {
          margin-bottom: 16px;
          padding: 16px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .progress-card {
          margin-bottom: 16px;
          padding: 18px 16px 16px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .progress-title {
          margin: 0 0 14px;
          color: rgba(255, 255, 255, 0.96);
          font: 800 16px/1.2 "Segoe UI Variable", "Segoe UI", sans-serif;
          letter-spacing: -0.02em;
        }

        .progress-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .progress-track {
          flex: 1 1 auto;
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.16);
          overflow: hidden;
          box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.18);
        }

        .progress-fill {
          height: 100%;
          width: 0%;
          border-radius: inherit;
          background: linear-gradient(90deg, #f19245, #ffc48a 55%, #ffe0c2);
          box-shadow: 0 0 12px rgba(241, 146, 69, 0.45);
          transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .progress-fill.is-pulse {
          animation: pc-progress-glow 1.4s ease-in-out infinite;
        }

        @keyframes pc-progress-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.12); }
        }

        .progress-pct {
          flex: 0 0 auto;
          min-width: 2.6em;
          text-align: right;
          color: rgba(255, 255, 255, 0.88);
          font: 700 13px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          font-variant-numeric: tabular-nums;
        }

        .progress-label {
          margin: 12px 0 0;
          color: rgba(245, 247, 249, 0.78);
          font-size: 13px;
          line-height: 1.45;
        }

        .preview-card img {
          display: block;
          width: 100%;
          border-radius: 18px;
          max-height: 250px;
          object-fit: contain;
          background: rgba(255, 255, 255, 0.72);
        }

        .style-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin: 18px 0 0;
        }

        .style-pill {
          padding: 10px 12px;
          border-radius: 999px;
          font-size: 13px;
          line-height: 1;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .panel-footer {
          padding: 16px 18px 18px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(84, 91, 98, 0.18);
        }

        .language-tabs {
          display: inline-flex;
          gap: 10px;
          align-items: center;
          padding: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .lang-tab {
          appearance: none;
          border: 0;
          width: 36px;
          height: 36px;
          border-radius: 999px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.8);
          background: transparent;
          font: 700 14px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
        }

        .lang-tab.active {
          color: #3e4349;
          background: rgba(255, 255, 255, 0.92);
        }

        .copy-button {
          appearance: none;
          border: 0;
          min-width: 138px;
          height: 52px;
          padding: 0 26px;
          border-radius: 999px;
          cursor: pointer;
          font: 800 16px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          color: #2c3035;
          background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(243,245,247,0.94));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
          transition:
            transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1),
            background 0.22s ease,
            color 0.22s ease,
            box-shadow 0.22s ease;
        }

        .copy-button:not(:disabled):active {
          transform: scale(0.94);
        }

        .copy-button:disabled {
          opacity: 0.7;
          cursor: default;
        }

        @keyframes pc-copied-pop {
          0% { transform: scale(0.94); }
          55% { transform: scale(1.06); }
          100% { transform: scale(1); }
        }

        .copy-button.copied {
          color: #ffffff;
          background: linear-gradient(180deg, rgba(86, 196, 122, 0.98), rgba(58, 170, 96, 0.96));
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
          animation: pc-copied-pop 0.38s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .history-header {
          padding-bottom: 12px;
        }

        .history-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.86);
        }

        .badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          height: 18px;
          padding: 0 8px;
          border-radius: 999px;
          font-size: 10px;
          color: #f7e6d5;
          background: rgba(255, 162, 92, 0.42);
        }

        .history-count {
          margin-top: 6px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.7);
        }

        .history-list {
          flex: 1;
          overflow: auto;
          padding: 0 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .history-card {
          appearance: none;
          border: 0;
          width: 100%;
          text-align: left;
          cursor: pointer;
          padding: 10px;
          border-radius: 24px;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .history-card.active {
          background: rgba(255, 255, 255, 0.14);
        }

        .history-card {
          position: relative;
        }

        .history-thumb {
          width: 100%;
          aspect-ratio: 0.72;
          overflow: hidden;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.76);
        }

        .history-delete {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          font: 600 16px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(20, 24, 30, 0.5);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
          opacity: 0;
          transform: scale(0.8);
          transition: opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.18s ease;
        }

        .history-card:hover .history-delete,
        .history-card:focus-within .history-delete {
          opacity: 1;
          transform: scale(1);
        }

        .history-delete:hover {
          background: rgba(214, 78, 64, 0.92);
        }

        .history-badge {
          position: absolute;
          top: 16px;
          left: 16px;
          padding: 4px 9px;
          border-radius: 999px;
          font: 700 10px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          letter-spacing: 0.04em;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.28);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }

        .history-badge.is-faithful {
          background: rgba(58, 132, 232, 0.9);
        }

        .history-badge.is-style {
          background: rgba(168, 96, 224, 0.9);
        }

        .history-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .history-meta {
          padding: 10px 4px 4px;
        }

        .history-line {
          display: -webkit-box;
          overflow: hidden;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          font-size: 12px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.9);
        }

        .history-empty {
          padding: 18px;
          border-radius: 20px;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.75);
          font-size: 13px;
          line-height: 1.6;
        }

        .hover-menu {
          position: fixed;
          display: none;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          pointer-events: auto;
        }

        .hover-menu.visible {
          display: inline-flex;
        }

        .hover-button {
          appearance: none;
          border: 0;
          cursor: pointer;
          height: 34px;
          padding: 0 14px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(245, 248, 250, 0.98);
          background: rgba(28, 32, 36, 0.84);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
          font: 700 12px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease;
        }

        .hover-button:active {
          transform: scale(0.94);
        }

        .hover-button.primary:hover {
          filter: brightness(1.06);
        }

        .hover-button.primary {
          background: linear-gradient(180deg, #f19245, #d55d1a);
        }

        .selection-layer {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: none;
          pointer-events: auto;
        }

        .selection-layer.active {
          display: block;
        }

        .selection-backdrop {
          position: absolute;
          inset: 0;
          background-position: center;
          background-size: 100% 100%;
          background-repeat: no-repeat;
          cursor: crosshair;
        }

        .selection-backdrop::after {
          content: "";
          position: absolute;
          inset: 0;
          background: rgba(16, 18, 22, 0.36);
        }

        .selection-box {
          position: absolute;
          display: none;
          border: 2px solid rgba(255, 135, 52, 0.98);
          border-radius: 10px;
          background: rgba(255, 135, 52, 0.12);
          box-shadow:
            0 0 0 9999px rgba(0, 0, 0, 0.18),
            0 18px 32px rgba(0, 0, 0, 0.2);
        }

        .selection-box.visible {
          display: block;
        }

        .selection-actions {
          position: absolute;
          display: none;
          gap: 8px;
          transform: translateX(-50%);
        }

        .selection-actions.visible {
          display: flex;
        }

        .selection-action {
          appearance: none;
          border: 0;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: 999px;
          color: #fff;
          background: rgba(27, 32, 37, 0.92);
          font: 700 12px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
        }

        .selection-action.primary {
          background: linear-gradient(180deg, #ff9846, #d45b18);
        }

        .selection-hint {
          position: absolute;
          left: 50%;
          top: 18px;
          transform: translateX(-50%);
          padding: 9px 14px;
          border-radius: 999px;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(20, 24, 30, 0.82);
          font-size: 12px;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .workspace {
            right: 12px;
            left: 12px;
            top: 12px;
            display: none;
            flex-direction: column;
          }

          .workspace.open {
            display: flex;
          }

          .main-panel,
          .history-rail {
            width: auto;
            min-height: 0;
            max-height: calc(50vh - 14px);
          }

          .history-rail {
            position: relative;
            right: auto;
            top: auto;
            height: auto;
            transform: none;
            opacity: 1;
          }

          .workspace.history-hidden .history-rail {
            display: none;
          }

          .resize-handle {
            display: none;
          }
        }

        .body,
        .history-list {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.28) transparent;
        }

        .body::-webkit-scrollbar,
        .history-list::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        .body::-webkit-scrollbar-track,
        .history-list::-webkit-scrollbar-track {
          background: transparent;
          margin: 6px 0;
        }

        .body::-webkit-scrollbar-thumb,
        .history-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        .body::-webkit-scrollbar-thumb:hover,
        .history-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
          background-clip: padding-box;
        }

        .body::-webkit-scrollbar-thumb:active,
        .history-list::-webkit-scrollbar-thumb:active {
          background: rgba(255, 255, 255, 0.55);
          background-clip: padding-box;
        }

        .mini-dock {
          /* Fixed bottom-left corner (no drag). Raised so it clears Pinterest's settings control. */
          position: fixed;
          left: 16px;
          bottom: 72px;
          top: auto;
          right: auto;
          width: 48px;
          height: 48px;
          display: none;
          align-items: center;
          justify-content: center;
          pointer-events: auto;
          z-index: 2147483646;
          user-select: none;
        }

        .workspace.minimized {
          display: none;
        }

        .mini-dock.show {
          display: flex;
        }

        .mini-orb {
          position: relative;
          z-index: 2;
          width: 48px;
          height: 48px;
          flex: 0 0 auto;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 999px;
          cursor: pointer;
          /* Pinterest red */
          color: #ffffff;
          background:
            radial-gradient(circle at 32% 28%, #ff4d6a 0%, #e60023 48%, #c4001a 100%);
          box-shadow:
            0 10px 28px rgba(230, 0, 35, 0.38),
            0 0 0 1px rgba(140, 0, 20, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease, filter 0.18s ease;
        }

        .mini-orb:hover {
          filter: brightness(1.06);
          box-shadow:
            0 14px 34px rgba(230, 0, 35, 0.45),
            0 0 0 1px rgba(255, 255, 255, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.32);
        }

        .mini-orb:active {
          transform: scale(0.94);
        }

        .mini-dock.tray-open .mini-orb {
          box-shadow:
            0 12px 30px rgba(230, 0, 35, 0.42),
            0 0 0 2px rgba(255, 255, 255, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }

        .mini-orb-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .mini-orb-logo svg {
          width: 22px;
          height: 22px;
          display: block;
          stroke: #ffffff;
        }

        .mini-tray {
          position: absolute;
          bottom: calc(100% + 10px);
          /* Anchor to orb edge so tray is never clipped off-screen when snapped left/right. */
          left: 0;
          right: auto;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-width: 220px;
          max-width: min(280px, calc(100vw - 24px));
          padding: 8px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background:
            linear-gradient(165deg, rgba(48, 52, 58, 0.94), rgba(28, 31, 36, 0.92));
          box-shadow:
            0 16px 40px rgba(0, 0, 0, 0.34),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(18px) saturate(1.1);
          -webkit-backdrop-filter: blur(18px) saturate(1.1);
          opacity: 0;
          transform: translateY(8px) scale(0.96);
          transform-origin: bottom left;
          pointer-events: none;
          transition:
            opacity 0.18s ease,
            transform 0.22s cubic-bezier(0.34, 1.2, 0.64, 1);
        }

        .mini-dock.tray-open .mini-tray {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }

        .mini-dock.align-right .mini-tray {
          left: auto;
          right: 0;
          transform-origin: bottom right;
        }

        .mini-dock.flip-bottom .mini-tray {
          bottom: auto;
          top: calc(100% + 10px);
          transform-origin: top left;
        }

        .mini-dock.flip-bottom.align-right .mini-tray {
          transform-origin: top right;
        }

        .mini-tray-btn {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          min-height: 40px;
          padding: 0 12px;
          border: 0;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(255, 255, 255, 0.08);
          font: 650 12.5px/1.2 "Segoe UI Variable", "Segoe UI", sans-serif;
          transition: background 0.15s ease;
        }

        .mini-tray-btn:hover {
          background: rgba(255, 255, 255, 0.14);
        }

        .mini-tray-btn.primary {
          background: linear-gradient(180deg, #f19245, #d55d1a);
        }

        .mini-tray-btn.primary:hover {
          filter: brightness(1.05);
        }

        .mini-pill-btn {
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          width: 100%;
          min-height: 40px;
          padding: 0 10px 0 12px;
          border: 0;
          border-radius: 12px;
          cursor: pointer;
          white-space: nowrap;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(255, 255, 255, 0.08);
          font: 650 12.5px/1.2 "Segoe UI Variable", "Segoe UI", sans-serif;
        }

        .mini-pill-label {
          opacity: 1;
          max-width: none;
          overflow: visible;
          flex: 1 1 auto;
          text-align: left;
        }

        .mini-switch {
          position: relative;
          width: 40px;
          height: 24px;
          flex: 0 0 auto;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.24);
          transition: background 0.22s ease;
        }

        .mini-pill-btn[aria-checked="true"] .mini-switch {
          background: rgba(86, 196, 122, 0.95);
        }

        .mini-switch-knob {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .mini-pill-btn[aria-checked="true"] .mini-switch-knob {
          transform: translateX(16px);
        }

        .mini-icon-btn {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          border: 0;
          border-radius: 999px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.92);
          background: rgba(255, 255, 255, 0.12);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
          font: 700 16px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
        }

        .mini-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .mini-icon-btn:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .mini-icon-btn .pc-icon {
          width: 16px;
          height: 16px;
        }

        .history-delete .pc-icon {
          width: 14px;
          height: 14px;
        }

        .hover-button .pc-icon {
          width: 15px;
          height: 15px;
        }

        .hover-quota {
          margin-left: 2px;
          min-width: 16px;
          height: 16px;
          padding: 0 5px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          font: 700 10px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          color: rgba(255, 255, 255, 0.96);
          background: rgba(255, 255, 255, 0.22);
        }

        .hover-quota:empty {
          display: none;
        }

        .hover-quota.is-out {
          background: rgba(214, 78, 64, 0.95);
        }


        .style-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 0 0 14px;
        }

        .style-block {
          margin-bottom: 14px;
        }

        .style-field {
          margin-bottom: 14px;
        }

        .style-field-label {
          margin-bottom: 6px;
          font: 700 11px/1 "Segoe UI Variable", "Segoe UI", sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.62);
        }

        .style-field-value {
          color: rgba(245, 247, 249, 0.94);
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .style-transfer {
          margin: 0;
          padding: 12px 14px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .style-list {
          margin: 0;
          padding-left: 18px;
          color: rgba(245, 247, 249, 0.92);
          font-size: 14px;
          line-height: 1.6;
        }

        .style-list li {
          margin-bottom: 3px;
        }

        .style-pill.subtle {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.78);
        }

      </style>
      <div class="overlay">
        <div class="workspace">
          <section class="main-panel">
            <header class="panel-header">
              <div class="panel-topline">
                <div class="eyebrow">BROMPTCARD</div>
                <div class="header-actions">
                  <button class="icon-button" data-action="toggle-history" data-i18n-title="toggleHistory" title="Lịch sử" aria-pressed="true"><svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><line x1="15" y1="4" x2="15" y2="20"/></svg></button>
                  <button class="icon-button" data-action="open-panel-screenshot" data-i18n-title="screenshotCrop" title="Screenshot crop"><svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg></button>
                  <button class="icon-button" data-action="minimize-panel" data-i18n-title="minimize" title="Thu nhỏ"><svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></button>
                  <button class="icon-button" data-action="collapse-panel" data-i18n-title="close" title="Close"><svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
                </div>
              </div>
              <h2 class="title" data-i18n="titleResult">Kết quả phân tích</h2>
            </header>
            <div class="body"></div>
            <footer class="panel-footer">
              <div class="language-tabs">
                <button class="lang-tab" data-language="vi">VI</button>
                <button class="lang-tab" data-language="en">EN</button>
              </div>
              <button class="copy-button" data-action="copy-result" data-i18n="copy">Sao chép</button>
            </footer>
            <div class="resize-handle" data-action="resize-panel" title="Resize"></div>
          </section>
          <aside class="history-rail">
            <header class="history-header">
              <div class="history-topline">
                <div class="history-title"><span data-i18n="history">Lịch sử</span> <span class="badge" data-i18n="local">Cục bộ</span></div>
                <div class="history-actions">
                  <button class="icon-button" data-action="clear-history" data-i18n-title="clearHistory" title="Clear history"><svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg></button>
                </div>
              </div>
              <div class="history-count" data-history-count>0</div>
            </header>
            <div class="history-list"></div>
          </aside>
        </div>
        <div class="mini-dock" data-mini-dock>
          <button class="mini-orb" data-action="toggle-dock-tray" data-i18n-title="expandPanel" title="BromptCard" aria-label="BromptCard" aria-expanded="false">
            <span class="mini-orb-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.4 5.6L20 11l-5.6 2.4L12 19l-2.4-5.6L4 11l5.6-2.4z"/></svg></span>
          </button>
          <div class="mini-tray" data-mini-tray>
            <button class="mini-tray-btn primary" data-action="expand-panel" type="button">
              <svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.1 5.1L19 10l-4.9 1.9L12 17l-2.1-5.1L5 10l4.9-1.9z"/></svg>
              <span data-i18n="expandPanel">Mở bảng điều khiển</span>
            </button>
            <button class="mini-tray-btn" data-action="open-panel-screenshot" type="button">
              <svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
              <span data-i18n="dockScreenshot">Cắt màn hình</span>
            </button>
            <button class="mini-pill-btn" data-action="toggle-overlay" role="switch" aria-checked="false" type="button">
              <span class="mini-pill-label" data-i18n="overlayLabel">Nút hover Faithful/Style</span>
              <span class="mini-switch"><span class="mini-switch-knob"></span></span>
            </button>
            <button class="mini-tray-btn" data-action="exit-quick-access" type="button">
              <svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              <span data-i18n="exitQuickAccess">Ẩn nút tròn</span>
            </button>
          </div>
        </div>
        <div class="hover-menu"></div>
        <div class="selection-layer">
          <div class="selection-backdrop"></div>
          <div class="selection-hint" data-i18n="dragHint">Kéo để chọn một vùng, rồi bấm Phân tích</div>
          <div class="selection-box"></div>
          <div class="selection-actions">
            <button class="selection-action" data-selection="retry" data-i18n="selRetry">Chọn lại</button>
            <button class="selection-action primary" data-selection="confirm" data-i18n="selConfirm">Phân tích</button>
            <button class="selection-action" data-selection="cancel" data-i18n="selCancel">Hủy</button>
          </div>
        </div>
      </div>
    `;

    shadow.querySelector('[data-action="collapse-panel"]').addEventListener("click", closePanel);
    shadow.querySelector('[data-action="toggle-history"]').addEventListener("click", toggleHistory);
    shadow.querySelectorAll('[data-action="open-panel-screenshot"]').forEach((button) => {
      button.addEventListener("click", async () => {
        dockTrayOpen = false;
        await openPanel();
        await startScreenshotFlow();
      });
    });
    shadow.querySelector('[data-action="copy-result"]').addEventListener("click", copyCurrentView);
    shadow.querySelector('[data-action="clear-history"]').addEventListener("click", clearHistory);
    shadow.querySelector('[data-action="minimize-panel"]').addEventListener("click", minimizePanel);
    shadow.querySelectorAll('[data-action="expand-panel"]').forEach((button) => {
      button.addEventListener("click", () => {
        dockTrayOpen = false;
        expandPanel();
      });
    });
    shadow.querySelector('[data-action="exit-quick-access"]').addEventListener("click", () => {
      dockTrayOpen = false;
      exitQuickAccess();
    });
    shadow.querySelector('[data-action="toggle-overlay"]').addEventListener("click", toggleOverlay);
    shadow.querySelector('[data-action="toggle-dock-tray"]')?.addEventListener("click", () => {
      dockTrayOpen = !dockTrayOpen;
      render();
    });

    shadow.querySelectorAll("[data-language]").forEach((button) => {
      button.addEventListener("click", () => {
        const next = button.getAttribute("data-language") === "en" ? "en" : "vi";
        if (state.language === next) {
          return;
        }
        state.language = next;
        // Persist panel language so VI/EN choice survives reloads.
        if (isExtensionAlive()) {
          chrome.storage.local.set({ language: next }).catch(() => {});
        }
        render();
      });
    });

    setupPanelDragging();
    setupPanelResizing();
    setupDockInteractions();
  }

  function setupPanelDragging() {
    const workspace = shadow.querySelector(".workspace");
    const handles = shadow.querySelectorAll(".panel-header, .history-header");
    if (!workspace || !handles.length) {
      return;
    }

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const onPointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      if (event.target.closest(".header-actions, .history-actions, button")) {
        return;
      }
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      originX = panelOffset.x;
      originY = panelOffset.y;
      workspace.classList.add("dragging");
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      event.preventDefault();
    };

    const onPointerMove = (event) => {
      if (!dragging) {
        return;
      }
      panelOffset.x = originX + (event.clientX - startX);
      panelOffset.y = originY + (event.clientY - startY);
      workspace.style.transform = `translate(${panelOffset.x}px, ${panelOffset.y}px)`;
    };

    const endDrag = (event) => {
      if (!dragging) {
        return;
      }
      dragging = false;
      workspace.classList.remove("dragging");
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    };

    handles.forEach((handle) => {
      handle.addEventListener("pointerdown", onPointerDown);
      handle.addEventListener("pointermove", onPointerMove);
      handle.addEventListener("pointerup", endDrag);
      handle.addEventListener("pointercancel", endDrag);
    });
  }



  function applyDockPos() {
    const dock = shadow.querySelector("[data-mini-dock]");
    if (!dock) {
      return;
    }
    // Always bottom-left, raised above Pinterest's bottom-left settings control.
    dock.style.left = `${DOCK_SNAP_EDGE + 4}px`;
    dock.style.bottom = "72px";
    dock.style.top = "auto";
    dock.style.right = "auto";
    dock.classList.remove("align-right", "flip-bottom");
  }

  function setupDockInteractions() {
    const dock = shadow.querySelector("[data-mini-dock]");
    if (!dock) {
      return;
    }

    // Close tray when clicking outside the dock.
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!dockTrayOpen || !shadow) {
          return;
        }
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        if (path.includes(dock)) {
          return;
        }
        dockTrayOpen = false;
        render();
      },
      true
    );
  }

  function applyPanelSize() {
    const panel = shadow.querySelector(".main-panel");
    if (!panel) {
      return;
    }
    if (panelSize.width) {
      panel.style.width = `${panelSize.width}px`;
    }
    if (panelSize.height) {
      panel.style.minHeight = `${panelSize.height}px`;
      panel.style.height = `${panelSize.height}px`;
    }
  }

  async function persistPanelSize() {
    if (!isExtensionAlive()) {
      return;
    }
    try {
      await chrome.storage.local.set({ [PANEL_SIZE_KEY]: { ...panelSize } });
    } catch (error) {
      if (!isContextLostError(error)) {
        throw error;
      }
    }
  }

  function setupPanelResizing() {
    const workspace = shadow.querySelector(".workspace");
    const panel = shadow.querySelector(".main-panel");
    const handle = shadow.querySelector('[data-action="resize-panel"]');
    if (!workspace || !panel || !handle) {
      return;
    }

    let resizing = false;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;

    const onPointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }
      if (state.historyVisible) {
        return;
      }
      resizing = true;
      const rect = panel.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startW = rect.width;
      startH = rect.height;
      workspace.classList.add("resizing");
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      event.preventDefault();
      event.stopPropagation();
    };

    const onPointerMove = (event) => {
      if (!resizing) {
        return;
      }
      const maxW = Math.max(PANEL_MIN_W, window.innerWidth - 64);
      const maxH = Math.max(PANEL_MIN_H, window.innerHeight - 48);
      panelSize.width = Math.round(Math.min(maxW, Math.max(PANEL_MIN_W, startW + (event.clientX - startX))));
      panelSize.height = Math.round(Math.min(maxH, Math.max(PANEL_MIN_H, startH + (event.clientY - startY))));
      applyPanelSize();
    };

    const endResize = (event) => {
      if (!resizing) {
        return;
      }
      resizing = false;
      workspace.classList.remove("resizing");
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      persistPanelSize();
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", endResize);
    handle.addEventListener("pointercancel", endResize);
  }

  function isPointOverPanel(x, y) {
    if (!state.panelOpen) {
      return false;
    }
    const parts = shadow.querySelectorAll(".main-panel, .history-rail");
    for (const part of parts) {
      const rect = part.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        continue;
      }
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return true;
      }
    }
    return false;
  }

  async function loadHistory() {
    if (historyLoaded) {
      return;
    }
    if (!isExtensionAlive()) {
      return;
    }
    historyLoaded = true;
    try {
      await refreshRuntimeSettings();
      const stored = await chrome.storage.local.get([
        HISTORY_KEY,
        HISTORY_VISIBLE_KEY,
        PANEL_SIZE_KEY,
        ALLOWED_SITES_KEY
      ]);
      state.history = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
      state.siteAllowed = isCurrentSiteAllowed(stored[ALLOWED_SITES_KEY]);
      if (typeof stored[HISTORY_VISIBLE_KEY] === "boolean") {
        state.historyVisible = stored[HISTORY_VISIBLE_KEY];
      }
      // hover/overlay loaded in refreshRuntimeSettings
      const savedSize = stored[PANEL_SIZE_KEY];
      if (savedSize && typeof savedSize === "object") {
        if (Number(savedSize.width) > 0) {
          panelSize.width = Number(savedSize.width);
        }
        if (Number(savedSize.height) > 0) {
          panelSize.height = Number(savedSize.height);
        }
      }
    } catch (error) {
      if (!isContextLostError(error)) {
        throw error;
      }
    }
  }

  async function toggleHistory() {
    state.historyVisible = !state.historyVisible;
    render();
    if (!isExtensionAlive()) {
      return;
    }
    try {
      await chrome.storage.local.set({ [HISTORY_VISIBLE_KEY]: state.historyVisible });
    } catch (error) {
      if (!isContextLostError(error)) {
        throw error;
      }
    }
  }

  async function persistHistory() {
    if (!isExtensionAlive()) {
      return;
    }
    try {
      await chrome.storage.local.set({
        [HISTORY_KEY]: state.history.slice(0, HISTORY_LIMIT)
      });
    } catch (error) {
      if (!isContextLostError(error)) {
        throw error;
      }
    }
  }

  async function addHistoryEntry(target, result, modeId = state.mode) {
    const resolvedMode = modeById(modeId);
    const resultKind = resolveResultKind(result);
    const text =
      result?.kind === "mapped"
        ? result?.primaryText || result?.raw || t("untitled")
        : resultKind === "style"
        ? result?.transfer_prompt || result?.style_family || t("untitled")
        : result?.vi?.prompt || result?.en?.prompt || result?.recreation_prompt || t("untitled");
    const entry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      imageSrc: target.src,
      pageUrl: target.pageUrl || location.href,
      mode: resolvedMode.id,
      modeName: resolvedMode.name,
      resultKind,
      text,
      result
    };

    state.history = [
      entry,
      ...state.history.filter(
        (item) => !(item.imageSrc === entry.imageSrc && (item.mode || state.provider) === entry.mode)
      )
    ].slice(0, HISTORY_LIMIT);
    state.activeHistoryId = entry.id;
    await persistHistory();
  }

  async function clearHistory() {
    state.history = [];
    state.activeHistoryId = null;
    await persistHistory();
    render();
  }

  async function deleteHistoryEntry(id) {
    const exists = state.history.some((entry) => entry.id === id);
    if (!exists) {
      return;
    }
    state.history = state.history.filter((entry) => entry.id !== id);
    if (state.activeHistoryId === id) {
      state.activeHistoryId = null;
    }
    await persistHistory();
    render();
  }

  function setState(partial) {
    Object.assign(state, partial);
    render();
  }

  function closePanel() {
    state.panelOpen = false;
    render();
  }

  async function refreshQuota() {
    if (!isExtensionAlive()) {
      return;
    }
    try {
      const response = await sendMessageSafe({ type: "PROMPTCARD_GET_QUOTA" });
      if (response?.ok && response.data?.quota) {
        state.quota = response.data.quota;
        render();
      }
    } catch {
      /* quota display is best-effort */
    }
  }

  async function openPanel() {
    ensureRoot();
    await refreshRuntimeSettings();
    await loadHistory();
    if (!state.siteAllowed) {
      setState({
        status: "error",
        error: t("disabledSite")
      });
      return;
    }
    const dock = shadow?.querySelector("[data-mini-dock]");
    if (dock) {
      delete dock.dataset.userHidden;
    }
    state.panelOpen = true;
    state.minimized = false;
    dockTrayOpen = false;
    render();
    refreshQuota();
  }

  function minimizePanel() {
    state.minimized = true;
    hideHoverMenu();
    render();
  }

  function expandPanel() {
    state.minimized = false;
    state.panelOpen = true;
    render();
  }

  function exitQuickAccess() {
    // Hide the floating dock for this page session (still available after reload / reopen).
    state.minimized = false;
    state.panelOpen = false;
    state.siteAllowed = state.siteAllowed;
    hideHoverMenu();
    dockTrayOpen = false;
    // Temporary hide until next openPanel / navigation reload of content script.
    const dock = shadow?.querySelector("[data-mini-dock]");
    if (dock) {
      dock.dataset.userHidden = "1";
    }
    render();
  }

  async function toggleOverlay() {
    state.overlayEnabled = !state.overlayEnabled;
    if (!state.overlayEnabled) {
      hideHoverMenu();
    }
    render();
    if (!isExtensionAlive()) {
      return;
    }
    try {
      // Persist as shared setting so popup + dock stay in sync.
      await chrome.storage.local.set({
        [HOVER_ACTIONS_KEY]: state.overlayEnabled,
        [OVERLAY_ENABLED_KEY]: state.overlayEnabled
      });
    } catch (error) {
      if (!isContextLostError(error)) {
        throw error;
      }
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function imageTargetFromElement(element) {
    if (!(element instanceof HTMLImageElement)) {
      return null;
    }
    return {
      src: element.currentSrc || element.src,
      alt: element.alt || "",
      pageUrl: location.href,
      naturalWidth: element.naturalWidth || 0,
      naturalHeight: element.naturalHeight || 0
    };
  }

  function normalizeImageUrl(url) {
    try {
      return new URL(String(url || ""), location.href).href;
    } catch {
      return String(url || "").trim();
    }
  }

  /** Match a DOM img to a right-clicked src for dimensions only — never pick a different image. */
  function findImageBySrc(srcUrl) {
    const wanted = normalizeImageUrl(srcUrl);
    if (!wanted) {
      return null;
    }
    for (const image of Array.from(document.images)) {
      if (!(image instanceof HTMLImageElement)) {
        continue;
      }
      const candidates = [image.currentSrc, image.src, image.getAttribute("src")].filter(Boolean);
      for (const candidate of candidates) {
        if (normalizeImageUrl(candidate) === wanted) {
          return image;
        }
      }
    }
    return null;
  }

  function isUsableImage(element, { forHover = true } = {}) {
    if (!(element instanceof HTMLImageElement)) {
      return false;
    }
    if (!element.isConnected || !(element.currentSrc || element.src)) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    // Hover chips skip tiny icons; context-menu allows smaller pin tiles.
    const minEdge = forHover ? 90 : 24;
    if (rect.width < minEdge || rect.height < minEdge) {
      return false;
    }
    // Skip tracking pixels / spacer gifs even for context resolve.
    if (!forHover && rect.width * rect.height < 800) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) {
      return false;
    }
    return true;
  }

  function rectContainsPoint(rect, x, y, pad = 2) {
    return (
      x >= rect.left - pad &&
      x <= rect.right + pad &&
      y >= rect.top - pad &&
      y <= rect.bottom + pad
    );
  }

  /**
   * Image under the cursor. Only considers imgs whose box contains (x,y).
   * Picks the *smallest* containing image so a pin thumbnail wins over a large
   * open/detail image that sits elsewhere but is still under a page-level ancestor.
   * (Previously querySelectorAll on body/ancestors + max area always grabbed the main pin.)
   */
  function findImageAtPoint(x, y, options = {}) {
    const forHover = options.forHover !== false;
    const stack = document.elementsFromPoint(x, y);
    const seen = new Set();
    let best = null;
    let bestArea = Infinity;

    function consider(img) {
      if (!img || seen.has(img) || !(img instanceof HTMLImageElement)) {
        return;
      }
      seen.add(img);
      if (!isUsableImage(img, { forHover })) {
        return;
      }
      const rect = img.getBoundingClientRect();
      if (!rectContainsPoint(rect, x, y)) {
        return;
      }
      const area = Math.max(1, rect.width * rect.height);
      // Smallest box that still covers the click = the tile under the cursor.
      if (area < bestArea) {
        bestArea = area;
        best = img;
      }
    }

    for (const element of stack) {
      if (element === root || (shadow && shadow.contains(element))) {
        continue;
      }
      if (element instanceof HTMLImageElement) {
        consider(element);
      }
      if (!(element instanceof Element)) {
        continue;
      }
      // Only immediate media inside this node — not deep page-wide descendants.
      if (element.tagName === "PICTURE") {
        for (const img of element.querySelectorAll(":scope > img")) {
          consider(img);
        }
      }
      for (const child of element.children || []) {
        if (child instanceof HTMLImageElement) {
          consider(child);
        } else if (child && child.tagName === "PICTURE") {
          for (const img of child.querySelectorAll("img")) {
            consider(img);
          }
        }
      }
      // One level of common wrappers: div > img / a > div > img
      for (const img of element.querySelectorAll(":scope > * > img, :scope > img")) {
        consider(img);
      }
    }

    return best;
  }

  function findImageNearLink(linkUrl, x, y) {
    const wanted = normalizeImageUrl(linkUrl);
    if (!wanted) {
      return null;
    }
    let wantPath = "";
    try {
      wantPath = new URL(wanted).pathname || "";
    } catch {
      wantPath = "";
    }

    // Prefer the anchor under the cursor that matches the link, then its imgs at the point.
    const stack = document.elementsFromPoint(x, y);
    for (const element of stack) {
      if (!(element instanceof Element) || element === root || (shadow && shadow.contains(element))) {
        continue;
      }
      const anchor =
        element.tagName === "A" ? element : element.closest && element.closest("a[href]");
      if (!anchor) {
        continue;
      }
      let href;
      try {
        href = new URL(anchor.href, location.href).href;
      } catch {
        continue;
      }
      const hrefPath = (() => {
        try {
          return new URL(href).pathname || "";
        } catch {
          return "";
        }
      })();
      const same =
        href === wanted ||
        href.split("?")[0] === wanted.split("?")[0] ||
        (wantPath.length > 1 && (hrefPath === wantPath || href.includes(wantPath)));
      if (!same) {
        continue;
      }

      let best = null;
      let bestArea = Infinity;
      for (const img of anchor.querySelectorAll("img")) {
        if (!(img instanceof HTMLImageElement) || !isUsableImage(img, { forHover: false })) {
          continue;
        }
        const rect = img.getBoundingClientRect();
        // Prefer imgs that cover the click; if none, fall back to smallest in this anchor only.
        const covers = rectContainsPoint(rect, x, y);
        const area = Math.max(1, rect.width * rect.height);
        if (covers && area < bestArea) {
          bestArea = area;
          best = img;
        }
      }
      if (best) {
        return best;
      }
      // No img covered the click (transparent overlay) — take the largest img *inside this anchor only*.
      let largest = null;
      let largestArea = 0;
      for (const img of anchor.querySelectorAll("img")) {
        if (!(img instanceof HTMLImageElement) || !isUsableImage(img, { forHover: false })) {
          continue;
        }
        const rect = img.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > largestArea) {
          largestArea = area;
          largest = img;
        }
      }
      if (largest) {
        return largest;
      }
    }
    return null;
  }

  /**
   * Resolve which image the user meant when right-clicking a pin card (often a link, not the img).
   * Cursor hit-test first, then the specific anchor under the cursor — never page-wide "largest".
   */
  function resolveContextImage(payload = {}) {
    if (payload.srcUrl) {
      return findImageBySrc(payload.srcUrl) || null;
    }
    const x = Number.isFinite(payload.clientX) ? payload.clientX : lastContextPoint.x;
    const y = Number.isFinite(payload.clientY) ? payload.clientY : lastContextPoint.y;
    const atPoint = findImageAtPoint(x, y, { forHover: false });
    if (atPoint) {
      return atPoint;
    }
    if (payload.linkUrl) {
      return findImageNearLink(payload.linkUrl, x, y);
    }
    return null;
  }

  function hideHoverMenu() {
    ensureRoot();
    hoveredImage = null;
    shadow.querySelector(".hover-menu").classList.remove("visible");
  }

  function showHoverMenuForImage(image) {
    ensureRoot();
    if (!isUsableImage(image)) {
      hideHoverMenu();
      return;
    }

    const rect = image.getBoundingClientRect();
    const menu = shadow.querySelector(".hover-menu");
    menu.style.left = `${Math.max(12, rect.left + 10)}px`;
    menu.style.top = `${Math.max(12, rect.top + 10)}px`;
    menu.classList.add("visible");
    hoveredImage = image;
  }

  function pickLargestImage() {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    let winner = null;
    let winnerScore = 0;

    for (const image of Array.from(document.images)) {
      if (!isUsableImage(image)) {
        continue;
      }
      const rect = image.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      if (visibleArea < 14000) {
        continue;
      }
      const score = visibleArea + rect.width * rect.height * 0.12;
      if (score > winnerScore) {
        winnerScore = score;
        winner = image;
      }
    }

    return winner;
  }

  function currentText() {
    if (!state.result) {
      return "";
    }
    if (state.result.kind === "mapped") {
      return state.result.primaryText || state.result.raw || "";
    }
    if (state.result.kind === "style") {
      return state.result.transfer_prompt || "";
    }
    if (state.language === "en") {
      return state.result.en?.prompt || state.result.vi?.prompt || "";
    }
    return state.result.vi?.prompt || state.result.en?.prompt || "";
  }

  function currentStyleTags() {
    if (!state.result) {
      return [];
    }
    if (state.result.kind === "mapped") {
      return Array.isArray(state.result.tags) ? state.result.tags : [];
    }
    if (state.language === "en") {
      const en = Array.isArray(state.result.en_style_tags) ? state.result.en_style_tags : [];
      return en.length ? en : (Array.isArray(state.result.vi_style_tags) ? state.result.vi_style_tags : []);
    }
    const vi = Array.isArray(state.result.vi_style_tags) ? state.result.vi_style_tags : [];
    return vi.length ? vi : (Array.isArray(state.result.en_style_tags) ? state.result.en_style_tags : []);
  }

  let copyResetTimer = null;

  function flashCopyButton() {
    const button = shadow.querySelector('[data-action="copy-result"]');
    if (!button) {
      return;
    }
    button.classList.remove("copied");
    // Force reflow so the animation restarts on rapid repeated clicks.
    void button.offsetWidth;
    const label = button.querySelector(".copy-label") || button;
    const original = button.getAttribute("data-label-default") || label.textContent;
    button.setAttribute("data-label-default", original);
    button.classList.add("copied");
    label.textContent = t("copiedLabel");
    if (copyResetTimer) {
      clearTimeout(copyResetTimer);
    }
    copyResetTimer = setTimeout(() => {
      button.classList.remove("copied");
      label.textContent = t("copy");
      copyResetTimer = null;
    }, 1400);
  }

  async function copyCurrentView() {
    if (!state.result) {
      return;
    }
    try {
      await navigator.clipboard.writeText(currentText());
      flashCopyButton();
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : t("copyFailed")
      });
    }
  }

  async function analyzeLargestImageOnPage() {
    const image = pickLargestImage();
    if (!image) {
      setState({
        status: "error",
        error: t("noLargeImage")
      });
      return;
    }
    await analyzeTarget(imageTargetFromElement(image), state.provider);
  }

  function stopProgressTicker() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  function progressStageFor(pct) {
    if (pct < 18) {
      return t("progressPrepare");
    }
    if (pct < 42) {
      return t("progressSend");
    }
    if (pct < 88) {
      return t("progressWait");
    }
    return t("progressParse");
  }

  function startProgressTicker() {
    stopProgressTicker();
    state.progress = 4;
    state.progressLabel = progressStageFor(4);
    const started = Date.now();
    progressTimer = setInterval(() => {
      if (state.status !== "loading") {
        stopProgressTicker();
        return;
      }
      // Ease toward ~92% while waiting (Gemini has no real progress events).
      const elapsed = (Date.now() - started) / 1000;
      const eased = 92 * (1 - Math.exp(-elapsed / 18));
      const next = Math.max(state.progress, Math.min(92, Math.round(eased)));
      if (next !== state.progress || state.progressLabel !== progressStageFor(next)) {
        state.progress = next;
        state.progressLabel = progressStageFor(next);
        // Soft update without full setState thrash.
        const fill = shadow?.querySelector("[data-progress-fill]");
        const pct = shadow?.querySelector("[data-progress-pct]");
        const label = shadow?.querySelector("[data-progress-label]");
        if (fill && pct && label) {
          fill.style.width = `${next}%`;
          pct.textContent = `${next}%`;
          label.textContent = state.progressLabel;
        } else {
          render();
        }
      }
    }, 200);
  }

  function finishProgress(success) {
    stopProgressTicker();
    state.progress = success ? 100 : state.progress;
    state.progressLabel = success ? t("progressParse") : state.progressLabel;
  }

  async function analyzeTarget(target, modeId = state.provider) {
    if (!state.siteAllowed) {
      setState({
        status: "error",
        error: t("disabledSite")
      });
      return;
    }
    if (!target?.src) {
      setState({
        status: "error",
        error: t("noImage")
      });
      return;
    }

    await openPanel();
    const selectedMode = modeById(modeId);
    setState({
      status: "loading",
      error: "",
      result: null,
      target,
      mode: selectedMode.id,
      activeHistoryId: null,
      progress: 4,
      progressLabel: progressStageFor(4)
    });
    startProgressTicker();

    try {
      const response = await sendMessageSafe({
        type: "PROMPTCARD_RUN_ANALYSIS",
        payload: { target, provider: selectedMode.id }
      });

      if (!response?.ok) {
        const err = new Error(response?.error || t("analysisFailed"));
        err.code = response?.code;
        err.quota = response?.quota || null;
        throw err;
      }

      if (response.data.quota) {
        state.quota = response.data.quota;
      }

      finishProgress(true);
      setState({
        status: "success",
        result: response.data.analysis,
        target,
        mode: selectedMode.id,
        progress: 100
      });

      await addHistoryEntry(target, response.data.analysis, selectedMode.id);
      render();
    } catch (error) {
      finishProgress(false);
      const quota = error?.quota || null;
      if (quota) {
        state.quota = quota;
      }
      setState({
        status: "error",
        error: error instanceof Error ? error.message : t("analysisFailed")
      });
    }
  }

  function rectFromPoints(start, end) {
    return {
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y)
    };
  }

  function applyRect(box, rect) {
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
  }

  async function cropDataUrl(dataUrl, rect) {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error(t("loadShotFailed")));
      node.src = dataUrl;
    });

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const scaleX = image.naturalWidth / viewportWidth;
    const scaleY = image.naturalHeight / viewportHeight;
    const sourceX = Math.round(rect.left * scaleX);
    const sourceY = Math.round(rect.top * scaleY);
    const sourceWidth = Math.max(1, Math.round(rect.width * scaleX));
    const sourceHeight = Math.max(1, Math.round(rect.height * scaleY));
    const targetScale = Math.min(1, 1280 / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * targetScale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * targetScale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error(t("cropFailed"));
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    return {
      src: canvas.toDataURL("image/png"),
      pageUrl: location.href,
      alt: "Screenshot crop",
      naturalWidth: targetWidth,
      naturalHeight: targetHeight
    };
  }

  async function requestVisibleTabCapture() {
    const response = await sendMessageSafe({
      type: "PROMPTCARD_CAPTURE_VISIBLE_TAB"
    });
    if (!response?.ok) {
      throw new Error(response?.error || t("captureFailed"));
    }
    return response.data.dataUrl;
  }

  async function withUiHidden(task) {
    ensureRoot();
    const previousDisplay = root.style.display;
    root.style.display = "none";
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      return await task();
    } finally {
      root.style.display = previousDisplay;
    }
  }

  async function selectRectangle(backgroundDataUrl) {
    ensureRoot();
    const layer = shadow.querySelector(".selection-layer");
    const backdrop = shadow.querySelector(".selection-backdrop");
    const box = shadow.querySelector(".selection-box");
    const actions = shadow.querySelector(".selection-actions");
    const retryButton = shadow.querySelector('[data-selection="retry"]');
    const confirmButton = shadow.querySelector('[data-selection="confirm"]');
    const cancelButton = shadow.querySelector('[data-selection="cancel"]');

    backdrop.style.backgroundImage = `url("${backgroundDataUrl}")`;
    layer.classList.add("active");

    return new Promise((resolve) => {
      let start = null;
      let currentRect = null;

      function cleanup(result) {
        layer.classList.remove("active");
        box.classList.remove("visible");
        actions.classList.remove("visible");
        backdrop.onpointerdown = null;
        retryButton.onclick = null;
        confirmButton.onclick = null;
        cancelButton.onclick = null;
        window.removeEventListener("pointermove", onMove, true);
        window.removeEventListener("pointerup", onUp, true);
        window.removeEventListener("keydown", onKeyDown, true);
        resolve(result);
      }

      function onMove(event) {
        if (!start) {
          return;
        }
        currentRect = rectFromPoints(start, { x: event.clientX, y: event.clientY });
        applyRect(box, currentRect);
        box.classList.add("visible");
      }

      function showActions(rect) {
        actions.style.left = `${rect.left + rect.width / 2}px`;
        actions.style.top = `${Math.max(12, rect.top - 44)}px`;
        actions.classList.add("visible");
      }

      function onUp(event) {
        if (!start) {
          return;
        }
        currentRect = rectFromPoints(start, { x: event.clientX, y: event.clientY });
        start = null;
        if (!currentRect || currentRect.width < 18 || currentRect.height < 18) {
          currentRect = null;
          box.classList.remove("visible");
          actions.classList.remove("visible");
          return;
        }
        applyRect(box, currentRect);
        showActions(currentRect);
      }

      function onKeyDown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          cleanup(null);
        }
      }

      backdrop.onpointerdown = (event) => {
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        actions.classList.remove("visible");
        start = { x: event.clientX, y: event.clientY };
        currentRect = rectFromPoints(start, start);
        applyRect(box, currentRect);
        box.classList.add("visible");
      };

      retryButton.onclick = () => {
        currentRect = null;
        box.classList.remove("visible");
        actions.classList.remove("visible");
      };

      confirmButton.onclick = () => {
        if (currentRect) {
          cleanup(currentRect);
        }
      };

      cancelButton.onclick = () => cleanup(null);

      window.addEventListener("pointermove", onMove, true);
      window.addEventListener("pointerup", onUp, true);
      window.addEventListener("keydown", onKeyDown, true);
    });
  }

  async function startScreenshotFlow() {
    try {
      ensureRoot();
      await refreshRuntimeSettings();
      if (!state.siteAllowed) {
        await openPanel();
        setState({
          status: "error",
          error: t("disabledSite")
        });
        return;
      }

      // Keep panel/dock out of the way while capturing and cropping.
      state.panelOpen = false;
      state.minimized = false;
      dockTrayOpen = false;
      hideHoverMenu();
      render();

      const dataUrl = await withUiHidden(() => requestVisibleTabCapture());
      const rect = await selectRectangle(dataUrl);
      if (!rect) {
        // User cancelled crop — stay quiet on the page.
        return;
      }
      const target = await cropDataUrl(dataUrl, rect);
      await analyzeTarget(target);
    } catch (error) {
      await openPanel();
      setState({
        status: "error",
        error: error instanceof Error ? error.message : t("screenshotFailed")
      });
    }
  }

  function renderMainBody() {
    if (state.status === "loading") {
      const pct = Math.max(0, Math.min(100, Number(state.progress) || 0));
      const label = state.progressLabel || t("progressWait");
      return `
        ${renderPreview()}
        <div class="progress-card">
          <p class="progress-title">${escapeHtml(t("progressTitle"))}</p>
          <div class="progress-row">
            <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${escapeHtml(t("progressTitle"))}">
              <div class="progress-fill is-pulse" data-progress-fill style="width:${pct}%"></div>
            </div>
            <span class="progress-pct" data-progress-pct>${pct}%</span>
          </div>
          <p class="progress-label" data-progress-label>${escapeHtml(label)}</p>
        </div>
      `;
    }

    if (state.status === "error") {
      return `
        ${renderPreview()}
        <div class="hint-card">
          <p class="error">${escapeHtml(state.error || t("analysisFailed"))}</p>
        </div>
      `;
    }

    if (state.status === "success" && state.result) {
      if (state.result.kind === "style") {
        return renderStyleBody();
      }
      if (state.result.kind === "mapped") {
        return renderMappedBody();
      }
      return `
        ${renderPreview()}
        <p class="analysis-text">${escapeHtml(currentText())}</p>
        <div class="style-tags">
          ${currentStyleTags()
            .map((tag) => `<span class="style-pill">${escapeHtml(tag)}</span>`)
            .join("")}
        </div>
      `;
    }

    return `
      <div class="hint-card">
        <p class="setup-note">${escapeHtml(t("setupNote"))}</p>
      </div>
      <div class="hint-card">
        <button class="copy-button" data-action="analyze-largest" style="width:100%;">${escapeHtml(t("analyzeLargest"))}</button>
      </div>
    `;
  }

  function renderPreview() {
    if (!state.target?.src) {
      return "";
    }
    return `
      <div class="preview-card">
        <img src="${state.target.src}" alt="" />
      </div>
    `;
  }

  function styleField(labelKey, value) {
    const text = (value || "").trim();
    if (!text) {
      return "";
    }
    return `
      <div class="style-field">
        <div class="style-field-label">${escapeHtml(t(labelKey))}</div>
        <div class="style-field-value">${escapeHtml(text)}</div>
      </div>
    `;
  }

  function literalField(label, value) {
    const text = (value || "").trim();
    if (!text) {
      return "";
    }
    return `
      <div class="style-field">
        <div class="style-field-label">${escapeHtml(label)}</div>
        <div class="style-field-value">${escapeHtml(text)}</div>
      </div>
    `;
  }

  function renderStyleBody() {
    const r = state.result || {};
    const meta = [
      r.style_family ? `<span class="style-pill">${escapeHtml(r.style_family)}</span>` : "",
      r.content_domain ? `<span class="style-pill subtle">${escapeHtml(r.content_domain)}</span>` : ""
    ].join("");

    const tags = Array.isArray(r.style_tags) ? r.style_tags : [];
    const priority = Array.isArray(r.transfer_priority) ? r.transfer_priority : [];
    const priorityList = priority.length
      ? `
        <div class="style-field">
          <div class="style-field-label">${escapeHtml(t("stylePriority"))}</div>
          <ul class="style-list">${priority.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>
        </div>
      `
      : "";

    return `
      ${renderPreview()}
      <div class="style-meta">${meta}</div>
      <div class="style-block">
        <div class="style-field-label">${escapeHtml(t("styleTransfer"))}</div>
        <p class="analysis-text style-transfer">${escapeHtml(r.transfer_prompt || "")}</p>
      </div>
      ${styleField("styleNegative", r.negative_prompt)}
      ${priorityList}
      ${styleField("styleNotCopy", r.what_not_to_copy)}
      ${styleField("styleReplace", r.target_replacement_instructions)}
      <div class="style-tags">
        ${tags.map((tag) => `<span class="style-pill">${escapeHtml(tag)}</span>`).join("")}
      </div>
    `;
  }

  function renderMappedBody() {
    const r = state.result || {};
    const meta = Array.isArray(r.meta)
      ? r.meta.map((item) => literalField(item.label || item.key || "Meta", item.value)).join("")
      : "";
    const negative = r.negativePrompt ? styleField("styleNegative", r.negativePrompt) : "";
    const tags = Array.isArray(r.tags) ? r.tags : [];
    const rawBlock = r.salvaged && r.raw && r.raw !== r.primaryText ? literalField("Raw", r.raw) : "";

    return `
      ${renderPreview()}
      <div class="style-block">
        <div class="style-field-label">${escapeHtml(modeById(state.mode)?.name || "Mode")}</div>
        <p class="analysis-text style-transfer">${escapeHtml(r.primaryText || r.raw || "")}</p>
      </div>
      ${negative}
      ${meta}
      ${tags.length ? `<div class="style-tags">${tags.map((tag) => `<span class="style-pill">${escapeHtml(tag)}</span>`).join("")}</div>` : ""}
      ${rawBlock}
    `;
  }

  function renderHistory() {
    const count = shadow.querySelector("[data-history-count]");
    const list = shadow.querySelector(".history-list");
    count.textContent = `${state.history.length}`;

    if (!state.history.length) {
      list.innerHTML = `<div class="history-empty">${escapeHtml(t("historyEmpty"))}</div>`;
      return;
    }

    list.innerHTML = state.history
      .map((item) => {
        const active = item.id === state.activeHistoryId ? "active" : "";
        const itemKind = item.resultKind || resolveResultKind(item.result);
        const itemMode = modeById(item.mode || state.provider);
        return `
          <div class="history-card ${active}" data-history-id="${item.id}" role="button" tabindex="0">
            <div class="history-thumb">
              <img src="${item.imageSrc}" alt="" />
              <span class="history-badge ${itemKind === "style" ? "is-style" : "is-faithful"}">${escapeHtml(item.modeName || itemMode.name)}</span>
              <button class="history-delete" data-delete-id="${item.id}" data-i18n-title="deleteEntry" title="Xóa" aria-label="Xóa"><svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>
            </div>
            <div class="history-meta">
              <div class="history-line">${escapeHtml(item.text)}</div>
            </div>
          </div>
        `;
      })
      .join("");

    const openEntry = (id) => {
      const item = state.history.find((entry) => entry.id === id);
      if (!item) {
        return;
      }
      setState({
        panelOpen: true,
        status: "success",
        result: item.result,
        mode: item.mode || state.provider,
        target: {
          src: item.imageSrc,
          pageUrl: item.pageUrl,
          naturalWidth: 0,
          naturalHeight: 0,
          alt: ""
        },
        activeHistoryId: item.id
      });
    };

    list.querySelectorAll("[data-history-id]").forEach((card) => {
      card.addEventListener("click", () => openEntry(card.getAttribute("data-history-id")));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openEntry(card.getAttribute("data-history-id"));
        }
      });
    });

    list.querySelectorAll("[data-delete-id]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteHistoryEntry(button.getAttribute("data-delete-id"));
      });
    });

    applyStaticI18n();
  }

  function applyStaticI18n() {
    shadow.querySelectorAll("[data-i18n]").forEach((node) => {
      node.textContent = t(node.getAttribute("data-i18n"));
    });
    shadow.querySelectorAll("[data-i18n-title]").forEach((node) => {
      node.setAttribute("title", t(node.getAttribute("data-i18n-title")));
    });
  }

  function tn(key, n) {
    return t(key).replace("{n}", String(n));
  }

  function renderModeIcon(resultKind) {
    if (resultKind === "style") {
      return `<svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="9.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9" r="1.2" fill="currentColor" stroke="none"/><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none"/><path d="M12 21a3 3 0 0 1 0-6 2 2 0 0 0 0-4"/></svg>`;
    }
    return `<svg class="pc-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.1 5.1L19 10l-4.9 1.9L12 17l-2.1-5.1L5 10l4.9-1.9z"/></svg>`;
  }

  function renderHoverButtons() {
    const menu = shadow.querySelector(".hover-menu");
    if (!menu) {
      return;
    }
    const currentModes = modes();
    menu.innerHTML = currentModes
      .map((mode, index) => `
        <button class="hover-button${index === 0 ? " primary" : ""}" data-hover-mode="${escapeHtml(mode.id)}">
          ${renderModeIcon(mode.resultKind)}
          <span>${escapeHtml(mode.name)}</span>
        </button>
      `)
      .join("");
  }

  function updateQuotaChip() {
    /* paywall removed — no quota UI */
  }

  function render() {
    ensureRoot();
    const workspace = shadow.querySelector(".workspace");
    const body = shadow.querySelector(".body");
    const copyButton = shadow.querySelector('[data-action="copy-result"]');

    workspace.classList.toggle("open", state.panelOpen);
    workspace.classList.toggle("history-hidden", !state.historyVisible);
    workspace.classList.toggle("minimized", state.panelOpen && state.minimized);
    applyPanelSize();

    const dock = shadow.querySelector("[data-mini-dock]");
    if (dock) {
      // Show on allowlisted sites unless full panel is open; respect temporary user hide.
      const userHidden = dock.dataset.userHidden === "1";
      const dockShown =
        state.siteAllowed && !userHidden && (!state.panelOpen || state.minimized);
      dock.classList.toggle("show", dockShown);
      dock.classList.toggle("tray-open", dockShown && dockTrayOpen);
      const orb = dock.querySelector(".mini-orb");
      if (orb) {
        orb.setAttribute("aria-expanded", dockTrayOpen ? "true" : "false");
      }
      if (dockShown) {
        applyDockPos();
      } else {
        dockTrayOpen = false;
      }
    }
    const overlayToggle = shadow.querySelector('[data-action="toggle-overlay"]');
    if (overlayToggle) {
      overlayToggle.setAttribute("aria-checked", state.overlayEnabled ? "true" : "false");
    }

    const historyToggle = shadow.querySelector('[data-action="toggle-history"]');
    if (historyToggle) {
      historyToggle.setAttribute("aria-pressed", state.historyVisible ? "true" : "false");
    }
    renderHoverButtons();
    applyStaticI18n();
    body.innerHTML = renderMainBody();
    updateQuotaChip();
    copyButton.disabled = !state.result;

    shadow.querySelectorAll("[data-language]").forEach((button) => {
      button.classList.toggle("active", button.getAttribute("data-language") === state.language);
    });

    body.querySelector('[data-action="analyze-largest"]')?.addEventListener("click", analyzeLargestImageOnPage);
    renderHistory();
  }

  document.addEventListener(
    "contextmenu",
    (event) => {
      lastContextPoint = { x: event.clientX, y: event.clientY };
    },
    true
  );

  document.addEventListener(
    "pointermove",
    (event) => {
      ensureRoot();
      if (!state.siteAllowed) {
        hideHoverMenu();
        return;
      }
      // Hover Faithful/Style chips are optional (settings.hoverActionsEnabled).
      if (!state.overlayEnabled) {
        hideHoverMenu();
        return;
      }
      if (isPointOverPanel(event.clientX, event.clientY)) {
        hideHoverMenu();
        return;
      }
      const image = findImageAtPoint(event.clientX, event.clientY);
      const hoverMenu = shadow.querySelector(".hover-menu");
      if (!image) {
        if (hoverMenu && hoverMenu.matches(":hover")) {
          return;
        }
        hideHoverMenu();
        return;
      }
      showHoverMenuForImage(image);
    },
    true
  );

  document.addEventListener(
    "scroll",
    () => {
      if (!state.siteAllowed) {
        return;
      }
      if (hoveredImage) {
        showHoverMenuForImage(hoveredImage);
      }
    },
    true
  );

  window.addEventListener("resize", () => {
    if (!state.siteAllowed) {
      return;
    }
    if (hoveredImage) {
      showHoverMenuForImage(hoveredImage);
    }
    if (state.siteAllowed && (!state.panelOpen || state.minimized)) {
      applyDockPos();
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "PROMPTCARD_OPEN_PANEL") {
      return false;
    }

    (async () => {
      try {
        await openPanel();
        const payload = message.payload || {};
        if (payload.startMode === "screenshot") {
          await startScreenshotFlow();
        } else if (payload.srcUrl || payload.startMode === "resolve-image" || payload.linkUrl) {
          const modeId =
            typeof payload.modeId === "string" && payload.modeId
              ? payload.modeId
              : state.provider;

          // Direct image context: use srcUrl (optionally enrich dimensions from DOM).
          if (payload.srcUrl && payload.startMode !== "resolve-image") {
            const matched = findImageBySrc(payload.srcUrl);
            const target = matched
              ? imageTargetFromElement(matched)
              : {
                  src: payload.srcUrl,
                  pageUrl: payload.pageUrl || location.href,
                  alt: "",
                  naturalWidth: 0,
                  naturalHeight: 0
                };
            await analyzeTarget(target, modeId);
            sendResponse({ ok: true, data: { opened: true } });
            return;
          }

          // Link / pin card: resolve the img under the last right-click or inside the anchor.
          const resolved = resolveContextImage({
            srcUrl: payload.srcUrl,
            linkUrl: payload.linkUrl,
            clientX: lastContextPoint.x,
            clientY: lastContextPoint.y
          });
          if (!resolved) {
            setState({
              panelOpen: true,
              status: "error",
              error: t("noContextImage")
            });
            sendResponse({ ok: false, error: t("noContextImage") });
            return;
          }
          await analyzeTarget(imageTargetFromElement(resolved), modeId);
        } else {
          render();
        }
        sendResponse({ ok: true, data: { opened: true } });
      } catch (error) {
        sendResponse({ ok: false, error: error instanceof Error ? error.message : t("analysisFailed") });
      }
    })();

    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[ALLOWED_SITES_KEY]) {
      state.siteAllowed = isCurrentSiteAllowed(changes[ALLOWED_SITES_KEY].newValue);
      if (!state.siteAllowed) {
        hideHoverMenu();
        state.panelOpen = false;
        state.minimized = false;
      }
    }
    if (SETTINGS_KEYS.some((key) => changes[key])) {
      refreshRuntimeSettings().then(render);
      return;
    }
    render();
  });

  if (isExtensionAlive()) {
    Promise.all([
      refreshRuntimeSettings(),
      chrome.storage.local
        .get([ALLOWED_SITES_KEY])
        .then((stored) => {
          state.siteAllowed = isCurrentSiteAllowed(stored[ALLOWED_SITES_KEY]);
        })
    ])
      .then(() => {
        render();
      })
      .catch(() => {});
  } else {
    state.siteAllowed = isCurrentSiteAllowed(DEFAULT_ALLOWED_SITES);
    state.modes = fallbackModes();
    state.provider = state.modes[0].id;
    state.mode = state.provider;
    render();
  }

  ensureRoot();
})();
