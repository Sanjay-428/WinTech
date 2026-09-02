const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'pitch-coach-secret-key-2026';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Structure
const initialData = {
  profiles: {
    "default": {
      id: "default",
      startupName: "PitchPulse AI",
      tagline: "AI-Powered Investor Readiness & Pitch Pressure Tester",
      problem: "90% of early-stage founders fail pitching investors because they present unverified assumptions as facts, leading to low conversion and wasted meeting rounds.",
      customer: "Seed & Series-A startup founders, incubators, accelerators, and venture studios targeting US & European VC ecosystems.",
      solution: "An intelligent pitch coach that parses founder inputs, separates proven facts from weak assumptions, generates investor deck outlines, and simulates live VC pressure Q&A.",
      differentiation: "Unlike standard pitch deck templates, PitchPulse provides automated fact-vs-assumption ledgering, investor persona simulators, and real-time response traceability scoring.",
      businessModel: "B2B SaaS subscription ($49/month Founder tier, $199/month Accelerator tier) plus pay-per-use investor simulation practice tokens.",
      assumptions: "Founders will spend 20+ minutes pressure-testing pitches before investor calls; VC interview simulation predicts actual pitch success with >80% correlation."
    }
  },
  analyses: {},
  simulations: {}
};

// Helper to read database
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
      return initialData;
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
    return initialData;
  }
}

// Helper to write database
function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing to database:", err);
  }
}

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    req.user = { username: 'GuestFounder' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      req.user = { username: 'GuestFounder' };
    } else {
      req.user = user;
    }
    next();
  });
}

// ==================== AUTH ROUTES ====================

// Requirement: Accepts ANY username & password combination!
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !username.trim()) {
    return res.status(400).json({ error: "Username cannot be empty" });
  }
  
  const cleanUser = username.trim();
  const token = jwt.sign({ username: cleanUser }, JWT_SECRET, { expiresIn: '7d' });
  
  return res.json({
    success: true,
    message: `Welcome back, ${cleanUser}! Logged in successfully.`,
    token,
    user: {
      username: cleanUser,
      role: 'Founder & CEO',
      badge: 'PRO Founder',
      avatar: cleanUser.charAt(0).toUpperCase()
    }
  });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    authenticated: true,
    user: {
      username: req.user.username,
      role: 'Founder & CEO',
      badge: 'PRO Founder',
      avatar: req.user.username.charAt(0).toUpperCase()
    }
  });
});

// ==================== STARTUP PRESETS ====================
app.get('/api/pitch/presets', (req, res) => {
  res.json([
    {
      id: "preset-saas",
      startupName: "PitchPulse AI",
      tagline: "AI-Powered Investor Readiness & Pitch Pressure Tester",
      problem: "90% of early-stage founders fail pitching investors because they present unverified assumptions as facts, leading to low conversion and wasted meeting rounds.",
      customer: "Seed & Series-A startup founders, incubators, accelerators, and venture studios targeting US & European VC ecosystems.",
      solution: "An intelligent pitch coach that parses founder inputs, separates proven facts from weak assumptions, generates investor deck outlines, and simulates live VC pressure Q&A.",
      differentiation: "Unlike standard pitch deck templates, PitchPulse provides automated fact-vs-assumption ledgering, investor persona simulators, and real-time response traceability scoring.",
      businessModel: "B2B SaaS subscription ($49/month Founder tier, $199/month Accelerator tier) plus pay-per-use investor simulation practice tokens.",
      assumptions: "Founders will spend 20+ minutes pressure-testing pitches before investor calls; VC interview simulation predicts actual pitch success with >80% correlation."
    },
    {
      id: "preset-fintech",
      startupName: "NovaShield",
      tagline: "Autonomous Fraud Prevention for Cross-Border Payments",
      problem: "Mid-market e-commerce exporters lose $42B annually to chargebacks and cross-border fraud due to rigid legacy rules engines.",
      customer: "Cross-border Shopify & Magento merchants doing $2M–$50M annual international volume.",
      solution: "Real-time AI behavioral transaction scoring with zero-code API integration and 100% chargeback guarantee.",
      differentiation: "Sub-50ms latency model trained specifically on cross-border corridor telemetry, yielding 40% fewer false positives than Stripe Radar.",
      businessModel: "0.15% fee per processed cross-border transaction + $299/mo enterprise infrastructure fee.",
      assumptions: "Merchants will trust an autonomous AI model over manual review teams; zero-chargeback guarantee margin covers rare AI misclassifications."
    },
    {
      id: "preset-healthtech",
      startupName: "VitalFlow",
      tagline: "Continuous Remote Cardiac Monitoring via Smart Wearables",
      problem: "Post-cardiac surgery patients suffer a 34% 30-day readmission rate due to undetected arrhythmia spikes after hospital discharge.",
      customer: "Cardiology clinic medical directors and hospital system Chief Medical Officers.",
      solution: "FDA-cleared wearable patch with continuous ECG streaming to a clinical dashboard that alerts cardiologists 4 hours before crisis.",
      differentiation: "Patented signal filtering reduces sensor noise by 90% during movement, allowing true 24/7 continuous telemetry.",
      businessModel: "RPM (Remote Patient Monitoring) Medicare CPT code reimbursement split: $120/patient/month recurring.",
      assumptions: "Hospitals can onboard nurses to monitor dashboard alerts without increasing staffing overhead; Medicare reimbursement policies remain stable."
    }
  ]);
});

