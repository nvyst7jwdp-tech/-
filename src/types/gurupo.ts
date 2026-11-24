export type UserRole = "member" | "manager" | "admin";

export type AppTab = "today" | "stores" | "visit" | "training" | "menu";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  approved: boolean;
  active: boolean;
  loginMethod: "google" | "email";
  createdAt?: string;
}

export interface InviteRecord {
  code: string;
  createdByUid: string;
  createdByName: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string;
}
