import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import type { InviteRecord, UserProfile } from "../types/gurupo";

function requireClients() {
  if (!auth || !db) {
    throw new Error("Firebaseの設定が未完了です。環境変数を確認してください。");
  }
  return { auth, db };
}

function generateRandomCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function validateInviteCode(inviteCode?: string): Promise<void> {
  const normalizedCode = inviteCode?.trim().toUpperCase();
  if (!normalizedCode) return;
  const { db } = requireClients();
  const invSnap = await getDoc(doc(db, "invites", normalizedCode));
  if (!invSnap.exists()) {
    throw new Error("招待コードが見つかりません。");
  }
  const inv = invSnap.data() as InviteRecord;
  const expired = inv.expiresAt ? new Date(inv.expiresAt).getTime() <= Date.now() : false;
  const limitReached = inv.maxUses !== null && inv.usedCount >= inv.maxUses;
  if (inv.revoked || expired || limitReached) {
    throw new Error("招待コードは無効または有効期限・回数上限に達しています。");
  }
}

async function ensureUserProfile(
  fbUser: FirebaseUser,
  loginMethod: "google" | "email",
  fallbackName?: string,
  inviteCode?: string
): Promise<UserProfile> {
  const { db } = requireClients();
  const userRef = doc(db, "users", fbUser.uid);
  const bootstrapRef = doc(db, "meta", "bootstrap");
  const normalizedCode = inviteCode?.trim().toUpperCase();

  return runTransaction(db, async (tx) => {
    const existingSnap = await tx.get(userRef);
    const bootstrapSnap = await tx.get(bootstrapRef);
    const isFirstUser = !bootstrapSnap.exists();

    let inviteApproved = false;
    if (normalizedCode) {
      const invRef = doc(db, "invites", normalizedCode);
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists()) {
        throw new Error("招待コードが見つかりません。");
      }
      const inv = invSnap.data() as InviteRecord;
      const expired = inv.expiresAt ? new Date(inv.expiresAt).getTime() <= Date.now() : false;
      const limitReached = inv.maxUses !== null && inv.usedCount >= inv.maxUses;
      if (inv.revoked || expired || limitReached) {
        throw new Error("招待コードは無効または有効期限・回数上限に達しています。");
      }
      tx.update(invRef, { usedCount: inv.usedCount + 1 });
      inviteApproved = true;
    }

    if (existingSnap.exists()) {
      const current = existingSnap.data() as UserProfile;
      if (!current.approved && inviteApproved) {
        tx.update(userRef, { approved: true });
        return { ...current, approved: true };
      }
      return current;
    }

    const profile: UserProfile = {
      uid: fbUser.uid,
      name: fbUser.displayName || fallbackName || fbUser.email || "メンバー",
      email: fbUser.email || "",
      role: isFirstUser ? "admin" : "member",
      approved: isFirstUser || inviteApproved,
      active: true,
      loginMethod,
      createdAt: new Date().toISOString(),
    };

    if (isFirstUser) {
      tx.set(bootstrapRef, {
        firstAdminUid: fbUser.uid,
        createdAt: serverTimestamp(),
      });
    }
    tx.set(userRef, profile);
    return profile;
  });
}

export async function loginWithGoogle(inviteCode?: string): Promise<UserProfile> {
  const { auth } = requireClients();
  await validateInviteCode(inviteCode);
  googleProvider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, googleProvider);
  return ensureUserProfile(cred.user, "google", undefined, inviteCode);
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  inviteCode?: string
): Promise<UserProfile> {
  const { auth } = requireClients();
  await validateInviteCode(inviteCode);
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  return ensureUserProfile(cred.user, "email", name.trim(), inviteCode);
}

export async function loginWithEmail(
  email: string,
  password: string,
  inviteCode?: string
): Promise<UserProfile> {
  const { auth } = requireClients();
  await validateInviteCode(inviteCode);
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureUserProfile(cred.user, "email", undefined, inviteCode);
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const { db } = requireClients();
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function logoutUser(): Promise<void> {
  const { auth } = requireClients();
  await signOut(auth);
}

export async function listAllUsers(): Promise<UserProfile[]> {
  const { db } = requireClients();
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as UserProfile);
}

export async function updateMemberAccess(
  targetUid: string,
  patch: Partial<Pick<UserProfile, "approved" | "active" | "role">>
): Promise<void> {
  const { db } = requireClients();
  await updateDoc(doc(db, "users", targetUid), patch);
}

export async function listInvites(): Promise<InviteRecord[]> {
  const { db } = requireClients();
  const q = query(collection(db, "invites"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as InviteRecord);
}

export async function createInvite(
  adminProfile: UserProfile,
  expiresInDays = 14,
  maxUses: number | null = 20
): Promise<InviteRecord> {
  const { db } = requireClients();
  const code = generateRandomCode(8);
  const record: InviteRecord = {
    code,
    createdByUid: adminProfile.uid,
    createdByName: adminProfile.name,
    maxUses,
    usedCount: 0,
    expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
    revoked: false,
    createdAt: new Date().toISOString(),
  };
  await setDoc(doc(db, "invites", code), record);
  return record;
}

export async function revokeInvite(code: string): Promise<void> {
  const { db } = requireClients();
  await updateDoc(doc(db, "invites", code), { revoked: true });
}
