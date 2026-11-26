/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  X,
  CheckCircle2,
  AlertCircle,
  LocateFixed,
  UserPlus,
  Lock,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
  Calendar,
} from "lucide-react";
import type { AppTab, UserProfile } from "../types/gurupo";
import {
  CustomerMap,
  STORE_STATUS_LIST,
  type CustomerPin,
  type CustomerStatus,
  type PlaceCandidatePin,
} from "./CustomerMap";
import {
  createStore,
  deleteStore,
  fetchStores,
  fetchUserNameMap,
  parseJapaneseAddress,
  updateStoreStatus,
  type StoreRecord,
} from "../services/storesService";
import {
  RESTAURANT_GENRES,
  searchRestaurantsByPlaceText,
  searchRestaurantsNearby,
  type RestaurantGenre,
} from "../services/placesService";
import { SalesInsightPanel } from "./SalesInsightPanel";

export function StoresScreen({
  profile,
  onNavigateTab,
}: {
  profile: UserProfile;
  onNavigateTab: (tab: AppTab) => void;
}) {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "";
  const isLeader = profile.role === "manager" || profile.role === "admin";

  // 「顧客（登録済み）」と「店舗（周辺検索の未登録候補）」を明確に分離
  const [sectionTab, setSectionTab] = useState<"customers" | "prospects">("customers");

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [userNameMap, setUserNameMap] = useState<Map<string, string>>(
    () => new Map([[profile.uid, profile.name]])
  );
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  // 顧客セクション状態
  const [scopeFilter, setScopeFilter] = useState<"mine" | "team">(
    isLeader ? "team" : "mine"
  );
  const effectiveScope: "mine" | "team" = isLeader ? scopeFilter : "mine";
  const [customerViewMode, setCustomerViewMode] = useState<"map" | "list">("map");
  const [statusFilter, setStatusFilter] = useState<"すべて" | CustomerStatus>("すべて");
  const [searchText, setSearchText] = useState("");
  const [prefFilter, setPrefFilter] = useState("すべて");
  const [cityFilter, setCityFilter] = useState("すべて");
  const [selectedListStoreId, setSelectedListStoreId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    nonce: number;
  } | null>(null);

  // 店舗（周辺検索候補）セクション状態
  const [placeQuery, setPlaceQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<RestaurantGenre>("すべて");
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidatePin[]>([]);
  const [prospectViewMode, setProspectViewMode] = useState<"list" | "map">("list");
  const [prospectFilterText, setProspectFilterText] = useState("");
  const [expandedCandidateIds, setExpandedCandidateIds] = useState<Record<string, boolean>>({});
  const [candidateStatusMap, setCandidateStatusMap] = useState<
    Record<string, CustomerStatus>
  >({});
  const [candidateApptMap, setCandidateApptMap] = useState<
    Record<string, { date: string; time: string }>
  >({});
  const [candidateErrorMap, setCandidateErrorMap] = useState<Record<string, string>>({});
  const [registeringPlaceId, setRegisteringPlaceId] = useState<string | null>(null);

  // 削除確認モーダル
  const [deletingStore, setDeletingStore] = useState<{ id: string; name: string } | null>(
    null
  );
  const [deletingBusy, setDeletingBusy] = useState(false);

  // ステータス編集モーダル（契約金額は削除・アポ獲得時は日時必須）
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [editStatus, setEditStatus] = useState<CustomerStatus>("キック");
  const [editApptDate, setEditApptDate] = useState("");
  const [editApptTime, setEditApptTime] = useState("");
  const [editContractDate, setEditContractDate] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchStores(profile), fetchUserNameMap(profile)])
      .then(([list, nameMap]) => {
        if (!active) return;
        setStores(list);
        setUserNameMap(nameMap);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile]);

  const resolveOwnerName = (store: StoreRecord) =>
    userNameMap.get(store.ownerUid) || store.ownerName || "担当者";

  const registeredPlaceIds = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.placeId) set.add(s.placeId);
    });
    return set;
  }, [stores]);

  const scopedStores = useMemo(
    () =>
      stores.filter(
        (s) => effectiveScope === "team" || s.ownerUid === profile.uid
      ),
    [stores, effectiveScope, profile.uid]
  );

  const prefectureOptions = useMemo(() => {
    const set = new Set<string>();
    scopedStores.forEach((s) => {
      const { prefecture } = parseJapaneseAddress(s.address);
      if (prefecture) set.add(prefecture);
    });
    return ["すべて", ...Array.from(set)];
  }, [scopedStores]);

  const cityOptions = useMemo(() => {
    if (prefFilter === "すべて") return ["すべて"];
    const set = new Set<string>();
    scopedStores.forEach((s) => {
      const { prefecture, city } = parseJapaneseAddress(s.address);
      if (prefecture === prefFilter && city) set.add(city);
    });
    return ["すべて", ...Array.from(set)];
  }, [scopedStores, prefFilter]);

  const filteredCustomers = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return scopedStores.filter((s) => {
      const matchStatus = statusFilter === "すべて" || s.status === statusFilter;
      const matchQuery =
        !q || s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q);
      const parsed = parseJapaneseAddress(s.address);
      const matchPref = prefFilter === "すべて" || parsed.prefecture === prefFilter;
      const matchCity = cityFilter === "すべて" || parsed.city === cityFilter;
      return matchStatus && matchQuery && matchPref && matchCity;
    });
  }, [scopedStores, statusFilter, searchText, prefFilter, cityFilter]);

  const customerMapPins: CustomerPin[] = useMemo(() => {
    return filteredCustomers
      .filter((s): s is StoreRecord & { lat: number; lng: number } => s.lat !== null && s.lng !== null)
      .map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        lat: s.lat,
        lng: s.lng,
        address: s.address,
        phone: s.phone,
        memo: s.situation,
        placeId: s.placeId,
        isMine: s.ownerUid === profile.uid,
        ownerName: resolveOwnerName(s),
        appointmentDate: s.appointmentDate,
        appointmentTime: s.appointmentTime,
      }));
  }, [filteredCustomers, profile.uid, userNameMap]);

  // 未登録の店舗候補（独立フィルタ）
  const unregisteredCandidates = useMemo(() => {
    const q = prospectFilterText.trim().toLowerCase();
    return candidates.filter((c) => {
      if (registeredPlaceIds.has(c.placeId)) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) || c.address.toLowerCase().includes(q)
      );
    });
  }, [candidates, registeredPlaceIds, prospectFilterText]);

  const handleFocusOnMap = (store: StoreRecord) => {
    if (store.lat === null || store.lng === null) {
      showToast("この顧客には位置情報がありません");
      return;
    }
    setFocusTarget({
      id: store.id,
      lat: store.lat,
      lng: store.lng,
      nonce: Date.now(),
    });
    setSectionTab("customers");
    setCustomerViewMode("map");
  };

  const handleSearchCurrentLocation = () => {
    if (!navigator.geolocation) {
      setPlaceError("お使いの端末では現在地を取得できません。場所名で検索してください。");
      return;
    }
    setPlaceError("");
    setSearchingPlaces(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const list = await searchRestaurantsNearby(
            pos.coords.latitude,
            pos.coords.longitude,
            mapsApiKey,
            selectedGenre
          );
          setCandidates(list);
          setSectionTab("prospects");
          const genreLabel = selectedGenre === "すべて" ? "飲食店" : selectedGenre;
          showToast(`周辺の${genreLabel}を${list.length}件見つけました`);
        } catch (err) {
          setPlaceError(err instanceof Error ? err.message : "検索に失敗しました。");
        } finally {
          setSearchingPlaces(false);
        }
      },
      () => {
        setSearchingPlaces(false);
        setPlaceError("位置情報の許可がオフです。場所名（例：難波駅）で検索してください。");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSearchPlaceText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeQuery.trim()) return;
    setPlaceError("");
    setSearchingPlaces(true);
    try {
      const list = await searchRestaurantsByPlaceText(
        placeQuery,
        mapsApiKey,
        selectedGenre
      );
      setCandidates(list);
      setSectionTab("prospects");
      const genreLabel = selectedGenre === "すべて" ? "飲食店" : selectedGenre;
      showToast(`「${placeQuery.trim()}」周辺の${genreLabel}を${list.length}件見つけました`);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "検索に失敗しました。");
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleRegisterCandidate = async (
    candidate: PlaceCandidatePin,
    chosenStatus: CustomerStatus,
    appointment?: { date: string; time: string }
  ) => {
    if (registeredPlaceIds.has(candidate.placeId)) return;
    if (chosenStatus === "アポ獲得" && (!appointment?.date || !appointment?.time)) {
      setCandidateErrorMap((prev) => ({
        ...prev,
        [candidate.placeId]: "「アポ獲得」の場合は日付と時間の両方を入力してください。",
      }));
      return;
    }
    setCandidateErrorMap((prev) => ({ ...prev, [candidate.placeId]: "" }));
    setRegisteringPlaceId(candidate.placeId);
    try {
      const genreMemo =
        selectedGenre !== "すべて" ? `（${selectedGenre}検索）` : "";
      const created = await createStore(
        profile,
        {
          name: candidate.name,
          address: candidate.address,
          phone: candidate.phone ?? "",
          situation: `周辺検索から「${chosenStatus}」で登録${genreMemo}`,
          status: chosenStatus,
          lat: candidate.lat,
          lng: candidate.lng,
          placeId: candidate.placeId,
          appointmentDate: appointment?.date,
          appointmentTime: appointment?.time,
        },
        mapsApiKey
      );
      setStores((prev) => [created, ...prev]);
      showToast(`${candidate.name} を「${chosenStatus}」で顧客登録しました`);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setRegisteringPlaceId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingStore) return;
    setDeletingBusy(true);
    try {
      await deleteStore(deletingStore.id);
      setStores((prev) => prev.filter((s) => s.id !== deletingStore.id));
      if (selectedListStoreId === deletingStore.id) setSelectedListStoreId(null);
      showToast(`「${deletingStore.name}」を削除しました`);
      setDeletingStore(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeletingBusy(false);
    }
  };

  const openEditor = (store: StoreRecord) => {
    setEditingStore(store);
    setEditStatus(store.status);
    setEditApptDate(store.appointmentDate || "");
    setEditApptTime(store.appointmentTime || "");
    setEditContractDate(store.contractDate || new Date().toISOString().slice(0, 10));
    setEditError("");
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    if (editStatus === "アポ獲得" && (!editApptDate || !editApptTime)) {
      setEditError("「アポ獲得」の場合は日付と時間の両方を入力してください。");
      return;
    }
    if (editStatus === "契約済み" && !editContractDate) {
      setEditError("「契約済み」の場合は契約日を入力してください。");
      return;
    }
    setSavingEdit(true);
    try {
      await updateStoreStatus(editingStore.id, {
        status: editStatus,
        appointmentDate: editApptDate,
        appointmentTime: editApptTime,
        contractDate: editContractDate,
      });
      setStores((prev) =>
        prev.map((s) =>
          s.id === editingStore.id
            ? {
                ...s,
                status: editStatus,
                appointmentDate: editStatus === "アポ獲得" ? editApptDate : "",
                appointmentTime: editStatus === "アポ獲得" ? editApptTime : "",
                contractDate: editStatus === "契約済み" ? editContractDate : "",
              }
            : s
        )
      );
      setEditingStore(null);
      showToast("ステータスを更新しました");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-[#1C1A16]">顧客・店舗</h1>
      </div>

      {/* 「顧客（登録済み）」と「店舗（未登録候補）」の分離タブ */}
      <div
        role="tablist"
        aria-label="顧客と店舗の切り替え"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-[#1C1A16] bg-[#EFEAE0] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={sectionTab === "customers"}
          onClick={() => setSectionTab("customers")}
          className={`min-h-[42px] rounded-xl text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
            sectionTab === "customers"
              ? "bg-[#1C1A16] text-white"
              : "text-[#474239]"
          }`}
        >
          顧客（登録済み {scopedStores.length}）
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sectionTab === "prospects"}
          onClick={() => setSectionTab("prospects")}
          className={`min-h-[42px] rounded-xl text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
            sectionTab === "prospects"
              ? "bg-[#D94E2B] text-white"
              : "text-[#474239]"
          }`}
        >
          店舗（候補 {unregisteredCandidates.length}）
        </button>
      </div>

      {toast && (
        <div
          role="status"
          className="gurupo-toast-pop flex items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-2.5 text-xs font-extrabold text-white"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* ==================== 顧客（登録済み）セクション ==================== */}
      {sectionTab === "customers" && (
        <div className="space-y-3.5">
          {/* 表示範囲切替（自分の店舗 / チーム全体） */}
          <div
            role="group"
            aria-label="顧客の表示範囲"
            className="grid grid-cols-2 gap-1 rounded-2xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-1"
          >
            <button
              type="button"
              onClick={() => setScopeFilter("mine")}
              className={`min-h-[40px] rounded-xl text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                effectiveScope === "mine"
                  ? "bg-[#1C1A16] text-white"
                  : "text-[#474239]"
              }`}
            >
              自分の店舗
            </button>
            <button
              type="button"
              disabled={!isLeader}
              onClick={() => {
                if (isLeader) setScopeFilter("team");
              }}
              title={!isLeader ? "チーム全体の表示はマネージャー・管理者のみ利用できます" : undefined}
              className={`flex min-h-[40px] items-center justify-center gap-1 rounded-xl text-xs font-extrabold transition-transform duration-100 ${
                !isLeader
                  ? "cursor-not-allowed text-[#8A8377] opacity-65"
                  : effectiveScope === "team"
                  ? "bg-[#1C1A16] text-white active:scale-[0.97]"
                  : "text-[#474239] active:scale-[0.97]"
              }`}
            >
              {!isLeader && <Lock className="h-3.5 w-3.5 shrink-0" />}
              <span>チーム全体</span>
            </button>
          </div>

          {/* 顧客キーワード検索＋地図/一覧切替 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#575249]" />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="登録済み顧客を絞り込み"
                className="min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white pl-9 pr-3 text-sm font-medium focus:border-[#D94E2B] focus:outline-none"
              />
            </div>
            <div className="flex rounded-xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setCustomerViewMode("map")}
                className={`min-h-[40px] rounded-lg px-3 ${
                  customerViewMode === "map" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                }`}
              >
                地図
              </button>
              <button
                type="button"
                onClick={() => setCustomerViewMode("list")}
                className={`min-h-[40px] rounded-lg px-3 ${
                  customerViewMode === "list" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                }`}
              >
                一覧
              </button>
            </div>
          </div>

          {/* 地域絞り込み（都道府県 → 市区町村） */}
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="都道府県で絞り込み"
              value={prefFilter}
              onChange={(e) => {
                setPrefFilter(e.target.value);
                setCityFilter("すべて");
              }}
              className="min-h-[40px] rounded-xl border-2 border-[#D5CEC0] bg-white px-2.5 text-xs font-extrabold text-[#1C1A16] focus:border-[#D94E2B] focus:outline-none"
            >
              {prefectureOptions.map((pref) => (
                <option key={pref} value={pref}>
                  {pref === "すべて" ? "都道府県：すべて" : pref}
                </option>
              ))}
            </select>
            <select
              aria-label="市区町村で絞り込み"
              value={cityFilter}
              disabled={prefFilter === "すべて"}
              onChange={(e) => setCityFilter(e.target.value)}
              className="min-h-[40px] rounded-xl border-2 border-[#D5CEC0] bg-white px-2.5 text-xs font-extrabold text-[#1C1A16] focus:border-[#D94E2B] focus:outline-none disabled:bg-[#EFEAE0] disabled:text-[#8A8377]"
            >
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city === "すべて" ? "市区町村：すべて" : city}
                </option>
              ))}
            </select>
          </div>

          {/* ステータス絞り込み（4ステータスのみ） */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(["すべて", ...STORE_STATUS_LIST] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[38px] shrink-0 rounded-full border-2 px-3.5 text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                  statusFilter === st
                    ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                    : "border-[#D5CEC0] bg-white text-[#3D3932]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="py-6 text-center text-xs font-bold text-[#575249]">
              顧客データを読み込み中...
            </p>
          ) : customerViewMode === "map" ? (
            <CustomerMap
              customers={customerMapPins}
              focusTarget={focusTarget}
              canDeleteCustomer={(pin) =>
                isLeader ||
                stores.some((s) => s.id === pin.id && s.ownerUid === profile.uid)
              }
              onRequestDelete={(pin) =>
                setDeletingStore({ id: pin.id, name: pin.name })
              }
              apiKey={mapsApiKey}
              geminiApiKey={geminiApiKey}
              salesRepName={profile.name}
            />
          ) : filteredCustomers.length === 0 ? (
            <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-5 text-center text-xs font-bold text-[#575249]">
              該当する顧客がありません。「店舗」タブの周辺検索から登録できます。
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCustomers.map((store) => (
                <article key={store.id} className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md border border-[#D5CEC0] bg-[#F7F4ED] px-2 py-0.5 text-xs font-extrabold">
                      {store.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#575249]">
                        登録者：{resolveOwnerName(store)}
                      </span>
                      {(isLeader || store.ownerUid === profile.uid) && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeletingStore({ id: store.id, name: store.name })
                          }
                          aria-label={`${store.name}を削除`}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 active:scale-[0.97]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <h2 className="mt-1.5 text-base font-extrabold text-[#1C1A16]">{store.name}</h2>
                  {store.status === "アポ獲得" &&
                    (store.appointmentDate || store.appointmentTime) && (
                      <p className="mt-1 flex items-center gap-1 text-xs font-extrabold text-blue-900">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          アポ日時：{store.appointmentDate} {store.appointmentTime}
                        </span>
                      </p>
                    )}
                  {store.address && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-[#474239]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D94E2B]" />
                      <span>{store.address}</span>
                    </p>
                  )}
                  {store.situation && (
                    <p className="mt-1.5 rounded-lg bg-[#F7F4ED] px-2.5 py-1.5 text-xs font-medium text-[#3D3932]">
                      状況：{store.situation}
                    </p>
                  )}
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFocusOnMap(store)}
                      className="flex min-h-[42px] items-center justify-center gap-1 rounded-xl border-2 border-[#D5CEC0] bg-white text-[11px] font-extrabold text-[#1C1A16] active:scale-[0.97]"
                    >
                      <MapPin className="h-3.5 w-3.5 text-[#D94E2B]" />
                      <span>地図</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedListStoreId((prev) => (prev === store.id ? null : store.id))
                      }
                      className={`flex min-h-[42px] items-center justify-center gap-1 rounded-xl border-2 text-[11px] font-extrabold active:scale-[0.97] ${
                        selectedListStoreId === store.id
                          ? "border-[#D94E2B] bg-[#FFF5F2] text-[#B93818]"
                          : "border-[#D5CEC0] bg-[#FBF9F4] text-[#1C1A16]"
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5 text-[#D94E2B]" />
                      <span>営業情報</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditor(store)}
                      className="min-h-[42px] rounded-xl border-2 border-[#1C1A16] bg-white text-[11px] font-extrabold text-[#1C1A16] active:scale-[0.97]"
                    >
                      ステータス
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab("visit")}
                      className="min-h-[42px] rounded-xl bg-[#D94E2B] text-[11px] font-extrabold text-white active:scale-[0.97]"
                    >
                      訪問記録
                    </button>
                  </div>
                  {selectedListStoreId === store.id && (
                    <div className="mt-3">
                      <SalesInsightPanel
                        key={`list-${store.id}`}
                        target={{
                          id: store.id,
                          name: store.name,
                          address: store.address,
                          placeId: store.placeId,
                        }}
                        mapsApiKey={mapsApiKey}
                        geminiApiKey={geminiApiKey}
                        salesRepName={profile.name}
                      />
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================== 店舗（周辺検索の未登録候補）セクション ==================== */}
      {sectionTab === "prospects" && (
        <div className="space-y-3.5">
          {/* Places API 周辺飲食店検索パネル（ジャンル絞り込み対応） */}
          <section className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-extrabold text-[#1C1A16]">
                周辺の店舗を探す（Places API）
              </p>
              {candidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCandidates([])}
                  className="text-[11px] font-bold text-[#575249] underline"
                >
                  候補をクリア
                </button>
              )}
            </div>

            {/* ジャンル絞り込み */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {RESTAURANT_GENRES.map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`min-h-[34px] shrink-0 rounded-full border-2 px-3 text-[11px] font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                    selectedGenre === genre
                      ? "border-[#D94E2B] bg-[#D94E2B] text-white"
                      : "border-[#D5CEC0] bg-[#FBF9F4] text-[#3D3932]"
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchPlaceText} className="flex gap-2">
              <input
                type="text"
                value={placeQuery}
                onChange={(e) => setPlaceQuery(e.target.value)}
                placeholder="駅名やエリア（例：難波駅、天王寺）"
                className="min-h-[42px] flex-1 rounded-xl border-2 border-[#D5CEC0] bg-[#FBF9F4] px-3 text-xs font-bold focus:border-[#D94E2B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={searchingPlaces}
                className="min-h-[42px] rounded-xl bg-[#1C1A16] px-3.5 text-xs font-extrabold text-white active:scale-[0.97] disabled:opacity-60"
              >
                検索
              </button>
            </form>

            <button
              type="button"
              disabled={searchingPlaces}
              onClick={handleSearchCurrentLocation}
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-[#F7F4ED] text-xs font-extrabold text-[#1C1A16] active:scale-[0.97] disabled:opacity-60"
            >
              <LocateFixed className="h-4 w-4 text-[#D94E2B]" />
              <span>
                {searchingPlaces
                  ? "検索中..."
                  : `現在地周辺の${selectedGenre === "すべて" ? "飲食店" : selectedGenre}を検索`}
              </span>
            </button>

            {placeError && (
              <p role="alert" className="text-xs font-extrabold text-red-900">
                {placeError}
              </p>
            )}
          </section>

          {/* 店舗候補の独立絞り込み＋一覧/地図切替 */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#575249]" />
              <input
                type="text"
                value={prospectFilterText}
                onChange={(e) => setProspectFilterText(e.target.value)}
                placeholder="検索候補を店名・住所で絞り込み"
                className="min-h-[42px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white pl-9 pr-3 text-xs font-medium focus:border-[#D94E2B] focus:outline-none"
              />
            </div>
            <div className="flex rounded-xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-xs font-extrabold">
              <button
                type="button"
                onClick={() => setProspectViewMode("list")}
                className={`min-h-[38px] rounded-lg px-3 ${
                  prospectViewMode === "list" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                }`}
              >
                一覧
              </button>
              <button
                type="button"
                onClick={() => setProspectViewMode("map")}
                className={`min-h-[38px] rounded-lg px-3 ${
                  prospectViewMode === "map" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
                }`}
              >
                地図
              </button>
            </div>
          </div>

          {prospectViewMode === "map" ? (
            <CustomerMap
              customers={[]}
              candidates={unregisteredCandidates}
              registeredPlaceIds={registeredPlaceIds}
              onRegisterCandidate={(cand, chosenStatus, appt) =>
                void handleRegisterCandidate(cand, chosenStatus, appt)
              }
              registeringPlaceId={registeringPlaceId}
              showLegend={false}
              apiKey={mapsApiKey}
              geminiApiKey={geminiApiKey}
              salesRepName={profile.name}
            />
          ) : unregisteredCandidates.length === 0 ? (
            <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-5 text-center text-xs font-bold text-[#575249]">
              上の検索から周辺の店舗を探すと、ここに未登録の店舗候補が一覧表示されます。
            </div>
          ) : (
            <div className="space-y-3">
              {unregisteredCandidates.map((cand) => {
                const chosenStatus = candidateStatusMap[cand.placeId] ?? "キック";
                const appt = candidateApptMap[cand.placeId] ?? { date: "", time: "" };
                const candErr = candidateErrorMap[cand.placeId] ?? "";
                const isExpanded = Boolean(expandedCandidateIds[cand.placeId]);
                return (
                  <article
                    key={cand.placeId}
                    className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block rounded-md bg-orange-600 px-2 py-0.5 text-[11px] font-extrabold text-white">
                          未登録店舗
                        </span>
                        {cand.rating && (
                          <span className="text-xs font-bold text-[#575249]">
                            ★ {cand.rating}
                          </span>
                        )}
                      </div>
                      <h2 className="mt-1.5 text-base font-extrabold text-[#1C1A16]">
                        {cand.name}
                      </h2>
                      <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-[#575249]">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D94E2B]" />
                        <span>{cand.address}</span>
                      </p>
                    </div>

                    {/* 4ステータス選択＋アポ獲得時日時必須 */}
                    <div className="space-y-2">
                      <div className="grid grid-cols-4 gap-1.5">
                        {STORE_STATUS_LIST.map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              setCandidateStatusMap((prev) => ({
                                ...prev,
                                [cand.placeId]: st,
                              }));
                              setCandidateErrorMap((prev) => ({
                                ...prev,
                                [cand.placeId]: "",
                              }));
                            }}
                            className={`min-h-[34px] rounded-lg border-2 px-1 text-[11px] font-extrabold active:scale-[0.97] ${
                              chosenStatus === st
                                ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                                : "border-[#D5CEC0] bg-[#FBF9F4] text-[#3D3932]"
                            }`}
                          >
                            {st}
                          </button>
                        ))}
                      </div>

                      {chosenStatus === "アポ獲得" && (
                        <div className="space-y-1">
                          <p className="text-[11px] font-extrabold text-blue-900">
                            アポ日時（必須）
                          </p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="date"
                              aria-label={`${cand.name}のアポ日付`}
                              value={appt.date}
                              onChange={(e) => {
                                setCandidateApptMap((prev) => ({
                                  ...prev,
                                  [cand.placeId]: { ...appt, date: e.target.value },
                                }));
                                setCandidateErrorMap((prev) => ({
                                  ...prev,
                                  [cand.placeId]: "",
                                }));
                              }}
                              className="min-h-[38px] rounded-lg border-2 border-[#1C1A16] bg-white px-2 text-xs font-bold"
                            />
                            <input
                              type="time"
                              aria-label={`${cand.name}のアポ時間`}
                              value={appt.time}
                              onChange={(e) => {
                                setCandidateApptMap((prev) => ({
                                  ...prev,
                                  [cand.placeId]: { ...appt, time: e.target.value },
                                }));
                                setCandidateErrorMap((prev) => ({
                                  ...prev,
                                  [cand.placeId]: "",
                                }));
                              }}
                              className="min-h-[38px] rounded-lg border-2 border-[#1C1A16] bg-white px-2 text-xs font-bold"
                            />
                          </div>
                        </div>
                      )}

                      {candErr && (
                        <p className="text-xs font-extrabold text-red-900">{candErr}</p>
                      )}

                      <button
                        type="button"
                        disabled={registeringPlaceId === cand.placeId}
                        onClick={() =>
                          void handleRegisterCandidate(cand, chosenStatus, appt)
                        }
                        className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] px-3 text-xs font-extrabold text-white active:scale-[0.97] disabled:opacity-60"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>
                          {registeringPlaceId === cand.placeId
                            ? "登録中..."
                            : `「${chosenStatus}」で顧客登録`}
                        </span>
                      </button>
                    </div>

                    {/* ∨ アイコンでその場に営業情報パネルを展開表示 */}
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() =>
                        setExpandedCandidateIds((prev) => ({
                          ...prev,
                          [cand.placeId]: !prev[cand.placeId],
                        }))
                      }
                      className="flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#D5CEC0] bg-[#FBF9F4] text-xs font-extrabold text-[#474239] active:scale-[0.98]"
                    >
                      <span>{isExpanded ? "営業情報を閉じる" : "営業情報・スクリプトを見る"}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>

                    {isExpanded && (
                      <SalesInsightPanel
                        key={`cand-list-${cand.placeId}`}
                        target={{
                          id: cand.placeId,
                          name: cand.name,
                          address: cand.address,
                          placeId: cand.placeId,
                        }}
                        mapsApiKey={mapsApiKey}
                        geminiApiKey={geminiApiKey}
                        salesRepName={profile.name}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ステータス変更モーダル（契約金額削除・アポ獲得時日時必須） */}
      {editingStore && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
        >
          <form
            onSubmit={handleSaveStatus}
            className="gurupo-toast-pop w-full max-w-md space-y-3 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold">{editingStore.name}</h2>
              <button
                type="button"
                onClick={() => setEditingStore(null)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {STORE_STATUS_LIST.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setEditStatus(st);
                    setEditError("");
                  }}
                  className={`min-h-[42px] rounded-xl border-2 text-xs font-extrabold ${
                    editStatus === st
                      ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                      : "border-[#D5CEC0] bg-white text-[#1C1A16]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            {editStatus === "アポ獲得" && (
              <div className="space-y-1.5">
                <p className="text-xs font-extrabold text-blue-900">
                  アポ獲得日時（日付・時間とも必須）
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    aria-label="アポ日付"
                    value={editApptDate}
                    onChange={(e) => {
                      setEditApptDate(e.target.value);
                      setEditError("");
                    }}
                    className="min-h-[46px] w-full rounded-xl border-2 border-[#1C1A16] bg-white px-2 text-sm font-bold"
                  />
                  <input
                    type="time"
                    aria-label="アポ時間"
                    value={editApptTime}
                    onChange={(e) => {
                      setEditApptTime(e.target.value);
                      setEditError("");
                    }}
                    className="min-h-[46px] w-full rounded-xl border-2 border-[#1C1A16] bg-white px-2 text-sm font-bold"
                  />
                </div>
              </div>
            )}
            {editStatus === "契約済み" && (
              <div className="space-y-1.5">
                <p className="text-xs font-extrabold text-emerald-900">契約日（必須）</p>
                <input
                  type="date"
                  aria-label="契約日"
                  value={editContractDate}
                  onChange={(e) => {
                    setEditContractDate(e.target.value);
                    setEditError("");
                  }}
                  className="min-h-[46px] w-full rounded-xl border-2 border-[#1C1A16] bg-white px-3 text-sm font-bold"
                />
              </div>
            )}
            {editError && (
              <p className="flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-extrabold text-red-900">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{editError}</span>
              </p>
            )}
            <button
              type="submit"
              disabled={savingEdit}
              className="min-h-[48px] w-full rounded-2xl bg-[#D94E2B] text-sm font-extrabold text-white"
            >
              {savingEdit ? "保存中..." : "保存する"}
            </button>
          </form>
        </div>
      )}

      {/* 削除確認モーダル */}
      {deletingStore && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="gurupo-toast-pop w-full max-w-sm space-y-4 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-2xl">
            <h2 className="text-base font-extrabold text-[#1C1A16]">顧客を削除しますか？</h2>
            <p className="text-xs font-medium leading-relaxed text-[#474239]">
              「<span className="font-extrabold text-[#1C1A16]">{deletingStore.name}</span>」を登録リストから削除します。この操作は取り消せません。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={deletingBusy}
                onClick={() => setDeletingStore(null)}
                className="min-h-[44px] rounded-xl border-2 border-[#D5CEC0] bg-white text-xs font-extrabold text-[#1C1A16]"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deletingBusy}
                onClick={() => void handleConfirmDelete()}
                className="min-h-[44px] rounded-xl bg-red-700 text-xs font-extrabold text-white disabled:opacity-60"
              >
                {deletingBusy ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
