"use client";

import { useEffect, useState } from "react";
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

// Define Clip type
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

export default function ClipsDashboard() {
  const [clips, setClips] = useState<Clip[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    const fetchClips = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch("http://localhost:4000/api/clips", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        setClips(data.clips || []);
      } catch (error) {
        console.error("Failed to fetch clips", error);
      }
    };
    fetchClips();
  }, []);

  const filteredClips = clips.filter((clip) => {
    const titleMatch =
      clip.title?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    const descMatch =
      clip.description?.toLowerCase().includes(searchQuery.toLowerCase()) ??
      false;
    return titleMatch || descMatch;
  });

  const sortedClips = [...filteredClips].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      case "oldest":
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      case "duration":
        return (
          parseFloat(b.duration.replace(":", ".")) -
          parseFloat(a.duration.replace(":", "."))
        );
      case "size":
        return parseFloat(b.fileSize) - parseFloat(a.fileSize);
      default:
        return 0;
    }
  });

  const handleDownload = (clip: Clip) => {
    const link = document.createElement("a");
    link.href = `http://localhost:4000/downloads/${clip.filename}`;
    link.download = clip.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (clip: Clip) => {
    console.log(`Previewing clip: ${clip.title}`);
  };

  const handleOpenSource = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">My Clips</h1>
          <p className="text-muted-foreground">
            Manage and download your saved video clips
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search clips..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Filter className="h-4 w-4 mr-2" />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <p className="text-2xl font-bold">
                    {Math.floor(
                      clips.reduce((acc, clip) => {
                        if (!clip.duration) return acc;
                        const [min, sec] = clip.duration.split(":").map(Number);
                        return acc + min * 60 + sec;
                      }, 0) / 60
                    )}
                    
                  </p>
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
                  <p className="text-2xl font-bold">
                    {clips
                      .reduce((acc, clip) => acc + parseFloat(clip.fileSize), 0)
                      .toFixed(1)}{" "}
                    MB
                  </p>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedClips.map((clip) => (
            <Card
              key={clip._id}
              className="overflow-hidden hover:shadow-lg transition-shadow"
            >
              <div className="relative">
                <Image
                  src={clip.thumbnail || "/placeholder.svg"}
                  alt={clip.title}
                  width={320}
                  height={180}
                  className="w-full h-48 object-cover"
                />
                <div className="absolute bottom-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-sm">
                  {clip.duration}
                </div>
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary">{clip.sourcePlatform}</Badge>
                </div>
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg line-clamp-1">
                  {clip.title}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {clip.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(clip.createdAt).toLocaleDateString()}
                  </div>
                  <div>{clip.fileSize}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDownload(clip)}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handlePreview(clip)}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleOpenSource(clip.sourceUrl)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedClips.length === 0 && (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <Play className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No clips found</h3>
            <p className="text-muted-foreground mb-4">
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
