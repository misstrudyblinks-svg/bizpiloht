// BizPilot AI Firebase configuration
// This file uses the Firebase browser SDK modules, so no npm build step is required.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCSN-0DDoI4tt24hAvmXl5IA2ibOa133EY",
  authDomain: "bizpiloht.firebaseapp.com",
  projectId: "bizpiloht",
  storageBucket: "bizpiloht.firebasestorage.app",
  messagingSenderId: "380330342248",
  appId: "1:380330342248:web:2b2b8cdaa1dd0ba530c8dd",
  measurementId: "G-KVN4K0R1EM"
};

// Storage and Analytics are not required for Phase 1 authentication.
// Check only the fields needed to initialize Firebase Auth and Firestore.
const requiredFields = ["apiKey", "authDomain", "projectId", "messagingSenderId", "appId"];
export const isFirebaseConfigured = requiredFields.every((key) => {
  const value = firebaseConfig[key];
  return typeof value === "string" && value.trim().length > 0 && !value.includes("YOUR_");
});

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
