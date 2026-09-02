// Global State
let currentUser = null;
let currentToken = localStorage.getItem('pitch_token') || '';
let currentProfile = null;
let currentAnalysis = null;
let currentSlides = [];
let activePersona = 'skeptical_vc';
let conversationHistory = [];

const PERSONA_INFO = {
  skeptical_vc: {
    name: "Marcus Vance",
    role: "Managing Partner at Benchmark Ventures",
    avatar: "🦈",
    greeting: "Alright, let's skip the fluff. I've seen 5 startups pitching similar ideas this quarter. Tell me: why won't a well-capitalized incumbent crush you in 6 months?"
  },
  tech_angel: {
    name: "Dr. Aris Thorne",
    role: "Deep Tech Angel & Ex-CTO",
    avatar: "🔬",
    greeting: "Walk me through your technical stack and core IP. What is the hardest engineering problem you solved that gives you a genuine barrier to entry?"
  },
  growth_investor: {
    name: "Elena Rostova",
    role: "Partner at Sequoia Growth",
    avatar: "📈",
    greeting: "I love large market opportunities. How exactly are you acquiring your first 100 paying customers, and what is your current monthly customer churn?"
  }
};

// ================= DOM INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
  setupAuth();
  setupTabs();
  setupForms();
  checkSession();
});

// Helper for API calls with Auth header
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }
  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  try {
    const res = await fetch(endpoint, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API Request failed');
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

// ================= AUTHENTICATION SYSTEM =================
function setupAuth() {
  const loginForm = document.getElementById('login-form');
  const logoutBtn = document.getElementById('btn-logout');

  // Login form handler - Accepts ANY non-empty username & password!
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value.trim();

    if (!username || !password) {
      alert("Please enter a username and password.");
      return;
    }

    try {
      const data = await apiCall('/api/auth/login', 'POST', { username, password });
      currentToken = data.token;
      localStorage.setItem('pitch_token', currentToken);
      currentUser = data.user;
      
      updateUserUI();
      hideLoginModal();
      await loadProfile();
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('pitch_token');
    currentToken = '';
    currentUser = null;
    showLoginModal();
  });
}

async function checkSession() {
  if (!currentToken) {
    showLoginModal();
    return;
  }
  try {
    const data = await apiCall('/api/auth/me');
    currentUser = data.user;
    updateUserUI();
    hideLoginModal();
    await loadProfile();
  } catch (err) {
    showLoginModal();
  }
}

function showLoginModal() {
  document.getElementById('login-modal').style.display = 'flex';
}

function hideLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
}

function updateUserUI() {
  if (currentUser) {
    document.getElementById('nav-username').textContent = currentUser.username;
    document.getElementById('nav-avatar').textContent = currentUser.avatar || currentUser.username.charAt(0).toUpperCase();
  }
}

// ================= TAB NAVIGATION =================
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// ================= PRESET LOADER =================
async function loadPreset(presetId) {
  try {
    const presets = await apiCall('/api/pitch/presets');
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      document.getElementById('f-name').value = preset.startupName;
      document.getElementById('f-tagline').value = preset.tagline;
      document.getElementById('f-problem').value = preset.problem;
      document.getElementById('f-customer').value = preset.customer;
      document.getElementById('f-solution').value = preset.solution;
      document.getElementById('f-diff').value = preset.differentiation;
      document.getElementById('f-biz').value = preset.businessModel;
      document.getElementById('f-assumptions').value = preset.assumptions;
      
      // Auto run analysis
      await runAnalysis();
    }
  } catch (err) {
    console.error("Failed to load preset:", err);
  }
}

// ================= WORKSPACE FORM & ANALYSIS =================
function setupForms() {
  const pitchForm = document.getElementById('pitch-form');
  const saveBtn = document.getElementById('btn-save-profile');
  const reanalyzeBtn = document.getElementById('btn-reanalyze');
  const generateDeckBtn = document.getElementById('btn-generate-deck');
  const copyDeckBtn = document.getElementById('btn-copy-deck');
  const chatForm = document.getElementById('chat-form');

  pitchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveProfile();
    await runAnalysis();
    
    // Switch to Ledger tab
    document.querySelector('.tab-btn[data-tab="tab-ledger"]').click();
  });

  saveBtn.addEventListener('click', async () => {
    await saveProfile();
    alert("Startup profile draft saved successfully!");
  });

  reanalyzeBtn.addEventListener('click', async () => {
    await runAnalysis();
  });

  generateDeckBtn.addEventListener('click', async () => {
    await generateDeck();
  });

  copyDeckBtn.addEventListener('click', () => {
    copyDeckMarkdown();
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await sendChatMessage();
  });

  // Init chat simulator with default persona greeting
  initChatSimulator();
}

function getFormData() {
  return {
    startupName: document.getElementById('f-name').value.trim(),
    tagline: document.getElementById('f-tagline').value.trim(),
    problem: document.getElementById('f-problem').value.trim(),
    customer: document.getElementById('f-customer').value.trim(),
    solution: document.getElementById('f-solution').value.trim(),
    differentiation: document.getElementById('f-diff').value.trim(),
    businessModel: document.getElementById('f-biz').value.trim(),
    assumptions: document.getElementById('f-assumptions').value.trim()
  };
}

