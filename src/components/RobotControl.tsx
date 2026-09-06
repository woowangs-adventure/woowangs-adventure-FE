import { useEffect, useRef, useState } from "react"
import { useRobotControl, velocityFromKeys } from "../features/robot-control"
import { controlKey } from "../features/robot-keyboard"
import { type RobotState } from "../features/robot-map"
import { navigationProgress } from "../features/robot-telemetry"
import {
  recordedVideoUrl,
  useRobotCamera,
  cameraRobotId,
} from "../features/robot-camera"
export function RobotSummary({ robot }: { robot: RobotState }) {
  const battery = robot.status.battery_percent
  return (
    <section className="panel robot-summary">
      <header className="panel-head">
        <h2>{robot.robot_id === "TB3-01" ? "TurtleBot3" : "미니로봇"}</h2>
        <span className={`online-badge ${robot.online ? "online" : ""}`}>
          ● {robot.online ? "연결됨" : "오프라인"}
        </span>
      </header>
      <div className="panel-body">
        <span className="muted">{robot.robot_id}</span>
        <dl className="facts">
          <div>
            <dt>위치 추정</dt>
            <dd>
              {!robot.online
                ? "오프라인"
                : robot.status.localization_available
                  ? "위치 수신 중"
                  : "위치 확인 대기"}
            </dd>
          </div>
          <div>
            <dt>배터리</dt>
            <dd>
              {robot.online &&
              typeof battery === "number" &&
              battery >= 0 &&
              battery <= 100
                ? `${battery}%`
                : "미수신"}
            </dd>
          </div>
          <div>
            <dt>마지막 연결</dt>
            <dd>
              {robot.last_seen
                ? new Date(robot.last_seen).toLocaleTimeString("ko-KR")
                : "—"}
            </dd>
          </div>
          {robot.robot_id === "MINI-01" && (
            <div>
              <dt>전조등</dt>
              <dd>
                {robot.online && typeof robot.status.headlight_on === "boolean"
                  ? robot.status.headlight_on
                    ? "켜짐"
                    : "꺼짐"
                  : "미수신"}
              </dd>
            </div>
          )}
        </dl>
      </div>
    </section>
  )
}
export function DriveControl({
  robot,
  active,
  onActivate,
  emergency,
}: {
  robot: RobotState
  active: boolean
  onActivate: () => void
  emergency: boolean
}) {
  const [keys, setKeys] = useState<Set<string>>(new Set()),
    [speed, setSpeed] = useState(50)
  const ctl = useRobotControl({
    robotId: robot.robot_id,
    enabled: active && !emergency,
    robotOnline: robot.online && robot.status.control_available !== false,
    speedPercent: speed,
    activeKeys: keys,
  })
  const stop = () => {
    setKeys(new Set())
    ctl.stop()
  }
  useEffect(() => {
    if (!active || emergency) setKeys(new Set())
  }, [active, emergency])
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        !active ||
        emergency ||
        ctl.state !== "ready" ||
        (e.target as HTMLElement)?.closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return
      const k = controlKey(e)
      if (k === null) return
      e.preventDefault()
      if (k === " ") {
        ctl.stop()
        setKeys(new Set([" "]))
      } else setKeys((s) => new Set(s).add(k))
    }
    const up = (e: KeyboardEvent) => {
      const k = controlKey(e)
      if (k !== null)
        setKeys((s) => {
          const n = new Set(s)
          n.delete(k)
          return n
        })
    }
    const clear = () => setKeys(new Set())
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", clear)
    document.addEventListener("visibilitychange", clear)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", clear)
      document.removeEventListener("visibilitychange", clear)
    }
  }, [active, emergency, ctl.state, ctl.stop])
  const velocity = velocityFromKeys(keys, speed)
  const command = velocity.stop
    ? "즉시 정지"
    : velocity.linear > 0
      ? "전진"
      : velocity.linear < 0
        ? "후진"
        : velocity.angular > 0
          ? "좌회전"
          : velocity.angular < 0
            ? "우회전"
            : "정지"
  const ready = active && ctl.state === "ready" && !emergency
  return (
    <>
    <section className={`panel drive-panel ${ready ? "is-driving" : ""}`}>
      <header className="panel-head">
        <h2>{robot.robot_id === "TB3-01" ? "터틀봇" : "미니로봇"} 수동 조작</h2>
        <button
          className={`button ${ready ? "button-danger" : "button-primary"}`}
          disabled={
            !active &&
            (emergency ||
              !robot.online ||
              robot.status.control_available === false ||
              !ctl.serverEnabled)
          }
          onClick={() => {
            stop()
            onActivate()
          }}
        >
          {active ? "조종 해제" : "조종 활성화"}
        </button>
      </header>
      <div className="panel-body">
        <p className="control-hint">
          {ready
            ? "조종권 획득 · 키보드 또는 버튼을 길게 눌러 이동"
            : !robot.online
              ? "로봇이 연결되면 조종할 수 있습니다."
              : !ctl.serverEnabled
                ? "백엔드 원격 조작이 비활성화되어 있습니다."
                : active
                  ? "조종권 연결 확인 중"
                  : "조종 활성화 후 W/A/S/D · 방향키로 이동하세요."}
        </p>
        <div className="drive-row">
          <div className="direction-pad">
            {[
              ["w", "↑", "전진"],
              ["a", "←", "좌회전"],
              [" ", "■", "즉시 정지"],
              ["d", "→", "우회전"],
              ["s", "↓", "후진"],
            ].map(([key, label, name]) => (
              <button
                key={key}
                aria-label={name}
                disabled={!ready}
                className={`key-${key === " " ? "stop" : key} ${
                  keys.has(key) ||
                  keys.has(
                    {
                      w: "arrowup",
                      a: "arrowleft",
                      s: "arrowdown",
                      d: "arrowright",
                    }[key] ?? "",
                  )
                    ? "pressed"
                    : ""
                }`}
                onPointerDown={(e) => {
                  e.preventDefault()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  if (key === " ") stop()
                  else setKeys(new Set([key]))
                }}
                onPointerUp={stop}
                onPointerCancel={stop}
                onLostPointerCapture={stop}
                onClick={() => {
                  if (key === " ") stop()
                }}
              >
                {label}
                <small>{key === " " ? "SPACE" : key.toUpperCase()}</small>
              </button>
            ))}
          </div>
          <div className="command-readout">
            <span>현재 명령</span>
            <strong>{ready ? command : "대기"}</strong>
            <small>
              ACK{" "}
              {active && ctl.latencyMs !== null ? `${ctl.latencyMs} ms` : "—"}
            </small>
            <p>
              Space 즉시 정지
              <br />창 이탈 시 자동 정지
            </p>
          </div>
        </div>
        <label className="speed-control">
          이동 속도 <b>{speed}%</b>
          <input
            aria-label={`${robot.robot_id} 이동 속도`}
            type="range"
            min="0"
            max="100"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        </label>
        {ctl.error && (
          <p role="alert" className="control-error">
            {ctl.error}
          </p>
        )}
      </div>
    </section>
    {robot.robot_id === "MINI-01" && (
      <section className="panel mini-auxiliary">
        <header className="panel-head"><h2>전조등</h2></header>
        <div className="panel-body">
        {robot.robot_id === "MINI-01" && (
          <div className="headlight-row">
            <span>
              전조등{" "}
              <b>
                {robot.online && typeof robot.status.headlight_on === "boolean"
                  ? robot.status.headlight_on
                    ? "ON"
                    : "OFF"
                  : "—"}
              </b>
            </span>
            {[true, false].map((on) => (
              <button
                key={String(on)}
                className={`button ${
                  robot.status.headlight_on === on ? "button-primary" : ""
                }`}
                disabled={!ready || !robot.status.headlight_available}
                onClick={() => ctl.setHeadlight(on)}
              >
                {on ? "켜기" : "끄기"}
              </button>
            ))}
          </div>
        )}
        </div>
        <header className="panel-head retrieval-heading"><h2>미니로봇 회수</h2><span className="source-chip">연동 예정</span></header>
        <div className="panel-body">
          <p className="control-hint">회수 장치 연결 후 사용할 수 있습니다.</p>
          <button className="button button-danger full" disabled>미니로봇 회수하기</button>
        </div>
      </section>
    )}
    </>
  )
}
export function Autonomous({ robot }: { robot: RobotState }) {
  const progress = navigationProgress(robot) ?? 64
  return (
    <section className="panel">
      <header className="panel-head">
        <h2>자율주행 점검</h2>
        <span className="source-chip">명령 연동 대기</span>
      </header>
      <div className="panel-body">
        <div className="progress-label"><span>계획 경로 진행률</span><b>{progress.toFixed(0)}%</b></div>
        <progress max="100" value={progress} aria-label="자율주행 진행률" />
        <div className="action-row">
          <button disabled className="button">점검 시작</button>
          <button disabled className="button">일시 정지</button>
          <button disabled className="button">기준 위치 복귀</button>
        </div>
      </div>
    </section>
  )
}
export function CameraPanel() {
  const camera = useRobotCamera(cameraRobotId),
    video = useRef<HTMLVideoElement>(null),
    frame = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(""),
    [dimensions, setDimensions] = useState("")
  useEffect(() => {
    if (video.current)
      video.current.srcObject =
        camera.source === "live" ? camera.liveStream : null
    setError("")
    setDimensions("")
  }, [camera.source, camera.liveStream, camera.recordedVideo?.version])
  const snapshot = () => {
    try {
      const v = video.current
      if (!v || v.readyState < 2) return
      const canvas = document.createElement("canvas")
      canvas.width = v.videoWidth
      canvas.height = v.videoHeight
      canvas.getContext("2d")?.drawImage(v, 0, 0)
      const a = document.createElement("a")
      a.href = canvas.toDataURL("image/png")
      a.download = `${cameraRobotId}-${Date.now()}.png`
      a.click()
    } catch {
      setError("스냅샷을 저장할 수 없습니다.")
    }
  }
  return (
    <section className="panel camera-panel">
      <header className="panel-head">
        <h2>미니로봇 카메라</h2>
        <span className="source-chip">
          {camera.source === "live"
            ? "● 실시간"
            : camera.source === "recorded"
              ? "저장 영상"
              : "연결 대기"}
        </span>
      </header>
      <div className="camera-frame" ref={frame}>
        {camera.source !== "empty" ? (
          <video
            ref={video}
            key={camera.source}
            src={
              camera.source === "recorded" && camera.recordedVideo
                ? recordedVideoUrl(camera.recordedVideo)
                : undefined
            }
            crossOrigin="anonymous"
            autoPlay
            muted
            playsInline
            controls={camera.source === "recorded"}
            loop={camera.source === "recorded"}
            onLoadedMetadata={(e) =>
              setDimensions(
                `${e.currentTarget.videoWidth} × ${e.currentTarget.videoHeight}`,
              )
            }
            onError={() => setError("영상을 재생할 수 없습니다.")}
          />
        ) : (
          <div className="empty-state">
            <span className="empty-symbol">▻</span>
            <b>카메라 연결 대기</b>
            <p>실시간 스트림 또는 저장 영상을 기다립니다.</p>
          </div>
        )}
      </div>
      <div className="camera-tools">
        <span className="muted">{dimensions || cameraRobotId}</span>
        <button
          className="button"
          onClick={() => {
            setError("")
            camera.reload()
          }}
        >
          재조회
        </button>
        <button
          className="button"
          disabled={camera.source === "empty"}
          onClick={snapshot}
        >
          스냅샷
        </button>
        <button
          className="button"
          disabled={camera.source === "empty"}
          onClick={() => {
            void frame.current
              ?.requestFullscreen()
              .catch(() => setError("전체 화면을 열 수 없습니다."))
          }}
        >
          전체 화면
        </button>
      </div>
      {(error || camera.error) && (
        <p className="control-error" role="alert">
          {error || camera.error}
        </p>
      )}
    </section>
  )
}
