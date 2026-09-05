import { useCallback, useEffect, useMemo, useState } from 'react'

export interface Pose2D {
  x: number
  y: number
  yaw: number
  frame_id: string
  map_version: string | null
  timestamp: string
}

export interface RobotStatus {
  ros_connected?: boolean
  map_available?: boolean
  tf_available?: boolean
  localization_available?: boolean
  localization_method?: 'amcl' | 'slam_toolbox' | 'unknown' | 'none'
  map_version?: string | null
  control_available?: boolean
  [key: string]: unknown
}

export interface MapState {
  width: number
  height: number
  resolution: number
  origin_x: number
  origin_y: number
  origin_yaw: number
  frame_id: string
  timestamp: string
  version: string
  image_url: string
}

export interface RobotState {
  robot_id: string
  online: boolean
  last_seen: string | null
  pose: Pose2D | null
  map: MapState | null
  status: RobotStatus
}

interface DashboardEvent {
  type: string
  robot_id: string
  data: unknown
}

export interface MapPoint {
  left: number
  top: number
  rotation: number
  inside: boolean
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000')
  .replace(/\/$/, '')

export const configuredRobotIds = (import.meta.env.VITE_ROBOT_IDS || 'TB3-01')
  .split(',')
  .map((robotId: string) => robotId.trim())
  .filter(Boolean)

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export function dashboardUrl(robotId: string): string {
  const url = new URL(apiBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `/ws/dashboard/${encodeURIComponent(robotId)}`
  url.search = ''
  return url.toString()
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(apiUrl(path))
  if (!response.ok) {
    throw new Error(response.status === 404 ? '저장된 SLAM 지도가 없습니다.' : '백엔드에 연결할 수 없습니다.')
  }
  return response.json() as Promise<T>
}

function emptyRobotState(robotId: string): RobotState {
  return {
    robot_id: robotId,
    online: false,
    last_seen: null,
    pose: null,
    map: null,
    status: {},
  }
}

export function mapImageUrl(map: MapState): string {
  return apiUrl(map.image_url)
}

export function projectPoseToMap(map: MapState, pose: Pose2D): MapPoint {
  const deltaX = pose.x - map.origin_x
  const deltaY = pose.y - map.origin_y
  const cos = Math.cos(map.origin_yaw)
  const sin = Math.sin(map.origin_yaw)
  const localX = cos * deltaX + sin * deltaY
  const localY = -sin * deltaX + cos * deltaY
  const pixelX = localX / map.resolution
  const pixelY = map.height - 1 - localY / map.resolution
  const widthScale = Math.max(map.width - 1, 1)
  const heightScale = Math.max(map.height - 1, 1)

  return {
    left: (pixelX / widthScale) * 100,
    top: (pixelY / heightScale) * 100,
    rotation: 90 - ((pose.yaw - map.origin_yaw) * 180) / Math.PI,
    inside: pixelX >= 0 && pixelX <= widthScale && pixelY >= 0 && pixelY <= heightScale,
  }
}

export function useRobotMap() {
  const [map, setMap] = useState<MapState | null>(null)
  const [robotsById, setRobotsById] = useState<Record<string, RobotState>>(() =>
    Object.fromEntries(configuredRobotIds.map((robotId: string) => [robotId, emptyRobotState(robotId)])),
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [backendOnline, setBackendOnline] = useState(false)
  const [reloadCount, setReloadCount] = useState(0)

  const updateRobot = useCallback((robotId: string, update: Partial<RobotState>) => {
    setRobotsById((previous) => ({
      ...previous,
      [robotId]: { ...(previous[robotId] ?? emptyRobotState(robotId)), ...update },
    }))
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    const load = async () => {
      try {
        const currentMap = await getJson<MapState>('/api/v1/maps/current')
        const states = await Promise.all(configuredRobotIds.map(async (robotId: string) => {
          try {
            return await getJson<RobotState>(`/api/v1/robots/${encodeURIComponent(robotId)}/state`)
          } catch {
            return emptyRobotState(robotId)
          }
        }))
        if (!active) return
        setMap(currentMap)
        setRobotsById(Object.fromEntries(states.map((state) => [state.robot_id, state])))
        setBackendOnline(true)
      } catch (reason) {
        if (!active) return
        setBackendOnline(false)
        setError(reason instanceof Error ? reason.message : '지도 정보를 불러오지 못했습니다.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => { active = false }
  }, [reloadCount])

  useEffect(() => {
    let disposed = false
    const sockets = new Map<string, WebSocket>()
    const reconnectTimers = new Map<string, number>()

    const connect = (robotId: string) => {
      if (disposed) return
      const socket = new WebSocket(dashboardUrl(robotId))
      sockets.set(robotId, socket)

      socket.onopen = () => {
        setBackendOnline(true)
        setError((current) => current === '백엔드에 연결할 수 없습니다.' ? null : current)
      }
      socket.onmessage = (message) => {
        const event = JSON.parse(message.data) as DashboardEvent
        if (event.type === 'state.snapshot') {
          const state = event.data as RobotState
          updateRobot(robotId, state)
          if (state.map) {
            setMap(state.map)
            setError(null)
          }
        } else if (event.type === 'robot.connection') {
          updateRobot(robotId, event.data as Partial<RobotState>)
        } else if (event.type === 'robot.pose') {
          updateRobot(robotId, { pose: event.data as Pose2D })
        } else if (event.type === 'robot.status') {
          updateRobot(robotId, { status: event.data as RobotStatus })
        }
      }
      socket.onclose = () => {
        sockets.delete(robotId)
        if (!disposed) {
          reconnectTimers.set(robotId, window.setTimeout(() => connect(robotId), 2000))
        }
      }
    }

    configuredRobotIds.forEach(connect)
    return () => {
      disposed = true
      reconnectTimers.forEach(window.clearTimeout)
      sockets.forEach((socket) => socket.close())
    }
  }, [updateRobot])

  const robots = useMemo(
    () => configuredRobotIds.map((robotId: string) => robotsById[robotId] ?? emptyRobotState(robotId)),
    [robotsById],
  )

  return {
    map,
    robots,
    loading,
    error,
    backendOnline,
    reload: () => setReloadCount((count) => count + 1),
  }
}