async function loadProfile() {
  try {
    const profile = await apiCall('/api/pitch/profile');
    if (profile) {
      currentProfile = profile;
      document.getElementById('f-name').value = profile.startupName || '';
      document.getElementById('f-tagline').value = profile.tagline || '';
      document.getElementById('f-problem').value = profile.problem || '';
      document.getElementById('f-customer').value = profile.customer || '';
      document.getElementById('f-solution').value = profile.solution || '';
      document.getElementById('f-diff').value = profile.differentiation || '';
      document.getElementById('f-biz').value = profile.businessModel || '';
      document.getElementById('f-assumptions').value = profile.assumptions || '';
    }
  } catch (err) {
    console.error("Failed to load profile:", err);
  }
}

async function saveProfile() {
  const profile = getFormData();
  try {
    const res = await apiCall('/api/pitch/profile', 'POST', profile);
    currentProfile = res.profile;
  } catch (err) {
    console.error("Save profile error:", err);
  }
}

async function runAnalysis() {
  const profile = getFormData();
  if (!profile.problem || !profile.customer || !profile.solution) {
    alert("Please enter at least Problem, Customer, and Solution to run AI analysis.");
    return;
  }

  try {
    const analysis = await apiCall('/api/pitch/analyze', 'POST', profile);
    currentAnalysis = analysis;
    renderLedger(analysis);
    renderRisks(analysis.risks);
    renderTraceabilityMatrix(analysis);
    
    // Also auto-generate pitch deck
    await generateDeck();
  } catch (err) {
    alert("Analysis failed: " + err.message);
  }
}

