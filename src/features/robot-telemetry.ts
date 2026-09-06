import type { MapState, Pose2D, RobotState } from "./robot-map"
export function validPose(robot: RobotState, map: MapState): Pose2D | null {
  const p = robot.pose
  return robot.online &&
    robot.status.localization_available === true &&
    p &&
    p.frame_id === map.frame_id &&
    p.map_version === map.version &&
    [p.x, p.y, p.yaw].every(Number.isFinite)
    ? p
    : null
}
// Optional future telemetry; do not synthesize destinations or mission progress.
export function destination(robot: RobotState, map: MapState): Pose2D | null {
  const value = robot.status.destination
  if (!robot.online || !value || typeof value !== "object") return null
  const p = value as Partial<Pose2D>
  if (
    typeof p.x !== "number" ||
    typeof p.y !== "number" ||
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    p.frame_id !== map.frame_id ||
    p.map_version !== map.version
  )
    return null
  return {
    x: p.x,
    y: p.y,
    yaw: 0,
    frame_id: map.frame_id,
    map_version: map.version,
    timestamp: "",
  }
}
export function navigationProgress(robot?: RobotState): number | null {
  const v = robot?.status.navigation_progress
  return robot?.online &&
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 1
    ? v * 100
    : null
}
