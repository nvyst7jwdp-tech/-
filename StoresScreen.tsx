/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  MapPin,
  Phone,
  X,
  CheckCircle2,
  AlertCircle,
  LocateFixed,
  UserPlus,
  Check,
  Route,
  Navigation,
  Lock,
  Sparkles,
  Trash2,
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
import {
  computeOptimalRoute,
  type OptimizedRouteResult,
} from "../services/routesService";
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
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [userNameMap, setUserNameMap] = useState<Map<string, string>>(
    () => new Map([[profile.uid, profile.name]])
  );
  const [loading, setLoading] = useState(true);
  const [scopeFilter, setScopeFilter] = useState<"mine" | "team">(
    isLeader ? "team" : "mine"
  );
  const effectiveScope: "mine" | "team" = isLeader ? scopeFilter : "mine";
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [statusFilter, setStatusFilter] = useState<"すべて" | CustomerStatus>("すべて");
  const [searchText, setSearchText] = useState("");
  const [toast, setToast] = useState("");
  const [selectedListStoreId, setSelectedListStoreId] = useState<string | null>(null);
  const [prefFilter, setPrefFilter] = useState("すべて");
  const [cityFilter, setCityFilter] = useState("すべて");
  const [focusTarget, setFocusTarget] = useState<{
    id: string;
    lat: number;
    lng: number;
    nonce: number;
  } | null>(null);
  const [deletingStore, setDeletingStore] = useState<{ id: string; name: string } | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  // Places API 飲食店検索状態
  const [placeQuery, setPlaceQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<RestaurantGenre>("すべて");
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidatePin[]>([]);
  const [candidateStatusMap, setCandidateStatusMap] = useState<
    Record<string, CustomerStatus>
  >({});
  const [registeringPlaceId, setRegisteringPlaceId] = useState<string | null>(null);

  // Routes API 最適ルート状態
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [optimizingRoute, setOptimizingRoute] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRouteResult | null>(null);

  // 新規店舗登録モーダル
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSituation, setNewSituation] = useState("");
  const [newStatus, setNewStatus] = useState<CustomerStatus>("キック");
  const [savingNew, setSavingNew] = useState(false);

  // ステータス編集モーダル
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [editStatus, setEditStatus] = useState<CustomerStatus>("キック");
  const [editContractDate, setEditContractDate] = useState("");
  const [editContractAmount, setEditContractAmount] = useState("");
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

  const filteredStores = useMemo(() => {
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

  const handleFocusOnMap = (store: StoreRecord) => {
    if (store.lat === null || store.lng === null) {
      showToast("この店舗には位置情報がありません");
      return;
    }
    setFocusTarget({
      id: store.id,
      lat: store.lat,
      lng: store.lng,
      nonce: Date.now(),
    });
    setViewMode("map");
  };

  const handleConfirmDelete = async () => {
    if (!deletingStore) return;
    setDeletingBusy(true);
    try {
      await deleteStore(deletingStore.id);
      setStores((prev) => prev.filter((s) => s.id !== deletingStore.id));
      setSelectedRouteIds((prev) => prev.filter((id) => id !== deletingStore.id));
      if (selectedListStoreId === deletingStore.id) setSelectedListStoreId(null);
      showToast(`「${deletingStore.name}」を削除しました`);
      setDeletingStore(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setDeletingBusy(false);
    }
  };

  const mapPins: CustomerPin[] = useMemo(() => {
    return filteredStores
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
      }));
  }, [filteredStores, profile.uid, userNameMap]);

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
          setViewMode("map");
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
      setViewMode("map");
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
    chosenStatus: CustomerStatus
  ) => {
    if (registeredPlaceIds.has(candidate.placeId)) return;
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
        },
        mapsApiKey
      );
      setStores((prev) => [created, ...prev]);
      showToast(`${candidate.name} を「${chosenStatus}」で登録しました`);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "登録に失敗しました。");
    } finally {
      setRegisteringPlaceId(null);
    }
  };

  const routeOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    optimizedRoute?.orderedCustomers.forEach((c, idx) => {
      map.set(c.id, idx + 1);
    });
    return map;
  }, [optimizedRoute]);

  const toggleRouteSelection = (storeId: string) => {
    setSelectedRouteIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const visibleSelectedRouteCount = useMemo(
    () => mapPins.filter((pin) => selectedRouteIds.includes(pin.id)).length,
    [mapPins, selectedRouteIds]
  );

  const handleOptimizeRoute = async () => {
    const selectedPins = mapPins.filter((pin) => selectedRouteIds.includes(pin.id));
    if (selectedPins.length < 2) {
      setRouteError("位置情報のある店舗を2件以上選択してください。");
      return;
    }
    setRouteError("");
    setOptimizingRoute(true);
    try {
      const result = await computeOptimalRoute(selectedPins, mapsApiKey);
      setOptimizedRoute(result);
      setViewMode("map");
      showToast(`最適ルートを作成しました（${result.orderedCustomers.length}件）`);
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : "ルート最適化に失敗しました。");
    } finally {
      setOptimizingRoute(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newAddress.trim()) return;
    setSavingNew(true);
    try {
      const created = await createStore(
        profile,
        {
          name: newName,
          address: newAddress,
          phone: newPhone,
          situation: newSituation,
          status: newStatus,
        },
        mapsApiKey
      );
      setStores((prev) => [created, ...prev]);
      setNewName("");
      setNewAddress("");
      setNewPhone("");
      setNewSituation("");
      setNewStatus("キック");
      setShowAddModal(false);
      showToast(
        created.lat !== null
          ? "店舗を登録し、地図ピンを設定しました"
          : "店舗を登録しました（住所の位置取得はスキップ）"
      );
    } finally {
      setSavingNew(false);
    }
  };

  const openEditor = (store: StoreRecord) => {
    setEditingStore(store);
    setEditStatus(store.status);
    setEditContractDate(store.contractDate || new Date().toISOString().slice(0, 10));
    setEditContractAmount(store.contractAmount || "");
    setEditError("");
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    if (editStatus === "契約済み") {
      if (!editContractDate) {
        setEditError("「契約済み」の場合は契約日を入力してください。");
        return;
      }
      if (!editContractAmount || Number(editContractAmount) <= 0) {
        setEditError("「契約済み」の場合は契約金額を入力してください。");
        return;
      }
    }
    setSavingEdit(true);
    try {
      await updateStoreStatus(editingStore.id, {
        status: editStatus,
        contractDate: editContractDate,
        contractAmount: editContractAmount,
      });
      setStores((prev) =>
        prev.map((s) =>
          s.id === editingStore.id
            ? {
                ...s,
                status: editStatus,
                contractDate: editStatus === "契約済み" ? editContractDate : "",
                contractAmount: editStatus === "契約済み" ? editContractAmount : "",
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
        <h1 className="text-xl font-extrabold text-[#1C1A16]">店舗</h1>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="flex min-h-[42px] items-center gap-1 rounded-xl bg-[#D94E2B] px-3.5 text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          <span>店舗を登録</span>
        </button>
      </div>

      {/* 表示範囲切替（自分の店舗 / チーム全体） */}
      <div
        role="group"
        aria-label="店舗の表示範囲"
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

      {toast && (
        <div
          role="status"
          className="gurupo-toast-pop flex items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-2.5 text-xs font-extrabold text-white"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* Places API 周辺飲食店検索パネル（ジャンル絞り込み対応） */}
      <section className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-extrabold text-[#1C1A16]">周辺の飲食店を探す（Places API）</p>
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

      {/* 検索＋地図/一覧切替 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#575249]" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="登録済み店舗を絞り込み"
            className="min-h-[44px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white pl-9 pr-3 text-sm font-medium focus:border-[#D94E2B] focus:outline-none"
          />
        </div>
        <div className="flex rounded-xl border-2 border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-xs font-extrabold">
          <button
            type="button"
            onClick={() => setViewMode("map")}
            className={`min-h-[40px] rounded-lg px-3 ${
              viewMode === "map" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
            }`}
          >
            地図
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`min-h-[40px] rounded-lg px-3 ${
              viewMode === "list" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
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
        <p className="py-6 text-center text-xs font-bold text-[#575249]">店舗データを読み込み中...</p>
      ) : viewMode === "map" ? (
        <div className="space-y-4">
          <CustomerMap
            customers={mapPins}
            candidates={candidates}
            registeredPlaceIds={registeredPlaceIds}
            onRegisterCandidate={(cand, chosenStatus) =>
              void handleRegisterCandidate(cand, chosenStatus)
            }
            registeringPlaceId={registeringPlaceId}
            routePath={optimizedRoute?.polylinePath ?? []}
            routeOrderMap={routeOrderMap}
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

          {/* 複数店舗の最適ルート作成（Routes API） */}
          <section className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Route className="h-4 w-4 text-[#D94E2B]" />
                <h2 className="text-sm font-extrabold text-[#1C1A16]">
                  最適ルート作成（Routes API）
                </h2>
              </div>
              {optimizedRoute && (
                <button
                  type="button"
                  onClick={() => setOptimizedRoute(null)}
                  className="text-xs font-bold text-[#575249] underline"
                >
                  経路クリア
                </button>
              )}
            </div>

            {mapPins.length < 2 ? (
              <p className="text-xs font-medium text-[#575249]">
                地図上に2件以上の店舗があると、訪問順を最適化できます。
              </p>
            ) : (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {mapPins.map((pin) => {
                    const checked = selectedRouteIds.includes(pin.id);
                    return (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={() => toggleRouteSelection(pin.id)}
                        className={`min-h-[36px] rounded-xl border-2 px-2.5 text-xs font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                          checked
                            ? "border-[#D94E2B] bg-[#FFF5F2] text-[#B93818]"
                            : "border-[#D5CEC0] bg-[#FBF9F4] text-[#3D3932]"
                        }`}
                      >
                        {checked ? "✓ " : "+ "}
                        {pin.name}
                      </button>
                    );
                  })}
                </div>

                {routeError && (
                  <p role="alert" className="text-xs font-extrabold text-red-900">
                    {routeError}
                  </p>
                )}

                <button
                  type="button"
                  disabled={optimizingRoute || visibleSelectedRouteCount < 2}
                  onClick={() => void handleOptimizeRoute()}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white disabled:opacity-50"
                >
                  <Route className="h-4 w-4" />
                  <span>
                    {optimizingRoute
                      ? "最適ルートを計算中..."
                      : `選択した${visibleSelectedRouteCount}件で最適ルートを作成`}
                  </span>
                </button>
              </>
            )}

            {optimizedRoute && (
              <div className="space-y-2.5 border-t border-[#EAE3D5] pt-3">
                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span>最適化後の訪問順</span>
                  <span className="text-[#B93818]">
                    約{(optimizedRoute.totalDistanceMeters / 1000).toFixed(1)}km ・ {optimizedRoute.durationText}
                  </span>
                </div>
                <ol className="space-y-1.5">
                  {optimizedRoute.orderedCustomers.map((c, idx) => (
                    <li
                      key={c.id}
                      className="flex items-center gap-2.5 rounded-xl bg-[#F7F4ED] px-3 py-2 text-xs"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D94E2B] text-[11px] font-extrabold text-white">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-extrabold text-[#1C1A16]">{c.name}</p>
                        {c.address && (
                          <p className="truncate text-[11px] text-[#575249]">{c.address}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
                <a
                  href={optimizedRoute.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white active:scale-[0.97]"
                >
                  <Navigation className="h-4 w-4" />
                  <span>Google Mapsアプリでナビ開始</span>
                </a>
              </div>
            )}
          </section>

          {/* 検索結果からステータスを選択して登録できるリスト */}
          {candidates.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-sm font-extrabold text-[#1C1A16]">
                検索結果（{candidates.length}件）— ステータスを選んで登録
              </h2>
              {candidates.map((cand) => {
                const isRegistered = registeredPlaceIds.has(cand.placeId);
                const chosenStatus = candidateStatusMap[cand.placeId] ?? "キック";
                return (
                  <div
                    key={cand.placeId}
                    className="space-y-2.5 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold text-[#1C1A16]">
                          {cand.name}
                        </p>
                        <p className="truncate text-xs font-medium text-[#575249]">
                          {cand.address}
                        </p>
                      </div>
                      {isRegistered && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-700 bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-950">
                          <Check className="h-3.5 w-3.5" />
                          <span>登録済み</span>
                        </span>
                      )}
                    </div>

                    {!isRegistered && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-4 gap-1.5">
                          {STORE_STATUS_LIST.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                setCandidateStatusMap((prev) => ({
                                  ...prev,
                                  [cand.placeId]: st,
                                }))
                              }
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
                        <button
                          type="button"
                          disabled={registeringPlaceId === cand.placeId}
                          onClick={() => void handleRegisterCandidate(cand, chosenStatus)}
                          className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] px-3 text-xs font-extrabold text-white active:scale-[0.97] disabled:opacity-60"
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>
                            {registeringPlaceId === cand.placeId
                              ? "登録中..."
                              : `「${chosenStatus}」で登録する`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          )}
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="rounded-2xl border-2 border-[#D5CEC0] bg-white p-5 text-center text-xs font-bold text-[#575249]">
          登録された店舗がありません。「店舗を登録」または周辺検索から追加してください。
        </div>
      ) : (
        <div className="space-y-3">
          {filteredStores.map((store) => (
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

      {/* 新規店舗登録モーダル */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center"
        >
          <form
            onSubmit={handleCreateStore}
            className="gurupo-toast-pop w-full max-w-md space-y-3 rounded-3xl border-2 border-[#1C1A16] bg-[#FBF9F4] p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold">新しい店舗を登録</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="店舗名（必須）"
              className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-sm font-bold"
            />
            <input
              type="text"
              required
              value={newAddress}
              onChange={(e) => setNewAddress(e.target.value)}
              placeholder="住所（必須・自動で地図にピンを立てます）"
              className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-sm font-medium"
            />
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#575249]" />
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="電話番号（任意）"
                className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white pl-9 pr-3 text-sm"
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-extrabold text-[#575249]">登録ステータス</p>
              <div className="grid grid-cols-4 gap-1.5">
                {STORE_STATUS_LIST.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNewStatus(st)}
                    className={`min-h-[38px] rounded-xl border-2 text-xs font-extrabold ${
                      newStatus === st
                        ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                        : "border-[#D5CEC0] bg-white text-[#1C1A16]"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={newSituation}
              onChange={(e) => setNewSituation(e.target.value)}
              placeholder="状況メモ（任意）"
              className="min-h-[46px] w-full rounded-xl border-2 border-[#D5CEC0] bg-white px-3 text-sm"
            />
            <button
              type="submit"
              disabled={savingNew}
              className="min-h-[48px] w-full rounded-2xl bg-[#D94E2B] text-sm font-extrabold text-white disabled:opacity-60"
            >
              {savingNew ? "登録中..." : `「${newStatus}」で登録する`}
            </button>
          </form>
        </div>
      )}

      {/* ステータス変更モーダル */}
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
            {editStatus === "契約済み" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={editContractDate}
                  onChange={(e) => setEditContractDate(e.target.value)}
                  className="min-h-[46px] w-full rounded-xl border-2 border-[#1C1A16] bg-white px-2 text-sm font-bold"
                />
                <input
                  type="number"
                  min="1"
                  value={editContractAmount}
                  onChange={(e) => setEditContractAmount(e.target.value)}
                  placeholder="契約金額（円）"
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
            <h2 className="text-base font-extrabold text-[#1C1A16]">店舗を削除しますか？</h2>
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
