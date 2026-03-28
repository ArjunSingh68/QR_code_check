const headlineEl = document.getElementById("headline");
const messageEl = document.getElementById("message");
const ctaRow = document.getElementById("cta-row");
const openLink = document.getElementById("open-link");

function readPayload() {
  const raw = location.hash.slice(1);
  if (!raw) return "";
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return "";
  }
}

const text = readPayload();

if (!text) {
  headlineEl.textContent = "Nothing to show";
  messageEl.textContent =
    "This page is opened when someone scans a QR code created here. Add your text in the generator and scan again — the message travels in the link after the #.";
  document.querySelector(".badge").innerHTML =
    '<span class="badge-dot" aria-hidden="true"></span> Empty QR payload';
} else if (/^https?:\/\//i.test(text)) {
  headlineEl.textContent = "You’re almost there";
  messageEl.innerHTML = "";
  const link = document.createElement("a");
  link.href = text;
  link.textContent = text;
  link.rel = "noopener noreferrer";
  messageEl.appendChild(link);
  openLink.href = text;
  ctaRow.hidden = false;
} else {
  headlineEl.textContent = "Here’s your message";
  messageEl.textContent = text;
}
