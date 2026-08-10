import { AnalysisError } from "./schema.js";
import { JPEG_QUALITY, MAX_IMAGE_EDGE } from "../constants.js";

const DIRECT_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
}

export function aspectRatio(width, height) {
  if (!width || !height) {
    return "unknown";
  }
  const factor = gcd(width, height);
  return `${Math.round(width / factor)}:${Math.round(height / factor)}`;
}

export function detectMimeFromUrl(url) {
  const lower = String(url || "").toLowerCase();
  if (lower.includes(".png")) {
    return "image/png";
  }
  if (lower.includes(".webp")) {
    return "image/webp";
  }
  if (lower.includes(".gif")) {
    return "image/gif";
  }
  return "image/jpeg";
}

function normalizeMimeType(type) {
  const clean = String(type || "").split(";")[0].trim().toLowerCase();
  if (clean === "image/jpg") {
    return "image/jpeg";
  }
  return clean;
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 32768;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBlob(data, mimeType) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function decodeImage(blob) {
  if (typeof createImageBitmap !== "function") {
    throw new AnalysisError("This browser cannot inspect the image returned by the site.");
  }
  try {
    return await createImageBitmap(blob);
  } catch {
    throw new AnalysisError("Could not prepare the image for analysis.");
  }
}

async function reencodeImage(blob, bitmap = null) {
  if (typeof OffscreenCanvas === "undefined") {
    if (bitmap) {
      bitmap.close();
    }
    throw new AnalysisError("This browser cannot re-encode the image format returned by the site.");
  }

  const source = bitmap || await decodeImage(blob);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    source.close();
    throw new AnalysisError("Could not prepare the image for analysis.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  source.close();

  const jpegBlob = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: JPEG_QUALITY
  });

  return {
    mimeType: "image/jpeg",
    data: arrayBufferToBase64(await jpegBlob.arrayBuffer())
  };
}

async function blobToPayload(blob, fallbackType = "image/png") {
  const mimeType = normalizeMimeType(blob.type || fallbackType || "image/png");
  const bitmap = await decodeImage(blob);
  const oversized = Math.max(bitmap.width, bitmap.height) > MAX_IMAGE_EDGE;

  if (DIRECT_MIME_TYPES.has(mimeType) && !oversized) {
    bitmap.close();
    return {
      mimeType,
      data: arrayBufferToBase64(await blob.arrayBuffer())
    };
  }

  return reencodeImage(blob, bitmap);
}

function parseDataUrl(url) {
  const match = String(url || "").match(/^data:(.*?);base64,(.*)$/i);
  if (!match) {
    return null;
  }
  return {
    mimeType: normalizeMimeType(match[1] || "image/png"),
    data: match[2]
  };
}

export async function imageTargetToPayload(target) {
  if (typeof target?.src !== "string" || !target.src.trim()) {
    throw new AnalysisError("No image source was provided.");
  }

  const inline = parseDataUrl(target.src);
  if (inline) {
    return blobToPayload(base64ToBlob(inline.data, inline.mimeType), inline.mimeType);
  }

  const response = await fetch(target.src);
  if (!response.ok) {
    throw new AnalysisError(`Image fetch failed (${response.status}).`);
  }

  const blob = await response.blob();
  return blobToPayload(blob, detectMimeFromUrl(target.src));
}
