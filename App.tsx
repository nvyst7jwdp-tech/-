import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseConfigured } from "./lib/firebase";
import { fetchUserProfile, logoutUser } from "./services/authService";
import type { AppTab, UserProfile } from "./types/gurupo";
import { LoginScreen } from "./components/LoginScreen";
import {
  DisabledAccountScreen,
  PendingApprovalScreen,
  SetupRequiredScreen,
} from "./components/StatusScreens";
import { AppShell } from "./components/AppShell";
import { AdminPanel } from "./components/AdminPanel";
import { TodayScreen } from "./components/TodayScreen";
import { StoresScreen } from "./components/StoresScreen";
import { PublicPreviewShell } from "./components/PublicPreviewShell";

export default function App() {
  const isPublicPreview =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  if (isPublicPreview) {
    return <PublicPreviewShell />;
  }

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const todayAnimatedRef = useRef(false);

  const reloadProfile = async (uid: string) => {
    const p = await fetchUserProfile(uid);
    setProfile(p);
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        await reloadProfile(fbUser.uid);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (profile?.approved && profile?.active && activeTab === "today" && !todayAnimatedRef.current) {
      todayAnimatedRef.current = true;
    }
  }, [profile, activeTab]);

  if (!isFirebaseConfigured) return <SetupRequiredScreen />;

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F7F4ED] text-sm font-bold text-[#575249]">
        ぐるポを読み込んでいます...
      </main>
    );
  }

  if (!profile) {
    return <LoginScreen onSuccess={(p) => setProfile(p)} />;
  }

  if (!profile.active) {
    return <DisabledAccountScreen name={profile.name} onLogout={() => void logoutUser()} />;
  }

  if (!profile.approved) {
    return (
      <PendingApprovalScreen
        name={profile.name}
        onRefresh={() => void reloadProfile(profile.uid)}
        onLogout={() => void logoutUser()}
      />
    );
  }

  const shouldAnimateToday = !todayAnimatedRef.current;

  return (
    <AppShell
      profile={profile}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={() => void logoutUser()}
    >
      {activeTab === "today" ? (
        <TodayScreen
          profile={profile}
          onNavigateTab={setActiveTab}
          animateCards={shouldAnimateToday}
        />
      ) : activeTab === "stores" ? (
        <StoresScreen profile={profile} onNavigateTab={setActiveTab} />
      ) : activeTab === "menu" && profile.role === "admin" ? (
        <AdminPanel currentAdmin={profile} />
      ) : (
        <section className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-5">
          <p className="text-xs font-extrabold text-[#B93818]">準備中（次のフェーズで追加）</p>
          <h2 className="mt-1 text-lg font-extrabold">
            {activeTab === "stores" && "店舗一覧・マップ"}
            {activeTab === "visit" && "訪問記録"}
            {activeTab === "training" && "研修ライブラリ"}
            {activeTab === "menu" && "メニュー"}
          </h2>
          <p className="mt-2 text-xs font-medium leading-relaxed text-[#575249]">
            この画面はこれから順番に追加していきます。
          </p>
        </section>
      )}
    </AppShell>
  );
}
