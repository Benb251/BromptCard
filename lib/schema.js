export class AnalysisError extends Error {
  constructor(message, code = "ANALYSIS_FAILED") {
    super(message);
    this.name = "AnalysisError";
    this.code = code;
  }
}

export function shorten(text, limit = 320) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= limit) {
    return clean;
  }
  return `${clean.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

export function normalizeQuotes(text) {
  return String(text || "")
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/\u00A0/g, " ");
}

export function stripCodeFence(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }
  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function fencedBlocks(text) {
  const blocks = [];
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const body = match[1].trim();
    if (body) {
      blocks.push(body);
    }
  }
  return blocks;
}

function balancedObject(text) {
  const start = text.indexOf("{");
  if (start === -1) {
    return "";
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return "";
}

export function extractJsonString(text) {
  const normalized = normalizeQuotes(text);

  for (const block of fencedBlocks(normalized)) {
    const fromBlock = balancedObject(block);
    if (fromBlock) {
      return fromBlock;
    }
  }

  const balanced = balancedObject(normalized);
  if (balanced) {
    return balanced;
  }

  const clean = stripCodeFence(normalized);
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return clean;
  }
  return clean.slice(start, end + 1);
}

/** Flatten key for alias matching: vi_style_tags / vistyletags / vi-style-tags → vistyletags */
function flatKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const KEY_ALIASES = {
  vistyletags: "vi_style_tags",
  enstyletags: "en_style_tags",
  styletags: "en_style_tags",
  recreationprompt: "recreation_prompt",
  promptcore: "prompt_core",
  negativeprompt: "negative_prompt",
  jsonprompt: "json_prompt",
  transferprompt: "transfer_prompt",
  stylefamily: "style_family",
  contentdomain: "content_domain",
  stylereconstruction: "style_reconstruction",
  domainspecificanalysis: "domain_specific_analysis",
  transferpriority: "transfer_priority",
  whatnottocopy: "what_not_to_copy",
  targetreplacementinstructions: "target_replacement_instructions"
};

/**
 * Models often drop underscores in keys (vistyletags vs vi_style_tags).
 * Remap known aliases; leave unknown keys as-is.
 */
export function canonicalizeKeys(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeKeys(item, depth + 1));
  }
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    const flat = flatKey(key);
    const mapped = KEY_ALIASES[flat] || key;
    const next = canonicalizeKeys(child, depth + 1);
    // Prefer first write; don't overwrite richer existing key
    if (out[mapped] === undefined) {
      out[mapped] = next;
    } else if (
      out[mapped] &&
      typeof out[mapped] === "object" &&
      next &&
      typeof next === "object" &&
      !Array.isArray(out[mapped]) &&
      !Array.isArray(next)
    ) {
      out[mapped] = { ...out[mapped], ...next };
    }
  }
  return out;
}

/**
 * Escape bare " inside JSON string values when the next non-space is not , } ] :
 * Fixes LLM output like: "prompt": "The "WAYFINDER" logo..."
 */
export function repairLooseJsonStrings(text) {
  const input = String(text || "");
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (!inString) {
      out += char;
      if (char === '"') {
        inString = true;
        escaped = false;
      }
      continue;
    }
    if (escaped) {
      out += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      out += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) {
        j += 1;
      }
      const next = input[j] || "";
      // Real end of string if followed by structural token or end of input.
      if (!next || next === "," || next === "}" || next === "]" || next === ":") {
        out += char;
        inString = false;
      } else {
        // Interior unescaped quote → escape it.
        out += '\\"';
      }
      continue;
    }
    out += char;
  }
  return out;
}

export function parseJsonLenient(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new SyntaxError("Empty JSON");
  }
  const attempts = [
    raw,
    raw.replace(/,\s*([}\]])/g, "$1"),
    repairLooseJsonStrings(raw),
    repairLooseJsonStrings(raw.replace(/,\s*([}\]])/g, "$1"))
  ];
  let lastError;
  for (const candidate of attempts) {
    try {
      return canonicalizeKeys(JSON.parse(candidate));
    } catch (error) {
      lastError = error;
    }
  }
  // Last resort: rebuild a minimal prompt payload from loose field extraction.
  const rebuilt = rebuildPromptObjectFromLooseText(raw);
  if (rebuilt) {
    return canonicalizeKeys(rebuilt);
  }
  throw lastError || new SyntaxError("Unable to parse JSON");
}

function readLooseJsonString(text, startIndex) {
  // startIndex points at the opening quote.
  if (text[startIndex] !== '"') {
    return { value: "", end: startIndex };
  }
  let i = startIndex + 1;
  let value = "";
  while (i < text.length) {
    const char = text[i];
    if (char === "\\") {
      value += char + (text[i + 1] || "");
      i += 2;
      continue;
    }
    if (char === '"') {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) {
        j += 1;
      }
      const next = text[j] || "";
      if (!next || next === "," || next === "}" || next === "]" || next === ":") {
        return { value, end: i + 1 };
      }
      value += char;
      i += 1;
      continue;
    }
    value += char;
    i += 1;
  }
  return { value, end: i };
}

function extractLooseField(text, fieldName) {
  const re = new RegExp(`"${fieldName}"\\s*:\\s*"`, "i");
  const match = re.exec(text);
  if (!match) {
    return "";
  }
  const openQuote = match.index + match[0].length - 1;
  const { value } = readLooseJsonString(text, openQuote);
  return value.replace(/\\"/g, '"').replace(/\\n/g, "\n").trim();
}

