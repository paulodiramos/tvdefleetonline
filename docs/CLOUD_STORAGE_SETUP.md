# Configuração de Cloud Storage - TVDEFleet

Este guia explica como configurar a integração com os serviços de armazenamento cloud (Google Drive, Dropbox, OneDrive).

---

## Índice
1. [Google Drive](#google-drive)
2. [Dropbox](#dropbox)
3. [OneDrive](#onedrive)
4. [Configuração Final](#configuração-final)

---

## Google Drive

### Passo 1: Criar Projeto no Google Cloud Console

1. Aceda a [Google Cloud Console](https://console.cloud.google.com)
2. Clique em **Selecionar Projeto** → **Novo Projeto**
3. Nome do projeto: `TVDEFleet` (ou outro nome à escolha)
4. Clique **Criar**

### Passo 2: Activar a API do Google Drive

1. No menu lateral, vá a **APIs e Serviços** → **Biblioteca**
2. Pesquise por **Google Drive API**
3. Clique em **Google Drive API** → **Activar**

### Passo 3: Configurar Ecrã de Consentimento OAuth

1. Vá a **APIs e Serviços** → **Ecrã de consentimento OAuth**
2. Seleccione **Externo** → **Criar**
3. Preencha:
   - **Nome da aplicação:** TVDEFleet
   - **E-mail de suporte:** (o seu e-mail)
   - **E-mails de contacto do programador:** (o seu e-mail)
4. Clique **Guardar e Continuar**
5. Em **Âmbitos**, clique **Adicionar ou remover âmbitos**
   - Adicione: `https://www.googleapis.com/auth/drive.file`
6. Clique **Atualizar** → **Guardar e Continuar**
7. Em **Utilizadores de teste**, adicione os e-mails que vão testar
8. Clique **Guardar e Continuar**

### Passo 4: Criar Credenciais OAuth

1. Vá a **APIs e Serviços** → **Credenciais**
2. Clique **Criar Credenciais** → **ID de cliente OAuth**
3. Tipo de aplicação: **Aplicação Web**
4. Nome: `TVDEFleet Web`
5. **URIs de redireccionamento autorizados:**
   ```
   https://vps-fleet-test.preview.emergentagent.com/api/storage-config/oauth/google_drive/callback
   ```
   (Substitua pelo URL real da sua aplicação)
6. Clique **Criar**
7. **Copie o ID do cliente e o Segredo do cliente**

### Passo 5: Guardar as Credenciais

Adicione ao ficheiro `/app/backend/.env`:
```
GOOGLE_CLIENT_ID=seu_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_client_secret_aqui
```

---

## Dropbox

### Passo 1: Criar Aplicação no Dropbox

1. Aceda a [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Clique **Create app**

### Passo 2: Configurar a Aplicação

1. **Choose an API:** Seleccione **Scoped access**
2. **Choose the type of access:** Seleccione **Full Dropbox**
3. **Name your app:** `TVDEFleet`
4. Clique **Create app**

### Passo 3: Configurar Permissões

1. Na tab **Permissions**, active:
   - `files.metadata.read`
   - `files.metadata.write`
   - `files.content.read`
   - `files.content.write`
2. Clique **Submit**

### Passo 4: Configurar Redirect URI

1. Na tab **Settings**, em **OAuth 2**, adicione o Redirect URI:
   ```
   https://vps-fleet-test.preview.emergentagent.com/api/storage-config/oauth/dropbox/callback
   ```
   (Substitua pelo URL real da sua aplicação)

### Passo 5: Copiar Credenciais

Na tab **Settings**, copie:
- **App key** (é o Client ID)
- **App secret** (clique em "Show" para ver)

### Passo 6: Guardar as Credenciais

Adicione ao ficheiro `/app/backend/.env`:
```
DROPBOX_APP_KEY=seu_app_key_aqui
DROPBOX_APP_SECRET=seu_app_secret_aqui
```

---

## OneDrive

### Passo 1: Registar Aplicação no Azure

1. Aceda ao [Azure Portal](https://portal.azure.com)
2. Pesquise por **Registos de aplicações** (ou "App registrations")
3. Clique **Novo registo**

### Passo 2: Configurar o Registo

1. **Nome:** TVDEFleet
2. **Tipos de conta suportados:** Contas em qualquer diretório organizacional e contas Microsoft pessoais
3. **URI de Redireccionamento:**
   - Plataforma: **Web**
   - URL: 
   ```
   https://vps-fleet-test.preview.emergentagent.com/api/storage-config/oauth/onedrive/callback
   ```
4. Clique **Registar**

### Passo 3: Copiar o ID da Aplicação

Na página **Descrição Geral**, copie:
- **ID da aplicação (cliente)** - Este é o `MICROSOFT_CLIENT_ID`

### Passo 4: Criar Segredo do Cliente

1. Vá a **Certificados e segredos**
2. Clique **Novo segredo do cliente**
3. Descrição: `TVDEFleet Secret`
4. Expiração: 24 meses (recomendado)
5. Clique **Adicionar**
6. **Copie imediatamente o Valor** (não o ID) - Este é o `MICROSOFT_CLIENT_SECRET`

### Passo 5: Configurar Permissões da API

1. Vá a **Permissões de API**
2. Clique **Adicionar uma permissão** → **Microsoft Graph**
3. Seleccione **Permissões delegadas**
4. Pesquise e adicione:
   - `Files.ReadWrite.All`
   - `offline_access`
5. Clique **Adicionar permissões**

### Passo 6: Guardar as Credenciais

Adicione ao ficheiro `/app/backend/.env`:
```
MICROSOFT_CLIENT_ID=seu_client_id_aqui
MICROSOFT_CLIENT_SECRET=seu_client_secret_aqui
```

---

## Configuração Final

### 1. Reiniciar o Backend

Após adicionar as credenciais ao `.env`, reinicie o backend:
```bash
sudo supervisorctl restart backend
```

### 2. Testar a Ligação

1. Faça login na aplicação como parceiro
2. Vá a **Configurações** → **Armazenamento**
3. Escolha o provider desejado (Google Drive, Dropbox ou OneDrive)
4. Clique em **Conectar**
5. Será redireccionado para a página de autorização do provider
6. Autorize a aplicação
7. Será redireccionado de volta para a aplicação com a conta ligada

### 3. Verificar o Estado

Na página de configuração de armazenamento, deverá ver:
- O e-mail da conta ligada
- Estado: **Conectado**

---

## Resolução de Problemas

### Erro: "redirect_uri_mismatch"
- Verifique se o Redirect URI configurado no provider corresponde exactamente ao URL da sua aplicação
- Certifique-se de que não há espaços ou caracteres extra

### Erro: "invalid_client"
- Verifique se o Client ID e Client Secret estão correctos
- Confirme que copiou os valores completos sem espaços

### Erro: "access_denied"
- O utilizador pode ter recusado as permissões
- Tente novamente e aceite todas as permissões solicitadas

### Erro: "insufficient_scope"
- Verifique se todas as permissões necessárias estão configuradas no provider

---

## Notas de Segurança

1. **Nunca partilhe** o Client Secret publicamente
2. **Não commitar** o ficheiro `.env` para repositórios Git
3. **Renove** os segredos periodicamente (especialmente OneDrive)
4. **Revogue** o acesso se suspeitar de comprometimento

---

## Suporte

Em caso de dúvidas, contacte o suporte técnico da TVDEFleet.
