import React from "react";
import { Clock, ShieldAlert, Settings, LogOut, RefreshCw } from "lucide-react";

export function PendingApprovalScreen({
  name,
  onRefresh,
  onLogout,
}: {
  name: string;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F7F4ED] px-4 py-8 text-[#1C1A16]">
      <section className="gurupo-screen-enter w-full max-w-md space-y-4 rounded-3xl border-2 border-[#D5CEC0] bg-[#FBF9F4] p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
          <Clock className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold">参加承認をお待ちください</h1>
        <p className="text-sm font-medium leading-relaxed text-[#474239]">
          {name} さんのアカウントは現在「承認待ち」です。管理者が承認すると、営業ポータルをご利用いただけます。
        </p>
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onRefresh}
            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            <span>状態を再確認</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-white text-xs font-extrabold text-[#1C1A16] active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            <span>ログアウト</span>
          </button>
        </div>
      </section>
    </main>
  );
}

export function DisabledAccountScreen({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F7F4ED] px-4 py-8 text-[#1C1A16]">
      <section className="gurupo-screen-enter w-full max-w-md space-y-4 rounded-3xl border-2 border-[#D5CEC0] bg-[#FBF9F4] p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-900">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold">アカウントは利用停止中です</h1>
        <p className="text-sm font-medium leading-relaxed text-[#474239]">
          {name} さんの利用は現在停止されています。再開が必要な場合は管理者へお問い合わせください。
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-white text-xs font-extrabold text-[#1C1A16]"
        >
          <LogOut className="h-4 w-4" />
          <span>ログアウト</span>
        </button>
      </section>
    </main>
  );
}

export function SetupRequiredScreen() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F7F4ED] px-4 py-8 text-[#1C1A16]">
      <section className="w-full max-w-md space-y-4 rounded-3xl border-2 border-[#D5CEC0] bg-[#FBF9F4] p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EFEAE0] text-[#1C1A16]">
          <Settings className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold">Firebase設定が必要です</h1>
        <p className="text-sm font-medium leading-relaxed text-[#474239]">
          環境変数（<code className="rounded bg-[#EFEAE0] px-1">VITE_FIREBASE_API_KEY</code> 等）がまだ設定されていません。同梱の <code className="rounded bg-[#EFEAE0] px-1">SETUP_GUIDE.md</code> を参照して設定してください。
        </p>
      </section>
    </main>
  );
}