function extractLooseNested(text, parent, field) {
  const parentRe = new RegExp(`"${parent}"\\s*:\\s*\\{`, "i");
  const parentMatch = parentRe.exec(text);
  if (!parentMatch) {
    return "";
  }
  const from = parentMatch.index + parentMatch[0].length - 1;
  const block = balancedObject(text.slice(from));
  if (!block) {
    return "";
  }
  return extractLooseField(block, field);
}

function extractLooseStringArray(text, fieldName) {
  const re = new RegExp(`"${fieldName}"\\s*:\\s*\\[([^\\]]*)\\]`, "i");
  const match = re.exec(text);
  if (!match) {
    return [];
  }
  const body = match[1];
  const items = [];
  const itemRe = /"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = itemRe.exec(body)) !== null) {
    items.push(m[1].replace(/\\"/g, '"').trim());
  }
  return items.filter(Boolean);
}

function rebuildPromptObjectFromLooseText(text) {
  const viPrompt =
    extractLooseNested(text, "vi", "prompt") || extractLooseField(text, "vi.prompt");
  const enPrompt =
    extractLooseNested(text, "en", "prompt") || extractLooseField(text, "en.prompt");
  const viAnalysis = extractLooseNested(text, "vi", "analysis");
  const enAnalysis = extractLooseNested(text, "en", "analysis");
  if (!viPrompt && !enPrompt) {
    return null;
  }
  return {
    vi: { prompt: viPrompt, analysis: viAnalysis },
    en: { prompt: enPrompt, analysis: enAnalysis },
    vi_style_tags: extractLooseStringArray(text, "vi_style_tags").length
      ? extractLooseStringArray(text, "vi_style_tags")
      : extractLooseStringArray(text, "vistyletags"),
    en_style_tags: extractLooseStringArray(text, "en_style_tags").length
      ? extractLooseStringArray(text, "en_style_tags")
      : extractLooseStringArray(text, "enstyletags"),
    recreation_prompt:
      extractLooseField(text, "recreation_prompt") || extractLooseField(text, "recreationprompt"),
    negative_prompt:
      extractLooseField(text, "negative_prompt") || extractLooseField(text, "negativeprompt"),
    prompt_core: extractLooseField(text, "prompt_core") || extractLooseField(text, "promptcore")
  };
}

function asArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deepStrings(value, out) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      out.push(trimmed);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      deepStrings(item, out);
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      deepStrings(item, out);
    }
  }
  return out;
}

function pickPromptLike(raw) {
  // Salvage a usable prompt from an unexpected JSON shape.
  const candidates = [
    raw?.recreation_prompt,
    raw?.prompt_core,
    raw?.prompt,
    raw?.prompts?.midjourney,
    raw?.prompts?.stable_diffusion,
    raw?.midjourney,
    raw?.stable_diffusion,
    raw?.en?.prompt,
    raw?.vi?.prompt
  ];
  for (const candidate of candidates) {
    const text = asString(candidate);
    if (text) {
      return text;
    }
  }
  const longest = deepStrings(raw, []).sort((a, b) => b.length - a.length)[0];
  return longest || "";
}

