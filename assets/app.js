// Warm Intro: hash routing, the Try it search, setup and run checklists, and a tracker saved in localStorage.
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
    document.title = (name === "home" ? "Warm Intro: AI internship outreach for students" : `${view.textContent} · Warm Intro`);
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
    { key: "target", title: "Set your target", say: "Help me find an internship.", note: "Claude asks about ten short questions: where, what role, which companies, your school and year." },
    { key: "roles", title: "Find open internships", say: "Find open internships for my targets.", note: "You get a list of postings checked on each company's own site, with the best match flagged. Apply to that one soon." },
    { key: "people", title: "Find alumni and recruiters", say: "Find people at those companies.", note: "Alumni and recruiters at companies with an open posting, recent graduates first, each with a reason to reach out." },
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
    copyText(skillText, "Skill copied. Paste it into a new Claude chat.");
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
    download(`warm-intro-tracker-${today()}.csv`, csv, "text/csv");
  });

  $("export-json").addEventListener("click", () => {
    download(`warm-intro-backup-${today()}.json`, JSON.stringify({ app: "warm-intro", version: 1, rows }, null, 2), "application/json");
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
    } catch { toast("That file isn't a Warm Intro backup."); }
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
  const API = location.hostname.endsWith("github.io") ? "https://warm-intro-linkedin-outreach-alumni.vercel.app/api/run" : "/api/run";
  const TRY_FIELDS = ["school", "name", "major", "year"];
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
  function appRow(a = {}) {
    const row = el("div", "app-row");
    const field = (label, key, ph, type = "text") => {
      const l = el("label", null, label);
      const i = el("input");
      i.type = type; i.dataset.key = key; i.placeholder = ph; i.value = a[key] || ""; i.maxLength = key === "url" ? 300 : 100;
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
  setApps(Array.isArray(savedForm.apps) ? savedForm.apps : []);

  // Access code: a shared link like ?code=XYZ#try fills it in, so whoever gets the link never types it.
  const urlCode = new URLSearchParams(location.search).get("code");
  if (urlCode) {
    store.set(KEYS.code, urlCode);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  $("t-code").value = store.get(KEYS.code, "") || "";
  const showCode = () => { $("t-code-row").hidden = false; };

  function inTracker(kind, name, company) {
    return rows.some((r) => r.kind === kind && r.name.toLowerCase() === name.toLowerCase() && r.company.toLowerCase() === company.toLowerCase());
  }
  function trackPerson(p, app) {
    if (inTracker("person", p.name, app.company)) return false;
    rows.push({ id: uid(), kind: "person", name: p.name, company: app.company, detail: p.title, link: result.sample ? "" : safeUrl(p.profile_url), date: today(), status: "drafted" });
    return true;
  }
  function trackApp(app) {
    if (!app.role || inTracker("application", app.role, app.company)) return false;
    rows.push({ id: uid(), kind: "application", name: app.role, company: app.company, detail: "", link: result.sample ? "" : safeUrl(app.posting_url), date: today(), status: "applied" });
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
    note.addEventListener("input", () => { upd(); if (!result.sample) store.set(KEYS.last, result); });
    upd();
    c.append(note, count);

    const acts = el("div", "actions");
    const copy = el("button", "btn primary small", "Copy note");
    copy.type = "button";
    const prof = el("a", "btn small", "LinkedIn profile");
    const url = safeUrl(p.profile_url);
    if (result.sample || !url) {
      prof.href = "#try";
      prof.addEventListener("click", (e) => { e.preventDefault(); toast("Sample person. In a live run this opens their LinkedIn profile."); });
    } else { prof.href = url; prof.target = "_blank"; prof.rel = "noopener"; }
    const add = el("button", "btn small", "Add to tracker");
    add.type = "button";
    if (inTracker("person", p.name, app.company)) markDone(add, "In tracker");
    copy.addEventListener("click", () => {
      copyText(note.value, "Note copied. Paste it into LinkedIn.");
      if (trackPerson(p, app)) { trackApp(app); save(); renderTracker(); markDone(add, "In tracker"); }
    });
    add.addEventListener("click", () => { trackPerson(p, app); trackApp(app); save(); renderTracker(); markDone(add, "In tracker"); toast("Added to your tracker"); });
    const prep = el("button", "btn small ghost", "They replied: prep me");
    prep.type = "button";
    prep.addEventListener("click", () => openPrep(p, app, prep));
    acts.append(copy, prof, add, prep);
    c.append(acts);
    return c;
  }

  function appGroup(app) {
    const g = el("section", "app-group");
    const head = el("div", "app-head");
    const t = el("div");
    t.append(el("div", "pv-name", app.company), el("div", "pv-sub", app.role ? `You applied: ${app.role}` : "You applied"));
    head.append(t);
    const url = result.sample ? "" : safeUrl(app.posting_url);
    if (url) { const a = el("a", "btn small", "View posting"); a.href = url; a.target = "_blank"; a.rel = "noopener"; head.append(a); }
    else if (result.sample) {
      const a = el("a", "btn small", "View posting"); a.href = "#try";
      a.addEventListener("click", (e) => { e.preventDefault(); toast("Sample posting. In a live run this opens the job post."); });
      head.append(a);
    }
    g.append(head);
    const list = el("div", "res-list");
    const ppl = app.people || [];
    if (ppl.length) ppl.forEach((p) => list.append(personCard(p, app)));
    else list.append(el("p", "empty", "No one confirmed at this company yet. Try again later, or run the skill in Claude with Clay for a deeper search."));
    g.append(list);
    return g;
  }

  function renderResults() {
    const r = result;
    $("t-results").hidden = !r;
    if (!r) return;
    $("t-sample").hidden = !r.sample;
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
      if (data.code_required) showCode();
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
      if (!$("t-code-row").hidden) $("t-code").focus();
      showError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  $("try-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fields = currentFields();
    store.set(KEYS.form, fields);
    const code = $("t-code").value.trim();
    if (code) store.set(KEYS.code, code);
    if (!fields.school) { showError("Add your school so we can find your alumni."); $("t-school").focus(); return; }
    if (!fields.apps.length) { showError("Add at least one company you applied to."); $("t-apps").querySelector("input").focus(); return; }
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
    result = null; store.set(KEYS.last, null); renderResults();
    $("t-school").focus();
  });

  // ---------- Coffee chat prep and referral ask ----------
  function samplePrep(p, app) {
    const first = p.name.split(" ")[0];
    return {
      about: `${first} is a ${p.title} at ${app.company} and a ${p.connection.replace(/ · .*/, "")} graduate. (Sample: a live run pulls this from their public profile.)`,
      company_now: `${app.company} is growing its Dallas-Fort Worth team this year. (Sample: a live run uses recent news.)`,
      intro: `Hi ${first}, thanks for making time. I'm a junior at Texas A&M studying marketing, and I applied for the ${app.role} role. I'd love to hear how you got started at ${app.company} and what the team is like.`,
      questions: [
        "What does a typical week look like in your role?",
        `What surprised you most when you started at ${app.company}?`,
        "What do the strongest interns do differently?",
        "What would you focus on if you were in my position this year?",
        "Is there anyone else you'd suggest I talk to?",
      ],
      thank_you: `Thanks again for the chat today, ${first}. Your advice about [something they said] was really helpful, and I'm going to act on it this week.`,
      referral_ask: `Hi ${first}, thanks again for your time. I'm really excited about the ${app.role} role after talking with you. Would you be comfortable referring me or passing my name to the recruiter? Totally fine if not.`,
    };
  }

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
    if (result.sample) {
      slot.replaceChildren(prepSheet(p, app, samplePrep(p, app)));
      slot.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // ---------- Sample run: a fictional search anyone can watch, instantly and for free ----------
  const SAMPLE = {
    sample: true,
    summary: "Found 4 people across your 2 applications, 3 of them Texas A&M alumni. Message Jordan first: same school, same team, and a former intern in the program you applied to.",
    applications: [
      { company: "Acme Foods", role: "Summer 2027 Sales Intern", posting_url: "", people: [
        { name: "Jordan Lee", title: "Sales Coordinator", profile_url: "", connection: "Texas A&M, Class of 2023", why: "On the sales team this internship joins, and a former intern in the same program.", note: "Hi Jordan, fellow Aggie here (junior, marketing). I just applied for Acme's Summer Sales internship. What do you wish you'd known before your internship there?" },
        { name: "Priya Shah", title: "Campus Recruiter", profile_url: "", connection: "Texas A&M, Class of 2021", why: "Recruits for Acme's summer internship program.", note: "Hi Priya, fellow Aggie and marketing junior. I applied for the Summer 2027 Sales internship today. Is there anything you look for that applicants often miss?" },
      ] },
      { company: "Lone Star Beverage", role: "Brand Marketing Intern", posting_url: "", people: [
        { name: "Marcus Hill", title: "Associate Brand Manager", profile_url: "", connection: "Texas A&M, Class of 2022", why: "On the brand team the internship supports.", note: "Hi Marcus, Gig 'em! I'm a marketing junior who applied to Lone Star's Brand Marketing internship. What does a typical week look like on the brand team?" },
        { name: "Elena Ruiz", title: "Talent Acquisition Partner", profile_url: "", connection: "Recruiter for this role", why: "Listed as the recruiter on the posting.", note: "Hi Elena, I'm a Texas A&M marketing junior and just applied for the Brand Marketing internship. What's the best way to stand out in this year's process?" },
      ] },
    ],
  };
  const SAMPLE_STEPS = [
    "Reading your 2 applications",
    "Searching: Acme Foods Summer 2027 Sales Intern posting",
    "Searching: site:linkedin.com/in Texas A&M Acme Foods sales",
    "Searching: Acme Foods campus recruiter",
    "Searching: Lone Star Beverage Brand Marketing Intern posting",
    "Searching: site:linkedin.com/in Texas A&M Lone Star Beverage brand",
    "Checking each person's school and current company",
    "Drafting notes",
  ];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  async function runSample() {
    if (location.hash !== "#try") location.hash = "try";
    $("t-error").hidden = true;
    $("t-log").replaceChildren();
    result = null; renderResults();
    setBusy(true);
    $("t-progress").scrollIntoView({ behavior: "smooth", block: "center" });
    const fast = matchMedia("(prefers-reduced-motion: reduce)").matches;
    for (const step of SAMPLE_STEPS) { logLine(step); await wait(fast ? 60 : 420); }
    setBusy(false);
    result = structuredClone(SAMPLE);
    renderResults();
    $("t-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); runSample(); }));

  // Results from before this redesign have a different shape; drop them.
  result = store.get(KEYS.last, null);
  if (result && !Array.isArray(result.applications)) result = null;

  // ---------- Start ----------
  renderRunSteps();
  renderTracker();
  renderResults();
  route();
})();