// ==================== WORKSPACE PROFILE API ====================

app.get('/api/pitch/profile', authenticateToken, (req, res) => {
  const db = readDB();
  const userId = req.user.username || 'default';
  const profile = db.profiles[userId] || db.profiles['default'];
  res.json(profile);
});

app.post('/api/pitch/profile', authenticateToken, (req, res) => {
  const db = readDB();
  const userId = req.user.username || 'default';
  
  const {
    startupName,
    tagline,
    problem,
    customer,
    solution,
    differentiation,
    businessModel,
    assumptions
  } = req.body;

  const updatedProfile = {
    id: userId,
    startupName: startupName || "My AI Startup",
    tagline: tagline || "",
    problem: problem || "",
    customer: customer || "",
    solution: solution || "",
    differentiation: differentiation || "",
    businessModel: businessModel || "",
    assumptions: assumptions || "",
    updatedAt: new Date().toISOString()
  };

  db.profiles[userId] = updatedProfile;
  writeDB(db);

  res.json({ success: true, profile: updatedProfile });
});

// ==================== AI ANALYSIS ENGINE (FACT vs ASSUMPTION) ====================

app.post('/api/pitch/analyze', authenticateToken, (req, res) => {
  const profile = req.body;

  if (!profile.problem || !profile.customer || !profile.solution) {
    return res.status(400).json({ error: "Please fill in at least Problem, Customer, and Solution." });
  }

  // Smart heuristic & rule engine parsing startup inputs into Fact, AI Suggestion, and Weak Assumption
  const entries = [];
  const risks = [];

  // Parse Problem
  if (profile.problem.length > 10) {
    const hasMetrics = /\d+%|\$\d+|\d+B|\d+M|\d+k/i.test(profile.problem);
    if (hasMetrics) {
      entries.push({
        id: 'e1',
        section: 'Problem',
        claim: profile.problem.substring(0, 120) + (profile.problem.length > 120 ? '...' : ''),
        type: 'fact',
        confidence: 'High',
        question: 'What source or primary research validates this specific problem metric?',
        traceability: 'Known User Fact'
      });
    } else {
      entries.push({
        id: 'e1',
        section: 'Problem',
        claim: profile.problem.substring(0, 120) + (profile.problem.length > 120 ? '...' : ''),
        type: 'weak_assumption',
        confidence: 'Low',
        question: 'How many target users have you interviewed who rank this problem as a top-3 priority?',
        traceability: 'Requires Validation'
      });
      risks.push('Problem intensity lacks quantitative verification from interviews.');
    }
  }

  // Parse Customer
  if (profile.customer.length > 10) {
    const isSpecific = /series|mid-market|developers|clinics|shopify|b2b|b2c|founders|enterprise|merchants/i.test(profile.customer);
    if (isSpecific) {
      entries.push({
        id: 'e2',
        section: 'Customer',
        claim: `Target Segment: ${profile.customer.substring(0, 100)}`,
        type: 'fact',
        confidence: 'Medium',
        question: 'What is your estimated Total Addressable Market (TAM) and Serviceable Obtainable Market (SOM) for this segment?',
        traceability: 'Known User Fact'
      });
    } else {
      entries.push({
        id: 'e2',
        section: 'Customer',
        claim: `Target Segment: ${profile.customer.substring(0, 100)}`,
        type: 'weak_assumption',
        confidence: 'Low',
        question: 'Is this customer profile too broad? Who is the immediate economic buyer?',
        traceability: 'Requires Validation'
      });
      risks.push('Customer profile may be too broad for targeted low-CAC acquisition.');
    }
  }

  // Parse Solution
  if (profile.solution.length > 10) {
    entries.push({
      id: 'e3',
      section: 'Solution',
      claim: `Core Product: ${profile.solution.substring(0, 110)}`,
      type: 'fact',
      confidence: 'High',
      question: 'What is the current build state (Prototype, MVP, Live Beta, or Revenue)?',
      traceability: 'Known User Fact'
    });
  }

  // AI Suggestion on Solution / Growth Angle
  entries.push({
    id: 'e4',
    section: 'Growth AI Suggestion',
    claim: 'AI Suggestion: Consider bundling an automated executive summary report generator to increase retention.',
    type: 'ai_suggestion',
    confidence: 'AI High',
    question: 'Would offering self-serve analytics increase buyer expansion ARR?',
    traceability: 'AI Recommendation'
  });

  // Parse Differentiation
  if (profile.differentiation && profile.differentiation.length > 10) {
    const hasDefensibility = /patent|proprietary|telemetry|network effect|workflow|latency|data/i.test(profile.differentiation);
    if (hasDefensibility) {
      entries.push({
        id: 'e5',
        section: 'Differentiation',
        claim: `Defensibility Moat: ${profile.differentiation.substring(0, 110)}`,
        type: 'fact',
        confidence: 'High',
        question: 'How quickly could an incumbent (e.g. OpenAI, Stripe, Salesforce) copy this moat?',
        traceability: 'Known User Fact'
      });
    } else {
      entries.push({
        id: 'e5',
        section: 'Differentiation',
        claim: `Defensibility: ${profile.differentiation.substring(0, 110)}`,
        type: 'weak_assumption',
        confidence: 'Low',
        question: 'Why won\'t existing incumbents add this feature in their next release?',
        traceability: 'Requires Validation'
      });
      risks.push('Moat vulnerability: Incumbents could replicate core feature rapidly.');
    }
  } else {
    entries.push({
      id: 'e5',
      section: 'Differentiation',
      claim: 'Differentiation not explicitly specified.',
      type: 'weak_assumption',
      confidence: 'Low',
      question: 'What prevents a well-funded competitor from copying your product in 3 months?',
      traceability: 'Missing Critical Fact'
    });
    risks.push('Missing competitive moat definition.');
  }

  // Parse Business Model
  if (profile.businessModel && profile.businessModel.length > 10) {
    entries.push({
      id: 'e6',
      section: 'Business Model',
      claim: `Monetization: ${profile.businessModel.substring(0, 110)}`,
      type: 'fact',
      confidence: 'Medium',
      question: 'What are your target CAC (Customer Acquisition Cost) and LTV (Lifetime Value) assumptions?',
      traceability: 'Known User Fact'
    });
  } else {
    entries.push({
      id: 'e6',
      section: 'Business Model',
      claim: 'Monetization strategy unclear.',
      type: 'weak_assumption',
      confidence: 'Low',
      question: 'How do you plan to price this service to reach $1M ARR within 18 months?',
      traceability: 'Missing Critical Fact'
    });
    risks.push('Business model requires clear pricing & unit economics model.');
  }

  // Parse Stated Assumptions
  if (profile.assumptions && profile.assumptions.length > 10) {
    entries.push({
      id: 'e7',
      section: 'Founder Assumptions',
      claim: `Stated Risk: ${profile.assumptions.substring(0, 110)}`,
      type: 'weak_assumption',
      confidence: 'Low',
      question: 'What fast 2-week experiment can you run to test and de-risk this assumption?',
      traceability: 'Founder Stated Assumption'
    });
    risks.push(`Founder assumption needs validation experiment: "${profile.assumptions.substring(0, 70)}..."`);
  }

  const analysisResult = {
    analyzedAt: new Date().toISOString(),
    startupName: profile.startupName || "Startup Idea",
    stats: {
      totalClaims: entries.length,
      provenFacts: entries.filter(e => e.type === 'fact').length,
      aiSuggestions: entries.filter(e => e.type === 'ai_suggestion').length,
      weakAssumptions: entries.filter(e => e.type === 'weak_assumption').length,
      readinessScore: Math.round((entries.filter(e => e.type === 'fact').length / entries.length) * 100)
    },
    entries,
    risks
  };

  // Save analysis to DB
  const db = readDB();
  const userId = req.user.username || 'default';
  db.analyses[userId] = analysisResult;
  writeDB(db);

  res.json(analysisResult);
});

