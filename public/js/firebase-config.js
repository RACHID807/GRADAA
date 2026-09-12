// ============================================================
// firebase-config.js — Configuration Firebase GRADA
// ============================================================
// IMPORTANT: Remplacez ces valeurs par celles de votre projet
// Firebase Console → Project Settings → Your apps → SDK setup
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCP2NjW5iFGTKaysc46-I-2UvirX5tRRZc",
  authDomain: "gradaa-9e821.firebaseapp.com",
  projectId: "gradaa-9e821",
  storageBucket: "gradaa-9e821.firebasestorage.app",
  messagingSenderId: "918716736649",
  appId: "1:918716736649:web:25d3b159be852b8ea4d258",
  measurementId: "G-D7QHCS5LJY"
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
  publicKey: "nAFo9YkUtIu3JznzR",
  serviceId: "service_1k09ye8",
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
