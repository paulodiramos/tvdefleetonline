# Guia: Configurar WhatsApp Service em VPS Externo

## Visão Geral

Este guia explica como configurar o serviço WhatsApp num VPS externo e conectá-lo à aplicação TVDEFleet no Emergent.

```
┌─────────────────────┐         ┌─────────────────────┐
│   Emergent Cloud    │         │    VPS Externo      │
│                     │         │                     │
│  ┌───────────────┐  │   API   │  ┌───────────────┐  │
│  │ TVDEFleet     │◄─┼─────────┼─►│ WhatsApp      │  │
│  │ Backend       │  │         │  │ Service       │  │
│  │ (FastAPI)     │  │         │  │ (Node.js)     │  │
│  └───────────────┘  │         │  └───────────────┘  │
│                     │         │         │           │
└─────────────────────┘         │    Chromium         │
                                └─────────────────────┘
```

---

## Opção A: Railway.app (Mais Fácil) ⭐ Recomendado

### Passo 1: Criar Conta
1. Aceda a https://railway.app
2. Registe-se com GitHub ou Email
3. Verificar conta

### Passo 2: Criar Novo Projecto
1. Clique em "New Project"
2. Seleccione "Empty Project"
3. Clique em "Add Service" → "Empty Service"

### Passo 3: Configurar Repositório
Crie um novo repositório GitHub com estes ficheiros:

**package.json:**
```json
{
  "name": "whatsapp-service",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "whatsapp-web.js": "^1.23.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "qrcode": "^1.5.3"
  }
}
```

**Dockerfile:**
```dockerfile
FROM node:18-slim

# Instalar Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

EXPOSE 3001
CMD ["npm", "start"]
```

**index.js:** (copiar de /app/backend/whatsapp_service/index.js)

### Passo 4: Deploy no Railway
1. Conectar repositório GitHub ao Railway
2. Railway detecta o Dockerfile automaticamente
3. Configurar variável de ambiente: `PORT=3001`
4. Deploy automático

### Passo 5: Obter URL Público
Após deploy, Railway fornece URL tipo:
`https://whatsapp-service-xxxx.railway.app`

---

## Opção B: Render.com

### Passo 1: Criar Conta
1. Aceda a https://render.com
2. Registe-se com GitHub

### Passo 2: Criar Web Service
1. Dashboard → New → Web Service
2. Conectar repositório GitHub
3. Configurar:
   - Environment: Docker
   - Plan: Starter ($7/mês) ou superior

### Passo 3: Variáveis de Ambiente
```
PORT=3001
NODE_ENV=production
```

---

## Opção C: DigitalOcean Droplet

### Passo 1: Criar Droplet
1. Criar conta em digitalocean.com
2. Create → Droplets
3. Escolher Ubuntu 22.04
4. Plan: Basic $6/mês (1GB RAM)
5. Criar Droplet

### Passo 2: Configurar Servidor
```bash
# Conectar via SSH
ssh root@SEU_IP

# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar Chromium
sudo apt-get install -y chromium-browser

# Instalar PM2 para manter o serviço activo
npm install -g pm2

# Criar pasta do projecto
mkdir -p /opt/whatsapp-service
cd /opt/whatsapp-service

# Copiar ficheiros (package.json e index.js)
# ... (usar scp ou git clone)

# Instalar dependências
npm install

# Iniciar com PM2
pm2 start index.js --name whatsapp
pm2 startup
pm2 save
```

### Passo 3: Configurar Firewall
```bash
ufw allow 3001
ufw enable
```

---

## Configurar TVDEFleet para usar VPS Externo

### Passo 1: Adicionar Variável de Ambiente no Emergent

No ficheiro `/app/backend/.env`, adicionar:
```
WHATSAPP_SERVICE_URL=https://SEU-VPS-URL.railway.app
```

### Passo 2: O código já está preparado!
O ficheiro `/app/backend/routes/whatsapp.py` já usa:
```python
WHATSAPP_SERVICE_URL = os.environ.get("WHATSAPP_SERVICE_URL", "http://localhost:3001")
```

---

## Testar a Integração

### 1. Verificar Serviço VPS
```bash
curl https://SEU-VPS-URL/health
```
Resposta esperada:
```json
{"status":"ok","chromium":{"available":true}}
```

### 2. Testar QR Code
```bash
curl https://SEU-VPS-URL/initialize/teste
```

### 3. Testar da Aplicação Emergent
Na página de Integrações, o QR Code deve aparecer.

---

## Custos Estimados

| Serviço      | Custo/Mês | Notas                    |
|--------------|-----------|--------------------------|
| Railway      | $5-10     | Fácil, auto-scaling      |
| Render       | $7        | Estável, bom suporte     |
| DigitalOcean | $6        | Mais controlo, manual    |
| Fly.io       | $5-10     | Bom para containers      |

---

## Suporte

Se tiver problemas:
1. Verificar logs do VPS
2. Confirmar que Chromium está instalado
3. Verificar firewall permite porta 3001
4. Confirmar variável WHATSAPP_SERVICE_URL no Emergent
