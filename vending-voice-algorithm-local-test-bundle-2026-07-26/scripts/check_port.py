#!/usr/bin/env python3
from __future__ import annotations

import socket
import sys


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: check_port.py HOST PORT", file=sys.stderr)
        return 2
    host = sys.argv[1]
    if host not in {"127.0.0.1", "localhost"}:
        print("localhost bind required", file=sys.stderr)
        return 2
    try:
        port = int(sys.argv[2])
    except ValueError:
        print(f"invalid port: {sys.argv[2]}", file=sys.stderr)
        return 2
    if not 1 <= port <= 65535:
        print(f"port must be between 1 and 65535: {port}", file=sys.stderr)
        return 2

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", port))
    except OSError as exc:
        print(
            f"Port {port} is occupied or unavailable ({exc}). "
            "Choose another port, for example: "
            "VENDING_ATTENTION_PORT=9000 make start",
            file=sys.stderr,
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
