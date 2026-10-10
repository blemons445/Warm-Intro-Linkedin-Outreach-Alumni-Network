// POST /api/run: for jobs a student already applied to, finds alumni and recruiters at each company,
// drafts LinkedIn notes, and preps coffee chats. Streams progress back as newline-delimited JSON.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const ALLOWED_ORIGINS = [
  "https://blemons445.github.io",
  "https://warm-intro-linkedin-outreach-alumni.vercel.app",
];

const FIELDS = {
  school: 80, major: 60, year: 20, name: 60, code: 60,
  mode: 10, p_name: 80, p_title: 120, p_company: 80, p_connection: 120, p_role: 120,
};
const MAX_APPS = 3;

// Light per-instance throttle so one visitor can't run up the bill. Chat prep is much cheaper than a search.
const recent = { search: new Map(), prep: new Map() };
const LIMIT = { search: 3, prep: 10 };
const WINDOW_MS = 60 * 60 * 1000;

const SUBMIT_TOOL = {
  name: "submit_results",
  description: "Return the people found for each application, with drafted LinkedIn notes. Call once, at the end.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "applications"],
    properties: {
      summary: { type: "string", description: "One or two sentences on who was found and who to message first." },
      applications: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["company", "role", "posting_url", "people"],
          properties: {
            company: { type: "string" },
            role: { type: "string" },
            posting_url: { type: "string", description: "The posting the student gave, or the one you found on the company's site, or empty." },
            people: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name", "title", "profile_url", "connection", "why", "note"],
                properties: {
                  name: { type: "string" },
                  title: { type: "string" },
                  profile_url: { type: "string", description: "Their LinkedIn profile URL (linkedin.com/in/...) exactly as seen in a source." },
                  connection: { type: "string", description: "What links them to the student, e.g. 'Texas A&M, Class of 2022', as shown in the source." },
                  why: { type: "string", description: "One line: why this person, e.g. 'on the sales team this internship joins' or 'recruits for this program'." },
                  note: { type: "string", description: "LinkedIn connection note, under 200 characters." },
                },
              },
            },
          },
        },
      },
    },
  },
};

const PREP_TOOL = {
  name: "submit_prep",
  description: "Return the coffee chat prep sheet. Call once, at the end.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["about", "company_now", "intro", "questions", "thank_you", "referral_ask"],
    properties: {
      about: { type: "string", description: "Two or three sentences on the person's role and path, only from what you found or were given." },
      company_now: { type: "string", description: "One or two recent, relevant facts about the company or team, with no speculation." },
      intro: { type: "string", description: "The student's 20-second spoken intro, first person." },
      questions: { type: "array", items: { type: "string" }, description: "Four or five specific questions to ask." },
      thank_you: { type: "string", description: "A short thank-you message to send after the chat." },
      referral_ask: { type: "string", description: "A short, low-pressure message asking whether they'd be comfortable referring the student or passing their name to the recruiter, to send only if the chat went well." },
    },
  },
};

function student(f) {
  return `${f.name || "The student"}, ${[f.year, f.major].filter(Boolean).join(" ") || "a student"} at ${f.school}`;
}

function prepPrompt(f) {
  return `A college student has a 15-minute coffee chat coming up with someone at a company they applied to. Write a short prep sheet.

Student: ${student(f)}.
Person: ${f.p_name}, ${f.p_title} at ${f.p_company}. Connection: ${f.p_connection || "same school"}.
Role the student applied for: ${f.p_role || "an internship at the company"}.

Use web search briefly for the person's public background and recent company news. Don't invent details; if you can't find something, keep that part general.
The intro should be natural and under 60 words and mention the application. Questions should be about their work, the team and advice. The thank-you note should be 2 or 3 sentences and include [something they said] for the student to fill in. The referral ask should be 2 or 3 sentences, easy to say no to, and mention the exact role.

When done, call submit_prep once. Don't write the sheet as text.`;
}

function systemPrompt(f) {
  const list = f.apps.map((a, i) => `${i + 1}. ${a.company}: ${a.role}${a.url ? ` (posting: ${a.url})` : ""}`).join("\n");
  return `You help a college student turn applications they've already sent into conversations with people at those companies, so they can get coffee chats and, eventually, referrals. You are not a job search tool; don't suggest other jobs.

Student: ${student(f)}.

Applications already sent:
${list}

For each application, use web search to:
1. Confirm the posting link. Use the link given; otherwise find the posting on the company's own careers site. Leave it empty if you can't find it.
2. Find 2 or 3 people at that company worth messaging, in this order: graduates of ${f.school} on the team or in the department the role sits in; ${f.school} graduates elsewhere at the company, recent graduates first; former interns of the same program; the recruiter or campus recruiter for the program. Search public LinkedIn profiles (for example "site:linkedin.com/in ${f.school} <company>").
   Only include someone if a source you saw shows their current company, and for alumni, ${f.school}. Similar school names (branch campuses, other schools with the same city in the name) don't count. Every person must have a linkedin.com/in/ profile URL that you saw; skip anyone without one. Never invent a person, title or URL.
3. Write a LinkedIn connection note for each person, under 200 characters: mention the shared school if there is one, say the student applied for the exact role, and end with one easy question about their work they can answer in a line. No referral ask and no request for a call in the first message.

Fewer real people beat more guessed ones. If you find no one for an application, return an empty people list for it and say so in the summary.

When done, call submit_results once. Don't write the results as text.`;
}

