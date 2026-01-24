# TVDEFleet - Requisitos de Deployment

## Requisitos do Sistema

### WhatsApp Web Service
O serviço WhatsApp usa o `whatsapp-web.js` que requer o **Chromium** instalado no servidor.

#### Instalação Automática (Recomendado)
Adicione ao seu Dockerfile ou script de inicialização:

```dockerfile
# No Dockerfile
RUN apt-get update && apt-get install -y chromium

# Ou via script de inicialização
apt-get update && apt-get install -y chromium
```

#### Variáveis de Ambiente
```bash
# O serviço WhatsApp espera o Chromium em:
CHROMIUM_PATH=/usr/bin/chromium

# Porta do serviço WhatsApp (padrão: 3001)
WHATSAPP_SERVICE_PORT=3001
```

#### Verificar Instalação
```bash
# Verificar se o Chromium está instalado
which chromium
# Deve retornar: /usr/bin/chromium

# Verificar versão
chromium --version
```

### Terabox
O Terabox não requer instalações adicionais. A autenticação é feita via cookie da sessão web.

### Portas Necessárias
- **8001**: Backend FastAPI
- **3000**: Frontend React
- **3001**: WhatsApp Service (Node.js)
- **27017**: MongoDB (interno)

## Resolução de Problemas

### WhatsApp - "Browser was not found"
```bash
# Instalar o Chromium
apt-get update && apt-get install -y chromium
```

### WhatsApp - "Profile appears to be in use"
Os ficheiros de lock são limpos automaticamente ao reiniciar o serviço.
Se persistir, pode limpar manualmente:
```bash
find /app/backend/whatsapp_service/.wwebjs_auth -name "Singleton*" -delete
supervisorctl restart whatsapp
```

### MongoDB - Conexão recusada
Verificar se o MongoDB está a correr e a variável MONGO_URL está correta.

## Estrutura de Serviços

```
TVDEFleet
├── Backend (FastAPI)        → porta 8001
├── Frontend (React)         → porta 3000
├── WhatsApp Service (Node)  → porta 3001
└── MongoDB                  → porta 27017
```
