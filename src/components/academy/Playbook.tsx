import { useEffect, useState } from "react";

const CHAPTERS = [
  ["ch1", "The scout's job"],
  ["ch2", "Finding the right authors"],
  ["ch3", "Research before you write"],
  ["ch4", "The first message"],
  ["ch5", "Follow ups"],
  ["ch6", "Reading the reply"],
  ["ch7", "Handling rejection"],
  ["ch8", "Closing the deal"],
  ["ch9", "Integrity rules"],
  ["ch10", "Your daily scorecard"],
] as const;

const LINES: [string, string][] = [
  ["Chris Voss", "Have you given up on getting this book in front of more readers?"],
  [
    "Chris Voss",
    "Would it be a terrible idea if I just showed you what I found on your book's Goodreads page?",
  ],
  [
    "Jim Camp",
    "Totally fair. I will close your file, unless there is something about the book you wish was going better.",
  ],
  ["Sandler", "Can I ask what would have to be true for this to be a yes one day?"],
  [
    "Zig Ziglar",
    "I understand how you feel. Another author felt the same way, and what she found was that one small step changed how many readers saw her book.",
  ],
  [
    "Eric Worre",
    "If I could show you a way to get your book seen by more readers without it being a strain on your resources, would you be open to taking a look?",
  ],
  [
    "Alex Hormozi",
    "Let me do the first part for free, and you only decide after you see the results.",
  ],
  [
    "Cialdini",
    "I already built something for you, so you might as well take a look before you decide.",
  ],
  [
    "Loss aversion",
    "Right now readers are searching for a story exactly like yours and finding someone else's book instead.",
  ],
  [
    "Daniel Pink",
    "On a scale of one to ten, how important is it to you that more people read this book?",
  ],
  [
    "Jeb Blount",
    "I am not asking for a yes to anything big, just whether I can send you one screenshot.",
  ],
  [
    "Challenger Sale",
    "Did you know most readers never look past the second page of a Goodreads list, and your book is on page forty?",
  ],
  ["Grant Cardone", "Is it the money, or is it that you are not sure it would work?"],
];

