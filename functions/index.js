const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { logger } = require("firebase-functions");
const { GoogleGenerativeAI } = require("@google/generative-ai");

initializeApp();

const db = getFirestore();

// ═══════════════════════════════════════════════════════════════
// FUNCTION 1: syncUserRole
// ═══════════════════════════════════════════════════════════════

exports.syncUserRole = onDocumentWritten("users/{userId}", async (event) => {
  const { userId } = event.params;
  const after = event.data?.after?.data();

  if (!after) {
    logger.info(`User ${userId} document deleted — skipping.`);
    return;
  }

  const newRole = after.role || "student";

  const validRoles = ["student", "admin", "owner"];
  const roleToSet = validRoles.includes(newRole) ? newRole : "student";

  try {
    const userRecord = await getAuth().getUser(userId);
    const existingClaims = userRecord.customClaims || {};
    const currentClaimRole = existingClaims.role;

    if (currentClaimRole === roleToSet) {
      logger.info(`Role already synced for user ${userId}: "${roleToSet}"`);
      return;
    }

    const { role: _oldClaim, ...rest } = existingClaims;

    await getAuth().setCustomUserClaims(userId, {
      ...rest,
      role: roleToSet,
    });

    logger.info(
      `Synced role for user ${userId}: "${currentClaimRole || "(none)"}" → "${roleToSet}"`
    );
  } catch (error) {
    logger.error(`Failed to sync role for user ${userId}:`, error);
    throw error;
  }
});

// ═══════════════════════════════════════════════════════════════
// FUNCTION 2: createCompany
// ═══════════════════════════════════════════════════════════════

