import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import multer from "multer";
import sharp from "sharp";

const DATA_FILE = path.resolve("family_data.json");
const UPLOADS_DIR = path.resolve("uploads");
const COMPRESSED_DIR = path.resolve("uploads/compressed");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(COMPRESSED_DIR)) {
  fs.mkdirSync(COMPRESSED_DIR);
}

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

const defaultData = {
  id: "root",
  name: "KH. Zaenal Muhsin",
  type: "ancestor",
  isDeceased: true,
  photoUrl: "https://lh3.googleusercontent.com/d/15TfcjtaeYljgW_HAmrimxbUhH9QjWA7Y",
  birthDate: "1890-01-01",
  deathDate: "1969-12-27",
  address: "Garut, Jawa Barat",
  children: [
    {
      id: "w1",
      name: "SITI ATIKAH",
      type: "wife1",
      children: [
        { 
          id: "c1-1", 
          name: "KH. A. Wahab Muhsin", 
          type: "child", 
          children: [
            { id: "g1-1-1", name: "Cucu Pertama (Contoh)", type: "descendant", children: [] }
          ] 
        },
        { id: "c1-2", name: "K. Ambari Muhsin", type: "child", children: [] },
        { id: "c1-3", name: "Rukoyah", type: "child", children: [] },
        { id: "c1-4", name: "KH. Muhammad Fuad Muhsin", type: "child", children: [] },
        { id: "c1-5", name: "Maesaroh", type: "child", children: [] },
        { id: "c1-6", name: "Rumaya", type: "child", children: [] },
        { id: "c1-7", name: "KH. Muhammad Syihabuddin Muhsin", type: "child", children: [] }
      ]
    },
    {
      id: "w2",
      name: "ENCAH",
      type: "wife2",
      children: [
        { id: "c2-1", name: "Bapa Entoh (alm)", type: "child", children: [] },
        { id: "c2-2", name: "Siti Saadah", type: "child", children: [] },
        { id: "c2-3", name: "Siti Maryam", type: "child", children: [] }
      ]
    }
  ]
};

const defaultHistory = `Bani Muhsin bukan sekadar nama yang tersusun dari garis keturunan, melainkan sebuah ikatan ruhani yang ditenun oleh waktu, doa, dan perjuangan. Ia adalah jejak cinta yang diwariskan dari generasi ke generasi, mengalir dalam darah, hidup dalam akhlak, dan tumbuh dalam kebersamaan.

Di dalam Bani Muhsin, kita belajar bahwa keluarga bukan hanya tentang siapa yang dilahirkan dari siapa, tetapi tentang siapa yang tetap saling menjaga dalam suka maupun duka. Sebab sejatinya, nasab menyatukan kita dalam asal, namun silaturahmi menyatukan kita dalam tujuan.

Bani Muhsin adalah rumah—tempat kembali ketika lelah, tempat berbagi ketika bahagia, dan tempat menguatkan ketika rapuh. Di dalamnya ada doa-doa orang tua yang tak pernah putus, ada nilai-nilai luhur yang tak lekang oleh zaman, dan ada harapan yang terus tumbuh dalam setiap generasi.

Seperti akar yang menghunjam dalam tanah, Bani Muhsin berdiri kokoh karena persatuan. Dan seperti ranting yang menjulang ke langit, ia terus berkembang membawa cita-cita dan keberkahan.

Maka menjaga Bani Muhsin bukan hanya tentang mengingat nama-nama leluhur, tetapi tentang merawat cinta, menghormati sejarah, dan meneruskan kebaikan.

Karena pada akhirnya,
Bani Muhsin adalah tentang kita—yang dipersatukan oleh takdir, dan dipertahankan oleh hati.`;