// ==================== PITCH DECK OUTLINE GENERATOR ====================

app.post('/api/pitch/outline', authenticateToken, (req, res) => {
  const profile = req.body;
  const startup = profile.startupName || "My Startup";

  const slides = [
    {
      slideNumber: 1,
      title: "Title & Vision",
      subtitle: "The Hook",
      content: `${startup}: ${profile.tagline || profile.solution || "Revolutionizing our industry with AI"}`,
      talkingPoints: [
        `Introduce ${startup} and the core vision.`,
        "Establish immediate credibility and market relevance.",
        "Set up the problem narrative."
      ],
      traceabilityTag: "Proven Fact",
      traceabilityType: "fact"
    },
    {
      slideNumber: 2,
      title: "The Problem",
      subtitle: "Industry Pain Point",
      content: profile.problem || "Significant unaddressed market friction impacting key stakeholders.",
      talkingPoints: [
        "Quantify the cost of inaction for target customers.",
        "Highlight why existing workarounds are failing.",
        "Connect directly to emotional or financial urgency."
      ],
      traceabilityTag: "User Fact / Validated Pain",
      traceabilityType: "fact"
    },
    {
      slideNumber: 3,
      title: "Target Customer & TAM",
      subtitle: "Market Opportunity",
      content: `Targeting: ${profile.customer || "High-value market segment"}`,
      talkingPoints: [
        "Define the ICP (Ideal Customer Profile) clearly.",
        "Outline Bottom-Up market sizing (TAM -> SAM -> SOM).",
        "Demonstrate high urgency and willingness to pay."
      ],
      traceabilityTag: "Market Assumption",
      traceabilityType: "weak_assumption"
    },
    {
      slideNumber: 4,
      title: "The Solution & Product",
      subtitle: "How It Works",
      content: profile.solution || "Innovative automated solution delivering immediate value.",
      talkingPoints: [
        "Showcase product UX / Workflow speed.",
        "Demonstrate the 10x improvement over legacy solutions.",
        "Highlight customer delight or early pilot feedback."
      ],
      traceabilityTag: "Core Product Fact",
      traceabilityType: "fact"
    },
    {
      slideNumber: 5,
      title: "Differentiation & Defensibility",
      subtitle: "Why We Win (The Moat)",
      content: profile.differentiation || "Proprietary workflow, data network effects, or technology barrier.",
      talkingPoints: [
        "Explain why incumbents cannot easily copy this.",
        "Detail proprietary IP, algorithms, or telemetry loops.",
        "Show how moat expands as market scale increases."
      ],
      traceabilityTag: "Moat Claim",
      traceabilityType: profile.differentiation ? "fact" : "weak_assumption"
    },
    {
      slideNumber: 6,
      title: "Business Model & Unit Economics",
      subtitle: "Monetization Strategy",
      content: profile.businessModel || "Predictable recurring revenue model.",
      talkingPoints: [
        "Break down pricing tiers & expansion levers.",
        "Provide estimated CAC payback period and LTV/CAC ratio.",
        "Outline sales channel strategy (PLG vs Direct Enterprise)."
      ],
      traceabilityTag: "Financial Model",
      traceabilityType: "fact"
    },
    {
      slideNumber: 7,
      title: "Key Risks & Validation Roadmap",
      subtitle: "Founder Transparency",
      content: profile.assumptions ? `Validating core risk: ${profile.assumptions}` : "De-risking technical execution and customer acquisition speed.",
      talkingPoints: [
        "Acknowledge top 2 critical assumptions explicitly.",
        "Share active experiments running to prove assumptions.",
        "Build deep investor trust through intellectual honesty."
      ],
      traceabilityTag: "Assumptions Needing Proof",
      traceabilityType: "weak_assumption"
    },
    {
      slideNumber: 8,
      title: "The Ask & Milestones",
      subtitle: "Growth Trajectory",
      content: "Seeking funding to scale engineering, accelerate go-to-market, and reach key ARR milestone in 18 months.",
      talkingPoints: [
        "State precise funding ask and use of funds.",
        "Map key 12-month operational & revenue milestones.",
        "Introduce key team members and advisory strength."
      ],
      traceabilityTag: "Strategic Plan",
      traceabilityType: "ai_suggestion"
    }
  ];

  res.json({
    startupName: startup,
    generatedAt: new Date().toISOString(),
    totalSlides: slides.length,
    slides
  });
});

