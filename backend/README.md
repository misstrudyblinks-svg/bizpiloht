# BizPilot AI Phase 2 — secure AI backend

This Node.js API supports **both Google Gemini and OpenAI**. The user chooses a provider in the chat UI. Provider keys stay on the server and are never sent to the browser.

## 1. Firebase Admin service account

The browser Firebase configuration is not enough to verify user ID tokens on the server. In Firebase Console for your `bizpiloht` project, open **Project settings → Service accounts → Generate new private key**. Keep the downloaded JSON private. Add its entire contents as one-line JSON in your backend host environment variable named `FIREBASE_SERVICE_ACCOUNT_JSON`. Never commit the JSON file or share it publicly. If a service-account key was ever exposed, revoke it and generate a new one.

## 2. Add AI provider keys

Create API keys in the provider dashboards and add them as backend environment variables:

- `GEMINI_API_KEY` for Google Gemini
- `OPENAI_API_KEY` for OpenAI

You can configure either provider or both. The UI lets the signed-in user select the provider; a request fails clearly if that provider's key is missing. Optional model variables: `GEMINI_MODEL` (default `gemini-2.5-flash`) and `OPENAI_MODEL` (default `gpt-4o-mini`).

## 3. Run locally

Use Node.js 20 or newer.

```bash
cd backend
npm install
cp .env.example .env
```

Edit `.env`, add the Firebase service-account JSON and at least one AI key. Set `ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500`. Then run:

```bash
npm start
```

The API health check is `http://localhost:3000/api/health`.

## 4. Connect frontend to backend

In the project root `app.js`, set `API_BASE_URL` to `http://localhost:3000` for local development. For deployment, use the HTTPS URL of your deployed backend, for example `https://your-bizpilot-api.onrender.com` (no trailing slash). Set backend `ALLOWED_ORIGINS` to the exact frontend origin(s), such as your Firebase Hosting or Vercel domain.

## 5. Deploy backend (Render example)

Create a new **Web Service** from this project repository:

- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `npm start`
- Runtime: Node

Add the environment variables listed in `.env.example` in Render's Environment settings. Set `ALLOWED_ORIGINS` to your live frontend URL. Do not upload `.env` or service-account JSON into GitHub. Once deployed, open `/api/health` and confirm the service responds.

## Security notes

- `/api/chat` requires a valid Firebase Authentication ID token.
- Basic per-IP rate limiting, JSON size limits, Helmet headers and origin checks are enabled.
- Never put Gemini/OpenAI API keys or Firebase Admin private keys in frontend files.
- For production, add per-user usage quotas, billing controls, request logging with sensitive content redacted, and abuse monitoring before opening public registration widely.
