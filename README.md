# BizPilot AI — Phase 2

A responsive web/mobile-ready business assistant workspace built with HTML, CSS, JavaScript modules and Firebase, now with an AI chat interface and secure dual-provider backend.

## Phase 2 features

- Firebase email/password authentication (existing Phase 1)
- AI Assistant chat interface with Gemini / OpenAI provider selector
- Secure Node.js backend verifies Firebase Authentication ID tokens
- AI API keys are stored only in backend environment variables
- Private per-user Firestore conversations and message history
- Create new chats, reopen saved chats, and continue conversations
- Responsive chat layout for desktop and mobile
- Backend health endpoint, CORS allowlist, Helmet headers and basic rate limiting

## 1. Firebase setup

The provided `firebase.js` retains the web configuration for Firebase project `bizpiloht`. In Firebase Console:

1. Enable **Authentication → Sign-in method → Email/Password**.
2. Create a **Cloud Firestore** database.
3. Publish the `firestore.rules` rules in this project.
4. Add your live frontend domain to Authentication → Settings → Authorized domains.

## 2. Start the frontend

Run a local web server from the project root, for example:

```bash
python -m http.server 5500
```

Open `http://localhost:5500`. Do not open `index.html` directly as a `file://` URL.

## 3. Start and configure the AI backend

Read **`backend/README.md`** carefully. You need a Firebase Admin service-account JSON and at least one AI provider key (Gemini or OpenAI). Add them to the backend environment variables only. Never paste private keys into `firebase.js`, `app.js`, or any browser file.

The frontend defaults to `http://localhost:3000` for local backend use. Start the backend with `cd backend`, `npm install`, configure `.env` from `.env.example`, then `npm start`.

For deployment, deploy the `backend` folder as a Node Web Service (Render instructions are in `backend/README.md`) and change `API_BASE_URL` in `app.js` to its HTTPS URL. Set backend `ALLOWED_ORIGINS` to your exact frontend domain.

## 4. Select your AI provider

The chat screen includes a provider selector. Configure `GEMINI_API_KEY`, `OPENAI_API_KEY`, or both on the backend. The selected provider must have its key configured. Default models are Gemini `gemini-2.5-flash` and OpenAI `gpt-4o-mini`; both can be changed with environment variables.

## Project structure

```text
bizpilot-ai-phase1/
├── index.html
├── styles.css
├── app.js
├── firebase.js
├── firestore.rules
├── manifest.json
├── service-worker.js
├── assets/logo.svg
└── backend/
    ├── package.json
    ├── .env.example
    ├── README.md
    └── src/server.js
```

## Before production

Add user-level usage quotas and billing limits, monitor provider costs, test Firestore rules with the Firebase Emulator, and review privacy/data-retention requirements. The assistant can make mistakes; verify important business, legal, tax and financial decisions.
