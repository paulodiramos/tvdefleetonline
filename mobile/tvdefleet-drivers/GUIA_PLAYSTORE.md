# 📱 Guia de Publicação na Play Store - TVDEFleet Drivers

## Localização da App

A aplicação Android está em: **`/app/mobile/tvdefleet-drivers/`**

### Funcionalidades da App:
- ✅ Login com credenciais do sistema
- ✅ Relógio de Ponto (Check-in/Check-out com GPS)
- ✅ Visualização de estado do turno
- ✅ Timer de tempo decorrido

### Configuração Actual:
- **API URL**: `https://tvdefleet.com/api`
- **Package Android**: `com.tvdefleet.drivers`
- **Bundle iOS**: `com.tvdefleet.drivers`
- **SDK Expo**: 54.0.0

---

## 🔧 Gerar APK para Play Store

### Pré-requisitos
1. Conta Expo (criar em https://expo.dev)
2. Conta Google Play Console ($25 taxa única)
3. Node.js instalado

### Passo 1: Instalar EAS CLI
```bash
npm install -g eas-cli
```

### Passo 2: Login no Expo
```bash
cd /app/mobile/tvdefleet-drivers
eas login
```

### Passo 3: Configurar Build
O ficheiro `eas.json` já está configurado. Apenas executar:

```bash
# Para APK de teste (distribuição interna)
eas build --platform android --profile preview

# Para APK de produção (Play Store)
eas build --platform android --profile production
```

### Passo 4: Download do APK
Após o build completar (~10-15 minutos), o Expo fornece um link para download do APK.

---

## 📤 Publicar na Play Store

### 1. Criar App no Google Play Console
1. Aceder a https://play.google.com/console
2. "Criar aplicação"
3. Preencher:
   - Nome: **TVDEFleet Drivers**
   - Idioma: Português (Portugal)
   - Tipo: Aplicação
   - Gratuita/Paga: Gratuita

### 2. Configurar Ficha da Loja
- **Título**: TVDEFleet Drivers
- **Descrição curta**: App de gestão para motoristas TVDE
- **Descrição completa**: 
  ```
  A app oficial TVDEFleet para motoristas TVDE.
  
  Funcionalidades:
  • Relógio de Ponto digital com GPS
  • Check-in e Check-out de turnos
  • Registo automático de localização
  • Sincronização com plataforma web
  
  Requisitos:
  • Conta TVDEFleet activa
  • Permissões de localização
  ```

### 3. Upload do APK
1. Ir a "Versões" > "Produção"
2. "Criar nova versão"
3. Upload do APK gerado
4. Preencher notas da versão

### 4. Classificação de Conteúdo
1. Responder questionário
2. Categoria sugerida: Negócios/Ferramentas

### 5. Preços e Distribuição
- Gratuita
- Países: Portugal (ou todos)

### 6. Submeter para Revisão
- A Google revisa em 1-3 dias úteis

---

## 🔑 Assinatura da App (Keystore)

Para publicar na Play Store, é necessário assinar o APK.

### Opção A: Usar Google Play App Signing (Recomendado)
O EAS pode gerir isto automaticamente. Na primeira vez que fizer build de produção, será criada uma keystore.

### Opção B: Keystore Manual
```bash
# Gerar keystore (fazer apenas uma vez!)
keytool -genkey -v -keystore tvdefleet-drivers.keystore -alias tvdefleet -keyalg RSA -keysize 2048 -validity 10000

# Guardar em local seguro!
# Password deve ser forte e guardada
```

---

## 📱 Testar Antes de Publicar

### Teste Local com Expo Go
```bash
cd /app/mobile/tvdefleet-drivers
npx expo start
```
Depois scan o QR code com a app Expo Go.

### Teste APK no Dispositivo
1. Após gerar APK, download para PC
2. Transferir para Android via USB/email
3. Instalar e testar todas as funcionalidades

---

## ⚠️ Checklist Antes da Publicação

- [ ] API URL aponta para `tvdefleet.com` (produção)
- [ ] Testar login com diferentes utilizadores
- [ ] Testar check-in/check-out
- [ ] Verificar permissões GPS funcionam
- [ ] Screenshots para a Play Store (5-8 imagens)
- [ ] Ícone e banner preparados
- [ ] Política de Privacidade URL
- [ ] Termos de Serviço URL

---

## 📞 Suporte

Se precisar de ajuda:
1. Volte à plataforma Emergent
2. Descreva o problema ou passo onde está bloqueado
3. Posso ajudar com configuração adicional

**A app já está pronta para gerar APK!** 🚀
