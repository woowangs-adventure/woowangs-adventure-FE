import { useEffect, useRef, useState } from 'react'
import { apiUrl, dashboardUrl } from '@/features/robot-map'

type ControlState = 'disabled' | 'connecting' | 'acquiring' | 'ready' | 'error'

interface ControlCapabilities {
  enabled: boolean
  ttl_ms: number
}

interface UseRobotControlOptions {
  robotId: string
  enabled: boolean
  robotOnline: boolean
  speedPercent: number
  activeKeys: Set<string>
}

function pressed(keys: Set<string>, ...candidates: string[]) {
  return candidates.some((key) => keys.has(key))
}

export function velocityFromKeys(keys: Set<string>, speedPercent: number) {
  if (keys.has(' ')) return { linear: 0, angular: 0, stop: true }
  const scale = Math.max(0, Math.min(100, speedPercent)) / 100
  const linear = Number(pressed(keys, 'w', 'arrowup')) - Number(pressed(keys, 's', 'arrowdown'))
  const angular = Number(pressed(keys, 'a', 'arrowleft')) - Number(pressed(keys, 'd', 'arrowright'))
  return { linear: linear * scale, angular: angular * scale, stop: false }
}

export function useRobotControl({
  robotId,
  enabled,
  robotOnline,
  speedPercent,
  activeKeys,
}: UseRobotControlOptions) {
  const [serverEnabled, setServerEnabled] = useState(false)
  const [ttlMs, setTtlMs] = useState(300)
  const [state, setState] = useState<ControlState>('disabled')
  const [error, setError] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const keysRef = useRef(activeKeys)
  const speedRef = useRef(speedPercent)

  useEffect(() => { keysRef.current = activeKeys }, [activeKeys])
  useEffect(() => { speedRef.current = speedPercent }, [speedPercent])

  useEffect(() => {
    let active = true
    fetch(apiUrl('/api/v1/control/capabilities'))
      .then(async (response) => {
        if (!response.ok) throw new Error('조작 기능 정보를 확인할 수 없습니다.')
        return response.json() as Promise<ControlCapabilities>
      })
      .then((capabilities) => {
        if (!active) return
        setServerEnabled(capabilities.enabled)
        setTtlMs(capabilities.ttl_ms)
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '조작 기능 확인 실패')
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!enabled || !serverEnabled || !robotOnline) {
      setState('disabled')
      return
    }

    let disposed = false
    let acquired = false
    const pendingCommands = new Map<string, number>()
    const socket = new WebSocket(dashboardUrl(robotId))
    setState('connecting')
    setError(null)

    const send = (type: string, data: Record<string, unknown> = {}) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type, data }))
      }
    }

    socket.onopen = () => {
      setState('acquiring')
      send('control.acquire')
    }
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as { type: string; data?: Record<string, unknown> }
      if (event.type === 'control.acquired') {
        acquired = true
        setState('ready')
      } else if (event.type === 'control.sent') {
        const commandId = event.data?.command_id
        if (typeof commandId === 'string') pendingCommands.set(commandId, performance.now())
      } else if (event.type === 'robot.control_ack') {
        const commandId = event.data?.command_id
        if (typeof commandId === 'string') {
          const sentAt = pendingCommands.get(commandId)
          if (sentAt !== undefined) {
            setLatencyMs(Math.round(performance.now() - sentAt))
            pendingCommands.delete(commandId)
          }
        }
      } else if (event.type === 'error') {
        acquired = false
        setState('error')
        setError(String(event.data?.message ?? '로봇 조작 명령이 거부되었습니다.'))
      }
    }
    socket.onerror = () => {
      setState('error')
      setError('로봇 조작 WebSocket에 연결할 수 없습니다.')
    }
    socket.onclose = () => {
      if (!disposed) {
        acquired = false
        setState('error')
        setError('로봇 조작 연결이 끊겼습니다. 조종을 다시 활성화하세요.')
      }
    }

    const timer = window.setInterval(() => {
      if (!acquired) return
      const velocity = velocityFromKeys(keysRef.current, speedRef.current)
      if (velocity.stop) {
        send('control.stop')
      } else {
        send('control.velocity', {
          linear: velocity.linear,
          angular: velocity.angular,
          ttl_ms: ttlMs,
        })
      }
    }, 100)

    const stopOnBlur = () => {
      if (acquired) send('control.stop')
    }
    window.addEventListener('blur', stopOnBlur)

    return () => {
      disposed = true
      window.clearInterval(timer)
      window.removeEventListener('blur', stopOnBlur)
      if (socket.readyState === WebSocket.OPEN && acquired) {
        send('control.stop')
        send('control.release')
      }
      socket.close()
    }
  }, [enabled, robotId, robotOnline, serverEnabled, ttlMs])

  return { serverEnabled, state, error, latencyMs }
}