// ================= RENDER LEDGER =================
function renderLedger(analysis) {
  const stats = analysis.stats || {};
  document.getElementById('stat-score').textContent = `${stats.readinessScore || 0}%`;
  document.getElementById('stat-facts').textContent = stats.provenFacts || 0;
  document.getElementById('stat-suggestions').textContent = stats.aiSuggestions || 0;
  document.getElementById('stat-assumptions').textContent = stats.weakAssumptions || 0;

  const tbody = document.getElementById('ledger-rows');
  tbody.innerHTML = '';

  (analysis.entries || []).forEach(entry => {
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-fact';
    let badgeText = 'PROVEN FACT';
    if (entry.type === 'ai_suggestion') {
      badgeClass = 'badge-suggestion';
      badgeText = 'AI SUGGESTION';
    } else if (entry.type === 'weak_assumption') {
      badgeClass = 'badge-weak';
      badgeText = 'WEAK ASSUMPTION';
    }

    tr.innerHTML = `
      <td style="font-weight:600; color:var(--text-primary);">${entry.section}</td>
      <td><span class="badge ${badgeClass}">${badgeText}</span></td>
      <td>${entry.claim}</td>
      <td>
        ${entry.question ? `<div class="q-box">❓ ${entry.question}</div>` : '<span style="color:var(--text-muted); font-size:12px;">Verified claim</span>'}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRisks(risks) {
  const container = document.getElementById('risk-list-container');
  container.innerHTML = '';

  if (!risks || risks.length === 0) {
    container.innerHTML = '<div style="color:var(--accent-emerald);">No critical unverified risks flagged!</div>';
    return;
  }

  risks.forEach((risk, i) => {
    const div = document.createElement('div');
    div.className = 'risk-item';
    div.innerHTML = `
      <input type="checkbox" id="risk-check-${i}">
      <label for="risk-check-${i}" style="cursor:pointer; flex:1;">${risk}</label>
    `;
    container.appendChild(div);
  });
}

// ================= PITCH DECK OUTLINE =================
async function generateDeck() {
  const profile = getFormData();
  try {
    const data = await apiCall('/api/pitch/outline', 'POST', profile);
    currentSlides = data.slides || [];
    renderDeck(currentSlides);
  } catch (err) {
    console.error("Generate deck error:", err);
  }
}

function renderDeck(slides) {
  const container = document.getElementById('slides-container');
  container.innerHTML = '';

  if (!slides || slides.length === 0) {
    container.innerHTML = '<div class="card" style="grid-column:1/-1; text-align:center;">No slides generated yet.</div>';
    return;
  }

  slides.forEach(slide => {
    const card = document.createElement('div');
    card.className = 'slide-card';
    
    let badgeClass = 'badge-fact';
    if (slide.traceabilityType === 'weak_assumption') badgeClass = 'badge-weak';
    if (slide.traceabilityType === 'ai_suggestion') badgeClass = 'badge-suggestion';

    card.innerHTML = `
      <div class="slide-num-badge">${slide.slideNumber}</div>
      <div class="slide-subtitle">${slide.subtitle}</div>
      <div class="slide-title">${slide.title}</div>
      <div class="slide-main-content">${slide.content}</div>
      <div style="margin-bottom:12px;">
        <span class="badge ${badgeClass}">${slide.traceabilityTag}</span>
      </div>
      <div style="font-weight:600; font-size:12px; color:var(--text-muted); margin-bottom:6px;">INVESTOR TALKING POINTS:</div>
      ${(slide.talkingPoints || []).map(tp => `<div class="slide-bullet">${tp}</div>`).join('')}
    `;
    container.appendChild(card);
  });
}

function copyDeckMarkdown() {
  if (!currentSlides || currentSlides.length === 0) {
    alert("No pitch deck available to copy. Please run analysis first!");
    return;
  }

  let markdown = `# ${currentProfile?.startupName || 'Startup'} Pitch Deck Outline\n\n`;
  currentSlides.forEach(slide => {
    markdown += `## Slide ${slide.slideNumber}: ${slide.title} (${slide.subtitle})\n`;
    markdown += `**Content:** ${slide.content}\n`;
    markdown += `**Claim Source:** ${slide.traceabilityTag}\n\n`;
    markdown += `**Talking Points:**\n`;
    (slide.talkingPoints || []).forEach(tp => {
      markdown += `- ${tp}\n`;
    });
    markdown += `\n---\n\n`;
  });

  navigator.clipboard.writeText(markdown).then(() => {
    alert("Pitch deck markdown copied to clipboard!");
  }).catch(err => {
    console.error("Clipboard copy failed:", err);
  });
}

// ================= INVESTOR SIMULATOR =================
function selectPersona(personaId) {
  activePersona = personaId;
  document.querySelectorAll('.persona-select-card').forEach(c => c.classList.remove('active'));
  
  if (personaId === 'skeptical_vc') document.getElementById('persona-skeptical').classList.add('active');
  if (personaId === 'tech_angel') document.getElementById('persona-tech').classList.add('active');
  if (personaId === 'growth_investor') document.getElementById('persona-growth').classList.add('active');

  initChatSimulator();
}

function initChatSimulator() {
  const persona = PERSONA_INFO[activePersona];
  const chatMessages = document.getElementById('chat-messages');
  chatMessages.innerHTML = '';
  conversationHistory = [];

  // Add initial investor greeting
  appendMessage('investor', persona.name, persona.avatar, persona.greeting);
}

function appendMessage(sender, name, avatar, text, scoreData = null) {
  const chatMessages = document.getElementById('chat-messages');
  const msgDiv = document.createElement('div');
  msgDiv.className = `msg ${sender}`;

  let scoreHtml = '';
  if (scoreData) {
    scoreHtml = `
      <div class="score-badge-card">
        <div style="font-weight:700; color:var(--accent-cyan); margin-bottom:4px;">
          📊 Response Score: ${scoreData.overallScore}%
        </div>
        <div class="scores-row">
          <div>Clarity: <span class="score-pill">${scoreData.clarityScore}%</span></div>
          <div>Defensibility: <span class="score-pill">${scoreData.defensibilityScore}%</span></div>
          <div>Data Check: <span class="score-pill">${scoreData.factCheckScore}%</span></div>
        </div>
      </div>
    `;
  }

  msgDiv.innerHTML = `
    <div style="font-size:24px;">${avatar}</div>
    <div>
      <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">${name}</div>
      <div class="msg-bubble">${text}</div>
      ${scoreHtml}
    </div>
  `;

  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const userText = input.value.trim();
  if (!userText) return;

  input.value = '';
  const userName = currentUser ? currentUser.username : 'Founder';

  // Append user message
  appendMessage('founder', userName, '🚀', userText);

  try {
    const res = await apiCall('/api/pitch/investor-sim', 'POST', {
      personaId: activePersona,
      userMessage: userText,
      conversationHistory,
      profile: getFormData()
    });

    const persona = PERSONA_INFO[activePersona];
    appendMessage('investor', persona.name, persona.avatar, res.investorReply, res.scores);
  } catch (err) {
    alert("Simulator error: " + err.message);
  }
}

// ================= FACT TRACEABILITY MATRIX =================
function renderTraceabilityMatrix(analysis) {
  const container = document.getElementById('matrix-rows-container');
  container.innerHTML = '';

  const entries = analysis.entries || [];
  if (entries.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted); text-align:center;">No entries analyzed.</div>';
    return;
  }

  entries.forEach(e => {
    const row = document.createElement('div');
    row.className = 'matrix-row';

    let badgeClass = 'badge-fact';
    if (e.type === 'weak_assumption') badgeClass = 'badge-weak';
    if (e.type === 'ai_suggestion') badgeClass = 'badge-suggestion';

    row.innerHTML = `
      <div>
        <div class="claim-title">${e.section}: ${e.claim}</div>
        <div class="claim-source">Source Link: ${e.traceability}</div>
      </div>
      <div>
        <span class="badge ${badgeClass}">${e.type.toUpperCase().replace('_', ' ')}</span>
      </div>
    `;
    container.appendChild(row);
  });
}
