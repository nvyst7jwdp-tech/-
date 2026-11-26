/// <reference types="vite/client" />
import React, { useEffect, useRef, useState } from "react";
import { MapPin, Phone, Navigation, X, AlertCircle, UserPlus, Check, Trash2, Calendar } from "lucide-react";
import { SalesInsightPanel } from "./SalesInsightPanel";

export const STORE_STATUS_LIST = [
  "キック",
  "アポ獲得",
  "掲載のみ",
  "契約済み",
] as const;

export type CustomerStatus = (typeof STORE_STATUS_LIST)[number];

export interface CustomerPin {
  id: string;
  name: string;
  status: CustomerStatus;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  memo?: string;
  placeId?: string;
  isMine?: boolean;
  ownerName?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}

export interface PlaceCandidatePin {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phone?: string;
  rating?: number;
}

const STATUS_STYLE: Record<
  CustomerStatus,
  { pinColor: string; badgeClass: string; dotClass: string }
> = {
  契約済み: {
    pinColor: "#059669",
    badgeClass: "border-emerald-700 bg-emerald-100 text-emerald-950",
    dotClass: "bg-emerald-600",
  },
  アポ獲得: {
    pinColor: "#2563EB",
    badgeClass: "border-blue-700 bg-blue-100 text-blue-950",
    dotClass: "bg-blue-600",
  },
  掲載のみ: {
    pinColor: "#7C3AED",
    badgeClass: "border-purple-700 bg-purple-100 text-purple-950",
    dotClass: "bg-purple-600",
  },
  キック: {
    pinColor: "#6B7280",
    badgeClass: "border-stone-500 bg-stone-200 text-stone-900",
    dotClass: "bg-stone-500",
  },
};

