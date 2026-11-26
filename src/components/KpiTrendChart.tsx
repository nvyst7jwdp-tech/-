import React, { useState } from "react";

export interface TrendPoint {
  label: string;
  kick: number;
  appointment: number;
  contract: number;
}

export function KpiTrendChart({
  points,
  granularity,
  onChangeGranularity,
}: {
  points: TrendPoint[];
  granularity: "weekly" | "monthly";
  onChangeGranularity: (g: "weekly" | "monthly") => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(
    points.length > 0 ? points.length - 1 : null
  );

  const width = 340;
  const height = 165;
  const padL = 28;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxVal = Math.max(
    4,
    ...points.flatMap((p) => [p.kick, p.appointment, p.contract])
  );
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal];

  const getX = (idx: number) =>
    points.length <= 1
      ? padL + plotW / 2
      : padL + (idx / (points.length - 1)) * plotW;

  const getY = (val: number) => padT + plotH - (val / maxVal) * plotH;

  const buildPath = (vals: number[]) =>
    vals
      .map((v, i) => `${i === 0 ? "M" : "L"}${getX(i).toFixed(1)},${getY(v).toFixed(1)}`)
      .join(" ");

  const activePoint =
    selectedIdx !== null && points[selectedIdx]
      ? points[selectedIdx]
      : points[points.length - 1] ?? null;

  return (
    <section
      aria-label="KPI推移グラフ"
      className="space-y-3 rounded-2xl border-2 border-[#D5CEC0] bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-extrabold text-[#1C1A16]">KPI推移（折れ線グラフ）</p>
        <div
          role="tablist"
          aria-label="グラフ期間切り替え"
          className="inline-flex rounded-xl border border-[#D5CEC0] bg-[#EFEAE0] p-0.5 text-[11px] font-extrabold"
        >
          <button
            type="button"
            role="tab"
            aria-selected={granularity === "weekly"}
            onClick={() => {
              onChangeGranularity("weekly");
              setSelectedIdx(null);
            }}
            className={`min-h-[28px] rounded-lg px-2.5 ${
              granularity === "weekly" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
            }`}
          >
            1週間おき
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={granularity === "monthly"}
            onClick={() => {
              onChangeGranularity("monthly");
              setSelectedIdx(null);
            }}
            className={`min-h-[28px] rounded-lg px-2.5 ${
              granularity === "monthly" ? "bg-[#1C1A16] text-white" : "text-[#474239]"
            }`}
          >
            1ヶ月おき
          </button>
        </div>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-extrabold">
        <span className="inline-flex items-center gap-1.5 text-[#1C1A16]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#D94E2B]" />
          <span>キック</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#1C1A16]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB]" />
          <span>アポ獲得</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#1C1A16]">
          <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" />
          <span>契約済み</span>
        </span>
      </div>

      {/* 選択中ポイントの数値表示 */}
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#F7F4ED] px-3 py-2 text-xs font-extrabold">
          <span className="text-[#1C1A16]">{activePoint.label}</span>
          <div className="flex items-center gap-2.5 tabular-nums">
            <span className="text-[#B93818]">キック {activePoint.kick}</span>
            <span className="text-[#1D4ED8]">アポ {activePoint.appointment}</span>
            <span className="text-[#047857]">契約 {activePoint.contract}</span>
          </div>
        </div>
      )}

      {points.length === 0 ? (
        <p className="py-6 text-center text-xs font-bold text-[#575249]">
          表示できる推移データがありません。
        </p>
      ) : (
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-44 w-full select-none"
            role="img"
            aria-label="キック・アポ獲得・契約済みの推移折れ線グラフ"
          >
            {/* 横グリッド線 */}
            {yTicks.map((t, i) => {
              const y = getY(t);
              return (
                <g key={i}>
                  <line
                    x1={padL}
                    x2={width - padR}
                    y1={y}
                    y2={y}
                    stroke="#EAE3D5"
                    strokeDasharray={t === 0 ? undefined : "3 3"}
                    strokeWidth="1"
                  />
                  <text
                    x={padL - 6}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="9"
                    fontWeight="700"
                    fill="#575249"
                  >
                    {t}
                  </text>
                </g>
              );
            })}

            {/* 折れ線 */}
            <path
              d={buildPath(points.map((p) => p.kick))}
              fill="none"
              stroke="#D94E2B"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={buildPath(points.map((p) => p.appointment))}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={buildPath(points.map((p) => p.contract))}
              fill="none"
              stroke="#059669"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* 各ポイントの丸＆タップ領域 */}
            {points.map((p, idx) => {
              const x = getX(idx);
              const isSelected =
                selectedIdx === idx ||
                (selectedIdx === null && idx === points.length - 1);
              return (
                <g
                  key={p.label}
                  className="cursor-pointer"
                  onClick={() => setSelectedIdx(idx)}
                >
                  {isSelected && (
                    <line
                      x1={x}
                      x2={x}
                      y1={padT}
                      y2={padT + plotH}
                      stroke="#D5CEC0"
                      strokeWidth="1.5"
                    />
                  )}
                  <circle
                    cx={x}
                    cy={getY(p.kick)}
                    r={isSelected ? 4.5 : 3.2}
                    fill="#D94E2B"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={x}
                    cy={getY(p.appointment)}
                    r={isSelected ? 4.5 : 3.2}
                    fill="#2563EB"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={x}
                    cy={getY(p.contract)}
                    r={isSelected ? 4.5 : 3.2}
                    fill="#059669"
                    stroke="#FFFFFF"
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={height - 8}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight={isSelected ? "800" : "700"}
                    fill={isSelected ? "#1C1A16" : "#575249"}
                  >
                    {p.label}
                  </text>
                  <rect
                    x={x - 18}
                    y={padT}
                    width={36}
                    height={plotH + 22}
                    fill="transparent"
                  />
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
