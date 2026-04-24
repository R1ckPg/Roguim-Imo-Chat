const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp3|mp4|avi/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(null, true); // Allow for now, add proper validation later
    }
  }
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'your-secret-key'; // In production, use environment variable

// Database setup
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the SQLite database.');
});

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    full_name TEXT,
    password TEXT,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER,
    receiver_id INTEGER,
    group_id INTEGER,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    file_path TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS message_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    user_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    message TEXT,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Create default admin user if no users exist
  db.get('SELECT COUNT(*) as count FROM users', [], (err, row) => {
    if (err) console.error(err);
    if (row.count === 0) {
      const hashedPassword = bcrypt.hashSync('admin123', 8);
      db.run('INSERT INTO users (username, full_name, password, role) VALUES (?, ?, ?, ?)',
        ['admin', 'Administrador', hashedPassword, 'admin'], (err) => {
        if (err) console.error('Error creating default admin:', err);
        else console.log('Default admin user created: admin/admin123');
      });
    }
  });
});

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(500).json({ error: 'Failed to authenticate token' });
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};

// Routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    bcrypt.compare(password, user.password, (err, isValid) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
    });
  });
});

app.post('/api/auth/register', verifyToken, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { username, full_name, password, role } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);

  db.run('INSERT INTO users (username, full_name, password, role) VALUES (?, ?, ?, ?)',
    [username, full_name, hashedPassword, role || 'user'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.get('/api/users', verifyToken, (req, res) => {
  db.all('SELECT id, username, full_name, role FROM users WHERE is_active = 1', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.delete('/api/users/:id', verifyToken, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  db.run('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ changes: this.changes });
  });
});

app.post('/api/groups', verifyToken, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { name } = req.body;
  db.run('INSERT INTO groups (name, created_by) VALUES (?, ?)', [name, req.userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.get('/api/groups', verifyToken, (req, res) => {
  db.all('SELECT * FROM groups', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/groups/:id/members', verifyToken, (req, res) => {
  if (req.userRole !== 'admin') return res.status(403).json({ error: 'Admin access required' });

  const { user_id } = req.body;
  db.run('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [req.params.id, user_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID });
  });
});

app.get('/api/messages/:conversationId', verifyToken, (req, res) => {
  const { conversationId } = req.params;
  const { type } = req.query; // 'private' or 'group'

  let query;
  let params;
  if (type === 'group') {
    query = `
      SELECT m.*, u.username, u.full_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.group_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at ASC
    `;
    params = [conversationId];
  } else {
    query = `
      SELECT m.*, u.username, u.full_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)) AND m.group_id IS NULL AND m.is_deleted = 0
      ORDER BY m.created_at ASC
    `;
    params = [req.userId, conversationId, conversationId, req.userId];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/messages/:id', verifyToken, (req, res) => {
  const { content } = req.body;
  db.get('SELECT * FROM messages WHERE id = ?', [req.params.id], (err, message) => {
    if (err) return res.status(500).json({ error: err.message });
    if (message.sender_id !== req.userId) return res.status(403).json({ error: 'Can only edit own messages' });

    db.run('UPDATE messages SET content = ? WHERE id = ?', [content, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    });
  });
});

app.delete('/api/messages/:id', verifyToken, (req, res) => {
  db.get('SELECT * FROM messages WHERE id = ?', [req.params.id], (err, message) => {
    if (err) return res.status(500).json({ error: err.message });
    if (message.sender_id !== req.userId) return res.status(403).json({ error: 'Can only delete own messages' });

    db.run('UPDATE messages SET is_deleted = 1 WHERE id = ?', [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ changes: this.changes });
    });
  });
});

// File upload route
app.post('/api/upload', verifyToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Socket.io for real-time messaging
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join', (userId) => {
    socket.join(userId);
  });

  socket.on('sendMessage', (data) => {
    const { senderId, receiverId, groupId, content, messageType, filePath } = data;

    db.run('INSERT INTO messages (sender_id, receiver_id, group_id, content, message_type, file_path) VALUES (?, ?, ?, ?, ?, ?)',
      [senderId, receiverId, groupId, content, messageType, filePath], function(err) {
      if (err) {
        console.error(err);
        return;
      }

      const messageId = this.lastID;
      db.get('SELECT m.*, u.username, u.full_name FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?', [messageId], (err, message) => {
        if (err) return;

        if (groupId) {
          // Send to all group members
          db.all('SELECT user_id FROM group_members WHERE group_id = ?', [groupId], (err, members) => {
            if (err) return;
            members.forEach(member => {
              io.to(member.user_id.toString()).emit('newMessage', message);
            });
          });
        } else {
          io.to(receiverId.toString()).emit('newMessage', message);
          io.to(senderId.toString()).emit('newMessage', message);
        }
      });
    });
  });

  socket.on('typing', (data) => {
    const { userId, conversationId, isTyping } = data;
    socket.to(conversationId).emit('typingIndicator', { userId, isTyping });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});