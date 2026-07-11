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

async function reencodeImage(blob) {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    throw new AnalysisError("This browser cannot re-encode the image format returned by the site.");
  }

  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    bitmap.close();
    throw new AnalysisError("Could not prepare the image for analysis.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

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
  if (DIRECT_MIME_TYPES.has(mimeType)) {
    return {
      mimeType,
      data: arrayBufferToBase64(await blob.arrayBuffer())
    };
  }
  return reencodeImage(blob);
}

function parseDataUrl(url) {
  const match = String(url || "").match(/^data:(.*?);base64,(.*)$/i);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1] || "image/png",
    data: match[2]
  };
}

export async function imageTargetToPayload(target) {
  if (typeof target?.src !== "string" || !target.src.trim()) {
    throw new AnalysisError("No image source was provided.");
  }

  const inline = parseDataUrl(target.src);
  if (inline) {
    return inline;
  }

  const response = await fetch(target.src);
  if (!response.ok) {
    throw new AnalysisError(`Image fetch failed (${response.status}).`);
  }

  const blob = await response.blob();
  return blobToPayload(blob, detectMimeFromUrl(target.src));
}
