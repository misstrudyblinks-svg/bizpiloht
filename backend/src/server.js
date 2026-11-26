import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500').split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({ origin(origin, cb) { if (!origin || allowedOrigins.includes(origin)) return cb(null, true); return cb(new Error('Origin not allowed by CORS')); }, methods: ['GET','POST'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '30kb' }));
app.use('/api/', rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

function initFirebaseAdmin() {
  if (getApps().length) return getAuth();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to backend environment variables.');
  let serviceAccount;
  try { serviceAccount = JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.'); }
  initializeApp({ credential: cert(serviceAccount) });
  return getAuth();
}
async function requireUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in to use the AI assistant.' });
    const decoded = await initFirebaseAdmin().verifyIdToken(header.slice(7));
    req.user = decoded; next();
  } catch (err) {
    console.error('Authentication failure:', err.message);
    return res.status(401).json({ error: 'Your session could not be verified. Please sign in again.' });
  }
}
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'BizPilot AI API', aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY) }));

async function askGemini(message, history) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Gemini is not configured on the server. Add GEMINI_API_KEY.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = [...history, { role: 'user', content: message }].slice(-13).map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content).slice(0, 6000) }] }));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: 'You are BizPilot AI, a practical and professional business assistant. Give clear, actionable, honest guidance. Ask a concise clarifying question when needed. Do not claim to have performed actions outside this chat. For legal, tax, financial, or regulated matters, explain limitations and recommend qualified professional review.' }] }, contents, generationConfig: { temperature: 0.6, maxOutputTokens: 1400 } }) });
  const data = await r.json();
  if (!r.ok) { console.error('Gemini error:', data.error?.message || r.status); throw new Error(data.error?.message || 'Gemini request failed.'); }
  return data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || 'I could not generate a response. Please try again.';
}
async function askOpenAI(message, history) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OpenAI is not configured on the server. Add OPENAI_API_KEY.');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const messages = [{ role: 'system', content: 'You are BizPilot AI, a practical and professional business assistant. Give clear, actionable, honest guidance. Ask a concise clarifying question when needed. Do not claim to have performed actions outside this chat. For legal, tax, financial, or regulated matters, explain limitations and recommend qualified professional review.' }, ...history.slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 6000) })), { role: 'user', content: message }];
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 1400 }) });
  const data = await r.json();
  if (!r.ok) { console.error('OpenAI error:', data.error?.message || r.status); throw new Error(data.error?.message || 'OpenAI request failed.'); }
  return data.choices?.[0]?.message?.content?.trim() || 'I could not generate a response. Please try again.';
}
app.post('/api/chat', requireUser, async (req, res) => {
  try {
    const { message, history = [], provider = process.env.AI_PROVIDER || 'gemini' } = req.body || {};
    if (typeof message !== 'string' || !message.trim() || message.length > 6000) return res.status(400).json({ error: 'Enter a message of up to 6,000 characters.' });
    if (!['gemini','openai'].includes(provider)) return res.status(400).json({ error: 'Choose Gemini or OpenAI as your AI provider.' });
    const safeHistory = Array.isArray(history) ? history.filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').slice(-12) : [];
    const reply = provider === 'openai' ? await askOpenAI(message.trim(), safeHistory) : await askGemini(message.trim(), safeHistory);
    return res.json({ reply, provider });
  } catch (err) {
    console.error('Chat request failed:', err.message);
    const status = /not configured/.test(err.message) ? 503 : 502;
    return res.status(status).json({ error: err.message || 'The AI service is temporarily unavailable.' });
  }
});
app.use((err, _req, res, _next) => { console.error(err.message); res.status(500).json({ error: 'Server error.' }); });
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`BizPilot AI API listening on ${port}`));
