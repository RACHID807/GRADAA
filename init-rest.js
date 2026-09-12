const PROJECT_ID = "gradaa-9e821";

async function run() {
  try {
    const uid = "0cjctbzWa8gzyYQHx92GCqaHIhf2";

    // 2. Write to admins using Firestore REST API
    const adminRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/admins/${uid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          email: { stringValue: "benidriss841@gmail.com" },
          role: { stringValue: "superadmin" },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    });
    if (!adminRes.ok) throw new Error("Admin failed: " + await adminRes.text());
    console.log("Admin role assigned to uid:", uid);

    // 3. Write to events using Firestore REST API
    const eventRes = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/events/gradaa-2026`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          id: { stringValue: "gradaa-2026" },
          name: { stringValue: "GRADAA 2026" },
          fullName: { stringValue: "Grand Rassemblement des Aeemcistes d'Anyama" },
          date: { stringValue: "2026-10-04" },
          dateDisplay: { stringValue: "4 octobre 2026" },
          location: { stringValue: "Anyama, Côte d'Ivoire" },
          organizer: { stringValue: "Sous-comité 1-2 Anyama de l'AEEMCI" },
          organizerFull: { stringValue: "Association des Élèves et Étudiants Musulmans de Côte d'Ivoire" },
          participantCount: { integerValue: "0" },
          maxParticipants: { integerValue: "500" },
          status: { stringValue: "active" },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    });
    if (!eventRes.ok) throw new Error("Event failed: " + await eventRes.text());
    console.log("Event gradaa-2026 created/updated.");

    console.log("Initialization COMPLETE!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

run();
