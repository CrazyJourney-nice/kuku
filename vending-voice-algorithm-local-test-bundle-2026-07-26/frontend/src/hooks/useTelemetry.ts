import { useEffect, useRef, useState } from "react";
import { decodeFramePacket, telemetryUrl } from "../api";
import type { DemoFramePacket } from "../contracts";
import { makeFixturePacket } from "../fixture";
export type ConnectionState = "CONNECTING" | "CONNECTED" | "STALE" | "ERROR" | "FIXTURE";
export function useTelemetry() {
  const fixture = new URLSearchParams(location.search).get("fixture") === "1" || import.meta.env.VITE_UI_FIXTURE === "1";
  const [packet,setPacket] = useState<DemoFramePacket|null>(fixture ? makeFixturePacket() : null);
  const [connection,setConnection] = useState<ConnectionState>(fixture ? "FIXTURE" : "CONNECTING");
  const [error,setError] = useState<string|null>(null);
  const last = useRef(0);
  useEffect(() => {
    if (fixture) { const id=setInterval(()=>setPacket(p=>makeFixturePacket((p?.frame_id??1842)+1)),250); return ()=>clearInterval(id); }
    let disposed=false, socket:WebSocket|null=null, retry:number|undefined, attempt=0;
    const connect=()=>{
      if(disposed)return; setConnection("CONNECTING"); socket=new WebSocket(telemetryUrl()); socket.binaryType="arraybuffer";
      socket.onopen=()=>{attempt=0;last.current=performance.now();setConnection("CONNECTED");setError(null)};
      socket.onmessage=e=>{try{if(!(e.data instanceof ArrayBuffer))throw new Error("Expected binary MessagePack telemetry.");const p=decodeFramePacket(e.data);last.current=performance.now();setPacket(p);setConnection("CONNECTED");setError(null)}catch(c){setConnection("ERROR");setError(c instanceof Error?c.message:"Invalid telemetry packet.")}};
      socket.onerror=()=>{setConnection("ERROR");setError("Local telemetry connection failed.")};
      socket.onclose=()=>{if(disposed)return;setConnection("ERROR");setError("Local telemetry disconnected. Reconnecting…");retry=window.setTimeout(connect,Math.min(4000,400*2**attempt++))};
    }; connect();
    const stale=setInterval(()=>{if(last.current>0&&performance.now()-last.current>900)setConnection("STALE")},250);
    return()=>{disposed=true;clearInterval(stale);if(retry)clearTimeout(retry);socket?.close()};
  },[fixture]);
  return {packet,connection,error,isFixture:fixture};
}