function clean(body) {
  const f = {};
  for (const [k, max] of Object.entries(FIELDS)) {
    f[k] = String(body?.[k] ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  const tidy = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  f.apps = (Array.isArray(body?.apps) ? body.apps : [])
    .map((a) => ({ company: tidy(a?.company, 80), role: tidy(a?.role, 100), url: tidy(a?.url, 300) }))
    .map((a) => ({ ...a, url: /^https?:\/\//i.test(a.url) ? a.url : "" }))
    .filter((a) => a.company)
    .slice(0, MAX_APPS);
  return f;
}

// Keep only people with a real LinkedIn profile link, so every card links somewhere.
function tidyResult(r) {
  const isProfile = (u) => /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/in\/[^/?#\s]+/i.test(u || "");
  for (const a of r.applications || []) {
    a.posting_url = /^https?:\/\//i.test(a.posting_url || "") ? a.posting_url : "";
    a.people = (a.people || []).filter((p) => p.name && isProfile(p.profile_url));
  }
  return r;
}

function cors(origin) {
  const h = { "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
  if (ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin || "")) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

export function OPTIONS(request) {
  return new Response(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request) {
  const headers = cors(request.headers.get("origin"));
  const json = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...headers, "Content-Type": "application/json" } });

  // No key set means live search is switched off; the page offers the sample run instead.
  if (!process.env.ANTHROPIC_API_KEY) return json(503, { error: "Live search is invite-only right now. Watch the sample run to see exactly what it returns, or run the full tool free in your own Claude account.", live_off: true });

  let f;
  try { f = clean(await request.json()); } catch { return json(400, { error: "Bad request." }); }
  const mode = f.mode === "prep" ? "prep" : "search";
  if (!f.school) return json(400, { error: "Add your school." });
  if (mode === "search" && !f.apps.length) return json(400, { error: "Add at least one company you applied to." });
  if (mode === "prep" && (!f.p_name || !f.p_company)) return json(400, { error: "Missing who the chat is with." });

  // Optional: set ACCESS_CODE in Vercel to limit live searches to people you've given the code.
  const code = process.env.ACCESS_CODE;
  if (code && f.code.toLowerCase() !== code.toLowerCase()) {
    return json(401, { error: f.code ? "That access code didn't work." : "Live search is invite-only. Enter your access code, or watch the sample run to see exactly what it returns.", code_required: true });
  }

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const hits = (recent[mode].get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT[mode]) return json(429, { error: "You've hit this hour's limit. Try again later." });
  recent[mode].set(ip, [...hits, now]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        send({ type: "status", text: mode === "prep" ? `Looking up ${f.p_name}` : `Reading your ${f.apps.length === 1 ? "application" : "applications"}` });
        const result = mode === "prep"
          ? await run({ system: prepPrompt(f), ask: "Write my coffee chat prep sheet.", tool: PREP_TOOL, searches: 3 }, send)
          : tidyResult(await run({ system: systemPrompt(f), ask: "Find the people for my applications and draft notes.", tool: SUBMIT_TOOL, searches: 4 + 3 * f.apps.length }, send));
        send({ type: "result", data: result });
      } catch (err) {
        send({ type: "error", error: friendly(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { ...headers, "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function run({ system, ask, tool, searches }, send) {
  const messages = [{ role: "user", content: ask }];

  // pause_turn means the server paused a long search; re-send to let it continue.
  for (let round = 0; round < 5; round++) {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: searches }, tool],
      messages,
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use" && block.name === "web_search" && block.input?.query) {
        send({ type: "status", text: `Searching: ${block.input.query}` });
      }
    });

    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") throw new UserError("The search was declined. Try rewording the company or role.");

    const submit = msg.content.find((b) => b.type === "tool_use" && b.name === tool.name);
    if (submit) return submit.input;

    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason === "max_tokens") throw new UserError("The search ran too long. Try fewer applications at once.");

    // Ended with text instead of the tool: ask once more for the structured result.
    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: `Now call ${tool.name} with what you found.` });
  }
  throw new UserError("The search didn't finish. Try again with fewer applications.");
}

class UserError extends Error {}

function friendly(err) {
  if (err instanceof UserError) return err.message;
  console.error(err);
  if (err instanceof Anthropic.RateLimitError) return "The site is busy right now. Try again in a minute.";
  if (err instanceof Anthropic.AuthenticationError) return "The site's API key isn't working. The owner needs to check it.";
  if (err instanceof Anthropic.APIError && err.status === 529) return "Claude is overloaded right now. Try again in a minute.";
  return "Something went wrong on our side. Try again.";
}
