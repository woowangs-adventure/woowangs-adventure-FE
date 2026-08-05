import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import mapImage from '@/imports/image.png'

// ─── Types ──────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type SystemStatus = 'normal' | 'delay' | 'error' | 'offline'
type NavState = 'idle' | 'planning' | 'navigating' | 'avoiding' | 'arrived' | 'returning' | 'error'

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
  isNew: boolean
  width: string
  confidence: number
  lastInspected: string
  robotId: string
  mapX: number
  mapY: number
}

interface StatusItem {
  key: string
  label: string
  status: SystemStatus
  detail: string
  tooltip: string
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const INITIAL_CRACKS: Crack[] = [
  {
    id: 'CR-001', type: '균열 (선형)', x: 2.14, y: 1.03, currentRisk: 78, predictedRisk: 85,
    changeRate: +12.3, detectedAt: '09:14:22', status: '위험', risk: 'high', isNew: false,
    width: '3.2mm', confidence: 94.1, lastInspected: '09:14:22', robotId: 'MINI-01',
    mapX: 62, mapY: 38
  },
  {
    id: 'CR-002', type: '균열 (면상)', x: 3.45, y: 0.87, currentRisk: 92, predictedRisk: null,
    changeRate: +24.7, detectedAt: '09:18:05', status: '정밀 점검 필요', risk: 'critical', isNew: true,
    width: '6.8mm', confidence: 97.3, lastInspected: '09:18:05', robotId: 'MINI-01',
    mapX: 78, mapY: 45
  },
  {
    id: 'CR-003', type: '균열 (선형)', x: 1.20, y: 1.55, currentRisk: 41, predictedRisk: 48,
    changeRate: +5.1, detectedAt: '09:09:41', status: '관찰 필요', risk: 'medium', isNew: false,
    width: '1.4mm', confidence: 88.7, lastInspected: '09:09:41', robotId: 'MINI-01',
    mapX: 34, mapY: 55
  },
  {
    id: 'CR-004', type: '박리', x: 4.10, y: 2.30, currentRisk: 18, predictedRisk: 22,
    changeRate: +1.9, detectedAt: '09:22:17', status: '정상', risk: 'low', isNew: false,
    width: '0.6mm', confidence: 82.4, lastInspected: '09:22:17', robotId: 'MINI-01',
    mapX: 88, mapY: 62
  },
  {
    id: 'CR-005', type: '누수 흔적', x: 0.85, y: 0.60, currentRisk: 55, predictedRisk: 61,
    changeRate: +8.4, detectedAt: '09:06:33', status: '주의', risk: 'medium', isNew: false,
    width: '2.1mm', confidence: 91.0, lastInspected: '09:06:33', robotId: 'MINI-01',
    mapX: 22, mapY: 30
  },
]

const INITIAL_STATUS: StatusItem[] = [
  { key: 'server', label: '서버 연결', status: 'normal', detail: '정상', tooltip: '제어 서버 WebSocket 연결 상태' },
  { key: 'robot', label: '로봇 연결', status: 'normal', detail: '정상', tooltip: 'TurtleBot3 연결 상태' },
  { key: 'video', label: '영상 연결', status: 'delay', detail: '영상 지연 320ms', tooltip: 'WebRTC 영상 스트림 상태' },
  { key: 'camera', label: '카메라', status: 'normal', detail: '정상', tooltip: '미니로봇 카메라 모듈 상태' },
  { key: 'lidar', label: 'LiDAR', status: 'normal', detail: '정상', tooltip: 'LiDAR 센서 수신 상태' },
  { key: 'slam', label: 'SLAM', status: 'normal', detail: '정상', tooltip: 'SLAM 알고리즘 실행 상태' },
  { key: 'yolo', label: 'YOLO 탐지', status: 'normal', detail: '제어 지연 84ms', tooltip: 'YOLOv8 균열 탐지 엔진 상태' },
  { key: 'db', label: '데이터베이스', status: 'normal', detail: '정상', tooltip: '균열 데이터 저장 DB 연결 상태' },
  { key: 'mini', label: '미니로봇', status: 'normal', detail: '정상', tooltip: '미니로봇 제어 연결 상태' },
  { key: 'tether', label: '테더 상태', status: 'normal', detail: '1.8m 전개', tooltip: '테더 와이어 장력 및 길이 상태' },
]

const RISK_TREND_DATA = [
  { date: '1차\n03-10', prev: 22, current: null, predicted: null },
  { date: '2차\n04-15', prev: 31, current: null, predicted: null },
  { date: '3차\n05-22', prev: 45, current: null, predicted: null },
  { date: '4차\n06-18', prev: 58, current: null, predicted: null },
  { date: '5차\n07-10', prev: 62, current: null, predicted: null },
  { date: '현재\n08-03', prev: null, current: 78, predicted: null },
  { date: '예상\n09-01', prev: null, current: null, predicted: 85 },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const riskColor: Record<RiskLevel, string> = {
  low: '#16A34A', medium: '#F59E0B', high: '#EA580C', critical: '#DC2626'
}
const riskLabel: Record<RiskLevel, string> = {
  low: '낮음', medium: '보통', high: '높음', critical: '심각'
}
const statusColor: Record<SystemStatus, string> = {
  normal: '#16A34A', delay: '#F59E0B', error: '#DC2626', offline: '#64748B'
}
const statusLabel: Record<SystemStatus, string> = {
  normal: '정상', delay: '지연', error: '오류', offline: '연결 안 됨'
}

function StatusDot({ status }: { status: SystemStatus }) {
  const c = statusColor[status]
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: c, flexShrink: 0, marginTop: 2
    }} />
  )
}

