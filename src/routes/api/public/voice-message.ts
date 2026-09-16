import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Buffer } from "node:buffer";
import { sendEmail, leadInboxAddress } from "@/lib/email.server";

const attempts = new Map<string, number>();
const json = (error: string, status: number) => Response.json({ error }, { status });

export const Route = createFileRoute("/api/public/voice-message")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("origin") !== new URL(request.url).origin)
          return json("Invalid origin", 403);
        if (
          !process.env.ELEVENLABS_API_KEY ||
          !process.env.RESEND_API_KEY ||
          process.env.EMAIL_PROVIDER !== "resend"
        )
          return json(
            "Voice messages are temporarily unavailable. Please use our contact page.",
            503,
          );
        if (Number(request.headers.get("content-length")) > 3_000_000)
          return json("Recording is too large.", 413);
        const ip = request.headers.get("x-real-ip") || "unknown";
        const now = Date.now();
        for (const [key, time] of attempts) if (now - time > 60_000) attempts.delete(key);
        if (attempts.has(ip)) return json("Please wait a minute before sending again.", 429);
        attempts.set(ip, now);
        try {
          const form = await request.formData();
          const contact = z
            .object({
              name: z.string().trim().min(1).max(160),
              email: z.string().email().max(320),
              consent: z.literal("yes"),
            })
            .safeParse(Object.fromEntries(form));
          const audio = form.get("audio");
          const audioType = audio instanceof File ? audio.type.split(";")[0].trim() : "";
          const extensions: Record<string, string> = {
            "audio/webm": "webm",
            "audio/ogg": "ogg",
            "audio/mp4": "m4a",
            "video/mp4": "mp4",
          };
          if (
            !contact.success ||
            !(audio instanceof File) ||
            !audio.size ||
            audio.size > 2_000_000 ||
            !Object.hasOwn(extensions, audioType)
          )
            return json("Please provide your name, email, consent and a short recording.", 400);
          const upload = new FormData();
          upload.set("file", audio);
          upload.set("model_id", "scribe_v2");
          const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
            body: upload,
            signal: AbortSignal.timeout(45_000),
          });
          if (!response.ok) return json("Transcription failed. Please try again shortly.", 502);
          const result = await response.json();
          if (typeof result.text !== "string" || !result.text.trim())
            return json("No speech was detected. Please record again.", 422);
          const sent = await sendEmail({
            to: leadInboxAddress(),
            replyTo: contact.data.email,
            subject: `HQ360 voice enquiry from ${contact.data.name}`,
            text: `Name: ${contact.data.name}\nEmail: ${contact.data.email}\n\nThe original voice recording is attached.\n\nVoice message (automatically transcribed):\n${result.text.slice(0, 20000)}`,
            attachments: [
              {
                filename: `hq360-voice-message.${extensions[audioType]}`,
                content: Buffer.from(await audio.arrayBuffer()).toString("base64"),
                content_type: audioType,
              },
            ],
          });
          if (!sent.sent)
            return json("Email delivery failed. Please try again or use our contact page.", 502);
          return Response.json({ ok: true });
        } catch {
          return json("We could not send your message. Please try again.", 502);
        }
      },
    },
  },
});
