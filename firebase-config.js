/*
 * Paste your Firebase web config here (Firebase console → Project settings → Your apps → Web app → Config).
 */
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR-PROJECT-ID.firebaseapp.com",
  projectId: "YOUR-PROJECT-ID",
  storageBucket: "YOUR-PROJECT-ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/* Free plan setup: the app saves straight to your Firestore database. */
window.WIYS = { useServer: false };
