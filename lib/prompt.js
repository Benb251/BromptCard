import { STYLE_SYSTEM_PROMPT, SYSTEM_PROMPT } from "../constants.js";
import { aspectRatio } from "./image.js";

function imageMetaLines(target) {
  return [
    `Image size: ${target?.naturalWidth || "unknown"}x${target?.naturalHeight || "unknown"}`,
    `Aspect ratio: ${aspectRatio(target?.naturalWidth, target?.naturalHeight)}`,
    "Use exactly this Aspect ratio value in vi.prompt, en.prompt and recreation_prompt when those fields apply. Do not omit it."
  ];
}

export function buildPromptText(target) {
  return [
    SYSTEM_PROMPT,
    "",
    "Reminder: reply with ONE json code block and nothing else, using only the keys vi, en, vi_style_tags, en_style_tags, recreation_prompt, negative_prompt.",
    "vi fields in Vietnamese, en fields in English.",
    ...imageMetaLines(target)
  ].join("\n");
}

export function buildStylePromptText(target) {
  return [
    STYLE_SYSTEM_PROMPT,
    "",
    "Reminder: return valid JSON only (no markdown fences). transfer_prompt is mandatory and must start with [SUBJECT].",
    ...imageMetaLines(target)
  ].join("\n");
}

export function buildModePromptText(target, mode) {
  if (mode?.systemPrompt && typeof mode.systemPrompt === "string" && mode.systemPrompt.trim()) {
    return [
      mode.systemPrompt.trim(),
      "",
      ...imageMetaLines(target)
    ].join("\n");
  }

  const isStyle =
    mode?.resultKind === "style" || mode?.outputFormat === "style";
  return isStyle ? buildStylePromptText(target) : buildPromptText(target);
}
