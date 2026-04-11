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
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);

function parsePositiveNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function normalizeFirestoreDoc(data) {
  const out = { ...(data || {}) };
  const created = toIsoDate(out.created_at);
  const updated = toIsoDate(out.updated_at);
  if (created) out.created_at = created;
  if (updated) out.updated_at = updated;
  return out;
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === "function") {
    const d = value.toDate();
    return d instanceof Date ? d.getTime() : 0;
  }
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  return 0;
}

function pickGenres(item) {
  const out = [];
  if (Array.isArray(item?.genres)) out.push(...item.genres);
  if (Array.isArray(item?.tags)) out.push(...item.tags);
  if (typeof item?.genre === "string") out.push(...item.genre.split(","));
  if (typeof item?.tag === "string") out.push(...item.tag.split(","));
  return Array.from(new Set(out.map((v) => String(v || "").trim()).filter(Boolean)));
}

async function getCollectionItemsByIds(collectionName, ids) {
  const uniqueIds = Array.from(new Set((ids || []).map((id) => String(id)).filter(Boolean)));
  const itemMap = new Map();

  for (const group of chunkArray(uniqueIds, 200)) {
    const refs = group.map((id) => firestore.collection(collectionName).doc(id));
    if (!refs.length) continue;
    const docs = await firestore.getAll(...refs);
    for (const doc of docs) {
      if (!doc.exists) continue;
      itemMap.set(doc.id, { id: doc.id, ...normalizeFirestoreDoc(doc.data()) });
    }
  }

  return itemMap;
}

