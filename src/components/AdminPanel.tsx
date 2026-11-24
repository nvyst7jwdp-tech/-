import React, { useEffect, useState } from "react";
import { CheckCircle2, Copy, Plus, Shield, UserCheck, UserX, Ban } from "lucide-react";
import {
  createInvite,
  listAllUsers,
  listInvites,
  revokeInvite,
  updateMemberAccess,
} from "../services/authService";
import type { InviteRecord, UserProfile, UserRole } from "../types/gurupo";

export function AdminPanel({ currentAdmin }: { currentAdmin: UserProfile }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const [u, inv] = await Promise.all([listAllUsers(), listInvites()]);
      setUsers(u);
      setInvites(inv);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const handleCreateInvite = async () => {
    const created = await createInvite(currentAdmin, 14, 20);
    setInvites((prev) => [created, ...prev]);
    notify(`招待コード ${created.code} を発行しました`);
  };

  const handleCopyInviteUrl = async (code: string) => {
    const url = `${window.location.origin}/?invite=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      notify("招待URLをコピーしました");
    } catch {
      notify(`招待コード: ${code}`);
    }
  };

  const handleApprove = async (uid: string) => {
    await updateMemberAccess(uid, { approved: true });
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, approved: true } : u)));
    notify("参加を承認しました");
  };

  const handleToggleActive = async (target: UserProfile) => {
    if (target.uid === currentAdmin.uid) return;
    const next = !target.active;
    await updateMemberAccess(target.uid, { active: next });
    setUsers((prev) => prev.map((u) => (u.uid === target.uid ? { ...u, active: next } : u)));
    notify(`${target.name} を${next ? "有効化" : "利用停止"}しました`);
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    await updateMemberAccess(uid, { role });
    setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
    notify("権限を変更しました");
  };

  const handleRevokeInvite = async (code: string) => {
    await revokeInvite(code);
    setInvites((prev) => prev.map((i) => (i.code === code ? { ...i, revoked: true } : i)));
    notify(`招待コード ${code} を無効化しました`);
  };

  if (loading) {
    return <p className="py-6 text-center text-sm font-bold text-[#575249]">読み込み中...</p>;
  }

  return (
    <div className="space-y-4">
      {toast && (
        <div className="gurupo-toast-pop flex items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-3 text-xs font-extrabold text-white">
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* 招待コード発行 */}
      <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#D94E2B]" />
            <h2 className="text-sm font-extrabold">招待コード・URL発行</h2>
          </div>
          <button
            type="button"
            onClick={handleCreateInvite}
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-[#D94E2B] px-3 text-xs font-extrabold text-white active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            <span>新規発行</span>
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {invites.length === 0 ? (
            <p className="text-xs font-medium text-[#575249]">発行済みの招待コードはありません。</p>
          ) : (
            invites.map((inv) => (
              <div
                key={inv.code}
                className="flex items-center justify-between gap-2 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3"
              >
                <div>
                  <p className="text-sm font-extrabold tracking-wider">{inv.code}</p>
                  <p className="text-[11px] font-medium text-[#575249]">
                    使用 {inv.usedCount}/{inv.maxUses ?? "∞"} ・ {inv.revoked ? "無効" : "有効"}
                  </p>
                </div>
                {!inv.revoked && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyInviteUrl(inv.code)}
                      className="flex min-h-[38px] items-center gap-1 rounded-lg border border-[#1C1A16] bg-white px-2.5 text-xs font-extrabold"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>URL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(inv.code)}
                      aria-label="無効化"
                      className="flex min-h-[38px] items-center rounded-lg border border-red-700 bg-red-50 px-2.5 text-xs font-extrabold text-red-900"
                    >
                      <Ban className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      {/* メンバー一覧・承認・利用停止 */}
      <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
        <h2 className="mb-3 text-sm font-extrabold">メンバー管理（{users.length}名）</h2>
        <div className="space-y-2.5">
          {users.map((u) => (
            <div key={u.uid} className="rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-extrabold">{u.name}</p>
                  <p className="text-xs font-medium text-[#575249]">{u.email}</p>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-extrabold ${
                    !u.active
                      ? "bg-red-100 text-red-900"
                      : u.approved
                      ? "bg-emerald-100 text-emerald-950"
                      : "bg-amber-100 text-amber-950"
                  }`}
                >
                  {!u.active ? "利用停止" : u.approved ? "承認済み" : "承認待ち"}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {!u.approved && (
                  <button
                    type="button"
                    onClick={() => handleApprove(u.uid)}
                    className="min-h-[38px] rounded-lg bg-[#D94E2B] px-3 text-xs font-extrabold text-white"
                  >
                    参加を承認
                  </button>
                )}

                <select
                  value={u.role}
                  disabled={u.uid === currentAdmin.uid}
                  onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                  className="min-h-[38px] rounded-lg border border-[#D5CEC0] bg-white px-2 text-xs font-bold"
                >
                  <option value="member">メンバー</option>
                  <option value="manager">マネージャー</option>
                  <option value="admin">管理者</option>
                </select>

                {u.uid !== currentAdmin.uid && (
                  <button
                    type="button"
                    onClick={() => handleToggleActive(u)}
                    className={`flex min-h-[38px] items-center gap-1 rounded-lg border px-2.5 text-xs font-extrabold ${
                      u.active
                        ? "border-red-700 bg-red-50 text-red-900"
                        : "border-emerald-700 bg-emerald-50 text-emerald-950"
                    }`}
                  >
                    {u.active ? (
                      <>
                        <UserX className="h-3.5 w-3.5" />
                        <span>停止する</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5" />
                        <span>再開する</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
