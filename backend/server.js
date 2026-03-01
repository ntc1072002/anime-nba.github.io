/* ================== IMPORT ================== */
import express from 'express';
import cors from 'cors';
// import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import multer from 'multer';
// import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config();

// const require = createRequire(import.meta.url);
// lấy key từ ENV
// if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
//   throw new Error("FIREBASE_SERVICE_ACCOUNT not set in ENV");
// }

// const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// console.log("🔥 Service account loaded");
// console.log("FIREBASE_PROJECT_ID:", serviceAccount.project_id);
// console.log("FIREBASE_CLIENT_EMAIL:", serviceAccount.client_email);
// console.log("FIREBASE_PRIVATE_KEY:", serviceAccount.private_key);
// console.log("🔥 Service account details logged");
// admin.initializeApp({
//   credential: admin.credential.cert({
//     projectId: process.env.FIREBASE_PROJECT_ID,
//     clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
//     privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
//   }),
// });

// const firestore = admin.firestore();


/* ================== FIREBASE INIT ================== */
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
//   storageBucket: "web-anime-be186.appspot.com"
// });


// const firestore = admin.firestore();
// const bucket = admin.storage().bucket();

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  }),
  storageBucket: "web-anime-be186"
});
// export firestore duy nhất
const firestore = admin.firestore();
const bucket = admin.storage().bucket();
export const db = admin.firestore();
/* ================== APP INIT ================== */
/* ================== APP INIT ================== */
const app = express();

const corsOptions = {
  origin: function (origin, callback) {
    if (
      !origin ||
      origin.includes("onrender.com") ||
      origin.includes("localhost")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());
// routes phía dưới
// app.use("/api", apiRoutes);

const upload = multer({ storage: multer.memoryStorage() });
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';

// ===== HEALTH CHECK =====
app.get("/", (req, res) => {
  res.json({ status: "OK", server: "Firebase Backend Running" });
});

// ===== GET ANIME =====
app.get("/api/anime", async (req, res) => {
  try {
    const snapshot = await firestore.collection('anime').get();
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (err) {
    console.log("🔥 FIRESTORE ERROR START");
    console.log(err);
    console.log(err.message);
    console.log(err.stack);
    console.log("🔥 FIRESTORE ERROR END");

    console.error("🔥 /api/anime error:", err);
    res.status(500).json({ error: "Failed to fetch anime : " + err.message });
  }
});

// GET single anime
app.get("/api/anime/:id", async (req, res) => {
  try {
    const doc = await firestore.collection('anime').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error("GET /api/anime/:id error:", err);
    res.status(500).json({ error: "Failed to fetch anime" });
  }
});

// CREATE anime
app.post("/api/anime", authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const ref = await firestore.collection('anime').add({
      title: req.body.title,
      embed_url: req.body.embed_url || null,
      created_at: new Date()
    });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    console.error("POST /api/anime error:", err);
    res.status(500).json({ error: "Failed to create anime" });
  }
});

// UPDATE anime
app.put("/api/anime/:id", authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { title, embed_url } = req.body;
    await firestore.collection('anime').doc(req.params.id).update({
      title: title || undefined,
      embed_url: embed_url || undefined,
      updated_at: new Date()
    });
    const doc = await firestore.collection('anime').doc(req.params.id).get();
    res.json({ id: req.params.id, ...doc.data() });
  } catch (err) {
    console.error("PUT /api/anime/:id error:", err);
    res.status(500).json({ error: "Failed to update anime" });
  }
});

// DELETE anime
app.delete("/api/anime/:id", authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    // Delete all episodes first
    const episodesSnap = await firestore.collection('anime').doc(req.params.id).collection('episodes').get();
    for (const epiDoc of episodesSnap.docs) {
      await epiDoc.ref.delete();
    }
    // Delete anime
    await firestore.collection('anime').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/anime/:id error:", err);
    res.status(500).json({ error: "Failed to delete anime" });
  }
});

// // ===== GET MANGA =====
// app.get("/api/manga", async (req, res) => {
//   try {
//     const snapshot = await db.collection("manga").get();
//     const data = snapshot.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data()
//     }));
//     res.json(data);
//   } catch (err) {
//     console.error("🔥 /api/manga error:", err);
//     res.status(500).json({ error: "Failed to fetch manga" });
//   }
// });

