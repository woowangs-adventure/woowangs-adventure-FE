import logo from "./assets/turtle-scan-wordmark.png"
import demoMapImage from "./assets/demo-map.png"
import {displayRobots} from "./features/display-robots"
import { useEffect, useState } from "react"
import { useRobotMap } from "./features/robot-map"
import { DEMO_CRACKS, type Crack } from "./features/inspection"
import { CrackDetail, Inspection } from "./components/Inspection"
import { RobotMap } from "./components/RobotMap"
import {
  Autonomous,
  CameraPanel,
  DriveControl,
  RobotSummary,
} from "./components/RobotControl"

type Page = "map" | "inspection" | "control"
const PAGES: { id: Page; label: string; icon: string; description: string }[] = [
  {
    id: "map",
    label: "지하공간 지도",
    icon: "⌖",
    description: "공간과 균열을 한눈에 확인하세요.",
  },
  {
    id: "inspection",
    label: "균열 점검 현황",
    icon: "▥",
    description: "탐지된 균열의 위험도와 변화를 분석합니다.",
  },
  {
    id: "control",
    label: "로봇 제어",
    icon: "⌘",
    description: "로봇의 시야를 확인하고 안전하게 조작하세요.",
  },
]
function currentPage(): Page {
  const hash = window.location.hash.slice(1)
  return PAGES.some((p) => p.id === hash) ? hash as Page : "map"
}
export default function App() {
  const [page, setPage] = useState<Page>(currentPage),
    [selected, setSelected] = useState<Crack | null>(null),
    [activeRobot, setActiveRobot] = useState<string | null>(null),
    [emergency, setEmergency] = useState(false)
  const [theme, setTheme] = useState("dark")
  const state = useRobotMap()
  const cracks = DEMO_CRACKS
  const displayMap = state.map ?? {width:94,height:70,resolution:.05,origin_x:-1.87,origin_y:-.859,origin_yaw:0,frame_id:"map",timestamp:"",version:"demo",image_url:demoMapImage}
  const mapRobots = displayRobots(state.robots, displayMap)
  const turtle = state.robots.find((r) => r.robot_id === "TB3-01")!,
    mini = state.robots.find((r) => r.robot_id === "MINI-01")!
  const navigate = (next: Page) => {
    setActiveRobot(null)
    setPage(next)
    window.location.hash = next
  }
  useEffect(() => {
    const change = () => {
      setActiveRobot(null)
      setPage(currentPage())
    }
    window.addEventListener("hashchange", change)
    return () => window.removeEventListener("hashchange", change)
  }, [])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem("dashboard-theme", theme)
  }, [theme])
  const mapProps = {
    map: displayMap,
    robots: mapRobots,
    loading: state.loading,
    error: state.error,
    reload: state.reload,
  }
  const info = PAGES.find((p) => p.id === page)!
  const pose = mapRobots.find(r=>r.robot_id==="TB3-01")?.pose
  return (
    <div className={`workspace page-${page}`}>
      <aside className="sidebar">
        <a href="#map" className="brand" onClick={() => navigate("map")}>
          <img className="brand-wordmark" src={logo} alt="TurtleScan" />
        </a>
        <nav aria-label="주 메뉴">
          {PAGES.map((p) => (
            <a
              key={p.id}
              href={`#${p.id}`}
              aria-current={page === p.id ? "page" : undefined}
              className={page === p.id ? "active" : ""}
              onClick={(e) => {
                e.preventDefault()
                navigate(p.id)
              }}
            >
              <span>{p.icon}</span>
              {p.label}
              <b>›</b>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <small>지하공간 위험 자동화 점검</small>
          <strong>우왕이의 모험</strong>
          <p>임근영 · 박유경<br />이재숙 · 이진양</p>
        </div>
      </aside>
      <div className="workspace-content">
        <header className="page-header">
          <div>
            <span className="eyebrow">
              TURTLE SCAN / {page.toUpperCase()}
            </span>
            <h1>{info.label}</h1>
            <p>{info.description}</p>
          </div>
          <div className="header-actions">
            <button
              className="button theme-button"
              aria-label="테마 전환"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                setActiveRobot(null)
                setEmergency((v) => !v)
              }}
            >
              {emergency ? "정지 해제" : "■ 비상 정지"}
            </button>
          </div>
        </header>
        {emergency && (
          <div className="emergency-banner" role="alert">
            수동 조작 정지 · 조종권을 해제했습니다. 해제 후 조종을 다시
            활성화하세요.
          </div>
        )}
        <main>
          {page === "map" && (
            <div className={`overview-layout ${selected ? "detail-open" : ""}`}>
              <RobotMap
                {...mapProps}
                cracks={cracks}
                selected={selected}
                onSelect={setSelected}
              />
              <aside className="overview-aside" aria-label="로봇 및 균열 정보">
                <div className="aside-label">
                  로봇 현황{" "}
                  <span>
                    {state.robots.filter((r) => r.online).length}대 연결
                  </span>
                </div>
                {state.robots.map((r) => (
                  <RobotSummary key={r.robot_id} robot={r} />
                ))}

              </aside>
              {selected && <aside className="crack-sidebar" aria-label="선택한 균열 상세"><CrackDetail crack={selected} onClose={()=>setSelected(null)}/></aside>}
            </div>
          )}
          {page === "inspection" && (
            <Inspection
              cracks={cracks}
              selected={selected}
              onSelect={setSelected}
              onMap={() => navigate("map")}
            />
          )}
          {page === "control" && (
            <>
              <div className="robots-layout">
                <section className="robot-column" aria-label="터틀봇 제어">
                  <div className="robot-column-title">
                    <span className="robot-avatar">T</span>
                    <div>
                      <h2>TurtleBot3</h2>
                      <small>TB3-01 · 지도 탐색 및 자율주행</small>
                    </div>
                    <span
                      className={`online-badge ${
                        turtle.online ? "online" : ""
                      }`}
                    >
                      ● {turtle.online ? "연결됨" : "오프라인"}
                    </span>
                  </div>
                  <RobotMap {...mapProps} position={pose ? {x:pose.x,y:pose.y} : null} />
                  <section className="panel robot-actions" aria-label="터틀봇 조작 및 점검">
                  <DriveControl
                    robot={turtle}
                    active={activeRobot === turtle.robot_id}
                    emergency={emergency}
                    onActivate={() =>
                      setActiveRobot((id) =>
                        id === turtle.robot_id ? null : turtle.robot_id,
                      )
                    }
                  />
                  <Autonomous robot={turtle} />
                  </section>
                </section>
                <section className="robot-column" aria-label="미니로봇 제어">
                  <div className="robot-column-title">
                    <span className="robot-avatar mini">M</span>
                    <div>
                      <h2>Mini Robot</h2>
                      <small>MINI-01 · 카메라 및 정밀 점검</small>
                    </div>
                    <span
                      className={`online-badge ${mini.online ? "online" : ""}`}
                    >
                      ● {mini.online ? "연결됨" : "오프라인"}
                    </span>
                  </div>
                  <CameraPanel />
                  <section className="panel robot-actions" aria-label="미니로봇 조작 및 회수">
                  <DriveControl
                    robot={mini}
                    active={activeRobot === mini.robot_id}
                    emergency={emergency}
                    onActivate={() =>
                      setActiveRobot((id) =>
                        id === mini.robot_id ? null : mini.robot_id,
                      )
                    }
                  />

                  </section>
                </section>
              </div>
            </>
          )}
        </main>
        <footer className="page-footer">
          TURTLE SCAN{" "}
          <span>ROBOT INSPECTION</span>
        </footer>
      </div>
    </div>
  )
}
