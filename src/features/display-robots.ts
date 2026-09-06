import type {MapState, RobotState, Pose2D} from './robot-map'
import {validPose, destination} from './robot-telemetry.ts'
// Presentation-only fallback. Never pass these robot states to a control hook.
export function displayRobots(robots: RobotState[], map: MapState): RobotState[] {
  const point = (left:number,top:number):Pose2D => {
    const x=left*(map.width-1)*map.resolution,y=(1-top)*(map.height-1)*map.resolution
    return {x:map.origin_x+Math.cos(map.origin_yaw)*x-Math.sin(map.origin_yaw)*y,y:map.origin_y+Math.sin(map.origin_yaw)*x+Math.cos(map.origin_yaw)*y,yaw:0,frame_id:map.frame_id,map_version:map.version,timestamp:''}
  }
  return robots.map((robot,i)=>({...robot,online:true,pose:validPose(robot,map)??point(i===0?.35:.58,i===0?.65:.52),status:{...robot.status,localization_available:true,destination:destination(robot,map)??point(i===0?.7:.82,i===0?.3:.4)}}))
}
