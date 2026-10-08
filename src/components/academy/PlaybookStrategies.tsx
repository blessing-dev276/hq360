import { useState } from "react";

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="asa-btn asa-btn-ghost asa-btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

type Strategy = {
  name: string;
  where: string;
  yield: string;
  look: string[];
  signal: string;
  tip: string;
};

/** Eight repeatable ways to find authors; the yield is roughly how many
 *  qualified authors a scout can log per hour with each one. */
export const SCOUTING_STRATEGIES: Strategy[] = [
  {
    name: "Review-site sweep",
    where: "Readers' Favorite, Reedsy Discovery, Online Book Club",
    yield: "10–12 / hour",
    look: [
      "4 or 5 star reviews from the last 12 months",
      "Indie or small-press books",
      "Genres you can clearly help",
    ],
    signal: "The author paid for or chased a review: they are investing in the book.",
    tip: "Use HQ360 Scout batches for this. It is the fastest way to reach 50 a day.",
  },
  {
    name: "Amazon new-release mining",
    where: "Amazon category 'Hot New Releases' and 'New & Popular'",
    yield: "6–8 / hour",
    look: [
      "Published in the last 90 days",
      "Under 20 ratings",
      "A weak description, plain cover or missing A+ content",
    ],
    signal: "A new book with few reviews is in its make-or-break window.",
    tip: "Pick 3 sub-categories you know well and work them every week.",
  },
  {
    name: "Goodreads list hunting",
    where: "Goodreads Listopia and 'Popular by genre' shelves",
    yield: "6–8 / hour",
    look: [
      "Books ranked on page 3 or lower",
      "High average rating but under 50 ratings",
      "An unclaimed or empty author profile",
    ],
    signal: "Readers like the book, but it is buried where nobody scrolls.",
    tip: "Screenshot the list position; it becomes your opener.",
  },
  {
    name: "Launch-calendar scouting",
    where: "Amazon pre-orders, NetGalley, BookSirens, cover-reveal posts",
    yield: "4–6 / hour",
    look: [
      "Release date in the next 30–60 days",
      "No launch team or ARC campaign visible",
      "An author website with no book page yet",
    ],
    signal: "Pre-launch authors are actively looking for help and have a deadline.",
    tip: "Timing beats everything: reach them before launch week, not after.",
  },
  {
    name: "Community listening",
    where: "Facebook author groups, r/selfpublish, r/writing, Discord writing servers",
    yield: "3–5 / hour",
    look: [
      "Posts asking 'how do I get more reviews / sales?'",
      "Launch announcements with little engagement",
      "Authors sharing frustration with ads",
    ],
    signal: "They said the problem out loud, in public.",
    tip: "Give a genuinely useful answer in the thread first. Never pitch in the group.",
  },
  {
    name: "#Bookstagram & BookTok trail",
    where: "Instagram and TikTok hashtags: #indieauthor, #newrelease, #booklaunch",
    yield: "4–6 / hour",
    look: [
      "Authors posting their own book with under 1,000 followers",
      "Good covers but low engagement",
      "Link-in-bio that goes nowhere useful",
    ],
    signal: "They are trying to market but the audience isn't converting.",
    tip: "Note their best post: mention it when you reach out.",
  },
  {
    name: "Expert & business-author search",
    where: "LinkedIn, podcast guest lists, speaker directories",
    yield: "3–4 / hour",
    look: [
      "Coaches, consultants and founders with a book",
      "The book is mentioned in their headline or bio",
      "No book website or a dated one",
    ],
    signal: "The book drives their business, so visibility has clear money value.",
    tip: "These authors have the biggest budgets. Lead with business outcomes, not sales rank.",
  },
  {
    name: "Award & contest shortlists",
    where: "Indie awards (IPPY, Readers' Favorite, Eric Hoffer), local and genre contests",
    yield: "5–7 / hour",
    look: [
      "Finalists and honourable mentions",
      "Winners with few ratings on Amazon",
      "Award not shown on their cover or Amazon page",
    ],
    signal: "Proven quality, and an easy, flattering reason to get in touch.",
    tip: "Congratulate first: 'I saw you were a finalist for…' gets replies.",
  },
];

