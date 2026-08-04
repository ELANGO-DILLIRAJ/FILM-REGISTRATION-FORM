/* ───────────────────────────────────────────────────────────────
   Film Institution — Registration Hub
   Client-side interactions & Fetch API
   ─────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  // ── Auth Gating ─────────────────────────────────────────────
  const token = localStorage.getItem('rkfi_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

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

  // Profile elements
  const profileCard    = document.getElementById('profileCard');
  const profileAvatar  = document.getElementById('profileAvatar');
  const profileName    = document.getElementById('profileName');
  const profileEmail   = document.getElementById('profileEmail');
  const profilePhone   = document.getElementById('profilePhone');
  const profileProvider = document.getElementById('profileProvider');
  const profileJoined  = document.getElementById('profileJoined');
  const profileEditBtn = document.getElementById('profileEditBtn');
  const profileEdit    = document.getElementById('profileEdit');
  const profileDetails = document.getElementById('profileDetails');
  const editName       = document.getElementById('editName');
  const editPhone      = document.getElementById('editPhone');
  const profileSaveBtn = document.getElementById('profileSaveBtn');
  const profileCancelBtn = document.getElementById('profileCancelBtn');

  // Navbar user elements
  const navUser        = document.getElementById('navUser');
  const navAvatar      = document.getElementById('navAvatar');
  const navAvatarBtn   = document.getElementById('navAvatarBtn');
  const navDropdown    = document.getElementById('navDropdown');
  const navDropdownName  = document.getElementById('navDropdownName');
  const navDropdownEmail = document.getElementById('navDropdownEmail');
  const navSignOut     = document.getElementById('navSignOut');

  // ── Helper: Get initials ───────────────────────────────────
  function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  // ── Load Profile ───────────────────────────────────────────
  async function loadProfile() {
    // First, try from localStorage cache for instant render
    const cached = localStorage.getItem('rkfi_user');
    if (cached) {
      try {
        renderProfile(JSON.parse(cached));
      } catch { /* ignore bad cache */ }
    }

    // Then fetch fresh from server
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('rkfi_token');
        localStorage.removeItem('rkfi_user');
        window.location.href = 'login.html';
        return;
      }

      const data = await res.json();
      if (data.success && data.user) {
        localStorage.setItem('rkfi_user', JSON.stringify(data.user));
        renderProfile(data.user);
      }
    } catch {
      // If server is down, use cached data
    }
  }

  function renderProfile(user) {
    const initials = getInitials(user.name);

    // Profile card
    if (profileAvatar) profileAvatar.textContent = initials;
    if (profileName) profileName.textContent = user.name || '—';
    if (profileEmail) profileEmail.textContent = user.email || '—';
    if (profilePhone) profilePhone.textContent = user.phone || 'Not set';
    if (profileProvider) {
      const provLabel = user.provider === 'google' ? '● Google'
                      : user.provider === 'microsoft' ? '● Microsoft'
                      : '● Local Account';
      profileProvider.textContent = provLabel;
    }
    if (profileJoined && user.createdAt) {
      const date = new Date(user.createdAt);
      profileJoined.textContent = `Joined ${date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    }

    // Navbar avatar
    if (navAvatar) navAvatar.textContent = initials;
    if (navUser) navUser.style.display = '';
    if (navDropdownName) navDropdownName.textContent = user.name || '';
    if (navDropdownEmail) navDropdownEmail.textContent = user.email || '';

    // Auto-fill registration form
    const nameInput  = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const phoneInput = document.getElementById('phone');
    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
  }

  loadProfile();

  // ── Navbar Avatar Dropdown ─────────────────────────────────
  if (navAvatarBtn) {
    navAvatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navDropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      navDropdown.classList.remove('open');
    });
  }

  // ── Sign Out ───────────────────────────────────────────────
  if (navSignOut) {
    navSignOut.addEventListener('click', () => {
      localStorage.removeItem('rkfi_token');
      localStorage.removeItem('rkfi_user');
      window.location.href = 'login.html';
    });
  }

  // ── Profile Editing ────────────────────────────────────────
  if (profileEditBtn) {
    profileEditBtn.addEventListener('click', () => {
      const cached = localStorage.getItem('rkfi_user');
      if (cached) {
        const user = JSON.parse(cached);
        editName.value = user.name || '';
        editPhone.value = user.phone || '';
      }
      profileEdit.style.display = '';
      profileDetails.style.display = 'none';
      profileEditBtn.style.display = 'none';
    });
  }

  if (profileCancelBtn) {
    profileCancelBtn.addEventListener('click', () => {
      profileEdit.style.display = 'none';
      profileDetails.style.display = '';
      profileEditBtn.style.display = '';
    });
  }

  if (profileSaveBtn) {
    profileSaveBtn.addEventListener('click', async () => {
      const newName  = editName.value.trim();
      const newPhone = editPhone.value.trim();

      if (!newName) return;

      profileSaveBtn.disabled = true;
      profileSaveBtn.textContent = 'Saving…';

      try {
        const res = await fetch('/api/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name: newName, phone: newPhone })
        });

        const data = await res.json();
        if (data.success && data.user) {
          localStorage.setItem('rkfi_user', JSON.stringify(data.user));
          renderProfile(data.user);
        }
      } catch { /* silent */ }

      profileSaveBtn.disabled = false;
      profileSaveBtn.textContent = 'Save';
      profileEdit.style.display = 'none';
      profileDetails.style.display = '';
      profileEditBtn.style.display = '';
    });
  }

  // ── Course Data & Modal Handler ──────────────────────────────
  const COURSE_DETAILS = {
    'Direction & Screenwriting': {
      number: '01',
      duration: '12-Month Program',
      badge: 'Intake 2026',
      tagline: 'Master visual storytelling, script structure, and directing actors.',
      img: 'images/screenwriting.png',
      overview: 'The Direction & Screenwriting program at Rajini Kamal Film Institute is a premier 12-month diploma designed for visionary storytellers. Students are guided through every phase of filmmaking—from initial story premise and character development to scene staging, shot listing, on-set actor direction, and final festival cuts. You will collaborate directly with cinematography and editing students on real production sets.',
      format: 'Full-Time Studio Labs & Sets',
      eligibility: '10+2 / Any Graduate (Film Passion)',
      thesis: 'Direct an Original Thesis Short Film',
      curriculum: [
        { module: 'Module 01', title: 'Screenplay Craft & Character Dynamics', desc: 'Three-act structure, non-linear narratives, scene beats, and dialogue polishing.' },
        { module: 'Module 02', title: "Visual Grammar & Director's Breakdown", desc: 'Storyboarding, shot listing, floor plan design, camera movement, and aesthetic composition.' },
        { module: 'Module 03', title: 'Directing Actors & Scene Staging', desc: 'Rehearsal methods, casting techniques, emotional beats, blockings, and managing set dynamics.' },
        { module: 'Module 04', title: 'Diploma Thesis Production & Distribution', desc: 'Directing a 10-minute diploma short film, post-production supervision, and festival entry strategies.' }
      ],
      tools: [
        { name: 'Final Draft 13', cat: 'Screenwriting Industry Standard' },
        { name: 'Celtx & StudioBinder', cat: 'Production Scheduling & Breakdown' },
        { name: 'ShotDesigner', cat: 'Blocking & Floor Plan Visualization' },
        { name: 'Storyboarder', cat: 'Visual Pre-visualization & Animatic' },
        { name: 'ARRI & RED Monitoring', cat: 'On-Set Director Monitors' }
      ],
      careers: [
        'Feature Film Director',
        'Assistant Director (1st AD / 2nd AD)',
        'Screenwriter & Script Doctor',
        'Showrunner & OTT Series Writer',
        'Creative Producer & Script Supervisor'
      ]
    },
    'Cinematography': {
      number: '02',
      duration: '10-Month Program',
      badge: 'Intake 2026',
      tagline: 'Explore camera systems, lighting design, optical physics, and visual composition.',
      img: 'images/cinematography.png',
      overview: 'The Cinematography program trains aspiring Directors of Photography (DoPs) in both the artistic philosophy and rigorous technical skills of motion picture camera craft. From mastering exposure, optics, and camera movement to designing dramatic studio lighting set-ups and digital cinema workflows, students work with industry-standard cameras and lighting gear.',
      format: 'Full-Time Practical Studio & Location Shoots',
      eligibility: 'Passion for Visual Arts & Camera Craft',
      thesis: 'Complete a Feature-Grade Showreel',
      curriculum: [
        { module: 'Module 01', title: 'Optics, Lenses & Exposure Physics', desc: 'Anamorphic & spherical lenses, depth of field, sensor formats, and exposure control.' },
        { module: 'Module 02', title: 'Lighting Aesthetics & Mood Creation', desc: '3-point studio lighting, high-key/low-key setups, LED Skypanels, tungsten, and natural light sculpting.' },
        { module: 'Module 03', title: 'Camera Movement & Advanced Rigging', desc: 'Dolly tracking shots, Jib arms, Steadicam stabilization, and dynamic camera choreography.' },
        { module: 'Module 04', title: 'Digital Cinema Pipelines & Grading Sync', desc: 'RAW log recording, LUT management, ACES color pipelines, and DoP showreel finishing.' }
      ],
      tools: [
        { name: 'ARRI Alexa Mini LF', cat: 'Digital Cinema Camera' },
        { name: 'RED V-Raptor 8K', cat: 'High-Speed Cinema Systems' },
        { name: 'Sony FX9 / FX6', cat: 'Documentary & Narrative Craft' },
        { name: 'Aputure & ARRI Skypanels', cat: 'Studio & Outdoor Lighting' },
        { name: 'Teradek & SmallHD', cat: 'Wireless Video Transmission' }
      ],
      careers: [
        'Director of Photography (DoP)',
        'Camera Operator',
        'Steadicam & Gimbal Specialist',
        'Gaffer / Chief Lighting Technician',
        '1st Assistant Camera (1st AC)'
      ]
    },
    'Post-Production & Editing': {
      number: '03',
      duration: '9-Month Program',
      badge: 'Intake 2026',
      tagline: 'Learn non-linear editing, color grading, sound design, and visual effects workflows.',
      img: 'images/editing.png',
      overview: 'The Post-Production & Editing program prepares students for the fast-paced world of film editing, color finishing, and sound design. You will master cutting-edge non-linear editing platforms, learn color science and skin tone correction in DaVinci Resolve suites, design immersive audio mixes, and composite visual effects for feature films and commercial media.',
      format: 'Full-Time Editing Lab & Grading Suite Access',
      eligibility: 'Basic Computer Proficiency & Eye for Detail',
      thesis: 'Edit & Grade Complete Narrative Short',
      curriculum: [
        { module: 'Module 01', title: 'Non-Linear Narrative Editing & Pacing', desc: 'Assembly, rough cut to fine cut, rhythm, montage theory, match cutting, and continuity editing.' },
        { module: 'Module 02', title: 'Color Grading & Digital Intermediate', desc: 'Color wheels, node trees, secondary qualifiers, film grain emulation, skin-tone matching, and HDR grading.' },
        { module: 'Module 03', title: 'Sound Design & Audio Post-Production', desc: 'Dialogue editing, Foley replacement, sound FX layering, atmosphere creation, and Surround mix.' },
        { module: 'Module 04', title: 'VFX Compositing & Master Delivery', desc: 'Green screen chroma keying, tracking, title design, DCP packaging, and showreel assembly.' }
      ],
      tools: [
        { name: 'DaVinci Resolve Studio', cat: 'Editing & Color Grading Suite' },
        { name: 'Adobe Premiere Pro', cat: 'Industry Standard NLE' },
        { name: 'Avid Media Composer', cat: 'Feature Film Narrative Editing' },
        { name: 'Pro Tools', cat: 'Audio Post & Sound Design' },
        { name: 'Adobe After Effects', cat: 'Motion Graphics & VFX Compositing' }
      ],
      careers: [
        'Lead Film & Trailer Editor',
        'Digital Colorist (DI Artist)',
        'Sound Designer & Audio Editor',
        'VFX Compositor & Motion Designer',
        'Post-Production Supervisor'
      ]
    }
  };

  // ── Modal Elements & Functions ──────────────────────────────
  const courseModal      = document.getElementById('courseModal');
  const modalBackdrop    = document.getElementById('modalBackdrop');
  const modalCloseBtn    = document.getElementById('modalCloseBtn');
  const modalCloseFooter = document.getElementById('modalCloseFooter');
  const modalApplyBtn    = document.getElementById('modalApplyBtn');
  const modalTabs        = document.querySelectorAll('.modal-tab');
  let currentModalCourse = '';

  function openCourseModal(courseName) {
    const data = COURSE_DETAILS[courseName];
    if (!data || !courseModal) return;

    currentModalCourse = courseName;

    // Populate modal fields
    const elNumber = document.getElementById('modalNumber');
    const elTitle  = document.getElementById('modalCourseTitle');
    const elTag    = document.getElementById('modalTagline');
    const elBadge  = document.getElementById('modalBadge');
    const elDur    = document.getElementById('modalDuration');
    const elImg    = document.getElementById('modalImg');
    const elText   = document.getElementById('modalOverviewText');

    if (elNumber) elNumber.textContent = data.number;
    if (elTitle)  elTitle.textContent = courseName;
    if (elTag)    elTag.textContent = data.tagline;
    if (elBadge)  elBadge.textContent = data.badge;
    if (elDur)    elDur.textContent = data.duration;
    if (elImg) {  elImg.src = data.img; elImg.alt = courseName; }
    if (elText)   elText.textContent = data.overview;

    const sDur  = document.getElementById('statDuration');
    const sFmt  = document.getElementById('statFormat');
    const sElg  = document.getElementById('statEligibility');
    const sThs  = document.getElementById('statThesis');

    if (sDur) sDur.textContent = data.duration;
    if (sFmt) sFmt.textContent = data.format;
    if (sElg) sElg.textContent = data.eligibility;
    if (sThs) sThs.textContent = data.thesis;

    // Curriculum
    const curriculumContainer = document.getElementById('modalCurriculum');
    if (curriculumContainer) {
      curriculumContainer.innerHTML = data.curriculum.map(m => `
        <div class="curriculum-card">
          <span class="curriculum-card__module">${m.module}</span>
          <h4 class="curriculum-card__title">${m.title}</h4>
          <p class="curriculum-card__desc">${m.desc}</p>
        </div>
      `).join('');
    }

    // Tools
    const toolsContainer = document.getElementById('modalTools');
    if (toolsContainer) {
      toolsContainer.innerHTML = data.tools.map(t => `
        <div class="tool-card">
          <span class="tool-card__name">${t.name}</span>
          <span class="tool-card__cat">${t.cat}</span>
        </div>
      `).join('');
    }

    // Careers
    const careersContainer = document.getElementById('modalCareers');
    if (careersContainer) {
      careersContainer.innerHTML = data.careers.map(c => `
        <li class="careers-item">${c}</li>
      `).join('');
    }

    // Reset tab to Overview
    switchModalTab('overview');

    // Show modal
    courseModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCourseModal() {
    if (!courseModal) return;
    courseModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function switchModalTab(tabId) {
    modalTabs.forEach(t => {
      t.classList.toggle('modal-tab--active', t.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.modal-tab-content').forEach(c => {
      c.classList.toggle('modal-tab-content--active', c.id === `tab-${tabId}`);
    });
  }

  // Event Listeners for Modal
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeCourseModal);
  if (modalCloseFooter) modalCloseFooter.addEventListener('click', closeCourseModal);
  if (modalBackdrop) modalBackdrop.addEventListener('click', closeCourseModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && courseModal && courseModal.classList.contains('open')) {
      closeCourseModal();
    }
  });

  modalTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchModalTab(tab.getAttribute('data-tab'));
    });
  });

  if (modalApplyBtn) {
    modalApplyBtn.addEventListener('click', () => {
      closeCourseModal();

      // Find and select corresponding card
      const targetCard = Array.from(cards).find(c => c.getAttribute('data-course') === currentModalCourse);
      if (targetCard) selectCard(targetCard);

      // Scroll to registration form
      const regSection = document.getElementById('registrationForm');
      if (regSection) {
        regSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // Attach click events to "Course Details" buttons & cards
  const detailsBtns = document.querySelectorAll('[data-course-details]');
  detailsBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const courseName = btn.getAttribute('data-course-details');
      const parentCard = btn.closest('.course-card');
      if (parentCard) selectCard(parentCard);
      openCourseModal(courseName);
    });
  });

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
