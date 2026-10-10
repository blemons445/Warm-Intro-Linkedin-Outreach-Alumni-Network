// Past the Post: hash routing, the Try it search, setup and run checklists, and a tracker saved in localStorage.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEYS = { theme: "wi-theme", checks: "wi-checks", rows: "wi-rows", form: "wi-form", last: "wi-last", code: "wi-code" };

  // Storage can be blocked (private windows, strict settings); the app still works for the session.
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
  };

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 2000);
  }

  async function copyText(text, okMsg = "Copied") {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch { toast("Couldn't copy. Select the text and press Ctrl+C."); }
  }

  // ---------- Theme ----------
  const savedTheme = store.get(KEYS.theme, null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  $("theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    store.set(KEYS.theme, next);
  });

  // ---------- Routing ----------
  const ROUTES = ["home", "try", "setup", "run", "tracker", "about", "connect"];
  function route() {
    const name = ROUTES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.dataset.view !== name; });
    document.querySelectorAll("nav a").forEach((a) => {
      if (a.dataset.route === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const view = document.querySelector(`[data-view="${name}"] h1`);
    document.title = (name === "home" ? "Past the Post: Meet the people behind your applications" : `${view.textContent} · Past the Post`);
    if (route.ready) { window.scrollTo(0, 0); $("main").focus({ preventScroll: true }); }
    route.ready = true;
    if (name === "try") document.querySelectorAll("#t-groups .note").forEach((n) => n.dispatchEvent(new Event("input")));
  }
  window.addEventListener("hashchange", route);

  // ---------- Checklists (setup + run) ----------
  const checks = store.get(KEYS.checks, {});
  function bindCheck(input) {
    const key = input.dataset.check;
    input.checked = !!checks[key];
    const sync = () => input.closest("li")?.classList.toggle("done", input.checked);
    sync();
    input.addEventListener("change", () => { checks[key] = input.checked; store.set(KEYS.checks, checks); sync(); });
  }

  const RUN_STEPS = [
    { key: "target", title: "Set your target", say: "Help me find an internship.", note: "It asks about ten short questions: where, what role, which companies, your school and year." },
    { key: "roles", title: "Find open internships", say: "Find open internships for my targets.", note: "You get a list of postings checked on each company's own site, with the best match flagged. Apply to that one soon." },
    { key: "people", title: "Find people to message", say: "Find people at those companies.", note: "Alumni and recruiters at companies with an open posting, recent graduates first, each with a reason to reach out." },
    { key: "drafts", title: "Draft your messages", say: "Draft messages for this batch.", note: "Review each one, send it yourself on LinkedIn, then add it to the Tracker." },
    { key: "resume", title: "Tailor your resume", say: "Tailor my resume for this posting.", note: "Attach your resume. You get a one-page PDF matched to the posting, using only what's true." },
    { key: "prep", title: "Prep for a coffee chat", say: "Prep me for my chat with [name].", note: "When someone replies: a short sheet with their background, your intro and questions to ask." },
  ];

  function renderRunSteps() {
    const list = $("run-steps");
    RUN_STEPS.forEach((s, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="head">
          <h3>${String(i + 1).padStart(2, "0")} · ${s.title}</h3>
          <label><input type="checkbox" data-check="run-${s.key}"> Done</label>
        </div>
        <div class="say"><span class="label">Say</span><q></q><button class="btn small" type="button">Copy</button></div>
        <p></p>`;
      li.querySelector("q").textContent = s.say;
      li.querySelector("p").textContent = s.note;
      li.querySelector("button").addEventListener("click", () => copyText(s.say));
      list.append(li);
    });
    document.querySelectorAll("[data-check]").forEach(bindCheck);
  }

  // ---------- Skill text ----------
  let skillText = "";
  fetch("skill/SKILL.md")
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((t) => { skillText = t; $("skill-text").textContent = t; })
    .catch(() => { $("skill-text").textContent = "Couldn't load the skill here. Use Download SKILL.md instead."; });
  $("copy-skill").addEventListener("click", () => {
    if (!skillText) { toast("The skill is still loading. Try again in a moment."); return; }
    copyText(skillText, "Skill copied. Paste it into a new Claude or ChatGPT chat.");
  });

  // ---------- Tracker ----------
  const STATUS = {
    person: [["drafted", "Drafted", ""], ["sent", "Sent", ""], ["replied", "Replied", "good"], ["chat", "Coffee chat", "good"], ["referred", "Referred", "good"], ["no_reply", "No reply", "bad"]],
    application: [["applied", "Applied", "accent"], ["interview", "Interview", "good"], ["offer", "Offer", "good"], ["rejected", "Rejected", "bad"]],
  };
  let rows = store.get(KEYS.rows, []).filter((r) => STATUS[r.kind] && r.name);

  const save = () => { if (!store.set(KEYS.rows, rows)) toast("Your browser blocked saving. Use Back up to keep a copy."); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);

  function fmtDate(d) {
    if (!d) return "—";
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function counts() {
    const p = rows.filter((r) => r.kind === "person");
    const a = rows.filter((r) => r.kind === "application");
    return {
      people: p.length,
      sent: p.filter((r) => r.status !== "drafted").length,
      replied: p.filter((r) => ["replied", "chat", "referred"].includes(r.status)).length,
      chat: p.filter((r) => ["chat", "referred"].includes(r.status)).length,
      apps: a.length,
      ints: a.filter((r) => ["interview", "offer"].includes(r.status)).length,
    };
  }

  function postLine(c) {
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    const rate = c.sent ? Math.round((100 * c.replied) / c.sent) : 0;
    return `I sent ${n(c.sent, "LinkedIn message", "LinkedIn messages")}, got ${n(c.replied, "reply", "replies")} (${rate}%) and ${n(c.chat, "coffee chat", "coffee chats")}, alongside ${n(c.apps, "application", "applications")} and ${n(c.ints, "interview", "interviews")}.`;
  }

  function rowEl(r) {
    const tr = document.createElement("tr");

    const who = document.createElement("td"); who.className = "c-who";
    const name = document.createElement("div");
    name.className = "who";
    if (r.link && /^https?:\/\//.test(r.link)) {
      const a = document.createElement("a");
      a.href = r.link; a.target = "_blank"; a.rel = "noopener"; a.textContent = r.name;
      name.append(a);
    } else name.textContent = r.name;
    who.append(name);
    if (r.detail) { const d = document.createElement("div"); d.className = "detail"; d.textContent = r.detail; who.append(d); }

    const co = document.createElement("td"); co.className = "c-co"; co.textContent = r.company;
    const dt = document.createElement("td"); dt.className = "date c-date"; dt.textContent = fmtDate(r.date);

    const st = document.createElement("td"); st.className = "c-st";
    const sel = document.createElement("select");
    sel.className = "status";
    sel.setAttribute("aria-label", `Status for ${r.name}`);
    STATUS[r.kind].forEach(([v, l]) => { const o = document.createElement("option"); o.value = v; o.textContent = l; sel.append(o); });
    sel.value = r.status;
    const tone = () => { sel.dataset.tone = (STATUS[r.kind].find((s) => s[0] === sel.value) || [])[2] || ""; };
    tone();
    sel.addEventListener("change", () => { r.status = sel.value; tone(); save(); renderTotals(); toast("Saved"); });
    st.append(sel);

    const x = document.createElement("td"); x.className = "c-x";
    const b = document.createElement("button");
    b.className = "del"; b.type = "button"; b.textContent = "×";
    b.setAttribute("aria-label", `Remove ${r.name}`);
    let armed = false;
    b.addEventListener("click", () => {
      if (!armed) {
        armed = true; b.textContent = "Remove?";
        setTimeout(() => { armed = false; b.textContent = "×"; }, 3000);
        return;
      }
      rows = rows.filter((row) => row.id !== r.id);
      save(); renderTracker(); toast("Removed");
    });
    x.append(b);

    tr.append(who, co, dt, st, x);
    return tr;
  }

  function renderTotals() {
    const c = counts();
    if (result) trackStep();
    if (typeof syncAppTools === "function" && $("t-apps").children.length) syncAppTools();
    $("n-sent").textContent = c.sent; $("n-replied").textContent = c.replied; $("n-chat").textContent = c.chat;
    $("n-apps").textContent = c.apps; $("n-int").textContent = c.ints;
    $("post-line").textContent = postLine(c);
    $("c-people").textContent = c.people ? `· ${c.people}` : "";
    $("c-apps").textContent = c.apps ? `· ${c.apps}` : "";
  }

  function renderTracker() {
    renderTotals();
    const byDate = (a, b) => (b.date || "").localeCompare(a.date || "") || a.name.localeCompare(b.name);
    [["person", "people", "messages"], ["application", "apps", "applications"]].forEach(([kind, id, label]) => {
      const body = $(id);
      body.replaceChildren();
      const list = rows.filter((r) => r.kind === kind).sort(byDate);
      if (!list.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="5" class="empty">No ${label} yet. Add one below, or try the sample data.</td>`;
        body.append(tr);
      } else list.forEach((r) => body.append(rowEl(r)));
    });
  }

  $("copy-post").addEventListener("click", () => copyText($("post-line").textContent));

  $("f-date").value = today();
  $("add-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const kind = $("f-kind").value;
    rows.push({
      id: uid(), kind,
      name: $("f-name").value.trim(), company: $("f-company").value.trim(),
      detail: $("f-detail").value.trim(), link: $("f-link").value.trim(),
      date: $("f-date").value, status: kind === "person" ? "sent" : "applied",
    });
    save(); renderTracker();
    e.target.reset(); $("f-date").value = today();
    $("f-name").focus();
    toast("Added");
  });

  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  $("export-csv").addEventListener("click", () => {
    const cols = ["kind", "name", "company", "detail", "link", "date", "status"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    download(`past-the-post-tracker-${today()}.csv`, csv, "text/csv");
  });

  $("export-json").addEventListener("click", () => {
    download(`past-the-post-backup-${today()}.json`, JSON.stringify({ app: "past-the-post", version: 1, rows }, null, 2), "application/json");
  });

  $("import-json").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = (Array.isArray(data) ? data : data.rows || []).filter((r) => r && STATUS[r.kind] && r.name);
      if (!incoming.length) throw new Error("empty");
      if (rows.length && !confirm(`Replace your ${rows.length} current entries with ${incoming.length} from the backup?`)) return;
      rows = incoming.map((r) => ({ ...r, id: r.id || uid() }));
      save(); renderTracker(); toast(`Restored ${rows.length} entries`);
    } catch { toast("That file isn't a Past the Post backup."); }
  });

  // Fictional sample data so visitors can see the tracker working.
  $("sample").addEventListener("click", () => {
    if (rows.length && !confirm("Replace your current entries with sample data?")) return;
    const d = (n) => { const t = new Date(); t.setDate(t.getDate() - n); return t.toISOString().slice(0, 10); };
    rows = [
      { kind: "person", name: "Jordan Lee", company: "Acme Foods", detail: "Sales Coordinator · class of 2023", date: d(9), status: "chat" },
      { kind: "person", name: "Priya Shah", company: "Acme Foods", detail: "Campus Recruiter", date: d(9), status: "replied" },
      { kind: "person", name: "Marcus Hill", company: "Lone Star Beverage", detail: "Brand Manager · class of 2021", date: d(6), status: "sent" },
      { kind: "person", name: "Ava Torres", company: "Lone Star Beverage", detail: "Former intern, now Analyst", date: d(6), status: "no_reply" },
      { kind: "person", name: "Ben Carter", company: "Northfield Snacks", detail: "Field Sales Manager · class of 2022", date: d(2), status: "sent" },
      { kind: "application", name: "Summer Sales Intern", company: "Acme Foods", detail: "Dallas, in person", date: d(10), status: "interview" },
      { kind: "application", name: "Brand Marketing Intern", company: "Lone Star Beverage", detail: "Plano, hybrid", date: d(7), status: "applied" },
    ].map((r) => ({ ...r, id: uid() }));
    save(); renderTracker(); toast("Sample data loaded");
  });

  $("clear").addEventListener("click", () => {
    if (!rows.length) return;
    if (!confirm(`Delete all ${rows.length} entries? Back up first if you want to keep them.`)) return;
    rows = []; save(); renderTracker(); toast("Cleared");
  });

  // ---------- Try it: from applications you've sent to people at those companies ----------
  // On GitHub Pages the API lives on Vercel; on Vercel or locally it's same-origin.
  const API = location.hostname.endsWith("github.io") ? "https://past-the-post.vercel.app/api/run" : "/api/run";
  const TRY_FIELDS = ["school", "name", "major", "year", "hometown", "orgs", "past"];
  const MAX_APPS = 3;
  let result = null;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const safeUrl = (u) => (/^https:\/\//i.test(u || "") ? u : "");

  // Application rows: company, role, optional posting link.
  // Free type-ahead for Company and Role: a built-in list plus whatever is in your tracker.
  const COMPANIES = ["7-Eleven", "Anheuser-Busch", "Aramark", "Ben E. Keith", "Blue Bell Creameries", "Boston Beer Company", "Brinker International", "Brown-Forman", "Campbell's", "Cargill", "Celsius Holdings", "Chick-fil-A", "Chobani", "Coca-Cola", "Coca-Cola Southwest Beverages", "Colgate-Palmolive", "Conagra Brands", "Constellation Brands", "Costco", "Danone", "Darden", "Del Monte Foods", "Diageo", "Domino's", "Dr Pepper Snapple", "E. & J. Gallo Winery", "Ferrero", "Frito-Lay", "General Mills", "Gatorade", "H-E-B", "Heineken", "Hershey", "Hormel Foods", "Imperial Sugar", "J.M. Smucker", "JBS USA", "Kellanova", "Keurig Dr Pepper", "Kimberly-Clark", "Kraft Heinz", "Kroger", "L'Oréal", "Lamb Weston", "Land O'Lakes", "Mars", "McCormick", "McLane Company", "Molson Coors", "Mondelez International", "Monster Beverage", "Nestlé", "Nestlé Purina", "Ocean Spray", "Olipop", "PepsiCo", "Pilgrim's Pride", "Post Holdings", "Procter & Gamble", "Red Bull", "Reyes Coca-Cola Bottling", "Sanderson Farms", "Southern Glazer's Wine & Spirits", "Starbucks", "Sysco", "Target", "Topo Chico", "Tyson Foods", "Unilever", "US Foods", "Walmart", "Whataburger", "Yum! Brands"];
  const ROLES = ["Brand Marketing Intern", "Business Development Intern", "Category Management Intern", "Consumer Insights Intern", "Customer Marketing Intern", "Digital Marketing Intern", "Field Marketing Intern", "Field Sales Intern", "Marketing Intern", "National Accounts Intern", "Operations Intern", "Product Marketing Intern", "Revenue Management Intern", "Sales Analyst Intern", "Sales Intern", "Shopper Marketing Intern", "Social Media Intern", "Supply Chain Intern", "Trade Marketing Intern"];
  // The big pool (about 9,000 companies and 900 internship titles, from public internship listings and stock exchange lists)
  // loads in the background; until then the short list above works.
  const pool = { companies: [], roles: [] };
  let suggestSig = "";
  function suggestList(id, base, key) {
    let dl = document.getElementById(id);
    if (!dl) { dl = el("datalist"); dl.id = id; document.body.append(dl); }
    const mine = rows.filter((r) => r.kind === "application").map((r) => r[key]).filter(Boolean);
    const seen = new Set();
    const all = [...mine, ...base].filter((v) => { const k = v.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    const frag = document.createDocumentFragment();
    all.forEach((v) => { const o = document.createElement("option"); o.value = v; frag.append(o); });
    dl.replaceChildren(frag);
  }
  function refreshSuggestions() {
    const sig = `${pool.companies.length}|${rows.filter((r) => r.kind === "application").map((r) => r.company + r.name).join()}`;
    if (sig === suggestSig) return;
    suggestSig = sig;
    suggestList("dl-company", [...COMPANIES, ...pool.companies], "company");
    suggestList("dl-role", [...ROLES, ...pool.roles], "name");
  }
  fetch("assets/suggest.json?v=1").then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d) return;
    pool.companies = d.companies || []; pool.roles = d.roles || [];
    refreshSuggestions();
  }).catch(() => {});

  function appRow(a = {}) {
    const row = el("div", "app-row");
    const field = (label, key, ph, type = "text") => {
      const l = el("label", null, label);
      const i = el("input");
      i.type = type; i.dataset.key = key; i.placeholder = ph; i.value = a[key] || ""; i.maxLength = key === "url" ? 300 : 100;
      if (key !== "url") { i.setAttribute("list", `dl-${key}`); i.autocomplete = "off"; }
      l.append(i);
      return l;
    };
    const rm = el("button", "del", "×");
    rm.type = "button";
    rm.setAttribute("aria-label", "Remove this application");
    rm.addEventListener("click", () => { row.remove(); syncAppTools(); });
    row.append(field("Company", "company", "Keurig Dr Pepper"), field("Role", "role", "Sales Analyst Intern"), field("Posting link (optional)", "url", "https://…", "url"), rm);
    return row;
  }
  // School, company and role are required. Empty ones get highlighted, and the first one gets focus.
  function checkForm() {
    const bad = [];
    if (!$("t-school").value.trim()) bad.push($("t-school"));
    const rowsEls = [...$("t-apps").querySelectorAll(".app-row")];
    const used = rowsEls.filter((r) => [...r.querySelectorAll("input")].some((i) => i.value.trim()));
    (used.length ? used : rowsEls.slice(0, 1)).forEach((r) => {
      ["company", "role"].forEach((k) => { const i = r.querySelector(`[data-key=${k}]`); if (!i.value.trim()) bad.push(i); });
    });
    document.querySelectorAll("#try-form [aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
    if (!bad.length) return true;
    bad.forEach((i) => i.setAttribute("aria-invalid", "true"));
    const names = [...new Set(bad.map((i) => (i.id === "t-school" ? "your school" : `the ${i.dataset.key}`)))];
    const list = names.length < 3 ? names.join(" and ") : `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
    showError(`Fill in ${list} to run the search.`);
    bad[0].focus();
    return false;
  }
  document.addEventListener("input", (e) => { if (e.target.getAttribute && e.target.getAttribute("aria-invalid")) e.target.removeAttribute("aria-invalid"); });
  function readApps() {
    return [...$("t-apps").querySelectorAll(".app-row")].map((r) => {
      const a = {};
      r.querySelectorAll("input").forEach((i) => { a[i.dataset.key] = i.value.trim(); });
      return a;
    }).filter((a) => a.company);
  }
  function setApps(list) {
    $("t-apps").replaceChildren(...(list.length ? list : [{}]).slice(0, MAX_APPS).map(appRow));
    syncAppTools();
  }
  function syncAppTools() {
    const n = $("t-apps").querySelectorAll(".app-row").length;
    $("t-add-app").hidden = n >= MAX_APPS;
    $("t-apps").querySelectorAll(".del").forEach((b) => { b.hidden = n < 2; });
    $("t-from-tracker").hidden = !rows.some((r) => r.kind === "application");
    refreshSuggestions();
  }
  $("t-add-app").addEventListener("click", () => {
    $("t-apps").append(appRow());
    syncAppTools();
    $("t-apps").lastElementChild.querySelector("input").focus();
  });
  $("t-from-tracker").addEventListener("click", () => {
    const apps = rows.filter((r) => r.kind === "application").sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .map((r) => ({ company: r.company, role: r.name, url: r.link || "" }));
    setApps(apps);
    toast(`Filled ${Math.min(apps.length, MAX_APPS)} from your tracker`);
  });

  const savedForm = store.get(KEYS.form, {});
  TRY_FIELDS.forEach((k) => { if (savedForm[k]) $(`t-${k}`).value = savedForm[k]; });
  // Only your school and "more about you" carry over. Jobs start empty each visit ("Fill from my tracker" brings them back).
  setApps([]);

  // Access code: a shared link like ?code=XYZ#try fills it in, so whoever gets the link never types it.
  const urlCode = new URLSearchParams(location.search).get("code");
  if (urlCode) {
    store.set(KEYS.code, urlCode);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  $("t-code").value = store.get(KEYS.code, "") || "";
  // The box stays hidden unless this visitor has a code (live search is off while no API key is set).
  if ($("t-code").value) { $("t-code-box").hidden = false; $("t-code-box").open = true; }

  function inTracker(kind, name, company) {
    return rows.some((r) => r.kind === kind && r.name.toLowerCase() === name.toLowerCase() && r.company.toLowerCase() === company.toLowerCase());
  }
  function trackPerson(p, app) {
    if (inTracker("person", p.name, app.company)) return false;
    rows.push({ id: uid(), kind: "person", name: p.name, company: app.company, detail: p.title, link: safeUrl(p.profile_url), date: today(), status: "drafted" });
    return true;
  }
  function trackApp(app) {
    if (!app.role || inTracker("application", app.role, app.company)) return false;
    rows.push({ id: uid(), kind: "application", name: app.role, company: app.company, detail: "", link: safeUrl(app.posting_url), date: today(), status: "applied" });
    return true;
  }
  function markDone(btn, label) { btn.textContent = label; btn.disabled = true; }

  function personCard(p, app) {
    const c = el("article", "res-card");
    const top = el("div", "res-top");
    const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    top.append(el("span", "avatar", initials));
    const who = el("div");
    who.append(el("div", "pv-name", p.name), el("div", "pv-sub", p.title));
    top.append(who);
    c.append(top);
    const tags = el("div", "tags");
    if (p.hiring_manager) tags.append(el("span", "chip hm", "Likely hiring manager"));
    if (p.other_team) { const t = el("span", "chip ghost", "Different team"); t.title = "Shares something with you but works outside this role's team. Good for advice, less so for a referral."; tags.append(t); }
    if (p.connection) tags.append(el("span", "chip", p.connection));
    c.append(tags);
    if (p.why) c.append(el("p", "why", p.why));
    const note = el("textarea", "note");
    note.value = p.note;
    note.rows = 3;
    note.setAttribute("aria-label", `Message to ${p.name}`);
    const count = el("div", "note-meta");
    const upd = () => {
      const n = note.value.length; count.textContent = `${n} / 200`; count.classList.toggle("over", n > 200); p.note = note.value;
      if (note.offsetParent) { note.style.height = "auto"; note.style.height = `${note.scrollHeight + 2}px`; }
    };
    note.addEventListener("input", () => { upd(); if (result) store.set(KEYS.last, result); });
    upd();
    c.append(note, count);

    const acts = el("div", "actions");
    const copy = el("button", "btn primary small", "Copy note");
    copy.type = "button";
    // Every person gets a link: their profile if found, otherwise a LinkedIn search for them.
    const url = /linkedin\.com\/in\//i.test(p.profile_url || "") ? safeUrl(p.profile_url) : "";
    const prof = el("a", "btn small", url ? "LinkedIn profile" : "Find on LinkedIn");
    prof.href = url || `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.name} ${app.company}`)}`;
    prof.target = "_blank"; prof.rel = "noopener";
    const add = el("button", "btn small", "Add to tracker");
    add.type = "button";
    if (inTracker("person", p.name, app.company)) markDone(add, "In tracker");
    copy.addEventListener("click", () => {
      copyText(note.value, "Note copied. Paste it into LinkedIn.");
      if (trackPerson(p, app)) { trackApp(app); save(); renderTracker(); markDone(add, "In tracker"); }
    });
    add.addEventListener("click", () => { trackPerson(p, app); trackApp(app); save(); renderTracker(); markDone(add, "In tracker"); toast("Added to your tracker"); });
    const book = el("button", "btn small ghost", "They said yes: copy times");
    book.type = "button";
    book.addEventListener("click", () => copyText(bookingMessage(p), "Copied a reply offering two times. Edit the times if you need to."));
    const prep = el("button", "btn small ghost", "They replied: prep me");
    prep.type = "button";
    prep.addEventListener("click", () => openPrep(p, app, prep));
    acts.append(copy, prof, add, book, prep);
    c.append(acts);
    return c;
  }

  // When they agree to chat, offer two specific times (the reply that booked the first real call).
  function bookingMessage(p) {
    const days = [];
    const d = new Date();
    d.setDate(d.getDate() + 2);
    while (days.length < 2) {
      if (d.getDay() > 0 && d.getDay() < 6) { days.push(d.toLocaleDateString("en-US", { weekday: "long" })); d.setDate(d.getDate() + 2); }
      else d.setDate(d.getDate() + 1);
    }
    const first = (p.name || "").split(/\s+/)[0] || "there";
    return `Thanks so much, ${first}! Would ${days[0]} at 10:30 or ${days[1]} at 10:30 work for a quick call? Happy to work around your schedule. I can send an invite or call whatever number works best.`;
  }

  function appGroup(app) {
    const g = el("section", "app-group");
    const head = el("div", "app-head");
    const t = el("div");
    t.append(el("div", "pv-name", app.company), el("div", "pv-sub", app.role ? `You applied: ${app.role}` : "You applied"));
    head.append(t);
    const url = safeUrl(app.posting_url);
    if (url) { const a = el("a", "btn small", "View posting"); a.href = url; a.target = "_blank"; a.rel = "noopener"; head.append(a); }
    g.append(head);
    const list = el("div", "res-list");
    const ppl = app.people || [];
    if (ppl.length) ppl.forEach((p) => list.append(personCard(p, app)));
    else list.append(el("p", "empty", "No one confirmed at this company yet. Try again later, or use the full skill with Clay for a deeper search."));
    g.append(list);
    // No confident hiring manager: hand them a LinkedIn search to look themselves.
    if (!ppl.some((p) => p.hiring_manager)) {
      const q = `${app.company} ${app.role ? app.role.replace(/\b(summer|intern(ship)?|20\d\d)\b/gi, "").trim() : ""} manager`.replace(/\s+/g, " ");
      const a = el("a", "find-hm", "Hiring manager not pinned down. Search LinkedIn for them");
      a.href = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
      a.target = "_blank"; a.rel = "noopener";
      g.append(a);
    }
    return g;
  }

  function renderResults() {
    const r = result;
    $("t-results").hidden = !r;
    if (!r) { $("t-groups").replaceChildren(); return; }
    $("t-prep").hidden = true; $("t-prep").replaceChildren();
    $("t-summary").textContent = r.summary || "";
    $("t-groups").replaceChildren(...(r.applications || []).map(appGroup));
    trackStep();
    requestAnimationFrame(() => document.querySelectorAll("#t-groups .note").forEach((n) => n.dispatchEvent(new Event("input"))));
  }

  function setBusy(busy) {
    $("t-go").disabled = busy;
    $("t-go").textContent = busy ? "Searching…" : "Find my people";
    $("t-progress").hidden = !busy;
  }
  function logLine(text) {
    $("t-stage").textContent = text;
    $("t-log").append(el("li", null, text));
  }

  // Calls the backend and reads its newline-delimited JSON stream.
  async function callApi(fields, onStatus) {
    const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      if (data.code_required) { $("t-code-box").open = true; }
      throw new Error(data.error || "Something went wrong. Try again.");
    }
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "", out = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.type === "status") onStatus(ev.text);
        else if (ev.type === "error") throw new Error(ev.error);
        else if (ev.type === "result") out = ev.data;
      }
    }
    if (!out) throw new Error("It stopped early. Try again.");
    return out;
  }
  const errText = (err) => (err instanceof TypeError ? "Couldn't reach the search service. Check your connection and try again." : err.message);
  function showError(msg) { $("t-error-msg").textContent = msg; $("t-error").hidden = false; }

  function currentFields() {
    const fields = { apps: readApps() };
    TRY_FIELDS.forEach((k) => { fields[k] = $(`t-${k}`).value.trim(); });
    return fields;
  }

  async function runSearch(fields) {
    $("t-error").hidden = true;
    $("t-log").replaceChildren();
    result = null; renderResults();
    setBusy(true);
    try {
      result = await callApi({ ...fields, code: $("t-code").value.trim() }, logLine);
      result.fields = fields;
      store.set(KEYS.last, result);
      renderResults();
      $("t-results").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  $("try-form").addEventListener("submit", (e) => {
    e.preventDefault();
    // Enter in a field runs the free path unless the visitor is using an access code.
    if ($("t-code-box").hidden || !$("t-code-box").open) { startFree(lastAi); return; }
    const fields = currentFields();
    store.set(KEYS.form, fields);
    const code = $("t-code").value.trim();
    if (code) store.set(KEYS.code, code);
    if (!checkForm()) return;
    runSearch(fields);
  });

  $("t-addall").addEventListener("click", () => {
    if (!result) return;
    let n = 0;
    (result.applications || []).forEach((app) => { trackApp(app); (app.people || []).forEach((p) => { if (trackPerson(p, app)) n++; }); });
    save(); renderTracker(); renderResults();
    toast(n ? `Added ${n} ${n === 1 ? "person" : "people"} to your tracker` : "Everyone is already in your tracker");
  });

  $("t-again").addEventListener("click", () => {
    result = null; store.set(KEYS.last, null); renderResults(); setApps([]);
    $("t-paste").hidden = true; $("t-paste-text").value = "";
    $("t-school").focus();
  });

  // ---------- Coffee chat prep and referral ask ----------
  function prepSheet(p, app, sheet) {
    const box = el("article", "card prep-sheet");
    const head = el("div", "res-top");
    const t = el("div");
    t.append(el("div", "pv-name", `Coffee chat prep: ${p.name}`), el("div", "pv-sub", `${p.title} · ${app.company}`));
    head.append(t);
    const close = el("button", "btn small", "Close");
    close.type = "button";
    close.addEventListener("click", () => { box.remove(); $("t-prep").hidden = true; });
    head.append(close);
    box.append(head);
    const sec = (label, node, copyable) => {
      const d = el("div", "prep-sec");
      d.append(el("span", "label", label), node);
      if (copyable) {
        const b = el("button", "btn small", "Copy");
        b.type = "button";
        b.addEventListener("click", () => copyText(copyable));
        d.append(b);
      }
      box.append(d);
    };
    sec("Who they are", el("p", null, sheet.about));
    sec("What's new at the company", el("p", null, sheet.company_now));
    sec("Your 20-second intro", el("p", "say-it", sheet.intro));
    const ol = el("ol");
    (sheet.questions || []).forEach((q) => ol.append(el("li", null, q)));
    sec("Questions to ask", ol);
    sec("Thank-you note, send right after", el("p", "say-it", sheet.thank_you), sheet.thank_you);
    sec("Referral ask, only if it went well", el("p", "say-it", sheet.referral_ask), sheet.referral_ask);
    return box;
  }

  async function openPrep(p, app, btn) {
    const slot = $("t-prep");
    slot.hidden = false;
    // Results that came from the visitor's own chat: prep runs there too.
    if (result.via) {
      openAssistant(result.via, prepPrompt(p, app, result.fields || currentFields()));
      slot.hidden = true;
      return;
    }
    const waitBox = el("div", "card progress");
    const h = el("div", "pg-head");
    const label = el("strong", null, `Preparing your chat with ${p.name}`);
    h.append(el("span", "spinner"), label);
    waitBox.append(h);
    slot.replaceChildren(waitBox);
    slot.scrollIntoView({ behavior: "smooth", block: "start" });
    btn.disabled = true;
    try {
      const f = { ...(result.fields || currentFields()), apps: [], code: $("t-code").value.trim(), mode: "prep",
        p_name: p.name, p_title: p.title, p_company: app.company, p_connection: p.connection, p_role: app.role };
      const sheet = await callApi(f, (txt) => { label.textContent = txt; });
      slot.replaceChildren(prepSheet(p, app, sheet));
    } catch (err) {
      const e = el("div", "card t-error");
      e.append(el("p", null, errText(err)));
      slot.replaceChildren(e);
    } finally {
      btn.disabled = false;
    }
  }

  function trackStep() {
    const c = counts();
    $("t-track-line").textContent = c.people
      ? `${c.people} ${c.people === 1 ? "person" : "people"} in your tracker. Mark each one Sent once you send it, then Replied when they answer.`
      : "Copy a note above and that person lands in your tracker. Mark them Sent once you send it, then Replied when they answer.";
  }

  // ---------- Free runs: the visitor's own Claude or ChatGPT does the search ----------
  const AI = {
    // Claude may show a "use caution" banner above link-filled prompts; that's expected, and the visitor still presses Send.
    claude: { name: "Claude", url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
    chatgpt: { name: "ChatGPT", url: (q) => `https://chatgpt.com/?hints=search&q=${encodeURIComponent(q)}` },
  };

  function aboutYou(f) {
    return [
      f.name && `Name: ${f.name}`,
      f.school && `School: ${f.school}`,
      (f.year || f.major) && `Year and major: ${[f.year, f.major].filter(Boolean).join(" ")}`,
      f.hometown && `Hometown: ${f.hometown}`,
      f.orgs && `Clubs and organizations: ${f.orgs}`,
      f.past && `Past jobs: ${f.past}`,
    ].filter(Boolean).join("\n") || "(nothing else given)";
  }

  function searchPrompt(f) {
    const apps = f.apps.map((a, i) => `${i + 1}. ${a.company}: ${a.role || "internship"}${a.url ? ` (${a.url})` : ""}`).join("\n");
    return `Use web search. I applied to these jobs and want to meet people at each company.

${apps}

About me:
${aboutYou(f)}

For each job, find the posting link and 2 to 4 real people there to message, with their LinkedIn profile links. Stay in the same function as the role: for a marketing role, people in marketing or brand; for a sales role, people in sales. Among those, put people who share something with me first (school, hometown, club, past job), then former interns of that program, then the recruiter. People on other teams (like supply chain for a marketing role) who share something with me are still worth including, but list them after same-team people, set "other_team":true, and name their team in "why". Only include people you found a source for.

Also try hard to find the likely hiring manager, the person the role reports to: check the posting for a named contact or reporting line, search LinkedIn for that manager title on that team in that city, and look for posts from people there saying they're hiring for this role. List them first with "hiring_manager":true (at most one per job) and say in "why" how you know.

For each person, write a LinkedIn note under 200 characters in this order: who I am (school, year, major), the exact role I applied for, one specific detail from their profile (if they were promoted or had a clear win, congratulate them on it; otherwise a career move or the brand they work on), and a friendly ask for a quick 15-min chat about their role and how they got there. Example: "Hi Kinsey, A&M marketing junior here, just applied for KDP's Sales Analyst internship. Saw you moved from PepsiCo to KDP, congrats on the promotion! Open to a quick 15-min chat about that jump?"

End with only this JSON in a code block:
{"summary":"","applications":[{"company":"","role":"","posting_url":"","people":[{"name":"","title":"","profile_url":"","hiring_manager":false,"other_team":false,"connection":"","why":"","note":""}]}]}`;
  }

  function prepPrompt(p, app, f) {
    return `Use web search. I have a coffee chat with ${p.name}, ${p.title} at ${app.company}. I applied for ${app.role || "an internship"} there. What we share: ${p.connection || "nothing known"}.${p.profile_url ? ` Their LinkedIn: ${p.profile_url}` : ""}

About me:
${aboutYou(f)}

Give me a short prep sheet: who they are, one recent company fact, my 20-second intro, five questions to ask, a thank-you note to send after, and a short referral ask to send only if the chat goes well.`;
  }

  let lastAi = "claude";
  function openAssistant(which, prompt) {
    lastAi = which;
    copyText(prompt, AI[which].paste
      ? `Prompt copied. Paste it into ${AI[which].name} and press Send.`
      : `Opening ${AI[which].name}. The prompt is also copied, in case you need to paste it.`);
    window.open(AI[which].url(prompt), "_blank", "noopener");
  }

  function startFree(which) {
    const fields = currentFields();
    store.set(KEYS.form, fields);
    $("t-error").hidden = true;
    if (!checkForm()) return;
    openAssistant(which, searchPrompt(fields));
    document.querySelectorAll("[data-ai-name]").forEach((n) => { n.textContent = AI[which].name; });
    $("t-paste-step").innerHTML = AI[which].paste
      ? "paste your prompt (it is already copied) with Ctrl+V, or ⌘V on a Mac, and press <strong>Send</strong>."
      : "press <strong>Send</strong> if your message is waiting there.";
    $("t-paste").hidden = false;
    $("t-paste").dataset.fields = JSON.stringify(fields);
    $("t-paste").scrollIntoView({ behavior: "smooth", block: "center" });
  }
  document.querySelectorAll("[data-run]").forEach((b) => b.addEventListener("click", () => startFree(b.dataset.run)));
  $("t-reopen").addEventListener("click", () => startFree(lastAi));

  // Pull the JSON out of whatever was pasted: a code block, or the outermost braces.
  function parsePasted(text) {
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    let raw = block ? block[1] : text;
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a < 0 || b < a) throw new Error("no json");
    const data = JSON.parse(raw.slice(a, b + 1));
    if (!Array.isArray(data.applications)) throw new Error("bad shape");
    const str = (v, max) => String(v ?? "").slice(0, max);
    return {
      summary: str(data.summary, 400),
      applications: data.applications.slice(0, 6).map((ap) => ({
        company: str(ap.company, 80), role: str(ap.role, 120), posting_url: str(ap.posting_url, 400),
        people: (Array.isArray(ap.people) ? ap.people : []).slice(0, 6).filter((p) => p && p.name).map((p) => ({
          name: str(p.name, 80), title: str(p.title, 120), profile_url: str(p.profile_url, 400),
          hiring_manager: p.hiring_manager === true, other_team: p.other_team === true, connection: str(p.connection, 120), why: str(p.why, 320), note: str(p.note, 400),
        })),
      })).filter((ap) => ap.company),
    };
  }

  $("t-paste-go").addEventListener("click", () => {
    const text = $("t-paste-text").value.trim();
    $("t-error").hidden = true;
    if (!text) { $("t-paste-text").focus(); return; }
    try {
      result = parsePasted(text);
    } catch {
      showError("That doesn't look like the results block. Copy the code block at the very end of the chat (it starts with {\"summary\") and paste it again.");
      return;
    }
    result.via = lastAi;
    try { result.fields = JSON.parse($("t-paste").dataset.fields || "null") || currentFields(); } catch { result.fields = currentFields(); }
    store.set(KEYS.last, result);
    $("t-paste").hidden = true;
    renderResults();
    $("t-results").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Each visit starts clean: past results aren't shown again (people you copied a note for are in the tracker).
  result = null;

  // ---------- Start ----------
  renderRunSteps();
  renderTracker();
  renderResults();
  route();
})();