exports.createCompany = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be signed in to add companies."
    );
  }

  const uid = request.auth.uid;
  const role = request.auth.token.role || "student";

  const usersSnapshot = await db
    .collection("users")
    .where("role", "in", ["admin", "owner"])
    .limit(1)
    .get();

  const hasAdmin = !usersSnapshot.empty;
  const isFirstCompanyBootstrap = !hasAdmin;

  if (!isFirstCompanyBootstrap && role !== "admin" && role !== "owner") {
    throw new HttpsError(
      "permission-denied",
      "You don't have permission to add companies. Your role may need to be updated."
    );
  }

  const {
    company: companyData,
    job: jobData,
    isExistingCompany,
    existingCompanyId,
  } = request.data || {};

  if (!companyData?.name || !jobData?.title) {
    throw new HttpsError(
      "invalid-argument",
      "Company name and job title are required."
    );
  }

  const sanitize = (val) => {
    if (typeof val !== "string") return val || null;
    return val.trim() || null;
  };

  const cleanCompany = {
    name: sanitize(companyData.name),
    normalizedName: (companyData.name || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ""),
    industry: sanitize(companyData.industry),
    organisationSize: sanitize(companyData.organisationSize),
    website: sanitize(companyData.website),
    description: sanitize(companyData.description),
    location: sanitize(companyData.location),
    logoUrl: companyData.logoUrl || null,
  };

  const cleanJob = {
    title: sanitize(jobData.title),
    employmentType: sanitize(jobData.employmentType),
    ctc: sanitize(jobData.ctc),
    stipend: sanitize(jobData.stipend),
    location: sanitize(jobData.location) || cleanCompany.location,
    industry: sanitize(jobData.industry) || cleanCompany.industry,
    registrationOpen: sanitize(jobData.registrationOpen),
    registrationClose: sanitize(jobData.registrationClose),
    driveDate: sanitize(jobData.driveDate),
    description: sanitize(jobData.description) || cleanCompany.description,
    eligibilityCriteria: sanitize(jobData.eligibilityCriteria),
    eligibleCourses: Array.isArray(jobData.eligibleCourses)
      ? jobData.eligibleCourses.filter(Boolean)
      : [],
    selectionProcess: sanitize(jobData.selectionProcess),
    sourceStatus: sanitize(jobData.sourceStatus),
  };

  const normalizedName = cleanCompany.normalizedName;

  if (normalizedName) {
    const existing = await db
      .collection("companies")
      .where("normalizedName", "==", normalizedName)
      .limit(1)
      .get();

    if (!existing.empty && !isExistingCompany) {
      const existingDoc = existing.docs[0];

      throw new HttpsError(
        "already-exists",
        `This company may already exist: "${existingDoc.data().name}". ` +
          `Please use the existing company.`
      );
    }
  }

  let companyId;

  if (isExistingCompany && existingCompanyId) {
    companyId = existingCompanyId;
  } else {
    const companyRef = await db.collection("companies").add({
      ...cleanCompany,
      isActive: true,
      createdBy: uid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    companyId = companyRef.id;
  }

  const jobRef = await db.collection("jobs").add({
    companyId,
    ...cleanJob,
    isActive: true,
    createdBy: uid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  logger.info(
    `Created company ${companyId} with job ${jobRef.id} by user ${uid}`
  );

  if (isFirstCompanyBootstrap) {
    await db.collection("users").doc(uid).set(
      {
        role: "owner",
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    try {
      const userRecord = await getAuth().getUser(uid);
      const existingClaims = userRecord.customClaims || {};

      await getAuth().setCustomUserClaims(userId, {
        ...existingClaims,
        role: "owner",
      });

      logger.info(`Bootstrapped user ${uid} as owner`);
    } catch (e) {
      logger.warn(`Could not set owner claim for ${uid}:`, e.message);
    }
  }

  return {
    companyId,
    jobId: jobRef.id,
    companyName: cleanCompany.name,
  };
});

// ═══════════════════════════════════════════════════════════════
// FUNCTION 3: chat
// GENERAL PURPOSE AI ASSISTANT
// ═══════════════════════════════════════════════════════════════

// IMPORTANT:
// NEVER hard-code the Gemini API key here.
// Configure GEMINI_API_KEY securely in the Firebase environment.

// ═══════════════════════════════════════════════════════════════
// FUNCTION 4: adminLogoutUser
// Revokes all refresh tokens for a target user, forcing re-auth
// ═══════════════════════════════════════════════════════════════

exports.adminLogoutUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerRole = request.auth.token.role;
  if (callerRole !== "owner" && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Only admin or owner can log out users.");
  }

  const { userId } = request.data || {};
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  try {
    await getAuth().revokeRefreshTokens(userId);
    logger.info(`Revoked refresh tokens for user ${userId} by ${request.auth.uid}`);
  } catch (error) {
    logger.error(`Failed to revoke tokens for user ${userId}:`, error);
    throw new HttpsError("internal", "Failed to log out user. They may not exist.");
  }

  try {
    await db.collection("users").doc(userId).set(
      { forceLogout: true, forceLogoutAt: new Date().toISOString() },
      { merge: true }
    );
    logger.info(`Set forceLogout flag for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to set forceLogout for user ${userId}:`, error);
  }

  return { success: true };
});

// ═══════════════════════════════════════════════════════════════
// FUNCTION 5: adminDeleteUser
// Deletes Firebase Auth account + cleans up Firestore data
// ═══════════════════════════════════════════════════════════════

exports.adminDeleteUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerRole = request.auth.token.role;
  if (callerRole !== "owner" && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Only admin or owner can delete users.");
  }

  const { userId } = request.data || {};
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required.");
  }

  const targetSnap = await db.collection("users").doc(userId).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const targetRole = targetSnap.data().role || "student";
  if (targetRole === "owner") {
    throw new HttpsError("failed-precondition", "Cannot delete an owner account.");
  }

  try {
    await getAuth().deleteUser(userId);
    logger.info(`Deleted Firebase Auth account for user ${userId}`);
  } catch (error) {
    if (error.code === "auth/user-not-found") {
      logger.warn(`User ${userId} already deleted from Auth, continuing with data cleanup.`);
    } else {
      logger.error(`Failed to delete Auth account for ${userId}:`, error);
      throw new HttpsError("internal", "Failed to delete user account.");
    }
  }

  const batch = db.batch();

  batch.delete(db.collection("users").doc(userId));

  const followSnap1 = await db.collection("follows").where("fromUserId", "==", userId).get();
  followSnap1.forEach((doc) => batch.delete(doc.ref));

  const followSnap2 = await db.collection("follows").where("toUserId", "==", userId).get();
  followSnap2.forEach((doc) => batch.delete(doc.ref));

  const blockSnap1 = await db.collection("blocks").where("blockerId", "==", userId).get();
  blockSnap1.forEach((doc) => batch.delete(doc.ref));

  const blockSnap2 = await db.collection("blocks").where("blockedId", "==", userId).get();
  blockSnap2.forEach((doc) => batch.delete(doc.ref));

  const notifSnap = await db.collection("notifications").where("targetUserId", "==", userId).get();
  notifSnap.forEach((doc) => batch.delete(doc.ref));

  const appSnap = await db.collection("applications").where("userId", "==", userId).get();
  appSnap.forEach((doc) => batch.delete(doc.ref));

  const convSnap = await db.collection("conversations").where("participants", "array-contains", userId).get();
  for (const convDoc of convSnap.docs) {
    const msgSnap = await db.collection("messages").where("conversationId", "==", convDoc.id).get();
    msgSnap.forEach((msgDoc) => batch.delete(msgDoc.ref));
    batch.delete(convDoc.ref);
  }

  await batch.commit();
  logger.info(`Cleaned up Firestore data for user ${userId}`);

  return { success: true };
});

