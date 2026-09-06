import { useState } from "react"
import {
  mapImageUrl,
  projectPoseToMap,
  type MapState,
  type RobotState,
} from "../features/robot-map"
import { validPose, destination } from "../features/robot-telemetry"
import {
  type Crack,
  RISK_LEVELS,
  RISK_LABEL,
  RISK_COLOR,
  riskLevel,
  percent,
} from "../features/inspection"
import { RiskBadge } from "./Inspection"
export function RobotMap({
  map,
  robots,
  cracks = [],
  selected,
  onSelect,
  loading,
  error,
  reload,
  position,
}: {
  position?: { x: number; y: number } | null
  map: MapState | null
  robots: RobotState[]
  cracks?: Crack[]
  selected?: Crack | null
  onSelect?: (c: Crack) => void
  loading: boolean
  error: string | null
  reload: () => void
}) {
  const [zoom, setZoom] = useState(1),
    [failed, setFailed] = useState(false)
  const markers = map
    ? robots.flatMap((r) => {
        const p = validPose(r, map)
        if (!p) return []
        const point = projectPoseToMap(map, p)
        return point.inside ? [{ r, point }] : []
      })
    : []
  const goals = map
    ? robots.flatMap((r) => {
        const p = destination(r, map)
        if (!p) return []
        const point = projectPoseToMap(map, p)
        return point.inside ? [{ r, point }] : []
      })
    : []
  const crackPoints = map
    ? cracks.flatMap((c) => {
        if (c.mapVersion !== null && c.mapVersion !== map.version) return []
        const point = projectPoseToMap(map, {
          x: c.x,
          y: c.y,
          yaw: 0,
          frame_id: map.frame_id,
          map_version: map.version,
          timestamp: "",
        })
        return point.inside ? [{ c, point }] : []
      })
    : []
  return (
    <section className="panel map-panel">
      <header className="panel-head">
        <h2>공간 지도</h2>
        <div className="panel-actions">
          <span className="source-chip">{map ? "저장 지도" : "지도 대기"}</span>
          <button
            className="button"
            onClick={() => {
              setFailed(false)
              reload()
            }}
          >
            새로고침
          </button>
        </div>
      </header>
      <div className="map-viewport">
        <div className="map-scroll">
          {map ? (
            <div className="map-stage" style={{ width: `${zoom * 100}%`, maxWidth: `calc((100cqh - 36px) * ${map.width / map.height} * ${zoom})` }}>
              <div
                className="map-canvas"
                style={{ aspectRatio: `${map.width}/${map.height}` }}
              >
                <img
                  key={map.version}
                  src={map.version === "demo" ? map.image_url : mapImageUrl(map)}
                  alt="현재 운영 SLAM 지도"
                  onLoad={() => setFailed(false)}
                  onError={() => setFailed(true)}
                />
                {goals.map(({ r, point }) => (
                  <div
                    className={`goal-marker ${
                      r.robot_id === "MINI-01" ? "mini" : ""
                    }`}
                    key={r.robot_id}
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                    title={`${r.robot_id} 목적지`}
                  >
                    ⚑<span>{r.robot_id} 목적지</span>
                  </div>
                ))}
                {crackPoints.map(({ c, point }) => (
                  <button
                    key={c.id}
                    className={`crack-pin ${
                      selected?.id === c.id ? "chosen" : ""
                    }`}
                    aria-label={`${c.id} 위험도 ${percent(c.risk)} 상세 보기`}
                    aria-pressed={selected?.id === c.id}
                    style={{
                      left: `${point.left}%`,
                      top: `${point.top}%`,
                      background: RISK_COLOR[riskLevel(c.risk) ?? "low"],
                    }}
                    onClick={() => onSelect?.(c)}
                  >
                    <span aria-hidden="true">!</span>
                    <span
                      className={`map-tooltip ${
                        point.left > 65 ? "align-left" : ""
                      } ${point.top < 30 ? "below" : ""}`}
                      role="tooltip"
                    >
                      <b>
                        {c.id}
                      </b>
                      <RiskBadge value={c.risk} />
                      <span>
                        면적 {c.areaM2 ?? "—"} m² · {c.robotId}
                      </span>
                      <small>클릭하여 상세 보기</small>
                    </span>
                  </button>
                ))}
                {markers.map(({ r, point }) => (
                  <div
                    key={r.robot_id}
                    className={`robot-pin ${
                      r.robot_id === "MINI-01" ? "mini" : ""
                    }`}
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                    title={`${r.robot_id} 현재 위치`}
                  >
                    <b style={{ transform: `rotate(${point.rotation}deg)` }}>
                      ↑
                    </b>
                    <span>{r.robot_id}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state map-empty">
              <span className="empty-symbol">⌖</span>
              <b>{loading ? "지도를 불러오는 중" : "저장된 지도가 없습니다"}</b>
              <p>{error ?? "로봇에서 지도를 업로드하면 여기에 표시됩니다."}</p>
            </div>
          )}
        </div>
        <div className="map-zoom">
          <button
            aria-label="지도 확대"
            disabled={zoom >= 2.5}
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
          >
            +
          </button>
          <button aria-label="지도 배율 초기화" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="지도 축소"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            −
          </button>
        </div>
      </div>
      {position !== undefined && (
        <div className="map-position">
          <span>터틀봇 현재 위치</span>
          <b>X {position ? position.x.toFixed(2) : "—"} m</b>
          <b>Y {position ? position.y.toFixed(2) : "—"} m</b>
        </div>
      )}
      {failed && (
        <p role="alert" className="control-error">
          지도 이미지를 불러오지 못했습니다. 새로고침해 주세요.
        </p>
      )}
      <div className="map-legend">
        <span>
          <i className="legend-robot" />
          터틀봇
        </span>
        <span>
          <i className="legend-mini" />
          미니로봇
        </span>
        <span>⚑ 목적지</span>
        {RISK_LEVELS.map((l) => (
          <span key={l}>
            <i style={{ background: RISK_COLOR[l] }} />
            {RISK_LABEL[l]}
          </span>
        ))}
      </div>
      <div className="map-caption">
        <span>
          {markers.length
            ? `위치 확인 ${markers.length}대`
            : "로봇 위치 수신 대기 · AMCL 및 지도 버전 확인 필요"}
        </span>
        <span>
          {goals.length ? `목적지 ${goals.length}개` : "목적지 미수신"}
        </span>
        {cracks.length > 0 && (
          <span>
            균열 {crackPoints.length}/{cracks.length}개 표시
          </span>
        )}
      </div>
    </section>
  )
}
