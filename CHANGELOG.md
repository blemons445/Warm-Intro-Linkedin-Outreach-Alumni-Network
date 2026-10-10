# Changelog

How Past the Post got to where it is. Each change came from using it on a real internship search.

## 2.3.0 (Oct 10, 2026): Hiring managers and faster forms
- Searches now look for the likely hiring manager for each role and flag them; if none is found, a LinkedIn search link fills the gap.
- Company and Role suggest as you type, from about 9,000 companies and 900 internship titles (public internship listings from SimplifyJobs, plus Nasdaq, NYSE and S&P 500 lists), plus your tracker.
- School, company and role are required, with the missing ones highlighted. Each visit starts with empty jobs.
- Claude opens a blank chat to paste into, which avoids its warning on link-filled prompts. Shorter prompts, higher contrast, and the access code box is hidden.

## 2.2.0 (Oct 10, 2026): Free for everyone, in Claude or ChatGPT
- Try it now runs free: it opens the visitor's own Claude or ChatGPT with a filled-in prompt, and they paste the results back to get cards, links, notes and tracker entries.
- Chat prep opens in the same assistant. The full skill page works with ChatGPT too.
- Removed the sample run. Live search on the site stays available with an access code.

## 2.1.0 (Oct 10, 2026): Renamed to Past the Post
- New name for the new focus: getting past the job posting to the people behind it. (Previously Warm Intro.)

## 2.0.0 (Oct 10, 2026): Start from applications, not job searches
- Refocused on what job boards don't do: you enter jobs you've already applied to, and Past the Post finds the people at each company.
- Results are grouped by application, with the posting link and a LinkedIn profile link for every person. People without a confirmed profile link are dropped.
- New flow: reach out, track replies, coffee chat, then a referral ask for that exact role, written into the chat prep sheet.
- Applications can be filled straight from the tracker.
- Not just alumni: it looks for any shared ground (school, hometown, clubs, past employers), plus former interns, the team and recruiters. School is optional.

## 1.2.0 (Oct 10, 2026): The full flow on one page
- Results now walk through four steps: apply, message, track and prep for the chat.
- "They replied: prep me" on any person builds a coffee chat sheet: their background, company news, a 20-second intro, questions to ask and a thank-you note.
- Live search is invite-only (an access code, or switched off when no key is set); the sample run shows the whole flow, prep included, for free.

## 1.1.0 (Oct 10, 2026): One-page search
- New **Try it** page: three fields and one button. The site searches for open postings and alumni, drafts a note for each person and streams its progress while it works.
- Copying a note adds that person to the tracker; "I applied" logs the application. Results stay on the page after a refresh.
- Added a Vercel backend that calls Claude with web search and a strict result schema. The key stays on the server, with a per-visitor hourly limit.
- The original skill is still there under **Use in Claude** for deeper searches with Clay.
- Added "Watch a sample run", which replays a fictional search instantly with no API call, and a home section for recruiters with links to the case study, code and contact.

## 1.0.0 (Oct 10, 2026): Web app
- Combined everything into one web app: setup checklist, guided run, tracker and a "How it was built" page.
- Tracker saves in the browser, with CSV export, backup and restore, and sample data for visitors.
- Accessible by default: keyboard navigation, skip link, screen-reader labels, dark mode, works on phones.

## 0.6 (Oct 10, 2026): Tracker and coffee chat prep
- Added a tracker for every message and application, with totals that fill in a LinkedIn post using only real numbers.
- Added prep sheets for coffee chats and interviews (including recorded video interviews), run only when asked.

## 0.5 (Oct 10, 2026): Honest tool setup
- Tested Apollo as a second people source. Its people search needs a paid plan and it can't confirm alumni, so the setup now says so.
- Added Clay's free plan details and sign-up link.

## 0.4 (Oct 9, 2026): Verified postings only
- Postings must be confirmed open on the company's own careers site, with a title matching the right term. Job boards keep closed listings up.
- Outreach only goes to companies with a confirmed open posting; the rest go on a watch list.

## 0.3 (Oct 9, 2026): Better people search
- Identify companies by LinkedIn URL, not web domain, after domain searches matched the wrong companies.
- Confirm each person's school one by one, since the search's school filter matched loosely.
- Prefer recent graduates and former interns, who are most likely to reply.

## 0.2 (Oct 9, 2026): Messages that get replies
- First messages ask one easy question, never for a referral or a call. A 15-minute chat comes after a reply.
- Notes fit LinkedIn's 200-character limit (300 with Premium), with the count shown.

## 0.1 (Oct 9, 2026): First version
- Five steps: set a target, find open roles, find alumni and recruiters, draft messages, tailor a resume.
- Adapted from Angus the Nontechnical's guide "Use AI to Meet People at Companies You Want to Work For".
