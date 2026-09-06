export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const
export type RiskLevel = typeof RISK_LEVELS[number]
export const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
}
export const RISK_COLOR: Record<RiskLevel, string> = {
  low: "#16a77b",
  medium: "#d49b17",
  high: "#ec743c",
  critical: "#e34865",
}
export function riskLevel(value: number | null): RiskLevel | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 1)
    return null
  return value < 0.25
    ? "low"
    : value < 0.5
      ? "medium"
      : value < 0.75
        ? "high"
        : "critical"
}
export function percent(value: number | null): string {
  return riskLevel(value) === null
    ? "—"
    : `${Math.floor(value! * 10000) / 100}%`
}
export interface Crack {
  id: string
  type: string
  x: number
  y: number
  predictedRisk?: number | null
  risk: number | null
  areaM2: number | null
  detectedAt: string
  robotId: string
  status: string
  imageUrl?: string
  mapVersion: string | null
}
// Fixtures only: no live crack API is implemented yet.
export const DEMO_CRACKS: Crack[] = [
  {
    id: "CR-001",
    type: "선형 균열",
    x: 0.2,
    y: 1.03,
    risk: 0.68, predictedRisk: 0.82,
    areaM2: 0.032,
    detectedAt: "2026-09-02T09:14:22+09:00",
    robotId: "MINI-01",
    status: "확인 대기",
    mapVersion: null,
  },
  {
    id: "CR-002",
    type: "면상 균열",
    x: 1.45,
    y: 0.87,
    risk: 0.92, predictedRisk: 0.97,
    areaM2: 0.068,
    detectedAt: "2026-09-06T09:18:05+09:00",
    robotId: "MINI-01",
    status: "정밀 점검 필요",
    mapVersion: null,
  },
  {
    id: "CR-003",
    type: "선형 균열",
    x: -0.8,
    y: 1.55,
    risk: 0.41, predictedRisk: 0.54,
    areaM2: 0.014,
    detectedAt: "2026-09-04T09:09:41+09:00",
    robotId: "MINI-01",
    status: "관찰 필요",
    mapVersion: null,
  },
  {
    id: "CR-004",
    type: "선형 균열",
    x: 1.1,
    y: 2.1,
    risk: 0.18, predictedRisk: 0.24,
    areaM2: 0.006,
    detectedAt: "2026-09-05T09:22:17+09:00",
    robotId: "MINI-01",
    status: "확인 완료",
    mapVersion: null,
  },
  {
    id: "CR-005",
    type: "면상 균열",
    x: -0.85,
    y: 0.2,
    risk: 0.55, predictedRisk: 0.69,
    areaM2: 0.021,
    detectedAt: "2026-09-06T09:06:33+09:00",
    robotId: "MINI-01",
    status: "확인 대기",
    mapVersion: null,
  },
]
export function dateKey(timestamp: string): string {
  const d = new Date(timestamp)
  if (!Number.isFinite(d.getTime())) return ""
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d)
}
export function inspectionStats(cracks: Crack[], start?: string, end?: string) {
  const distribution = RISK_LEVELS.map((level) => ({
    name: RISK_LABEL[level],
    level,
    count: cracks.filter((c) => riskLevel(c.risk) === level).length,
    color: RISK_COLOR[level],
  }))
  const areas = cracks.flatMap((c) =>
    c.areaM2 !== null && Number.isFinite(c.areaM2) && c.areaM2 >= 0
      ? [c.areaM2]
      : [],
  )
  const counts = new Map<string, number>()
  cracks.forEach((c) => {
    const day = dateKey(c.detectedAt)
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1)
  })
  const days = [...counts.keys()].sort(),
    first = start || days[0],
    last = end || days[days.length - 1]
  if (first && last)
    for (
      let day = new Date(`${first}T00:00:00Z`);
      day.toISOString().slice(0, 10) <= last;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const key = day.toISOString().slice(0, 10)
      if (!counts.has(key)) counts.set(key, 0)
      if (counts.size > 3660) break
    }
  return {
    total: cracks.length,
    high: cracks.filter((c) =>
      ["high", "critical"].includes(riskLevel(c.risk) ?? ""),
    ).length,
    averageArea: areas.length
      ? areas.reduce((a, b) => a + b, 0) / areas.length
      : null,
    distribution,
    unknown: cracks.filter((c) => riskLevel(c.risk) === null).length,
    trend: [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
  }
}