/* ================== MIDDLEWARE ================== */
function authenticateJWT(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'invalid token' });
    }
}


async function verifyFirebaseToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'unauthorized' });
    try {
        req.user = await admin.auth().verifyIdToken(auth.slice(7));
        next();
    } catch {
        res.status(401).json({ error: 'invalid firebase token' });
    }
}


function requireRole(role) {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role)
            return res.status(403).json({ error: 'forbidden' });
        next();
    };
}

// // ===== REGISTER USER =====
// app.post("/auth/register", async (req, res) => {
//   try {
//     const { username, password } = req.body;

//     if (!username || !password) {
//       return res.status(400).json({ error: "Missing username or password" });
//     }

//     const user = await admin.auth().createUser({
//       username,
//       password
//     });

//     res.json({
//       uid: user.uid,
//       username: user.username
//     });
//   } catch (err) {
//     console.error("🔥 register error:", err);
//     res.status(400).json({ error: err.message });
//   }
// });

/* ================== AUTH LOCAL ================== */
app.post('/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password required' });
    }

    // Tạo email ảo cho Firebase Auth
    const email = `${username}@local.app`;

    // Tạo user Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: username
    });

    // Lưu profile Firestore (ROLE CỐ ĐỊNH = user)
    await firestore.collection('users').doc(userRecord.uid).set({
      username,
      role: 'user',
      provider: 'password',
      provider_id: userRecord.uid,
      created_at: new Date()
    });

    res.status(201).json({
      id: userRecord.uid,
      username,
      role: 'user'
    });

  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});



app.post('/auth/login', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'token required' });
    }

    // Verify Firebase ID Token
    const decoded = await admin.auth().verifyIdToken(token);

    // Lấy profile từ Firestore
    const userDoc = await firestore.collection('users').doc(decoded.uid).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'user not found' });
    }

    res.json({
      uid: decoded.uid,
      username: userDoc.data().username,
      role: userDoc.data().role
    });

  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'invalid token' });
  }
});



/* ================== AUTH GOOGLE / FACEBOOK ================== */
app.post('/auth/firebase', verifyFirebaseToken, async (req, res) => {
  const { uid, email, name } = req.user;

  // Ensure user document uses Firebase UID as doc id for consistent lookup
  const userRef = firestore.collection('users').doc(uid);
  const userDoc = await userRef.get();
  if (userDoc.exists) {
    const data = userDoc.data();
    const token = jwt.sign({ id: uid, username: data.username, role: data.role }, JWT_SECRET);
    return res.json({ token });
  }

  // create profile document keyed by uid
  await userRef.set({
    username: email || name || uid,
    password_hash: null,
    role: 'user',
    provider: 'firebase',
    provider_id: uid,
    created_at: new Date()
  });

  const token = jwt.sign({ id: uid, username: email || name, role: 'user' }, JWT_SECRET);
  res.json({ token });
});


/* ================== MANGA ================== */
app.get('/api/manga', async (_, res) => {
    const snap = await firestore.collection('manga').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});


app.post('/api/manga', authenticateJWT, requireRole('admin'), async (req, res) => {
    const ref = await firestore.collection('manga').add({
        title: req.body.title,
        description: req.body.description || null,
        created_at: new Date()
    });
    res.status(201).json({ id: ref.id });
});

// UPDATE manga
app.put('/api/manga/:id', authenticateJWT, requireRole('admin'), async (req, res) => {
    try {
        const { title, description } = req.body;
        await firestore.collection('manga').doc(req.params.id).update({
            title: title || undefined,
            description: description || undefined,
            updated_at: new Date()
        });
        const doc = await firestore.collection('manga').doc(req.params.id).get();
        res.json({ id: req.params.id, ...doc.data() });
    } catch (err) {
        console.error('PUT /api/manga/:id error', err);
        res.status(500).json({ error: 'internal' });
    }
});

