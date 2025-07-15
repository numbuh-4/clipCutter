/* eslint-disable no-console */
// ClipCutter backend – resilient against SABR/DRM fallback errors + returns username on login/signup
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/* ─── Config ─── */
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/clipcutter";
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

/* ─── Express Init ─── */
const app = express();

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅  MongoDB connected"))
  .catch((err) => {
    console.error("❌  MongoDB connection error:", err);
    process.exit(1);
  });

/* ─── Mongo Schemas ─── */
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

const clipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  filename: { type: String, required: true },
  title: String,
  sourceUrl: String,
  sourcePlatform: { type: String, default: "YouTube" },
  duration: String,
  fileSize: String,
  format: { type: String, default: "MP4" },
  createdAt: { type: Date, default: Date.now },
});
const Clip = mongoose.model("Clip", clipSchema);

/* ─── Middleware ─── */
app.use(
  cors({ origin: FRONTEND_ORIGIN, credentials: true, methods: ["GET", "POST"] })
);
app.use(express.json());

const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir);
app.use("/downloads", express.static(downloadsDir));

app.get("/", (_, res) => res.send("📡 ClipCutter backend is running!"));

function authenticateToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access denied. No token." });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token." });
    req.user = user;
    next();
  });
}

/* ─── Helper: resilient yt-dlp download ─── */
const fallbackFormats = ["22", "18", "137+140", "136+140", "135+140", "best"];

function downloadWithFallback({ link, outPath, onSuccess, onError }) {
  const tryFormat = (index = 0) => {
    if (index >= fallbackFormats.length)
      return onError(new Error("No downloadable formats"));
    const fmt = fallbackFormats[index];
    const args = [
      "--no-check-certificates",
      "--user-agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "--no-playlist",
      "-f",
      fmt,
      "-o",
      outPath,
      link,
    ];
    console.log(`▶️  yt-dlp attempt with format ${fmt}`);
    const proc = spawn("yt-dlp", args);
    proc.stderr.on("data", (d) => process.stderr.write(d));
    proc.stdout.on("data", (d) => process.stdout.write(d));
    proc.on("close", (code) => {
      const ok =
        fs.existsSync(outPath) && fs.statSync(outPath).size > 10 * 1024;
      if (code === 0 && ok) return onSuccess();
      if (ok) fs.unlinkSync(outPath);
      console.warn(`⚠️  Format ${fmt} failed, trying next fallback…`);
      tryFormat(index + 1);
    });
  };
  tryFormat();
}

/* ─── Routes ─── */
app.get("/api/clips", authenticateToken, async (req, res) => {
  try {
    const clips = await Clip.find({ userId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json({ clips });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch clips." });
  }
});

app.post("/api/download", authenticateToken, (req, res) => {
  const { youtubeLink, startTime, endTime } = req.body;
  if (!youtubeLink || startTime == null || endTime == null)
    return res
      .status(400)
      .json({ error: "youtubeLink, startTime and endTime are required." });
  const ts = Date.now();
  const rawPath = path.join(downloadsDir, `raw-${ts}.mp4`);
  const clipPath = path.join(downloadsDir, `snippet-${ts}.mp4`);
  downloadWithFallback({
    link: youtubeLink,
    outPath: rawPath,
    onSuccess: () => {
      const ff = spawn("ffmpeg", [
        "-i",
        rawPath,
        "-ss",
        startTime,
        "-to",
        endTime,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        clipPath,
      ]);
      ff.stderr.on("data", (d) => process.stderr.write(d));
      ff.stdout.on("data", (d) => process.stdout.write(d));
      ff.on("close", async (code) => {
        fs.unlink(rawPath, () => {});
        if (code !== 0 || !fs.existsSync(clipPath))
          return res
            .status(500)
            .json({ error: "FFmpeg failed to trim video." });
        const { size } = fs.statSync(clipPath);
        const clip = await Clip.create({
          userId: req.user.userId,
          filename: path.basename(clipPath),
          title: `Clip from ${youtubeLink}`,
          sourceUrl: youtubeLink,
          duration: `${startTime}–${endTime}`,
          fileSize: (size / 1048576).toFixed(1),
        });
        res.json({ snippetFile: clip.filename });
      });
    },
    onError: (err) =>
      res.status(500).json({ error: "yt-dlp failed to download video." }),
  });
});

app.post("/api/download-full", authenticateToken, (req, res) => {
  const { youtubeLink } = req.body;
  if (!youtubeLink)
    return res.status(400).json({ error: "Missing video link." });
  const ts = Date.now();
  const outPath = path.join(downloadsDir, `full-${ts}.mp4`);
  downloadWithFallback({
    link: youtubeLink,
    outPath,
    onSuccess: async () => {
      try {
        const { size } = fs.statSync(outPath);
        const clip = await Clip.create({
          userId: req.user.userId,
          filename: path.basename(outPath),
          title: `Full download from ${youtubeLink}`,
          sourceUrl: youtubeLink,
          fileSize: (size / 1048576).toFixed(1),
        });
        res.json({ file: clip.filename });
      } catch (e) {
        console.error(e);
        fs.unlink(outPath, () => {});
        res.status(500).json({ error: "Failed to save full video." });
      }
    },
    onError: (err) =>
      res.status(500).json({ error: "yt-dlp failed to download full video." }),
  });
});

/* ─── Auth routes ─── */
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  try {
    if (await User.findOne({ username }))
      return res.status(400).json({ error: "Username already taken." });
    await User.create({ username, password: await bcrypt.hash(password, 10) });
    res.json({ message: "User registered successfully!", username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: "Invalid credentials." });
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token, username });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Internal server error." });
  }
});

/* ─── Go! ─── */
app.listen(PORT, () => console.log(`🚀  Server listening on port ${PORT}`));