export function normalizePayload(rawInput) {
  if (!rawInput || typeof rawInput !== "object") {
    throw new AnalysisError("The model returned an invalid payload.");
  }

  const raw = canonicalizeKeys(rawInput);

  const viPrompt = asString(raw.vi?.prompt);
  const enPrompt = asString(raw.en?.prompt);

  if (viPrompt || enPrompt) {
    const recreation = asString(raw.recreation_prompt) || enPrompt || viPrompt;
    const hasCanonicalTags =
      asArray(raw.vi_style_tags).length > 0 || asArray(raw.en_style_tags).length > 0;
    return {
      kind: "prompt",
      vi: {
        prompt: viPrompt || enPrompt,
        analysis: asString(raw.vi?.analysis)
      },
      en: {
        prompt: enPrompt || viPrompt,
        analysis: asString(raw.en?.analysis)
      },
      vi_style_tags: asArray(raw.vi_style_tags).slice(0, 4),
      en_style_tags: asArray(raw.en_style_tags).slice(0, 4),
      recreation_prompt: recreation,
      negative_prompt: asString(raw.negative_prompt),
      salvaged: false
    };
  }

  // Fallback: the model ignored the schema. Salvage the best prompt we can find.
  const salvaged = pickPromptLike(raw);
  if (!salvaged) {
    throw new AnalysisError("The model response did not contain a usable prompt.");
  }

  const negative = asString(raw.negative_prompt) || asString(raw.prompts?.negative);
  const tags = asArray(raw.en_style_tags).length
    ? asArray(raw.en_style_tags)
    : asArray(raw.art_style?.quality_tags);

  return {
    kind: "prompt",
    vi: { prompt: salvaged, analysis: "" },
    en: { prompt: salvaged, analysis: "" },
    vi_style_tags: asArray(raw.vi_style_tags).slice(0, 4),
    en_style_tags: tags.slice(0, 4),
    recreation_prompt: salvaged,
    negative_prompt: negative,
    salvaged: true
  };
}

