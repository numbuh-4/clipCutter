const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "supersecretkey";
const app = express();

// 🧠 Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/clipcutter", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// 👥 Models
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

const clipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  filename: { type: String, required: true },
  title: { type: String },
  sourceUrl: { type: String },
  sourcePlatform: { type: String, default: "YouTube" },
  duration: { type: String },
  fileSize: { type: String },
  format: { type: String, default: "MP4" },
  createdAt: { type: Date, default: Date.now },
});
const Clip = mongoose.model("Clip", clipSchema);

// 🔧 Middleware
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json());
app.use("/downloads", express.static(path.join(__dirname, "downloads")));

app.get("/", (req, res) => {
  res.send("📡 ClipCutter backend is running!");
});

// 🔐 JWT Auth Middleware
function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access denied. No token." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token." });
    req.user = user;
    next();
  });
}

// 📦 Get Clips
app.get("/api/clips", authenticateToken, async (req, res) => {
  try {
    const clips = await Clip.find({ userId: req.user.userId }).sort({
      createdAt: -1,
    });
    res.json({ clips });
  } catch (error) {
    console.error("❌ Error fetching clips:", error);
    res.status(500).json({ error: "Failed to fetch clips." });
  }
});

// 🎬 Download & Trim
app.post("/api/download", authenticateToken, (req, res) => {
  const { youtubeLink, startTime, endTime } = req.body;
  const outputDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const timestamp = Date.now();
  const fullVideoPath = path.join(outputDir, `output-${timestamp}.mp4`);
  const snippetPath = path.join(outputDir, `snippet-${timestamp}.mp4`);

  const downloadCommand = `yt-dlp -N 8 -f bestvideo+bestaudio --merge-output-format mp4 -o "${fullVideoPath}" ${youtubeLink}`;
  exec(downloadCommand, (error) => {
    if (error) {
      console.error("❌ Download failed:", error);
      return res.status(500).json({ error: "Failed to download video." });
    }

    const trimCommand = `ffmpeg -i "${fullVideoPath}" -ss ${startTime} -to ${endTime} -c:v libx264 -c:a aac "${snippetPath}"`;
    exec(trimCommand, async (trimError) => {
      if (trimError) {
        console.error("❌ Trim failed:", trimError);
        return res.status(500).json({ error: "Failed to trim video." });
      }

      try {
        const stats = fs.statSync(snippetPath);
        const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(1);

        const clip = new Clip({
          userId: req.user.userId,
          filename: path.basename(snippetPath),
          title: `Clip from ${youtubeLink}`,
          sourceUrl: youtubeLink,
          duration: `${startTime}–${endTime}`,
          fileSize: fileSizeInMB,
        });

        await clip.save();
        fs.unlink(fullVideoPath, () => {});
        res.json({
          message: "Snippet saved successfully",
          snippetFile: path.basename(snippetPath),
        });
      } catch (saveError) {
        console.error("❌ Save failed:", saveError);
        res.status(500).json({ error: "Failed to save clip." });
      }
    });
  });
});

// 🧾 Signup
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  console.log("📨 Signup attempt:", username);

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required." });
  }

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ error: "Username already taken." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    res.json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("❌ Signup error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 🔐 Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("🔑 Login attempt:", username);

  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: "Invalid credentials." });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token, message: "Login successful!" });
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// 🚀 Start Server
const PORT = 4000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
