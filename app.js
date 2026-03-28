import { qrcode } from "qrcode-generator";
import jsQR from "jsqr";

/**
 * App root URL (same folder as index.html). Pathname-based so GitHub Pages
 * project sites like /QR_code_check/ work; avoids new URL("/", page) stripping the subpath.
 */
function getAppRoot() {
  const { origin, pathname } = window.location;
  let basePath = pathname;
  if (basePath.endsWith(".html")) {
    basePath = basePath.slice(0, basePath.lastIndexOf("/") + 1);
  } else if (!basePath.endsWith("/")) {
    basePath = `${basePath}/`;
  }
  return `${origin}${basePath}`;
}

const appRoot = getAppRoot();

function viewerUrlForPayload(text) {
  const u = new URL("view.html", appRoot);
  u.hash = encodeURIComponent(text);
  return u.href;
}

function viewPageBaseUrl() {
  return new URL("view.html", appRoot);
}

/** After upload: open our animated page, or same tab if QR already points at view.html. */
function navigateAfterDecode(data) {
  try {
    const parsed = new URL(data);
    const viewPage = viewPageBaseUrl();
    if (parsed.origin === viewPage.origin && parsed.pathname === viewPage.pathname) {
      window.location.assign(data);
      return;
    }
  } catch {
    /* not an absolute URL */
  }
  window.location.assign(viewerUrlForPayload(data));
}

const textEl = document.getElementById("text");
const eccEl = document.getElementById("ecc");
const canvas = document.getElementById("qr");
const downloadBtn = document.getElementById("download");
const copyBtn = document.getElementById("copy-data");
const preview = document.getElementById("preview");
const placeholder = document.getElementById("placeholder");
const encodeHint = document.getElementById("encode-hint");

const scanFile = document.getElementById("scan-file");
const dropZone = document.getElementById("drop-zone");
const scanStatus = document.getElementById("scan-status");
const scanPreview = document.getElementById("scan-preview");
const scanPreviewContainer = document.getElementById("scan-preview-container");

const DEFAULT_HINT = "Enter content above to generate a QR code.";
const COPY_LABEL = "Copy image";

const DISPLAY_MAX = 280;
const MARGIN = 8;

function qrPayloadFromInput(trimmed) {
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return viewerUrlForPayload(trimmed);
}

function renderQR(encodedUrl, ecc) {
  const qr = qrcode(0, ecc);
  qr.addData(encodedUrl);
  qr.make();

  const modules = qr.getModuleCount();
  const inner = DISPLAY_MAX - 2 * MARGIN;
  const cellSize = Math.max(2, Math.floor(inner / modules));
  const size = modules * cellSize + 2 * MARGIN;

  canvas.width = size;
  canvas.height = size;
  canvas.removeAttribute("hidden");

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.translate(MARGIN, MARGIN);
  qr.renderTo2dContext(ctx, cellSize);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  placeholder.hidden = true;
  preview.classList.remove("empty");
  downloadBtn.disabled = false;
  copyBtn.disabled = false;
}

function clearPreview() {
  canvas.setAttribute("hidden", "");
  placeholder.textContent = DEFAULT_HINT;
  placeholder.hidden = false;
  encodeHint.textContent = "";
  encodeHint.hidden = true;
  preview.classList.add("empty");
  downloadBtn.disabled = true;
  copyBtn.disabled = true;
}

function update() {
  const trimmed = textEl.value.trim();

  if (!trimmed) {
    clearPreview();
    return;
  }

  const payload = qrPayloadFromInput(trimmed);
  const isDirectUrl = /^https?:\/\//i.test(trimmed);

  try {
    placeholder.textContent = DEFAULT_HINT;
    renderQR(payload, eccEl.value);

    encodeHint.hidden = false;
    if (isDirectUrl) {
      encodeHint.textContent =
        "Scanning opens this URL directly in the browser.";
    } else {
      encodeHint.textContent =
        "Scanning opens the animated message page on this site. After you deploy to GitHub Pages, share that site URL so scans and uploads resolve to the same place.";
    }
  } catch {
    clearPreview();
    encodeHint.hidden = false;
    encodeHint.textContent =
      "This content is too large for a QR code at this error-correction level. Try shorter text, a lower correction level, or use a URL to a longer page.";
    placeholder.textContent = "Could not build QR code.";
    placeholder.hidden = false;
  }
}

