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
} from "lucide-react";
import type { AppTab, UserProfile } from "../types/gurupo";
import {
  CustomerMap,
  type CustomerPin,
  type CustomerStatus,
  type PlaceCandidatePin,
} from "./CustomerMap";
import {
  createStore,
  fetchStores,
  updateStoreStatus,
  type StoreRecord,
} from "../services/storesService";
import {
  searchRestaurantsByPlaceText,
  searchRestaurantsNearby,
} from "../services/placesService";
import {
  computeOptimalRoute,
  type OptimizedRouteResult,
} from "../services/routesService";

const STATUS_LIST: CustomerStatus[] = [
  "未接触",
  "アポ獲得",
  "商談中",
  "申込手続き",
  "契約済み",
  "見送り",
];

const DROP_REASONS = [
  "1. 予算・コスト合意不可",
  "2. 決裁者不在・面談不可",
  "3. 他社サービス利用中",
  "4. 人手不足・運用余力なし",
  "5. タイミング合わず（繁忙期等）",
  "6. 店舗方針・業態と不一致",
  "7. 閉店・改装・移転予定",
  "8. 連絡不通・音信不通",
  "9. その他",
];

export function StoresScreen({
  profile,
  onNavigateTab,
}: {
  profile: UserProfile;
  onNavigateTab: (tab: AppTab) => void;
}) {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "";
  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"map" | "list">("map");
  const [statusFilter, setStatusFilter] = useState<"すべて" | CustomerStatus>("すべて");
  const [searchText, setSearchText] = useState("");
  const [toast, setToast] = useState("");

  // Places API 飲食店検索状態
  const [placeQuery, setPlaceQuery] = useState("");
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [candidates, setCandidates] = useState<PlaceCandidatePin[]>([]);
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
  const [savingNew, setSavingNew] = useState(false);

  // ステータス編集モーダル
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null);
  const [editStatus, setEditStatus] = useState<CustomerStatus>("未接触");
  const [editDropReason, setEditDropReason] = useState("");
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
    fetchStores(profile)
      .then((list) => {
        if (active) setStores(list);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile]);

  const registeredPlaceIds = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.placeId) set.add(s.placeId);
    });
    return set;
  }, [stores]);

  const filteredStores = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return stores.filter((s) => {
      const matchStatus = statusFilter === "すべて" || s.status === statusFilter;
      const matchQuery =
        !q || s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [stores, statusFilter, searchText]);

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
      }));
  }, [filteredStores]);

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
            mapsApiKey
          );
          setCandidates(list);
          setViewMode("map");
          showToast(`周辺の飲食店を${list.length}件見つけました`);
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
      const list = await searchRestaurantsByPlaceText(placeQuery, mapsApiKey);
      setCandidates(list);
      setViewMode("map");
      showToast(`「${placeQuery.trim()}」周辺の飲食店を${list.length}件見つけました`);
    } catch (err) {
      setPlaceError(err instanceof Error ? err.message : "検索に失敗しました。");
    } finally {
      setSearchingPlaces(false);
    }
  };

  const handleRegisterCandidate = async (candidate: PlaceCandidatePin) => {
    if (registeredPlaceIds.has(candidate.placeId)) return;
    setRegisteringPlaceId(candidate.placeId);
    try {
      const created = await createStore(
        profile,
        {
          name: candidate.name,
          address: candidate.address,
          phone: candidate.phone ?? "",
          situation: "周辺検索から見込み客として登録",
          status: "未接触",
          lat: candidate.lat,
          lng: candidate.lng,
          placeId: candidate.placeId,
        },
        mapsApiKey
      );
      setStores((prev) => [created, ...prev]);
      showToast(`${candidate.name} を見込み客として登録しました`);
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
          status: "未接触",
        },
        mapsApiKey
      );
      setStores((prev) => [created, ...prev]);
      setNewName("");
      setNewAddress("");
      setNewPhone("");
      setNewSituation("");
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
    setEditDropReason(store.dropReason || "");
    setEditContractDate(store.contractDate || new Date().toISOString().slice(0, 10));
    setEditContractAmount(store.contractAmount || "");
    setEditError("");
  };

  const handleSaveStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    if (editStatus === "見送り" && !editDropReason) {
      setEditError("「見送り」の場合は理由を9項目から選択してください。");
      return;
    }
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
        dropReason: editDropReason,
        contractDate: editContractDate,
        contractAmount: editContractAmount,
      });
      setStores((prev) =>
        prev.map((s) =>
          s.id === editingStore.id
            ? {
                ...s,
                status: editStatus,
                dropReason: editStatus === "見送り" ? editDropReason : "",
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

      {toast && (
        <div
          role="status"
          className="gurupo-toast-pop flex items-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-900 px-4 py-2.5 text-xs font-extrabold text-white"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
          <span>{toast}</span>
        </div>
      )}

      {/* Places API 周辺飲食店検索パネル */}
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
          <span>{searchingPlaces ? "検索中..." : "現在地周辺の飲食店を検索"}</span>
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

      {/* ステータス絞り込み */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(["すべて", ...STATUS_LIST] as const).map((st) => (
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
            onRegisterCandidate={(cand) => void handleRegisterCandidate(cand)}
            registeringPlaceId={registeringPlaceId}
            routePath={optimizedRoute?.polylinePath ?? []}
            routeOrderMap={routeOrderMap}
            apiKey={mapsApiKey}
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
                  disabled={optimizingRoute || selectedRouteIds.length < 2}
                  onClick={() => void handleOptimizeRoute()}
                  className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#1C1A16] text-xs font-extrabold text-white disabled:opacity-50"
                >
                  <Route className="h-4 w-4" />
                  <span>
                    {optimizingRoute
                      ? "最適ルートを計算中..."
                      : `選択した${selectedRouteIds.length}件で最適ルートを作成`}
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

          {/* 検索結果からワンクリック登録できるリスト */}
          {candidates.length > 0 && (
            <section className="space-y-2.5">
              <h2 className="text-sm font-extrabold text-[#1C1A16]">
                検索結果（{candidates.length}件）— ワンクリックで見込み客登録
              </h2>
              {candidates.map((cand) => {
                const isRegistered = registeredPlaceIds.has(cand.placeId);
                return (
                  <div
                    key={cand.placeId}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-[#1C1A16]">{cand.name}</p>
                      <p className="truncate text-xs font-medium text-[#575249]">{cand.address}</p>
                    </div>
                    <button
                      type="button"
                      disabled={isRegistered || registeringPlaceId === cand.placeId}
                      onClick={() => void handleRegisterCandidate(cand)}
                      className={`flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-extrabold active:scale-[0.97] ${
                        isRegistered
                          ? "border-2 border-emerald-700 bg-emerald-50 text-emerald-950"
                          : "bg-[#D94E2B] text-white"
                      }`}
                    >
                      {isRegistered ? (
                        <>
                          <Check className="h-4 w-4" />
                          <span>登録済み</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          <span>{registeringPlaceId === cand.placeId ? "登録中" : "見込み登録"}</span>
                        </>
                      )}
                    </button>
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
                {store.ownerName && (
                  <span className="text-xs font-bold text-[#575249]">担当：{store.ownerName}</span>
                )}
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
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openEditor(store)}
                  className="min-h-[44px] rounded-xl border-2 border-[#1C1A16] bg-white text-xs font-extrabold text-[#1C1A16] active:scale-[0.97]"
                >
                  ステータス変更
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab("visit")}
                  className="min-h-[44px] rounded-xl bg-[#D94E2B] text-xs font-extrabold text-white active:scale-[0.97]"
                >
                  訪問を記録
                </button>
              </div>
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
              {savingNew ? "登録中..." : "登録する"}
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
            <div className="grid grid-cols-3 gap-2">
              {STATUS_LIST.map((st) => (
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
            {editStatus === "見送り" && (
              <select
                value={editDropReason}
                onChange={(e) => setEditDropReason(e.target.value)}
                className="min-h-[46px] w-full rounded-xl border-2 border-[#1C1A16] bg-white px-3 text-sm font-bold"
              >
                <option value="">見送り理由を選択（必須）</option>
                {DROP_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            )}
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
    </div>
  );
}
