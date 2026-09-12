# GRADA 2026 — Documentation de Déploiement

> Application web de gestion du rassemblement GRADA organisé par le Sous-comité 1-2 Anyama de l'AEEMCI.  
> Date de l'activité : **4 octobre 2026**

---

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Création du projet Firebase](#2-création-du-projet-firebase)
3. [Configuration EmailJS](#3-configuration-emailjs)
4. [Configuration Brevo (fallback email)](#4-configuration-brevo-fallback-email)
5. [Configuration de l'application](#5-configuration-de-lapplication)
6. [Déploiement](#6-déploiement)
7. [Configuration post-déploiement](#7-configuration-post-déploiement)
8. [Ajout du premier administrateur](#8-ajout-du-premier-administrateur)
9. [Génération et impression du QR Code](#9-génération-et-impression-du-qr-code)
10. [Résumé des choix techniques](#10-résumé-des-choix-techniques)
11. [Limites connues](#11-limites-connues)

---

## 1. Prérequis

- Node.js 18+ : https://nodejs.org/
- Firebase CLI : `npm install -g firebase-tools`
- Un compte Google (pour Firebase)
- Un compte EmailJS : https://www.emailjs.com/ (gratuit)
- Un compte Brevo : https://www.brevo.com/ (gratuit)

---

## 2. Création du projet Firebase

### 2.1 Créer le projet

1. Aller sur https://console.firebase.google.com/
2. Cliquer **"Ajouter un projet"**
3. Nom du projet : `grada-aeemci` (ou votre choix)
4. Désactiver Google Analytics (optionnel)
5. Cliquer **"Créer le projet"**

### 2.2 Activer les services

**Firestore :**
1. Build → Firestore Database → "Créer une base de données"
2. Mode de démarrage : **Mode Production**
3. Région : `europe-west1` (ou `us-central1`)

**Authentication :**
1. Build → Authentication → "Commencer"
2. Sign-in method → Activer **Email/Password**

**Storage :**
1. Build → Storage → "Commencer"
2. Mode production, même région que Firestore

**Hosting :**
1. Build → Hosting → "Commencer"
2. Suivre l'assistant (sans initialiser le projet maintenant)

**Functions :**
1. Build → Functions → "Commencer"
2. Nécessite un plan **Blaze** (pay-as-you-go) — rester sous les quotas gratuits
3. Région : `europe-west1`

### 2.3 Récupérer la configuration

1. ⚙️ Project Settings → "Vos applications" → "Ajouter une application" → Web
2. Nom : `GRADA Web`
3. Cocher "Configurer Firebase Hosting"
4. **Copier la configuration** affichée (`apiKey`, `authDomain`, etc.)

---

## 3. Configuration EmailJS

### 3.1 Créer un compte et service

1. Aller sur https://www.emailjs.com/ → S'inscrire gratuitement
2. Email Services → "Add New Service"
3. Choisir votre service SMTP (Gmail, Outlook, ou SMTP custom)
4. **Service ID** à noter : `service_grada`

### 3.2 Créer un template

1. Email Templates → "Create New Template"
2. **Template ID** : `template_receipt`
3. Contenu du template :

```
To: {{to_email}}
Subject: GRADA 2026 — Votre reçu d'inscription {{registration_number}}

Salam {{to_name}},

Votre inscription au GRADA 2026 ({{event_date}}) est confirmée !
Numéro d'inscription : {{registration_number}}
Lieu : {{event_location}}

Votre reçu PDF est joint à cet email.

Baraka Allah ou fikoum,
{{organizer}}
```

4. Ajouter un attachement avec `{{pdf_name}}` pointant sur `{{pdf_content}}`
5. Sauvegarder le template

### 3.3 Récupérer la clé publique

1. Account → API Keys → **Public Key** à copier

---

## 4. Configuration Brevo (fallback email)

1. Aller sur https://www.brevo.com/ → Créer un compte
2. **Vérifier votre email expéditeur** : Settings → Senders → Add a Sender
3. SMTP & API → API Keys → Générer une clé API
4. Copier la clé API

> **Limites Brevo gratuit :** 300 emails/jour, 9 000/mois — largement suffisant pour 200 participants.

---

## 5. Configuration de l'application

### 5.1 Mettre à jour `public/js/firebase-config.js`

Remplacer les valeurs placeholder par vos valeurs réelles :

```javascript
const FIREBASE_CONFIG = {
  apiKey: "VOTRE_API_KEY",              // ← remplacer
  authDomain: "grada-aeemci.firebaseapp.com",
  projectId: "grada-aeemci",           // ← adapter si projet différent
  storageBucket: "grada-aeemci.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID", // ← remplacer
  appId: "VOTRE_APP_ID",               // ← remplacer
};

const EMAILJS_CONFIG = {
  publicKey: "VOTRE_EMAILJS_PUBLIC_KEY", // ← remplacer
  serviceId: "service_grada",
  templateId: "template_receipt"
};
```

### 5.2 Configurer les variables de Cloud Functions

```bash
# Depuis le dossier du projet
firebase functions:config:set \
  brevo.api_key="VOTRE_CLE_API_BREVO" \
  brevo.sender_email="votre-email@domaine.ci" \
  brevo.sender_name="AEEMCI — GRADA 2026"
```

---

## 6. Déploiement

### 6.1 Login Firebase

```bash
firebase login
```

### 6.2 Initialiser le projet local

```bash
cd c:\Users\HP\Documents\GRADAA
firebase use --add
# Sélectionner votre projet: grada-aeemci
```

Ou éditer directement `.firebaserc` :

```json
{
  "projects": {
    "default": "VOTRE_PROJECT_ID"
  }
}
```

### 6.3 Installer les dépendances des Functions

```bash
cd functions
npm install
cd ..
```

### 6.4 Déployer Firestore Rules + Indexes

```bash
firebase deploy --only firestore
```

### 6.5 Déployer Storage Rules

```bash
firebase deploy --only storage
```

### 6.6 Déployer Cloud Functions

```bash
firebase deploy --only functions
```

> **Note :** Requiert le plan Blaze. Le quota gratuit inclut 2M d'invocations/mois.

### 6.7 Déployer le Frontend (Hosting)

```bash
firebase deploy --only hosting
```

### 6.8 Déploiement complet (tout d'un coup)

```bash
firebase deploy
```

Après déploiement, l'URL sera : `https://VOTRE-PROJECT-ID.web.app`

---

## 7. Configuration post-déploiement

### 7.1 Initialiser le document d'événement dans Firestore

Dans la Firebase Console → Firestore → Créer manuellement :

**Collection :** `events`  
**Document ID :** `grada-2026`

```json
{
  "id": "grada-2026",
  "name": "GRADA 2026",
  "fullName": "Grand Rassemblement Des Anciens",
  "date": "2026-10-04",
  "dateDisplay": "4 octobre 2026",
  "location": "Anyama, Côte d'Ivoire",
  "organizer": "Sous-comité 1-2 Anyama de l'AEEMCI",
  "organizerFull": "Association des Élèves et Étudiants Musulmans de Côte d'Ivoire",
  "participantCount": 0,
  "maxParticipants": 500,
  "status": "active",
  "createdAt": "[Timestamp serveur]"
}
```

### 7.2 Configurer les règles d'index

```bash
firebase deploy --only firestore:indexes
```

---

## 8. Ajout du premier administrateur

1. **Créer un compte utilisateur :**
   - Firebase Console → Authentication → Users → "Add user"
   - Email : `admin@aeemci.ci` (ou votre email)
   - Mot de passe : (choisir un mot de passe fort)
   - **Copier l'UID** affiché

2. **Ajouter dans Firestore :**
   - Collection : `admins`
   - Document ID : **l'UID copié**
   - Champs :
     ```json
     {
       "email": "admin@aeemci.ci",
       "role": "superadmin",
       "createdAt": "[Timestamp serveur]"
     }
     ```

3. **Se connecter :**
   - Aller sur `https://VOTRE-URL/admin-login.html`
   - Utiliser l'email/mot de passe créés

---

## 9. Génération et impression du QR Code

1. Connectez-vous au dashboard admin : `https://VOTRE-URL/admin-login.html`
2. Dans le menu : **"🔳 QR Code"**
3. Le QR code est automatiquement généré, pointant vers `/checkin.html`
4. Cliquer **"⬇️ Télécharger le QR Code"** → image PNG
5. **Imprimer** ce QR code en grand format (A4 minimum) et l'afficher à l'entrée

> **URL du QR Code :** `https://VOTRE-URL/checkin.html`

---

## 10. Résumé des choix techniques

### 📧 Solution d'email
| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Primaire | **EmailJS** (SDK JS client) | Gratuit 200 emails/mois, zéro serveur, intégration simple |
| Secondaire | **Brevo API** via Cloud Function | 300 emails/jour gratuit, SMTP fiable, retry automatique |
| Fallback | **Firestore emailQueue** | File d'attente persistante si les 2 premiers échouent |

### 🔒 Anti-doublons
- **Vérification `runTransaction()`** : lecture + écriture atomique dans Firestore
- Vérification par email ET par téléphone séparément
- Feedback temps réel à l'utilisateur sur `blur` des champs
- Message d'erreur clair en français avec lien vers la récupération du reçu

### 📄 PDF
- **jsPDF 2.x** : génération 100% client-side, pas de serveur
- Logo AEEMCI intégré via canvas (base64)
- Photo de profil optionnelle avec crop circulaire
- Palette de couleurs AEEMCI appliquée exactement

### 🎨 Palette de couleurs exacte
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#F97316` | Orange AEEMCI — boutons CTA, titres |
| `--color-primary-dark` | `#EA580C` | Hover orange |
| `--color-secondary` | `#16A34A` | Vert AEEMCI — succès, accents |
| `--color-secondary-dark` | `#15803D` | Hover vert |
| `--color-bg` | `#FAFAFA` | Fond général |
| `--color-surface` | `#FFFFFF` | Cartes, formulaires |
| `--color-text` | `#1A1A1A` | Texte principal |

### 📊 Graphiques
- **Chart.js 4.x** : léger, responsive, couleurs AEEMCI appliquées

### 🔳 QR Code
- **qrcode.js** : génération client-side, image téléchargeable/imprimable

### 🗄️ Schéma Firestore (réutilisable)
- Collection `events/{eventId}` : configurable pour les prochaines éditions
- Collection `participants/` avec `eventId` comme champ de liaison
- Collection `emailQueue/` pour le retry des emails
- Collection `admins/` pour le contrôle d'accès

---

## 11. Limites connues

| Limitation | Impact | Contournement |
|-----------|--------|---------------|
| EmailJS 200 emails/mois | Si >200 inscriptions, certains emails passent par Brevo | Surveiller les quotas EmailJS, Brevo prend le relais automatiquement |
| Brevo plan gratuit : 300 emails/jour | Si beaucoup d'inscriptions en un seul jour | File d'attente Firestore étale les envois |
| jsPDF : polices limitées | Caractères spéciaux (accents) | Utilisation de la police helvetica intégrée, compatible |
| Firestore Free tier : 50K lectures/jour | Suffisant pour 200 participants | Surveiller si le dashboard admin est très actif |
| Pas d'envoi du PDF en pièce jointe via EmailJS gratuit | Le template doit inclure un lien de re-téléchargement | Ajouter un lien vers `receipt.html?id=PARTICIPANT_ID` dans le template |
| Cloud Functions nécessite plan Blaze | Coût potentiel minimal | Rester sous les quotas gratuits (2M invocations/mois) |

---

## Structure complète du projet

```
GRADAA/
├── public/
│   ├── index.html          # Formulaire d'inscription
│   ├── checkin.html        # Check-in Jour J
│   ├── admin.html          # Dashboard administrateur
│   ├── admin-login.html    # Connexion administrateur
│   ├── receipt.html        # Re-téléchargement reçu
│   ├── assets/
│   │   └── logo-aeemci.png # Logo AEEMCI (à ajouter)
│   ├── css/
│   │   └── main.css        # Design system complet
│   └── js/
│       ├── firebase-config.js  # Config Firebase + EVENT_CONFIG
│       ├── app.js              # Logique inscription
│       ├── pdf-generator.js    # Génération PDF jsPDF
│       ├── email-service.js    # Service EmailJS + queue
│       ├── checkin.js          # Logique check-in
│       ├── qr-generator.js     # Wrapper QR Code
│       └── admin.js            # Dashboard admin
├── functions/
│   ├── index.js            # Entry point CF
│   ├── package.json
│   └── src/
│       ├── onRegistration.js   # Trigger inscription → email
│       └── sendEmail.js        # File email Brevo
├── firestore.rules         # Règles sécurité Firestore
├── storage.rules           # Règles sécurité Storage
├── firestore.indexes.json  # Index Firestore
├── firebase.json           # Config Firebase
├── .firebaserc             # Alias projet
└── README.md               # Cette documentation
```

---

*Application construite pour l'AEEMCI — Sous-comité 1-2 Anyama — GRADA 2026*  
*Baraka Allah ou fikoum* 🕌
