SHELL := /bin/bash
.PHONY: bootstrap verify-assets preflight build start test
bootstrap:
	/bin/bash ./scripts/bootstrap.sh
verify-assets:
	./.venv/bin/python scripts/assets.py verify
preflight:
	/bin/bash ./scripts/preflight.sh
build:
	cd frontend && npm run build
start:
	/bin/bash ./scripts/start.sh
test:
	uv run --directory backend --extra test pytest
	cd frontend && npm test
