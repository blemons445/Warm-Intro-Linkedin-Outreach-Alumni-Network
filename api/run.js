// POST /api/run: searches for open internships and alumni, drafts LinkedIn notes,
// and streams progress back as newline-delimited JSON.
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const ALLOWED_ORIGINS = [
  "https://blemons445.github.io",
  "https://warm-intro-linkedin-outreach-alumni.vercel.app",
];

const FIELDS = {
  school: 80, major: 60, year: 20, city: 60, kind: 80, term: 30, companies: 200, name: 60,
};

// Light per-instance throttle so one visitor can't run up the bill.
const recent = new Map();
const LIMIT = 3;
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

  if (!process.env.ANTHROPIC_API_KEY) return json(500, { error: "The site isn't set up yet: the server has no API key." });

  let f;
  try { f = clean(await request.json()); } catch { return json(400, { error: "Bad request." }); }
  if (!f.school || !f.kind || !f.city) return json(400, { error: "School, internship type and city are required." });

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= LIMIT) return json(429, { error: "You've run a few searches this hour. Try again later." });
  recent.set(ip, [...hits, now]);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        send({ type: "status", text: "Reading your target" });
        const result = await run(f, send);
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

async function run(f, send) {
  const messages = [{ role: "user", content: "Find my internships, people and draft notes." }];

  // pause_turn means the server paused a long search; re-send to let it continue.
  for (let round = 0; round < 5; round++) {
    const stream = client.beta.messages.stream({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: systemPrompt(f),
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 10 }, SUBMIT_TOOL],
      messages,
    });

    stream.on("contentBlock", (block) => {
      if (block.type === "server_tool_use" && block.name === "web_search" && block.input?.query) {
        send({ type: "status", text: `Searching: ${block.input.query}` });
      }
    });

    const msg = await stream.finalMessage();

    if (msg.stop_reason === "refusal") throw new UserError("The search was declined. Try rewording your target.");

    const submit = msg.content.find((b) => b.type === "tool_use" && b.name === "submit_results");
    if (submit) return submit.input;

    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason === "max_tokens") throw new UserError("The search ran too long. Try a narrower target.");

    // Ended with text instead of the tool: ask once more for the structured result.
    messages.push({ role: "assistant", content: msg.content });
    messages.push({ role: "user", content: "Now call submit_results with what you found." });
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
