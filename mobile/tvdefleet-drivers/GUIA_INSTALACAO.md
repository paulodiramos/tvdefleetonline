# 📱 Guia de Instalação - TVDEFleet Drivers

## Pré-requisitos

Antes de começar, precisa de:
- Um computador (Windows, Mac ou Linux)
- Um telemóvel Android ou iPhone
- Conexão WiFi (computador e telemóvel na mesma rede)

---

## Passo 1: Instalar Expo Go no Telemóvel

### Android:
1. Abra a **Play Store** no seu telemóvel
2. Procure por **"Expo Go"**
3. Instale a app (é gratuita)
4. Abra a app e crie uma conta (opcional, mas recomendado)

### iPhone:
1. Abra a **App Store** no seu iPhone
2. Procure por **"Expo Go"**
3. Instale a app (é gratuita)
4. Abra a app e crie uma conta (opcional, mas recomendado)

---

## Passo 2: Instalar Node.js no Computador

### Windows:
1. Vá a: https://nodejs.org/
2. Clique em **"Download"** (versão LTS recomendada)
3. Execute o instalador e siga as instruções
4. Reinicie o computador

### Mac:
1. Abra o Terminal
2. Execute: `brew install node`
   
   Ou baixe de: https://nodejs.org/

### Linux:
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Verificar instalação:
Abra o terminal/cmd e execute:
```bash
node --version
npm --version
```
Deve mostrar as versões (ex: v20.x.x)

---

## Passo 3: Descarregar o Código da App

1. Na plataforma Emergent, clique no botão **"Download Code"**
2. Aguarde o download do ficheiro ZIP
3. Extraia o ZIP para uma pasta (ex: `C:\Projetos\` ou `~/Projetos/`)
4. Dentro do ZIP, a app está em: `mobile/tvdefleet-drivers`

---

## Passo 4: Instalar Dependências

1. Abra o **Terminal** (Mac/Linux) ou **Prompt de Comando** (Windows)

2. Navegue até à pasta da app:
   ```bash
   cd caminho/para/mobile/tvdefleet-drivers
   ```
   
   Exemplo Windows:
   ```bash
   cd C:\Projetos\fleet-manager\mobile\tvdefleet-drivers
   ```
   
   Exemplo Mac/Linux:
   ```bash
   cd ~/Projetos/fleet-manager/mobile/tvdefleet-drivers
   ```

3. Instale as dependências:
   ```bash
   npm install
   ```
   
   Aguarde alguns minutos...

---

## Passo 5: Iniciar o Servidor de Desenvolvimento

1. Na mesma pasta, execute:
   ```bash
   npx expo start
   ```

2. Aguarde até aparecer um **QR Code** no terminal

3. Também vai aparecer algo assim:
   ```
   › Metro waiting on exp://192.168.1.100:8081
   › Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
   
   › Press a │ open Android
   › Press w │ open web
   › Press j │ open debugger
   › Press r │ reload app
   › Press m │ toggle menu
   ```

---

## Passo 6: Conectar o Telemóvel

### ⚠️ IMPORTANTE: 
O computador e o telemóvel devem estar na **mesma rede WiFi**!

### Android:
1. Abra a app **Expo Go** no telemóvel
2. Toque em **"Scan QR Code"**
3. Aponte a câmara para o QR Code no terminal
4. A app vai carregar automaticamente!

### iPhone:
1. Abra a app **Câmara** do iPhone
2. Aponte para o QR Code no terminal
3. Toque na notificação que aparece
4. Vai abrir no Expo Go automaticamente

---

## Passo 7: Testar a App! 🎉

Depois de carregar, vai ver:

1. **Ecrã de Login**
   - Email: use o email de um motorista/parceiro do sistema
   - Password: a password correspondente
   
   Exemplo para teste:
   - Email: `geral@zmbusines.com`
   - Password: `zeny123`

2. **Relógio de Ponto**
   - Toque em "Iniciar Turno" para fazer check-in
   - O GPS vai registar a sua localização
   - Pode pausar e terminar o turno

3. **Outras secções** (em desenvolvimento):
   - Documentos
   - Vistoria
   - Perfil

---

## Resolução de Problemas

### ❌ "Network request failed" ou "Unable to connect"
- Verifique se o computador e telemóvel estão na **mesma rede WiFi**
- No terminal, pressione `m` e depois escolha **"Tunnel"** em vez de "LAN"
- Execute novamente: `npx expo start --tunnel`

### ❌ QR Code não funciona
- Tente executar: `npx expo start --tunnel`
- Ou use a opção "Enter URL manually" no Expo Go

### ❌ App não carrega / fica em branco
- Feche o Expo Go completamente e abra novamente
- No terminal, pressione `r` para recarregar

### ❌ Erro "Unable to resolve module"
- Execute: `npm install`
- Depois: `npx expo start --clear`

### ❌ Login não funciona
- Verifique se está a usar credenciais válidas do sistema
- A app conecta ao servidor: https://provider-link-3.preview.emergentagent.com/api

---

## Comandos Úteis

| Comando | Descrição |
|---------|-----------|
| `npx expo start` | Iniciar servidor de desenvolvimento |
| `npx expo start --tunnel` | Iniciar com tunnel (resolve problemas de rede) |
| `npx expo start --clear` | Limpar cache e iniciar |
| `r` (no terminal) | Recarregar a app |
| `m` (no terminal) | Abrir menu de opções |

---

## Próximos Passos

Depois de testar e validar a app:
1. Podemos criar o APK para distribuição
2. Publicar na Play Store / App Store
3. Adicionar mais funcionalidades (Documentos, Vistoria)

---

## Suporte

Se tiver problemas:
1. Volte à conversa na plataforma Emergent
2. Descreva o erro que aparece
3. Envie screenshot se possível

**Boa sorte! 🚀**
