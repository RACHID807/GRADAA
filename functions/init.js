const admin = require('firebase-admin');

// Initialize using Application Default Credentials
admin.initializeApp({
  projectId: 'gradaa-9e821'
});

async function run() {
  try {
    let uid;
    try {
      const user = await admin.auth().createUser({
        email: 'benidriss841@gmail.com',
        password: 'abc123',
      });
      uid = user.uid;
      console.log('User created:', uid);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const user = await admin.auth().getUserByEmail('benidriss841@gmail.com');
        uid = user.uid;
        console.log('User already exists:', uid);
      } else {
        throw e;
      }
    }
    
    await admin.firestore().collection('admins').doc(uid).set({
      email: 'benidriss841@gmail.com',
      role: 'superadmin',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Admin document created in Firestore');

    await admin.firestore().collection('events').doc('gradaa-2026').set({
      id: "gradaa-2026",
      name: "GRADAA 2026",
      fullName: "Grand Rassemblement des Aeemcistes d'Anyama",
      date: "2026-10-04",
      dateDisplay: "4 octobre 2026",
      location: "Anyama, Côte d'Ivoire",
      organizer: "Sous-comité 1-2 Anyama de l'AEEMCI",
      organizerFull: "Association des Élèves et Étudiants Musulmans de Côte d'Ivoire",
      participantCount: 0,
      maxParticipants: 500,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Event gradaa-2026 initialized');
    
    process.exit(0);
  } catch(e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
}

run();