function Chapter({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="asa-chapter">
      <div className="asa-label">Chapter {String(n).padStart(2, "0")}</div>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

/** The daily targets every scout works to; 50 authors scouted leads. */
const DAILY_TARGET = 50;
const DAILY_OTHER: [string, string][] = [
  ["15", "personal first messages"],
  ["10%", "reply rate target"],
  ["2", "practice sessions"],
];

function DailyScorecard({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`asa-score${compact ? " compact" : ""}`} aria-label="Your daily scorecard">
      <div className="asa-score-main">
        <div className="asa-label">Your daily scorecard</div>
        <div className="asa-score-big">
          <b>{DAILY_TARGET}</b>
          <span>
            authors
            <br />
            scouted per day
          </span>
        </div>
        <p className="asa-score-pace">
          That's about <b>7 an hour</b> over a 7-hour day, or <b>1 every 8 minutes</b>.
        </p>
        <div className="asa-score-steps" aria-hidden="true">
          {[10, 20, 30, 40, 50].map((n) => (
            <span key={n}>
              <i />
              {n}
            </span>
          ))}
        </div>
      </div>
      <div className="asa-score-side">
        {DAILY_OTHER.map(([n, t]) => (
          <div key={t} className="asa-score-item">
            <b>{n}</b>
            <span>{t}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Trainer() {
  const [missing, setMissing] = useState(false);
  return (
    <aside className="asa-card asa-trainer">
      <div className="asa-trainer-photo">
        {missing ? (
          <span className="asa-trainer-initials" aria-hidden="true">
            ES
          </span>
        ) : (
          <img
            ref={(img) => {
              // An image that failed before hydration never fires onError.
              if (img?.complete && img.naturalWidth === 0) setMissing(true);
            }}
            src="/trainer.jpg"
            alt="Emmanuel Sunday, your trainer"
            onError={() => setMissing(true)}
          />
        )}
        <span className="asa-trainer-badge">Your trainer</span>
      </div>
      <h3>Emmanuel Sunday</h3>
      <p className="asa-muted">Founder, HQ360. Author visibility, websites and book promotion.</p>
      <a
        href="https://hq360.space"
        target="_blank"
        rel="noopener noreferrer"
        className="asa-orange"
      >
        hq360.space ↗
      </a>
    </aside>
  );
}

function CopyButton({ text }: { text: string }) {
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

export function Playbook({ onPractice }: { onPractice: () => void }) {
  const [active, setActive] = useState("ch1");

  useEffect(() => {
    const els = CHAPTERS.map(([id]) => document.getElementById(id)).filter(
      Boolean,
    ) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-90px 0px -65% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="asa-wrap">
      {/* cover */}
      <div className="asa-cover">
        <div>
          <div className="asa-label">HQ360 training · Author outreach</div>
          <h1>
            The Author Scout <span className="asa-orange">Playbook</span>
          </h1>
          <p className="asa-muted" style={{ fontSize: 18, maxWidth: 620 }}>
            How to find the right authors, reach them like a professional, turn a no into a
            conversation, and close the deal honestly.
          </p>
          <div className="asa-counters">
            <div>
              <b>10</b>
              <span className="asa-muted">chapters</span>
            </div>
            <div>
              <b>13</b>
              <span className="asa-muted">objection lines</span>
            </div>
            <div>
              <b>8</b>
              <span className="asa-muted">practice authors</span>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <a href="#ch1" className="asa-btn">
              Start reading
            </a>
            <button type="button" className="asa-btn asa-btn-ghost" onClick={onPractice}>
              Open the practice room
            </button>
          </div>
        </div>
        <Trainer />
      </div>

      <DailyScorecard />

      <div className="asa-book">
        <nav className="asa-toc" aria-label="Chapters">
          {CHAPTERS.map(([id, title], i) => (
            <a key={id} href={`#${id}`} className={active === id ? "active" : ""}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              {title}
            </a>
          ))}
        </nav>

        <div>
          <Chapter id="ch1" n={1} title="The scout's job">
            <p>
              An Author Scout finds authors whose books deserve more readers, shows them exactly
              what is holding the book back, and makes saying yes feel like the obvious next step.
            </p>
            <p>
              We do not sell "marketing". We sell something authors can picture: their book on the
              first page of the lists readers browse, a website where readers can find them, and a
              description that turns visitors into buyers.
            </p>
            <p>
              Every message must answer the author's silent question:{" "}
              <b>why should I care, and why you?</b>
            </p>
            <div className="asa-stages">
              {[
                ["Scout", "find intent"],
                ["Research", "10 minute audit"],
                ["Reach", "short, personal"],
                ["Converse", "questions, proof"],
                ["Close", "yes, then terms"],
              ].map(([t, s], i) => (
                <div key={t} className={`asa-stage${i === 1 ? " hot" : ""}`}>
                  <small>{i + 1}</small>
                  <b>{t}</b>
                  <small>{s}</small>
                </div>
              ))}
            </div>
            <p className="asa-muted" style={{ fontSize: 14 }}>
              Most lost deals were lost at stage two because the scout did not know enough about the
              book.
            </p>
          </Chapter>

          <Chapter id="ch2" n={2} title="Finding the right authors">
            <div className="asa-grid-2">
              <div className="asa-card">
                <h3 style={{ marginTop: 0 }}>Strong signals</h3>
                <ul>
                  <li>Published in the last 18 months or launching soon</li>
                  <li>The book supports a business, practice or speaking</li>
                  <li>Paid a hybrid press or already runs ads</li>
                  <li>Good reviews but very few of them</li>
                  <li>Active on LinkedIn, Facebook or a newsletter</li>
                </ul>
              </div>
              <div className="asa-card">
                <h3 style={{ marginTop: 0 }}>Weak signals</h3>
                <ul>
                  <li>Famous or traditionally published with a big team</li>
                  <li>Very prolific hobby writers with no budget</li>
                  <li>Last book over five years old</li>
                  <li>No way to reach them except a public form</li>
                  <li>Recent life events such as illness or bereavement</li>
                </ul>
              </div>
            </div>
            <h3>Where to look</h3>
            <div className="asa-scroll-x">
              <table className="asa-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>What to look for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Goodreads</td>
                    <td>
                      Books with 4 star plus ratings but under 50 ratings; check list positions
                    </td>
                  </tr>
                  <tr>
                    <td>Amazon new releases</td>
                    <td>Weak descriptions, few reviews</td>
                  </tr>
                  <tr>
                    <td>Local news</td>
                    <td>"Local author publishes memoir" stories, great hooks</td>
                  </tr>
                  <tr>
                    <td>LinkedIn</td>
                    <td>
                      Professionals using a book for authority; they understand return on investment
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Chapter>

          <Chapter id="ch3" n={3} title="Research before you write">
            <p>Ten minutes on every author. Work through this checklist before you write a word.</p>
            <ol>
              <li>
                <b>Do they have a website?</b> No website is the clearest opening.
              </li>
              <li>
                <b>Where is the book on Goodreads?</b> Find 3 to 5 matching lists and note the page,
                or if it is missing, screenshot the top authors as competitors.
              </li>
              <li>
                <b>What do readers say?</b> Rating, review count, two real quotes.
              </li>
              <li>
                <b>How strong is the Amazon description?</b>
              </li>
              <li>
                <b>What is the human story?</b> Career, place, cause, loss. This is your first line.
              </li>
            </ol>
            <div className="asa-callout">
              <strong>Build before you ask</strong>
              If the author has no website, build a quick demo before messaging. If they say yes it
              becomes theirs; if they decline it goes into your portfolio.
            </div>
          </Chapter>

          <Chapter id="ch4" n={4} title="The first message">
            <ul>
              <li>
                <b>Short and personal:</b> 5 to 8 sentences, first line about them.
              </li>
              <li>
                <b>Plain prose only:</b> no bold, headings, bullet lists or labels.
              </li>
              <li>
                <b>No price before yes.</b>
              </li>
              <li>
                <b>House style:</b> no dashes, no contractions ("I would" not "I'd"), no signature
                block or link in the very first touch.
              </li>
              <li>
                <b>End with one clear, easy question.</b>
              </li>
            </ul>
            <div className="asa-grid-2" style={{ marginTop: 18 }}>
              <div>
                <div className="asa-label" style={{ color: "var(--asa-bad)" }}>
                  Before
                </div>
                <div className="asa-quote bad" style={{ marginTop: 8 }}>
                  Hi Kimberly, Your author profile introduces Austin Creek as your debut novel and
                  also highlights your teaching and workshop experience. That combination provides
                  more than one route for readers and programme organisers to discover your work.
                  For your work, I would propose: Reader positioning: review the book description...
                  Author platform: Clear novel and workshop enquiry paths... Reader development:
                  build a focused promotion plan...
                </div>
                <p style={{ fontSize: 14, marginTop: 10 }}>
                  <b>Why it fails:</b> sounds like a consultant's report, lists services not
                  results, asks for a "proposal" which feels like homework.
                </p>
              </div>
              <div>
                <div className="asa-label" style={{ color: "var(--asa-good)" }}>
                  After
                </div>
                <div className="asa-quote good" style={{ marginTop: 8 }}>
                  Hi Marlys, I just finished reading about your years with Pan Am and your move to
                  Acapulco, and I had to reach out. Seventeen readers have rated Roots, Routes, and
                  Roads Taken and the average is almost five stars, which tells me people love it.
                  The thing is, I could not find a website for you anywhere, so readers who finish
                  the book have nowhere to go. I went ahead and built you a demo to show what it
                  could look like. Would you like me to send you the link?
                </div>
                <p style={{ fontSize: 14, marginTop: 10 }}>
                  <b>Why it works:</b> proves you know her story, names one specific gap, gives
                  value first, ends with a question that costs nothing to answer.
                </p>
              </div>
            </div>
          </Chapter>

          <Chapter id="ch5" n={5} title="Follow ups">
            <div className="asa-tiles">
              <div className="asa-card asa-tile">
                <b>Day 3</b>
                Add one fact, for example the page the book sits on in its best list.
              </div>
              <div className="asa-card asa-tile">
                <b>Day 7</b>
                Add proof: competitor screenshots or a real result.
              </div>
              <div className="asa-card asa-tile">
                <b>Day 14</b>
                Close the loop kindly: "I will not keep filling your inbox. If the timing changes, I
                would be glad to help."
              </div>
            </div>
            <div className="asa-callout">
              <strong>Stop the sequence the moment anyone replies.</strong>
              An automatic nudge after a no, or after someone shares a loss, destroys trust.
            </div>
          </Chapter>

          <Chapter id="ch6" n={6} title="Reading the reply">
            <div className="asa-scroll-x">
              <table className="asa-table">
                <thead>
                  <tr>
                    <th>Reply type</th>
                    <th>What it sounds like</th>
                    <th>Your move</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Curious / open but unsure</td>
                    <td>
                      "I know nothing about these lists, but if you want to help me, thank you."
                    </td>
                    <td>
                      Teach why Goodreads matters, show the lists, name the competitors at the top,
                      show what they lose by staying invisible, then ask for the yes.
                    </td>
                  </tr>
                  <tr>
                    <td>Soft no / money or timing</td>
                    <td>"Thank you, but I have no resources for book promotion."</td>
                    <td>Agree, make it risk free with a small free first step and real proof.</td>
                  </tr>
                  <tr>
                    <td>Firm no</td>
                    <td>"No, thank you."</td>
                    <td>Thank them warmly, leave one door open in one sentence, stop.</td>
                  </tr>
                  <tr>
                    <td>Human moment / life event</td>
                    <td>"My wife died in June. Still in mourning."</td>
                    <td>
                      No pitch at all. Respond as a person, ask how they are, remove them from every
                      sequence.
                    </td>
                  </tr>
                  <tr>
                    <td>Skeptic</td>
                    <td>"How do I know this is not a scam?"</td>
                    <td>
                      Never pressure. Show who you are, real work, real reviews, a small step they
                      can verify.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Chapter>

          <Chapter id="ch7" n={7} title="Handling rejection">
            <p>
              A no is usually a no to the pitch, not to the goal. Agree with it, then open one small
              door. Use one line per reply, never stack them, and only use claims that are true.
            </p>
            <div>
              {LINES.map(([src, line], i) => (
                <div key={i} className="asa-line-row">
                  <div className="src">{src}</div>
                  <div className="txt">{line}</div>
                  <CopyButton text={line} />
                </div>
              ))}
            </div>
            <div className="asa-callout">
              <strong>The rule of one</strong>
              One line, one question, then let them talk. If the second reply is still no, thank
              them and stop. Track which line gets replies.
            </div>
          </Chapter>

          <Chapter id="ch8" n={8} title="Closing the deal">
            <p>People act more to avoid a loss than to gain something.</p>
            <figure className="asa-card" style={{ margin: "18px 0" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
                {[100, 62, 22, 14, 10, 8, 6, 5, 4, 4].map((h, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: `${h * 1.1}px`,
                        borderRadius: "6px 6px 0 0",
                        background:
                          i < 2
                            ? "var(--asa-orange)"
                            : i === 9
                              ? "var(--asa-bad)"
                              : "var(--asa-line)",
                      }}
                    />
                    <div className="asa-muted" style={{ fontSize: 11, marginTop: 4 }}>
                      {i === 9 ? "p.40" : `p.${i + 1}`}
                    </div>
                  </div>
                ))}
              </div>
              <figcaption className="asa-muted" style={{ fontSize: 13, marginTop: 10 }}>
                Illustration, not data: reader attention falls sharply after pages 1 and 2 of a
                Goodreads list. The author's book (red) sits far at the back.
              </figcaption>
            </figure>
            <ol>
              <li>
                <b>Teach the platform.</b> "Goodreads is where serious readers go to choose their
                next book. They read what other readers thought, save the books that catch their
                eye, and click straight through to Amazon to buy."
              </li>
              <li>
                <b>Show where they stand.</b> List the matching lists with links, and say plainly:
                last page, or missing.
              </li>
              <li>
                <b>Name the competitors.</b> Screenshots, and "The difference is not the story. It
                is that their books are in front of readers and yours is not yet."
              </li>
              <li>
                <b>Make the loss real.</b> "Every day the book stays at the back, the readers most
                ready for it pick up someone else's book instead."
              </li>
              <li>
                <b>Ask with posture.</b> "Are you open to letting me put your story in front of the
                readers who are already looking for it? If yes, just reply and I will start."
              </li>
            </ol>
            <div className="asa-callout">
              <strong>After the yes</strong>
              Put scope, timeline, report and payment terms in writing before any work starts.
            </div>
          </Chapter>

          <Chapter id="ch9" n={9} title="Integrity rules">
            <div className="asa-grid-2">
              <div className="asa-card">
                <h3 style={{ marginTop: 0, color: "var(--asa-good)" }}>Always</h3>
                <ul>
                  <li>Real reader promotion reaching real people</li>
                  <li>Real testimonials, screenshots and results</li>
                  <li>Say what you will do, then show before and after</li>
                  <li>Respect a firm no and a human moment</li>
                </ul>
              </div>
              <div className="asa-card">
                <h3 style={{ marginTop: 0, color: "var(--asa-bad)" }}>Never</h3>
                <ul>
                  <li>Bought, swapped or arranged votes or reviews</li>
                  <li>Invented results, fake urgency or fake scarcity</li>
                  <li>Price before the author agrees</li>
                  <li>Following up after someone shares a loss</li>
                </ul>
              </div>
            </div>
            <div className="asa-callout">
              <strong>A lesson we learned</strong>A client once saw list positions jump with
              identical vote patterns and called the work a scam. If a result cannot survive the
              author looking closely, do not deliver it.
            </div>
          </Chapter>

          <Chapter id="ch10" n={10} title="Your daily scorecard">
            <DailyScorecard compact />
            <p>
              Log every reply as one of the five types from chapter six and note which line you
              used. Review every Friday.
            </p>
            <div className="asa-banner">
              <h3>Now practise it</h3>
              <button type="button" className="asa-btn" onClick={onPractice}>
                Open the practice room
              </button>
            </div>
          </Chapter>
        </div>
      </div>
    </div>
  );
}
