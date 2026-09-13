import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, increment } from "firebase/firestore";
import { db } from "../../config/firebase";
import { handleSocialError, mapDocs } from "./helpers";
import { isBlocked } from "./blocks";

export async function sendFollowRequest(fromUserId, toUserId) {
  try {
    if (fromUserId === toUserId) return { data: null, error: "cannot_follow_self" };

    const blocked1 = await isBlocked(fromUserId, toUserId);
    if (blocked1.data) return { data: null, error: "blocked" };

    const docId = `${fromUserId}_${toUserId}`;
    const reverseDocId = `${toUserId}_${fromUserId}`;

    const [existingSnap, reverseSnap] = await Promise.all([
      getDoc(doc(db, "follows", docId)),
      getDoc(doc(db, "follows", reverseDocId)),
    ]);

    const reverseStatus = reverseSnap.exists() ? reverseSnap.data().status : null;

    if (existingSnap.exists()) {
      const existingStatus = existingSnap.data().status;
      if (existingStatus === "pending" && reverseStatus === "accepted") {
        await updateDoc(doc(db, "follows", docId), { status: "accepted" });
        await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
        await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });
        return { data: { id: docId, status: "accepted" }, error: null };
      }
      return { data: null, error: "already_exists" };
    }

    const toProfile = await getDoc(doc(db, "users", toUserId));
    const isPublic = toProfile.exists() && toProfile.data().profileVisibility === "public";
    const shouldBeAccepted = isPublic || reverseStatus === "accepted";

    await setDoc(doc(db, "follows", docId), {
      fromUserId,
      toUserId,
      status: shouldBeAccepted ? "accepted" : "pending",
      createdAt: serverTimestamp(),
    });

    if (shouldBeAccepted) {
      await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
      await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });
    }

    return { data: { id: docId, status: shouldBeAccepted ? "accepted" : "pending" }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function acceptFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    const reverseDocId = `${toUserId}_${fromUserId}`;

    await updateDoc(doc(db, "follows", docId), { status: "accepted" });
    await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
    await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });

    const reverseSnap = await getDoc(doc(db, "follows", reverseDocId));
    if (reverseSnap.exists() && reverseSnap.data().status === "pending") {
      await deleteDoc(doc(db, "follows", reverseDocId));
    }

    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function rejectFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function unfollowUser(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    const docSnap = await getDoc(doc(db, "follows", docId));
    if (!docSnap.exists()) return { data: null, error: "not_found" };

    const data = docSnap.data();
    if (data.status === "accepted") {
      await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(-1) });
      await updateDoc(doc(db, "users", toUserId), { followersCount: increment(-1) });
    }
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function cancelFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function removeFollower(ownerUserId, followerUserId) {
  try {
    const docId = `${followerUserId}_${ownerUserId}`;
    const docSnap = await getDoc(doc(db, "follows", docId));
    if (!docSnap.exists()) return { data: null, error: "not_found" };

    if (docSnap.data().status === "accepted") {
      await updateDoc(doc(db, "users", followerUserId), { followingCount: increment(-1) });
      await updateDoc(doc(db, "users", ownerUserId), { followersCount: increment(-1) });
    }
    await deleteDoc(doc(db, "follows", docId));
    return { data: { id: docId }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getFollowStatus(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    const docSnap = await getDoc(doc(db, "follows", docId));
    if (!docSnap.exists()) return { data: null, error: null };
    return { data: { id: docSnap.id, ...docSnap.data() }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getFollowers(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "follows"), where("toUserId", "==", userId), where("status", "==", "accepted"))
    );
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.fromUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      })
    );
    return { data: profiles.filter(Boolean), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function getFollowing(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "follows"), where("fromUserId", "==", userId), where("status", "==", "accepted"))
    );
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.toUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      })
    );
    return { data: profiles.filter(Boolean), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToFollowers(userId, callback) {
  const q = query(
    collection(db, "follows"),
    where("toUserId", "==", userId),
    where("status", "==", "accepted")
  );
  let generation = 0;
  return onSnapshot(q, (snapshot) => {
    const followDocs = mapDocs(snapshot);
    const gen = ++generation;
    if (followDocs.length === 0) {
      callback([]);
      return;
    }
    Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.fromUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      })
    ).then((profiles) => {
      if (gen === generation) callback(profiles.filter(Boolean));
    });
  }, (error) => {
    console.error("subscribeToFollowers error:", error);
    callback([]);
  });
}

