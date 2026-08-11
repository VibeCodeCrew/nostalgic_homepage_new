chrome.runtime.onMessage.addListener((e, t, r) => {
  if (e.action === "capture_screenshot")
    return L(e.url, r), !0;
  if (e.action === "fetch_page_title")
    return U(e.url, r), !0;
  if (e.action === "fetch_suggestions")
    return x(e.engine, e.q, r), !0;
});
async function x(e, t, r) {
  try {
    const o = (t || "").trim();
    if (!o) {
      r({ success: !0, items: [] });
      return;
    }
    const a = e === "go" ? "https://suggestqueries.google.com/complete/search?client=firefox&q=" + encodeURIComponent(o) : "https://suggest.yandex.ru/suggest-ff.cgi?part=" + encodeURIComponent(o), c = await fetch(a);
    if (!c.ok) {
      r({ success: !1 });
      return;
    }
    const s = await c.json(), i = Array.isArray(s) && Array.isArray(s[1]) ? s[1].slice(0, 8) : [];
    r({ success: !0, items: i });
  } catch {
    r({ success: !1 });
  }
}
async function U(e, t) {
  try {
    const r = await fetch(e, { headers: { Accept: "text/html" } });
    if (!r.ok) {
      t({ success: !1 });
      return;
    }
    const a = (await r.text()).match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    if (!a) {
      t({ success: !1 });
      return;
    }
    const c = a[1].trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#(\d+);/g, (s, i) => String.fromCharCode(Number(i)));
    t({ success: !0, title: c });
  } catch {
    t({ success: !1 });
  }
}
function C(e) {
  try {
    const t = new URL(e);
    return !(t.protocol !== "http:" && t.protocol !== "https:" || t.hostname === "chrome.google.com" && t.pathname.startsWith("/webstore") || t.hostname === "microsoftedge.microsoft.com" && t.pathname.startsWith("/addons") || t.hostname === "addons.mozilla.org");
  } catch {
    return !1;
  }
}
async function L(e, t) {
  if (!C(e)) {
    t({ success: !1, error: "URL не поддерживает захват миниатюры" });
    return;
  }
  try {
    const r = await chrome.windows.create({
      url: e,
      left: 0,
      top: 0,
      width: 1024,
      height: 768,
      type: "popup",
      focused: !1
    });
    if (!r || !r.tabs || !r.tabs.length || r.id == null) {
      t({ success: !1, error: "Не удалось открыть окно захвата" });
      return;
    }
    const o = r.id, a = r.tabs[0].id;
    let c = !1;
    const s = async () => {
      c || (c = !0, clearTimeout(i), chrome.tabs.onUpdated.removeListener(u), setTimeout(async () => {
        try {
          await chrome.windows.update(o, { focused: !0 }), await new Promise((l) => setTimeout(l, 500));
          const n = await chrome.tabs.captureVisibleTab(o, { format: "jpeg", quality: 50 }), m = await T(n, 300, 218);
          chrome.windows.remove(o).catch(() => {
          }), t({ success: !0, dataUrl: m });
        } catch (n) {
          chrome.windows.remove(o).catch(() => {
          }), t({ success: !1, error: n.message });
        }
      }, 2500));
    }, i = setTimeout(() => {
      if (chrome.tabs.onUpdated.removeListener(u), !c) {
        c = !0, chrome.windows.remove(o).catch(() => {
        });
        try {
          t({ success: !1, error: "Timeout" });
        } catch {
        }
      }
    }, 15e3), u = (n, m) => {
      n === a && m.status === "complete" && s();
    };
    chrome.tabs.onUpdated.addListener(u), chrome.tabs.get(a).then((n) => {
      n.status === "complete" && s();
    }).catch(() => {
    });
  } catch (r) {
    t({ success: !1, error: r.message });
  }
}
async function T(e, t, r) {
  const a = await (await fetch(e)).blob(), c = await createImageBitmap(a), s = new OffscreenCanvas(t, r), i = s.getContext("2d"), u = Math.max(t / c.width, r / c.height), n = c.width * u, m = c.height * u, l = (t - n) / 2, b = (r - m) / 2;
  i.drawImage(c, l, b, n, m), c.close();
  const y = await (await s.convertToBlob({ type: "image/jpeg", quality: 0.7 })).arrayBuffer(), d = new Uint8Array(y);
  let g = "";
  for (let f = 0; f < d.byteLength; f++) g += String.fromCharCode(d[f]);
  return "data:image/jpeg;base64," + btoa(g);
}
chrome.action && chrome.action.onClicked && chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
chrome.commands && chrome.commands.onCommand && chrome.commands.onCommand.addListener(function(e) {
  e === "open-xp-desktop" && chrome.tabs.create({ url: chrome.runtime.getURL("index.html") });
});
const p = ["browser://tableau/", "browser://newtab/", "chrome://newtab/"], w = !chrome.runtime.getManifest().chrome_url_overrides, h = {};
function A(e, t) {
  setTimeout(function() {
    chrome.tabs.get(e, function(r) {
      if (chrome.runtime.lastError || !r) return;
      const o = r.url || "";
      if (o && p.indexOf(o) === -1) {
        console.log("[XP] " + t + " skip (real url): " + o);
        return;
      }
      const a = Date.now();
      h[e] && a - h[e] < 2e3 || (h[e] = a, chrome.tabs.update(e, { url: chrome.runtime.getURL("index.html") }, function() {
        chrome.runtime.lastError ? console.warn("[XP] " + t + " redirect failed:", chrome.runtime.lastError.message) : console.log("[XP] " + t + " redirect ok, tab " + e);
      }));
    });
  }, 700);
}
chrome.tabs.onCreated.addListener(function(e) {
  if (!w || e.openerTabId) return;
  const t = e.url || e.pendingUrl || "";
  t && p.indexOf(t) === -1 || A(e.id, "onCreated");
});
w && chrome.commands && chrome.commands.getAll && chrome.commands.getAll(function(e) {
  console.log("[XP] commands: " + JSON.stringify(e));
});
