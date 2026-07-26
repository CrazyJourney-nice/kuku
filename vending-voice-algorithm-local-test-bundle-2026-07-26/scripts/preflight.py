#!/usr/bin/env python3
from __future__ import annotations
import importlib, json, os, shutil, subprocess, sys, wave
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def result(name:str,passed:bool,detail:str)->dict: return {"name":name,"passed":bool(passed),"detail":detail}
def main()->int:
    skip_camera="--skip-camera" in sys.argv[1:]
    checks=[result("python",(3,11)<=sys.version_info[:2]<(3,13),sys.version.split()[0]),
            result("openvino_telemetry_opt_out",os.environ.get("OPENVINO_TELEMETRY_OPT_OUT")=="1",repr(os.environ.get("OPENVINO_TELEMETRY_OPT_OUT")))]
    modules={}
    for name in ("cv2","mediapipe","openvino","fastapi","msgpack"):
        try:
            modules[name]=importlib.import_module(name); checks.append(result(f"import_{name}",True,str(getattr(modules[name],"__version__","available"))))
        except Exception as exc: checks.append(result(f"import_{name}",False,str(exc)))
    assets=subprocess.run([sys.executable,str(ROOT/"scripts"/"assets.py"),"verify"],capture_output=True,text=True)
    checks.append(result("asset_hashes",assets.returncode==0,(assets.stdout+assets.stderr).strip()))
    gaze=ROOT/"models"/"gaze-estimation-adas-0002.xml"
    if "openvino" in modules and gaze.is_file():
        try:
            core=modules["openvino"].Core(); core.compile_model(core.read_model(gaze),"CPU")
            checks.append(result("gaze_model_compile",True,"OpenVINO CPU"))
        except Exception as exc: checks.append(result("gaze_model_compile",False,str(exc)))
    face=ROOT/"models"/"face_landmarker.task"
    if "mediapipe" in modules and face.is_file():
        try:
            mp=modules["mediapipe"]; options=mp.tasks.vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(face)),
                running_mode=mp.tasks.vision.RunningMode.IMAGE,num_faces=4)
            landmarker=mp.tasks.vision.FaceLandmarker.create_from_options(options); landmarker.close()
            checks.append(result("face_model_load",True,"MediaPipe local task"))
        except Exception as exc: checks.append(result("face_model_load",False,str(exc)))
    else: checks.append(result("face_model_load",False,str(face)))
    for clip in ("proximity_greeting", "quick_buy_prompt", "order_thanks"):
        audio=ROOT/"demo_assets"/"audio"/f"{clip}.wav"
        try:
            with wave.open(str(audio),"rb") as f: ok=f.getnframes()>0; detail=f"{f.getframerate()} Hz"
        except Exception as exc: ok=False; detail=str(exc)
        checks.append(result(f"local_audio_{clip}",ok,detail))
    checks.append(result("local_audio_player",shutil.which("afplay") is not None,"afplay"))
    if not skip_camera and "cv2" in modules:
        cv2=modules["cv2"]; camera=cv2.VideoCapture(0,getattr(cv2,"CAP_AVFOUNDATION",0))
        ok,frame=camera.read() if camera.isOpened() else (False,None); camera.release()
        checks.append(result("camera",bool(ok and frame is not None),"camera frame acquired" if ok else "CAMERA_UNAVAILABLE"))
    checks.append(result("frontend_build",(ROOT/"frontend"/"dist"/"index.html").is_file(),str(ROOT/"frontend"/"dist"/"index.html")))
    output={"ready":all(c["passed"] for c in checks),"mode":"live","results":checks}
    print(json.dumps(output,indent=2)); return 0 if output["ready"] else 1
if __name__=="__main__": raise SystemExit(main())
