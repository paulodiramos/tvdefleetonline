# 📱 Guia Passo-a-Passo: Gerar APK TVDEFleet

## PASSO 1: Descarregar o Código

No chat do Emergent, procure o botão **"Download Code"** (ícone de download ⬇️)

![Download](https://static.prod-images.emergentagent.com/jobs/7b5f3ac7-a36f-4a76-945b-737623249c42/images/1da2e58e4e2c8a025d327a117a7ed3681643ac00696b43e19840605afe9eb4d2.png)

**Acção:** Clique no botão para descarregar um ficheiro ZIP

---

## PASSO 2: Extrair o ZIP

1. Localize o ficheiro ZIP na pasta **Downloads**
2. **Clique com botão direito** → **"Extrair tudo"** (Windows) ou duplo-clique (Mac)
3. Escolha um local para extrair (ex: Desktop)

---

## PASSO 3: Abrir o Terminal/Prompt de Comandos

### Windows:
- Prima **Win + R**
- Escreva **cmd** e prima Enter
- Ou procure por **"PowerShell"** no menu Iniciar

### Mac:
- Prima **Cmd + Espaço**
- Escreva **Terminal** e prima Enter

### Linux:
- Prima **Ctrl + Alt + T**

---

## PASSO 4: Navegar até à Pasta

![Estrutura de Pastas](https://static.prod-images.emergentagent.com/jobs/7b5f3ac7-a36f-4a76-945b-737623249c42/images/44d30eb0465480fd3eed6e2464d37db5e97b2aeda034092d5af0bf058b8662ac.png)

### Comandos para navegar:

**Windows (se extraiu para Downloads):**
```
cd %USERPROFILE%\Downloads\[NOME-DA-PASTA-EXTRAIDA]\mobile\tvdefleet-drivers
```

**Mac/Linux:**
```
cd ~/Downloads/[NOME-DA-PASTA-EXTRAIDA]/mobile/tvdefleet-drivers
```

> 💡 **Dica:** Substitua `[NOME-DA-PASTA-EXTRAIDA]` pelo nome real da pasta

---

## PASSO 5: Instalar Dependências

![Terminal](https://static.prod-images.emergentagent.com/jobs/7b5f3ac7-a36f-4a76-945b-737623249c42/images/8f2d13ff5e4fcd0af20f0f1d7cb1aef062a1b3d27a37446bb20f69c728b04a16.png)

Execute estes comandos **um de cada vez**:

```bash
npm install
```
*(Aguarde terminar - pode demorar 1-2 minutos)*

```bash
npm install -g eas-cli
```

---

## PASSO 6: Login no Expo

```bash
eas login
```

Quando pedir:
- **Email:** paulodiramos@gmail.com
- **Password:** (a sua password do Expo)

---

## PASSO 7: Inicializar o Projeto

```bash
eas project:init
```

Quando perguntar se quer criar o projeto, escreva **Y** e prima Enter.

---

## PASSO 8: Gerar o APK

```bash
eas build --platform android --profile production
```

⏱️ **Este passo demora 10-15 minutos**

No final, receberá um **link para download do APK**.

---

## PASSO 9: Publicar na Play Store

1. Descarregue o APK do link fornecido
2. Aceda a https://play.google.com/console
3. Crie uma nova aplicação ou actualize a existente
4. Faça upload do APK na secção "Produção"

---

## ❓ Problemas Comuns

### "npm não é reconhecido como comando"
- Instale o Node.js: https://nodejs.org/

### "eas não é reconhecido"
- Execute: `npm install -g eas-cli`

### "Erro de permissões" (Mac/Linux)
- Use: `sudo npm install -g eas-cli`

---

## 📞 Precisa de Ajuda?

Volte ao chat do Emergent e descreva o erro que aparece.

