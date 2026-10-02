import { GlassLoading } from "@/components/ui/glass-loading";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, CircleCheck, ImageUp, Send } from "lucide-react";
import { initials } from "@/lib/experts";

type ProfileStatus = "draft" | "submitted" | "approved" | "changes_requested";

type Profile = {
  email: string;
  slug: string;
  full_name: string | null;
  headline: string | null;
  bio: string | null;
  photo_url: string | null;
  specialties: string[] | null;
  location: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  is_public: boolean;
  profile_status: ProfileStatus;
  profile_review_note: string | null;
};

function ReviewStatus({ profile }: { profile: Profile }) {
  if (profile.is_public)
    return (
      <div className="admin-notice" role="status">
        <CircleCheck size={18} />
        Live on your public profile.
      </div>
    );
  if (profile.profile_status === "submitted")
    return (
      <div className="admin-notice" role="status">
        Submitted — waiting on admin review. You can keep editing while you wait.
      </div>
    );
  if (profile.profile_status === "changes_requested")
    return (
      <div className="admin-alert" role="alert">
        <AlertCircle size={18} />
        Admin requested changes
        {profile.profile_review_note ? `: "${profile.profile_review_note}"` : "."} Update your
        profile and submit again.
      </div>
    );
  return (
    <div className="admin-alert" role="status">
      <AlertCircle size={18} />
      Not submitted yet. Fill in your profile, then submit it for admin review to go live.
    </div>
  );
}