// ==================== INVESTOR Q&A PRACTICE ROOM SIMULATOR ====================

const PERSONAS = {
  skeptical_vc: {
    name: "Marcus Vance",
    role: "Managing Partner at Benchmark Ventures",
    focus: "Unit Economics, LTV/CAC, Competitive Defense",
    avatar: "🦈",
    greeting: "Alright, let's skip the fluff. I've seen 5 startups pitching similar ideas this quarter. Tell me: why won't a well-capitalized incumbent crush you in 6 months?"
  },
  tech_angel: {
    name: "Dr. Aris Thorne",
    role: "Deep Tech Angel & Ex-CTO",
    focus: "Product Architecture, IP, Scalability",
    avatar: "🔬",
    greeting: "Walk me through your technical stack and core IP. What is the hardest engineering problem you solved that gives you a genuine barrier to entry?"
  },
  growth_investor: {
    name: "Elena Rostova",
    role: "Partner at Sequoia Growth",
    focus: "TAM, Go-to-Market, Customer Retention",
    avatar: "📈",
    greeting: "I love large market opportunities. How exactly are you acquiring your first 100 paying customers, and what is your current monthly customer churn?"
  }
};

app.get('/api/pitch/investor-personas', (req, res) => {
  res.json(PERSONAS);
});

