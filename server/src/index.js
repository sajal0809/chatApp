import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import fs from 'fs';

let transporter;
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const JWT_SECRET = process.env.JWT_SECRET || 'chat-app-secret-key-change-in-production';

app.use(cors());
app.use(express.json());

const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } });

async function initMailer() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    console.log('SMTP configured:', process.env.SMTP_HOST);
    return;
  }

  const account = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: account.user, pass: account.pass },
  });
  console.log('Ethereal Email:', account.user);
  console.log('Ethereal Pass:', account.pass);
  console.log('OTP emails captured at https://ethereal.email');
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const stmt = db.prepare('INSERT INTO otps (email, code, expiresAt) VALUES (?, ?, ?)');
  stmt.run(email, code, expiresAt);

  console.log(`\n=== OTP for ${email}: ${code} ===\n`);

  try {
    const fromAddr = process.env.SMTP_FROM || '"ChatApp" <noreply@chatapp.com>';
    const info = await transporter.sendMail({
      from: fromAddr,
      to: email,
      subject: 'Your OTP Code',
      html: `<p>Your OTP code is: <strong>${code}</strong></p><p>Expires in 10 minutes.</p>`,
    });
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Email sent. Preview URL:', previewUrl);
  } catch (err) {
    console.error('Email delivery failed (OTP still available in logs):', err.message);
  }

  res.json({ message: 'OTP sent' });
});

app.post('/api/verify-otp', (req, res) => {
  const { email, code, username, displayName, password } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code required' });

  const otp = db.prepare(
    `SELECT * FROM otps WHERE email = ? AND code = ? AND used = 0 AND expiresAt > datetime('now') ORDER BY createdAt DESC LIMIT 1`
  ).get(email, code);

  if (!otp) return res.status(400).json({ error: 'Invalid or expired OTP' });

  db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otp.id);

  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    if (!username || !displayName || !password) {
      return res.status(400).json({ error: 'Username, display name, and password required for new user' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) return res.status(400).json({ error: 'Username already taken' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (email, username, displayName, password) VALUES (?, ?, ?, ?)').run(email, username, displayName, hashedPassword);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
  }

  const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatar: user.avatar } });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(400).json({ error: 'User not found' });
  if (!user.password) return res.status(400).json({ error: 'No password set. Sign up with OTP first.' });

  if (!bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: 'Invalid password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatar: user.avatar } });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, email, username, displayName, avatar FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

app.get('/api/users/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const users = db.prepare(
    'SELECT id, username, displayName, avatar FROM users WHERE username LIKE ? AND id != ? LIMIT 20'
  ).all(`%${q}%`, req.user.id);
  res.json(users);
});

app.get('/api/users', authMiddleware, (req, res) => {
  const users = db.prepare(
    'SELECT id, username, displayName, avatar FROM users WHERE id != ? ORDER BY displayName ASC'
  ).all(req.user.id);
  res.json(users);
});

app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/upload-avatar', authMiddleware, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(url, req.user.id);
  res.json({ url });
});

app.get('/api/messages/:userId', authMiddleware, (req, res) => {
  const { before, limit = 50 } = req.query;
  const userId = parseInt(req.params.userId);

  let sql;
  let params;
  if (before) {
    sql = `SELECT m.*, 
     r.content as repliedContent, r.imageUrl as repliedImage, r.senderId as repliedSender,
     u.displayName as repliedSenderName
     FROM messages m
     LEFT JOIN messages r ON m.repliedTo = r.id
     LEFT JOIN users u ON r.senderId = u.id
     WHERE ((m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?))
     AND m.id < ?
     ORDER BY m.createdAt DESC LIMIT ?`;
    params = [req.user.id, userId, userId, req.user.id, parseInt(before), parseInt(limit)];
  } else {
    sql = `SELECT m.*, 
     r.content as repliedContent, r.imageUrl as repliedImage, r.senderId as repliedSender,
     u.displayName as repliedSenderName
     FROM messages m
     LEFT JOIN messages r ON m.repliedTo = r.id
     LEFT JOIN users u ON r.senderId = u.id
     WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?)
     ORDER BY m.createdAt DESC LIMIT ?`;
    params = [req.user.id, userId, userId, req.user.id, parseInt(limit)];
  }

  const messages = db.prepare(sql).all(...params).reverse();

  const updated = db.prepare(
    'UPDATE messages SET read = 1 WHERE senderId = ? AND receiverId = ? AND read = 0'
  ).run(userId, req.user.id);

  if (updated.changes > 0) {
    io.to(`user:${userId}`).emit('messages:read', { by: req.user.id, chatWith: userId });
  }

  res.json(messages);
});

app.patch('/api/messages/:id', authMiddleware, (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND senderId = ? AND deleted = 0').get(req.params.id, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  db.prepare('UPDATE messages SET content = ?, edited = 1 WHERE id = ?').run(content, req.params.id);
  const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);

  io.to(`user:${msg.receiverId}`).emit('message:edit', updated);
  io.to(`user:${msg.senderId}`).emit('message:edit', updated);
  res.json(updated);
});

