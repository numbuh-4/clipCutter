/* eslint-disable react/jsx-no-bind */
"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Download,
  ExternalLink,
  Play,
  Search,
  Filter,
  Calendar,
  Clock,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const extractYouTubeId = (url?: string): string | null => {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:shorts\/|embed\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{11})/
  );
  return match ? match[1] : null;
};

const timeStringToSeconds = (raw: string): number => {
  if (!raw) return NaN;
  const parts = raw
    .split(":")
    .map(Number)
    .filter((n) => !isNaN(n));
  return parts.reduce((acc, curr) => acc * 60 + curr, 0);
};

const clipDurationSeconds = (duration?: string): number => {
  if (!duration) return 0;
  const range = duration.split(/–|-/);
  if (range.length === 2) {
    const [start, end] = range.map(timeStringToSeconds);
    return Math.max(end - start, 0);
  }
  const t = timeStringToSeconds(duration);
  return isNaN(t) ? 0 : t;
};

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
interface Clip {
  _id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  duration: string;
  sourceUrl: string;
  sourcePlatform: string;
  createdAt: string;
  fileSize: string;
  format: string;
  filename: string;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function ClipsDashboard() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<
    "newest" | "oldest" | "duration" | "size"
  >("newest");

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch("http://localhost:4000/api/clips", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setClips(data.clips ?? []);
      } catch (err) {
        console.error("Failed to fetch clips:", err);
      }
    })();
  }, []);

  const filteredClips = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return clips.filter(
      ({ title = "", description = "" }) =>
        title.toLowerCase().includes(q) || description.toLowerCase().includes(q)
    );
  }, [clips, searchQuery]);

  const sortedClips = useMemo(() => {
    return [...filteredClips].sort((a, b) => {
      if (sortBy === "newest")
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sortBy === "oldest")
        return +new Date(a.createdAt) - +new Date(b.createdAt);
      if (sortBy === "duration")
        return (
          clipDurationSeconds(b.duration) - clipDurationSeconds(a.duration)
        );
      if (sortBy === "size")
        return (parseFloat(b.fileSize) || 0) - (parseFloat(a.fileSize) || 0);
      return 0;
    });
  }, [filteredClips, sortBy]);

  const totalDurationMin = useMemo(() => {
    const sec = clips.reduce(
      (acc, c) => acc + clipDurationSeconds(c.duration),
      0
    );
    return Math.floor(sec / 60);
  }, [clips]);

  const totalSize = useMemo(() => {
    return clips
      .reduce((acc, c) => acc + (parseFloat(c.fileSize) || 0), 0)
      .toFixed(1);
  }, [clips]);

  function handleDownload(clip: Clip) {
    const a = document.createElement("a");
    a.href = `http://localhost:4000/downloads/${clip.filename}`;
    a.download = clip.filename;
    a.click();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <header className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">My Clips</h1>
          <p className="text-muted-foreground">
            Manage and download your saved video clips
          </p>
        </header>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search clips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Sort by: {sortBy}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("newest")}>
                Newest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("oldest")}>
                Oldest First
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("duration")}>
                Longest Duration
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("size")}>
                Largest File Size
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Play className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{clips.length}</p>
                  <p className="text-sm text-muted-foreground">Total Clips</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalDurationMin} min</p>
                  <p className="text-sm text-muted-foreground">
                    Total Duration
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalSize} MB</p>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedClips.map((clip) => {
            const youtubeId = extractYouTubeId(clip.sourceUrl);
            const thumbnailUrl = clip.thumbnail
              ? clip.thumbnail
              : youtubeId
              ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
              : "/placeholder.svg";

            return (
              <Card
                key={clip._id}
                className="overflow-hidden transition-shadow hover:shadow-lg"
              >
                <div className="relative">
                  <Image
                    src={thumbnailUrl}
                    alt={clip.title}
                    width={320}
                    height={180}
                    className="h-48 w-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.onerror = null;
                      target.src = "/placeholder.svg";
                    }}
                  />
                  <div className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-1 text-sm text-white">
                    {clip.duration}
                  </div>
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary">{clip.sourcePlatform}</Badge>
                  </div>
                </div>

                <CardHeader className="pb-3">
                  <CardTitle className="line-clamp-1 text-lg">
                    {clip.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {clip.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="mb-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(clip.createdAt).toLocaleDateString()}
                    </div>
                    <div>{clip.fileSize} MB</div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownload(clip)}
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button variant="outline" size="icon">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(clip.sourceUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {sortedClips.length === 0 && (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-muted">
              <Play className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-lg font-semibold">No clips found</h3>
            <p className="mb-4 text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search terms"
                : "Start by adding some clips from your favorite videos"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
