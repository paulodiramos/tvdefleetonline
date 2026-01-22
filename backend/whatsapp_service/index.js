/**
 * WhatsApp Web Service for TVDEFleet
 * Uses whatsapp-web.js to send messages via WhatsApp Web
 */

const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.WHATSAPP_SERVICE_PORT || 3001;

// Store QR code and connection status
let qrCodeData = null;
let isConnected = false;
let isReady = false;
let connectionError = null;
let clientInfo = null;

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/app/backend/whatsapp_service/.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// QR Code event - when user needs to scan
client.on('qr', async (qr) => {
    console.log('QR Code received, scan it with your phone!');
    qrCodeData = await qrcode.toDataURL(qr);
    isConnected = false;
    isReady = false;
});

// Ready event - when connected
client.on('ready', () => {
    console.log('WhatsApp Client is ready!');
    isConnected = true;
    isReady = true;
    qrCodeData = null;
    connectionError = null;
    
    // Get client info
    clientInfo = {
        pushname: client.info?.pushname || 'Unknown',
        wid: client.info?.wid?._serialized || 'Unknown',
        platform: client.info?.platform || 'Unknown'
    };
    
    console.log('Connected as:', clientInfo.pushname);
});

// Authenticated event
client.on('authenticated', () => {
    console.log('WhatsApp authenticated successfully');
    isConnected = true;
    connectionError = null;
});

// Auth failure event
client.on('auth_failure', (msg) => {
    console.error('Authentication failed:', msg);
    connectionError = 'Falha na autenticação: ' + msg;
    isConnected = false;
    isReady = false;
});

// Disconnected event
client.on('disconnected', (reason) => {
    console.log('WhatsApp disconnected:', reason);
    isConnected = false;
    isReady = false;
    connectionError = 'Desconectado: ' + reason;
});

// Initialize client
console.log('Initializing WhatsApp client...');
client.initialize().catch(err => {
    console.error('Failed to initialize WhatsApp client:', err);
    connectionError = 'Erro ao inicializar: ' + err.message;
});

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'whatsapp-web-service' });
});

// Get connection status
app.get('/status', (req, res) => {
    res.json({
        connected: isConnected,
        ready: isReady,
        hasQrCode: qrCodeData !== null,
        error: connectionError,
        clientInfo: clientInfo
    });
});

// Get QR Code for scanning
app.get('/qr', (req, res) => {
    if (isReady) {
        return res.json({
            success: true,
            connected: true,
            message: 'Já está conectado ao WhatsApp',
            clientInfo: clientInfo
        });
    }
    
    if (qrCodeData) {
        return res.json({
            success: true,
            connected: false,
            qrCode: qrCodeData,
            message: 'Escaneie o QR code com o WhatsApp do seu telemóvel'
        });
    }
    
    res.json({
        success: false,
        connected: false,
        message: connectionError || 'A inicializar... aguarde alguns segundos e tente novamente'
    });
});

// Send message
app.post('/send', async (req, res) => {
    try {
        const { phone, message } = req.body;
        
        if (!isReady) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp não está conectado. Escaneie o QR code primeiro.'
            });
        }
        
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Número de telefone e mensagem são obrigatórios'
            });
        }
        
        // Format phone number (remove +, spaces, dashes)
        let formattedPhone = phone.replace(/[\s\-\+]/g, '');
        
        // Add country code if not present (default Portugal)
        if (formattedPhone.length === 9 && formattedPhone.startsWith('9')) {
            formattedPhone = '351' + formattedPhone;
        }
        
        // Add @c.us suffix for WhatsApp
        const chatId = formattedPhone + '@c.us';
        
        console.log(`Sending message to ${chatId}`);
        
        // Check if number is registered on WhatsApp
        const isRegistered = await client.isRegisteredUser(chatId);
        
        if (!isRegistered) {
            return res.status(400).json({
                success: false,
                error: `O número ${phone} não está registado no WhatsApp`
            });
        }
        
        // Send message
        const result = await client.sendMessage(chatId, message);
        
        console.log(`Message sent successfully to ${formattedPhone}`);
        
        res.json({
            success: true,
            messageId: result.id._serialized,
            timestamp: result.timestamp,
            to: formattedPhone
        });
        
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao enviar mensagem'
        });
    }
});

// Send message to multiple recipients
app.post('/send-bulk', async (req, res) => {
    try {
        const { recipients, message } = req.body;
        
        if (!isReady) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp não está conectado'
            });
        }
        
        if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Lista de destinatários inválida'
            });
        }
        
        const results = [];
        
        for (const recipient of recipients) {
            try {
                let formattedPhone = recipient.phone.replace(/[\s\-\+]/g, '');
                
                if (formattedPhone.length === 9 && formattedPhone.startsWith('9')) {
                    formattedPhone = '351' + formattedPhone;
                }
                
                const chatId = formattedPhone + '@c.us';
                
                // Personalize message with name if provided
                let personalizedMessage = message;
                if (recipient.name) {
                    personalizedMessage = message.replace(/{nome}/g, recipient.name);
                }
                
                const isRegistered = await client.isRegisteredUser(chatId);
                
                if (!isRegistered) {
                    results.push({
                        phone: recipient.phone,
                        success: false,
                        error: 'Número não registado no WhatsApp'
                    });
                    continue;
                }
                
                await client.sendMessage(chatId, personalizedMessage);
                
                results.push({
                    phone: recipient.phone,
                    success: true
                });
                
                // Small delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                results.push({
                    phone: recipient.phone,
                    success: false,
                    error: error.message
                });
            }
        }
        
        const successCount = results.filter(r => r.success).length;
        
        res.json({
            success: true,
            total: recipients.length,
            sent: successCount,
            failed: recipients.length - successCount,
            results: results
        });
        
    } catch (error) {
        console.error('Error in bulk send:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Logout / Disconnect
app.post('/logout', async (req, res) => {
    try {
        await client.logout();
        isConnected = false;
        isReady = false;
        qrCodeData = null;
        clientInfo = null;
        
        res.json({
            success: true,
            message: 'Desconectado do WhatsApp'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Restart client
app.post('/restart', async (req, res) => {
    try {
        console.log('Restarting WhatsApp client...');
        
        if (client) {
            await client.destroy();
        }
        
        isConnected = false;
        isReady = false;
        qrCodeData = null;
        connectionError = null;
        
        // Reinitialize
        setTimeout(() => {
            client.initialize().catch(err => {
                console.error('Failed to reinitialize:', err);
                connectionError = 'Erro ao reiniciar: ' + err.message;
            });
        }, 2000);
        
        res.json({
            success: true,
            message: 'A reiniciar... aguarde alguns segundos'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp Web Service running on port ${PORT}`);
});
