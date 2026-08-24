#!/usr/bin/env bash
# Wrapper para rodar um scraper sob display virtual (xvfb) — o Puppeteer roda
# com headless:false para furar o Cloudflare, então precisa de um X virtual num
# servidor sem tela. Usa flock para não sobrepor execuções (o 'details' pode
# levar ~12min; sem trava, o próximo cron começaria por cima).
#
# Uso:  deploy/scrape.sh <current|details|boosted|quests> [args...]
# Ex.:  deploy/scrape.sh details --refresh
#
# Requer: xvfb, e o Chromium que o Puppeteer baixa (npm ci já instala).
set -euo pipefail

REPO="${UTANIHUR_DIR:-/srv/utanihur}"
TASK="${1:?uso: scrape.sh <current|details|boosted|quests> [args...]}"
shift || true

cd "$REPO"

# ARM (Oracle Ampere): o puppeteer não traz Chromium para arm64. Usa o do
# sistema quando presente; no x86 fica vazio e cai no Chromium empacotado.
export PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-$(command -v chromium chromium-browser 2>/dev/null | head -n1)}"

LOCK="/tmp/utanihur-${TASK}.lock"
# -n: se já houver uma execução desta task em andamento, sai sem esperar.
# --workspace=apps/scraper: os scripts (current/details/...) vivem no workspace
# do scraper; a raiz do monorepo não expõe todos eles.
exec flock -n "$LOCK" xvfb-run -a npm run "$TASK" --workspace=apps/scraper -- "$@"
