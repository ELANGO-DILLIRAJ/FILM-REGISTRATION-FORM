const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'students.json');

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

// ── Routes ───────────────────────────────────────────────────

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
