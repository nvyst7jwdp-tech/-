export function formatRateWithCount(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  const pct = Math.round((numerator / denominator) * 100);
  return `${pct}% (${numerator}/${denominator})`;
}

export function calculateKpiRates(counts: {
  visits: number;
  appointments: number;
  contracts: number;
}) {
  return {
    appointmentRateText: formatRateWithCount(counts.appointments, counts.visits),
    contractRateText: formatRateWithCount(counts.contracts, counts.appointments),
  };
}
