import { useEffect, useMemo, useRef, useState } from "react";

export type ReelTrainer = { id: string; name: string; headline: string; photo: string | null };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Full-screen trainer draw. The server has already picked the trainer; this
 * spins fast through every trainer, slows down and lands on that one.
 */
export function TrainerReveal({
  pool,
  winner,
  onDone,
}: {
  pool: ReelTrainer[];
  winner: ReelTrainer;
  onDone: () => void;
}) {
  // Enough steps to feel like a draw, ending exactly on the winner.
  const sequence = useMemo(() => {
    const others = pool.length > 1 ? pool : [winner];
    const steps: ReelTrainer[] = [];
    for (let i = 0; i < 34; i++)
      steps.push(others[(i + Math.floor(Math.random() * 3)) % others.length]!);
    steps.push(winner);
    return steps;
  }, [pool, winner]);
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [index, setIndex] = useState(reduced ? sequence.length - 1 : 0);
  const done = index === sequence.length - 1;
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (done) {
      button.current?.focus();
      return;
    }
    // Starts at 45ms per name and eases out to about half a second.
    const delay = 45 + Math.pow(index / (sequence.length - 1), 3) * 520;
    const t = window.setTimeout(() => setIndex((i) => i + 1), delay);
    return () => window.clearTimeout(t);
  }, [index, done, sequence.length]);

  const current = sequence[index]!;
  return (
    <div
      className={`asa-reveal${done ? " done" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="asa-reveal-title"
    >
      <div className="asa-reveal-glow" aria-hidden="true" />
      <p className="asa-reveal-kicker">{done ? "Your trainer" : "Assigning your trainer"}</p>
      <div className="asa-reveal-stage" aria-hidden={!done}>
        <div className="asa-reveal-card" key={done ? "final" : index}>
          {current.photo ? (
            <img src={current.photo} alt="" className="asa-reveal-photo" />
          ) : (
            <span className="asa-reveal-photo asa-reveal-initials">{initials(current.name)}</span>
          )}
          <h2 id="asa-reveal-title" className="asa-reveal-name">
            {current.name}
          </h2>
          <p className="asa-reveal-headline">{current.headline}</p>
        </div>
      </div>
      <div className="asa-reveal-dots" aria-hidden="true">
        {pool.slice(0, 12).map((t) => (
          <i key={t.id} className={t.id === current.id ? "on" : ""} />
        ))}
      </div>
      {done ? (
        <div className="asa-reveal-after">
          <p>
            {winner.name.split(" ")[0]} will follow your practice chats, scores and coaching, and
            help you improve.
          </p>
          <button ref={button} type="button" className="asa-btn" onClick={onDone}>
            Start training
          </button>
        </div>
      ) : (
        <p className="asa-reveal-hint" role="status">
          Picking from {pool.length} trainer{pool.length === 1 ? "" : "s"}...
        </p>
      )}
    </div>
  );
}
