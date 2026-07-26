#!/usr/bin/env python3
from __future__ import annotations
import argparse,hashlib,json,os,shutil,tempfile,urllib.parse,urllib.request
from datetime import datetime,timezone
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; SOURCE=ROOT/"assets"/"manifest.json"; RUNTIME=ROOT/"runtime"/"asset-manifest.json"
HOSTS={"storage.googleapis.com","storage.openvinotoolkit.org"}
def sha(path):
    h=hashlib.sha256()
    with path.open("rb") as f:
        for b in iter(lambda:f.read(1048576),b""):h.update(b)
    return h.hexdigest()
def data():return json.loads(SOURCE.read_text(encoding="utf-8"))
def target(rel):
    path=(ROOT/rel).resolve()
    if ROOT not in path.parents:raise ValueError("asset path escapes project")
    return path
def write_runtime(source):
    out={"schema_version":1,"generated_at":datetime.now(timezone.utc).isoformat(),"offline_runtime":True,"assets":[]}
    for item in source["assets"]:
        path=target(item["path"]);actual=sha(path) if path.is_file() else None;copy=dict(item)
        copy["actual_sha256"]=actual;copy["verified"]=bool(actual and (not item.get("sha256") or actual==item["sha256"]));out["assets"].append(copy)
    RUNTIME.parent.mkdir(parents=True,exist_ok=True);RUNTIME.write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8");return out
def fetch():
    source=data()
    for item in source["assets"]:
        path=target(item["path"]);expected=item.get("sha256");url=item["source_url"]
        if url=="locally-generated":
            if not path.is_file():raise RuntimeError(f"missing local asset: {item['path']}")
            if expected and sha(path)!=expected:raise RuntimeError(f"hash mismatch: {item['id']}")
            continue
        if path.is_file() and expected and sha(path)==expected:continue
        if not expected:raise RuntimeError(f"refusing unpinned download: {item['id']}")
        parsed=urllib.parse.urlparse(url)
        if parsed.scheme!="https" or parsed.hostname not in HOSTS:raise RuntimeError("source not allowlisted")
        path.parent.mkdir(parents=True,exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as tmp:
            temp=Path(tmp.name)
            try:
                with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"vending-attention-bootstrap/1"}),timeout=120) as response:shutil.copyfileobj(response,tmp)
            except Exception:temp.unlink(missing_ok=True);raise
        os.replace(temp,path)
        if sha(path)!=expected:path.unlink(missing_ok=True);raise RuntimeError(f"hash mismatch: {item['id']}")
    write_runtime(source)
def verify():
    source=data();errors=[]
    for item in source["assets"]:
        path=target(item["path"])
        if not path.is_file():
            if item.get("required"):errors.append(f"missing: {item['path']}")
            continue
        actual=sha(path);expected=item.get("sha256");print(f"{item['id']}: {actual}")
        if expected and actual!=expected:errors.append(f"hash mismatch: {item['id']}")
    if errors:raise RuntimeError("\n".join(errors))
    out=write_runtime(source)
    if not all(x["verified"] for x in out["assets"] if x.get("required")):raise RuntimeError("unverified asset")
def main():
    p=argparse.ArgumentParser();p.add_argument("command",choices=("fetch","verify"));a=p.parse_args()
    try:fetch() if a.command=="fetch" else verify()
    except Exception as exc:print(f"asset {a.command} failed: {exc}");return 1
    return 0
if __name__=="__main__":raise SystemExit(main())
