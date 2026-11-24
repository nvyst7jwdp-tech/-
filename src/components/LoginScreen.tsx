import React, { useState } from "react";
import { LogIn, Mail, KeyRound, UserPlus } from "lucide-react";
import { loginWithEmail, loginWithGoogle, registerWithEmail } from "../services/authService";
import type { UserProfile } from "../types/gurupo";

export function LoginScreen({ onSuccess }: { onSuccess: (profile: UserProfile) => void }) {
  const initialInvite =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("invite")?.trim().toUpperCase() ?? ""
      : "";

  const [mode, setMode] = useState<"login" | "register">(initialInvite ? "register" : "login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setError("");
    setLoading(true);
    try {
      const profile = await loginWithGoogle(inviteCode);
      onSuccess(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Googleログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile =
        mode === "register"
          ? await registerWithEmail(name, email, password, inviteCode)
          : await loginWithEmail(email, password, inviteCode);
      onSuccess(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F7F4ED] px-4 py-8 text-[#1C1A16]">
      <section className="gurupo-screen-enter w-full max-w-md rounded-3xl border-2 border-[#D5CEC0] bg-[#FBF9F4] p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/gurupo-icon.svg" alt="ぐるポ" className="h-11 w-11 shrink-0" />
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.14em] text-[#B93818]">
              GURUPO SALES PORTAL
            </p>
            <h1 className="text-xl font-extrabold tracking-tight">ぐるポ 営業ポータル</h1>
          </div>
        </div>

        <p className="mt-3 text-xs font-medium leading-relaxed text-[#575249]">
          営業チーム専用のポータルです。Googleアカウントまたはメールアドレスでログインしてください。
        </p>

        <button
          type="button"
          disabled={loading}
          onClick={handleGoogle}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 border-[#1C1A16] bg-white px-4 text-sm font-extrabold text-[#1C1A16] transition-transform duration-100 active:scale-[0.98] disabled:opacity-60"
        >
          <LogIn className="h-4 w-4 text-[#D94E2B]" />
          <span>Googleでログイン</span>
        </button>

        <div className="mt-5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#EFEAE0] p-1 text-xs font-extrabold">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
              }}
              className={`min-h-[38px] rounded-lg transition-colors ${
                mode === "login" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
              }}
              className={`min-h-[38px] rounded-lg transition-colors ${
                mode === "register" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
              }`}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleEmailSubmit} className="mt-3.5 space-y-2.5">
            {mode === "register" && (
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="お名前（例：佐藤 健太）"
                className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-sm font-medium focus:border-[#D94E2B] focus:outline-none"
              />
            )}
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#575249]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="メールアドレス"
                className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] pl-9 pr-3 text-sm font-medium focus:border-[#D94E2B] focus:outline-none"
              />
            </div>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#575249]" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワード（6文字以上）"
                className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] pl-9 pr-3 text-sm font-medium focus:border-[#D94E2B] focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="招待コード（お持ちの場合・自動承認）"
              className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-sm font-bold uppercase focus:border-[#D94E2B] focus:outline-none"
            />

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-900">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[#D94E2B] px-4 text-sm font-extrabold text-white transition-transform duration-100 active:scale-[0.98] disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              <span>
                {loading ? "処理中..." : mode === "register" ? "メールで新規登録" : "メールでログイン"}
              </span>
            </button>
          </form>
        </div>

        <p className="mt-4 text-[11px] font-medium leading-relaxed text-[#575249]">
          ※招待コードなしで登録した場合は「参加承認待ち」となり、管理者が承認すると利用開始できます。最初に登録した1人目は自動で管理者になります。
        </p>
      </section>
    </main>
  );
}
