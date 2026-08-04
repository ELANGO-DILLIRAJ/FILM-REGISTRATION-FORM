/* ───────────────────────────────────────────────────────────────
   Auth Page — Login, Sign Up & Official Google Auth
   ─────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // If already logged in, go straight to index
  if (localStorage.getItem('rkfi_token')) {
    window.location.href = 'index.html';
    return;
  }

  // ── Tab Switching ───────────────────────────────────────────
  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const signInForm = document.getElementById('signInForm');
  const signUpForm = document.getElementById('signUpForm');
  const indicator = document.getElementById('tabIndicator');

  function switchTab(isSignIn) {
    if (isSignIn) {
      tabSignIn.classList.add('auth-tab--active');
      tabSignUp.classList.remove('auth-tab--active');
      signInForm.classList.add('auth-form--active');
      signUpForm.classList.remove('auth-form--active');
      if (indicator) indicator.style.transform = 'translateX(0)';
    } else {
      tabSignUp.classList.add('auth-tab--active');
      tabSignIn.classList.remove('auth-tab--active');
      signUpForm.classList.add('auth-form--active');
      signInForm.classList.remove('auth-form--active');
      if (indicator) indicator.style.transform = 'translateX(100%)';
    }
  }

  if (tabSignIn && tabSignUp) {
    tabSignIn.addEventListener('click', () => switchTab(true));
    tabSignUp.addEventListener('click', () => switchTab(false));
  }

  // ── Password Visibility Toggles ─────────────────────────────
  document.querySelectorAll('.auth-form__toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      } else {
        input.type = 'password';
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
      }
    });
  });

  // ── Form Submit Logic ───────────────────────────────────────
  const signInStatus = document.getElementById('signInStatus');
  const signUpStatus = document.getElementById('signUpStatus');
  const signInBtn = document.getElementById('signInBtn');
  const signUpBtn = document.getElementById('signUpBtn');

  function showStatus(el, message, type) {
    if (!el) return;
    el.textContent = message;
    el.className = 'auth-form__status visible';
    el.classList.add(type === 'success' ? 'auth-form__status--success' : 'auth-form__status--error');
  }

  function clearStatus(el) {
    if (!el) return;
    el.textContent = '';
    el.className = 'auth-form__status';
  }

  // Handle Sign In
  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearStatus(signInStatus);

      const email = signInForm.elements['email'].value.trim();
      const password = signInForm.elements['password'].value.trim();

      if (!email || !password) {
        showStatus(signInStatus, 'Please fill in all fields.', 'error');
        return;
      }

      signInBtn.disabled = true;
      signInBtn.querySelector('span').textContent = 'Signing in…';

      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('rkfi_token', data.token);
          localStorage.setItem('rkfi_user', JSON.stringify(data.user));
          window.location.href = 'index.html';
        } else {
          showStatus(signInStatus, data.message || 'Login failed.', 'error');
        }
      } catch (err) {
        showStatus(signInStatus, 'Network error. Try again.', 'error');
      } finally {
        signInBtn.disabled = false;
        signInBtn.querySelector('span').textContent = 'Sign In';
      }
    });
  }

  // Handle Sign Up
  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearStatus(signUpStatus);

      const name = signUpForm.elements['name'].value.trim();
      const email = signUpForm.elements['email'].value.trim();
      const phone = signUpForm.elements['phone'].value.trim();
      const password = signUpForm.elements['password'].value;
      const confirmPassword = signUpForm.elements['confirmPassword'].value;

      if (!name || !email || !password || !confirmPassword) {
        showStatus(signUpStatus, 'Please fill in required fields.', 'error');
        return;
      }

      if (password !== confirmPassword) {
        showStatus(signUpStatus, 'Passwords do not match.', 'error');
        return;
      }

      signUpBtn.disabled = true;
      signUpBtn.querySelector('span').textContent = 'Creating Account…';

      try {
        const res = await fetch('/api/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          localStorage.setItem('rkfi_token', data.token);
          localStorage.setItem('rkfi_user', JSON.stringify(data.user));
          window.location.href = 'index.html';
        } else {
          showStatus(signUpStatus, data.message || 'Signup failed.', 'error');
        }
      } catch (err) {
        showStatus(signUpStatus, 'Network error. Try again.', 'error');
      } finally {
        signUpBtn.disabled = false;
        signUpBtn.querySelector('span').textContent = 'Create Account';
      }
    });
  }
})();

// ── Official Google Sign-In Callback ──────────────────────────
window.handleCredentialResponse = async (response) => {
  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      // Save session
      localStorage.setItem('rkfi_token', data.token);
      localStorage.setItem('rkfi_user', JSON.stringify(data.user));
      
      // Redirect to protected index
      window.location.href = 'index.html';
    } else {
      alert(data.message || 'Google Sign-In failed.');
    }
  } catch (err) {
    alert('Network error during Google Sign-In.');
  }
};
