import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useRobotControl, velocityFromKeys } from '@/features/robot-control'
import { mapImageUrl, projectPoseToMap, useRobotMap } from '@/features/robot-map'

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type Theme = 'light' | 'dark'
type ControlTarget = 'turtlebot' | 'mini'

interface Crack {
  id: string
  type: string
  x: number
  y: number
  currentRisk: number
  predictedRisk: number | null
  changeRate: number
  detectedAt: string
  status: string
  risk: RiskLevel
  isNew?: boolean
  width: string
  confidence: number
  robotId: string
  mapX: number
  mapY: number
}

const CRACKS: Crack[] = [
  { id: 'CR-001', type: '균열 (선형)', x: 2.14, y: 1.03, currentRisk: 78, predictedRisk: 85, changeRate: 12.3, detectedAt: '09:14:22', status: '위험', risk: 'high', width: '3.2 mm', confidence: 94.1, robotId: 'MINI-01', mapX: 62, mapY: 38 },
  { id: 'CR-002', type: '균열 (면상)', x: 3.45, y: 0.87, currentRisk: 92, predictedRisk: null, changeRate: 24.7, detectedAt: '09:18:05', status: '정밀 점검 필요', risk: 'critical', isNew: true, width: '6.8 mm', confidence: 97.3, robotId: 'MINI-01', mapX: 78, mapY: 45 },
  { id: 'CR-003', type: '균열 (선형)', x: 1.2, y: 1.55, currentRisk: 41, predictedRisk: 48, changeRate: 5.1, detectedAt: '09:09:41', status: '관찰 필요', risk: 'medium', width: '1.4 mm', confidence: 88.7, robotId: 'MINI-01', mapX: 34, mapY: 55 },
  { id: 'CR-004', type: '박리', x: 4.1, y: 2.3, currentRisk: 18, predictedRisk: 22, changeRate: 1.9, detectedAt: '09:22:17', status: '정상', risk: 'low', width: '0.6 mm', confidence: 82.4, robotId: 'MINI-01', mapX: 88, mapY: 62 },
  { id: 'CR-005', type: '누수 흔적', x: 0.85, y: 0.6, currentRisk: 55, predictedRisk: 61, changeRate: 8.4, detectedAt: '09:06:33', status: '주의', risk: 'medium', width: '2.1 mm', confidence: 91, robotId: 'MINI-01', mapX: 22, mapY: 30 },
]

const STATUS = [
  { label: '로봇', detail: '정상', tone: 'ok' },
  { label: '미니 영상', detail: '지연 320ms', tone: 'warn' },
  { label: '미니 카메라', detail: '정상', tone: 'ok' },
  { label: 'TB3 LiDAR', detail: '정상', tone: 'ok' },
  { label: 'SLAM', detail: '정상', tone: 'ok' },
  { label: 'YOLO 탐지', detail: '지연 84ms', tone: 'ok' },
  { label: '미니로봇', detail: '정상', tone: 'ok' },
]

const RISK_LABEL: Record<RiskLevel, string> = {
  low: '낮음',
  medium: '보통',
  high: '높음',
  critical: '심각',
}

