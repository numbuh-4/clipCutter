"use client";

import { useState, useEffect, ComponentType } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReactPlayerProps } from "react-player";

/* ─── Dynamically load react‑player only on the client ─── */
const ReactPlayer = dynamic(
  () =>
    import("react-player/lazy").then(
      (m) => m.default as unknown as ComponentType<ReactPlayerProps>
    ),
  { ssr: false }
);

/* ─── Helper utils ─── */
const extractId = (url: string): string | null => {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

const toHHMMSS = (t: number) =>
  new Date(t * 1000).toISOString().substring(11, 19);

const hhmmssToSeconds = (s: string) => {
  const [h, m, sec] = s.split(":").map(Number);
  return h * 3600 + m * 60 + sec;
};

/* ─── Main component ─── */
export default function ClipCutter() {
  /* ── State ── */
  const [link, setLink] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [trimLoading, setTrimLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string }>();

  /* ── Parse YT link ── */
  useEffect(() => {
    if (!link.trim()) {
      setVideoId(null);
      return;
    }
    const id = extractId(link);
    setVideoId(id);
    if (!id) setBanner({ type: "err", msg: "Invalid YouTube link" });
    else setBanner(undefined);
  }, [link]);

  /* ── Helper: show message & reset after 4s ── */
  const flash = (type: "ok" | "err", msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(undefined), 4000);
  };

  /* ── Trimmed clip download ── */
  const handleTrimDownload = async () => {
    if (!videoId) return flash("err", "Paste a video link");
    if (!startTime || !endTime)
      return flash("err", "Mark both start and end points");
    const token = localStorage.getItem("token");
    if (!token) return flash("err", "Please log in");

    setTrimLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          youtubeLink: `https://youtu.be/${videoId}`,
          startTime: hhmmssToSeconds(startTime),
          endTime: hhmmssToSeconds(endTime),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.snippetFile)
        throw new Error(data?.error || "Download failed");
      const a = document.createElement("a");
      a.href = `http://localhost:4000/downloads/${encodeURIComponent(
        data.snippetFile
      )}`;
      a.download = data.snippetFile;
      a.click();
      flash("ok", "Clip download started");
    } catch (err: any) {
      console.error(err);
      flash("err", err.message || "Clip download failed");
    } finally {
      setTrimLoading(false);
    }
  };

  /* ── Full‑video download ── */
  const handleFullDownload = async () => {
    if (!videoId) return flash("err", "Paste a video link");
    const token = localStorage.getItem("token");
    if (!token) return flash("err", "Please log in");

    setFullLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/download-full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ youtubeLink: `https://youtu.be/${videoId}` }),
      });

      const data = await res.json();
      if (!res.ok || !data?.file)
        throw new Error(data?.error || "Download failed");
      const a = document.createElement("a");
      a.href = `http://localhost:4000/downloads/${encodeURIComponent(
        data.file
      )}`;
      a.download = data.file;
      a.click();
      flash("ok", "Full video download started");
    } catch (err: any) {
      console.error(err);
      flash("err", err.message || "Full download failed");
    } finally {
      setFullLoading(false);
    }
  };

  /* ── Render ── */
  return (
    <div className="mx-auto mt-10 max-w-4xl space-y-4 p-4">
      <Input
        placeholder="Paste a YouTube link"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />

      {banner && (
        <p
          className={`text-sm ${
            banner.type === "ok" ? "text-green-600" : "text-red-600"
          }`}
        >
          {banner.msg}
        </p>
      )}

      {videoId && (
        <>
          {/* Player */}
          <div className="flex w-full justify-center px-4">
            <div className="relative aspect-video w-full max-w-[1920px]">
              <ReactPlayer
                url={`https://www.youtube.com/watch?v=${videoId}`}
                controls
                width="100%"
                height="100%"
                onProgress={({ playedSeconds }) =>
                  setCurrentTime(playedSeconds)
                }
                className="!absolute !left-0 !top-0"
              />
            </div>
          </div>

          {/* Markers + Full DL */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-4">
              <Button onClick={() => setStartTime(toHHMMSS(currentTime))}>
                Start {startTime && `: ${startTime}`}
              </Button>
              <Button onClick={() => setEndTime(toHHMMSS(currentTime))}>
                End {endTime && `: ${endTime}`}
              </Button>
            </div>

            <Button
              variant="outline"
              disabled={fullLoading}
              onClick={handleFullDownload}
            >
              {fullLoading ? "…" : "Download Full Video"}
            </Button>
          </div>

          {/* Clip download */}
          <Button
            className="mt-4"
            disabled={trimLoading}
            onClick={handleTrimDownload}
          >
            {trimLoading ? "Processing…" : "Download Clip"}
          </Button>
        </>
      )}
    </div>
  );
}