function RiskBadge({ risk, score }: { risk: RiskLevel; score?: number }) {
  const c = riskColor[risk]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
      background: c + '18', color: c, border: `1px solid ${c}40`
    }}>
      {score !== undefined && <span className="tabnum">{score}</span>}
      {riskLabel[risk]}
    </span>
  )
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function Icon({ name, size = 16, color }: { name: string; size?: number; color?: string }) {
  const s = { width: size, height: size, flexShrink: 0, color: color || 'currentColor' }
  const icons: Record<string, JSX.Element> = {
    camera: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>,
    wifi: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" /></svg>,
    robot: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M9 8V6a3 3 0 016 0v2" /><circle cx="9" cy="14" r="1.5" fill="currentColor" /><circle cx="15" cy="14" r="1.5" fill="currentColor" /><path strokeLinecap="round" d="M9 17h6" /></svg>,
    lidar: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>,
    map: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" /></svg>,
    db: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0018 0V5" /><path d="M3 12a9 3 0 0018 0" /></svg>,
    tether: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M3 12c0 0 3-4 6-4s6 8 9 4" /><circle cx="3" cy="12" r="1.5" fill="currentColor" /><circle cx="21" cy="12" r="1.5" fill="currentColor" /></svg>,
    alert: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
    stop: <svg style={s} viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2" /></svg>,
    play: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><polygon points="5,3 19,12 5,21" fill="currentColor" /></svg>,
    pause: <svg style={s} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>,
    fullscreen: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>,
    snapshot: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>,
    zoomin: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35M11 8v6M8 11h6" /></svg>,
    zoomout: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35M8 11h6" /></svg>,
    locate: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>,
    reset: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>,
    fit: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
    led: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 001.5-.189m-1.5.189a6.01 6.01 0 01-1.5-.189m3.75 7.478a12.06 12.06 0 01-4.5 0m3.75 2.383a14.406 14.406 0 01-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 10-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" /></svg>,
    buzzer: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
    return: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>,
    search: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" /></svg>,
    up: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>,
    down: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>,
    left: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>,
    right: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>,
    x: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" /></svg>,
    check: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>,
    info: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" /></svg>,
    eye: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><circle cx="12" cy="12" r="3" /></svg>,
    chart: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
    warning: <svg style={s} viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>,
    video: <svg style={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>,
  }
  return icons[name] || <svg style={s} viewBox="0 0 24 24" />
}

// ─── KeyboardKey Component ────────────────────────────────────────────────────

function KeyboardKey({ label, active, disabled }: { label: string; active: boolean; disabled: boolean }) {
  return (
    <div style={{
      width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 6, border: '1px solid',
      borderColor: disabled ? '#E2E8F0' : active ? '#2563EB' : '#CBD5E1',
      background: disabled ? '#F8FAFC' : active ? '#EFF6FF' : '#FFFFFF',
      color: disabled ? '#CBD5E1' : active ? '#2563EB' : '#475569',
      fontSize: 13, fontWeight: 600,
      boxShadow: active ? '0 0 0 2px #BFDBFE' : disabled ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
      transition: 'all 0.1s',
      userSelect: 'none',
    }}>
      {label}
    </div>
  )
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [emergencyStop, setEmergencyStop] = useState(false)
  const [stopReleasing, setStopReleasing] = useState(false)
  const [controlActive, setControlActive] = useState(false)
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set())
  const [cracks] = useState<Crack[]>(INITIAL_CRACKS)
  const [selectedCrackId, setSelectedCrackId] = useState<string>('CR-001')
  const [sortBy, setSortBy] = useState<'time' | 'risk'>('time')
  const [filterRisk, setFilterRisk] = useState<RiskLevel | 'all'>('all')
  const [searchId, setSearchId] = useState('')
  const [mapZoom, setMapZoom] = useState(3)
  const [navState] = useState<NavState>('navigating')
  const [ledOn, setLedOn] = useState(false)
  const [buzzerOn, setBuzzerOn] = useState(false)
  const [speed, setSpeed] = useState(50)
  const [alertVisible, setAlertVisible] = useState(true)
  const [videoMode, setVideoMode] = useState<'detect' | 'raw'>('detect')
  const [elapsed] = useState('00:28:14')
  const [heartbeat] = useState('1초 전')
  const controlRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth < 640)
      setIsTablet(window.innerWidth >= 640 && window.innerWidth < 1024)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!controlActive || emergencyStop) return
    const key = e.key.toLowerCase()
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(key)) {
      e.preventDefault()
      setActiveKeys(prev => new Set(prev).add(key))
    }
  }, [controlActive, emergencyStop])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    const key = e.key.toLowerCase()
    setActiveKeys(prev => { const n = new Set(prev); n.delete(key); return n })
  }, [])

  const handleBlur = useCallback(() => {
    setActiveKeys(new Set())
    setControlActive(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
    }
  }, [handleKeyDown, handleKeyUp, handleBlur])

  const selectedCrack = cracks.find(c => c.id === selectedCrackId) || cracks[0]

  const sortedCracks = [...cracks]
    .filter(c => filterRisk === 'all' || c.risk === filterRisk)
    .filter(c => !searchId || c.id.toLowerCase().includes(searchId.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'risk') return b.currentRisk - a.currentRisk
      return b.detectedAt.localeCompare(a.detectedAt)
    })

  const navStateLabels: Record<NavState, string> = {
    idle: '대기 중', planning: '경로 생성 중', navigating: '자율주행 중',
    avoiding: '장애물 회피 중', arrived: '목표 도착', returning: '복귀 중', error: '오류'
  }

  const robotPos = { x: 48, y: 42, yaw: 32 }

  const trendData = RISK_TREND_DATA.map(d => {
    if (selectedCrack) {
      const base = selectedCrack.currentRisk
      return d
    }
    return d
  })

  const getDirection = () => {
    if (activeKeys.has('w') || activeKeys.has('arrowup')) return '전진'
    if (activeKeys.has('s') || activeKeys.has('arrowdown')) return '후진'
    if (activeKeys.has('a') || activeKeys.has('arrowleft')) return '좌회전'
    if (activeKeys.has('d') || activeKeys.has('arrowright')) return '우회전'
    if (activeKeys.has(' ')) return '정지'
    return '정지'
  }

  const isKeyActive = (keys: string[]) => keys.some(k => activeKeys.has(k))

  // ─── Emergency Stop ───────────────────────────────────────────────────────

  const handleEmergencyStop = () => {
    if (emergencyStop) return
    setEmergencyStop(true)
    setControlActive(false)
    setActiveKeys(new Set())
  }

  const handleStopRelease = () => {
    if (!stopReleasing) {
      setStopReleasing(true)
    } else {
      setEmergencyStop(false)
      setStopReleasing(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const card = {
    background: '#FFFFFF',
    border: '1px solid #D8E1EB',
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(23,32,51,0.06)',
  }

  const sectionTitle = (title: string, action?: JSX.Element) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#172033', letterSpacing: 0.2 }}>{title}</h2>
      {action}
    </div>
  )

  const Btn = ({ children, onClick, variant = 'default', disabled = false, style: s = {} }: any) => {
    const variants: Record<string, object> = {
      default: { background: '#F1F5F9', color: '#334155', border: '1px solid #D8E1EB' },
      primary: { background: '#2563EB', color: '#FFFFFF', border: '1px solid #2563EB' },
      danger: { background: '#DC2626', color: '#FFFFFF', border: '1px solid #DC2626' },
      outline: { background: 'transparent', color: '#2563EB', border: '1px solid #2563EB' },
    }
    return (
      <button onClick={onClick} disabled={disabled} style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
        borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1, transition: 'all 0.15s',
        ...(variants[variant] || variants.default), ...s
      }}>
        {children}
      </button>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FB', fontFamily: "'Pretendard', 'Inter', sans-serif" }}>

      {/* ─── Toast Alert ─── */}
      {alertVisible && (
        <div style={{
          position: 'fixed', top: 72, right: 16, zIndex: 100,
          width: 320, ...card,
          borderLeft: '4px solid #DC2626',
          padding: '12px 14px',
          animation: 'slideIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#DC2626', fontSize: 12, fontWeight: 700 }}>
              <Icon name="alert" size={14} />
              고위험 균열 탐지
            </div>
            <button onClick={() => setAlertVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0 }}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <p style={{ margin: '0 0 6px', fontSize: 12, color: '#172033', fontWeight: 500 }}>새로운 고위험 균열이 발견되었습니다.</p>
          <div style={{ fontSize: 11, color: '#64748B', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span>위험도: <span style={{ color: '#DC2626', fontWeight: 700 }}>심각 (92)</span></span>
            <span className="tabnum">좌표: X 3.45m / Y 0.87m</span>
            <span>탐지 시간: 09:18:05</span>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <Btn onClick={() => { setSelectedCrackId('CR-002'); setAlertVisible(false) }} variant="outline" style={{ fontSize: 11, padding: '4px 8px' }}>지도에서 보기</Btn>
            <Btn onClick={() => { setSelectedCrackId('CR-002'); setAlertVisible(false) }} variant="primary" style={{ fontSize: 11, padding: '4px 8px' }}>상세 확인</Btn>
          </div>
        </div>
      )}

      {/* ─── Header ─── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: '#FFFFFF', borderBottom: '1px solid #D8E1EB',
        boxShadow: '0 1px 4px rgba(23,32,51,0.05)',
      }}>
        <div style={{
          maxWidth: 1440, margin: '0 auto', padding: isMobile ? '8px 12px' : '0 24px',
          height: isMobile ? 'auto' : 56,
          display: 'flex', alignItems: 'center', flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? 8 : 16,
        }}>
          {/* Left */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, background: '#EFF6FF', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="robot" size={16} color="#2563EB" />
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#172033', whiteSpace: 'nowrap' }}>
                {isMobile ? 'AI 지하공간 점검' : '지하공간 위험 자동화 점검 시스템'}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: '#D1FAE5', color: '#065F46',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
                점검 진행 중
              </span>
            </div>
            {!isMobile && (
              <span style={{ fontSize: 11, color: '#64748B', paddingLeft: 36 }}>AI 기반 로봇 관제 대시보드</span>
            )}
          </div>

          {/* Center info */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 16, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                ['주 로봇', 'TurtleBot3 Burger'],
                ['보조 로봇', '미니로봇'],
                ['점검 경과', elapsed],
                ['지도 버전', 'v3.2'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                  <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{label}</span>
                  <span className="tabnum" style={{ fontSize: 12, fontWeight: 700, color: '#172033', fontFamily: label === '점검 경과' ? 'JetBrains Mono' : 'inherit' }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {!isMobile && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <StatusDot status="normal" />
                  <span style={{ color: '#16A34A', fontWeight: 600 }}>정상 연결</span>
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>마지막 수신 {heartbeat}</div>
                <div style={{ width: 1, height: 20, background: '#E2E8F0' }} />
              </>
            )}
            {emergencyStop ? (
              <button
                onClick={handleStopRelease}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 7, border: '2px solid #DC2626',
                  background: stopReleasing ? '#DC262620' : '#DC262610',
                  color: '#DC2626', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  animation: 'pulse 1s infinite',
                }}>
                <Icon name="stop" size={14} />
                {stopReleasing ? '한 번 더 눌러 해제' : '비상 정지 해제'}
              </button>
            ) : (
              <button
                onClick={handleEmergencyStop}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 7, border: '2px solid #DC2626',
                  background: '#DC2626', color: '#FFFFFF', fontWeight: 700,
                  fontSize: 12, cursor: 'pointer',
                }}>
                <Icon name="stop" size={14} />
                비상 정지
              </button>
            )}
          </div>
        </div>

        {/* Status Strip */}
        {!isMobile && (
          <div style={{
            background: '#F8FAFC', borderTop: '1px solid #E8EEF5',
            padding: '6px 24px', overflowX: 'auto',
          }}>
            <div style={{
              maxWidth: 1440, margin: '0 auto',
              display: 'flex', gap: 4, flexWrap: 'nowrap',
            }}>
              {INITIAL_STATUS.map(s => (
                <div key={s.key} title={s.tooltip} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 10px', borderRadius: 6, flexShrink: 0,
                  background: s.status === 'normal' ? 'transparent' : s.status === 'delay' ? '#FFFBEB' : '#FEF2F2',
                  border: s.status === 'normal' ? 'none' : `1px solid ${statusColor[s.status]}30`,
                }}>
                  <StatusDot status={s.status} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#475569', lineHeight: 1.2 }}>{s.label}</span>
                    <span className="tabnum" style={{ fontSize: 10, color: statusColor[s.status], lineHeight: 1.2 }}>{s.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Stop Banner */}
        {emergencyStop && (
          <div style={{
            background: '#FEF2F2', borderTop: '2px solid #DC2626',
            padding: '6px 24px', textAlign: 'center',
            fontSize: 13, fontWeight: 700, color: '#DC2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <Icon name="stop" size={14} />
            비상 정지 활성화 — 모든 이동 명령이 차단되었습니다
          </div>
        )}
      </header>

      {/* ─── Main Content ─── */}
      <main style={{ maxWidth: 1440, margin: '0 auto', padding: isMobile ? '12px' : '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Row 1: Camera + Map */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '7fr 5fr',
          gap: 14,
        }}>
          {/* ─── Camera Panel ─── */}
          <div style={{ ...card, padding: 14 }}>
            {sectionTitle('실시간 카메라',
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn onClick={() => setVideoMode('detect')} variant={videoMode === 'detect' ? 'primary' : 'default'} style={{ fontSize: 11, padding: '3px 8px' }}>탐지 화면</Btn>
                <Btn onClick={() => setVideoMode('raw')} variant={videoMode === 'raw' ? 'primary' : 'default'} style={{ fontSize: 11, padding: '3px 8px' }}>원본 화면</Btn>
                <Btn style={{ fontSize: 11, padding: '3px 8px' }}><Icon name="fullscreen" size={11} />전체 화면</Btn>
                <Btn style={{ fontSize: 11, padding: '3px 8px' }}><Icon name="snapshot" size={11} />스냅샷</Btn>
              </div>
            )}

            {/* Camera Area */}
            <div style={{
              aspectRatio: '16/9', background: '#F1F5F9',
              borderRadius: 8, border: '2px dashed #CBD5E1',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, position: 'relative',
            }}>
              <div style={{ width: 48, height: 48, background: '#E2E8F0', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="camera" size={24} color="#94A3B8" />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: '#475569' }}>실시간 영상 영역</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>WebRTC 영상 연결 후 실시간 화면이 표시됩니다.</p>
              </div>
              <div style={{ padding: '3px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 5, fontSize: 11, color: '#64748B' }}>
                영상 연결 대기 중
              </div>
              <div style={{ position: 'absolute', bottom: 10, left: 10, fontSize: 10, color: '#94A3B8' }}>16:9 영상 영역</div>
              <div style={{
                position: 'absolute', top: 10, right: 10,
                padding: '2px 8px', background: '#F59E0B20', border: '1px solid #F59E0B40',
                borderRadius: 5, fontSize: 10, fontWeight: 600, color: '#B45309',
              }}>
                영상 연결 대기 중
              </div>
            </div>

            {/* Camera Metadata */}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
              {[['해상도', '640×480'], ['FPS', '30fps'], ['영상 지연', '320ms'], ['마지막 프레임', '--']].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 1, minWidth: 60 }}>
                  <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>{k}</span>
                  <span className="tabnum" style={{ fontSize: 12, fontWeight: 700, color: '#172033' }}>{v}</span>
                </div>
              ))}
              <div style={{ flex: 2, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#92400E' }}>
                <Icon name="info" size={12} color="#D97706" style={{ display: 'inline', marginRight: 4 }} />
                영상 연결을 확인한 후 로봇을 조작할 수 있습니다.
              </div>
            </div>
          </div>

          {/* ─── SLAM Map Panel ─── */}
          <div style={{ ...card, padding: 14 }}>
            {sectionTitle('SLAM 지도',
              <div style={{ display: 'flex', gap: 5 }}>
                <Btn onClick={() => setMapZoom(z => Math.min(z + 0.5, 6))} style={{ fontSize: 11, padding: '3px 7px' }}><Icon name="zoomin" size={11} />확대</Btn>
                <Btn onClick={() => setMapZoom(z => Math.max(z - 0.5, 1))} style={{ fontSize: 11, padding: '3px 7px' }}><Icon name="zoomout" size={11} />축소</Btn>
                <Btn onClick={() => setMapZoom(3)} style={{ fontSize: 11, padding: '3px 7px' }}><Icon name="fit" size={11} />화면 맞춤</Btn>
                <Btn style={{ fontSize: 11, padding: '3px 7px' }}><Icon name="locate" size={11} /></Btn>
                <Btn onClick={() => setMapZoom(3)} style={{ fontSize: 11, padding: '3px 7px' }}><Icon name="reset" size={11} /></Btn>
              </div>
            )}

            {/* Map Container */}
            <div style={{
              position: 'relative', background: '#E8EEF5', borderRadius: 8,
              border: '1px solid #D8E1EB', overflow: 'hidden',
              aspectRatio: '110/74',
            }}>
              <img
                src={mapImage}
                alt="SLAM 점유 격자 지도"
                className="slam-map-img"
                style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }}
              />

              {/* SVG Overlay */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} viewBox="0 0 110 74" preserveAspectRatio="none">
                {/* Movement trail */}
                <polyline points="20,58 25,52 32,48 40,44 48,42" fill="none" stroke="#0891B2" strokeWidth="0.6" strokeDasharray="1,1" opacity="0.5" />

                {/* Crack markers */}
                {cracks.map(c => {
                  const color = riskColor[c.risk]
                  const isSelected = c.id === selectedCrackId
                  return (
                    <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCrackId(c.id)}>
                      {isSelected && <circle cx={c.mapX} cy={c.mapY} r={4} fill={color} opacity={0.2} />}
                      <circle cx={c.mapX} cy={c.mapY} r={isSelected ? 2.5 : 2} fill={color} stroke="#fff" strokeWidth={0.6} />
                    </g>
                  )
                })}

                {/* TurtleBot */}
                <g transform={`translate(${robotPos.x},${robotPos.y}) rotate(${robotPos.yaw})`}>
                  <circle r={3.5} fill="#2563EB" stroke="#fff" strokeWidth={0.8} />
                  <polygon points="0,-5 -2,1 2,1" fill="#2563EB" />
                </g>
              </svg>
            </div>

            {/* Position info */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>현재 위치</span>
                <span className="tabnum" style={{ fontSize: 11, color: '#172033', fontWeight: 600 }}>X {robotPos.x * 0.05 - 1.7 | 0}.{Math.abs(robotPos.x * 50 - 170) % 100}m</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Y</span>
                <span className="tabnum" style={{ fontSize: 11, color: '#172033', fontWeight: 600 }}>1.35m</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>Yaw</span>
                <span className="tabnum" style={{ fontSize: 11, color: '#172033', fontWeight: 600 }}>{robotPos.yaw}°</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>지도 해상도</span>
                <span className="tabnum" style={{ fontSize: 11, color: '#172033', fontWeight: 600 }}>0.05m/px</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10, color: '#94A3B8' }}>마지막 갱신</span>
                <span className="tabnum" style={{ fontSize: 11, color: '#172033', fontWeight: 600 }}>0.8초 전</span>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
              {[
                { color: '#FFFFFF', border: '#CBD5E1', label: '이동 가능' },
                { color: '#1E293B', border: '#1E293B', label: '장애물' },
                { color: '#94A3B8', border: '#94A3B8', label: '미확인 영역' },
                { color: '#2563EB', border: '#2563EB', label: 'TurtleBot 위치' },
                { color: '#DC2626', border: '#DC2626', label: '균열 위치' },
              ].map(({ color, border, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, border: `1px solid ${border}`, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: '#64748B' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: Controls + Log */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '4fr 8fr',
          gap: 14,
        }}>
          {/* ─── Controls Column ─── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Mini Robot Control */}
            <div style={{ ...card, padding: 14 }}>
              {sectionTitle('미니로봇 조작')}

              {(isMobile || isTablet) ? (
                <div style={{
                  background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8,
                  padding: '12px 14px', fontSize: 12, color: '#92400E',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}>
                  <Icon name="info" size={14} color="#D97706" />
                  로봇 조작은 데스크톱 환경에서만 사용할 수 있습니다.
                </div>
              ) : emergencyStop ? (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="stop" size={14} />
                  비상 정지가 활성화되었습니다.
                </div>
              ) : (
                <div ref={controlRef}>
                  {/* Activate toggle */}
                  <div style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => setControlActive(c => !c)}
                      style={{
                        width: '100%', padding: '7px 12px', borderRadius: 7, border: '1px solid',
                        borderColor: controlActive ? '#2563EB' : '#D8E1EB',
                        background: controlActive ? '#EFF6FF' : '#F8FAFC',
                        color: controlActive ? '#2563EB' : '#64748B',
                        fontWeight: 700, fontSize: 12, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}>
                      <Icon name={controlActive ? 'check' : 'robot'} size={14} />
                      {controlActive ? '키보드 조종 활성화' : '조종 활성화'}
                    </button>
                  </div>

                  {/* D-pad */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gridTemplateRows: 'repeat(3, 40px)', gap: 4, justifyContent: 'center', marginBottom: 10 }}>
                    <div />
                    <KeyboardKey label="W" active={isKeyActive(['w', 'arrowup'])} disabled={!controlActive} />
                    <div />
                    <KeyboardKey label="A" active={isKeyActive(['a', 'arrowleft'])} disabled={!controlActive} />
                    <KeyboardKey label="SPC" active={isKeyActive([' '])} disabled={!controlActive} />
                    <KeyboardKey label="D" active={isKeyActive(['d', 'arrowright'])} disabled={!controlActive} />
                    <div />
                    <KeyboardKey label="S" active={isKeyActive(['s', 'arrowdown'])} disabled={!controlActive} />
                    <div />
                  </div>

                  {/* Directions legend */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10, fontSize: 10, color: '#64748B' }}>
                    {[['W / ↑', '전진'], ['S / ↓', '후진'], ['A / ←', '좌회전'], ['D / →', '우회전'], ['Space', '정지']].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 4 }}>
                        <span style={{ fontFamily: 'JetBrains Mono', background: '#F1F5F9', padding: '1px 4px', borderRadius: 3 }}>{k}</span>
                        <span>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Speed */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: '#64748B' }}>
                      <span>속도</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn onClick={() => setSpeed(25)} variant={speed <= 30 ? 'primary' : 'default'} style={{ fontSize: 10, padding: '2px 6px' }}>저속</Btn>
                        <Btn onClick={() => setSpeed(75)} variant={speed > 30 ? 'primary' : 'default'} style={{ fontSize: 10, padding: '2px 6px' }}>보통</Btn>
                      </div>
                    </div>
                    <input type="range" min={0} max={100} value={speed} onChange={e => setSpeed(+e.target.value)}
                      disabled={!controlActive}
                      style={{ width: '100%', accentColor: '#2563EB' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      <span>0%</span>
                      <span className="tabnum" style={{ fontWeight: 700, color: '#2563EB' }}>{speed}%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, marginBottom: 10 }}>
                    {[
                      ['방향', getDirection()],
                      ['좌 모터', `${controlActive ? Math.round(speed * 0.9) : 0}%`],
                      ['우 모터', `${controlActive ? Math.round(speed * 0.88) : 0}%`],
                      ['지연', '84ms'],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: '#F8FAFC', borderRadius: 5, padding: '4px 8px', border: '1px solid #E8EEF5' }}>
                        <span style={{ color: '#94A3B8' }}>{k}</span>
                        <span className="tabnum" style={{ fontWeight: 700, color: '#172033' }}>{v}</span>
                      </div>
                    ))}
                  </div>

                  {/* Peripherals */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setLedOn(l => !l)} style={{
                      flex: 1, padding: '6px', borderRadius: 7, border: '1px solid',
                      borderColor: ledOn ? '#2563EB' : '#D8E1EB',
                      background: ledOn ? '#EFF6FF' : '#F8FAFC',
                      color: ledOn ? '#2563EB' : '#64748B',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      <Icon name="led" size={13} /> LED
                    </button>
                    <button onClick={() => setBuzzerOn(b => !b)} style={{
                      flex: 1, padding: '6px', borderRadius: 7, border: '1px solid',
                      borderColor: buzzerOn ? '#2563EB' : '#D8E1EB',
                      background: buzzerOn ? '#EFF6FF' : '#F8FAFC',
                      color: buzzerOn ? '#2563EB' : '#64748B',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}>
                      <Icon name="buzzer" size={13} /> 부저
                    </button>
                    <Btn style={{ flex: 1, fontSize: 11, padding: '6px', justifyContent: 'center' }}>
                      <Icon name="return" size={12} />복귀 명령
                    </Btn>
                  </div>

                  {controlActive && (
                    <p style={{ margin: '8px 0 0', fontSize: 10, color: '#94A3B8', textAlign: 'center' }}>
                      키를 놓으면 로봇이 정지합니다.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* TurtleBot Inspection Control */}
            <div style={{ ...card, padding: 14 }}>
              {sectionTitle('TurtleBot3 탐색 제어')}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
                padding: '6px 10px', background: '#EFF6FF', borderRadius: 7, border: '1px solid #BFDBFE',
              }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563EB', animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1D4ED8' }}>{navStateLabels[navState]}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <Btn variant="primary" disabled={emergencyStop} style={{ fontSize: 11 }}><Icon name="play" size={11} />탐색 시작</Btn>
                <Btn disabled={emergencyStop} style={{ fontSize: 11 }}><Icon name="pause" size={11} />일시 정지</Btn>
                <Btn disabled={emergencyStop} style={{ fontSize: 11 }}><Icon name="return" size={12} />기준 위치 복귀</Btn>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, fontSize: 11 }}>
                {[
                  ['현재 목표', 'WP-07'],
                  ['이동 속도', '0.18 m/s'],
                  ['잔여 경로', '3.2m'],
                  ['장애물 회피', '대기 중'],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: '#F8FAFC', border: '1px solid #E8EEF5', borderRadius: 5, padding: '4px 8px' }}>
                    <div style={{ fontSize: 10, color: '#94A3B8' }}>{k}</div>
                    <div className="tabnum" style={{ fontWeight: 700, color: '#172033', marginTop: 1 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Inspection Log ─── */}
          <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column' }}>
            {sectionTitle('균열 탐지 로그')}

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { label: '전체 균열', value: cracks.length, color: '#172033' },
                { label: '고위험 균열', value: cracks.filter(c => c.risk === 'high' || c.risk === 'critical').length, color: '#DC2626' },
                { label: '최근 탐지', value: '09:22:17', color: '#172033' },
                { label: '점검 진행률', value: '64%', color: '#2563EB' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#F8FAFC', border: '1px solid #E8EEF5', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, marginBottom: 3 }}>{label}</div>
                  <div className="tabnum" style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 160, background: '#F8FAFC', border: '1px solid #D8E1EB', borderRadius: 7, padding: '5px 10px' }}>
                <Icon name="search" size={13} color="#94A3B8" />
                <input value={searchId} onChange={e => setSearchId(e.target.value)}
                  placeholder="균열 ID 검색"
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, width: '100%', color: '#172033' }} />
              </div>
              <select value={filterRisk} onChange={e => setFilterRisk(e.target.value as any)}
                style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #D8E1EB', fontSize: 12, background: '#F8FAFC', color: '#172033', cursor: 'pointer' }}>
                <option value="all">전체 위험도</option>
                <option value="low">낮음</option>
                <option value="medium">보통</option>
                <option value="high">높음</option>
                <option value="critical">심각</option>
              </select>
              <Btn onClick={() => setSortBy('time')} variant={sortBy === 'time' ? 'primary' : 'default'} style={{ fontSize: 11 }}>최신순</Btn>
              <Btn onClick={() => setSortBy('risk')} variant={sortBy === 'risk' ? 'primary' : 'default'} style={{ fontSize: 11 }}>위험순</Btn>
            </div>

            {/* Table */}
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    {['균열 ID', '분류', 'X 좌표', 'Y 좌표', '현재 위험도', '예상 위험도', '변화율', '탐지 시간', '상태'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedCracks.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                          <Icon name="search" size={24} color="#CBD5E1" />
                          <span style={{ fontSize: 13, fontWeight: 500 }}>탐지된 균열이 없습니다.</span>
                          <span style={{ fontSize: 11 }}>로봇이 지하공간을 점검하고 있습니다.</span>
                        </div>
                      </td>
                    </tr>
                  ) : sortedCracks.map(c => {
                    const isSelected = c.id === selectedCrackId
                    return (
                      <tr key={c.id}
                        onClick={() => setSelectedCrackId(c.id)}
                        style={{
                          background: isSelected ? '#EFF6FF' : 'transparent',
                          borderBottom: '1px solid #F1F5F9',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="tabnum" style={{ fontWeight: 700, color: isSelected ? '#2563EB' : '#172033' }}>{c.id}</span>
                            {c.isNew && <span style={{ fontSize: 9, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '1px 4px', borderRadius: 3 }}>신규</span>}
                          </div>
                        </td>
                        <td style={{ padding: '7px 10px', color: '#475569', whiteSpace: 'nowrap' }}>{c.type}</td>
                        <td style={{ padding: '7px 10px' }}><span className="tabnum">{c.x.toFixed(2)}m</span></td>
                        <td style={{ padding: '7px 10px' }}><span className="tabnum">{c.y.toFixed(2)}m</span></td>
                        <td style={{ padding: '7px 10px' }}><RiskBadge risk={c.risk} score={c.currentRisk} /></td>
                        <td style={{ padding: '7px 10px' }}>
                          {c.predictedRisk !== null
                            ? <span className="tabnum" style={{ color: c.predictedRisk > c.currentRisk ? '#EA580C' : '#16A34A' }}>{c.predictedRisk}</span>
                            : <span style={{ color: '#94A3B8', fontSize: 11 }}>데이터 부족</span>
                          }
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <span className="tabnum" style={{ color: c.changeRate > 0 ? '#EA580C' : '#16A34A', fontWeight: 600 }}>
                            {c.changeRate > 0 ? '▲' : '▼'} {Math.abs(c.changeRate).toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ padding: '7px 10px' }}><span className="tabnum" style={{ color: '#64748B' }}>{c.detectedAt}</span></td>
                        <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
                            background: c.risk === 'critical' ? '#FEF2F2' : c.risk === 'high' ? '#FFF7ED' : c.risk === 'medium' ? '#FFFBEB' : '#F0FDF4',
                            color: c.risk === 'critical' ? '#DC2626' : c.risk === 'high' ? '#EA580C' : c.risk === 'medium' ? '#B45309' : '#16A34A',
                          }}>{c.status}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Row 3: Crack Details + Risk Trend */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr' : '5fr 7fr',
          gap: 14,
        }}>
          {/* ─── Crack Details ─── */}
          <div style={{ ...card, padding: 14 }}>
            {sectionTitle('균열 상세 정보')}

            {selectedCrack ? (
              <>
                {/* Image placeholder */}
                <div style={{
                  aspectRatio: '4/3', background: '#F8FAFC', borderRadius: 8,
                  border: '1px dashed #CBD5E1',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 6, marginBottom: 12,
                }}>
                  <Icon name="camera" size={28} color="#CBD5E1" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8' }}>균열 이미지</span>
                  <span style={{ fontSize: 11, color: '#CBD5E1' }}>탐지 이미지가 여기에 표시됩니다.</span>
                </div>

                {/* Detail grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
                  {[
                    ['균열 ID', selectedCrack.id],
                    ['분류', selectedCrack.type],
                    ['탐지 신뢰도', `${selectedCrack.confidence}%`],
                    ['균열 폭', selectedCrack.width],
                    ['X 좌표', `${selectedCrack.x.toFixed(2)}m`],
                    ['Y 좌표', `${selectedCrack.y.toFixed(2)}m`],
                    ['현재 위험도', `${selectedCrack.currentRisk}`],
                    ['예상 위험도', selectedCrack.predictedRisk !== null ? String(selectedCrack.predictedRisk) : '데이터 부족'],
                    ['변화율', `${selectedCrack.changeRate > 0 ? '+' : ''}${selectedCrack.changeRate}%`],
                    ['탐지 시간', selectedCrack.detectedAt],
                    ['최근 점검', selectedCrack.lastInspected],
                    ['로봇 ID', selectedCrack.robotId],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#F8FAFC', border: '1px solid #E8EEF5', borderRadius: 6, padding: '6px 8px' }}>
                      <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2 }}>{k}</div>
                      <div className="tabnum" style={{
                        fontSize: 12, fontWeight: 700, color:
                          k === '현재 위험도' ? riskColor[selectedCrack.risk] :
                          k === '예상 위험도' && selectedCrack.predictedRisk === null ? '#94A3B8' :
                          k === '변화율' && selectedCrack.changeRate > 0 ? '#EA580C' : '#172033'
                      }}>{v}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <RiskBadge risk={selectedCrack.risk} score={selectedCrack.currentRisk} />
                  <span style={{ fontSize: 11, color: '#64748B', padding: '2px 8px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E8EEF5' }}>{selectedCrack.status}</span>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Btn variant="outline" style={{ fontSize: 11 }}><Icon name="map" size={12} />지도에서 보기</Btn>
                  <Btn style={{ fontSize: 11 }}><Icon name="eye" size={12} />원본 프레임</Btn>
                  <Btn style={{ fontSize: 11 }}><Icon name="chart" size={12} />이전 점검 비교</Btn>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                <Icon name="info" size={24} color="#CBD5E1" />
                <p style={{ fontSize: 13, marginTop: 8 }}>균열을 선택하면 상세 정보가 표시됩니다.</p>
              </div>
            )}
          </div>

          {/* ─── Risk Trend ─── */}
          <div style={{ ...card, padding: 14 }}>
            {sectionTitle('위험도 변화 추이',
              selectedCrack ? <span className="tabnum" style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{selectedCrack.id} 선택됨</span> : undefined
            )}

            {/* Maintenance priority */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, alignSelf: 'center' }}>보수 우선순위:</span>
              {(['낮음', '보통', '높음', '긴급'] as const).map((label, i) => {
                const colors = ['#16A34A', '#F59E0B', '#EA580C', '#DC2626']
                const isActive = selectedCrack && (
                  (label === '긴급' && selectedCrack.risk === 'critical') ||
                  (label === '높음' && selectedCrack.risk === 'high') ||
                  (label === '보통' && selectedCrack.risk === 'medium') ||
                  (label === '낮음' && selectedCrack.risk === 'low')
                )
                return (
                  <span key={label} style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: isActive ? colors[i] + '20' : '#F8FAFC',
                    color: isActive ? colors[i] : '#94A3B8',
                    border: `1px solid ${isActive ? colors[i] + '40' : '#E2E8F0'}`,
                  }}>{label}</span>
                )
              })}
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8EEF5" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'JetBrains Mono' }} />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: '1px solid #D8E1EB', borderRadius: 6, background: '#FFFFFF' }}
                  labelStyle={{ fontWeight: 700, color: '#172033' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <ReferenceLine y={70} stroke="#EA580C" strokeDasharray="4 2" strokeWidth={1} label={{ value: '위험 임계', fill: '#EA580C', fontSize: 10 }} />
                <Line type="monotone" dataKey="prev" name="이전 점검" stroke="#2563EB" strokeWidth={2} dot={{ r: 4, fill: '#2563EB' }} connectNulls={false} />
                <Line type="monotone" dataKey="current" name="현재 점검" stroke="#EA580C" strokeWidth={2.5} dot={{ r: 5, fill: '#EA580C' }} connectNulls={false} />
                <Line type="monotone" dataKey="predicted" name="예상 위험도" stroke="#DC2626" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#DC2626' }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>

            {/* Inspection history labels */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
              {[
                { label: '현재 위험도', value: selectedCrack?.currentRisk, color: '#EA580C' },
                { label: '예상 위험도', value: selectedCrack?.predictedRisk, color: '#DC2626' },
                { label: '변화율', value: selectedCrack ? `+${selectedCrack.changeRate}%` : null, color: '#EA580C' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, background: '#F8FAFC', border: '1px solid #E8EEF5', borderRadius: 7, padding: '7px 10px' }}>
                  <span style={{ fontSize: 10, color: '#94A3B8' }}>{label}</span>
                  <span className="tabnum" style={{ fontSize: 16, fontWeight: 800, color: value !== null && value !== undefined ? color : '#94A3B8' }}>
                    {value !== null && value !== undefined ? value : '데이터 부족'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        tr:hover { background: #F8FAFC !important; }
        button:hover:not(:disabled) { filter: brightness(0.96); }
      `}</style>
    </div>
  )
}
