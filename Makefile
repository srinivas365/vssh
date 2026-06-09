# vssh — Makefile
# Convenience wrappers around npm / electron-builder / docker compose.
#
# Run `make` (no args) to see the available targets.

.DEFAULT_GOAL := help

# ── paths / config ─────────────────────────────────────────────────────────
NPM            := npm
SSHD_COMPOSE   := test/e2e/docker-compose.sshd.yml
SSHD_HOST      := 127.0.0.1
SSHD_PORT      := 2222
RELEASE_DIR    := release
DIST_DIR       := dist
ICON_SRC       := build/icon.svg
ICON_OUT       := build/icon.icns build/icon.png
MACOS_KEYCHAIN := native/macos-keychain/vssh-keychain

# ── self-documenting help ──────────────────────────────────────────────────
.PHONY: help
help: ## Show this help (default)
	@printf "\nvssh — make targets\n\n"
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z0-9_.-]+:.*## / {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@printf "\n"

# ── install ────────────────────────────────────────────────────────────────
.PHONY: install
install: ## Install npm dependencies
	$(NPM) install

# ── dev ────────────────────────────────────────────────────────────────────
.PHONY: dev
dev: ## Run app in dev mode (vite + tsc -w + electron)
	$(NPM) run dev

# ── build ──────────────────────────────────────────────────────────────────
.PHONY: build
build: ## Full production build (main + preload + renderer)
	$(NPM) run build

.PHONY: typecheck
typecheck: ## Typecheck main + preload + renderer
	$(NPM) run typecheck

# ── icon ───────────────────────────────────────────────────────────────────
.PHONY: icon
icon: $(ICON_OUT) ## Rebuild app icon from build/icon.svg

$(ICON_OUT): $(ICON_SRC) scripts/build-icon.sh
	bash scripts/build-icon.sh

# ── macOS Touch ID helper ──────────────────────────────────────────────────
.PHONY: macos-keychain
macos-keychain: $(MACOS_KEYCHAIN) ## Build Touch ID keychain helper (macOS only)
	@echo "✓ Touch ID helper ready: $(MACOS_KEYCHAIN)"

$(MACOS_KEYCHAIN): native/macos-keychain/main.swift scripts/build-macos-keychain.sh
	bash scripts/build-macos-keychain.sh

# ── tests ──────────────────────────────────────────────────────────────────
.PHONY: test
test: ## Run unit tests (auto-rebuilds native modules for Node)
	$(NPM) test

.PHONY: test-watch
test-watch: ## Run unit tests in watch mode
	$(NPM) run test:watch

.PHONY: e2e
e2e: sshd-up rebuild-electron ## Run E2E (starts sshd container, rebuilds for electron)
	npx playwright test; \
	  status=$$?; \
	  $(MAKE) sshd-down; \
	  exit $$status

# ── sshd test container ────────────────────────────────────────────────────
.PHONY: sshd-up
sshd-up: ## Start the openssh-server Docker container for E2E
	@ssh-keygen -R "[$(SSHD_HOST)]:$(SSHD_PORT)" >/dev/null 2>&1 || true
	docker compose -f $(SSHD_COMPOSE) up -d
	@printf "waiting for sshd on $(SSHD_HOST):$(SSHD_PORT)"
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
	  if nc -z $(SSHD_HOST) $(SSHD_PORT) 2>/dev/null; then printf " ready\n"; exit 0; fi; \
	  printf "."; sleep 1; \
	done; \
	printf " timeout\n"; exit 1

.PHONY: sshd-down
sshd-down: ## Tear down the openssh-server container
	docker compose -f $(SSHD_COMPOSE) down

# ── native module rebuilds ─────────────────────────────────────────────────
.PHONY: rebuild-node
rebuild-node: ## Rebuild native modules for system Node (needed before `make test`)
	$(NPM) run rebuild:node

.PHONY: rebuild-electron
rebuild-electron: ## Rebuild native modules for Electron (needed before launching)
	$(NPM) run rebuild:electron

# ── run / package ──────────────────────────────────────────────────────────
.PHONY: run
run: build rebuild-electron macos-keychain ## Build everything and launch Electron
	npx electron .

.PHONY: dmg
dmg: build rebuild-electron icon macos-keychain ## Build a .dmg installer at release/
	$(NPM) run dist
	@printf "\nDMG written to:\n"
	@ls -lh $(RELEASE_DIR)/*.dmg 2>/dev/null || true

.PHONY: dist
dist: dmg ## Alias for `make dmg`

# ── clean ──────────────────────────────────────────────────────────────────
.PHONY: clean
clean: ## Remove build outputs (dist, release, test-results)
	rm -rf $(DIST_DIR) $(RELEASE_DIR) test-results playwright-report

.PHONY: clean-icon
clean-icon: ## Remove generated icon files (keeps build/icon.svg)
	rm -rf build/icon.icns build/icon.png build/icon.iconset

.PHONY: clean-all
clean-all: clean clean-icon ## Remove all generated outputs including node_modules
	rm -rf node_modules

# ── ci-style verification ──────────────────────────────────────────────────
.PHONY: verify
verify: typecheck test ## Typecheck + unit tests (fast pre-commit gate)

.PHONY: verify-full
verify-full: verify e2e ## verify + E2E (slow, requires Docker)
