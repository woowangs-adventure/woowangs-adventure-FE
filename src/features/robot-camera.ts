import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiUrl } from '@/features/robot-map'

export type CameraSource = 'live' | 'recorded' | 'empty'
type CameraMode = 'auto' | 'webrtc' | 'recorded'

export interface RecordedVideo {
  robot_id: string
  mode: 'recorded'
  content_type: 'video/mp4' | 'video/webm'
  original_filename: string
  size_bytes: number
  version: string
  uploaded_at: string
  content_url: string
}

interface SignalMessage {
  type: string
  data?: {
    role?: string
    online?: boolean
    sdp?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
  }
}

const configuredMode = (import.meta.env.VITE_CAMERA_MODE || 'auto') as CameraMode

export const cameraRobotId = import.meta.env.VITE_CAMERA_ROBOT_ID || 'MINI-01'

function signalingUrl(robotId: string): string {
  const baseUrl = new URL(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000')
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  baseUrl.pathname = `/ws/webrtc/${encodeURIComponent(robotId)}/viewer`
  baseUrl.search = ''
  return baseUrl.toString()
}

function iceServers(): RTCIceServer[] {
  const urls = (import.meta.env.VITE_WEBRTC_ICE_SERVERS || '')
    .split(',')
    .map((url: string) => url.trim())
    .filter(Boolean)
  return urls.length > 0 ? [{ urls }] : []
}

export function recordedVideoUrl(video: RecordedVideo): string {
  return apiUrl(video.content_url)
}

export function useRobotCamera(robotId: string) {
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)
  const [signalingConnected, setSignalingConnected] = useState(false)
  const [publisherOnline, setPublisherOnline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadCount, setReloadCount] = useState(0)

  const loadRecordedVideo = useCallback(async () => {
    try {
      const response = await fetch(apiUrl(`/api/v1/robots/${encodeURIComponent(robotId)}/video`))
      if (response.status === 404) {
        setRecordedVideo(null)
        return
      }
      if (!response.ok) throw new Error('저장 영상을 불러오지 못했습니다.')
      setRecordedVideo(await response.json() as RecordedVideo)
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '영상 API에 연결할 수 없습니다.')
    }
  }, [robotId])

  useEffect(() => {
    void loadRecordedVideo()
    const timer = window.setInterval(() => void loadRecordedVideo(), 15_000)
    return () => window.clearInterval(timer)
  }, [loadRecordedVideo, reloadCount])

  useEffect(() => {
    if (configuredMode === 'recorded') return

    let disposed = false
    let socket: WebSocket | null = null
    let peer: RTCPeerConnection | null = null
    let reconnectTimer: number | null = null

    const closePeer = () => {
      peer?.close()
      peer = null
      setLiveStream(null)
    }

    const send = (type: string, data: Record<string, unknown>) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, data }))
    }

    const startOffer = async () => {
      closePeer()
      peer = new RTCPeerConnection({ iceServers: iceServers() })
      peer.addTransceiver('video', { direction: 'recvonly' })
      peer.addTransceiver('audio', { direction: 'recvonly' })
      peer.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track])
        setLiveStream(stream)
        setError(null)
      }
      peer.onicecandidate = (event) => {
        if (event.candidate) send('webrtc.ice', { candidate: event.candidate.toJSON() })
      }
      peer.onconnectionstatechange = () => {
        if (peer?.connectionState === 'failed' || peer?.connectionState === 'closed') {
          closePeer()
        }
      }
      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)
      send('webrtc.offer', { sdp: offer })
    }

    const connect = () => {
      if (disposed) return
      socket = new WebSocket(signalingUrl(robotId))
      socket.onopen = () => {
        setSignalingConnected(true)
        setError(null)
        send('webrtc.ready', {})
      }
      socket.onmessage = (event) => {
        void (async () => {
          try {
            const message = JSON.parse(event.data) as SignalMessage
            if (message.type === 'webrtc.peer' && message.data?.role === 'publisher') {
              const online = message.data.online === true
              setPublisherOnline(online)
              if (online) await startOffer()
              else closePeer()
            } else if (message.type === 'webrtc.answer' && message.data?.sdp && peer) {
              await peer.setRemoteDescription(message.data.sdp)
            } else if (message.type === 'webrtc.ice' && message.data?.candidate && peer) {
              await peer.addIceCandidate(message.data.candidate)
            }
          } catch {
            setError('실시간 영상 연결 협상에 실패했습니다.')
          }
        })()
      }
      socket.onclose = () => {
        setSignalingConnected(false)
        setPublisherOnline(false)
        closePeer()
        if (!disposed) reconnectTimer = window.setTimeout(connect, 2_000)
      }
      socket.onerror = () => {
        if (!disposed) setError('실시간 영상 서버에 연결할 수 없습니다.')
      }
    }

    connect()
    return () => {
      disposed = true
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
      socket?.close()
      closePeer()
    }
  }, [robotId])

  const source: CameraSource = liveStream
    ? 'live'
    : configuredMode !== 'webrtc' && recordedVideo ? 'recorded' : 'empty'

  return useMemo(() => ({
    source,
    liveStream,
    recordedVideo,
    signalingConnected,
    publisherOnline,
    error,
    reload: () => setReloadCount((count) => count + 1),
  }), [source, liveStream, recordedVideo, signalingConnected, publisherOnline, error])
}
