from __future__ import annotations
import ipaddress, os, socket
from pathlib import Path
if os.environ.get("VENDING_ATTENTION_OFFLINE_GUARD","1")=="1":
    _connect=socket.socket.connect; _sendto=socket.socket.sendto
    _create=socket.create_connection; _resolve=socket.getaddrinfo
    _log=os.environ.get("VENDING_ATTENTION_OUTBOUND_LOG")
    def allowed(host:object)->bool:
        if not isinstance(host,str): return False
        if host.lower()=="localhost": return True
        try: return ipaddress.ip_address(host).is_loopback
        except ValueError: return False
    def record(address:object)->None:
        if _log:
            path=Path(_log); path.parent.mkdir(parents=True,exist_ok=True)
            with path.open("a",encoding="utf-8") as f: f.write(f"blocked: {address!r}\n")
    def connect(self,address):
        if self.family==socket.AF_UNIX: return _connect(self,address)
        host=address[0] if isinstance(address,tuple) and address else None
        if not allowed(host): record(address); raise RuntimeError(f"offline blocked: {address!r}")
        return _connect(self,address)
    def create(address,*args,**kwargs):
        host=address[0] if isinstance(address,tuple) and address else None
        if not allowed(host): record(address); raise RuntimeError(f"offline blocked: {address!r}")
        return _create(address,*args,**kwargs)
    def resolve(host,*args,**kwargs):
        if host is not None and not allowed(host): record(("dns",host)); raise RuntimeError(f"offline DNS blocked: {host!r}")
        return _resolve(host,*args,**kwargs)
    def sendto(self,data,*args):
        address=args[-1] if args else None
        if self.family==socket.AF_UNIX: return _sendto(self,data,*args)
        host=address[0] if isinstance(address,tuple) and address else None
        if not allowed(host): record(address); raise RuntimeError(f"offline datagram blocked: {address!r}")
        return _sendto(self,data,*args)
    socket.socket.connect=connect; socket.socket.sendto=sendto
    socket.create_connection=create; socket.getaddrinfo=resolve
