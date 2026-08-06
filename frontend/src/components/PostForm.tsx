import { FormEvent, useMemo, useState } from "react";
import { detectPlatform } from "../lib/platformDetect";
import { LanguageOption } from "../lib/types";
import { PostPayload } from "../lib/api";

interface Props {
  languages: LanguageOption[];
  onSubmit: (payload: PostPayload) => Promise<void>;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function PostForm({ languages, onSubmit }: Props) {
  const [link, setLink] = useState("");
  const [date, setDate] = useState(todayIso());
  const [language, setLanguage] = useState("");
  const [isVideo, setIsVideo] = useState(false);
  const [likes, setLikes] = useState("0");
  const [comments, setComments] = useState("0");
  const [shares, setShares] = useState("0");
  const [videoViews, setVideoViews] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detected = useMemo(() => (link.trim() ? detectPlatform(link.trim()) : null), [link]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!link.trim()) {
      setError("Please paste a post link.");
      return;
    }
    if (!detected) {
      setError(
        "Couldn't recognize that link's platform. Supported: X, Facebook, WhatsApp, Instagram, LinkedIn, Threads, TikTok, VK, Weibo, Bilibili, Kuaishou, WeChat."
      );
      return;
    }
    if (!language) {
      setError("Please select a language.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        link: link.trim(),
        date,
        language,
        isVideo,
        likes: Number(likes) || 0,
        comments: Number(comments) || 0,
        shares: Number(shares) || 0,
        totalVideoViews: isVideo ? Number(videoViews) || 0 : null,
      });
      setLink("");
      setDate(todayIso());
      setLanguage("");
      setIsVideo(false);
      setLikes("0");
      setComments("0");
      setShares("0");
      setVideoViews("0");
    } catch (err: any) {
      setError(err.message || "Failed to add post.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="post-form" onSubmit={handleSubmit}>
      <div className="field field-link">
        <label htmlFor="link">Post link</label>
        <input
          id="link"
          type="url"
          placeholder="Paste a link to the social media post…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          required
        />
        {link.trim() && (
          <span className={`platform-badge ${detected ? "detected" : "unknown"}`}>
            {detected ? detected : "Unrecognized platform"}
          </span>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="date">Date posted</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div className="field">
          <label htmlFor="language">Language</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)} required>
            <option value="" disabled>
              Select…
            </option>
            {languages.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code} — {l.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field field-checkbox">
          <label htmlFor="isVideo">
            <input
              id="isVideo"
              type="checkbox"
              checked={isVideo}
              onChange={(e) => setIsVideo(e.target.checked)}
            />
            This is a video post
          </label>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="likes">Likes / reactions</label>
          <input id="likes" type="number" min={0} value={likes} onChange={(e) => setLikes(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="comments">Comments</label>
          <input
            id="comments"
            type="number"
            min={0}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="shares">Shares / reposts</label>
          <input id="shares" type="number" min={0} value={shares} onChange={(e) => setShares(e.target.value)} />
        </div>
        {isVideo && (
          <div className="field">
            <label htmlFor="videoViews">Video views</label>
            <input
              id="videoViews"
              type="number"
              min={0}
              value={videoViews}
              onChange={(e) => setVideoViews(e.target.value)}
            />
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}

      <button type="submit" disabled={submitting}>
        {submitting ? "Adding…" : "Add post"}
      </button>
      <p className="form-hint">
        Stats aren't auto-fetched yet for any platform (no API credentials configured) — enter starting
        numbers now, and update them later with Refresh.
      </p>
    </form>
  );
}
