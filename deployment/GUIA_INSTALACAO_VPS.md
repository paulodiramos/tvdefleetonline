# TVDEFleet - Guia de Instalação VPS

## Requisitos Mínimos

- **SO:** Ubuntu 22.04 LTS ou Debian 11+
- **RAM:** 4GB (recomendado 8GB para RPA)
- **Disco:** 40GB SSD
- **CPU:** 2 vCPUs

## Instalação Rápida

### 1. Conectar ao VPS

```bash
ssh root@SEU_IP_VPS
```

### 2. Baixar e Instalar

```bash
# Clonar repositório (ou copiar ficheiros)
cd /opt
git clone https://seu-repo/tvdefleet.git
cd tvdefleet

# Executar instalação
chmod +x deployment/install-vps.sh
sudo ./deployment/install-vps.sh
```

### 3. Configurar

```bash
# Editar configuração
nano /opt/tvdefleet/deployment/.env

# Definir domínio e chaves
DOMAIN=tvdefleet.com
JWT_SECRET=sua-chave-segura
```

### 4. Iniciar

```bash
# Iniciar aplicação
systemctl start tvdefleet

# Verificar estado
./status.sh
```

---

## Auto-Start

A aplicação inicia automaticamente quando o servidor reinicia:

```bash
# Verificar se está habilitado
systemctl is-enabled tvdefleet

# Habilitar auto-start
systemctl enable tvdefleet
```

---

## Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `systemctl start tvdefleet` | Iniciar aplicação |
| `systemctl stop tvdefleet` | Parar aplicação |
| `systemctl restart tvdefleet` | Reiniciar aplicação |
| `systemctl status tvdefleet` | Ver estado |
| `./status.sh` | Ver estado detalhado |
| `./backup-db.sh` | Fazer backup da BD |
| `./restore-db.sh` | Restaurar backup |
| `docker compose logs -f` | Ver logs em tempo real |

---

## Persistência de Dados

### ✅ Dados Persistentes (NÃO são apagados):

- **MongoDB:** Volume `tvdefleet_mongodb_data`
- **Uploads:** Volume `tvdefleet_uploads`
- **Sessões RPA:** Volume `tvdefleet_rpa_sessions`
- **Backups:** `/opt/tvdefleet/backups/`

### ⚠️ Importante:

- Nunca execute `docker volume rm` nos volumes TVDEFleet
- Use `docker compose down` (sem `-v`) para parar sem apagar dados
- Faça backups regulares com `./backup-db.sh`

---

## Configurar SSL (HTTPS)

### 1. Configurar DNS

Aponte o domínio para o IP do VPS:
- `tvdefleet.com` → `SEU_IP_VPS`
- `www.tvdefleet.com` → `SEU_IP_VPS`

### 2. Gerar Certificado

```bash
cd /opt/tvdefleet/deployment
./setup-ssl.sh
```

### 3. Verificar

```bash
curl https://tvdefleet.com/api/health
```

---

## Backups Automáticos

### Configurar Cron

```bash
# Editar crontab
crontab -e

# Adicionar backup diário às 3h da manhã
0 3 * * * /opt/tvdefleet/deployment/backup-db.sh >> /var/log/tvdefleet-backup.log 2>&1
```

---

## Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker compose logs --tail 100 backend

# Verificar se MongoDB está saudável
docker exec tvdefleet-mongodb mongosh --eval "db.adminCommand('ping')"
```

### Sessões RPA não persistem

```bash
# Verificar volume
docker volume inspect tvdefleet_rpa_sessions

# Verificar permissões dentro do container
docker exec tvdefleet-backend ls -la /app/data/
```

### Falta de espaço

```bash
# Limpar imagens não usadas
docker system prune -a

# Ver uso de disco por volume
docker system df -v
```

---

## Actualizar Aplicação

```bash
cd /opt/tvdefleet

# Parar aplicação
systemctl stop tvdefleet

# Actualizar código
git pull

# Reconstruir containers
cd deployment
docker compose build

# Reiniciar
systemctl start tvdefleet
```

---

## Contacto

Para suporte, contacte a equipa de desenvolvimento.