export function ExpertProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "photo" | "submit">("");

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/expert/profile", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load your profile.");
        if (controller.signal.aborted) return;
        setProfile(data.profile);
        setPhoto(data.profile.photo_url ?? "");
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Could not load your profile.");
      });
    return () => controller.abort();
  }, [loadAttempt]);

  async function uploadPhoto(file: File) {
    setBusy("photo");
    setError("");
    try {
      const response = await fetch("/api/expert/photo-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not upload your photo.");
      const put = await fetch(data.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type, "x-upsert": "false" },
        body: file,
      });
      if (!put.ok) throw new Error("Could not upload your photo.");
      setPhoto(data.publicUrl);
      setDirty(true);
      setNotice("Photo uploaded. Save your profile to publish it.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your photo.");
    } finally {
      setBusy("");
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/expert/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          full_name: form.get("full_name"),
          headline: form.get("headline"),
          bio: form.get("bio"),
          location: form.get("location"),
          specialties: String(form.get("specialties") || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          website_url: form.get("website_url"),
          linkedin_url: form.get("linkedin_url"),
          photo_url: photo,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save your profile.");
      setProfile(data.profile);
      setDirty(false);
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setBusy("");
    }
  }

  async function submitForReview() {
    setBusy("submit");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/expert/profile-submit", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not submit your profile.");
      setProfile(data.profile);
      setNotice("Submitted for admin review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your profile.");
    } finally {
      setBusy("");
    }
  }

  if (!profile)
    return (
      <section className="admin-panel">
        {error ? (
          <div className="admin-alert" role="alert">
            <AlertCircle size={18} />
            {error}{" "}
            <button className="admin-button" onClick={() => setLoadAttempt((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : (
          <GlassLoading label="Loading your expert profile…" cards />
        )}
      </section>
    );

  const checklist = [
    { label: "Profile photo", complete: Boolean(photo) },
    { label: "Name & headline", complete: Boolean(profile.full_name && profile.headline) },
    { label: "Your story", complete: Boolean(profile.bio) },
    { label: "Specialties", complete: Boolean(profile.specialties?.length) },
    { label: "Location", complete: Boolean(profile.location) },
    {
      label: "Website or LinkedIn",
      complete: Boolean(profile.website_url || profile.linkedin_url),
    },
  ];
  const completed = checklist.filter((item) => item.complete).length;
  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-border bg-secondary/40 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">
          Your expert identity
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl">Make your expertise stand out.</h1>
            <p className="mt-3 max-w-xl text-sm text-muted-foreground">
              Tell clients who you help, show what you do best, and bring your work together in one
              profile.
            </p>
          </div>
          {profile.is_public && (
            <a
              className="admin-button"
              href={`/experts/${profile.slug}`}
              target="_blank"
              rel="noreferrer"
            >
              View public profile <ArrowUpRight size={15} />
            </a>
          )}
        </div>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-5 xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="h-20 bg-gradient-to-br from-primary/10 via-secondary to-brand/10" />
            <div className="px-5 pb-5">
              <div className="-mt-9 mb-4 flex size-20 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-secondary text-2xl font-semibold">
                {photo ? (
                  <img src={photo} alt="Your profile" className="size-full object-cover" />
                ) : (
                  initials(profile.full_name || profile.email)
                )}
              </div>
              <h2 className="text-xl font-semibold">{profile.full_name || "Your name"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {profile.headline || "Add a headline that describes your expertise"}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                {profile.location || "Add your location"}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.specialties?.map((item) => (
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs" key={item}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex justify-between text-sm font-semibold">
              <span>Profile completeness</span>
              <span>
                {completed}/{checklist.length}
              </span>
            </div>
            <progress
              aria-label="Saved profile completeness"
              className="mt-3 h-1.5 w-full accent-primary"
              value={completed}
              max={checklist.length}
            />
            <ul className="mt-4 space-y-3">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-xs">
                  <CircleCheck
                    className={
                      item.complete ? "size-4 text-brand" : "size-4 text-muted-foreground/40"
                    }
                  />
                  <span>{item.label}</span>
                  <span className="sr-only">{item.complete ? "Complete" : "Not added"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Updates after you save your profile.
            </p>
          </div>
          <nav aria-label="Profile sections" className="flex flex-wrap gap-3 text-sm">
            <a href="#expert-details" className="underline underline-offset-4">
              Profile details
            </a>
            <a href="#portfolio" className="underline underline-offset-4">
              Portfolio
            </a>
          </nav>
        </aside>
        <div className="min-w-0 space-y-5">
          <ReviewStatus profile={profile} />
          {error && (
            <div className="admin-alert" role="alert">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          {notice && (
            <div className="admin-notice" role="status">
              <CircleCheck size={18} />
              {notice}
            </div>
          )}
          <form
            id="expert-details"
            className="admin-invoice-form rounded-2xl border border-border bg-card p-5 sm:p-7"
            onSubmit={save}
            onChange={() => setDirty(true)}
          >
            <div>
              <p className="text-xs uppercase tracking-widest text-brand">01 · Introduction</p>
              <h2 className="mt-2 text-xl font-semibold">Profile details</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                A clear introduction helps the right clients find you.
              </p>
            </div>
            <fieldset disabled={Boolean(busy)} className="min-w-0 space-y-6 border-0 p-0">
              <div className="admin-setup" style={{ marginBottom: 0 }}>
                {photo ? (
                  <img
                    src={photo}
                    alt=""
                    style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }}
                  />
                ) : (
                  <span
                    className="admin-action-icon"
                    style={{ width: 64, height: 64, fontWeight: 700 }}
                  >
                    {initials(profile.full_name || profile.email)}
                  </span>
                )}
                <div>
                  <strong>Profile photo</strong>
                  <p>A clear, well-lit portrait works best. PNG, JPG or WebP.</p>
                </div>
                <label className="admin-button" style={{ cursor: "pointer" }}>
                  <ImageUp size={15} />
                  {busy === "photo" ? "Uploading…" : photo ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={!!busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadPhoto(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="admin-form-grid">
                <label>
                  Full name
                  <input
                    name="full_name"
                    required
                    minLength={2}
                    maxLength={150}
                    defaultValue={profile.full_name ?? ""}
                  />
                </label>
                <label>
                  Headline
                  <input
                    name="headline"
                    maxLength={160}
                    placeholder="e.g. Book editor & publishing consultant"
                    defaultValue={profile.headline ?? ""}
                  />
                </label>
                <label>
                  Location
                  <input
                    name="location"
                    maxLength={120}
                    placeholder="City, Country"
                    defaultValue={profile.location ?? ""}
                  />
                </label>
                <label>
                  Specialties (comma separated)
                  <input
                    name="specialties"
                    placeholder="Editing, Formatting, Book marketing"
                    defaultValue={(profile.specialties ?? []).join(", ")}
                  />
                </label>
                <label>
                  Website
                  <input
                    name="website_url"
                    type="url"
                    placeholder="https://"
                    defaultValue={profile.website_url ?? ""}
                  />
                </label>
                <label>
                  LinkedIn
                  <input
                    name="linkedin_url"
                    type="url"
                    placeholder="https://www.linkedin.com/in/…"
                    defaultValue={profile.linkedin_url ?? ""}
                  />
                </label>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-brand">02 · Your story</p>
                <h2 className="mt-2 text-xl font-semibold">What makes your work different?</h2>
              </div>
              <label>
                About you
                <textarea
                  name="bio"
                  rows={6}
                  maxLength={4000}
                  placeholder="What you do, who you help and how you work. Separate paragraphs with a blank line."
                  defaultValue={profile.bio ?? ""}
                />
              </label>
            </fieldset>
            {busy && (
              <GlassLoading
                label={
                  busy === "photo"
                    ? "Uploading your portrait…"
                    : busy === "save"
                      ? "Saving your profile…"
                      : "Submitting for review…"
                }
              />
            )}
            <div className="admin-button-row sticky bottom-3 z-10 rounded-xl border border-border/60 bg-background/85 p-3 shadow-sm backdrop-blur-xl">
              <button className="admin-button admin-button-primary" disabled={!!busy}>
                {busy === "save" ? "Saving…" : "Save profile"}
              </button>
              {profile.profile_status !== "approved" || !profile.is_public ? (
                <button
                  type="button"
                  className="admin-button"
                  disabled={!!busy || dirty || profile.profile_status === "submitted"}
                  onClick={() => void submitForReview()}
                >
                  <Send size={14} />
                  {busy === "submit"
                    ? "Submitting…"
                    : profile.profile_status === "submitted"
                      ? "Submitted"
                      : "Submit for review"}
                </button>
              ) : null}
              {dirty && (
                <span className="text-xs text-muted-foreground" role="status">
                  Unsaved changes · Save before submitting.
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
