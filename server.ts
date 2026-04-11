import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, serverTimestamp } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Import the Firebase configuration
const firebaseConfig = JSON.parse(fs.readFileSync(path.resolve("firebase-applet-config.json"), "utf-8"));

// Initialize Firebase Web SDK for Server (using API Key)
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const firebaseStorage = getStorage(firebaseApp, firebaseConfig.storageBucket);

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
const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: multerStorage });

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
  app.get("/api/image/:id", async (req, res) => {
    try {
      const imageId = req.params.id;
      const docRef = doc(db, "hosted_images", imageId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return res.status(404).send("Image not found");
      }
      
      const data = docSnap.data();
      if (!data || !data.data) {
        return res.status(404).send("Image data missing");
      }
      
      const buffer = Buffer.from(data.data, 'base64');
      res.setHeader('Content-Type', data.contentType || 'image/webp');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(buffer);
    } catch (err) {
      console.error("Error serving image from Firestore:", err);
      res.status(500).send("Internal server error");
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      console.error("Upload error: No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    console.log("Processing upload for:", req.file.originalname);
    
    try {
      // 1. Read file to buffer and compress with sharp
      console.log("Compressing image with sharp...");
      const buffer = await sharp(req.file.path)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      
      console.log("Compression successful, buffer size:", buffer.length);

      // 2. Upload to Firebase Storage using Web SDK
      const safeName = req.file.originalname.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const firebaseFilename = `uploads/${Date.now()}-${safeName}.webp`;
      
      let uploadSuccess = false;
      let lastError = null;
      let finalDownloadUrl = "";

      try {
        console.log(`Attempting upload to Firebase Storage...`);
        const storageRef = ref(firebaseStorage, firebaseFilename);
        await uploadBytes(storageRef, buffer, { contentType: 'image/webp' });
        finalDownloadUrl = await getDownloadURL(storageRef);
        uploadSuccess = true;
        console.log(`Successfully uploaded to Storage`);
      } catch (err: any) {
        console.warn(`Failed to upload to Storage:`, err.message);
        lastError = err;
      }

      if (!uploadSuccess) {
        console.warn("Firebase Storage failed. Falling back to Firestore-based hosting...");
        
        // Firestore Fallback: Store image as base64 in a separate collection
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = doc(db, "hosted_images", imageId);
        
        await setDoc(docRef, {
          data: buffer.toString('base64'),
          contentType: 'image/webp',
          createdAt: serverTimestamp(),
          originalName: req.file.originalname
        });
        
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const host = req.headers.host;
        finalDownloadUrl = `${protocol}://${host}/api/image/${imageId}`;
        
        console.log(`Successfully stored in Firestore fallback: ${finalDownloadUrl}`);
        uploadSuccess = true;
      }
      
      const downloadUrl = finalDownloadUrl;
      
      // 3. Cleanup local file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
          console.log("Temporary local file deleted");
        }
      } catch (e) {
        console.warn("Failed to delete temp file:", e);
      }
      
      console.log("Upload complete! URL:", downloadUrl);
      res.json({ success: true, url: downloadUrl });
    } catch (err: any) {
      console.error("CRITICAL UPLOAD ERROR:", err);
      
      // Attempt cleanup even on failure
      try {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {}

      res.status(500).json({ 
        error: "Gagal mengunggah ke Firebase Storage", 
        details: err.message || String(err) 
      });
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
