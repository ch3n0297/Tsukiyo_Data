import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_DIST_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../frontend/dist",
);
const INDEX_FILE = "index.html";

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

function isReservedPath(pathname) {
  return pathname === "/health" || pathname === "/api" || pathname.startsWith("/api/");
}

function hasFileExtension(pathname) {
  return path.posix.extname(pathname) !== "";
}

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function getCacheControl(pathname) {
  return pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache";
}

function sendText(res, statusCode, message) {
  const body = Buffer.from(message, "utf8");
  res.writeHead(statusCode, {
    "cache-control": "no-cache",
    "content-length": body.length,
    "content-type": "text/plain; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}

function toRelativeAssetPath(pathname) {
  let decodedPath = pathname;

  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalized = path.posix.normalize(decodedPath);
  const relativePath = normalized.replace(/^\/+/, "");

  if (!relativePath) {
    return INDEX_FILE;
  }

  if (relativePath === ".." || relativePath.startsWith("../")) {
    return null;
  }

  return relativePath;
}

function resolveDistAssetPath(pathname) {
  const relativePath = toRelativeAssetPath(pathname);

  if (!relativePath) {
    return null;
  }

  const resolvedPath = path.resolve(FRONTEND_DIST_DIR, relativePath);
  const allowedPrefix = `${FRONTEND_DIST_DIR}${path.sep}`;

  if (resolvedPath !== FRONTEND_DIST_DIR && !resolvedPath.startsWith(allowedPrefix)) {
    return null;
  }

  return resolvedPath;
}

async function readDistAsset(pathname) {
  const assetPath = resolveDistAssetPath(pathname);

  if (!assetPath) {
    return null;
  }

  try {
    const body = await readFile(assetPath);
    return { assetPath, body };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return null;
    }

    throw error;
  }
}

function shouldServeIndexFallback(pathname) {
  return !hasFileExtension(pathname);
}

function serveAsset(res, pathname, { assetPath, body }) {
  res.writeHead(200, {
    "cache-control": getCacheControl(pathname),
    "content-length": body.length,
    "content-type": getContentType(assetPath),
    "x-content-type-options": "nosniff",
  });
  res.end(body);
}

async function serveIndex(res) {
  const indexAsset = await readDistAsset(`/${INDEX_FILE}`);

  if (!indexAsset) {
    sendText(res, 503, "找不到前端 build 產物，請先執行 npm run build。");
    return true;
  }

  serveAsset(res, "/index.html", indexAsset);
  return true;
}

export async function handleStaticFrontendRoute({ res, pathname }) {
  if (isReservedPath(pathname)) {
    return false;
  }

  if (pathname === "/" || pathname === "/index.html") {
    return serveIndex(res);
  }

  const asset = await readDistAsset(pathname);

  if (asset) {
    serveAsset(res, pathname, asset);
    return true;
  }

  if (shouldServeIndexFallback(pathname)) {
    return serveIndex(res);
  }

  sendText(res, 404, "找不到對應的前端資產。");
  return true;
}
