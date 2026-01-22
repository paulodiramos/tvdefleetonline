/**
 * WhatsApp Web Service for TVDEFleet
 * Multi-session support - Each partner has their own WhatsApp session
 */

const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.WHATSAPP_SERVICE_PORT || 3001;

// Store multiple WhatsApp clients (one per partner)
const clients = new Map();
const clientStatus = new Map();
const qrCodes = new Map();

// Get or create a WhatsApp client for a partner
async function getOrCreateClient(parceiro_id) {
    if (clients.has(parceiro_id)) {
        return clients.get(parceiro_id);
    }
    
    console.log(`Creating new WhatsApp client for partner: ${parceiro_id}`);
    
    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: parceiro_id,
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
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-sync',
                '--disable-translate',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check',
                '--safebrowsing-disable-auto-update'
            ]
        }
    });
    
    // Initialize status
    clientStatus.set(parceiro_id, {
        connected: false,
        ready: false,
        error: null,
        clientInfo: null,
        lastActivity: new Date()
    });
    
    // QR Code event
    client.on('qr', async (qr) => {
        console.log(`QR Code received for partner ${parceiro_id}`);
        const qrDataUrl = await qrcode.toDataURL(qr);
        qrCodes.set(parceiro_id, qrDataUrl);
        
        const status = clientStatus.get(parceiro_id) || {};
        status.connected = false;
        status.ready = false;
        status.lastActivity = new Date();
        clientStatus.set(parceiro_id, status);
    });
    
    // Ready event
    client.on('ready', () => {
        console.log(`WhatsApp ready for partner ${parceiro_id}`);
        qrCodes.delete(parceiro_id);
        
        clientStatus.set(parceiro_id, {
            connected: true,
            ready: true,
            error: null,
            clientInfo: {
                pushname: client.info?.pushname || 'Unknown',
                wid: client.info?.wid?._serialized || 'Unknown',
                platform: client.info?.platform || 'Unknown'
            },
            lastActivity: new Date()
        });
    });
    
    // Authenticated event
    client.on('authenticated', () => {
        console.log(`WhatsApp authenticated for partner ${parceiro_id}`);
        const status = clientStatus.get(parceiro_id) || {};
        status.connected = true;
        status.error = null;
        status.lastActivity = new Date();
        clientStatus.set(parceiro_id, status);
    });
    
    // Auth failure event
    client.on('auth_failure', (msg) => {
        console.error(`Auth failed for partner ${parceiro_id}:`, msg);
        const status = clientStatus.get(parceiro_id) || {};
        status.connected = false;
        status.ready = false;
        status.error = 'Falha na autenticação: ' + msg;
        clientStatus.set(parceiro_id, status);
    });
    
    // Disconnected event
    client.on('disconnected', (reason) => {
        console.log(`WhatsApp disconnected for partner ${parceiro_id}:`, reason);
        clientStatus.set(parceiro_id, {
            connected: false,
            ready: false,
            error: 'Desconectado: ' + reason,
            clientInfo: null,
            lastActivity: new Date()
        });
        
        // Remove client to allow reconnection
        clients.delete(parceiro_id);
    });
    
    // Store client
    clients.set(parceiro_id, client);
    
    // Initialize
    try {
        await client.initialize();
    } catch (error) {
        console.error(`Failed to initialize client for ${parceiro_id}:`, error);
        const status = clientStatus.get(parceiro_id) || {};
        status.error = 'Erro ao inicializar: ' + error.message;
        clientStatus.set(parceiro_id, status);
    }
    
    return client;
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'whatsapp-web-service',
        activeSessions: clients.size
    });
});

// Get status for a specific partner
app.get('/status/:parceiro_id', (req, res) => {
    const { parceiro_id } = req.params;
    const status = clientStatus.get(parceiro_id);
    
    if (!status) {
        return res.json({
            connected: false,
            ready: false,
            hasQrCode: false,
            error: null,
            clientInfo: null,
            initialized: false
        });
    }
    
    res.json({
        connected: status.connected,
        ready: status.ready,
        hasQrCode: qrCodes.has(parceiro_id),
        error: status.error,
        clientInfo: status.clientInfo,
        initialized: true
    });
});

// Legacy status endpoint (for backwards compatibility)
app.get('/status', (req, res) => {
    // Return first active session or empty status
    if (clients.size === 0) {
        return res.json({
            connected: false,
            ready: false,
            hasQrCode: false,
            error: null,
            clientInfo: null
        });
    }
    
    // Get first client status
    const firstKey = clients.keys().next().value;
    const status = clientStatus.get(firstKey) || {};
    
    res.json({
        connected: status.connected || false,
        ready: status.ready || false,
        hasQrCode: qrCodes.has(firstKey),
        error: status.error,
        clientInfo: status.clientInfo
    });
});

