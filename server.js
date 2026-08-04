const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'students.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// ── In-memory session fallback store ─────────────────────────
// Maps token → userId
const tokenSessions = new Map();

// ── Session & Middleware Config ──────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'rkfi-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running strictly behind HTTPS in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// ── Helpers ──────────────────────────────────────────────────

/** Read existing student records (or return an empty array). */
function readStudents() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // If corrupt, start fresh
  }
  return [];
}

/** Write full student array to disk. */
function writeStudents(students) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(students, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing students.json:', err);
  }
}

/** Read user accounts (or return an empty array). */
function readUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // If corrupt, start fresh
  }
  return [];
}

/** Write user accounts to disk. */
function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing users.json:', err);
  }
}

/** Hash a password using bcryptjs. */
function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

/** Verify a password against a hash using bcryptjs. */
function verifyPassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

/** Generate a random session token. */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Create a token session fallback. */
function createTokenSession(userId) {
  const token = generateToken();
  tokenSessions.set(token, userId);
  return token;
}

/** Decode JWT payload without external library. */
function decodeJwtPayload(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (err) {
    return null;
  }
}

/** Authentication Middleware — Checks express-session OR Authorization token header. */
function authenticate(req, res, next) {
  // Check express-session
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }

  // Check Bearer Token header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const userId = tokenSessions.get(token);
    if (userId) {
      const users = readUsers();
      const user = users.find(u => u.id === userId);
      if (user) {
        req.user = { id: user.id, name: user.name, email: user.email, phone: user.phone || '', provider: user.provider || 'local', createdAt: user.createdAt };
        req.token = token;
        return next();
      }
    }
  }

  return res.status(401).json({ success: false, message: 'Authentication required.' });
}

// ── Auth Routes ──────────────────────────────────────────────

// Sign Up
app.post(['/api/auth/signup', '/api/signup'], (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required.'
    });
  }

  const users = readUsers();

  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists.'
    });
  }

  const passwordHash = hashPassword(password);

  const user = {
    id: 'user_' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: (phone || '').trim(),
    passwordHash,
    provider: 'local',
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeUsers(users);

  const token = createTokenSession(user.id);
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    provider: user.provider,
    createdAt: user.createdAt
  };

  req.session.user = sessionUser;

  console.log(`✓ New Manual Signup: ${user.name} (${user.email})`);

  return res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    token,
    user: sessionUser
  });
});

// Login
app.post(['/api/auth/login', '/api/login'], (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.'
    });
  }

  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.'
    });
  }

  const token = createTokenSession(user.id);
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    provider: user.provider || 'local',
    createdAt: user.createdAt
  };

  req.session.user = sessionUser;

  console.log(`✓ Login: ${user.name} (${user.email})`);

  return res.json({
    success: true,
    message: 'Login successful!',
    token,
    user: sessionUser
  });
});

// Official Google Sign-In & OAuth
app.post(['/api/auth/google', '/api/oauth'], (req, res) => {
  const { credential, name: reqName, email: reqEmail } = req.body;

  let email = '';
  let name = '';

  if (credential) {
    const payload = decodeJwtPayload(credential);
    if (payload && payload.email) {
      email = payload.email.toLowerCase();
      name = payload.name || payload.given_name || 'Google User';
    }
  } else if (reqEmail) {
    email = reqEmail.toLowerCase();
    name = reqName || 'OAuth User';
  }

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Invalid Google Identity token.'
    });
  }

  const users = readUsers();
  let user = users.find(u => u.email.toLowerCase() === email);

  if (user) {
    if (user.provider === 'local') {
      user.provider = 'google';
      writeUsers(users);
    }
  } else {
    user = {
      id: 'user_' + Date.now(),
      name: name.trim(),
      email: email.trim(),
      phone: '',
      passwordHash: '',
      provider: 'google',
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);
    console.log(`✓ New Google OAuth Signup: ${user.name} (${user.email})`);
  }

  const token = createTokenSession(user.id);
  const sessionUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    provider: user.provider,
    createdAt: user.createdAt
  };

  req.session.user = sessionUser;

  return res.json({
    success: true,
    message: 'Signed in with Google!',
    token,
    user: sessionUser
  });
});

// Current User Profile
app.get(['/api/me', '/api/auth/me'], authenticate, (req, res) => {
  return res.json({
    success: true,
    user: req.user
  });
});

// Update Profile
app.put('/api/profile', authenticate, (req, res) => {
  const { name, phone } = req.body;
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);

  if (idx !== -1) {
    if (name !== undefined) users[idx].name = name.trim();
    if (phone !== undefined) users[idx].phone = phone.trim();
    writeUsers(users);
  }

  if (req.session && req.session.user) {
    if (name !== undefined) req.session.user.name = name.trim();
    if (phone !== undefined) req.session.user.phone = phone.trim();
  }

  const updatedUser = {
    id: req.user.id,
    name: name !== undefined ? name.trim() : req.user.name,
    email: req.user.email,
    phone: phone !== undefined ? phone.trim() : req.user.phone,
    provider: req.user.provider
  };

  return res.json({
    success: true,
    message: 'Profile updated!',
    user: updatedUser
  });
});

// Logout
app.post(['/api/auth/logout', '/api/logout'], (req, res) => {
  if (req.session) {
    req.session.destroy();
  }
  return res.json({
    success: true,
    message: 'Logged out successfully.'
  });
});

// Protected Course Registration Route
app.post('/api/register', authenticate, (req, res) => {
  const { name, email, phone, course } = req.body;

  const userName = (name || (req.user ? req.user.name : '')).trim();
  const userEmail = (email || (req.user ? req.user.email : '')).trim();

  if (!userName || !userEmail || !phone || !course) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required — name, email, phone, and course.'
    });
  }

  const record = {
    id: Date.now(),
    userId: req.user ? req.user.id : null,
    name: userName,
    email: userEmail,
    phone: phone.trim(),
    course: course.trim(),
    registeredAt: new Date().toISOString()
  };

  const students = readStudents();
  students.push(record);
  writeStudents(students);

  console.log(`✓ Registration Recorded: ${record.name} — ${record.course}`);

  return res.status(201).json({
    success: true,
    message: 'Registration successful!',
    data: record
  });
});

// ── Start Server ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎬 Rajini Kamal Film Institute server running on port ${PORT} (http://localhost:${PORT})\n`);
});