app.post('/api/pitch/investor-sim', authenticateToken, (req, res) => {
  const { personaId, userMessage, conversationHistory, profile } = req.body;
  const persona = PERSONAS[personaId] || PERSONAS.skeptical_vc;

  if (!userMessage || !userMessage.trim()) {
    return res.status(400).json({ error: "Message cannot be empty." });
  }

  const responseText = userMessage.trim();
  const lowerResp = responseText.toLowerCase();

  // Evaluate founder response metrics
  let clarityScore = 70;
  let defensibilityScore = 65;
  let factCheckScore = 60;
  let feedbackNotes = [];

  // Check metrics & keywords
  if (/\d+%|\$\d+|\d+M|\d+k|customers|revenue|cbt|cac|ltv|mrr/i.test(responseText)) {
    factCheckScore += 25;
    feedbackNotes.push("Great job backing up your response with concrete numbers and data!");
  } else {
    feedbackNotes.push("Tip: Add specific quantitative metrics (e.g. CAC, conversion rates, customer numbers) to strengthen credibility.");
  }

  if (lowerResp.length > 80) {
    clarityScore += 15;
  } else {
    feedbackNotes.push("Your answer was quite brief. Elaborate slightly to demonstrate deep domain authority.");
  }

  if (/patent|moat|proprietary|telemetry|workflow|exclusive|data flywheel|defensible/i.test(lowerResp)) {
    defensibilityScore += 25;
    feedbackNotes.push("Strong defensibility narrative established.");
  }

  // Cap scores at 98
  clarityScore = Math.min(clarityScore, 98);
  defensibilityScore = Math.min(defensibilityScore, 98);
  factCheckScore = Math.min(factCheckScore, 98);
  const overallScore = Math.round((clarityScore + defensibilityScore + factCheckScore) / 3);

  // Generate Persona Pushback Question
  let investorReply = "";
  let followUpQuestion = "";

  if (personaId === 'skeptical_vc') {
    if (overallScore > 80) {
      investorReply = "That's a solid answer with real metrics. However, let's talk pricing power. If you double your prices tomorrow, how many of your current customers would churn?";
    } else {
      investorReply = "I'm still hearing a lot of assumptions. If an investor hands you $1M today, exactly what percentage goes into engineering vs customer acquisition, and what is the payback period?";
    }
  } else if (personaId === 'tech_angel') {
    if (overallScore > 80) {
      investorReply = "Fascinating architecture. What is your system's single point of failure under 10x traffic spike, and how do you protect user data privacy?";
    } else {
      investorReply = "You explained the high-level concept, but how proprietary is the underlying code? Can a team of 3 engineers replicate this in 2 months?";
    }
  } else {
    // growth_investor
    if (overallScore > 80) {
      investorReply = "Impressive customer acquisition logic. What channel has yielded your lowest CAC so far, and how far can that channel scale before saturating?";
    } else {
      investorReply = "That sounds promising, but go-to-market is where startups die. What is your sales cycle length, and who is the exact decision-maker holding the wallet?";
    }
  }

  res.json({
    persona: persona.name,
    personaRole: persona.role,
    avatar: persona.avatar,
    investorReply,
    scores: {
      overallScore,
      clarityScore,
      defensibilityScore,
      factCheckScore
    },
    feedbackNotes
  });
});

// Fallback to SPA index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 AI Startup Pitch Coach Server running on http://localhost:${PORT}`);
});
