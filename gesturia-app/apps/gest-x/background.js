/* Gest-X service worker — Olo, the quiet accessibility guardian.
 * Opens the SELF-CONTAINED floating interpreter (pip/interpreter.html, bundled inside the extension —
 * no web app needed). From there Olo signs your microphone, THIS tab's audio, or ANY app/movie audio on
 * the PC (system audio). Right-click selected text signs it. The window floats over everything (📌 = PiP).
 */
const API = "http://127.0.0.1:8020";   // 127.0.0.1 not "localhost": Windows resolves localhost to IPv6 first (~2s failover)

let winId = null;
let lastActiveTabId = null;

function interpUrl(q) { return chrome.runtime.getURL("pip/interpreter.html") + (q || ""); }

async function openInterp(query) {
  const url = interpUrl(query);
  if (winId !== null) {
    try {
      await chrome.windows.get(winId);
      const [tab] = await chrome.tabs.query({ windowId: winId });
      if (tab) await chrome.tabs.update(tab.id, { url });
      await chrome.windows.update(winId, { focused: true });
      return;
    } catch { winId = null; }
  }
  const w = await chrome.windows.create({ url, type: "popup", width: 344, height: 540 });
  winId = w.id;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "gestx-sign", title: "Sign with Gesturia ✋", contexts: ["selection"] });
  chrome.contextMenus.create({ id: "gestx-open", title: "Open Gest-X interpreter", contexts: ["action"] });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "gestx-sign" && info.selectionText) {
    openInterp(`?text=${encodeURIComponent(info.selectionText.slice(0, 600))}`);
  } else if (info.menuItemId === "gestx-open") {
    lastActiveTabId = tab?.id ?? lastActiveTabId;
    openInterp("");
  }
});

// toolbar click: remember which tab was active (so "Tab" capture targets it) and open the interpreter
chrome.action.onClicked.addListener((tab) => {
  lastActiveTabId = tab?.id ?? null;
  openInterp("");
});

// the interpreter window asks for a tab-capture stream id for the user's active page
const capturable = (t) => t && t.id != null && /^https?:/.test(t.url || "");

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "gestx-tabid") return;
  (async () => {
    try {
      // Prefer the tab that is ACTUALLY PLAYING SOUND (the video/call the user wants signed) — that's
      // what "Tab" means to them. Fall back to the tab they opened the interpreter from, then any active
      // web tab. The interpreter lives in its own popup window, so "active tab" alone often mis-targets.
      let tab = null;
      const audible = await chrome.tabs.query({ audible: true });
      tab = audible.find(capturable) || null;
      if (!tab && lastActiveTabId != null) tab = await chrome.tabs.get(lastActiveTabId).catch(() => null);
      if (!capturable(tab)) {
        const actives = await chrome.tabs.query({ active: true });
        tab = actives.find(capturable) || null;
      }
      if (!capturable(tab)) {
        return sendResponse({ error: "no tab is playing audio — start the video/audio in a normal web tab, then click Tab" });
      }
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      sendResponse({ streamId, title: tab.title });
    } catch (e) {
      sendResponse({ error: (e && e.message) || String(e) });
    }
  })();
  return true;   // async response
});