// DELETE manga
app.delete('/api/manga/:id', authenticateJWT, requireRole('admin'), async (req, res) => {
    try {
        // Delete all chapters and images first
        const chaptersSnap = await firestore.collection('manga').doc(req.params.id).collection('chapters').get();
        for (const chapDoc of chaptersSnap.docs) {
            await chapDoc.ref.delete();
        }
        // Delete manga
        await firestore.collection('manga').doc(req.params.id).delete();
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/manga/:id error', err);
        res.status(500).json({ error: 'internal' });
    }
});

/* ================== CHAPTERS ================== */
app.get('/api/manga/:id/chapters', async (req, res) => {
    const snap = await firestore
        .collection('manga')
        .doc(req.params.id)
        .collection('chapters')
        .orderBy('number')
        .get();


    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
});


app.post('/api/manga/:id/chapters', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    console.log('POST /api/manga/:id/chapters body:', JSON.stringify(req.body).slice(0,2000));
    // accept images array from client when creating a chapter
    let incoming = [];
    if (Array.isArray(req.body.images) && req.body.images.length) {
      incoming = req.body.images.map((it, idx) => {
        if (typeof it === 'string') return { order: idx + 1, url: it };
        return { order: Number(it.order) || idx + 1, url: it.url || null };
      }).filter(x => x && x.url);
    }

    const chaptersRef = firestore.collection('manga').doc(req.params.id).collection('chapters');

    // if a chapter with the same number already exists, append incoming data to it
    if (req.body.number != null) {
      const q = await chaptersRef.where('number', '==', Number(req.body.number)).limit(1).get();
      if (!q.empty) {
        const doc = q.docs[0];
        const data = doc.data() || {};
        const existing = Array.isArray(data.images) ? data.images.slice() : [];

        // determine starting order for appended images
        const maxOrder = existing.reduce((m, x) => Math.max(m, Number(x.order) || 0), 0);
        const appended = incoming.map((it, idx) => ({ order: maxOrder + idx + 1, url: it.url }));

        const newImages = existing.concat(appended);

        // update title if provided
        const newTitle = req.body.title || data.title || null;

        await chaptersRef.doc(doc.id).update({
          images: newImages,
          title: newTitle,
          updated_at: new Date()
        });

        return res.status(200).json({ id: doc.id, merged: true });
      }
    }

    // otherwise create a new chapter document
    const ref = await chaptersRef.add({
      number: req.body.number,
      title: req.body.title || null,
      images: incoming,
      created_at: new Date()
    });

    res.status(201).json({ id: ref.id });
  } catch (err) {
    console.error('POST /api/manga/:id/chapters error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// UPDATE chapter
app.put('/api/manga/:id/chapters/:cid', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { number, title, images } = req.body;
    await firestore
      .collection('manga')
      .doc(req.params.id)
      .collection('chapters')
      .doc(req.params.cid)
      .update({
        number: number || undefined,
        title: title || undefined,
        images: images || undefined,
        updated_at: new Date()
      });
    const doc = await firestore
      .collection('manga')
      .doc(req.params.id)
      .collection('chapters')
      .doc(req.params.cid)
      .get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('PUT /api/manga/:id/chapters/:cid error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// DELETE chapter
app.delete('/api/manga/:id/chapters/:cid', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    await firestore
      .collection('manga')
      .doc(req.params.id)
      .collection('chapters')
      .doc(req.params.cid)
      .delete();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/manga/:id/chapters/:cid error', err);
    res.status(500).json({ error: 'internal' });
  }
});


// GET single manga
app.get('/api/manga/:id', async (req, res) => {
  try {
    const doc = await firestore.collection('manga').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('GET /api/manga/:id error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET single chapter
app.get('/api/manga/:id/chapters/:cid', async (req, res) => {
  try {
    const doc = await firestore
      .collection('manga')
      .doc(req.params.id)
      .collection('chapters')
      .doc(req.params.cid)
      .get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('GET /api/manga/:id/chapters/:cid error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// LIST chapters for a manga (already exists earlier but ensure route)
app.get('/api/manga/:id/chapters', async (req, res) => {
  try {
    const snap = await firestore
      .collection('manga')
      .doc(req.params.id)
      .collection('chapters')
      .orderBy('number')
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('GET /api/manga/:id/chapters error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Episodes: list and single
app.get('/api/anime/:id/episodes', async (req, res) => {
  try {
    const snap = await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .orderBy('number')
      .get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.error('GET /api/anime/:id/episodes error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.get('/api/anime/:id/episodes/:eid', async (req, res) => {
  try {
    const doc = await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .doc(req.params.eid)
      .get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('GET /api/anime/:id/episodes/:eid error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Current user profile, follows and likes
app.get('/api/me', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const userDoc = await firestore.collection('users').doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'not found' });
    const user = { id: userDoc.id, ...userDoc.data() };

    const followsSnap = await firestore.collection('follows').where('user_id', '==', uid).get();
    const likesSnap = await firestore.collection('likes').where('user_id', '==', uid).get();

    const follows = followsSnap.docs.map(d => d.data());
    const likes = likesSnap.docs.map(d => d.data());

    res.json({ user, follows, likes });
  } catch (err) {
    console.error('GET /api/me error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/api/me/follow', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const { type, targetId } = req.body;
    if (!type || !targetId) return res.status(400).json({ error: 'type and targetId required' });

    const q = await firestore.collection('follows')
      .where('user_id', '==', uid)
      .where('type', '==', type)
      .where('target_id', '==', String(targetId))
      .limit(1)
      .get();

    if (!q.empty) {
      // remove follow
      await firestore.collection('follows').doc(q.docs[0].id).delete();
      return res.json({ following: false });
    }

    await firestore.collection('follows').add({ user_id: uid, type, target_id: String(targetId), created_at: new Date() });
    res.json({ following: true });
  } catch (err) {
    console.error('POST /api/me/follow error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/api/me/like', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const { type, targetId } = req.body;
    if (!type || !targetId) return res.status(400).json({ error: 'type and targetId required' });

    const q = await firestore.collection('likes')
      .where('user_id', '==', uid)
      .where('type', '==', type)
      .where('target_id', '==', String(targetId))
      .limit(1)
      .get();

    if (!q.empty) {
      await firestore.collection('likes').doc(q.docs[0].id).delete();
      return res.json({ liked: false });
    }

    await firestore.collection('likes').add({ user_id: uid, type, target_id: String(targetId), created_at: new Date() });
    res.json({ liked: true });
  } catch (err) {
    console.error('POST /api/me/like error', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ================== UPLOAD ẢNH ================== */
app.post(
    '/api/manga/:id/chapters/:cid/upload',
    authenticateJWT,
    requireRole('admin'),
    upload.array('images'),
    async (req, res) => {
        const urls = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = bucket.file(`manga/${req.params.id}/chapters/${req.params.cid}/${i + 1}.jpg`);
            await file.save(req.files[i].buffer, { contentType: req.files[i].mimetype });
            await file.makePublic();
            urls.push({ order: i + 1, url: file.publicUrl() });
        }


        await firestore
            .collection('manga')
            .doc(req.params.id)
            .collection('chapters')
            .doc(req.params.cid)
            .update({ images: urls });


        res.json({ images: urls });
    }
);

  import FormData from "form-data";
  import axios from "axios";
  // Upload cover image for manga to Imgbb
  app.post('/api/manga/:id/cover', authenticateJWT, requireRole('admin'), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'image required' });
      if (!process.env.IMGBB_API_KEY) return res.status(500).json({ error: 'IMGBB_API_KEY not configured' });

      // const FormData = require('form-data');
      // const axios = require('axios');
      
      const form = new FormData();
      form.append('image', req.file.buffer, `manga-${req.params.id}-cover.jpg`);
      form.append('key', process.env.IMGBB_API_KEY);
      
      const response = await axios.post('https://api.imgbb.com/1/upload', form, {
        headers: form.getHeaders()
      });
      
      if (!response.data.success) throw new Error('Imgbb upload failed');
      
      const imageUrl = response.data.data.url;
      await firestore.collection('manga').doc(req.params.id).update({ cover_url: imageUrl });
      res.json({ cover_url: imageUrl });
    } catch (err) {
      console.error('POST /api/manga/:id/cover error', err);
      res.status(500).json({ error: 'internal' });
    }
  });

  // Upload cover image for anime to Imgbb
  app.post('/api/anime/:id/cover', authenticateJWT, requireRole('admin'), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'image required' });
      if (!process.env.IMGBB_API_KEY) return res.status(500).json({ error: 'IMGBB_API_KEY not configured' });

      // const FormData = require('form-data');
      // const axios = require('axios');
      
      const form = new FormData();
      form.append('image', req.file.buffer, `anime-${req.params.id}-cover.jpg`);
      form.append('key', process.env.IMGBB_API_KEY);
      
      const response = await axios.post('https://api.imgbb.com/1/upload', form, {
        headers: form.getHeaders()
      });
      
      if (!response.data.success) throw new Error('Imgbb upload failed');
      
      const imageUrl = response.data.data.url;
      await firestore.collection('anime').doc(req.params.id).update({ cover_url: imageUrl });
      res.json({ cover_url: imageUrl });
    } catch (err) {
      console.error('POST /api/anime/:id/cover error', err);
      res.status(500).json({ error: 'internal' });
    }
  });

// CREATE episode (already used by admin form but ensure exists)
app.post('/api/anime/:id/episodes', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const ref = await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .add({
        number: req.body.number,
        title: req.body.title || null,
        embed_url: req.body.embed_url || null,
        created_at: new Date()
      });
    res.status(201).json({ id: ref.id });
  } catch (err) {
    console.error('POST /api/anime/:id/episodes error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// UPDATE episode
app.put('/api/anime/:id/episodes/:eid', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { number, title, embed_url } = req.body;
    await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .doc(req.params.eid)
      .update({
        number: number || undefined,
        title: title || undefined,
        embed_url: embed_url || undefined,
        updated_at: new Date()
      });
    const doc = await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .doc(req.params.eid)
      .get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (err) {
    console.error('PUT /api/anime/:id/episodes/:eid error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// DELETE episode
app.delete('/api/anime/:id/episodes/:eid', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .doc(req.params.eid)
      .delete();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/anime/:id/episodes/:eid error', err);
    res.status(500).json({ error: 'internal' });
  }
});

  /*
    Ghi chú lưu trữ ảnh bìa:
    - Ảnh bìa được lưu vào Firebase Storage (bucket được cấu hình trong admin.initializeApp).
    - File được public và URL công khai lưu vào trường `cover_url` trong document Firestore tương ứng.

    Về yêu cầu lưu vào Google Drive:
    - Về kỹ thuật có thể tải file lên Google Drive bằng API, nhưng cần OAuth 2.0 (user consent) hoặc cấu hình service account với quyền truy cập thư mục cụ thể.
    - Lưu trực tiếp lên Drive làm nơi lưu tập trung có thể phức tạp hơn (phải quản lý chia sẻ/permission, quota, refresh tokens). Thay vào đó khuyến nghị sử dụng Firebase Storage / Google Cloud Storage (đã tích hợp sẵn với Firebase Admin) vì dễ quản lý, tối ưu cho static assets và tương thích với ứng dụng hiện tại.
    - Nếu bạn muốn tôi triển khai lưu thêm lên Google Drive, tôi có thể thêm endpoint upload Drive (yêu cầu bạn cung cấp credentials và quyết định sử dụng service account hay OAuth flow).
  */

/* ================== ADMIN - USERS ================== */
// Get all users (admin only)
app.get('/api/admin/users', authenticateJWT, requireRole('admin'), async (_, res) => {
  try {
    const snap = await firestore.collection('users').get();
    const users = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        username: data.username || data.email || d.id,
        email: data.email,
        role: data.role || 'user',
        created_at: data.created_at
      };
    });
    res.json(users);
  } catch (err) {
    console.error('GET /api/admin/users error', err);
    res.status(500).json({ error: err.message });
  }
});

// Update user role (admin only)
app.patch('/api/admin/users/:userId/role', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    await firestore.collection('users').doc(userId).update({ role });
    const userDoc = await firestore.collection('users').doc(userId).get();
    res.json({ id: userId, username: userDoc.data()?.email, role });
  } catch (err) {
    console.error('PATCH /api/admin/users/:userId/role error', err);
    res.status(500).json({ error: err.message });
  }
});

/* ================== HEALTH ================== */
app.get('/health', (_, res) => res.json({ ok: true }));


/* ================== START ================== */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🔥 Server Firebase running on ${PORT}`));