function stripInlineMarkup(text) {
  return String(text || "")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[*_`>#]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:prompt|cau prompt|câu prompt|suggested prompt|final prompt)\s*[:\-]\s*/i, "")
    .trim();
}

function salvageFromProse(text) {
  // Gemini often puts the recreatable prompt in a blockquote ("> ...").
  const quoted = [];
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^\s*>\s?(.*)$/);
    if (match && match[1].trim()) {
      quoted.push(match[1].trim());
    }
  }
  if (quoted.length) {
    const joined = stripInlineMarkup(quoted.join(" "));
    if (joined.length >= 40) {
      return joined;
    }
  }

  // Otherwise take the longest paragraph as the prompt.
  const paragraphs = String(text)
    .split(/\n\s*\n/)
    .map((part) => stripInlineMarkup(part))
    .filter((part) => part.length >= 40);
  paragraphs.sort((a, b) => b.length - a.length);
  return paragraphs[0] || "";
}

function isGeminiUiStatus(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    return false;
  }
  return /^(creating your image|generating( your)?( image|response)?|thinking|đang tạo|đang suy nghĩ|loading|working on it)\b/i.test(
    clean
  );
}

export function parseAnalysisText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new AnalysisError("The model returned no message content.");
  }

  if (isGeminiUiStatus(trimmed) || (trimmed.length < 80 && !trimmed.includes("{"))) {
    throw new AnalysisError(
      `Gemini returned a status message instead of a prompt JSON (e.g. "${shorten(trimmed, 80)}"). ` +
        "Use a Gem that analyzes the image and replies with text/JSON — not an image-generation Gem. " +
        "Keep the Gem window focused until a full reply appears, then retry.",
      "STATUS_ONLY"
    );
  }

  const json = extractJsonString(trimmed);
  try {
    return normalizePayload(parseJsonLenient(json));
  } catch (error) {
    // The reply was not valid JSON. Try to salvage a usable prompt from prose
    // so the user still gets a result instead of a hard error.
    // Prefer not to dump the whole JSON blob as the "prompt".
    const looksLikeJson = /^\s*[{[]/.test(trimmed) || trimmed.includes('"prompt"');
    const salvaged = looksLikeJson ? "" : salvageFromProse(trimmed);
    if (salvaged && salvaged.length >= 40 && !isGeminiUiStatus(salvaged)) {
      return {
        kind: "prompt",
        vi: { prompt: salvaged, analysis: "" },
        en: { prompt: salvaged, analysis: "" },
        vi_style_tags: [],
        en_style_tags: [],
        recreation_prompt: salvaged,
        negative_prompt: "",
        salvaged: true,
        raw: trimmed
      };
    }

    const reason = error instanceof Error ? error.message : "Unknown parse error";
    const snippet = shorten(trimmed, 280);
    throw new AnalysisError(
      `The provider responded, but BromptCard could not parse a prompt. ${reason}. Raw reply: ${snippet}`,
      "PARSE_FAILED"
    );
  }
}

function normalizePromptResult(result, rawText = "") {
  return {
    kind: "prompt",
    ...result,
    raw: String(rawText || "").trim()
  };
}

function asStyleObject(value, keys) {
  const out = {};
  const source = value && typeof value === "object" ? value : {};
  for (const key of keys) {
    out[key] = asString(source[key]);
  }
  return out;
}

const STYLE_RECON_KEYS = [
  "medium_and_finish",
  "shape_language",
  "line_edge_language",
  "surface_texture_logic",
  "material_or_shader_logic",
  "color_logic",
  "lighting_logic",
  "composition_perspective_logic",
  "detail_density",
  "production_finish",
  "transferable_style_summary"
];

const STYLE_DOMAIN_KEYS = [
  "character_or_portrait",
  "product_or_prop",
  "environment_or_architecture",
  "graphic_design_or_layout",
  "traditional_or_digital_art",
  "photography_or_film"
];

export function normalizeStylePayload(rawInput) {
  if (!rawInput || typeof rawInput !== "object") {
    throw new AnalysisError("The model returned an invalid style payload.");
  }

  const raw = canonicalizeKeys(rawInput);

  const transfer = asString(raw.transfer_prompt) || asString(raw.pose_prompt) || asString(raw.target_pose_instructions);
  const recon = asStyleObject(raw.style_reconstruction, STYLE_RECON_KEYS);
  if (!transfer && !recon.transferable_style_summary) {
    throw new AnalysisError("The style response is missing the transfer prompt.");
  }

  const derivedTags = [
    asString(raw.pose_domain),
    asString(raw.camera_and_framing?.camera_angle),
    asString(raw.camera_and_framing?.shot_type),
    asString(raw.gesture_and_expression_logic?.gesture_energy)
  ].filter(Boolean);

  return {
    kind: "style",
    content_domain: asString(raw.content_domain) || asString(raw.pose_domain),
    style_family: asString(raw.style_family) || asString(raw.pose_domain),
    not_style_family: asString(raw.not_style_family),
    style_reconstruction: recon,
    domain_specific_analysis: asStyleObject(raw.domain_specific_analysis, STYLE_DOMAIN_KEYS),
    transfer_priority: asArray(raw.transfer_priority).length
      ? asArray(raw.transfer_priority).slice(0, 4)
      : asArray(raw.pose_transfer_priority).slice(0, 4),
    what_not_to_copy: asString(raw.what_not_to_copy),
    target_replacement_instructions: asString(raw.target_replacement_instructions) || asString(raw.target_pose_instructions),
    style_tags: asArray(raw.style_tags).length ? asArray(raw.style_tags).slice(0, 4) : derivedTags.slice(0, 4),
    transfer_prompt: transfer,
    negative_prompt: asString(raw.negative_prompt)
  };
}

export function parseStyleText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new AnalysisError("The model returned no message content.");
  }
  const json = extractJsonString(trimmed);
  try {
    return {
      ...normalizeStylePayload(parseJsonLenient(json)),
      raw: trimmed
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown parse error";
    const snippet = shorten(trimmed, 280);
    throw new AnalysisError(
      `The provider responded, but BromptCard could not parse the style JSON. ${reason}. Raw reply: ${snippet}`,
      "PARSE_FAILED"
    );
  }
}

function getByPath(source, path) {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  const segments = String(path || "")
    .split(".")
    .map((item) => item.trim())
    .filter(Boolean);
  let current = source;
  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (typeof current === "object") {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

function firstStringFromPath(source, paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  for (const path of list) {
    const text = asString(getByPath(source, path));
    if (text) {
      return text;
    }
  }
  return "";
}

function arrayStringsFromPath(source, paths) {
  const list = Array.isArray(paths) ? paths : [paths];
  const output = [];
  for (const path of list) {
    const value = getByPath(source, path);
    if (Array.isArray(value)) {
      output.push(...asArray(value));
    } else {
      const text = asString(value);
      if (text) {
        output.push(text);
      }
    }
  }
  return [...new Set(output)].slice(0, 8);
}

function normalizeMetaFields(raw, mode) {
  const fields = Array.isArray(mode?.metaFields) ? mode.metaFields : [];
  const output = [];
  for (const path of fields) {
    const value = getByPath(raw, path);
    if (value == null) {
      continue;
    }
    const text = Array.isArray(value) ? asArray(value).join(", ") : asString(value);
    if (!text) {
      continue;
    }
    output.push({
      key: path,
      label: path.split(".").pop() || path,
      value: text
    });
  }
  return output;
}

function pickMappedPrimary(raw, mode) {
  const mapped = firstStringFromPath(raw, mode?.primaryField);
  if (mapped) {
    return mapped;
  }
  if (mode?.resultKind === "style") {
    return firstStringFromPath(raw, ["transfer_prompt", "lighting_prompt", "prompt", "summary"]);
  }
  return firstStringFromPath(raw, [
    "recreation_prompt",
    "en.prompt",
    "vi.prompt",
    "prompt",
    "main_prompt",
    "lighting_prompt"
  ]);
}

function createMappedResult(raw, rawText, mode, salvaged = false) {
  const primaryText = pickMappedPrimary(raw, mode);
  const negativePrompt =
    firstStringFromPath(raw, mode?.negativeField) ||
    firstStringFromPath(raw, ["negative_prompt", "negative", "prompts.negative"]);
  const tags = arrayStringsFromPath(raw, mode?.tagFields);
  return {
    kind: "mapped",
    resultKind: mode?.resultKind === "style" ? "style" : "prompt",
    primaryText,
    negativePrompt,
    tags,
    meta: normalizeMetaFields(raw, mode),
    raw: String(rawText || "").trim(),
    salvaged
  };
}

export function parseModeResponse(text, mode = {}) {
  const outputFormat = mode?.outputFormat || (mode?.resultKind === "style" ? "style" : "prompt");

  if (outputFormat === "style") {
    return parseStyleText(text);
  }
  if (outputFormat === "prompt") {
    return normalizePromptResult(parseAnalysisText(text), text);
  }

  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new AnalysisError("The model returned no message content.");
  }

  try {
    const raw = parseJsonLenient(extractJsonString(trimmed));
    const mapped = createMappedResult(raw, trimmed, mode);
    if (mapped.primaryText) {
      return mapped;
    }
    if (mode?.rawFallback !== false) {
      const fallback = salvageFromProse(trimmed) || pickPromptLike(raw) || trimmed;
      return {
        ...mapped,
        primaryText: fallback,
        salvaged: true
      };
    }
    throw new AnalysisError("The custom JSON did not contain the configured primary field.", "PARSE_FAILED");
  } catch (error) {
    if (mode?.rawFallback === false) {
      if (error instanceof AnalysisError) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : "Unknown parse error";
      throw new AnalysisError(`Could not parse the custom JSON. ${reason}`, "PARSE_FAILED");
    }

    const fallback = salvageFromProse(trimmed) || trimmed;
    return {
      kind: "mapped",
      resultKind: mode?.resultKind === "style" ? "style" : "prompt",
      primaryText: fallback,
      negativePrompt: "",
      tags: [],
      meta: [],
      raw: trimmed,
      salvaged: true
    };
  }
}