app.delete('/api/messages/:id', authMiddleware, (req, res) => {
  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND senderId = ?').get(req.params.id, req.user.id);
  if (!msg) return res.status(404).json({ error: 'Message not found' });

  db.prepare('UPDATE messages SET deleted = 1, content = NULL, imageUrl = NULL, audioUrl = NULL WHERE id = ?').run(req.params.id);

  io.to(`user:${msg.receiverId}`).emit('message:delete', { id: req.params.id });
  io.to(`user:${msg.senderId}`).emit('message:delete', { id: req.params.id });
  res.json({ success: true });
});

app.post('/api/messages/:id/react', authMiddleware, (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'Emoji required' });

  const msgKey = parseInt(req.params.id);
  if (isNaN(msgKey)) return res.status(400).json({ error: 'Invalid message id' });

  const msg = db.prepare(
    'SELECT * FROM messages WHERE id = ? AND ((senderId = ? OR receiverId = ?) AND deleted = 0)'
  ).get(msgKey, req.user.id, req.user.id);

  if (!msg) return res.status(404).json({ error: 'Message not found' });

  let reactions = msg.reactions ? JSON.parse(msg.reactions) : {};
  const userId = req.user.id;
  let changed = false;

  if (reactions[emoji]) {
    const idx = reactions[emoji].indexOf(userId);
    if (idx > -1) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) delete reactions[emoji];
      changed = true;
    } else {
      reactions[emoji].push(userId);
      changed = true;
    }
  } else {
    reactions[emoji] = [userId];
    changed = true;
  }

  if (changed) {
    const json = JSON.stringify(reactions);
    db.prepare('UPDATE messages SET reactions = ? WHERE id = ?').run(json, msgKey);
    const updated = db.prepare('SELECT * FROM messages WHERE id = ?').get(msgKey);

    const otherUserId = msg.senderId === req.user.id ? msg.receiverId : msg.senderId;
    io.to(`user:${otherUserId}`).emit('message:react', updated);
    io.to(`user:${req.user.id}`).emit('message:react', updated);
  }

  res.json({ reactions });
});

app.get('/api/conversations', authMiddleware, (req, res) => {
  const conversations = db.prepare(`
    SELECT 
      u.id, u.username, u.displayName, u.avatar,
      m.content as lastMessage, m.imageUrl as lastImage, m.audioUrl as lastAudio,
      m.deleted as lastDeleted, m.createdAt as lastTime,
      (SELECT COUNT(*) FROM messages WHERE senderId = u.id AND receiverId = ? AND read = 0) as unread
    FROM users u
    INNER JOIN messages m ON (
      (m.senderId = u.id AND m.receiverId = ?) OR 
      (m.senderId = ? AND m.receiverId = u.id)
    )
    WHERE u.id != ?
    GROUP BY u.id
    HAVING MAX(m.createdAt)
    ORDER BY lastTime DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id);
  res.json(conversations);
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

const onlineUsers = new Set();

io.on('connection', (socket) => {
  socket.join(`user:${socket.user.id}`);
  onlineUsers.add(socket.user.id);
  io.emit('user:online', { userId: socket.user.id });

  socket.on('message:send', (data) => {
    const { receiverId, content, imageUrl, audioUrl, repliedTo } = data;
    if (!receiverId) return;

    const result = db.prepare(
      'INSERT INTO messages (senderId, receiverId, content, imageUrl, audioUrl, repliedTo) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(socket.user.id, receiverId, content || null, imageUrl || null, audioUrl || null, repliedTo || null);

    const message = db.prepare(
      `SELECT m.*,
       r.content as repliedContent, r.imageUrl as repliedImage, r.senderId as repliedSender,
       u.displayName as repliedSenderName
       FROM messages m
       LEFT JOIN messages r ON m.repliedTo = r.id
       LEFT JOIN users u ON r.senderId = u.id
       WHERE m.id = ?`
    ).get(result.lastInsertRowid);

    io.to(`user:${receiverId}`).emit('message:new', message);
    io.to(`user:${socket.user.id}`).emit('message:new', message);
  });

  socket.on('messages:mark-read', (data) => {
    const { fromUserId } = data;
    db.prepare('UPDATE messages SET read = 1 WHERE senderId = ? AND receiverId = ? AND read = 0')
      .run(fromUserId, socket.user.id);
    io.to(`user:${fromUserId}`).emit('messages:read', { by: socket.user.id, chatWith: fromUserId });
  });

  socket.on('typing', (data) => {
    io.to(`user:${data.receiverId}`).emit('typing', { userId: socket.user.id, username: socket.user.username });
  });

  socket.on('stop-typing', (data) => {
    io.to(`user:${data.receiverId}`).emit('stop-typing', { userId: socket.user.id });
  });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.user.id);
    io.emit('user:offline', { userId: socket.user.id });
  });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/socket.io')) return;
  res.sendFile(path.join(clientDist, 'index.html'));
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await initMailer();
  } catch (err) {
    console.warn('Could not set up email, OTP sending will fail:', err.message);
  }
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