export function subscribeToFollowing(userId, callback) {
  const q = query(
    collection(db, "follows"),
    where("fromUserId", "==", userId),
    where("status", "==", "accepted")
  );
  let generation = 0;
  return onSnapshot(q, (snapshot) => {
    const followDocs = mapDocs(snapshot);
    const gen = ++generation;
    if (followDocs.length === 0) {
      callback([]);
      return;
    }
    Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.toUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null;
      })
    ).then((profiles) => {
      if (gen === generation) callback(profiles.filter(Boolean));
    });
  }, (error) => {
    console.error("subscribeToFollowing error:", error);
    callback([]);
  });
}

export async function getPendingFollowRequests(userId) {
  try {
    const snapshot = await getDocs(
      query(collection(db, "follows"), where("toUserId", "==", userId), where("status", "==", "pending"))
    );
    const followDocs = mapDocs(snapshot);
    const profiles = await Promise.all(
      followDocs.map(async (f) => {
        const userSnap = await getDoc(doc(db, "users", f.fromUserId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data(), followFrom: f.fromUserId } : null;
      })
    );
    return { data: profiles.filter(Boolean), error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToPendingFollowRequests(userId, callback) {
  const q = query(
    collection(db, "follows"),
    where("toUserId", "==", userId),
    where("status", "==", "pending")
  );
  let generation = 0;
  return onSnapshot(q, (snapshot) => {
    const followDocs = mapDocs(snapshot);
    const fromIds = followDocs.map((f) => f.fromUserId);
    const gen = ++generation;
    if (fromIds.length === 0) {
      callback([]);
      return;
    }
    Promise.all(
      fromIds.map(async (fromId) => {
        const userSnap = await getDoc(doc(db, "users", fromId));
        return userSnap.exists() ? { id: userSnap.id, ...userSnap.data(), followFrom: fromId } : null;
      })
    ).then((profiles) => {
      if (gen === generation) callback(profiles.filter(Boolean));
    });
  }, (error) => {
    console.error("subscribeToPendingFollowRequests error:", error);
    callback([]);
  });
}

export async function rebuildFollowerCounts() {
  try {
    const snapshot = await getDocs(collection(db, "follows"));
    const followingCounts = {};
    const followersCounts = {};

    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.status !== "accepted") continue;
      const { fromUserId, toUserId } = data;
      if (fromUserId && toUserId) {
        followingCounts[fromUserId] = (followingCounts[fromUserId] || 0) + 1;
        followersCounts[toUserId] = (followersCounts[toUserId] || 0) + 1;
      }
    }

    const allUserIds = new Set([...Object.keys(followingCounts), ...Object.keys(followersCounts)]);
    const batch = [];
    for (const uid of allUserIds) {
      batch.push(
        updateDoc(doc(db, "users", uid), {
          followingCount: followingCounts[uid] || 0,
          followersCount: followersCounts[uid] || 0,
        }).catch(() => {})
      );
    }
    await Promise.all(batch);
    return { error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export function subscribeToFollowStatus(fromUserId, toUserId, callback) {
  const docIdOut = `${fromUserId}_${toUserId}`;
  const docIdIn = `${toUserId}_${fromUserId}`;

  const statuses = { outgoing: null, incoming: null };

  function emit() {
    if (statuses.outgoing === null && statuses.incoming === null) {
      callback({ status: null, incomingStatus: null });
    } else {
      callback({ status: statuses.outgoing, incomingStatus: statuses.incoming });
    }
  }

  const unsubOut = onSnapshot(doc(db, "follows", docIdOut), (docSnap) => {
    statuses.outgoing = docSnap.exists() ? docSnap.data().status : null;
    emit();
  }, (error) => {
    console.error("subscribeToFollowStatus outgoing error:", error);
    statuses.outgoing = null;
    emit();
  });

  const unsubIn = onSnapshot(doc(db, "follows", docIdIn), (docSnap) => {
    statuses.incoming = docSnap.exists() ? docSnap.data().status : null;
    emit();
  }, (error) => {
    console.error("subscribeToFollowStatus incoming error:", error);
    statuses.incoming = null;
    emit();
  });

  return () => {
    unsubOut();
    unsubIn();
  };
}

export function subscribeToAllFollowStatuses(userId, callback) {
  if (!userId) return () => {};

  console.log("[FOLLOW_DEBUG] subscribeToAllFollowStatuses for userId:", userId);

  const qOutgoing = query(
    collection(db, "follows"),
    where("fromUserId", "==", userId)
  );
  const qIncoming = query(
    collection(db, "follows"),
    where("toUserId", "==", userId)
  );

  const outgoingStatuses = {};
  const incomingStatuses = {};
  let outgoingLoaded = false;
  let incomingLoaded = false;

  function emit() {
    if (outgoingLoaded && incomingLoaded) {
      const merged = {};
      const allUids = new Set([...Object.keys(outgoingStatuses), ...Object.keys(incomingStatuses)]);
      for (const uid of allUids) {
        const out = outgoingStatuses[uid] || null;
        const inc = incomingStatuses[uid] || null;
        if (out === "accepted" && inc === "accepted") {
          merged[uid] = "accepted";
        } else if (inc === "accepted") {
          merged[uid] = "follower";
        } else if (out === "accepted") {
          merged[uid] = "following";
        } else if (out === "pending") {
          merged[uid] = "pending";
        } else if (inc === "pending") {
          merged[uid] = "incoming_pending";
        }
      }
      callback(merged);
    }
  }

  const unsubOut = onSnapshot(qOutgoing, (snapshot) => {
    for (const key of Object.keys(outgoingStatuses)) {
      delete outgoingStatuses[key];
    }
    console.log("[FOLLOW_DEBUG] OUTGOING docs for", userId, ":", snapshot.docs.map(d => ({
      docId: d.id,
      fromUserId: d.data().fromUserId,
      toUserId: d.data().toUserId,
      status: d.data().status,
    })));
    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.status) {
        outgoingStatuses[data.toUserId] = data.status;
      }
    }
    outgoingLoaded = true;
    emit();
  }, (error) => {
    console.error("[FOLLOW_DEBUG] OUTGOING ERROR:", error);
    outgoingLoaded = true;
    emit();
  });

  const unsubIn = onSnapshot(qIncoming, (snapshot) => {
    for (const key of Object.keys(incomingStatuses)) {
      delete incomingStatuses[key];
    }
    console.log("[FOLLOW_DEBUG] INCOMING docs for", userId, ":", snapshot.docs.map(d => ({
      docId: d.id,
      fromUserId: d.data().fromUserId,
      toUserId: d.data().toUserId,
      status: d.data().status,
    })));
    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.status === "accepted") {
        incomingStatuses[data.fromUserId] = "accepted";
      } else if (data.status === "pending") {
        incomingStatuses[data.fromUserId] = "incoming_pending";
      }
    }
    incomingLoaded = true;
    emit();
  }, (error) => {
    console.error("[FOLLOW_DEBUG] INCOMING ERROR:", error);
    incomingLoaded = true;
    emit();
  });

  return () => {
    unsubOut();
    unsubIn();
  };
}

export function getRelationship(outgoingStatus, incomingStatus) {
  if (outgoingStatus === "accepted" && incomingStatus === "accepted") return "mutual";
  if (outgoingStatus === "pending") return "pending";
  if (outgoingStatus === "accepted") return "following";
  if (incomingStatus === "accepted") return "follower";
  if (incomingStatus === "pending") return "incoming_pending";
  return "none";
}

export function subscribeToRelationship(currentUserId, otherUserId, callback) {
  if (!currentUserId || !otherUserId) return () => {};

  const docIdOut = `${currentUserId}_${otherUserId}`;
  const docIdIn = `${otherUserId}_${currentUserId}`;

  const statuses = { outgoing: null, incoming: null };

  function emit() {
    const relationship = getRelationship(statuses.outgoing, statuses.incoming);
    console.log("[PAIR_REL]", currentUserId.slice(0, 6), "<->", otherUserId.slice(0, 6), ":", {
      OUT_DOC: docIdOut,
      OUT_STATUS: statuses.outgoing,
      IN_DOC: docIdIn,
      IN_STATUS: statuses.incoming,
      RELATIONSHIP: relationship,
    });
    callback({ outgoing: statuses.outgoing, incoming: statuses.incoming, relationship });
  }

  const unsubOut = onSnapshot(doc(db, "follows", docIdOut), (docSnap) => {
    statuses.outgoing = docSnap.exists() ? docSnap.data().status : null;
    emit();
  }, (error) => {
    console.error("[subscribeToRelationship] outgoing error:", error);
    statuses.outgoing = null;
    emit();
  });

  const unsubIn = onSnapshot(doc(db, "follows", docIdIn), (docSnap) => {
    statuses.incoming = docSnap.exists() ? docSnap.data().status : null;
    emit();
  }, (error) => {
    console.error("[subscribeToRelationship] incoming error:", error);
    statuses.incoming = null;
    emit();
  });

  return () => {
    unsubOut();
    unsubIn();
  };
}
