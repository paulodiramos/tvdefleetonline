# TVDEFleet WhatsApp Service

Serviço WhatsApp para deploy em VPS externo (Railway, Render, DigitalOcean).

## Deploy Rápido no Railway

1. Fork este repositório
2. Criar conta em [railway.app](https://railway.app)
3. New Project → Deploy from GitHub
4. Seleccionar este repositório
5. Railway detecta o Dockerfile automaticamente
6. Aguardar deploy (2-3 minutos)
7. Copiar URL gerado

## Configurar no Emergent

Após deploy, adicionar variável de ambiente no backend Emergent:

```
WHATSAPP_SERVICE_URL=https://seu-app.railway.app
```

## Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Health check |
| `/status/:parceiro_id` | GET | Status do cliente |
| `/initialize/:parceiro_id` | GET | Iniciar cliente |
| `/qr/:parceiro_id` | GET | Obter QR Code |
| `/send/:parceiro_id` | POST | Enviar mensagem |
| `/disconnect/:parceiro_id` | POST | Desconectar |

## Testar

```bash
# Health check
curl https://seu-app.railway.app/health

# Iniciar cliente
curl https://seu-app.railway.app/initialize/teste

# Obter QR
curl https://seu-app.railway.app/qr/teste
```

## Variáveis de Ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `PORT` | 3001 | Porta do serviço |
| `AUTH_PATH` | /app/.wwebjs_auth | Path para sessões |

## Custos

- Railway: ~$5-10/mês
- Render: $7/mês
- DigitalOcean: $6/mês
