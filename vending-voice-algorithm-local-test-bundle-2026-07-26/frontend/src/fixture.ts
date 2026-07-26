import type { DemoFramePacket } from "./contracts";
export const TEST_FIXTURE_NOTICE = "TEST FIXTURE — synthetic packet for UI development only; not a model result.";
export function makeFixturePacket(frameId = 1842): DemoFramePacket {
  const pulse = (frameId % 40) / 40;
  return {
    frame_id: frameId, source_timestamp_ms: performance.now(), processed_timestamp_ms: performance.now() + 68,
    mode: "LIVE", image_jpeg: new Uint8Array(),
    tracks: [
      { track_id: 17, bbox: [0.2 + pulse*.025,.18,.25,.58], face_confidence:.96, face_width_px:186,
        raw_head_pose:{yaw:-4.8,pitch:2.1,roll:.7}, filtered_head_pose:{yaw:-3.2,pitch:1.4,roll:.5},
        gaze:{x:.08,y:-.04}, motion:.04, dwell_ms:1080, attention_score:.91, state:"ATTENDING", reason:"VALID_ATTENTION", selected:true, stale:false },
      { track_id: 22, bbox:[.66,.25,.18,.46], face_confidence:.89, face_width_px:132,
        raw_head_pose:{yaw:22.4,pitch:6.4,roll:-1.2}, filtered_head_pose:{yaw:20.1,pitch:5.7,roll:-.8},
        gaze:{x:.52,y:.14}, motion:.11, dwell_ms:240, attention_score:.38, state:"TRACKING", reason:"GAZE_OUTSIDE_ROI", selected:false, stale:false }
    ],
    visual_target_id:17, visual_target_reason:"CURRENT_TARGET_LOCK",
    selected_target_id:17, attention_state:"ATTENDING",
    proximity:{state:"NEAR",track_id:17,face_width_ratio:.25,entered:false,episode_id:"proximity-42",reason:"NEAR_HELD"},
    mascot_state:{command_id:"eye-1842",target:{x:-.22+pulse*.05,y:-.06},moving:false,settled:true,started_at_ms:1000,settled_at_ms:1300},
    voice_event:{event_id:"voice-demo-01",status:"PLAYED",clip_id:"welcome",episode_id:"episode-42",played_at_ms:1400},
    voice_journey:{
      interaction_id:"proximity-42",state:"FOLLOWED_UP",triggered_stage:null,
      proximity_greeting_triggered:false,attention_followup_triggered:false,
      completed_stages:["PROXIMITY_GREETING","ATTENTION_FOLLOW_UP"],attention_dwell_ms:15000
    },
    trigger_reason:"VALID_ATTENTION", rejection_reason:"GAZE_OUTSIDE_ROI",
    stage_latency_ms:{capture:4.1,face:16.8,tracking:1.6,head_pose:2.4,gaze:28.3,decision:.9,frame_age:68.1},
    fps:{capture:29.8,processed:20.4}, dropped_frames:31, queue_depth:1, stale_fields:[]
  };
}
