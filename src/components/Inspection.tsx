import { useEffect, useMemo, useRef, useState } from "react"
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  type Crack,
  type RiskLevel,
  RISK_LEVELS,
  RISK_LABEL,
  RISK_COLOR,
  riskLevel,
  percent,
  dateKey,
  inspectionStats,
} from "../features/inspection"
export function RiskBadge({ value }: { value: number | null }) {
  const level = riskLevel(value)
  return (
    <span className={`risk-badge risk-${level ?? "unknown"}`}>
      {percent(value)} <span>{level ? RISK_LABEL[level] : "정보 없음"}</span>
    </span>
  )
}
export function CrackDetail({
  crack,
  onClose,
  onMap,
}: {
  crack: Crack | null
  onClose: () => void
  onMap?: () => void
}) {
  return (
    <section className="panel crack-detail" aria-label="균열 상세 정보">
      <header className="panel-head">
        <h2>균열 상세 정보</h2>
        {crack && (
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="균열 상세 닫기"
          >
            ×
          </button>
        )}
      </header>
      {!crack ? (
        <div className="empty-state">
          <span className="empty-symbol">⌖</span>
          <b>균열을 선택하세요</b>
          <p>
            지도 마커나 탐지 로그를 선택하면
            <br />
            상세 정보를 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="panel-body">
          <div className="detail-title">
            <h3>{crack.id}</h3>
            <RiskBadge value={crack.risk} />
          </div>
          {crack.imageUrl ? (
            <img
              className="crack-photo"
              src={crack.imageUrl}
              alt={`${crack.id} 탐지 이미지`}
            />
          ) : (
            <div className="photo-placeholder crack-photo-placeholder" role="img" aria-label="균열 사진 등록 대기"><span aria-hidden="true">▧</span><b>균열 사진</b><small>탐지 사진이 등록되면 여기에 표시됩니다.</small></div>
          )}
          <dl className="facts">
            {[
              [
                "탐지 위치",
                `X ${crack.x.toFixed(2)} · Y ${crack.y.toFixed(2)} m`,
              ],
              [
                "균열 면적",
                crack.areaM2 === null ? "—" : `${crack.areaM2.toFixed(3)} m²`,
              ],
              [
                "탐지 시각",
                new Date(crack.detectedAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                }),
              ],
              ["현재 위험도", percent(crack.risk)],
              ["미래 위험도", percent(crack.predictedRisk ?? null)],
              ["탐지 로봇", crack.robotId],
              ["점검 상태", crack.status],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {onMap && (
            <button className="button button-primary full" onClick={onMap}>
              지도에서 위치 보기 →
            </button>
          )}
        </div>
      )}
    </section>
  )
}
export function Inspection({
  cracks,
  selected,
  onSelect,
  onMap,
}: {
  cracks: Crack[]
  selected: Crack | null
  onSelect: (c: Crack | null) => void
  onMap: () => void
}) {
  const [detailOpen, setDetailOpen] = useState(false)
  const detailDialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = detailDialog.current
    if (detailOpen) dialog?.showModal()
    else dialog?.close()
  }, [detailOpen])
  const [search, setSearch] = useState(""),
    [risk, setRisk] = useState<RiskLevel | "all">("all"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [sort, setSort] = useState("latest")
  const invalid = Boolean(start && end && start > end)
  const dated = useMemo(
    () =>
      invalid
        ? []
        : cracks.filter(
            (c) =>
              (!start || dateKey(c.detectedAt) >= start) &&
              (!end || dateKey(c.detectedAt) <= end),
          ),
    [cracks, start, end, invalid],
  )
  const stats = useMemo(
    () =>
      inspectionStats(
        dated,
        invalid ? undefined : start,
        invalid ? undefined : end,
      ),
    [dated, start, end, invalid],
  )
  const visible = dated
    .filter(
      (c) =>
        (risk === "all" || riskLevel(c.risk) === risk) &&
        `${c.id} ${c.robotId}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "risk"
        ? (b.risk ?? -1) - (a.risk ?? -1)
        : Date.parse(b.detectedAt) - Date.parse(a.detectedAt),
    )
  return (
    <>
      <div className="page-tools">
        <div className="date-filter">
          <label>
            시작일
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <span>—</span>
          <label>
            종료일
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button
            className="button"
            onClick={() => {
              setStart("")
              setEnd("")
              setSearch("")
              setRisk("all")
            }}
          >
            초기화
          </button>
        </div>
      </div>
      {invalid && (
        <p role="alert" className="control-error">
          종료일은 시작일 이후로 선택하세요.
        </p>
      )}
      <div className="stat-grid">
        {[
          ["전체 균열 수", `${stats.total}`, "선택 기간 내 탐지"],
          ["고위험 균열 수", `${stats.high}`, "High + Critical · 50% 이상"],
          [
            "평균 균열 면적",
            stats.averageArea === null
              ? "—"
              : `${stats.averageArea.toFixed(4)} m²`,
            "면적가 등록된 균열 기준",
          ],
        ].map(([title, value, note]) => (
          <section className="stat-card" key={title}>
            <span>{title}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </section>
        ))}
      </div>
      <div className="inspection-layout">
        <div className="inspection-main">
          <div className="charts-grid">
            <section className="panel">
              <header className="panel-head">
                <h2>위험도별 균열 비율</h2>
                <span className="muted">4단계 분류</span>
              </header>
              <div className="distribution">
                {stats.total - stats.unknown > 0 ? (
                  <div className="donut">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.distribution}
                          dataKey="count"
                          nameKey="name"
                          innerRadius="58%"
                          outerRadius="82%"
                          paddingAngle={3}
                          stroke="none"
                        >
                          {stats.distribution.map((d) => (
                            <Cell key={d.level} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="donut-total">
                      <strong>{stats.total}</strong>
                      <small>전체 균열</small>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    분석할 위험도 데이터가 없습니다.
                  </div>
                )}
                <div className="chart-legend">
                  {stats.distribution.map((d) => (
                    <div key={d.level}>
                      <i style={{ background: d.color }} />
                      <span>{d.name}</span>
                      <b>{d.count}건</b>
                      <small>
                        {stats.total
                          ? Math.round((d.count / stats.total) * 100)
                          : 0}
                        %
                      </small>
                    </div>
                  ))}
                  {stats.unknown > 0 && <p>정보 없음 {stats.unknown}건</p>}
                </div>
              </div>
            </section>
            <section className="panel">
              <header className="panel-head">
                <h2>균열 탐지 추이</h2>
                <span className="muted">일별 · KST</span>
              </header>
              <div className="trend-chart">
                {stats.trend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={stats.trend}
                      margin={{ top: 15, right: 20, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid
                        stroke="var(--border)"
                        vertical={false}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(v) => v.slice(5)}
                        tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--text-soft)", fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          borderColor: "var(--border)",
                          color: "var(--text)",
                        }}
                      />
                      <Line
                        dataKey="count"
                        name="탐지 수"
                        stroke="var(--blue)"
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state">
                    선택 기간의 탐지 기록이 없습니다.
                  </div>
                )}
              </div>
            </section>
            <section className="panel risk-comparison">
              <header className="panel-head"><h2>균열 위험도</h2></header>
              <div className="trend-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dated.map(c=>({id:c.id,current:c.risk===null?null:c.risk*100,future:c.predictedRisk==null?null:c.predictedRisk*100}))} margin={{top:12,right:14,left:-18,bottom:0}}>
                    <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 3"/>
                    <XAxis dataKey="id" tick={{fill:'var(--text-soft)',fontSize:9}} tickFormatter={v=>v.replace('CR-','')}/>
                    <YAxis domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{fill:'var(--text-soft)',fontSize:9}}/>
                    <Tooltip formatter={(v)=>typeof v==='number'?`${v.toFixed(1)}%`:'—'} contentStyle={{background:'var(--surface)',borderColor:'var(--border)',color:'var(--text)'}}/>
                    <Legend wrapperStyle={{fontSize:10}}/>
                    <Line dataKey="current" name="현재 위험도" stroke="#5b9bff" strokeWidth={2} dot={{r:3}}/>
                    <Line dataKey="future" name="미래 위험도" stroke="#b68aff" strokeWidth={2} strokeDasharray="5 3" dot={{r:3}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
          <section className="panel detection-log">
            <header className="panel-head">
              <h2>전체 균열 탐지 로그</h2>
              <span>
                {visible.length} / {dated.length}건
              </span>
            </header>
            <div className="log-tools">
              <input
                aria-label="균열 검색"
                placeholder="균열 ID · 로봇 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="위험도 필터"
                value={risk}
                onChange={(e) => setRisk(e.target.value as typeof risk)}
              >
                <option value="all">전체 위험도</option>
                {RISK_LEVELS.map((r) => (
                  <option key={r} value={r}>
                    {RISK_LABEL[r]}
                  </option>
                ))}
              </select>
              <select
                aria-label="로그 정렬"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="latest">최신순</option>
                <option value="risk">위험도순</option>
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "균열 ID",
                      "탐지 시각",
                      "위치 (m)",
                      "위험도",
                      "면적",
                      "상태",
                    ].map((t) => (
                      <th key={t}>{t}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr
                      key={c.id}
                      className={selected?.id === c.id ? "selected" : ""}
                    >
                      <td>
                        <button
                          className="text-button"
                          onClick={() => { onSelect(c); setDetailOpen(true) }}
                        >
                          {c.id} ↗
                        </button>
                      </td>
                      <td>
                        {dateKey(c.detectedAt)}
                        <small className="table-time">
                          {new Date(c.detectedAt).toLocaleTimeString("ko-KR", {
                            timeZone: "Asia/Seoul",
                            hour12: false,
                          })}
                        </small>
                      </td>
                      <td>
                        {c.x.toFixed(2)} / {c.y.toFixed(2)}
                      </td>
                      <td>
                        <RiskBadge value={c.risk} />
                      </td>
                      <td>{c.areaM2 ?? "—"} m²</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visible.length && (
                <div className="empty-state">
                  검색 조건에 맞는 균열이 없습니다.
                </div>
              )}
            </div>
            <p className="threshold-note">
              Low 0–25% 미만 · Medium 25–50% 미만 · High 50–75% 미만 · Critical
              75–100%
            </p>
          </section>
        </div>
        <dialog
          ref={detailDialog}
          className="crack-dialog"
          aria-label="선택한 균열 상세 정보"
          onCancel={() => setDetailOpen(false)}
          onClose={() => setDetailOpen(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDetailOpen(false)
          }}
        >
          <CrackDetail
            crack={selected}
            onClose={() => setDetailOpen(false)}
            onMap={() => { setDetailOpen(false); onMap() }}
          />
        </dialog>
      </div>
    </>
  )
}
