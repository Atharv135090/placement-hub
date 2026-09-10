const admin = require("firebase-admin");
const path = require("path");

const serviceAccount = require(path.join(
  process.env.HOME || process.env.USERPROFILE,
  "Downloads",
  "placement-hub-f5c73-firebase-adminsdk-fbsvc-08877b0307.json"
));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const COLLECTIONS_TO_CLEAR = [
  "companies",
  "jobs",
  "applications",
  "notifications",
  "announcements",
  "attachments",
];

async function deleteCollection(collectionPath) {
  const batchSize = 500;
  let totalDeleted = 0;

  while (true) {
    const snapshot = await db.collection(collectionPath).limit(batchSize).get();
    if (snapshot.empty) break;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    totalDeleted += snapshot.size;
    console.log(`  Deleted ${snapshot.size} docs from ${collectionPath} (total: ${totalDeleted})`);

    if (snapshot.size < batchSize) break;
  }

  return totalDeleted;
}

async function main() {
  console.log("=== Placement Hub — Firestore Cleanup ===\n");

  for (const col of COLLECTIONS_TO_CLEAR) {
    console.log(`Clearing collection: ${col}`);
    const count = await deleteCollection(col);
    console.log(`  Done. Removed ${count} document(s).\n`);
  }

  console.log("=== All collections cleared. ===");
  console.log("Refresh the app to verify empty states.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
