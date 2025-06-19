'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ✅ Dynamic import w/ explicit default extraction & forced type
const ReactPlayer = dynamic(
  () =>
    import('react-player/lazy').then(
      (mod) => mod.default as unknown as React.FC<any>
    ),
  { ssr: false }
);


export default function ClipCutter() {
  const [youtubeLink, setYoutubeLink] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const secondsToHHMMSS = (seconds: number): string => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const secs = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const handleDownload = async () => {
    const token = localStorage.getItem("token");
    if (!token) return alert("Login required");

    setLoading(true);
    try {
      const res = await fetch("http://localhost:4000/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ youtubeLink, startTime, endTime }),
      });

      const { snippetFile } = await res.json();
      const a = document.createElement("a");
      a.href = `http://localhost:4000/downloads/${snippetFile}`;
      a.download = snippetFile;
      a.click();
      setSuccessMessage("Download started!");
    } catch (error) {
      console.error("Download error:", error);
      alert("Failed to download.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto mt-10 p-4">
      <Input
        placeholder="Paste YouTube link"
        value={youtubeLink}
        onChange={(e) => setYoutubeLink(e.target.value)}
      />
      {youtubeLink && (
        <>
          <ReactPlayer
            url={youtubeLink}
            controls
            width="100%"
            height="480px"
            onProgress={(progress: { playedSeconds: number }) =>
              setCurrentTime(progress.playedSeconds)
            }
          />
          <div className="flex gap-4 mt-4">
            <Button onClick={() => setStartTime(secondsToHHMMSS(currentTime))}>
              Set Start: {startTime || "Not set"}
            </Button>
            <Button onClick={() => setEndTime(secondsToHHMMSS(currentTime))}>
              Set End: {endTime || "Not set"}
            </Button>
          </div>
          <Button
            className="mt-4"
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? "Processing..." : "Download Clip"}
          </Button>
          {successMessage && (
            <p className="text-green-600 mt-2">{successMessage}</p>
          )}
        </>
      )}
    </div>
  );
}

