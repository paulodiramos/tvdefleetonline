# TVDEFleet - Guia de Deployment VPS

## Requisitos
- Ubuntu 22.04 LTS
- Docker e Docker Compose instalados
- Mínimo 2GB RAM

## Instalação Rápida

### 1. Clonar o repositório
```bash
cd /opt
git clone https://github.com/paulodiramos/tvdefleetonline.git tvdefleet
cd tvdefleet
```

### 2. Iniciar os serviços
```bash
cd deployment
docker compose up -d
```

### 3. Restaurar a base de dados
```bash
chmod +x restore-db.sh
./restore-db.sh
```

### 4. Aceder à aplicação
- URL: http://SEU_IP
- Email: admin@tvdefleet.com
- Password: 123456

**IMPORTANTE:** Todas as passwords dos utilizadores são `123456`

## Comandos Úteis

### Ver logs
```bash
docker logs tvdefleet-backend --tail 50
docker logs tvdefleet-frontend --tail 50
docker logs tvdefleet-nginx --tail 50
```

### Reiniciar serviços
```bash
docker compose restart
```

### Parar serviços
```bash
docker compose down
```

### Atualizar aplicação
```bash
git pull
docker compose up -d --build
./restore-db.sh  # Se necessário restaurar dados
```

## Estrutura de Portas
- 80: Nginx (proxy reverso)
- 3000: Frontend (interno)
- 8001: Backend API (interno)
- 27017: MongoDB (interno)

## Configurar SSL (HTTPS)

### 1. Configurar DNS
Apontar o domínio para o IP do servidor.

### 2. Instalar Certbot
```bash
apt update && apt install -y certbot
certbot certonly --standalone -d seudominio.com -d www.seudominio.com
```

### 3. Atualizar nginx
Editar `deployment/docker-compose.yml` para usar `nginx-proxy.conf` em vez de `nginx-nossl.conf`.

## Suporte
Em caso de problemas, verificar os logs dos containers.
