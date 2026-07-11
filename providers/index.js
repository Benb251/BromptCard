import { DEFAULT_GEM_MODES } from "../constants.js";
import { createGeminiProvider } from "./gemini.js";

export const DEFAULT_PROVIDER_ID = DEFAULT_GEM_MODES[0].id;

export function getDefaultModes() {
  return DEFAULT_GEM_MODES.map((mode) => ({ ...mode }));
}

export function createProviderFromMode(mode) {
  return createGeminiProvider(mode);
}