async function createNotificationsForFollowers(payload) {
  const { type, targetId, event, title, message, metadata } = payload || {};
  if (!type || !targetId || !event || !title || !message) return 0;

  const followsSnap = await firestore
    .collection('follows')
    .where('type', '==', String(type))
    .where('target_id', '==', String(targetId))
    .get();

  if (followsSnap.empty) return 0;

  const followerIds = Array.from(
    new Set(
      followsSnap.docs
        .map((d) => d.data()?.user_id)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );

  const now = new Date();
  let inserted = 0;

  for (const group of chunkArray(followerIds, 400)) {
    const batch = firestore.batch();
    for (const userId of group) {
      const ref = firestore
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .doc();

      batch.set(ref, {
        user_id: userId,
        type: String(type),
        target_id: String(targetId),
        event: String(event),
        title: String(title),
        message: String(message),
        metadata: metadata || null,
        read: false,
        created_at: now,
        updated_at: now
      });
      inserted += 1;
    }
    await batch.commit();
  }

  return inserted;
}

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
    const title = String(req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: "title required" });
    const genre = String(req.body.genre || '').trim();

    const ref = await firestore.collection('anime').add({
      title,
      description: req.body.description ? String(req.body.description) : null,
      genre: genre || null,
      embed_url: req.body.embed_url || null,
      created_at: new Date(),
      updated_at: new Date()
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
    const updates = { updated_at: new Date() };

    if (hasOwn(req.body, 'title')) {
      const nextTitle = String(req.body.title || '').trim();
      if (!nextTitle) return res.status(400).json({ error: 'title cannot be empty' });
      updates.title = nextTitle;
    }

    if (hasOwn(req.body, 'description')) {
      updates.description = req.body.description ? String(req.body.description) : null;
    }

    if (hasOwn(req.body, 'embed_url')) {
      updates.embed_url = req.body.embed_url ? String(req.body.embed_url) : null;
    }

    if (hasOwn(req.body, 'genre')) {
      const nextGenre = req.body.genre == null ? '' : String(req.body.genre).trim();
      updates.genre = nextGenre || null;
    }

    await firestore.collection('anime').doc(req.params.id).update(updates);
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
    await Promise.all(episodesSnap.docs.map((epiDoc) => epiDoc.ref.delete()));
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
  const title = String(req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title required' });
  const genre = String(req.body.genre || '').trim();
  if (!genre) return res.status(400).json({ error: 'genre required' });

  const ref = await firestore.collection('manga').add({
    title,
    description: req.body.description || null,
    genre,
    created_at: new Date(),
    updated_at: new Date()
  });
  res.status(201).json({ id: ref.id });
});

// UPDATE manga
app.put('/api/manga/:id', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    const updates = { updated_at: new Date() };

    if (hasOwn(req.body, 'title')) {
      const nextTitle = String(req.body.title || '').trim();
      if (!nextTitle) return res.status(400).json({ error: 'title cannot be empty' });
      updates.title = nextTitle;
    }

    if (hasOwn(req.body, 'description')) {
      updates.description = req.body.description ? String(req.body.description) : null;
    }

    if (hasOwn(req.body, 'genre')) {
      updates.genre = req.body.genre ? String(req.body.genre) : null;
    }

    await firestore.collection('manga').doc(req.params.id).update(updates);
    const doc = await firestore.collection('manga').doc(req.params.id).get();

    const mangaTitle = doc.data()?.title || 'Truyen';
    createNotificationsForFollowers({
      type: 'manga',
      targetId: req.params.id,
      event: 'manga_updated',
      title: `${mangaTitle} vua duoc cap nhat`,
      message: `Noi dung cua ${mangaTitle} da co thay doi moi.`
    }).catch((notifyErr) => console.error('Notify manga update error', notifyErr));

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
    await Promise.all(chaptersSnap.docs.map((chapDoc) => chapDoc.ref.delete()));
    // Delete manga
    await firestore.collection('manga').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/manga/:id error', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ================== CHAPTERS ================== */
app.post('/api/manga/:id/chapters', authenticateJWT, requireRole('admin'), async (req, res) => {
  try {
    console.log('POST /api/manga/:id/chapters body:', JSON.stringify(req.body).slice(0, 2000));
    const chapterNumber = parsePositiveNumber(req.body.number);
    if (!chapterNumber) return res.status(400).json({ error: 'number must be a positive number' });

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
    const q = await chaptersRef.where('number', '==', chapterNumber).limit(1).get();
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

    // otherwise create a new chapter document
    const ref = await chaptersRef.add({
      number: chapterNumber,
      title: req.body.title || null,
      images: incoming,
      created_at: new Date(),
      updated_at: new Date()
    });

    const mangaDoc = await firestore.collection('manga').doc(req.params.id).get();
    const mangaTitle = mangaDoc.data()?.title || 'Truyen';
    const chapterLabel = req.body.title ? `Chuong ${chapterNumber} - ${req.body.title}` : `Chuong ${chapterNumber}`;

    createNotificationsForFollowers({
      type: 'manga',
      targetId: req.params.id,
      event: 'chapter_added',
      title: `${mangaTitle} co chuong moi`,
      message: `${chapterLabel} vua duoc dang.`,
      metadata: { chapterId: ref.id, chapterNumber }
    }).catch((notifyErr) => console.error('Notify chapter added error', notifyErr));

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
    const updates = { updated_at: new Date() };

    if (hasOwn(req.body, 'number')) {
      const parsedNumber = parsePositiveNumber(number);
      if (!parsedNumber) return res.status(400).json({ error: 'number must be a positive number' });
      updates.number = parsedNumber;
    }

    if (hasOwn(req.body, 'title')) {
      updates.title = title ? String(title) : null;
    }

    if (hasOwn(req.body, 'images')) {
      updates.images = Array.isArray(images) ? images : [];
    }

    await firestore
      .collection('manga')
      .doc(req.params.id)
      .collection('chapters')
      .doc(req.params.cid)
      .update(updates);
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

    const [followsSnap, likesSnap] = await Promise.all([
      firestore.collection('follows').where('user_id', '==', uid).get(),
      firestore.collection('likes').where('user_id', '==', uid).get()
    ]);

    const follows = followsSnap.docs.map(d => d.data());
    const likes = likesSnap.docs.map(d => d.data());

    res.json({ user, follows, likes });
  } catch (err) {
    console.error('GET /api/me error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Current user's followed/liked library, grouped by manga and anime
app.get('/api/me/library', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const limitPerType = Math.min(Math.max(parsePositiveNumber(req.query.limit) || 100, 1), 300);

    const [followsSnap, likesSnap] = await Promise.all([
      firestore.collection('follows').where('user_id', '==', uid).get(),
      firestore.collection('likes').where('user_id', '==', uid).get()
    ]);

    const followSet = {
      manga: new Set(),
      anime: new Set()
    };
    const likeSet = {
      manga: new Set(),
      anime: new Set()
    };

    for (const doc of followsSnap.docs) {
      const row = doc.data() || {};
      const t = row.type === 'anime' ? 'anime' : row.type === 'manga' ? 'manga' : null;
      if (!t) continue;
      followSet[t].add(String(row.target_id));
    }

    for (const doc of likesSnap.docs) {
      const row = doc.data() || {};
      const t = row.type === 'anime' ? 'anime' : row.type === 'manga' ? 'manga' : null;
      if (!t) continue;
      likeSet[t].add(String(row.target_id));
    }

    const mangaIds = Array.from(new Set([...followSet.manga, ...likeSet.manga])).slice(0, limitPerType);
    const animeIds = Array.from(new Set([...followSet.anime, ...likeSet.anime])).slice(0, limitPerType);

    const [mangaMap, animeMap] = await Promise.all([
      getCollectionItemsByIds('manga', mangaIds),
      getCollectionItemsByIds('anime', animeIds)
    ]);

    const mapItems = (ids, follows, likes, sourceMap) =>
      ids
        .map((id) => {
          const item = sourceMap.get(id);
          if (!item) return null;
          return {
            ...item,
            following: follows.has(id),
            liked: likes.has(id)
          };
        })
        .filter(Boolean);

    const manga = mapItems(mangaIds, followSet.manga, likeSet.manga, mangaMap);
    const anime = mapItems(animeIds, followSet.anime, likeSet.anime, animeMap);

    res.json({
      manga,
      anime,
      stats: {
        manga: { follow: followSet.manga.size, like: likeSet.manga.size, total: manga.length },
        anime: { follow: followSet.anime.size, like: likeSet.anime.size, total: anime.length }
      }
    });
  } catch (err) {
    console.error('GET /api/me/library error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Notifications: unread count (for bell badge)
app.get('/api/me/notifications/unread-count', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const ref = firestore.collection('users').doc(uid).collection('notifications');

    let unread = 0;
    try {
      const countSnap = await ref.where('read', '==', false).count().get();
      unread = countSnap.data().count || 0;
    } catch {
      const fallback = await ref.where('read', '==', false).get();
      unread = fallback.size;
    }

    res.json({ unread });
  } catch (err) {
    console.error('GET /api/me/notifications/unread-count error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Notifications: list with cursor pagination
app.get('/api/me/notifications', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const limit = Math.min(Math.max(parsePositiveNumber(req.query.limit) || 12, 1), 50);
    const cursor = Number(req.query.cursor);
    const hasCursor = Number.isFinite(cursor) && cursor > 0;

    let query = firestore
      .collection('users')
      .doc(uid)
      .collection('notifications')
      .orderBy('created_at', 'desc');

    if (hasCursor) query = query.where('created_at', '<', new Date(cursor));

    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs;
    const hasMore = docs.length > limit;
    const pageDocs = hasMore ? docs.slice(0, limit) : docs;

    const notifications = pageDocs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        ...normalizeFirestoreDoc(data),
        read: !!data.read,
        created_at: toIsoDate(data.created_at),
        updated_at: toIsoDate(data.updated_at),
        read_at: toIsoDate(data.read_at)
      };
    });

    let nextCursor = null;
    if (hasMore && pageDocs.length) {
      const tail = pageDocs[pageDocs.length - 1].data()?.created_at;
      if (tail && typeof tail.toMillis === 'function') nextCursor = tail.toMillis();
      else if (tail instanceof Date) nextCursor = tail.getTime();
    }

    res.json({ notifications, nextCursor, hasMore });
  } catch (err) {
    console.error('GET /api/me/notifications error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Notifications: mark all as read
app.patch('/api/me/notifications/read-all', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const ref = firestore.collection('users').doc(uid).collection('notifications');
    const now = new Date();
    let total = 0;

    while (true) {
      const unreadSnap = await ref.where('read', '==', false).limit(400).get();
      if (unreadSnap.empty) break;

      const batch = firestore.batch();
      for (const d of unreadSnap.docs) {
        batch.update(d.ref, { read: true, read_at: now, updated_at: now });
      }
      await batch.commit();
      total += unreadSnap.size;
      if (unreadSnap.size < 400) break;
    }

    res.json({ success: true, marked: total });
  } catch (err) {
    console.error('PATCH /api/me/notifications/read-all error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Notifications: mark one as read
app.patch('/api/me/notifications/:notificationId/read', authenticateJWT, async (req, res) => {
  try {
    const uid = req.user.id;
    const notificationId = req.params.notificationId;
    const ref = firestore.collection('users').doc(uid).collection('notifications').doc(notificationId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'not found' });

    const now = new Date();
    await ref.update({ read: true, read_at: now, updated_at: now });
    res.json({ success: true, id: notificationId });
  } catch (err) {
    console.error('PATCH /api/me/notifications/:notificationId/read error', err);
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

/* ================== RECOMMENDATIONS ================== */
app.get('/api/recommendations', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parsePositiveNumber(req.query.limit) || 12, 1), 50);
    let uid = null;

    // Try to get Firebase ID token from Authorization header if provided
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const decoded = await admin.auth().verifyIdToken(auth.slice(7));
        uid = decoded.uid;
      } catch {
        // Silently ignore invalid token, serve public trending instead
      }
    }

    // Fetch all anime and manga
    const [animeSnap, mangaSnap] = await Promise.all([
      firestore.collection('anime').get(),
      firestore.collection('manga').get()
    ]);

    const allItems = [
      ...animeSnap.docs.map(d => ({ id: d.id, type: 'anime', ...d.data() })),
      ...mangaSnap.docs.map(d => ({ id: d.id, type: 'manga', ...d.data() }))
    ];

    // Sort by latest updated_at (trending)
    const sorted = allItems.sort((a, b) => {
      const aTime = Math.max(toMillis(a.updated_at), toMillis(a.created_at));
      const bTime = Math.max(toMillis(b.updated_at), toMillis(b.created_at));
      return bTime - aTime;
    });

    // Take top items
    const recommended = sorted.slice(0, limit).map(item => ({
      id: item.id,
      title: item.title,
      cover_url: item.cover_url,
      description: item.description,
      type: item.type,
      genres: pickGenres(item),
      updated_at: item.updated_at,
      created_at: item.created_at
    }));

    res.json({ success: true, items: recommended, count: recommended.length });
  } catch (err) {
    console.error('GET /api/recommendations error', err);
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
    const episodeNumber = parsePositiveNumber(req.body.number);
    if (!episodeNumber) return res.status(400).json({ error: 'number must be a positive number' });

    const ref = await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .add({
        number: episodeNumber,
        title: req.body.title || null,
        embed_url: req.body.embed_url || null,
        created_at: new Date(),
        updated_at: new Date()
      });

    const animeDoc = await firestore.collection('anime').doc(req.params.id).get();
    const animeTitle = animeDoc.data()?.title || 'Anime';
    const episodeLabel = req.body.title ? `Tap ${episodeNumber} - ${req.body.title}` : `Tap ${episodeNumber}`;

    createNotificationsForFollowers({
      type: 'anime',
      targetId: req.params.id,
      event: 'episode_added',
      title: `${animeTitle} co tap moi`,
      message: `${episodeLabel} vua duoc cap nhat.`,
      metadata: { episodeId: ref.id, episodeNumber }
    }).catch((notifyErr) => console.error('Notify episode added error', notifyErr));

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
    const updates = { updated_at: new Date() };

    if (hasOwn(req.body, 'number')) {
      const parsedNumber = parsePositiveNumber(number);
      if (!parsedNumber) return res.status(400).json({ error: 'number must be a positive number' });
      updates.number = parsedNumber;
    }

    if (hasOwn(req.body, 'title')) {
      updates.title = title ? String(title) : null;
    }

    if (hasOwn(req.body, 'embed_url')) {
      updates.embed_url = embed_url ? String(embed_url) : null;
    }

    await firestore
      .collection('anime')
      .doc(req.params.id)
      .collection('episodes')
      .doc(req.params.eid)
      .update(updates);
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
          ? data.created_at.toDate().toISOString()
          : null
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
