import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, ArrowUpRight, CircleCheck, ImageUp } from "lucide-react";
import { initials } from "@/lib/experts";

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
};

export function ExpertProfileEditor() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [photo, setPhoto] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "photo">("");

  useEffect(() => {
    fetch("/api/expert/profile")
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load your profile.");
        setProfile(data.profile);
        setPhoto(data.profile.photo_url ?? "");
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load your profile."),
      );
  }, []);

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
          is_public: form.get("is_public") === "on",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save your profile.");
      setProfile(data.profile);
      setNotice(
        data.profile.is_public
          ? "Profile saved and published."
          : "Profile saved. It stays private until you choose to show it publicly.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
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
            {error}
          </div>
        ) : (
          <div className="admin-empty" role="status">
            Loading your profile…
          </div>
        )}
      </section>
    );

  return (
    <section className="admin-content-panel">
      <div className="admin-panel-heading" style={{ padding: "0 0 1.5rem" }}>
        <div>
          <h2>Your public profile</h2>
          <p>Shown at /experts/{profile.slug} when you choose to publish it.</p>
        </div>
        {profile.is_public && (
          <a
            className="admin-button"
            href={`/experts/${profile.slug}`}
            target="_blank"
            rel="noreferrer"
          >
            View public page <ArrowUpRight size={15} />
          </a>
        )}
      </div>
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
      <form className="admin-invoice-form" onSubmit={save}>
        <div className="admin-setup" style={{ marginBottom: 0 }}>
          {photo ? (
            <img
              src={photo}
              alt=""
              style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }}
            />
          ) : (
            <span className="admin-action-icon" style={{ width: 64, height: 64, fontWeight: 700 }}>
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
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            type="checkbox"
            name="is_public"
            defaultChecked={profile.is_public}
            style={{ width: 16, height: 16 }}
          />
          Show my profile publicly on the HQ360 experts page
        </label>
        <div>
          <button className="admin-button admin-button-primary" disabled={!!busy}>
            {busy === "save" ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>
    </section>
  );
}
