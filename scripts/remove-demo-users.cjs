const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const path = require("path");

const serviceAccount = require(path.join(
  process.env.HOME || process.env.USERPROFILE,
  "OneDrive",
  "Desktop",
  "Placement Hub project",
  "serviceAccountKey.json"
));

const app = admin.initializeApp({
  credential: admin.cert(serviceAccount),
});

const db = getFirestore(app);
const auth = getAuth(app);

const DEMO_USER_NAMES = [
  "Test Admin Owner",
  "Rohan Gupta",
  "Priya Patel",
  "Aarav Sharma",
];

const OWNER_EMAIL = "atharvshinde13062005@gmail.com";

async function findDemoUsers() {
  console.log("Searching for demo users...\n");
  const usersSnapshot = await db.collection("users").get();
  const demoUsers = [];

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const displayName = (data.displayName || data.name || "").trim();
    const email = (data.email || "").trim().toLowerCase();

    if (email === OWNER_EMAIL) {
      console.log(`  KEEPING (owner): ${displayName} (${doc.id})`);
      continue;
    }

    if (DEMO_USER_NAMES.some((demo) => displayName.toLowerCase() === demo.toLowerCase())) {
      console.log(`  FOUND demo: ${displayName} (${doc.id}) - email: ${data.email || "N/A"}`);
      demoUsers.push({ id: doc.id, displayName, email: data.email, ...data });
    }
  }

  return demoUsers;
}

async function deleteUserFollows(userId) {
  const sent = await db.collection("follows").where("fromUserId", "==", userId).get();
  for (const doc of sent.docs) await doc.ref.delete();

  const received = await db.collection("follows").where("toUserId", "==", userId).get();
  for (const doc of received.docs) await doc.ref.delete();

  console.log(`    Follows: ${sent.size + received.size} deleted`);
}

async function deleteUserNotifications(userId) {
  const snap = await db.collection("notifications").where("targetUserId", "==", userId).get();
  for (const doc of snap.docs) await doc.ref.delete();
  console.log(`    Notifications: ${snap.size} deleted`);
}

async function deleteUserConversations(userId) {
  const convs = await db.collection("conversations").where("participants", "array-contains", userId).get();
  for (const convDoc of convs.docs) {
    const msgs = await db.collection("messages").where("conversationId", "==", convDoc.id).get();
    for (const msg of msgs.docs) await msg.ref.delete();
    await convDoc.ref.delete();
  }
  console.log(`    Conversations: ${convs.size} deleted`);

  const adminConvs = await db.collection("adminConversations").where("participants", "array-contains", userId).get();
  for (const convDoc of adminConvs.docs) {
    const msgs = await db.collection("adminMessages").where("conversationId", "==", convDoc.id).get();
    for (const msg of msgs.docs) await msg.ref.delete();
    await convDoc.ref.delete();
  }
  console.log(`    Admin Conversations: ${adminConvs.size} deleted`);
}

async function deleteUserBlocks(userId) {
  const b1 = await db.collection("blocks").where("blockerId", "==", userId).get();
  for (const doc of b1.docs) await doc.ref.delete();
  const b2 = await db.collection("blocks").where("blockedId", "==", userId).get();
  for (const doc of b2.docs) await doc.ref.delete();
  console.log(`    Blocks: ${b1.size + b2.size} deleted`);
}

async function deleteUserApplications(userId) {
  const snap = await db.collection("applications").where("userId", "==", userId).get();
  for (const doc of snap.docs) await doc.ref.delete();
  console.log(`    Applications: ${snap.size} deleted`);
}

async function deleteUserKeys(userId) {
  try {
    await db.collection("userKeys").doc(userId).delete();
    console.log(`    User Keys: deleted`);
  } catch {}
}

async function deleteUserReports(userId) {
  const snap = await db.collection("reports").where("reporterId", "==", userId).get();
  for (const doc of snap.docs) await doc.ref.delete();
  console.log(`    Reports (as reporter): ${snap.size} deleted`);
}

async function deleteUserFromAuth(uid) {
  try {
    await auth.deleteUser(uid);
    console.log(`    Auth user: deleted`);
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      console.log(`    Auth user: not found (already deleted)`);
    } else {
      console.error(`    Auth user deletion failed: ${err.message}`);
    }
  }
}

async function removeDemoUser(user) {
  console.log(`\n--- Removing: ${user.displayName || user.id} (${user.email || "no email"}) ---`);

  await deleteUserFollows(user.id);
  await deleteUserNotifications(user.id);
  await deleteUserConversations(user.id);
  await deleteUserBlocks(user.id);
  await deleteUserApplications(user.id);
  await deleteUserKeys(user.id);
  await deleteUserReports(user.id);

  await db.collection("users").doc(user.id).delete();
  console.log(`    Firestore user doc: deleted`);

  await deleteUserFromAuth(user.id);

  console.log(`--- Done: ${user.displayName || user.id} ---`);
}

async function main() {
  console.log("========================================");
  console.log("  Remove Demo Users");
  console.log("========================================\n");
  console.log(`Targets: ${DEMO_USER_NAMES.join(", ")}`);
  console.log(`Protected: ${OWNER_EMAIL}\n`);

  const demoUsers = await findDemoUsers();

  if (demoUsers.length === 0) {
    console.log("\nNo demo users found. Nothing to delete.");
    process.exit(0);
  }

  console.log(`\nFound ${demoUsers.length} demo user(s).\n`);

  for (const user of demoUsers) {
    await removeDemoUser(user);
  }

  console.log("\n========================================");
  console.log("  All demo users removed.");
  console.log("========================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
