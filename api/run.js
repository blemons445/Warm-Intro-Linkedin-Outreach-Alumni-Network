// POST /api/run: searches for open internships and alumni, drafts LinkedIn notes,
// and streams progress back as newline-delimited JSON.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const ALLOWED_ORIGINS = [
  "https://blemons445.github.io",
  "https://warm-intro-linkedin-outreach-alumni.vercel.app",
];

const FIELDS = {
  school: 80, major: 60, year: 20, city: 60, kind: 80, term: 30, companies: 200, name: 60, code: 60,
  mode: 10, p_name: 80, p_title: 120, p_company: 80, p_connection: 120, p_role: 120,
};

// Light per-instance throttle so one visitor can't run up the bill. Chat prep is much cheaper than a search.
const recent = { search: new Map(), prep: new Map() };
const LIMIT = { search: 3, prep: 10 };
const WINDOW_MS = 60 * 60 * 1000;

const SUBMIT_TOOL = {
  name: "submit_results",
  description: "Return the final verified internships, people and drafted LinkedIn notes. Call once, at the end.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "postings", "people"],
    properties: {
      summary: { type: "string", description: "One or two sentences on what was found." },
      postings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["company", "title", "location", "url", "status", "why"],
          properties: {
            company: { type: "string" },
            title: { type: "string" },
            location: { type: "string" },
            url: { type: "string", description: "Link to the posting, ideally on the company's own careers site." },
            status: { type: "string", description: "Open, deadline, or anything notable about timing." },
            why: { type: "string", description: "One line on why it fits the student." },
          },
        },
      },
      people: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "title", "company", "profile_url", "connection", "note"],
          properties: {
            name: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            profile_url: { type: "string", description: "LinkedIn or other public profile URL seen in search results, or empty." },
            connection: { type: "string", description: "What links them to the student, e.g. 'Texas A&M, Class of 2022', as shown in the source." },
            note: { type: "string", description: "LinkedIn connection note, under 200 characters." },
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
    required: ["about", "company_now", "intro", "questions", "thank_you"],
    properties: {
      about: { type: "string", description: "Two or three sentences on the person's role and path, only from what you found or were given." },
      company_now: { type: "string", description: "One or two recent, relevant facts about the company or team, with no speculation." },
      intro: { type: "string", description: "The student's 20-second spoken intro, first person." },
      questions: { type: "array", items: { type: "string" }, description: "Four or five specific questions to ask." },
      thank_you: { type: "string", description: "A short thank-you message to send after the chat." },
    },
  },
};

function prepPrompt(f) {
  return `A college student has a 15-minute coffee chat coming up. Write a short prep sheet.

Student: ${f.name || "(name not given)"}, ${f.year || ""} ${f.major || ""} at ${f.school}, looking for ${f.kind} in ${f.city}${f.term ? `, ${f.term}` : ""}.
Person: ${f.p_name}, ${f.p_title} at ${f.p_company}. Connection: ${f.p_connection || "same school"}.
Role the student is applying for: ${f.p_role || "an internship at the company"}.

Use web search briefly for the person's public background and recent company news. Don't invent details; if you can't find something, keep that part general.
The intro should be natural and under 60 words. Questions should be about their work and advice, not asking for a referral. The thank-you note should be 2 or 3 sentences and mention one thing to fill in from the chat as [something they said].

When done, call submit_prep once. Don't write the sheet as text.`;
}

function systemPrompt(f) {
  return `You help a college student land an internship through people, not portals.

Student:
- Name: ${f.name || "(not given)"}
- School: ${f.school}
- Major: ${f.major || "(not given)"}
- Year: ${f.year || "(not given)"}
- Wants: ${f.kind}
- Where: ${f.city}
- Term: ${f.term || "next summer"}
- Companies they're interested in: ${f.companies || "(open to suggestions)"}

Do this with web search:
1. Find 3 to 5 internship postings that are open now and match. Prefer each company's own careers site; job boards often keep closed or last year's listings up, so skip anything you can't confirm is current.
2. At those companies, find 3 to 6 people who went to ${f.school}: recent graduates and campus recruiters first. Search public profiles (for example LinkedIn results). Only include someone if a source you saw shows both the company and ${f.school}. Similar school names (branch campuses, other universities with the same city name) don't count. Never invent a person, title or URL; leave profile_url empty if you didn't see one.
3. For each person, write a LinkedIn connection note under 200 characters. Mention the shared school, say what the student is applying for, and end with one easy question they can answer in a line. No referral asks, no requests for a call, no flattery.

Fewer real results beat more guessed ones. If you find nothing reliable for a step, return an empty list for it and say so in the summary.

When done, call submit_results once. Don't write the results as text.`;
}

function clean(body) {
  const f = {};
  for (const [k, max] of Object.entries(FIELDS)) {
    f[k] = String(body?.[k] ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  }
  return f;
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
  if (!f.school || !f.kind || !f.city) return json(400, { error: "School, internship type and city are required." });
  const mode = f.mode === "prep" ? "prep" : "search";
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
        send({ type: "status", text: mode === "prep" ? `Looking up ${f.p_name}` : "Reading your target" });
        const result = mode === "prep"
          ? await run({ system: prepPrompt(f), ask: "Write my coffee chat prep sheet.", tool: PREP_TOOL, searches: 3 }, send)
          : await run({ system: systemPrompt(f), ask: "Find my internships, people and draft notes.", tool: SUBMIT_TOOL, searches: 10 }, send);
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

    if (msg.stop_reason === "refusal") throw new UserError("The search was declined. Try rewording your target.");

    const submit = msg.content.find((b) => b.type === "tool_use" && b.name === tool.name);
    if (submit) return submit.input;

    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason === "max_tokens") throw new UserError("The search ran too long. Try a narrower target.");

    // Ended with text instead of the tool: ask once more for the structured result.
    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: `Now call ${tool.name} with what you found.` });
  }
  throw new UserError("The search didn't finish. Try again with a narrower target.");
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