// ═══════════════════════════════════════════════════════════════
// FUNCTION 6: adminBlockUser
// Blocks/unblocks a user and revokes their session
// ═══════════════════════════════════════════════════════════════

exports.adminBlockUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }

  const callerRole = request.auth.token.role;
  if (callerRole !== "owner" && callerRole !== "admin") {
    throw new HttpsError("permission-denied", "Only admin or owner can block users.");
  }

  const { userId, blocked } = request.data || {};
  if (!userId || typeof userId !== "string") {
    throw new HttpsError("invalid-argument", "userId is required.");
  }
  if (typeof blocked !== "boolean") {
    throw new HttpsError("invalid-argument", "blocked must be a boolean.");
  }

  const targetSnap = await db.collection("users").doc(userId).get();
  if (!targetSnap.exists) {
    throw new HttpsError("not-found", "User not found.");
  }

  const targetRole = targetSnap.data().role || "student";
  if (targetRole === "owner") {
    throw new HttpsError("failed-precondition", "Cannot block an owner account.");
  }

  try {
    await getAuth().revokeRefreshTokens(userId);
    logger.info(`Revoked refresh tokens for user ${userId} (block/unblock)`);
  } catch (error) {
    logger.error(`Failed to revoke tokens for user ${userId}:`, error);
  }

  try {
    await db.collection("users").doc(userId).set(
      {
        blocked: blocked,
        blockedAt: blocked ? new Date().toISOString() : null,
        forceLogout: blocked,
        forceLogoutAt: blocked ? new Date().toISOString() : null,
      },
      { merge: true }
    );
    logger.info(`Set blocked=${blocked} for user ${userId}`);
  } catch (error) {
    logger.error(`Failed to set blocked state for user ${userId}:`, error);
    throw new HttpsError("internal", "Failed to update block state.");
  }

  return { success: true, blocked };
});

exports.chat = onCall(
  {
    timeoutSeconds: 60,
    memory: "256MB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const { message, history, placementContext } = request.data || {};

    if (!message || typeof message !== "string") {
      throw new HttpsError(
        "invalid-argument",
        "Message is required."
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Gemini API key is not configured. Set GEMINI_API_KEY securely."
      );
    }

    try {
      const genAI = new GoogleGenerativeAI(apiKey);

      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
      });

      let systemPrompt = `
You are Placement Hub Assistant, a general-purpose AI assistant.

You can answer ANY reasonable question from the user.

You are NOT restricted to placement-related questions.

You can help with:
- General knowledge
- Coding
- Programming
- Debugging
- DSA
- DBMS
- OS
- Networks
- System design
- Mathematics
- Science
- Career
- Interview preparation
- Resume writing
- Study plans
- Writing
- Translation
- Explanations
- Comparisons
- Travel/general planning
- Everyday questions
- Creative ideas
- Conversations

Answer naturally like a modern general-purpose AI assistant.

Do not respond with a fixed list of supported topics.

Do not say:
"I understand your question..."
when the question is clear.

Do not force the user to provide more details when a reasonable answer can already be given.

If the question is simple, answer it directly.

If the question requires explanation, explain clearly.

If the user asks for code, provide working code and explain it when useful.

Use Markdown when appropriate.

Be conversational, helpful and context-aware.

You may use the user's Placement Hub information when it is relevant.
`;

      if (placementContext) {
        const ctx = placementContext;

        systemPrompt += `

User's Placement Hub information:
- Name: ${ctx.userName || "Student"}
- Branch: ${ctx.branch || "N/A"}
- Graduation Year: ${ctx.gradYear || "N/A"}
- Total Applications: ${ctx.totalApplications || 0}
- Applied: ${ctx.applied || 0}
- Shortlisted: ${ctx.shortlisted || 0}
- Interviews: ${ctx.interviews || 0}
- Offers: ${ctx.offers || 0}
- Rejected: ${ctx.rejected || 0}
- Application Details:
  ${(ctx.applicationDetails || []).join("; ") || "None"}
- Total Companies: ${ctx.totalCompanies || 0}
`;
      }

      const chatHistory = (history || []).map((msg) => ({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.text }],
      }));

      const chat = model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: systemPrompt }],
          },
          {
            role: "model",
            parts: [
              {
                text: "Understood. I'm ready to help with anything.",
              },
            ],
          },
          ...chatHistory,
        ],
        generationConfig: {
          maxOutputTokens: 2048,
        },
      });

      const result = await chat.sendMessage(message);

      const response = result.response.text();

      return {
        response,
      };
    } catch (err) {
      logger.error("Chat function error:", err);

      throw new HttpsError(
        "internal",
        "Failed to generate response. Please try again."
      );
    }
  }
);