export type GoogleMapsApi = {
  maps: {
    Map: new (
      el: HTMLElement,
      opts: {
        center: { lat: number; lng: number };
        zoom: number;
        mapTypeControl?: boolean;
        streetViewControl?: boolean;
        fullscreenControl?: boolean;
      }
    ) => {
      setCenter: (pos: { lat: number; lng: number }) => void;
      setZoom: (zoom: number) => void;
      fitBounds: (bounds: unknown) => void;
    };
    Marker: new (opts: {
      position: { lat: number; lng: number };
      map: unknown;
      title?: string;
      icon?: unknown;
    }) => {
      setMap: (map: unknown) => void;
      setIcon: (icon: unknown) => void;
      addListener: (event: string, handler: () => void) => void;
    };
    LatLngBounds: new () => {
      extend: (pos: { lat: number; lng: number }) => void;
    };
    Point: new (x: number, y: number) => unknown;
    SymbolPath: {
      CIRCLE: unknown;
    };
    event: {
      clearInstanceListeners: (instance: unknown) => void;
    };
    places?: {
      PlacesService: new (attrContainer: HTMLElement) => {
        nearbySearch: (
          req: {
            location: { lat: number; lng: number };
            radius: number;
            type?: string;
            keyword?: string;
          },
          cb: (results: unknown[] | null, status: string) => void
        ) => void;
        textSearch: (
          req: { query: string },
          cb: (results: unknown[] | null, status: string) => void
        ) => void;
        getDetails: (
          req: { placeId: string; fields: string[] },
          cb: (result: unknown | null, status: string) => void
        ) => void;
      };
    };
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

let googleMapsLoader: Promise<GoogleMapsApi> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<GoogleMapsApi> {
  if (typeof window !== "undefined" && window.google?.maps?.places) {
    return Promise.resolve(window.google);
  }
  if (googleMapsLoader) return googleMapsLoader;

  googleMapsLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&language=ja&region=JP`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        googleMapsLoader = null;
        reject(new Error("Google Maps API の読み込みに失敗しました。"));
      }
    };
    script.onerror = () => {
      googleMapsLoader = null;
      reject(new Error("Google Maps スクリプトを取得できませんでした。"));
    };
    document.head.appendChild(script);
  });

  return googleMapsLoader;
}

function createPinIcon(
  google: GoogleMapsApi,
  color: string,
  selected: boolean,
  isMine = true
) {
  return {
    path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z",
    fillColor: color,
    fillOpacity: isMine ? 1 : 0.45,
    strokeColor: selected ? "#1C1A16" : "#FFFFFF",
    strokeOpacity: isMine || selected ? 1 : 0.75,
    strokeWeight: selected ? (isMine ? 2.5 : 2.2) : isMine ? 1.75 : 1.2,
    scale: selected ? (isMine ? 1.85 : 1.45) : isMine ? 1.5 : 1.1,
    anchor: new google.maps.Point(12, 22),
  };
}

function createCandidateIcon(google: GoogleMapsApi, selected: boolean) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: "#EA580C",
    fillOpacity: 0.95,
    strokeColor: selected ? "#1C1A16" : "#FFFFFF",
    strokeWeight: selected ? 3 : 2,
    scale: selected ? 11 : 8.5,
  };
}

export function CustomerMap({
  customers,
  candidates = [],
  registeredPlaceIds,
  onRegisterCandidate,
  registeringPlaceId,
  focusTarget,
  onRequestDelete,
  canDeleteCustomer,
  showLegend = true,
  apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "",
  geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY ?? "",
  salesRepName = "",
  defaultCenter = { lat: 34.6937, lng: 135.5023 },
}: {
  customers: CustomerPin[];
  candidates?: PlaceCandidatePin[];
  registeredPlaceIds?: Set<string>;
  onRegisterCandidate?: (
    candidate: PlaceCandidatePin,
    status: CustomerStatus,
    appointment?: { date: string; time: string }
  ) => void;
  registeringPlaceId?: string | null;
  focusTarget?: { id: string; lat: number; lng: number; nonce: number } | null;
  onRequestDelete?: (customer: CustomerPin) => void;
  canDeleteCustomer?: (customer: CustomerPin) => boolean;
  showLegend?: boolean;
  apiKey?: string;
  geminiApiKey?: string;
  salesRepName?: string;
  defaultCenter?: { lat: number; lng: number };
}) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<InstanceType<GoogleMapsApi["maps"]["Map"]> | null>(null);
  const markersRef = useRef<
    Map<
      string,
      {
        kind: "customer" | "candidate";
        marker: InstanceType<GoogleMapsApi["maps"]["Marker"]>;
        status?: CustomerStatus;
        isMine?: boolean;
      }
    >
  >(new Map());

  const [selectedKey, setSelectedKey] = useState<{
    kind: "customer" | "candidate";
    id: string;
  } | null>(null);
  const [mapError, setMapError] = useState("");
  const [mapReady, setMapReady] = useState(false);
  const [candidateStatus, setCandidateStatus] = useState<CustomerStatus>("キック");
  const [candApptDate, setCandApptDate] = useState("");
  const [candApptTime, setCandApptTime] = useState("");
  const [candError, setCandError] = useState("");

  const selectedCustomer =
    selectedKey?.kind === "customer"
      ? customers.find((c) => c.id === selectedKey.id) ?? null
      : null;
  const selectedCandidate =
    selectedKey?.kind === "candidate"
      ? candidates.find((c) => c.placeId === selectedKey.id) ?? null
      : null;

  useEffect(() => {
    if (!apiKey.trim()) {
      setMapError("Google Maps APIキー（VITE_GOOGLE_MAPS_API_KEY）が未設定です。");
      return;
    }
    let cancelled = false;
    setMapError("");

    loadGoogleMapsScript(apiKey.trim())
      .then((google) => {
        if (cancelled || !mapContainerRef.current) return;
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new google.maps.Map(mapContainerRef.current, {
            center: defaultCenter,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
        }
        setMapReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setMapError(err instanceof Error ? err.message : "地図の初期化に失敗しました。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, defaultCenter]);

  useEffect(() => {
    const google = window.google;
    const map = mapInstanceRef.current;
    if (!mapReady || !google?.maps || !map) return;

    markersRef.current.forEach(({ marker }) => {
      google.maps.event.clearInstanceListeners(marker);
      marker.setMap(null);
    });
    markersRef.current.clear();

    const totalCount = customers.length + candidates.length;
    if (totalCount === 0) return;

    const bounds = new google.maps.LatLngBounds();

    customers.forEach((customer) => {
      const style = STATUS_STYLE[customer.status] ?? STATUS_STYLE["キック"];
      const isSelected = selectedKey?.kind === "customer" && selectedKey.id === customer.id;
      const isMine = customer.isMine !== false;
      const marker = new google.maps.Marker({
        position: { lat: customer.lat, lng: customer.lng },
        map,
        title: `${customer.name}（${customer.status}）`,
        icon: createPinIcon(google, style.pinColor, isSelected, isMine),
      });
      marker.addListener("click", () => {
        setSelectedKey({ kind: "customer", id: customer.id });
      });
      markersRef.current.set(`customer:${customer.id}`, {
        kind: "customer",
        marker,
        status: customer.status,
        isMine,
      });
      bounds.extend({ lat: customer.lat, lng: customer.lng });
    });

    candidates.forEach((cand) => {
      if (registeredPlaceIds?.has(cand.placeId)) return;
      const isSelected = selectedKey?.kind === "candidate" && selectedKey.id === cand.placeId;
      const marker = new google.maps.Marker({
        position: { lat: cand.lat, lng: cand.lng },
        map,
        title: `${cand.name}（新規候補）`,
        icon: createCandidateIcon(google, isSelected),
      });
      marker.addListener("click", () => {
        setCandError("");
        setSelectedKey({ kind: "candidate", id: cand.placeId });
      });
      markersRef.current.set(`candidate:${cand.placeId}`, {
        kind: "candidate",
        marker,
      });
      bounds.extend({ lat: cand.lat, lng: cand.lng });
    });

    if (totalCount === 1) {
      const only = customers[0] ?? candidates[0];
      map.setCenter({ lat: only.lat, lng: only.lng });
    } else {
      map.fitBounds(bounds);
    }
  }, [customers, candidates, registeredPlaceIds, mapReady]);

  useEffect(() => {
    const google = window.google;
    if (!mapReady || !google?.maps) return;
    markersRef.current.forEach((entry, key) => {
      const isSelected =
        selectedKey !== null && `${selectedKey.kind}:${selectedKey.id}` === key;
      if (entry.kind === "customer") {
        const style = STATUS_STYLE[entry.status ?? "キック"];
        entry.marker.setIcon(
          createPinIcon(google, style.pinColor, isSelected, entry.isMine !== false)
        );
      } else {
        entry.marker.setIcon(createCandidateIcon(google, isSelected));
      }
    });
  }, [selectedKey, mapReady]);

  useEffect(() => {
    if (!focusTarget) return;
    setSelectedKey({ kind: "customer", id: focusTarget.id });
    const map = mapInstanceRef.current;
    if (mapReady && map) {
      map.setCenter({ lat: focusTarget.lat, lng: focusTarget.lng });
      map.setZoom(17);
    }
  }, [focusTarget, mapReady]);

  return (
    <div className="space-y-3">
      {showLegend && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-[#D5CEC0] bg-white px-3.5 py-2.5 text-xs font-extrabold">
          {STORE_STATUS_LIST.map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5 text-[#1C1A16]">
              <span className={`h-3 w-3 rounded-full ${STATUS_STYLE[status].dotClass}`} />
              <span>{status}</span>
            </span>
          ))}
          {candidates.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[#9A3412]">
              <span className="h-3 w-3 rounded-full bg-orange-600" />
              <span>店舗候補</span>
            </span>
          )}
          <span className="ml-auto text-[#575249]">
            {customers.length > 0 ? `${customers.length}件` : `${candidates.length}件`}
          </span>
        </div>
      )}

      <div className="relative h-80 w-full overflow-hidden rounded-2xl border-2 border-[#D5CEC0] bg-[#EFEAE0]">
        {mapError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-5 text-center">
            <AlertCircle className="h-6 w-6 text-[#D94E2B]" />
            <p className="text-xs font-extrabold text-[#1C1A16]">{mapError}</p>
          </div>
        ) : (
          <div ref={mapContainerRef} className="h-full w-full" aria-label="マップ" />
        )}
      </div>

      {selectedCustomer && (
        <article className="gurupo-toast-pop rounded-2xl border-2 border-[#1C1A16] bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-block rounded-md border px-2 py-0.5 text-xs font-extrabold ${
                    STATUS_STYLE[selectedCustomer.status].badgeClass
                  }`}
                >
                  {selectedCustomer.status}
                </span>
                {selectedCustomer.ownerName && (
                  <span className="text-xs font-bold text-[#575249]">
                    登録者：{selectedCustomer.ownerName}
                  </span>
                )}
              </div>
              <h3 className="mt-1.5 text-base font-extrabold text-[#1C1A16]">
                {selectedCustomer.name}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {onRequestDelete && (!canDeleteCustomer || canDeleteCustomer(selectedCustomer)) && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(selectedCustomer)}
                  aria-label="顧客を削除"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 active:scale-[0.97]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedKey(null)}
                aria-label="詳細を閉じる"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0] text-[#1C1A16]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {selectedCustomer.status === "アポ獲得" &&
            (selectedCustomer.appointmentDate || selectedCustomer.appointmentTime) && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-extrabold text-blue-900">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>
                  アポ日時：{selectedCustomer.appointmentDate} {selectedCustomer.appointmentTime}
                </span>
              </p>
            )}

          {selectedCustomer.address && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#474239]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D94E2B]" />
              <span>{selectedCustomer.address}</span>
            </p>
          )}

          {selectedCustomer.memo && (
            <p className="mt-2 rounded-xl bg-[#F7F4ED] px-3 py-2 text-xs font-medium text-[#3D3932]">
              {selectedCustomer.memo}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedCustomer.lat},${selectedCustomer.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] px-3 text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97]"
            >
              <Navigation className="h-4 w-4" />
              <span>経路を開く</span>
            </a>
            {selectedCustomer.phone ? (
              <a
                href={`tel:${selectedCustomer.phone}`}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border-2 border-[#1C1A16] bg-white px-3 text-xs font-extrabold text-[#1C1A16] transition-transform duration-100 active:scale-[0.97]"
              >
                <Phone className="h-4 w-4" />
                <span>電話する</span>
              </a>
            ) : (
              <span className="flex min-h-[44px] items-center justify-center rounded-xl border-2 border-[#D5CEC0] bg-[#F7F4ED] text-xs font-bold text-[#575249]">
                電話番号なし
              </span>
            )}
          </div>
        </article>
      )}

      {selectedCustomer && (
        <SalesInsightPanel
          key={`cust-${selectedCustomer.id}`}
          target={{
            id: selectedCustomer.id,
            name: selectedCustomer.name,
            address: selectedCustomer.address ?? "",
            placeId: selectedCustomer.placeId,
          }}
          mapsApiKey={apiKey}
          geminiApiKey={geminiApiKey}
          salesRepName={salesRepName}
        />
      )}

      {selectedCandidate && (
        <article className="gurupo-toast-pop rounded-2xl border-2 border-[#D94E2B] bg-[#FFF8F6] p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="inline-block rounded-md bg-orange-600 px-2 py-0.5 text-xs font-extrabold text-white">
                店舗（未登録）
              </span>
              <h3 className="mt-1.5 text-base font-extrabold text-[#1C1A16]">
                {selectedCandidate.name}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedKey(null)}
              aria-label="閉じる"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EFEAE0] text-[#1C1A16]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-[#474239]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#D94E2B]" />
            <span>{selectedCandidate.address}</span>
          </p>
          {onRegisterCandidate && (
            <div className="mt-3 space-y-2">
              {!registeredPlaceIds?.has(selectedCandidate.placeId) && (
                <>
                  <div>
                    <p className="mb-1 text-[11px] font-extrabold text-[#575249]">
                      登録ステータスを選択
                    </p>
                    <div className="grid grid-cols-4 gap-1.5">
                      {STORE_STATUS_LIST.map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            setCandidateStatus(st);
                            setCandError("");
                          }}
                          className={`min-h-[34px] rounded-lg border-2 px-1 text-[11px] font-extrabold transition-transform duration-100 active:scale-[0.97] ${
                            candidateStatus === st
                              ? "border-[#1C1A16] bg-[#1C1A16] text-white"
                              : "border-[#D5CEC0] bg-white text-[#3D3932]"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                  {candidateStatus === "アポ獲得" && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-extrabold text-blue-900">
                        アポ日時（必須）
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <input
                          type="date"
                          aria-label="アポ日付"
                          value={candApptDate}
                          onChange={(e) => {
                            setCandApptDate(e.target.value);
                            setCandError("");
                          }}
                          className="min-h-[38px] rounded-lg border-2 border-[#1C1A16] bg-white px-2 text-xs font-bold"
                        />
                        <input
                          type="time"
                          aria-label="アポ時間"
                          value={candApptTime}
                          onChange={(e) => {
                            setCandApptTime(e.target.value);
                            setCandError("");
                          }}
                          className="min-h-[38px] rounded-lg border-2 border-[#1C1A16] bg-white px-2 text-xs font-bold"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              {candError && (
                <p className="text-xs font-extrabold text-red-900">{candError}</p>
              )}
              <button
                type="button"
                disabled={
                  registeringPlaceId === selectedCandidate.placeId ||
                  registeredPlaceIds?.has(selectedCandidate.placeId)
                }
                onClick={() => {
                  if (candidateStatus === "アポ獲得" && (!candApptDate || !candApptTime)) {
                    setCandError("「アポ獲得」の場合は日付と時間の両方を入力してください。");
                    return;
                  }
                  onRegisterCandidate(
                    selectedCandidate,
                    candidateStatus,
                    candidateStatus === "アポ獲得"
                      ? { date: candApptDate, time: candApptTime }
                      : undefined
                  );
                }}
                className="flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#D94E2B] px-3 text-xs font-extrabold text-white transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
              >
                {registeredPlaceIds?.has(selectedCandidate.placeId) ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>登録済み（顧客へ移動）</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>
                      {registeringPlaceId === selectedCandidate.placeId
                        ? "登録中..."
                        : `「${candidateStatus}」で顧客登録`}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </article>
      )}

      {selectedCandidate && (
        <SalesInsightPanel
          key={`cand-${selectedCandidate.placeId}`}
          target={{
            id: selectedCandidate.placeId,
            name: selectedCandidate.name,
            address: selectedCandidate.address,
            placeId: selectedCandidate.placeId,
          }}
          mapsApiKey={apiKey}
          geminiApiKey={geminiApiKey}
          salesRepName={salesRepName}
        />
      )}

      {!selectedCustomer && !selectedCandidate && (
        <p className="rounded-2xl border-2 border-[#D5CEC0] bg-white px-4 py-3 text-center text-xs font-bold text-[#575249]">
          地図上のピンをタップすると、詳細と営業情報が表示されます。
        </p>
      )}
    </div>
  );
}
