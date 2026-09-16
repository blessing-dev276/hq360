import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, Square, X } from "lucide-react";

export function VoiceMessage() {
  const dialog = useRef<HTMLDialogElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sent, setSent] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!sent) return;
    closeTimer.current = setTimeout(() => dialog.current?.close(), 3500);
    return () => clearTimeout(closeTimer.current);
  }, [sent]);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    clearInterval(timer.current);
    setRecording(false);
  }
  useEffect(
    () => () => {
      clearInterval(timer.current);
      stream.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  async function record() {
    setMessage("");
    setStarting(true);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!dialog.current?.open) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ["audio/webm", "audio/mp4", "audio/ogg"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const next = new MediaRecorder(media, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64000,
      });
      recorder.current = next;
      const chunks: Blob[] = [];
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => setBlob(new Blob(chunks, { type: next.mimeType }));
      setBlob(null);
      setSeconds(0);
      setRecording(true);
      next.start();
      const started = Date.now();
      timer.current = setInterval(() => {
        const elapsed = Math.min(60, Math.floor((Date.now() - started) / 1000));
        setSeconds(elapsed);
        if (elapsed >= 60) stop();
      }, 200);
    } catch {
      stop();
      setMessage(
        "Microphone access is unavailable. Allow microphone access or use our contact page.",
      );
    } finally {
      setStarting(false);
    }
  }
  return (
    <>
      <button
        onClick={() => {
          clearTimeout(closeTimer.current);
          setSent(false);
          setMessage("");
          dialog.current?.showModal();
        }}
        className="fixed right-5 bottom-6 z-40 flex items-center gap-3 rounded-full bg-primary px-5 py-4 text-primary-foreground shadow-xl transition hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-brand"
        aria-label="Leave HQ360 a one-minute voice message"
      >
        <Mic size={22} />
        <span className="text-left text-sm font-semibold">
          Tell us your idea
          <span className="block text-xs font-normal opacity-80">A 1-minute voice message</span>
        </span>
      </button>
      <dialog
        ref={dialog}
        onCancel={stop}
        onClose={() => {
          stop();
          clearTimeout(closeTimer.current);
        }}
        aria-label={sent ? "Voice message sent" : "Send a voice message"}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-border bg-background p-7 text-foreground shadow-2xl backdrop:bg-black/50"
      >
        <button
          aria-label="Close voice message"
          onClick={() => {
            stop();
            dialog.current?.close();
          }}
          className="absolute top-4 right-4 rounded-full p-2 hover:bg-secondary"
        >
          <X size={20} />
        </button>
        {sent ? (
          <div role="status" aria-live="polite" className="py-10 text-center">
            <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-brand/10 text-brand">
              <CheckCircle2 size={42} aria-hidden="true" />
            </div>
            <h2 className="font-display text-3xl">Message sent!</h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Thanks for sharing your idea. Your message has been sent to HQ360, and our team will
              reply by email.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              This window will close automatically.
            </p>
          </div>
        ) : (
          <>
            <Mic className="mb-5 text-brand" size={32} />
            <h2 className="font-display text-2xl">What would you like to build?</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Tell us in your own words. Record up to one minute, listen back, then send your
              message to HQ360.
            </p>
            <div className="my-6 rounded-2xl bg-secondary p-5 text-center">
              <p className="mb-3 font-mono text-2xl" aria-live="off">
                0:{String(seconds).padStart(2, "0")} / 1:00
              </p>
              <button
                type="button"
                disabled={busy || starting}
                onClick={recording ? stop : record}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm text-primary-foreground disabled:opacity-50"
              >
                {recording ? <Square size={16} /> : <Mic size={16} />}
                {recording
                  ? "Stop recording"
                  : starting
                    ? "Opening microphone…"
                    : blob
                      ? "Record again"
                      : "Start recording"}
              </button>
              {url && !recording ? <audio controls src={url} className="mt-4 w-full" /> : null}
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!blob || recording || busy) return;
                const form = event.currentTarget;
                const body = new FormData(form);
                body.set(
                  "audio",
                  blob,
                  blob.type.includes("mp4")
                    ? "message.mp4"
                    : blob.type.includes("ogg")
                      ? "message.ogg"
                      : "message.webm",
                );
                setBusy(true);
                setMessage("");
                try {
                  const response = await fetch("/api/public/voice-message", {
                    method: "POST",
                    body,
                  });
                  const result = await response.json();
                  if (!response.ok || result.ok !== true)
                    throw new Error(result.error || "Unable to send.");
                  setBlob(null);
                  setSeconds(0);
                  form.reset();
                  setSent(true);
                } catch (error) {
                  setMessage(
                    error instanceof Error ? error.message : "Unable to send. Please try again.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
              className="space-y-4"
            >
              <label className="block text-sm">
                Your name
                <input
                  required
                  name="name"
                  maxLength={160}
                  autoComplete="name"
                  className="mt-1 w-full rounded-xl border border-border bg-card p-3"
                />
              </label>
              <label className="block text-sm">
                Email for our reply
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-xl border border-border bg-card p-3"
                />
              </label>
              <label className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <input required type="checkbox" name="consent" value="yes" />I agree to have this
                recording transcribed by ElevenLabs and the transcript emailed to HQ360 so you can
                respond.
              </label>
              <button
                disabled={!blob || recording || busy || starting}
                className="w-full rounded-full bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-40"
              >
                {busy ? "Transcribing & sending…" : "Send voice message"}
              </button>
              <p role="status" className="text-sm">
                {message}
              </p>
              <a href="/contact" className="block text-center text-xs text-brand underline">
                Prefer to type? Contact us
              </a>
            </form>
          </>
        )}
      </dialog>
    </>
  );
}