// Load or initialize data
let store = {
  family: defaultData,
  history: defaultHistory,
  news: [
    {
      id: "n1",
      title: "Reuni Akbar Bani Muhsin 2026",
      content: "Akan dilaksanakan silaturahmi akbar seluruh keturunan KH. Zaenal Muhsin pada bulan Syawal mendatang.",
      date: "2026-05-20",
      category: "upcoming",
      author: "Admin",
      imageUrl: "https://picsum.photos/seed/reunion/1200/800"
    },
    {
      id: "n2",
      title: "Pembangunan Mushola Keluarga",
      content: "Alhamdulillah pembangunan mushola keluarga di area pemakaman telah selesai dilaksanakan.",
      date: "2026-01-15",
      category: "past",
      author: "Admin",
      imageUrl: "https://picsum.photos/seed/mosque/1200/800"
    }
  ] as any[],
  lastUpdate: new Date().toISOString(),
  users: [] as any[],
  auditLog: [] as any[]
};

if (fs.existsSync(DATA_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    store = { ...store, ...saved };
  } catch (err) {
    console.error("Failed to load data file, using defaults");
  }
} else {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

const saveData = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error("Failed to save data file:", err);
  }
};

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use("/uploads", express.static(UPLOADS_DIR));

  // API Routes
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    try {
      const compressedFilename = `compressed-${req.file.filename.split('.')[0]}.webp`;
      const compressedPath = path.join(COMPRESSED_DIR, compressedFilename);
      
      await sharp(req.file.path)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(compressedPath);
        
      // Optionally remove the original file to save space
      // fs.unlinkSync(req.file.path);
      
      const fileUrl = `/uploads/compressed/${compressedFilename}`;
      res.json({ success: true, url: fileUrl });
    } catch (err) {
      console.error("Compression error:", err);
      // Fallback to original if compression fails
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ success: true, url: fileUrl });
    }
  });

  app.get("/api/family", (req, res) => {
    res.json(store.family);
  });

  app.post("/api/family", (req, res) => {
    try {
      const { data, userEmail } = req.body;
      store.family = data;
      store.lastUpdate = new Date().toISOString();
      
      // Add audit log
      store.auditLog.push({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        userEmail: userEmail || "Anonymous",
        action: "UPDATE_FAMILY",
        details: "Updated family tree structure"
      });

      saveData();
      res.json({ success: true, lastUpdate: store.lastUpdate });
    } catch (err) {
      res.status(500).json({ error: "Failed to save family data" });
    }
  });

  app.get("/api/news", (req, res) => {
    res.json(store.news || []);
  });

  app.post("/api/news", (req, res) => {
    try {
      const { news, userEmail } = req.body;
      store.news = news;
      
      // Add audit log
      store.auditLog.push({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        userEmail: userEmail || "Anonymous",
        action: "UPDATE_NEWS",
        details: "Updated news items"
      });

      saveData();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save news" });
    }
  });

  app.get("/api/last-update", (req, res) => {
    res.json({ lastUpdate: store.lastUpdate });
  });

  app.get("/api/history", (req, res) => {
    res.json({ history: store.history });
  });

  app.post("/api/history", (req, res) => {
    try {
      const { history, userEmail } = req.body;
      store.history = history;
      
      // Add audit log
      store.auditLog.push({
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        userEmail: userEmail || "Anonymous",
        action: "UPDATE_HISTORY",
        details: "Updated family history"
      });

      saveData();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to save history" });
    }
  });

  // Simple Auth Endpoints
  app.post("/api/auth/register", (req, res) => {
    const { email, name, password } = req.body;
    if (store.users.find(u => u.email === email)) {
      return res.status(400).json({ error: "User already exists" });
    }
    const newUser = { id: Math.random().toString(36).substr(2, 9), email, name, password };
    store.users.push(newUser);
    saveData();
    res.json({ success: true, user: { id: newUser.id, email: newUser.email, name: newUser.name } });
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = store.users.find(u => u.email === email && u.password === password);
    if (user) {
      res.json({ success: true, user: { id: user.id, email: user.email, name: user.name } });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/audit-log", (req, res) => {
    res.json(store.auditLog);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
