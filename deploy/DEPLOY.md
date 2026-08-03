# Deploy — Utanihur (cenário "1 VPS")

Este guia sobe **tudo numa única VPS**: o site (web estático via nginx), a API
(Express) e o scraper (cron). É o caminho de menor atrito porque a API lê os
JSON que o scraper grava **no mesmo disco**, e o nginx serve web + `/api` no
mesmo domínio (o web usa `fetch('/api/...')` relativo — sem CORS, sem config).

```
                    ┌──────────────── VPS (Ubuntu 22.04+) ────────────────┐
   navegador ─443─▶ │  nginx  ├─ /      → apps/web/dist  (estático)        │
                    │         └─ /api   → 127.0.0.1:3001 (Express/systemd) │
                    │  cron → deploy/scrape.sh (xvfb + Chromium)           │
                    │           grava → apps/scraper/output/*.json         │
                    │  Express lê ← ────────────────────────┘              │
                    └─────────────────────────────────────────────────────┘
```

## Pré-requisitos

- Uma VPS Linux (ex.: Hetzner CX22, DigitalOcean, Contabo). 2 vCPU / 4 GB folgam.
- Um domínio apontando (registro A) para o IP da VPS.
- Acesso `sudo`.

## 1. Pacotes do sistema

```bash
sudo apt update
# Node 20 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx xvfb git

# Dependências do Chromium que o Puppeteer usa (headful)
sudo apt install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
  libpango-1.0-0 libcairo2 fonts-liberation
```

## 2. Usuário e código

```bash
sudo useradd -m -s /bin/bash utanihur
sudo mkdir -p /srv/utanihur && sudo chown utanihur: /srv/utanihur

sudo -u utanihur git clone <URL_DO_SEU_REPO> /srv/utanihur
cd /srv/utanihur
sudo -u utanihur npm ci          # instala tudo (baixa o Chromium do Puppeteer)
```

## 3. Primeira carga de dados (scraper)

O site precisa dos JSON antes de subir. Rode manualmente uma vez:

```bash
sudo -u utanihur UTANIHUR_DIR=/srv/utanihur deploy/scrape.sh current
sudo -u utanihur UTANIHUR_DIR=/srv/utanihur deploy/scrape.sh details   # ~12 min p/ ~1400
sudo -u utanihur UTANIHUR_DIR=/srv/utanihur deploy/scrape.sh boosted
```

> Se o repo já vier com `apps/scraper/output/*.json` versionado, pode pular o
> `details` inicial e rodar depois pelo cron. Veja a nota sobre **dados no git**
> no fim deste arquivo.

## 4. Build do web

```bash
sudo -u utanihur npm run build:web      # gera apps/web/dist
```

## 5. API como serviço (systemd)

```bash
sudo cp deploy/utanihur-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now utanihur-api
systemctl status utanihur-api           # deve estar "active (running)"
curl -s localhost:3001/health           # {"status":"ok",...}
```

## 6. nginx + SSL

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/utanihur
sudo nano /etc/nginx/sites-available/utanihur     # troque server_name pelo seu domínio
sudo ln -s /etc/nginx/sites-available/utanihur /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# HTTPS grátis (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d utanihur.com -d www.utanihur.com
```

Abra `https://seu-dominio` — o site deve carregar e o bazaar aparecer.

## 7. Atualização automática (cron)

```bash
sudo mkdir -p /var/log/utanihur && sudo chown utanihur: /var/log/utanihur
sudo crontab -u utanihur /srv/utanihur/deploy/crontab.example
sudo crontab -u utanihur -l          # conferir
```

Pronto — a cada 30 min o `current` atualiza a lista e o `details` enriquece os
novos. Como a API tem cache por `mtime`, ela recarrega sozinha quando o scraper
regrava (sem restart).

## Atualizar o código depois (deploy de nova versão)

```bash
cd /srv/utanihur
sudo -u utanihur git pull
sudo -u utanihur npm ci
sudo -u utanihur npm run build:web
sudo systemctl restart utanihur-api
```

## Operação / troubleshooting

- **Logs da API:** `journalctl -u utanihur-api -f`
- **Logs do scraper:** `tail -f /var/log/utanihur/details.log`
- **Rodar um scraper na mão:** `sudo -u utanihur deploy/scrape.sh current`
- **Forçar recoleta de campos novos** (ex.: `gpActive` do Gold Pouch):
  `sudo -u utanihur deploy/scrape.sh details --refresh`
- **nginx não recarrega:** `sudo nginx -t` mostra o erro de config.

## Nota: dados do scraper no git

Hoje `apps/scraper/output/` **não** está no `.gitignore`, ou seja, os JSON de
dados são versionados. Numa VPS onde o scraper escreve nesses arquivos, um
`git pull` de deploy pode **conflitar** com os dados locais. Duas opções:

1. **(Recomendado)** Adicionar `apps/scraper/output/` ao `.gitignore` e deixar o
   scraper da VPS ser a única fonte dos dados. Deploys de código param de
   colidir com dados.
2. Manter versionado e, no deploy, usar `git stash` antes do `pull` (mais
   frouxo, some com dados locais no meio).

Se quiser a opção 1, dá pra ajustar o `.gitignore` e remover os arquivos do
tracking sem apagá-los do disco (`git rm --cached`).
