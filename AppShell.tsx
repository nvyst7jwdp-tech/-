import React from "react";
import { Home, Store, CalendarDays, BookOpen, Menu, LogOut } from "lucide-react";
import type { AppTab, UserProfile } from "../types/gurupo";

const ROLE_LABELS = {
  member: "メンバー",
  manager: "マネージャー",
  admin: "管理者",
} as const;

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "today", label: "ホーム", icon: Home },
  { id: "stores", label: "店舗", icon: Store },
  { id: "visit", label: "予定", icon: CalendarDays },
  { id: "training", label: "研修", icon: BookOpen },
  { id: "menu", label: "メニュー", icon: Menu },
];

export function AppShell({
  profile,
  activeTab,
  onTabChange,
  onLogout,
  children,
}: {
  profile: UserProfile;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#E9E3D7] text-[#1C1A16]">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-[#F7F4ED] shadow-xl">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b-2 border-[#D5CEC0] bg-[#FBF9F4]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2.5">
            <img src="/gurupo-icon.svg" alt="ぐるポ" className="h-9 w-9 shrink-0" />
            <div>
              <p className="text-sm font-extrabold leading-tight">ぐるポ 営業ポータル</p>
              <p className="text-xs font-bold text-[#575249]">
                {profile.name}（{ROLE_LABELS[profile.role]}）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="ログアウト"
            className="flex min-h-[42px] items-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-xs font-extrabold text-[#1C1A16] active:scale-[0.97]"
          >
            <LogOut className="h-4 w-4" />
            <span>ログアウト</span>
          </button>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4">
          <div key={activeTab} className="gurupo-screen-enter">
            {children}
          </div>
        </main>

        <nav
          aria-label="下部ナビゲーション"
          className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 border-t-2 border-[#D5CEC0] bg-[#FBF9F4]/98 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur"
        >
          <div className="grid grid-cols-5 gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200 active:scale-[0.97] ${
                    active ? "bg-[#D94E2B]/12 text-[#B93818]" : "text-[#474239] hover:bg-[#EFEAE0]"
                  }`}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-[3px] rounded-full bg-[#D94E2B]"
                    />
                  )}
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.9} />
                  <span className={`text-[11px] leading-none ${active ? "font-extrabold" : "font-bold"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
