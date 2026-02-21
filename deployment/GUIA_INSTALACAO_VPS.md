# 🚀 TVDEFleet - Guia de Instalação VPS

## Servidor Alvo
- **IP:** 94.46.171.222
- **Sistema:** Ubuntu 22.04 LTS (recomendado)

---

## 📋 Pré-requisitos

Antes de começar, certifique-se que tem:
- Acesso SSH ao servidor (root ou sudo)
- Domínio apontado para o IP (opcional, mas recomendado)
- Credenciais de email SMTP
- Credenciais WhatsApp Cloud API (opcional)

---

## 🔧 Instalação Passo a Passo

### 1. Aceder ao Servidor

```bash
ssh root@94.46.171.222
```

### 2. Instalar Dependências

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com | sh

# Instalar Docker Compose
apt install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version
```

### 3. Criar Diretório da Aplicação

```bash
mkdir -p /opt/tvdefleet
cd /opt/tvdefleet
```

### 4. Transferir Ficheiros

**Opção A: Via SCP (do seu computador local)**
```bash
# No seu computador local, execute:
scp -r /caminho/para/tvdefleet/* root@94.46.171.222:/opt/tvdefleet/
```

**Opção B: Via Git (se tiver repositório)**
```bash
git clone https://github.com/seu-usuario/tvdefleet.git .
```

**Opção C: Via SFTP**
Use um cliente como FileZilla para transferir os ficheiros.

### 5. Configurar Variáveis de Ambiente

```bash
cd /opt/tvdefleet

# Copiar exemplo
cp deployment/.env.example .env

# Editar configuração
nano .env
```

**Configurações importantes a alterar:**

```env
# Domínio (altere para o seu)
DOMAIN=tvdefleet.com

# Segurança - GERE UMA NOVA CHAVE!
JWT_SECRET=sua-chave-super-secreta-minimo-32-caracteres

# Email
SMTP_PASSWORD=sua_password_real

# WhatsApp (se tiver)
WHATSAPP_CLOUD_ACCESS_TOKEN=seu_token
WHATSAPP_CLOUD_PHONE_NUMBER_ID=seu_phone_id
```

### 6. Iniciar a Aplicação

```bash
cd /opt/tvdefleet

# Construir imagens
docker compose build

# Iniciar serviços
docker compose up -d

# Verificar estado
docker compose ps
```

### 7. Configurar SSL (HTTPS) - Recomendado

```bash
chmod +x deployment/setup-ssl.sh
./deployment/setup-ssl.sh tvdefleet.com admin@tvdefleet.com
```

---

## 🔍 Verificação

### Testar Backend
```bash
curl http://94.46.171.222:8001/api/health
```

### Testar Frontend
Abra no navegador: `http://94.46.171.222:3000`

### Ver Logs
```bash
# Todos os serviços
docker compose logs -f

# Apenas backend
docker compose logs -f backend

# Apenas MongoDB
docker compose logs -f mongodb
```

---

## 📊 Comandos Úteis

```bash
# Usar o script de deploy
chmod +x deployment/deploy.sh

./deploy.sh start      # Iniciar
./deploy.sh stop       # Parar
./deploy.sh restart    # Reiniciar
./deploy.sh status     # Ver estado
./deploy.sh logs       # Ver logs
./deploy.sh backup     # Fazer backup da BD
./deploy.sh update     # Atualizar aplicação
```

---

## 🔒 Segurança Recomendada

### 1. Firewall
```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 2. Fail2Ban (proteção contra brute force)
```bash
apt install fail2ban -y
systemctl enable fail2ban
```

### 3. Mudar Porta SSH (opcional)
```bash
nano /etc/ssh/sshd_config
# Alterar: Port 22 para Port 2222
systemctl restart sshd
```

---

## 💾 Backups

### Backup Manual
```bash
./deploy.sh backup
```

### Backup Automático (cron)
```bash
crontab -e

# Adicionar linha (backup diário às 3h da manhã):
0 3 * * * /opt/tvdefleet/deployment/deploy.sh backup
```

### Restaurar Backup
```bash
# Listar backups
ls -la /opt/tvdefleet/backups/

# Restaurar
docker compose exec -T mongodb mongorestore --archive --gzip < /opt/tvdefleet/backups/nome_do_backup.gz
```

---

## ❓ Resolução de Problemas

### Container não inicia
```bash
docker compose logs backend
docker compose logs mongodb
```

### Erro de conexão MongoDB
```bash
# Verificar se MongoDB está a correr
docker compose ps mongodb

# Reiniciar MongoDB
docker compose restart mongodb
```

### Erro de permissões
```bash
chown -R 1000:1000 /opt/tvdefleet/backend/uploads
```

### Falta de memória
```bash
# Verificar uso
free -h
docker stats

# Limpar cache Docker
docker system prune -a
```

---

## 📞 Contactos

- **Suporte técnico:** info@tvdefleet.com
- **Documentação:** Ver ficheiros na pasta `/docs`

---

## ✅ Checklist Final

- [ ] Docker e Docker Compose instalados
- [ ] Ficheiros transferidos para /opt/tvdefleet
- [ ] Ficheiro .env configurado
- [ ] Containers a correr (`docker compose ps`)
- [ ] Backend acessível (porta 8001)
- [ ] Frontend acessível (porta 3000 ou 80/443)
- [ ] SSL configurado (opcional)
- [ ] Firewall configurado
- [ ] Backup automático configurado
