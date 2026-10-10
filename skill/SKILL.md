---
name: internship-outreach
description: Help a student land an internship or entry-level job by setting a target, finding open roles, finding alumni and recruiters at target companies, drafting short LinkedIn notes, and tailoring a resume to a posting.
---

# Internship outreach

Run a student's job search the way a good career coach would: pick targets, find openings, find real people to talk to (alumni first), write short honest first messages, and tailor the resume to the best posting. The student sends every message and every application themselves. Never send, apply, or connect on their behalf.

Adapted from the playbook "Use AI to Meet People at Companies You Want to Work For" (Angus the Nontechnical, Oct 2026), extended with internship search and resume tailoring.

## How to run it

Work through the five steps in order, but let the user jump in anywhere ("just tailor my resume for this posting"). At the start, check whether a `job-search/` folder already exists and pick up from its files rather than asking again. After each step, save the file, tell the user in two or three lines what you found and what they should do next, and wait for them before starting the next step.

Files (create them under `job-search/` in the working folder):
- `target-profile.md`: goal, background, industries, location, companies, open roles
- `people.md`: everyone found, their evidence, message drafts and status
- `resumes/`: the original resume and one tailored copy per posting

## Step 1: Set the target

Start every new search by asking questions, one at a time, in this order. Keep each question short, give an example answer, and skip any the user has already answered:
1. "Where do you want your internship? For example: Dallas-Fort Worth, Houston, or remote." Accept more than one location, in order of preference. These are the only places they want to work.
2. "What kind of internship, and for when? For example: a Summer 2027 marketing or sales internship."
3. "Any companies you already like? List as many as you want, or say 'suggest some' and I'll build a list for your location."
4. "What's your school, major, year and expected graduation date?" If anything suggests they may be an international student, also ask: "Will you need visa sponsorship to work in the U.S.?"
5. "Tell me 2 or 3 things about you outside class, like clubs, jobs, your hometown or sports." These are for finding common ground with the people you'll message.
6. "Have you already applied anywhere or messaged anyone? List them so I don't suggest them again." Record them in `people.md` as already sent.
7. "Do you have LinkedIn Premium?" This sets the connection note limit: 200 characters without Premium, 300 with it. Default to 200 if they're not sure.
8. "How many people do you want to reach out to per batch?" (default 5)
9. "Want me to tailor your resume later? If so, share it as a PDF or text."
10. "Do you have your LinkedIn connections export (Connections.csv)? It helps find people you already know."

If they don't have Connections.csv yet, walk them through it: on LinkedIn (desktop), click Me, then Settings & Privacy, then Data privacy, then "Get a copy of your data". Choose "Want something in particular?" and tick Connections if it's listed. If it isn't (LinkedIn sometimes leaves it off), choose "Download larger data archive" instead, which includes connections. Click Request archive. LinkedIn emails a download link; the larger archive often sends a first part within minutes and the rest within 24 hours. Ask them to unzip it and share only Connections.csv, never the whole archive. If it's still pending, say so and start with public research; never pretend their network has been imported.

Check which tools are connected (Clay, Apollo, web search). Both are optional: if neither is connected, say so once and continue with web search. Clay has a free plan (100 data credits and 500 actions a month); if it isn't connected, give the sign-up link https://app.clay.com/signup and tell them to connect it in Claude under Settings, Connectors. Apollo's people search needs a paid plan (on the free plan it returns a plan-limit error), and Apollo can't search by school or education, so it can't confirm alumni on any plan. Save everything to `target-profile.md`.

## Step 2: Find open roles