const CONTROL_ROBOT_IDS: Record<ControlTarget, string> = {
  turtlebot: 'TB3-01',
  mini: 'MINI-01',
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  const paths: Record<string, React.ReactNode> = {
    robot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 7V5a3 3 0 0 1 6 0v2M8 13h.01M16 13h.01M9 17h6"/></>,
    camera: <><path d="M5 7h3l1.5-2h5L16 7h3a2 2 0 0 1 2 2v9H3V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>,
    moon: <path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    expand: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>,
    download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16"/>,
    plus: <><circle cx="10" cy="10" r="6"/><path d="M10 7v6M7 10h6M15 15l5 5"/></>,
    minus: <><circle cx="10" cy="10" r="6"/><path d="M7 10h6M15 15l5 5"/></>,
    search: <><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    alert: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4M12 16h.01"/></>,
    play: <path d="m8 5 11 7-11 7V5Z" fill="currentColor"/>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    back: <path d="m9 7-5 5 5 5M4 12h10a5 5 0 0 1 5 5"/>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function RiskBadge({ crack }: { crack: Crack }) {
  return <span className={`risk-badge risk-${crack.risk}`}><b>{crack.currentRisk}</b> {RISK_LABEL[crack.risk]}</span>
}

function Panel({ title, actions, className = '', children }: { title: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head"><h2>{title}</h2>{actions && <div className="panel-actions">{actions}</div>}</header>
      {children}
    </section>
  )
}

function Button({ children, variant = 'secondary', className = '', onClick, disabled = false, title }: { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; className?: string; onClick?: () => void; disabled?: boolean; title?: string }) {
  return <button type="button" className={`button button-${variant} ${className}`} onClick={onClick} disabled={disabled} title={title}>{children}</button>
}

function DetailDrawer({ crack, onClose }: { crack: Crack; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const trend = [
    { label: '1차', risk: Math.max(8, crack.currentRisk - 44) },
    { label: '2차', risk: Math.max(12, crack.currentRisk - 31) },
    { label: '3차', risk: Math.max(18, crack.currentRisk - 18) },
    { label: '현재', risk: crack.currentRisk },
    { label: '예상', risk: crack.predictedRisk },
  ]

  const fields = [
    ['균열 ID', crack.id], ['분류', crack.type],
    ['X 좌표', `${crack.x.toFixed(2)} m`], ['Y 좌표', `${crack.y.toFixed(2)} m`],
    ['탐지 신뢰도', `${crack.confidence}%`], ['균열 폭', crack.width],
    ['현재 위험도', `${crack.currentRisk}`], ['예상 위험도', crack.predictedRisk ?? '데이터 부족'],
    ['변화율', `+${crack.changeRate}%`], ['탐지 시간', crack.detectedAt],
    ['상태', crack.status], ['로봇 ID', crack.robotId],
  ]

  return (
    <div className="drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="drawer-head">
          <div><span className="eyebrow">균열 상세 정보</span><h2 id="detail-title">{crack.id}</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="상세 정보 닫기"><Icon name="close" /></button>
        </div>
        <div className="drawer-scroll">
          <div className="crack-image-placeholder"><Icon name="camera" size={30}/><b>균열 이미지</b><span>탐지 이미지가 여기에 표시됩니다.</span></div>
          <div className="drawer-summary"><RiskBadge crack={crack}/><span className="status-chip">{crack.status}</span></div>
          <div className="detail-grid">
            {fields.map(([label, value]) => <div className="detail-field" key={label}><span>{label}</span><strong>{value}</strong></div>)}
          </div>
          <div className="trend-block">
            <div className="trend-title"><h3>위험도 변화 추이</h3><span>위험 임계 70</span></div>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false}/>
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}/>
                <ReferenceLine y={70} stroke="var(--orange)" strokeDasharray="4 3"/>
                <Line type="monotone" dataKey="risk" name="위험도" stroke="var(--blue)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--blue)' }} connectNulls/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="drawer-actions"><Button variant="primary"><Icon name="map" size={15}/>지도 위치</Button><Button>원본 프레임</Button><Button>이전 점검 비교</Button></div>
        </div>
      </aside>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('dashboard-theme') as Theme | null
    return saved ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  })
  const [emergency, setEmergency] = useState(false)
  const [controlActive, setControlActive] = useState(false)
  const [controlTarget, setControlTarget] = useState<ControlTarget>('turtlebot')
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const [speed, setSpeed] = useState(50)
  const [zoom, setZoom] = useState(1)
  const [selectedCrack, setSelectedCrack] = useState<Crack | null>(null)
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState<RiskLevel | 'all'>('all')
  const [sort, setSort] = useState<'latest' | 'risk'>('latest')
  const [alertVisible, setAlertVisible] = useState(true)
  const { map, robots, loading: mapLoading, error: mapError, backendOnline, reload: reloadMap } = useRobotMap()
  const turtlebot = robots.find((robot) => robot.robot_id === 'TB3-01')
  const controlRobotId = CONTROL_ROBOT_IDS[controlTarget]
  const controlRobot = robots.find((robot) => robot.robot_id === controlRobotId)
  const robotControl = useRobotControl({
    robotId: controlRobotId,
    enabled: controlActive && !emergency,
    robotOnline: controlRobot?.online ?? false,
    speedPercent: speed,
    activeKeys,
  })
  const currentVelocity = velocityFromKeys(activeKeys, speed)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('dashboard-theme', theme)
  }, [theme])

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase()
    if (!controlActive || emergency || !['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) return
    event.preventDefault()
    setActiveKeys((previous) => new Set(previous).add(key))
  }, [controlActive, emergency])

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    setActiveKeys((previous) => { const next = new Set(previous); next.delete(event.key.toLowerCase()); return next })
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp) }
  }, [handleKeyDown, handleKeyUp])

  useEffect(() => {
    const clearKeys = () => setActiveKeys(new Set())
    window.addEventListener('blur', clearKeys)
    return () => window.removeEventListener('blur', clearKeys)
  }, [])

  const visibleCracks = useMemo(() => {
    const filtered = CRACKS.filter((crack) => (riskFilter === 'all' || crack.risk === riskFilter) && crack.id.toLowerCase().includes(search.toLowerCase()))
    return [...filtered].sort((a, b) => sort === 'risk' ? b.currentRisk - a.currentRisk : b.detectedAt.localeCompare(a.detectedAt))
  }, [riskFilter, search, sort])

  const keyActive = (key: string) => activeKeys.has(key) || activeKeys.has(`arrow${key === 'w' ? 'up' : key === 's' ? 'down' : key === 'a' ? 'left' : 'right'}`)
  const highRisk = CRACKS.filter((crack) => crack.risk === 'high' || crack.risk === 'critical').length
  const controlTargetLabel = controlTarget === 'mini' ? '미니로봇' : 'TurtleBot3'
  const equipmentStatus = STATUS.map((item) => {
    if (item.label === '로봇') return { ...item, detail: turtlebot?.online ? '정상' : '오프라인', tone: turtlebot?.online ? 'ok' : 'warn' }
    if (item.label === 'TB3 LiDAR') return { ...item, detail: turtlebot?.online ? '정상' : '연결 대기', tone: turtlebot?.online ? 'ok' : 'warn' }
    if (item.label === 'SLAM') {
      const localized = turtlebot?.status.localization_available === true
      return { ...item, detail: localized ? 'AMCL 위치 확인' : map ? '지도만 준비' : '지도 없음', tone: localized ? 'ok' : 'warn' }
    }
    return item
  })
  const robotMarkers = useMemo(() => {
    if (!map) return []
    return robots.flatMap((robot) => {
      if (
        !robot.pose
        || robot.pose.frame_id !== map.frame_id
        || robot.status.localization_available !== true
        || robot.pose.map_version !== map.version
      ) return []
      const point = projectPoseToMap(map, robot.pose)
      return point.inside ? [{ robot, point }] : []
    })
  }, [map, robots])

  const changeControlTarget = (target: ControlTarget) => {
    setActiveKeys(new Set())
    setControlActive(false)
    setControlTarget(target)
  }

  const toggleControl = () => {
    setActiveKeys(new Set())
    setControlActive((active) => !active)
  }

  const toggleEmergency = () => {
    setActiveKeys(new Set())
    setControlActive(false)
    setEmergency((active) => !active)
  }

  const controlCommand = currentVelocity.stop
    ? '즉시 정지'
    : currentVelocity.linear > 0 ? '전진'
      : currentVelocity.linear < 0 ? '후진'
        : currentVelocity.angular > 0 ? '좌회전'
        : currentVelocity.angular < 0 ? '우회전' : '정지'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon"><Icon name="robot" size={20}/></span><div><h1>지하공간 위험 자동화 점검 시스템</h1><p>AI 기반 로봇 관제 대시보드</p></div><span className="inspection-live"><i/>점검 진행 중</span></div>
        <div className="mission-overview"><span><small>주 로봇</small><b>TurtleBot3 Burger</b></span><span><small>보조 로봇</small><b>미니로봇</b></span><span><small>점검 경과</small><b className="mono">00:28:14</b></span></div>
        <div className="top-actions"><span className={`connection ${backendOnline ? '' : 'connection-offline'}`}><i/>{backendOnline ? '백엔드 연결' : '백엔드 연결 안 됨'} <small>· 지도 API</small></span><button className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="테마 전환" aria-label="다크 모드 전환"><Icon name={theme === 'light' ? 'moon' : 'sun'}/></button><Button variant="danger" onClick={toggleEmergency}><Icon name="stop" size={13}/>{emergency ? '정지 해제' : '비상 정지'}</Button></div>
      </header>

      <div className="statusbar" aria-label="장비 연결 상태">
        {equipmentStatus.map((item) => <div className={`status-item status-${item.tone}`} key={item.label}><i/><span>{item.label}</span><b>{item.detail}</b></div>)}
      </div>

      {emergency && <div className="emergency-banner"><Icon name="alert" size={16}/><b>비상 정지 활성화</b><span>모든 이동 명령이 차단되었습니다.</span></div>}

      {alertVisible && !emergency && <aside className="risk-toast"><button onClick={() => setAlertVisible(false)} aria-label="알림 닫기"><Icon name="close" size={14}/></button><div className="toast-icon"><Icon name="alert" size={18}/></div><div><strong>고위험 균열 탐지</strong><p>CR-002 · 위험도 <b>92</b> · X 3.45m / Y 0.87m</p><button onClick={() => setSelectedCrack(CRACKS[1])}>상세 확인</button></div></aside>}

      <main className="dashboard">
        <div className="monitor-grid">
          <Panel title="미니로봇 실시간 카메라" className="camera-panel" actions={<><span className="source-chip">MINI-01</span><span className="stream-state"><i/>연결 대기</span><Button className="desktop-only"><Icon name="download" size={14}/>스냅샷</Button><Button className="desktop-only"><Icon name="expand" size={14}/>전체 화면</Button></>}>
            <div className="camera-frame"><div className="camera-empty"><span><Icon name="camera" size={30}/></span><b>실시간 영상 영역</b><p>WebRTC 영상 연결 후 실시간 화면이 표시됩니다.</p></div><small>16:9 영상 영역</small></div>
            <div className="camera-meta"><span><small>해상도</small><b className="mono">640×480</b></span><span><small>FPS</small><b className="mono">30fps</b></span><span><small>영상 지연</small><b className="mono warning-text">320ms</b></span><span><small>마지막 프레임</small><b className="mono">—</b></span></div>
          </Panel>

          <Panel title="TurtleBot3 SLAM 지도" className="map-panel" actions={<><span className="source-chip">TB3-01 · LiDAR</span><span className={`stream-state ${turtlebot?.online ? 'online' : ''}`}><i/>{turtlebot?.online ? '위치 수신 중' : '저장 지도'}</span><button className="icon-button compact" onClick={() => setZoom(Math.min(1.5, zoom + .1))} aria-label="지도 확대"><Icon name="plus" size={15}/></button><button className="icon-button compact" onClick={() => setZoom(Math.max(.8, zoom - .1))} aria-label="지도 축소"><Icon name="minus" size={15}/></button></>}>
            <div className="map-frame">
              {mapLoading && <div className="map-message"><Icon name="map" size={26}/><b>SLAM 지도 불러오는 중</b></div>}
              {!mapLoading && mapError && <div className="map-message map-error"><Icon name="alert" size={26}/><b>{mapError}</b><Button onClick={reloadMap}>다시 시도</Button></div>}
              {!mapLoading && map && <div className={`map-canvas ${map.width >= map.height ? 'map-landscape' : 'map-portrait'}`} style={{ transform: `scale(${zoom})`, aspectRatio: `${map.width} / ${map.height}` }}>
                <img className="slam-map-img" src={mapImageUrl(map)} alt="LiDAR로 생성한 지하공간 SLAM 지도"/>
                {robotMarkers.map(({ robot, point }) => <div key={robot.robot_id} className={`robot-marker ${robot.robot_id.startsWith('MINI') ? 'robot-mini' : 'robot-turtlebot'}`} style={{ left: `${point.left}%`, top: `${point.top}%`, transform: `translate(-50%, -50%) rotate(${point.rotation}deg)` }} title={`${robot.robot_id} · X ${robot.pose?.x.toFixed(2)}m / Y ${robot.pose?.y.toFixed(2)}m`}><span/><i/></div>)}
                {robotMarkers.length === 0 && <span className="pose-waiting">로봇 위치 수신 대기</span>}
              </div>}
            </div>
            <div className="map-footer"><div>{robots.map((robot) => <span key={robot.robot_id}><i className={`legend ${robot.robot_id.startsWith('MINI') ? 'mini-legend' : 'robot-legend'}`}/>{robot.robot_id}</span>)}</div><p><span>X <b className="mono">{turtlebot?.pose ? `${turtlebot.pose.x.toFixed(2)}m` : '—'}</b></span><span>Y <b className="mono">{turtlebot?.pose ? `${turtlebot.pose.y.toFixed(2)}m` : '—'}</b></span><span>Yaw <b className="mono">{turtlebot?.pose ? `${(turtlebot.pose.yaw * 180 / Math.PI).toFixed(0)}°` : '—'}</b></span><span>해상도 <b className="mono">{map ? `${map.resolution.toFixed(2)}m/px` : '—'}</b></span></p></div>
          </Panel>
        </div>

        <div className="operations-grid">
          <div className="control-stack">
            <Panel title="로봇 수동 조작" className="mini-control" actions={<button className={`control-toggle ${robotControl.state === 'ready' ? 'active' : ''}`} disabled={emergency || !controlRobot?.online || !robotControl.serverEnabled} onClick={toggleControl}><i/>{robotControl.state === 'ready' ? `${controlTargetLabel} 조종 중` : controlActive ? '연결 중' : '조종 활성화'}</button>}>
              <div className="robot-selector" aria-label="키보드 제어 대상">
                <button className={controlTarget === 'mini' ? 'active' : ''} disabled={!robots.some((robot) => robot.robot_id === 'MINI-01' && robot.online)} onClick={() => changeControlTarget('mini')} title="미니로봇 Edge 연동 후 활성화됩니다."><Icon name="camera" size={12}/><span>미니로봇</span><small>연동 예정</small></button>
                <button className={controlTarget === 'turtlebot' ? 'active' : ''} onClick={() => changeControlTarget('turtlebot')}><Icon name="map" size={12}/><span>TurtleBot3</span><small>LiDAR · SLAM</small></button>
              </div>
              <div className="drive-row">
                <div className="keypad"><span/><button className={keyActive('w') ? 'pressed' : ''}>W</button><span/><button className={keyActive('a') ? 'pressed' : ''}>A</button><button className={activeKeys.has(' ') ? 'pressed stop-key' : 'stop-key'}>SPC</button><button className={keyActive('d') ? 'pressed' : ''}>D</button><span/><button className={keyActive('s') ? 'pressed' : ''}>S</button><span/></div>
                <div className="drive-info"><p><span>W / ↑</span> 전진 · <span>S / ↓</span> 후진</p><p><span>A / ←</span> 좌회전 · <span>D / →</span> 우회전</p><p><span>Space</span> 즉시 정지</p></div>
              </div>
              <div className="speed-row"><label htmlFor="speed">속도 <b>{speed}%</b></label><input id="speed" type="range" min="0" max="100" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}/></div>
              {robotControl.error && <p className="control-error">{robotControl.error}</p>}
              <div className="telemetry"><span>대상 <b>{controlTargetLabel}</b></span><span>명령 <b>{controlCommand}</b></span><span>속도 <b>{speed}%</b></span><span>지연 <b>{robotControl.latencyMs === null ? '—' : `${robotControl.latencyMs}ms`}</b></span></div>
            </Panel>

            <Panel title="TurtleBot3 탐색 제어" className="navigation-control" actions={<span className="nav-live"><i/>자율주행 중</span>}>
              <div className="nav-buttons"><Button variant="primary" disabled={emergency}><Icon name="play" size={12}/>탐색 시작</Button><Button disabled={emergency}><Icon name="pause" size={12}/>일시 정지</Button><Button disabled={emergency}><Icon name="back" size={13}/>기준 위치 복귀</Button></div>
              <div className="nav-stats"><span>현재 목표 <b>WP-07</b></span><span>이동 속도 <b>0.18 m/s</b></span><span>잔여 경로 <b>3.2m</b></span><span>장애물 회피 <b>대기 중</b></span></div>
            </Panel>
          </div>

          <Panel title="균열 탐지 로그" className="log-panel" actions={<div className="log-kpis"><span>전체 <b>{CRACKS.length}</b></span><span>고위험 <b className="danger-text">{highRisk}</b></span><span>진행률 <b className="blue-text">64%</b></span></div>}>
            <div className="log-tools"><label><Icon name="search" size={14}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="균열 ID 검색"/></label><select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskLevel | 'all')}><option value="all">전체 위험도</option><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option><option value="critical">심각</option></select><div className="segmented"><button className={sort === 'latest' ? 'active' : ''} onClick={() => setSort('latest')}>최신순</button><button className={sort === 'risk' ? 'active' : ''} onClick={() => setSort('risk')}>위험순</button></div></div>
            <div className="table-wrap">
              <table><thead><tr><th>균열 ID</th><th>분류</th><th>X / Y 좌표</th><th>현재 위험도</th><th>예상</th><th>변화율</th><th>탐지 시간</th><th>상태</th></tr></thead>
              <tbody>{visibleCracks.map((crack) => <tr key={crack.id} onClick={() => setSelectedCrack(crack)}><td><b className="mono id-cell">{crack.id}</b>{crack.isNew && <em>신규</em>}</td><td>{crack.type}</td><td className="mono">{crack.x.toFixed(2)} / {crack.y.toFixed(2)}m</td><td><RiskBadge crack={crack}/></td><td className="mono">{crack.predictedRisk ?? '—'}</td><td className="mono change">▲ {crack.changeRate.toFixed(1)}%</td><td className="mono muted">{crack.detectedAt}</td><td><span className={`row-status risk-${crack.risk}`}>{crack.status}</span></td></tr>)}</tbody></table>
              {visibleCracks.length === 0 && <div className="empty-log">검색 조건에 맞는 균열이 없습니다.</div>}
            </div>
          </Panel>
        </div>
      </main>

      {selectedCrack && <DetailDrawer crack={selectedCrack} onClose={() => setSelectedCrack(null)}/>}
    </div>
  )
}
