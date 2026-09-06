import test from "node:test"
import assert from "node:assert/strict"
import {
  riskLevel,
  percent,
  inspectionStats,
  DEMO_CRACKS,
  dateKey,
} from "../src/features/inspection.ts"
import {
  validPose,
  destination,
  navigationProgress,
} from "../src/features/robot-telemetry.ts"
import type { MapState, RobotState } from "../src/features/robot-map.ts"
test("risk boundaries use four 25% intervals without accepting invalid values", () => {
  for (const [v, expected] of [
    [0, "low"],
    [0.2499, "low"],
    [0.25, "medium"],
    [0.4999, "medium"],
    [0.5, "high"],
    [0.7499, "high"],
    [0.75, "critical"],
    [1, "critical"],
  ] as const)
    assert.equal(riskLevel(v), expected)
  for (const v of [null, NaN, Infinity, -0.1, 1.1]) {
    assert.equal(riskLevel(v), null)
    assert.equal(percent(v), "—")
  }
  assert.equal(percent(0.681), "68.1%")
  assert.equal(percent(0.2499), "24.99%")
})
test("statistics aggregate records, exclude unknown areas and zero-fill missing dates", () => {
  const stats = inspectionStats(DEMO_CRACKS)
  assert.equal(stats.total, 5)
  assert.equal(stats.high, 3)
  assert.ok(Math.abs(stats.averageArea! - 0.0282) < 1e-10)
  assert.deepEqual(
    stats.distribution.map((d) => d.count),
    [1, 1, 2, 1],
  )
  assert.deepEqual(
    stats.trend.map((d) => d.count),
    [1, 0, 1, 1, 2],
  )
  assert.equal(inspectionStats([]).averageArea, null)
  assert.equal(
    inspectionStats([{ ...DEMO_CRACKS[0], areaM2: null, risk: null }]).unknown,
    1,
  )
  for (const areaM2 of [null, NaN, Infinity, -1]) {
    assert.equal(inspectionStats([{ ...DEMO_CRACKS[0], areaM2 }]).averageArea, null)
  }
  assert.equal(dateKey("2026-09-05T16:00:00Z"), "2026-09-06")
})
const map = {
  width: 94,
  height: 70,
  resolution: 0.05,
  origin_x: -1.87,
  origin_y: -0.859,
  origin_yaw: 0,
  frame_id: "map",
  timestamp: "",
  version: "new",
  image_url: "",
} satisfies MapState
const robot: RobotState = {
  robot_id: "TB3-01",
  online: true,
  last_seen: null,
  map,
  pose: {
    x: 0,
    y: 0,
    yaw: 0,
    frame_id: "map",
    map_version: "new",
    timestamp: "",
  },
  status: { localization_available: true },
}
test("robot markers require online, localized, matching-frame and matching-version poses", () => {
  assert.ok(validPose(robot, map))
  assert.equal(validPose({ ...robot, online: false }, map), null)
  assert.equal(validPose({ ...robot, status: {} }, map), null)
  assert.equal(validPose(robot, { ...map, version: "old" }), null)
  assert.equal(validPose(robot, { ...map, frame_id: "odom" }), null)
})
test("missing destination and progress are not fabricated", () => {
  assert.equal(destination(robot, map), null)
  assert.equal(navigationProgress(robot), null)
  const state = {
    ...robot,
    status: {
      destination: { x: 1, y: 1, frame_id: "map", map_version: "new" },
      navigation_progress: 0.42,
    },
  }
  assert.ok(destination(state, map))
  assert.equal(navigationProgress(state), 42)
  assert.equal(destination(state, { ...map, version: "old" }), null)
  assert.equal(
    navigationProgress({ ...state, status: { navigation_progress: 42 } }),
    null,
  )
})

test('display-only fallback preserves live control state', async () => {
  const {displayRobots}=await import('../src/features/display-robots.ts')
  const disconnected={...robot,online:false,pose:null,status:{}}
  const displayed=displayRobots([disconnected],map)[0]
  assert.ok(displayed.pose)
  assert.equal(displayed.pose?.map_version,map.version)
  assert.ok(displayed.status.destination)
  assert.equal(disconnected.online,false)
  assert.equal(disconnected.pose,null)
})
