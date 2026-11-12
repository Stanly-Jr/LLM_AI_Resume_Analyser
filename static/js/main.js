/* ─────────────────────────────────────────────
   ResumeIQ – main.js
───────────────────────────────────────────── */

const $ = id => document.getElementById(id);

// Pages
const pageUpload  = $('page-upload');
const pageLoading = $('page-loading');
const pageResults = $('page-results');

// Upload elements
const dropZone   = $('drop-zone');
const fileInput  = $('file-input');
const browseBtn  = $('browse-btn');
const analyseBtn = $('analyse-btn');
const fileNameDisplay = $('file-name-display');

let selectedFile = null;

// ─── File selection ───────────────────────────
browseBtn.addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
dropZone.addEventListener('click',  () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

// Drag & drop
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

function handleFile(file) {
  const allowed = ['pdf','doc','docx','txt'];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) { showToast(`Unsupported file type: .${ext}`); return; }
  selectedFile = file;
  fileNameDisplay.textContent = `📎 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  fileNameDisplay.classList.remove('hidden');
  analyseBtn.classList.remove('hidden');
}

// ─── Analyse ─────────────────────────────────
analyseBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  showPage(pageLoading);
  animateLoadingSteps();

  const formData = new FormData();
  formData.append('resume', selectedFile);

  try {
    const res  = await fetch('/analyse', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok || data.error) {
      showPage(pageUpload);
      showToast(data.error || 'Server error – please try again.');
      return;
    }

    renderResults(data);
    showPage(pageResults);
  } catch (err) {
    showPage(pageUpload);
    showToast('Network error – is the server running?');
  }
});

// ─── New analysis ─────────────────────────────
$('new-analysis-btn').addEventListener('click', () => {
  fileInput.value = '';
  selectedFile = null;
  fileNameDisplay.classList.add('hidden');
  analyseBtn.classList.add('hidden');
  fileNameDisplay.textContent = '';
  showPage(pageUpload);
});

// ─── Page switching ───────────────────────────
function showPage(page) {
  [pageUpload, pageLoading, pageResults].forEach(p => p.classList.remove('active'));
  page.classList.add('active');
}

// ─── Loading animation ────────────────────────
let stepTimer = null;
function animateLoadingSteps() {
  const steps = ['s1','s2','s3','s4'];
  const msgs  = ['Reading document…','Running AI analysis…','Calculating scores…','Building report…'];
  let i = 0;
  steps.forEach(id => { $(id).className = 'step'; });
  if (stepTimer) clearInterval(stepTimer);

  stepTimer = setInterval(() => {
    if (i > 0) $(steps[i-1]).className = 'step done';
    if (i < steps.length) {
      $(steps[i]).className = 'step active';
      $('loading-step').textContent = msgs[i];
      i++;
    } else {
      clearInterval(stepTimer);
    }
  }, 2000);
}

// ─── Render Results ───────────────────────────
function renderResults(d) {
  // Scorecard
  $('candidate-name').textContent = d.candidate_name || 'Resume Analysis';
  $('career-level-badge').textContent =
    `${d.career_level || ''} · ~${d.estimated_experience_years || 0} yrs exp`;
  $('summary-text').textContent = d.summary || '';

  // Score ring
  animateScore(d.overall_score || 0, d.grade || '–');

  // ATS bar
  const atsScore = d.ats_compatibility?.score || 0;
  setTimeout(() => {
    $('ats-bar').style.width = atsScore + '%';
    $('ats-score-num').textContent = atsScore;
  }, 400);

  // Section breakdown
  const sectionMeta = {
    contact_info:    '📧 Contact Info',
    work_experience: '💼 Work Experience',
    education:       '🎓 Education',
    skills:          '🛠️ Skills',
    formatting:      '📐 Formatting',
    impact_metrics:  '📈 Impact & Metrics',
  };
  const grid = $('section-grid');
  grid.innerHTML = '';
  for (const [key, label] of Object.entries(sectionMeta)) {
    const sec = d.sections?.[key];
    if (!sec) continue;
    const sc = sec.score || 0;
    const cls = sc >= 75 ? 'high' : sc >= 50 ? 'mid' : 'low';
    const issues = (sec.issues || []).map(i => `<li>${i}</li>`).join('');
    grid.innerHTML += `
      <div class="section-card ${cls}">
        <div class="section-card-header">
          <span class="section-card-name">${label}</span>
          <span class="section-card-score" style="color:${cls==='high'?'var(--accent2)':cls==='mid'?'var(--warn)':'var(--danger)'}">${sc}/100</span>
        </div>
        <div class="section-score-bar-wrap">
          <div class="section-score-bar" style="width:${sc}%"></div>
        </div>
        <p class="section-feedback">${sec.feedback || ''}</p>
        ${issues ? `<ul class="section-issues">${issues}</ul>` : ''}
      </div>`;
  }

  // Chips
  renderChipList('strengths-list',   d.key_strengths           || []);
  renderChipList('improvements-list',d.critical_improvements   || []);
  renderChipList('quickwins-list',   d.quick_wins              || []);

  // Keywords
  renderTags('kw-found',   d.keywords_found   || [], 'found');
  renderTags('kw-missing', d.keywords_missing || [], 'missing');

  // ATS
  $('ats-verdict').textContent = d.ats_compatibility?.verdict || '';
  const atsTips = $('ats-tips');
  atsTips.innerHTML = (d.ats_compatibility?.tips || [])
    .map(t => `<li>${t}</li>`).join('');

  // Bullet rewrites
  const rewrites = d.rewritten_bullet_examples || [];
  const rSection = $('rewrites-section');
  const rList    = $('rewrites-list');
  rList.innerHTML = '';
  if (rewrites.length === 0 || rewrites[0]?.original === 'N/A – no bullets found') {
    rSection.style.display = 'none';
  } else {
    rSection.style.display = '';
    rewrites.forEach(r => {
      rList.innerHTML += `
        <div class="rewrite-card">
          <div class="rewrite-row">
            <div class="rewrite-col orig">
              <label>Before</label>
              <p>${r.original || ''}</p>
            </div>
            <div class="rewrite-col improved">
              <label>After ✨</label>
              <p>${r.improved || ''}</p>
            </div>
          </div>
          <div class="rewrite-reason"><span>Why: </span>${r.reason || ''}</div>
        </div>`;
    });
  }

  // Industry
  const indTags = $('industry-tags');
  indTags.innerHTML = (d.industry_fit || [])
    .map(i => `<span class="tag">${i}</span>`).join('');
}

function animateScore(target, grade) {
  const circumference = 314.159;
  const arc = $('score-arc');
  const numEl = $('score-number');
  const gradeEl = $('grade-badge');

  // Add SVG gradient if not present
  let svg = document.querySelector('.score-ring');
  if (!svg.querySelector('defs')) {
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#6c63ff"/>
      <stop offset="100%" stop-color="#00d4aa"/>
    </linearGradient>`;
    svg.prepend(defs);
    arc.setAttribute('stroke','url(#grad)');
  }

  let current = 0;
  const duration = 1500;
  const start = performance.now();
  function tick(now) {
    const pct = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    current = Math.round(target * ease);
    numEl.textContent = current;
    arc.style.strokeDashoffset = circumference * (1 - current / 100);
    if (pct < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  gradeEl.textContent = grade;
}

function renderChipList(id, items) {
  $(id).innerHTML = items.map(i => `<li>${i}</li>`).join('');
}

function renderTags(id, items, type) {
  $(id).innerHTML = items.map(t => `<span class="tag">${t}</span>`).join('');
}

// ─── Toast ────────────────────────────────────
function showToast(msg) {
  $('toast-msg').textContent = msg;
  $('toast').classList.remove('hidden');
  setTimeout(() => $('toast').classList.add('hidden'), 6000);
}
function hideToast() { $('toast').classList.add('hidden'); }

