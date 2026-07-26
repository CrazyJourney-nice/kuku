#!/usr/bin/env python3
from __future__ import annotations
import argparse, math, shutil, struct, subprocess, tempfile, wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUTPUT=ROOT/"demo_assets"/"audio"/"welcome.wav"
def valid(path):
    try:
        with wave.open(str(path),"rb") as f:return f.getnframes()>0 and f.getframerate()>=16000
    except Exception:return False
def chime():
    rate=22050; frames=bytearray()
    for i in range(int(rate*.75)):
        t=i/rate; env=min(1,t/.04)*max(0,1-t/.75)
        v=sum(math.sin(2*math.pi*f*t) for f in (523.25,659.25,783.99))/3
        frames.extend(struct.pack("<h",int(10000*env*v)))
    with wave.open(str(OUTPUT),"wb") as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(frames)
def main():
    p=argparse.ArgumentParser();p.add_argument("--force",action="store_true");a=p.parse_args()
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    if valid(OUTPUT) and not a.force:return 0
    OUTPUT.unlink(missing_ok=True); spoken=False
    if shutil.which("say") and shutil.which("afconvert"):
        try:
            with tempfile.TemporaryDirectory() as temp:
                aiff=Path(temp)/"welcome.aiff"
                subprocess.run(["say","-v","Samantha","-o",str(aiff),"Welcome. Please take a look."],check=True)
                subprocess.run(["afconvert","-f","WAVE","-d","LEI16@22050",str(aiff),str(OUTPUT)],check=True)
            spoken=valid(OUTPUT)
        except Exception:OUTPUT.unlink(missing_ok=True)
    if not spoken:chime();print("Generated local non-speech chime fallback.")
    else:print("Generated local macOS welcome voice.")
    return 0
if __name__=="__main__":raise SystemExit(main())
