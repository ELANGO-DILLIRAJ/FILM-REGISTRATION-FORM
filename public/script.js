/* ───────────────────────────────────────────────────────────────
   Film Institution — Registration Hub
   Client-side interactions & Fetch API
   ─────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── Navbar Scroll Effect ───────────────────────────────────
  const nav = document.getElementById('mainNav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    });
  }


  // ── DOM References ──────────────────────────────────────────
  const cards      = document.querySelectorAll('.course-card');
  const dropdown   = document.getElementById('course');
  const form       = document.getElementById('registrationForm');
  const statusDiv  = document.getElementById('formStatus');
  const submitBtn  = document.getElementById('submitBtn');

  // ── Card Selection ──────────────────────────────────────────

  cards.forEach((card) => {
    card.addEventListener('click', () => selectCard(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard(card);
      }
    });
  });

  function selectCard(card) {
    // Remove previous selection
    cards.forEach((c) => c.classList.remove('selected'));

    // Highlight the clicked card
    card.classList.add('selected');

    // Sync dropdown value
    const courseName = card.getAttribute('data-course');
    if (dropdown) {
      dropdown.value = courseName;
    }
  }

  // ── Form Submission ─────────────────────────────────────────

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus();

    // Collect values
    const payload = {
      name:   form.elements['name'].value.trim(),
      email:  form.elements['email'].value.trim(),
      phone:  form.elements['phone'].value.trim(),
      course: form.elements['course'].value
    };

    // Basic client-side guard
    if (!payload.name || !payload.email || !payload.phone || !payload.course) {
      showStatus('Please complete all fields before submitting.', 'error');
      return;
    }

    // Disable button while request is in flight
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showStatus(data.message || 'Registration successful!', 'success');
        form.reset();
        cards.forEach((c) => c.classList.remove('selected'));
      } else {
        showStatus(data.message || 'Something went wrong. Please try again.', 'error');
      }
    } catch (err) {
      showStatus('Network error — please check your connection and try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Application';
    }
  });

  // ── Status Helpers ──────────────────────────────────────────

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'form__status visible';
    statusDiv.classList.add(type === 'success' ? 'form__status--success' : 'form__status--error');
  }

  function clearStatus() {
    statusDiv.textContent = '';
    statusDiv.className = 'form__status';
  }
})();
