export function injectedAutomation(config) {
  const { base64, mimeType, promptText, selectors, timing, skipImage } = config;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function isVisible(node) {
    if (!node) {
      return false;
    }
    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function pickVisible(list) {
    for (const selector of list) {
      for (const node of document.querySelectorAll(selector)) {
        if (isVisible(node)) {
          return node;
        }
      }
    }
    return null;
  }

  function pickAny(list) {
    for (const selector of list) {
      const node = document.querySelector(selector);
      if (node) {
        return node;
      }
    }
    return null;
  }

  function isDisabled(button) {
    if (!button) {
      return true;
    }
    if (button.disabled) {
      return true;
    }
    if (button.getAttribute("aria-disabled") === "true") {
      return true;
    }
    if (/(^|\s)(disabled|mat-mdc-button-disabled)(\s|$)/.test(button.className || "")) {
      return true;
    }
    return false;
  }

  function buttonHasIcon(button, icons) {
    if (!icons || !icons.length) {
      return false;
    }
    const iconNodes = button.querySelectorAll("mat-icon, .material-icons, .material-symbols-outlined, [data-mat-icon-name]");
    for (const icon of iconNodes) {
      const name = (icon.getAttribute("data-mat-icon-name") || icon.getAttribute("fonticon") || icon.textContent || "")
        .trim()
        .toLowerCase();
      if (icons.some((wanted) => name === wanted || name.includes(wanted))) {
        return true;
      }
    }
    return false;
  }

  function findButton(list, icons, { visibleOnly = true } = {}) {
    const direct = visibleOnly ? pickVisible(list) : pickAny(list);
    if (direct) {
      return direct;
    }
    if (icons && icons.length) {
      for (const button of document.querySelectorAll("button")) {
        if ((!visibleOnly || isVisible(button)) && buttonHasIcon(button, icons)) {
          return button;
        }
      }
    }
    return null;
  }

  async function waitFor(fn, timeoutMs, pollMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const value = fn();
      if (value) {
        return value;
      }
      if (Date.now() > deadline) {
        return null;
      }
      await sleep(pollMs);
    }
  }

  function base64ToBlob(b64, type) {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let index = 0; index < len; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: type || "image/png" });
  }

  function readEditorText(editor) {
    if (!editor) {
      return "";
    }
    if (editor.value !== undefined && editor.tagName === "TEXTAREA") {
      return String(editor.value || "").trim();
    }
    return (editor.innerText || editor.textContent || "").trim();
  }

  function nonSpaceLen(value) {
    const matches = String(value || "").match(/\S/g);
    return matches ? matches.length : 0;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function pasteText(editor, text) {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    const html = String(text)
      .split("\n")
      .map((line) => (line.length ? `<p>${escapeHtml(line)}</p>` : "<p><br></p>"))
      .join("");
    dataTransfer.setData("text/html", html);
    editor.focus();
    const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
    try {
      Object.defineProperty(pasteEvent, "clipboardData", { value: dataTransfer });
    } catch {
      /* some engines lock clipboardData; ignore */
    }
    editor.dispatchEvent(pasteEvent);
  }

  function clearEditor(editor) {
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("delete", false);
    } catch {
      /* ignore */
    }
    if (readEditorText(editor).length > 0) {
      editor.innerHTML = "";
    }
  }

  function setEditorText(editor, text) {
    editor.focus();

    // Rich editors (Gemini uses Quill) truncate a pasted string at the first
    // newline, so multi-line prompts only land their first line. Flatten the
    // prompt to a single line; the model reads it the same.
    const flat = String(text).replace(/\s*\n+\s*/g, "  ").trim();

    if (editor.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      if (setter && setter.set) {
        setter.set.call(editor, text);
      } else {
        editor.value = text;
      }
      editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const target = nonSpaceLen(flat);
    const enough = () => nonSpaceLen(readEditorText(editor)) >= Math.floor(target * 0.8);

    // Strategy 1: paste event (single line). Works in background tabs.
    clearEditor(editor);
    try {
      pasteText(editor, flat);
    } catch {
      /* fall through */
    }
    if (enough()) {
      return;
    }

    // Strategy 2: execCommand insertText (works when the document has focus).
    clearEditor(editor);
    try {
      const inserted = document.execCommand("insertText", false, flat);
      if (inserted) {
        editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
      }
    } catch {
      /* fall through */
    }
    if (enough()) {
      return;
    }

    // Strategy 3: direct DOM, single paragraph.
    editor.innerHTML = "";
    const paragraph = document.createElement("p");
    paragraph.textContent = flat;
    editor.appendChild(paragraph);
    editor.dispatchEvent(
      new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: flat })
    );
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function makeImageFile(blob) {
    const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
    return new File([blob], `promptcard.${ext}`, { type: blob.type || "image/png" });
  }

  function makeFileDataTransfer(file) {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    return dataTransfer;
  }

  function tryFileInputAttach(file) {
    const inputs = document.querySelectorAll('input[type="file"]');
    for (const input of inputs) {
      const accept = (input.getAttribute("accept") || "").toLowerCase();
      if (accept && !/image|\*\/\*|\.jpe?g|\.png|\.webp|\.gif/i.test(accept)) {
        continue;
      }
      try {
        const dt = makeFileDataTransfer(file);
        const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "files");
        if (desc && desc.set) {
          desc.set.call(input, dt.files);
        } else {
          Object.defineProperty(input, "files", { configurable: true, value: dt.files });
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      } catch {
        /* try next input */
      }
    }
    return false;
  }

  function dispatchDrop(target, dataTransfer) {
    if (!target) {
      return;
    }
    const base = { bubbles: true, cancelable: true, dataTransfer };
    for (const type of ["dragenter", "dragover", "drop"]) {
      try {
        target.dispatchEvent(new DragEvent(type, base));
      } catch {
        const evt = new Event(type, { bubbles: true, cancelable: true });
        try {
          Object.defineProperty(evt, "dataTransfer", { value: dataTransfer });
        } catch {
          /* ignore */
        }
        target.dispatchEvent(evt);
      }
    }
  }

  async function pasteImage(editor, blob) {
    const file = makeImageFile(blob);
    const dataTransfer = makeFileDataTransfer(file);

    try {
      editor.focus({ preventScroll: true });
    } catch {
      try {
        editor.focus();
      } catch {
        /* ignore */
      }
    }

    // 1) Clipboard paste into the composer (works when document is "visible").
    try {
      const pasteEvent = new ClipboardEvent("paste", { bubbles: true, cancelable: true });
      try {
        Object.defineProperty(pasteEvent, "clipboardData", { value: dataTransfer });
      } catch {
        /* some engines lock clipboardData; ignore */
      }
      editor.dispatchEvent(pasteEvent);
    } catch {
      /* fall through */
    }

    // 2) Drag/drop onto the editor and common drop zones (background-tab friendly).
    const dropTargets = [
      editor,
      editor.closest("rich-textarea"),
      editor.closest("form"),
      document.querySelector("[data-test-id='composer'], .input-area, .ql-editor")
    ].filter(Boolean);
    for (const target of dropTargets) {
      dispatchDrop(target, dataTransfer);
    }

    // 3) Hidden file inputs used by Gemini upload controls.
    tryFileInputAttach(file);
  }

  function clickButton(button) {
    button.scrollIntoView({ block: "center" });
    for (const type of ["pointerover", "pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      const Ctor = type.startsWith("pointer") ? PointerEvent : MouseEvent;
      button.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function attachmentState(editor) {
    const scope =
      editor.closest("rich-textarea")?.parentElement?.parentElement ||
      editor.closest("form") ||
      editor.parentElement ||
      document.body;
    const attachmentSelectors = [
      "[data-test-id*='attachment' i]",
      "[data-test-id*='upload' i]",
      "[data-testid*='attachment' i]",
      "[data-testid*='upload' i]",
      "[aria-label*='Remove attachment' i]",
      "[aria-label*='Remove image' i]",
      "[aria-label*='Xóa tệp' i]",
      "[aria-label*='Xóa ảnh' i]",
      "file-preview",
      "uploaded-file"
    ];
    const nodes = [];
    for (const selector of attachmentSelectors) {
      for (const node of scope.querySelectorAll(selector)) {
        if (isVisible(node)) nodes.push(node);
      }
    }
    const unique = [...new Set(nodes)];
    const text = (scope.innerText || scope.textContent || "").replace(/\s+/g, " ").trim();
    const busy = /uploading|processing|preparing|đang tải|đang xử lý/i.test(text) ||
      Boolean(scope.querySelector("[role='progressbar'], mat-progress-bar, .progress-bar"));
    const signature = unique
      .map((node) => `${node.tagName}:${node.getAttribute("aria-label") || ""}:${node.textContent || ""}`)
      .join("|");
    return { count: unique.length, busy, signature };
  }

  async function waitForAttachmentReady(editor, before, timing, diag) {
    const deadline = Date.now() + (timing.attachmentWaitMs || 15000);
    let lastSignature = "";
    let stableSince = Date.now();
    let sawAttachment = false;
    for (;;) {
      const current = attachmentState(editor);
      const changed = current.count > before.count || current.signature !== before.signature;
      sawAttachment = sawAttachment || changed;
      if (current.signature !== lastSignature) {
        lastSignature = current.signature;
        stableSince = Date.now();
      }
      const stable = Date.now() - stableSince >= (timing.attachmentStableMs || 1200);
      if (!current.busy && stable && (sawAttachment || Date.now() + 1800 >= deadline)) {
        diag.attachmentFound = sawAttachment;
        diag.attachmentBusy = false;
        return true;
      }
      if (Date.now() > deadline) {
        diag.attachmentFound = sawAttachment;
        diag.attachmentBusy = current.busy;
        return !current.busy;
      }
      await sleep(timing.pollMs || 300);
    }
  }

  function pressEnter(editor) {
    try {
      editor.focus();
      for (const type of ["keydown", "keypress", "keyup"]) {
        editor.dispatchEvent(new KeyboardEvent(type, {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
      }
    } catch {
      /* fallback attempts are best effort */
    }
  }

  function isStatusOnlyText(text) {
    const clean = String(text || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) {
      return true;
    }
    // Gemini UI status lines — not the model answer (often shows during image gen).
    if (/^(creating your image|generating( your)?( image|response)?|thinking|đang tạo|đang suy nghĩ|loading|working on it)\b/i.test(clean)) {
      return true;
    }
    if (clean.length < 48 && !clean.includes("{") && /^(creating|generating|thinking|loading|working)\b/i.test(clean)) {
      return true;
    }
    // Status-like only, no JSON / no substantial prose.
    if (clean.length < 24 && !/[.!?{[]/.test(clean)) {
      return true;
    }
    return false;
  }

  function cleanResponseChrome(text) {
    return String(text || "")
      .replace(/\b(Copy|Sao chép|Use code with caution|Show more|Show less|Thêm|Thu gọn)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function extractTextFromNode(node) {
    if (!node) {
      return "";
    }
    // Prefer a code block: Gemini renders JSON inside <pre><code>.
    const codeBlocks = node.querySelectorAll("pre code, code");
    for (let index = codeBlocks.length - 1; index >= 0; index -= 1) {
      const code = (codeBlocks[index].innerText || codeBlocks[index].textContent || "").trim();
      if (code.includes("{") && code.includes("}")) {
        return code;
      }
    }
    return cleanResponseChrome(node.innerText || node.textContent || "");
  }

  function latestResponseText() {
    const nodes = document.querySelectorAll(selectors.response.join(","));
    if (!nodes.length) {
      return "";
    }

    // Walk newest → oldest; skip status-only bubbles ("Creating your image...").
    for (let i = nodes.length - 1; i >= 0; i -= 1) {
      const text = extractTextFromNode(nodes[i]);
      if (text && !isStatusOnlyText(text)) {
        return text;
      }
    }

    // Fall back to newest raw text (may still be status — caller keeps waiting).
    return extractTextFromNode(nodes[nodes.length - 1]);
  }

  function responseStarted(previousText) {
    const text = latestResponseText();
    if (!text || text === previousText) {
      return false;
    }
    // Do not treat UI status as "generation started" if stop button already covers that;
    // allowing status helps detect activity, but poll loop won't accept it as final.
    return true;
  }

  function isAcceptableFinalText(text, previousText) {
    if (!text || text === previousText) {
      return false;
    }
    if (isStatusOnlyText(text)) {
      return false;
    }
    // Prefer JSON-shaped replies for prompt modes; long prose also ok.
    if (text.includes("{") && text.includes("}")) {
      return true;
    }
    return text.length >= 80;
  }

  async function run() {
    const diag = {
      editorFound: false,
      editorText: 0,
      sendFound: false,
      sawGenerating: false,
      attachmentFound: false,
      attachmentBusy: false,
      sendAttempts: 0,
      hidden: typeof document !== "undefined" ? document.hidden : null,
      visibility: typeof document !== "undefined" ? document.visibilityState : null,
      hasFocus: typeof document !== "undefined" ? document.hasFocus() : null
    };

    try {
    // Nudge a frozen/black Gemini surface after window focus.
    try {
      window.focus();
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("visibilitychange"));
      document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX: 8, clientY: 8 }));
    } catch {
      /* ignore */
    }

    const editor = await waitFor(() => pickVisible(selectors.editor) || pickAny(selectors.editor), timing.editorWaitMs, 300);
    if (!editor) {
      return {
        ok: false,
        error: "NOT_READY",
        message:
          "Could not find the chat input. Gemini may still be a black/frozen window — keep the Gem window focused once so it can paint, then retry.",
        diag
      };
    }
    diag.editorFound = true;
    diag.hidden = document.hidden;
    diag.visibility = document.visibilityState;
    diag.hasFocus = document.hasFocus();

    const wantsText = nonSpaceLen(promptText) > 0;
    diag.expectedText = promptText.length;

    if (wantsText) {
      setEditorText(editor, promptText);
      await sleep(500);
      const insertedText = readEditorText(editor);
      diag.editorText = insertedText.length;

      const targetChars = nonSpaceLen(promptText);
      if (nonSpaceLen(insertedText) < Math.floor(targetChars * 0.6)) {
        return {
          ok: false,
          error: "TEXT_NOT_SET",
          message: `Only part of the prompt reached the chat input (${diag.editorText}/${diag.expectedText} chars). The editor truncated the paste.`,
          diag
        };
      }
    } else {
      diag.editorText = readEditorText(editor).length;
    }

    // Set the text before attaching the image. Some Gemini composer variants
    // keep an attachment inside the editable subtree, so clearing the editor
    // after an upload can accidentally remove the image.
    if (!skipImage && base64) {
      const blob = base64ToBlob(base64, mimeType);
      const beforeAttachment = attachmentState(editor);
      await pasteImage(editor, blob);
      await waitForAttachmentReady(editor, beforeAttachment, timing, diag);
      await sleep(timing.uploadSettleMs);
    }

    const sendButton = await waitFor(() => {
      const button = findButton(selectors.sendButton, selectors.sendIcons);
      return button && !isDisabled(button) ? button : null;
    }, timing.sendWaitMs, 300);

    if (!sendButton) {
      return {
        ok: false,
        error: "SEND_UNAVAILABLE",
        message: "The send button was not found or stayed disabled.",
        diag
      };
    }
    diag.sendFound = true;

    const previousResponseText = latestResponseText();
    const sendStarted = () => findButton(selectors.stopButton, selectors.stopIcons) || responseStarted(previousResponseText);
    try {
      sendButton.focus({ preventScroll: true });
      sendButton.click();
    } catch {
      clickButton(sendButton);
    }
    diag.sendAttempts = 1;

    let startMarker = await waitFor(
      sendStarted,
      timing.sendConfirmMs || 5000,
      timing.pollMs
    );
    if (!startMarker) {
      // Some Gemini variants ignore the native activation but accept the
      // full pointer sequence or Enter from the composer.
      clickButton(sendButton);
      pressEnter(editor);
      diag.sendAttempts = 2;
      startMarker = await waitFor(
        sendStarted,
        Math.max(1000, timing.responseStartMs - (timing.sendConfirmMs || 5000)),
        timing.pollMs
      );
    }

    if (!startMarker) {
      return {
        ok: false,
        error: "NO_RESPONSE",
        message: "Gemini did not confirm the send action. The image may still be processing, or this Gemini UI ignored automated send events.",
        diag
      };
    }

    // A stop button or changed model response confirms the request left the
    // composer. Continue with the existing response-stability loop below.
    diag.sawGenerating = true;

    let lastText = "";
    let lastAcceptable = "";
    let stableSince = Date.now();
    const deadline = Date.now() + timing.totalTimeoutMs;
    const minStable = Math.max(timing.stableMs || 2200, 2200);

    for (;;) {
      await sleep(timing.pollMs);
      const stopButton = findButton(selectors.stopButton, selectors.stopIcons);
      const text = latestResponseText();

      if (text && text !== previousResponseText && text !== lastText) {
        lastText = text;
        stableSince = Date.now();
        if (isAcceptableFinalText(text, previousResponseText)) {
          lastAcceptable = text;
        }
      }

      const stoppedStreaming = !stopButton;
      const stableLongEnough = Date.now() - stableSince >= minStable;
      const candidate = lastAcceptable || "";

      // Only finish when we have non-status content (JSON or long prose).
      if (candidate && stoppedStreaming && stableLongEnough) {
        return { ok: true, text: candidate, diag };
      }

      // Still streaming but already have solid JSON — wait for stability.
      if (candidate && candidate.includes("{") && stoppedStreaming && Date.now() - stableSince >= 1200) {
        return { ok: true, text: candidate, diag };
      }

      if (Date.now() > deadline) {
        if (lastAcceptable) {
          return { ok: true, text: lastAcceptable, partial: true, diag };
        }
        if (lastText && isStatusOnlyText(lastText)) {
          return {
            ok: false,
            error: "STATUS_ONLY",
            message:
              'Gemini only returned a status line (e.g. "Creating your image...") instead of a text/JSON prompt. Use a Gem that analyzes images and returns text (not image generation), then try again.',
            diag: { ...diag, lastText: String(lastText).slice(0, 120) }
          };
        }
        if (lastText) {
          return { ok: true, text: lastText, partial: true, diag };
        }
        return { ok: false, error: "TIMEOUT", message: "Timed out waiting for the provider response.", diag };
      }
    }
    } catch (error) {
      return {
        ok: false,
        error: "INJECTION_RUNTIME_ERROR",
        message: `Gemini automation script failed: ${error instanceof Error ? error.message : String(error)}`,
        diag
      };
    }
  }

  return run();
}