textEl.addEventListener("input", update);
eccEl.addEventListener("change", update);

downloadBtn.addEventListener("click", () => {
  if (downloadBtn.disabled) return;
  const a = document.createElement("a");
  a.download = "qrcode.png";
  a.href = canvas.toDataURL("image/png");
  a.click();
});

copyBtn.addEventListener("click", async () => {
  if (copyBtn.disabled) return;
  const url = canvas.toDataURL("image/png");
  try {
    const blob = await (await fetch(url)).blob();
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = COPY_LABEL;
    }, 1600);
  } catch {
    try {
      await navigator.clipboard.writeText(url);
      copyBtn.textContent = "Copied data URL";
      setTimeout(() => {
        copyBtn.textContent = COPY_LABEL;
      }, 1600);
    } catch {
      copyBtn.textContent = "Copy failed";
      setTimeout(() => {
        copyBtn.textContent = COPY_LABEL;
      }, 1600);
    }
  }
});

preview.classList.add("empty");

/* ——— Tabs ——— */
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-panel]");

function activateTab(id) {
  tabButtons.forEach((btn) => {
    const on = btn.dataset.tab === id;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== id;
  });
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

activateTab("generate");

/* ——— Scan / decode ——— */
function setScanMessage(msg, kind) {
  scanStatus.textContent = msg;
  scanStatus.dataset.kind = kind || "";
}

function decodeQrFromImage(img) {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const maxEdge = 1600;
  const sizes = [];
  if (Math.max(w, h) > maxEdge) {
    const s = maxEdge / Math.max(w, h);
    sizes.push([Math.round(w * s), Math.round(h * s)]);
  }
  sizes.push([w, h]);

  for (const [cw, ch] of sizes) {
    const c = document.createElement("canvas");
    c.width = cw;
    c.height = ch;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0, cw, ch);
    const { data } = ctx.getImageData(0, 0, cw, ch);
    const result = jsQR(data, cw, ch);
    if (result) return result;
  }
  return null;
}

let lastPreviewUrl = null;

function decodeFileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load-failed"));
    };
    img.src = url;
  });
}

async function handleScanFile(file) {
  if (!file?.type.startsWith("image/")) {
    setScanMessage("Please choose an image file (PNG, JPG, or WebP).", "error");
    return;
  }

  if (lastPreviewUrl) {
    URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = null;
  }

  setScanMessage("Reading image…", "busy");
  scanPreview.removeAttribute("src");
  scanPreviewContainer.hidden = true;

  try {
    const { img, url } = await decodeFileToImage(file);
    lastPreviewUrl = url;
    scanPreview.src = url;
    scanPreviewContainer.hidden = false;

    setScanMessage("Looking for a QR code…", "busy");
    await new Promise((r) => requestAnimationFrame(r));

    const result = decodeQrFromImage(img);
    if (!result || !result.data) {
      setScanMessage(
        "No QR code found. Try a sharper photo, better lighting, or crop so the code fills more of the frame.",
        "error",
      );
      return;
    }

    setScanMessage("Found it — opening the message page…", "ok");
    navigateAfterDecode(result.data);
  } catch (e) {
    if (e?.message === "load-failed") {
      setScanMessage("Could not load that image. Try another file.", "error");
    } else {
      setScanMessage("Something went wrong. Try another image.", "error");
    }
  }
}

scanFile.addEventListener("change", () => {
  const file = scanFile.files?.[0];
  if (file) handleScanFile(file);
  scanFile.value = "";
});

["dragenter", "dragover"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });
});

["dragleave", "drop"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
  });
});

dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleScanFile(file);
});

dropZone.addEventListener("click", () => scanFile.click());

dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    scanFile.click();
  }
});
