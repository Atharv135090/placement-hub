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
    const existing = await getDoc(doc(db, "follows", docId));
    if (existing.exists()) return { data: null, error: "already_exists" };

    const toProfile = await getDoc(doc(db, "users", toUserId));
    const isPublic = toProfile.exists() && toProfile.data().profileVisibility === "public";

    await setDoc(doc(db, "follows", docId), {
      fromUserId,
      toUserId,
      status: isPublic ? "accepted" : "pending",
      createdAt: serverTimestamp(),
    });

    if (isPublic) {
      await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
      await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });
    }

    return { data: { id: docId, status: isPublic ? "accepted" : "pending" }, error: null };
  } catch (error) {
    return handleSocialError(error);
  }
}

export async function acceptFollowRequest(fromUserId, toUserId) {
  try {
    const docId = `${fromUserId}_${toUserId}`;
    await updateDoc(doc(db, "follows", docId), { status: "accepted" });
    await updateDoc(doc(db, "users", fromUserId), { followingCount: increment(1) });
    await updateDoc(doc(db, "users", toUserId), { followersCount: increment(1) });
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
        } else if (out === "accepted") {
          merged[uid] = "following";
        } else if (out === "pending") {
          merged[uid] = "pending";
        } else if (inc === "accepted") {
          merged[uid] = "follower";
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
    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.status) {
        outgoingStatuses[data.toUserId] = data.status;
      }
    }
    outgoingLoaded = true;
    emit();
  }, (error) => {
    console.error("subscribeToAllFollowStatuses outgoing error:", error);
    outgoingLoaded = true;
    emit();
  });

  const unsubIn = onSnapshot(qIncoming, (snapshot) => {
    for (const key of Object.keys(incomingStatuses)) {
      delete incomingStatuses[key];
    }
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
    console.error("subscribeToAllFollowStatuses incoming error:", error);
    incomingLoaded = true;
    emit();
  });

  return () => {
    unsubOut();
    unsubIn();
  };
}
