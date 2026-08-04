const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'students.json');
const USERS_FILE = path.join(__dirname, 'users.json');

// ── In-memory session store ──────────────────────────────────
// Maps token → userId
const sessions = new Map();

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ──────────────────────────────────────────────────

/** Read existing student records (or return an empty array). */
function readStudents() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // If the file is corrupt, start fresh
  }
  return [];
}

/** Write the full student array back to disk. */
function writeStudents(students) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(students, null, 2), 'utf-8');
}

/** Read user accounts (or return an empty array). */
function readUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    // If the file is corrupt, start fresh
  }
  return [];
}

/** Write user accounts back to disk. */
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

/** Hash a password with a salt using scrypt. */
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

/** Generate a random session token. */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** Create a session for a user and return the token. */
function createSession(userId) {
  const token = generateToken();
  sessions.set(token, userId);
  return token;
}

/** Auth middleware — extracts user from Authorization header. */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  const userId = sessions.get(token);
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Invalid or expired session.' });
  }

  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User not found.' });
  }

  req.user = user;
  req.token = token;
  next();
}

// ── Auth Routes ──────────────────────────────────────────────

// Sign Up
app.post('/api/signup', (req, res) => {
  const { name, email, phone, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and password are required.'
    });
  }

  const users = readUsers();

  // Check for duplicate email
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({
      success: false,
      message: 'An account with this email already exists.'
    });
  }

  // Hash password
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const user = {
    id: 'user_' + Date.now(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: (phone || '').trim(),
    passwordHash,
    salt,
    provider: 'local',
    createdAt: new Date().toISOString()
  };

  users.push(user);
  writeUsers(users);

  const token = createSession(user.id);

  console.log(`✓  New signup: ${user.name} (${user.email})`);

  return res.status(201).json({
    success: true,
    message: 'Account created successfully!',
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, provider: user.provider }
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.'
    });
  }

  const users = readUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.provider === 'local');

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.'
    });
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return res.status(401).json({
      success: false,
      message: 'Invalid email or password.'
    });
  }

  const token = createSession(user.id);

  console.log(`✓  Login: ${user.name} (${user.email})`);

  return res.json({
    success: true,
    message: 'Login successful!',
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, provider: user.provider }
  });
});

// Helper to decode JWT payload securely without external libraries
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

// OAuth (Google Identity Services)
app.post('/api/auth/google', (req, res) => {
  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({
      success: false,
      message: 'Google identity token is missing.'
    });
  }

  const payload = decodeJwtPayload(credential);
  if (!payload || !payload.email || !payload.name) {
    return res.status(401).json({
      success: false,
      message: 'Invalid Google identity token.'
    });
  }

  const email = payload.email.toLowerCase();
  const name = payload.name;
  const provider = 'google';

  const users = readUsers();
  let user = users.find(u => u.email.toLowerCase() === email);

  if (user) {
    // Existing user — update provider info if needed
    if (user.provider === 'local') {
      user.provider = provider;
      writeUsers(users);
    }
  } else {
    // New user via OAuth
    user = {
      id: 'user_' + Date.now(),
      name: name.trim(),
      email: email.trim(),
      phone: '',
      passwordHash: '',
      salt: '',
      provider,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeUsers(users);
    console.log(`✓  New OAuth signup: ${user.name} (${user.email}) via ${provider}`);
  }

  const token = createSession(user.id);

  return res.json({
    success: true,
    message: `Signed in with ${provider}!`,
    token,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, provider: user.provider }
  });
});


// Get current user profile
app.get('/api/me', authenticate, (req, res) => {
  const { id, name, email, phone, provider, createdAt } = req.user;
  return res.json({
    success: true,
    user: { id, name, email, phone, provider, createdAt }
  });
});

// Update profile
app.put('/api/profile', authenticate, (req, res) => {
  const { name, phone } = req.body;
  const users = readUsers();
  const idx = users.findIndex(u => u.id === req.user.id);

  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'User not found.' });
  }

  if (name !== undefined) users[idx].name = name.trim();
  if (phone !== undefined) users[idx].phone = phone.trim();

  writeUsers(users);

  console.log(`✓  Profile updated: ${users[idx].name} (${users[idx].email})`);

  return res.json({
    success: true,
    message: 'Profile updated!',
    user: {
      id: users[idx].id,
      name: users[idx].name,
      email: users[idx].email,
      phone: users[idx].phone,
      provider: users[idx].provider
    }
  });
});

// ── Registration Route (existing) ────────────────────────────

app.post('/api/register', (req, res) => {
  const { name, email, phone, course } = req.body;

  // Validation
  if (!name || !email || !phone || !course) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required — name, email, phone, and course.'
    });
  }

  // Build the record
  const record = {
    id: Date.now(),
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    course: course.trim(),
    registeredAt: new Date().toISOString()
  };

  // Persist
  const students = readStudents();
  students.push(record);
  writeStudents(students);

  console.log(`✓  New registration: ${record.name} — ${record.course}`);

  return res.status(201).json({
    success: true,
    message: 'Registration successful!',
    data: record
  });
});

// ── Start ────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎬  Film Institute Registration server running at http://localhost:${PORT}\n`);
});
