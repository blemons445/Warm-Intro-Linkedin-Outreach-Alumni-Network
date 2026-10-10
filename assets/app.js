// Warm Intro: hash routing, setup and run checklists, and a tracker saved in localStorage.
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const KEYS = { theme: "wi-theme", checks: "wi-checks", rows: "wi-rows" };

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
  const ROUTES = ["home", "setup", "run", "tracker", "about"];
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

  // ---------- Start ----------
  renderRunSteps();
  renderTracker();
  route();
})();