export function ScoutingStrategies() {
  return (
    <>
      <p>
        To hit 50 authors a day, mix one fast strategy with one high-value one. A strong day looks
        like <b>3 hours of review-site sweeps</b> (about 33 authors),{" "}
        <b>1 hour of Amazon new releases</b> (about 7) and <b>2 hours of a high-value source</b>{" "}
        such as launches or business authors (about 10).
      </p>
      <div className="asa-strats">
        {SCOUTING_STRATEGIES.map((s, i) => (
          <details key={s.name} className="asa-card asa-strat" open={i === 0}>
            <summary>
              <span className="asa-strat-n">{String(i + 1).padStart(2, "0")}</span>
              <span className="asa-strat-title">
                <b>{s.name}</b>
                <small>{s.where}</small>
              </span>
              <span className="asa-strat-yield">{s.yield}</span>
            </summary>
            <div className="asa-strat-body">
              <div>
                <div className="asa-label">What to look for</div>
                <ul>
                  {s.look.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="asa-label">Why it works</div>
                <p>{s.signal}</p>
                <div className="asa-label">Pro tip</div>
                <p>{s.tip}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}

const QUALIFY: [string, number][] = [
  ["Published in the last 18 months, or launching soon", 2],
  ["Good reviews (4★+) but fewer than 50 of them", 2],
  ["The book supports a business, practice or speaking career", 2],
  ["A visible gap you can name (description, list rank, website, reviews)", 2],
  ["A public, professional way to contact them", 1],
  ["Recent activity (posts, newsletter, events) in the last 60 days", 1],
];

export function QualifyChecklist() {
  const [checked, setChecked] = useState<boolean[]>(QUALIFY.map(() => false));
  const score = QUALIFY.reduce((sum, [, pts], i) => sum + (checked[i] ? pts : 0), 0);
  const verdict =
    score >= 7
      ? ["Hot lead", "Research and reach out today.", "good"]
      : score >= 4
        ? ["Warm lead", "Save it; reach out once your hot list is done.", "warn"]
        : ["Skip", "Not worth the time today. Move on.", "bad"];
  return (
    <>
      <p>
        Spend no more than <b>60 seconds</b> deciding whether an author is worth your research time.
        Tick what's true. Total out of 10.
      </p>
      <div className="asa-card asa-qualify">
        <div className="asa-qualify-list">
          {QUALIFY.map(([text, pts], i) => (
            <label key={text}>
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
              />
              <span>{text}</span>
              <small>+{pts}</small>
            </label>
          ))}
        </div>
        <div className={`asa-qualify-score ${verdict[2]}`}>
          <b>{score}</b>
          <span>/ 10</span>
          <strong>{verdict[0]}</strong>
          <small>{verdict[1]}</small>
        </div>
      </div>
      <p className="asa-muted" style={{ fontSize: 14 }}>
        7–10 hot · 4–6 warm · 0–3 skip. Log every author you score, even skips. They all count
        toward your 50.
      </p>
    </>
  );
}

type Approach = {
  name: string;
  best: string;
  steps: string[];
  opener: string;
  avoid: string;
};

export const APPROACH_STRATEGIES: Approach[] = [
  {
    name: "The value-first mini audit",
    best: "Every author you score as hot",
    steps: [
      "Spend 10 minutes finding one specific, fixable gap",
      "Take one screenshot that shows it",
      "Send the finding, not a pitch",
    ],
    opener:
      "Hi {name}, I was reading about {book} and noticed it's on page 4 of the '{list}' list on Goodreads, below books with fewer ratings than yours. I put together a quick note on why that happens and how to move up. Want me to send it over?",
    avoid: "Sending the full audit unasked. Offer it; let them say yes.",
  },
  {
    name: "Personal email",
    best: "Authors with a public business or author email",
    steps: [
      "Subject line names the book, not your service",
      "3–5 sentences, one question at the end",
      "Send Tuesday–Thursday, mid-morning their time",
    ],
    opener:
      "Subject: A quick thought on {book}\n\nHi {name}, I just finished the sample of {book}. The opening chapter really pulls you in. One thing stood out: {specific gap}. Would it be useful if I shared what we've seen work for books like yours?",
    avoid: "Attachments, links in the first email, or more than one question.",
  },
  {
    name: "Facebook author page / Messenger",
    best: "Authors active on Facebook groups or their page",
    steps: [
      "Like or comment on a recent post first (genuinely)",
      "Wait a day, then message the page",
      "Keep it to 2–3 lines",
    ],
    opener:
      "Hi {name}, loved your post about {recent post}. I work with indie authors on book visibility and noticed something about {book} you might find useful. Okay if I share it here?",
    avoid: "Messaging a personal profile when they have an author page.",
  },
  {
    name: "Instagram / TikTok DM",
    best: "Bookstagram and BookTok authors",
    steps: [
      "Comment on their best-performing post first",
      "Open the DM by referencing that post",
      "Ask permission before sending anything long",
    ],
    opener:
      "Your {post topic} post was brilliant! It's the hook {book} needs on Amazon too. I noticed the book page doesn't use it yet. Want a couple of quick ideas?",
    avoid: "Copy-paste DMs, emojis-only openers, or links in the first message.",
  },
  {
    name: "LinkedIn connection note",
    best: "Business authors, coaches, consultants, speakers",
    steps: [
      "Connect with a short note (under 300 characters)",
      "After they accept, send one useful observation",
      "Frame everything around their business goals",
    ],
    opener:
      "Hi {name}, enjoyed {book}. The chapter on {topic} is spot on. I help business authors turn their book into a lead source and had one idea for yours. Happy to connect.",
    avoid: "Pitching in the connection request.",
  },
  {
    name: "Comment-first warm up",
    best: "Any author who posts publicly",
    steps: [
      "Leave 2–3 thoughtful comments over a week",
      "Let them recognise your name",
      "Then reach out by DM or email",
    ],
    opener:
      "Hi {name}, we've chatted a bit in your comments. I really liked your take on {topic}. I had a thought about {book} I'd love to share, if that's okay?",
    avoid: "Generic 'Great post!' comments. Say something specific.",
  },
  {
    name: "Launch-window timing",
    best: "Authors with a release in the next 60 days",
    steps: [
      "Reference the release date in the first line",
      "Offer one pre-launch quick win",
      "Follow up exactly one week before launch",
    ],
    opener:
      "Hi {name}, congratulations on {book} launching on {date}! The two weeks before launch decide how Amazon ranks it. Would a short pre-launch checklist for your book be helpful?",
    avoid: "Reaching out in launch week, when they're overwhelmed.",
  },
  {
    name: "Referral & congratulation",
    best: "Award finalists, podcast guests, authors from a happy client's circle",
    steps: [
      "Lead with the achievement or the mutual connection",
      "Keep the ask tiny",
      "Ask permission to share one idea",
    ],
    opener:
      "Hi {name}, congratulations on being a finalist for {award} with {book}! That deserves more readers seeing it. Would you mind if I shared one idea to make the most of it?",
    avoid: "Name-dropping a referrer without their permission.",
  },
];

export function ApproachStrategies() {
  return (
    <>
      <p>
        Match the channel to where the author already spends time. Whatever the channel, the rule is
        the same: <b>specific, short, one question</b>. Replace the {"{curly}"} parts before you
        send.
      </p>
      <div className="asa-strats">
        {APPROACH_STRATEGIES.map((a, i) => (
          <details key={a.name} className="asa-card asa-strat" open={i === 0}>
            <summary>
              <span className="asa-strat-n">{String.fromCharCode(65 + i)}</span>
              <span className="asa-strat-title">
                <b>{a.name}</b>
                <small>Best for: {a.best}</small>
              </span>
            </summary>
            <div className="asa-strat-body">
              <div>
                <div className="asa-label">How to do it</div>
                <ol>
                  {a.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <div className="asa-label" style={{ color: "var(--asa-bad)" }}>
                  Avoid
                </div>
                <p>{a.avoid}</p>
              </div>
              <div className="asa-opener">
                <div className="asa-opener-head">
                  <div className="asa-label">Opener</div>
                  <Copy text={a.opener} />
                </div>
                <p>{a.opener}</p>
              </div>
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
