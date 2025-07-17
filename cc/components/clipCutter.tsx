"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

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

export default function ClipCutter() {
  const [link, setLink] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [trimLoading, setTrimLoading] = useState(false);
  const [fullLoading, setFullLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: "ok" | "err"; msg: string }>();

  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const id = extractId(link.trim());
    setVideoId(id);
    if (link && !id) setBanner({ type: "err", msg: "Invalid YouTube link" });
    else setBanner(undefined);
  }, [link]);

  useEffect(() => {
    if (!videoId) return;

    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScript = document.getElementsByTagName("script")[0];
      firstScript?.parentNode?.insertBefore(tag, firstScript);

      window.onYouTubeIframeAPIReady = loadPlayer;
    } else {
      loadPlayer();
    }

    function loadPlayer() {
      if (playerRef.current) playerRef.current.destroy();
      playerRef.current = new window.YT.Player("yt-player", {
        videoId,
        events: {
          onReady: () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
              if (playerRef.current?.getCurrentTime) {
                setCurrentTime(Math.floor(playerRef.current.getCurrentTime()));
              }
            }, 1000);
          },
        },
      });
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (playerRef.current) playerRef.current.destroy();
    };
  }, [videoId]);

  const flash = (type: "ok" | "err", msg: string) => {
    setBanner({ type, msg });
    setTimeout(() => setBanner(undefined), 4000);
  };

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
          <div className="flex w-full justify-center px-4">
            <div className="relative aspect-video w-full max-w-[1920px]">
              <div id="yt-player" className="w-full h-full" />
            </div>
          </div>

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
