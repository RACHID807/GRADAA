// ============================================================
// firebase-config.js — Configuration Firebase GRADA
// ============================================================
// IMPORTANT: Remplacez ces valeurs par celles de votre projet
// Firebase Console → Project Settings → Your apps → SDK setup
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "VOTRE_API_KEY",
  authDomain: "grada-aeemci.firebaseapp.com",
  projectId: "grada-aeemci",
  storageBucket: "grada-aeemci.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId: "VOTRE_APP_ID",
  measurementId: "VOTRE_MEASUREMENT_ID"
};

// ─── Configuration de l'événement (modifiable pour les prochaines éditions) ───
const EVENT_CONFIG = {
  id: "gradaa-2026",
  name: "GRADAA 2026",
  fullName: "Grand Rassemblement des Aeemcistes d'Anyama",
  date: "2026-10-04",
  dateDisplay: "4 octobre 2026",
  location: "Anyama, Côte d'Ivoire",
  organizer: "Sous-comité 1-2 Anyama de l'AEEMCI",
  organizerFull: "Association des Élèves et Étudiants Musulmans de Côte d'Ivoire",
  subCommittees: ["Anyama 1", "Anyama 2"],
  checkinUrl: window.location.origin + "/checkin.html"
};

// ─── Configuration EmailJS ───────────────────────────────────────────────────
const EMAILJS_CONFIG = {
  publicKey: "VOTRE_EMAILJS_PUBLIC_KEY",
  serviceId: "service_grada",
  templateId: "template_receipt"
};

// ─── Initialisation Firebase ─────────────────────────────────────────────────
firebase.initializeApp(FIREBASE_CONFIG);

const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// Export pour usage dans les autres modules
window.GRADAA = {
  db,
  auth,
  storage,
  EVENT_CONFIG,
  EMAILJS_CONFIG
};