// Initialize and get QR Code for a specific partner
app.get('/qr/:parceiro_id', async (req, res) => {
    const { parceiro_id } = req.params;
    
    try {
        // Get or create client
        await getOrCreateClient(parceiro_id);
        
        const status = clientStatus.get(parceiro_id);
        
        if (status?.ready) {
            return res.json({
                success: true,
                connected: true,
                message: 'Já está conectado ao WhatsApp',
                clientInfo: status.clientInfo
            });
        }
        
        const qrData = qrCodes.get(parceiro_id);
        if (qrData) {
            return res.json({
                success: true,
                connected: false,
                qrCode: qrData,
                message: 'Escaneie o QR code com o WhatsApp do seu telemóvel'
            });
        }
        
        res.json({
            success: false,
            connected: false,
            message: status?.error || 'A inicializar... aguarde alguns segundos e tente novamente'
        });
        
    } catch (error) {
        console.error(`Error getting QR for ${parceiro_id}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy QR endpoint
app.get('/qr', async (req, res) => {
    // For backwards compatibility, use 'default' as parceiro_id
    req.params.parceiro_id = 'default';
    return app._router.handle(req, res, () => {});
});

// Send message for a specific partner
app.post('/send/:parceiro_id', async (req, res) => {
    const { parceiro_id } = req.params;
    const { phone, message } = req.body;
    
    try {
        const status = clientStatus.get(parceiro_id);
        
        if (!status?.ready) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp não está conectado para este parceiro. Escaneie o QR code primeiro.'
            });
        }
        
        const client = clients.get(parceiro_id);
        if (!client) {
            return res.status(400).json({
                success: false,
                error: 'Cliente WhatsApp não encontrado'
            });
        }
        
        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Número de telefone e mensagem são obrigatórios'
            });
        }
        
        // Format phone number
        let formattedPhone = phone.replace(/[\s\-\+]/g, '');
        
        if (formattedPhone.length === 9 && formattedPhone.startsWith('9')) {
            formattedPhone = '351' + formattedPhone;
        }
        
        const chatId = formattedPhone + '@c.us';
        
        console.log(`[${parceiro_id}] Sending message to ${chatId}`);
        
        // Check if registered
        const isRegistered = await client.isRegisteredUser(chatId);
        
        if (!isRegistered) {
            return res.status(400).json({
                success: false,
                error: `O número ${phone} não está registado no WhatsApp`
            });
        }
        
        // Send message using WWebJS internal function to avoid sendSeen bug
        const result = await client.pupPage.evaluate(async (chatId, msg) => {
            const chat = await window.Store.Chat.get(chatId);
            if (!chat) {
                throw new Error('Chat não encontrado');
            }
            
            // Create message
            const msgResult = await window.WWebJS.sendMessage(chat, msg, {}, {});
            
            return {
                id: msgResult.id ? msgResult.id._serialized : 'sent',
                timestamp: msgResult.t || Math.floor(Date.now() / 1000)
            };
        }, chatId, message);
        
        // Update last activity
        const currentStatus = clientStatus.get(parceiro_id);
        if (currentStatus) {
            currentStatus.lastActivity = new Date();
            clientStatus.set(parceiro_id, currentStatus);
        }
        
        console.log(`[${parceiro_id}] Message sent to ${formattedPhone}`);
        
        res.json({
            success: true,
            messageId: result.id._serialized,
            timestamp: result.timestamp,
            to: formattedPhone
        });
        
    } catch (error) {
        console.error(`[${parceiro_id}] Error sending message:`, error);
        res.status(500).json({
            success: false,
            error: error.message || 'Erro ao enviar mensagem'
        });
    }
});

// Legacy send endpoint
app.post('/send', async (req, res) => {
    const { phone, message, parceiro_id } = req.body;
    
    if (parceiro_id) {
        req.params.parceiro_id = parceiro_id;
        req.body = { phone, message };
        
        // Find the route handler for /send/:parceiro_id
        const status = clientStatus.get(parceiro_id);
        
        if (!status?.ready) {
            return res.status(400).json({
                success: false,
                error: 'WhatsApp não está conectado. Escaneie o QR code primeiro.'
            });
        }
        
        const client = clients.get(parceiro_id);
        if (!client) {
            return res.status(400).json({
                success: false,
                error: 'Cliente WhatsApp não encontrado'
            });
        }
        
        try {
            let formattedPhone = phone.replace(/[\s\-\+]/g, '');
            if (formattedPhone.length === 9 && formattedPhone.startsWith('9')) {
                formattedPhone = '351' + formattedPhone;
            }
            
            const chatId = formattedPhone + '@c.us';
            const isRegistered = await client.isRegisteredUser(chatId);
            
            if (!isRegistered) {
                return res.status(400).json({
                    success: false,
                    error: `O número ${phone} não está registado no WhatsApp`
                });
            }
            
            // Use getChatById to avoid sendSeen bug
            const chat = await client.getChatById(chatId);
            const result = await chat.sendMessage(message);
            
            return res.json({
                success: true,
                messageId: result.id._serialized,
                timestamp: result.timestamp,
                to: formattedPhone
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
    
    // If no parceiro_id, use first available client
    if (clients.size === 0) {
        return res.status(400).json({
            success: false,
            error: 'Nenhuma sessão WhatsApp ativa'
        });
    }
    
    const firstKey = clients.keys().next().value;
    req.params.parceiro_id = firstKey;
    
    // Recursive call with parceiro_id
    req.body.parceiro_id = firstKey;
    return app._router.handle(req, res, () => {});
});

// Send bulk messages for a partner
app.post('/send-bulk/:parceiro_id', async (req, res) => {
    const { parceiro_id } = req.params;
    const { recipients, message } = req.body;
    
    const status = clientStatus.get(parceiro_id);
    
    if (!status?.ready) {
        return res.status(400).json({
            success: false,
            error: 'WhatsApp não está conectado'
        });
    }
    
    const client = clients.get(parceiro_id);
    if (!client || !recipients || !Array.isArray(recipients)) {
        return res.status(400).json({
            success: false,
            error: 'Dados inválidos'
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
            
            // Use getChatById to avoid sendSeen bug
            const chat = await client.getChatById(chatId);
            await chat.sendMessage(personalizedMessage);
            
            results.push({
                phone: recipient.phone,
                success: true
            });
            
            // Delay between messages
            await new Promise(resolve => setTimeout(resolve, 1500));
            
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
});

// Logout a specific partner
app.post('/logout/:parceiro_id', async (req, res) => {
    const { parceiro_id } = req.params;
    
    try {
        const client = clients.get(parceiro_id);
        
        if (client) {
            await client.logout();
            await client.destroy();
            clients.delete(parceiro_id);
        }
        
        clientStatus.delete(parceiro_id);
        qrCodes.delete(parceiro_id);
        
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

// Legacy logout
app.post('/logout', async (req, res) => {
    const { parceiro_id } = req.body;
    if (parceiro_id) {
        req.params.parceiro_id = parceiro_id;
    } else if (clients.size > 0) {
        req.params.parceiro_id = clients.keys().next().value;
    } else {
        return res.json({ success: true, message: 'Nenhuma sessão ativa' });
    }
    
    const client = clients.get(req.params.parceiro_id);
    if (client) {
        try {
            await client.logout();
            await client.destroy();
        } catch (e) {}
        clients.delete(req.params.parceiro_id);
    }
    clientStatus.delete(req.params.parceiro_id);
    qrCodes.delete(req.params.parceiro_id);
    
    res.json({ success: true, message: 'Desconectado' });
});

// Restart a specific partner's session
app.post('/restart/:parceiro_id', async (req, res) => {
    const { parceiro_id } = req.params;
    
    try {
        console.log(`Restarting WhatsApp for partner ${parceiro_id}...`);
        
        const client = clients.get(parceiro_id);
        if (client) {
            try {
                await client.destroy();
            } catch (e) {}
            clients.delete(parceiro_id);
        }
        
        clientStatus.delete(parceiro_id);
        qrCodes.delete(parceiro_id);
        
        // Reinitialize after a short delay
        setTimeout(async () => {
            await getOrCreateClient(parceiro_id);
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

// Legacy restart
app.post('/restart', async (req, res) => {
    const { parceiro_id } = req.body;
    if (parceiro_id) {
        req.params.parceiro_id = parceiro_id;
    } else {
        req.params.parceiro_id = 'default';
    }
    
    const client = clients.get(req.params.parceiro_id);
    if (client) {
        try { await client.destroy(); } catch (e) {}
        clients.delete(req.params.parceiro_id);
    }
    clientStatus.delete(req.params.parceiro_id);
    qrCodes.delete(req.params.parceiro_id);
    
    setTimeout(async () => {
        await getOrCreateClient(req.params.parceiro_id);
    }, 2000);
    
    res.json({ success: true, message: 'A reiniciar...' });
});

// List all active sessions (admin)
app.get('/sessions', (req, res) => {
    const sessions = [];
    
    for (const [parceiro_id, status] of clientStatus.entries()) {
        sessions.push({
            parceiro_id,
            connected: status.connected,
            ready: status.ready,
            clientInfo: status.clientInfo,
            lastActivity: status.lastActivity,
            hasQrCode: qrCodes.has(parceiro_id)
        });
    }
    
    res.json({
        total: sessions.length,
        sessions
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp Web Service (Multi-Session) running on port ${PORT}`);
});
