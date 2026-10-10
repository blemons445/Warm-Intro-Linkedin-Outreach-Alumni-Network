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
    if (name === "try") document.querySelectorAll("#t-people .note").forEach((n) => n.dispatchEvent(new Event("input")));
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

  // ---------- Try it: the site runs the search ----------
  // On GitHub Pages the API lives on Vercel; on Vercel or locally it's same-origin.
  const API = location.hostname.endsWith("github.io") ? "https://warm-intro-linkedin-outreach-alumni.vercel.app/api/run" : "/api/run";
  const TRY_FIELDS = ["school", "kind", "city", "name", "major", "year", "term", "companies"];
  let result = null;

  const savedForm = store.get(KEYS.form, {});
  TRY_FIELDS.forEach((k) => { if (savedForm[k]) $(`t-${k}`).value = savedForm[k]; });

  // Access code: a shared link like ?code=XYZ#try fills it in, so whoever gets the link never types it.
  const urlCode = new URLSearchParams(location.search).get("code");
  if (urlCode) {
    store.set(KEYS.code, urlCode);
    history.replaceState(null, "", location.pathname + location.hash);
  }
  $("t-code").value = store.get(KEYS.code, "") || "";
  const showCode = () => { $("t-code-row").hidden = false; };

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  const safeUrl = (u) => (/^https:\/\//i.test(u || "") ? u : "");
  const linkedinSearch = (p) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${p.name} ${p.company}`)}`;

  function inTracker(kind, name, company) {
    return rows.some((r) => r.kind === kind && r.name.toLowerCase() === name.toLowerCase() && r.company.toLowerCase() === company.toLowerCase());
  }
  function track(kind, item) {
    const name = kind === "person" ? item.name : item.title;
    if (inTracker(kind, name, item.company)) return false;
    rows.push({
      id: uid(), kind, name, company: item.company,
      detail: kind === "person" ? item.title : item.location,
      link: kind === "person" ? safeUrl(item.profile_url) : safeUrl(item.url),
      date: today(), status: kind === "person" ? "drafted" : "applied",
    });
    return true;
  }
  function markDone(btn, label) { btn.textContent = label; btn.disabled = true; }

  function postingCard(p) {
    const c = el("article", "res-card");
    const top = el("div", "res-top");
    const who = el("div");
    who.append(el("div", "pv-name", p.title), el("div", "pv-sub", [p.company, p.location].filter(Boolean).join(" · ")));
    top.append(who);
    if (p.status) top.append(el("span", "chip", p.status));
    c.append(top);
    if (p.why) c.append(el("p", "why", p.why));
    const acts = el("div", "actions");
    const url = result.sample ? "" : safeUrl(p.url);
    if (url) { const a = el("a", "btn primary small", "Open posting"); a.href = url; a.target = "_blank"; a.rel = "noopener"; acts.append(a); }
    const b = el("button", "btn small", "I applied");
    b.type = "button";
    if (inTracker("application", p.title, p.company)) markDone(b, "In tracker");
    b.addEventListener("click", () => { track("application", p); save(); renderTracker(); markDone(b, "In tracker"); toast("Added to your tracker"); });
    acts.append(b);
    c.append(acts);
    return c;
  }

  function personCard(p) {
    const c = el("article", "res-card");
    const top = el("div", "res-top");
    const initials = p.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    top.append(el("span", "avatar", initials));
    const who = el("div");
    who.append(el("div", "pv-name", p.name), el("div", "pv-sub", [p.title, p.company].filter(Boolean).join(" · ")));
    top.append(who);
    c.append(top);
    if (p.connection) c.append(el("span", "chip", p.connection));
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
    const add = el("button", "btn small", "Add to tracker");
    add.type = "button";
    if (inTracker("person", p.name, p.company)) markDone(add, "In tracker");
    copy.addEventListener("click", () => {
      copyText(note.value, "Note copied. Paste it into LinkedIn.");
      if (track("person", p)) { save(); renderTracker(); markDone(add, "In tracker"); }
    });
    add.addEventListener("click", () => { track("person", p); save(); renderTracker(); markDone(add, "In tracker"); toast("Added to your tracker"); });
    const prof = el("a", "btn small", safeUrl(p.profile_url) ? "Open profile" : "Find on LinkedIn");
    prof.href = safeUrl(p.profile_url) || linkedinSearch(p);
    prof.target = "_blank"; prof.rel = "noopener";
    if (result.sample) acts.append(copy, add); else acts.append(copy, prof, add);
    c.append(acts);
    return c;
  }

  function renderResults() {
    const r = result;
    $("t-results").hidden = !r;
    if (!r) return;
    $("t-sample").hidden = !r.sample;
    $("t-summary").textContent = r.summary || "";
    const post = r.postings || [], ppl = r.people || [];
    $("t-c-post").textContent = post.length ? `· ${post.length}` : "";
    $("t-c-ppl").textContent = ppl.length ? `· ${ppl.length}` : "";
    $("t-postings").replaceChildren(...(post.length ? post.map(postingCard) : [el("p", "empty", "No open postings confirmed this time. Try a wider area or a different role.")]));
    $("t-people").replaceChildren(...(ppl.length ? ppl.map(personCard) : [el("p", "empty", "No confirmed alumni found this time. Try adding companies you like, or run the skill in Claude with Clay for a deeper search.")]));
    requestAnimationFrame(() => document.querySelectorAll("#t-people .note").forEach((n) => n.dispatchEvent(new Event("input"))));
  }

  function setBusy(busy) {
    $("t-go").disabled = busy;
    $("t-go").textContent = busy ? "Searching…" : "Find my people";
    $("t-progress").hidden = !busy;
  }

  function logLine(text) {
    $("t-stage").textContent = text;
    const li = el("li", null, text);
    $("t-log").append(li);
  }

  async function runSearch(fields) {
    $("t-error").hidden = true;
    $("t-log").replaceChildren();
    result = null; renderResults();
    setBusy(true);
    let gotResult = false;
    try {
      const res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (data.code_required) { showCode(); $("t-code").focus(); }
        throw new Error(data.error || "Something went wrong. Try again.");
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.type === "status") logLine(ev.text);
          else if (ev.type === "error") throw new Error(ev.error);
          else if (ev.type === "result") { result = ev.data; gotResult = true; }
        }
      }
      if (!gotResult) throw new Error("The search stopped early. Try again.");
      store.set(KEYS.last, result);
      renderResults();
      $("t-results").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      const msg = err instanceof TypeError ? "Couldn't reach the search service. Check your connection and try again." : err.message;
      $("t-error-msg").textContent = msg;
      $("t-error").hidden = false;
    } finally {
      setBusy(false);
    }
  }

  $("try-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fields = {};
    TRY_FIELDS.forEach((k) => { fields[k] = $(`t-${k}`).value.trim(); });
    store.set(KEYS.form, fields);
    fields.code = $("t-code").value.trim();
    if (fields.code) store.set(KEYS.code, fields.code);
    runSearch(fields);
  });

  $("t-addall").addEventListener("click", () => {
    if (!result) return;
    let n = 0;
    (result.people || []).forEach((p) => { if (track("person", p)) n++; });
    save(); renderTracker(); renderResults();
    toast(n ? `Added ${n} ${n === 1 ? "person" : "people"} to your tracker` : "Everyone is already in your tracker");
  });

  $("t-again").addEventListener("click", () => {
    result = null; store.set(KEYS.last, null); renderResults();
    $("t-school").focus();
  });

  // Sample run: replays a fictional search so anyone (recruiters included) can see the output instantly.
  const SAMPLE = {
    sample: true,
    summary: "Found 2 open internships in Dallas-Fort Worth and 3 alumni at those companies. Apply to the Acme Foods role first; its deadline is closest.",
    postings: [
      { company: "Acme Foods", title: "Summer 2027 Sales Intern", location: "Dallas, TX", url: "", status: "Open · closes Nov 15", why: "Field sales with a category marketing project, open to marketing juniors." },
      { company: "Lone Star Beverage", title: "Brand Marketing Intern", location: "Plano, TX", url: "", status: "Open", why: "Brand team for a regional drinks portfolio; asks for retail or social media experience." },
    ],
    people: [
      { name: "Jordan Lee", title: "Sales Coordinator", company: "Acme Foods", profile_url: "", connection: "Texas A&M, Class of 2023 · former intern", note: "Hi Jordan, fellow Aggie here (junior, marketing). I just applied for Acme's Summer Sales internship. What do you wish you'd known before your internship there?" },
      { name: "Priya Shah", title: "Campus Recruiter", company: "Acme Foods", profile_url: "", connection: "Texas A&M, Class of 2021", note: "Hi Priya, fellow Aggie and marketing junior. I applied for the Summer 2027 Sales internship today. Is there anything you look for that applicants often miss?" },
      { name: "Marcus Hill", title: "Associate Brand Manager", company: "Lone Star Beverage", profile_url: "", connection: "Texas A&M, Class of 2022", note: "Hi Marcus, Gig 'em! I'm a marketing junior applying to Lone Star's Brand Marketing internship. What does a typical week look like on the brand team?" },
    ],
  };
  const SAMPLE_STEPS = [
    "Reading your target",
    "Searching: sales marketing internship Dallas summer 2027",
    "Searching: Acme Foods careers internship",
    "Searching: Lone Star Beverage brand marketing intern",
    "Searching: Texas A&M Acme Foods LinkedIn",
    "Searching: Texas A&M Lone Star Beverage brand manager",
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
    for (const step of SAMPLE_STEPS) { logLine(step); await wait(fast ? 60 : 450); }
    setBusy(false);
    result = structuredClone(SAMPLE);
    renderResults();
    $("t-results").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  document.querySelectorAll("[data-demo]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); runSample(); }));

  result = store.get(KEYS.last, null);

  // ---------- Start ----------
  renderRunSteps();
  renderTracker();
  renderResults();
  route();
})();