The user shouldn't have to check this themselves: confirm every posting is open before any outreach starts. Search each company's careers site, Handshake, and the user's school career portal (and TeamWork Online for sports teams and leagues) for postings that match the role, term and location. For each one, record the title, location, link, eligibility (class year, majors, graduation window) and the date you checked. If a program can place interns outside the user's locations (for example, any of several regional offices), flag that the location isn't guaranteed. If the user needs sponsorship, drop postings that say they won't sponsor. Many postings (especially on Handshake) leave out the term or year, so write "term not stated" rather than guessing. Check that each posting is still open by opening it on the company's own careers site (or Handshake), not just a job board, because job boards keep closed and last-year listings up. A posting counts as open only if the application page loads and accepts applications, and its title matches the user's term (a "2026" title doesn't count for Summer 2027). Record the link and the date you checked, so the user can click it once before applying. If only last year's posting exists and is closed, record it as "ran last year, not posted yet", which tells the user when to watch for it. Say plainly when a company has nothing posted yet, and note which functions its internship page says it hires for. Flag the single best match and recommend applying soon, since many programs review applications as they come in. Add the list to `target-profile.md`.

## Step 3: Find people

Only find people at companies with a confirmed open posting from step 2 that matches the user's role, term and one of their locations (or remote). Put companies that have nothing open yet, or only roles in other cities or other functions, on a watch list in `target-profile.md` with when their postings usually open, and don't build outreach for them unless the user asks. If no target company has an open posting, say so and suggest new companies in the user's locations that do.

Find the batch size of people at the target companies, in this order of priority:
1. The user's own first-degree connections who work at a target company (match the Company column in Connections.csv)
2. Alumni of the user's school in the target function and city
3. People on the team that owns a posting from step 2, or past interns in that program
4. Campus or university recruiters for the company in that region

Use Clay first, then public web search. Use Apollo only if the user has a paid Apollo plan, and only to find people by company, role and city; confirm their school another way.

How to search with Clay (learned from testing):
- Identify each company by its LinkedIn company URL, not its web domain, and check the company name Clay returns. Domains can match the wrong company (in testing, pga.org matched a small PGA fund in Florida and topgolf.com matched Topgolf Abu Dhabi).
- Search by company and role (marketing, sales, brand, recruiter) and city. Don't trust the search's school filter: it matches loosely and returns people from other schools.
- Search results include people who used to work there. Drop anyone whose current employer isn't the target company before doing anything else.
- Then confirm each remaining person's school with one education lookup per person, asking specifically whether they attended the user's exact school and campus. Only look up current employees, because each lookup uses Clay credits. If the lookup says the profile couldn't be read, record the school as unknown, not as "did not attend". Ask for the full list of schools with graduation years too, and trust that list over a yes/no answer, since the yes/no can say "no" even when the list shows the right school.
- Expect few matches. In testing, about 1 in 9 current marketing and recruiting staff at a company were alumni of the target school. If you find fewer than the batch size, widen to other functions or nearby cities, and include recruiters, who are often the most useful contact.

For every person, record name, current company and role (with start date), location, school with degree and year, LinkedIn URL, and a one-line hook: the specific, verifiable thing a message could mention. Look for common ground with what the user shared about themselves in step 1 (same hometown, club, sport, past job or path), and note it when it's verifiable. Skip anyone the user already applied to or messaged.

Within each group, strongly prefer recent graduates (finished their degree in the last 1 to 4 years, or former interns at that company). They remember the internship search, are more likely to reply, and know what the program looks for. Record each person's graduation year and say how recent it is.

Rules:
- Prefer people with a recent move, promotion or relevant open role in the last 90 days, and record the date and source. Keep good people without a recent event, but never invent one.
- Try to read a few things each person wrote (posts, comments, articles). If you can, note how they write (short and direct, warm, detailed) as a light cue for tone. If you can't, say "no writing samples" and use a neutral tone.
- Data tools can lag behind LinkedIn when someone changes jobs. Mark titles and graduation years as "per Clay" and ask the user to glance at the profile before sending.
- Confirm the school from their education section. Similar names don't count (for example Texas A&M-Commerce or East Texas A&M are not Texas A&M). List people you checked and ruled out, so they aren't searched again.
- Every claim needs a source, or is marked unknown. Never invent a recent move, a post, or a mutual connection. Connections.csv shows who the user knows; it doesn't prove who knows a target, so a mutual connection needs evidence from LinkedIn or the user's confirmation.
- If a tool can't read LinkedIn posts or mutual connections, say so in a "Gaps" note and tell the user to check the profile before sending.
- Number each person (001, 002, ...) and keep the numbers on later runs. Add 3 to 6 backups.

Save to `people.md` as a table plus LinkedIn links.

## Step 4: Draft first messages

Write one message per person for the user to review and send themselves.

- **Connection note:** under 200 characters, or under 300 if the user said they have LinkedIn Premium. Count the characters and show the count.
- **Full message:** 35 to 65 words, sent after they accept.
- Open with who the user is ("fellow Aggie here, junior in marketing"), mention one specific true thing about the person (common ground with the user is best, when it's real), and ask one easy, specific question they could answer in a reply, such as why they chose a path or what helped most early on. Don't ask for a call in the first message; offer a 15-minute chat only after they reply. If the user has applied to a posting at that company, say so.
- Never ask for a referral in the first message, never flatter ("impressive background"), never claim a mutual connection that isn't verified, and never invent experience the user doesn't have.
- Prefer naming the team or kind of work ("on KDP's sales team") over an exact job title, so a recent job change can't make the message wrong.
- Use a neutral, natural tone unless you've read real samples of the person's writing.
- Add one short follow-up for about a week with no reply. Don't schedule automated follow-ups.

Append the drafts to `people.md` and add each person to the tracker (see Tracker below). When the user reports back, update the status, and if someone agrees to a chat, offer the prep sheet below.

## Step 5: Tailor the resume

For the best posting (or one the user names):
1. Pull the posting's key requirements and keywords.
2. Rewrite bullets to lead with results and match the posting's language, using only what's true. Ask the user for numbers or details rather than inventing them, and leave a gap rather than a placeholder.
3. Keep it to one page, in the original's style, with plain text that applicant-tracking systems can read (no text in images or tables for core content).
4. Confirm key facts with the user (graduation date, titles, dates) before calling it final.
5. Save a PDF as `resumes/<Name>_Resume_<Company>_<Role>.pdf` with no notes left in it.

## Recommended order for a strong posting

Apply first, then message the people at that company the same day and say you just applied. Ask a question, not for a referral. If they reply, offer a 15-minute chat, and after a good conversation, ask if they'd be willing to flag your application.

## Prep for a chat or interview

Only when the user asks (for example, "prep me for my chat with Megan"), never during a normal run. Keep it to one short page, and use only facts from `people.md`, the posting and the user's resume.
- **Coffee chat:** 3 things about the person (their role, their path, any real common ground), a 20-second intro for the user, 4 or 5 questions to ask, and what to say at the end if it goes well (asking whether they'd flag the user's application).
- **Interview** (including recorded video interviews like HireVue): the questions they're likely to ask, and which of the user's real experiences to use for each answer.

## Tracker

Keep one tracker the user can glance at: every message and application, its status, and totals at the top. If you can publish a page, build it once as a simple web page with a status dropdown per row and the totals (messages sent, replies, coffee chats, applications, interviews), and add rows as the user sends messages or applies. Otherwise keep the same table at the top of `people.md`.

Message statuses: drafted, sent, replied, coffee chat, referred, no reply. Application statuses: applied, interview, offer, rejected. When the user wants to post about their search, use only the tracker's real totals, never invented results.
