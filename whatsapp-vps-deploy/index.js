/**
 * WhatsApp Web Service for TVDEFleet
 * Deploy em VPS externo (Railway, Render, DigitalOcean)
 */

const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS configurado para aceitar requests do Emergent
app.use(cors({
    origin: [
        'https://tvdefleet.com',
        'https://www.tvdefleet.com',
        /\.emergentagent\.com$/,
        /\.preview\.emergentagent\.com$/,
        'http://localhost:3000'
    ],
    credentials: true
}));

app.use(express.json());

const PORT = process.env.PORT || 3001;
const AUTH_PATH = process.env.AUTH_PATH || '/app/.wwebjs_auth';

// Chromium paths
const CHROMIUM_PATHS = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    process.env.PUPPETEER_EXECUTABLE_PATH
].filter(Boolean);

// Find Chromium
function findChromium() {
    for (const p of CHROMIUM_PATHS) {
        if (fs.existsSync(p)) {
            console.log(`✅ Chromium found: ${p}`);
            return p;
        }
    }
    console.error('❌ Chromium not found!');
    return null;
}

const CHROMIUM_PATH = findChromium();

// Storage for clients
const clients = new Map();
const clientStatus = new Map();
const qrCodes = new Map();

// Clean lock files
function cleanLocks(sessionDir) {
    const locks = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    locks.forEach(lock => {
        const lockPath = path.join(sessionDir, 'Default', lock);
        try {
            if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
        } catch (e) { /* ignore */ }
    });
}

// Create WhatsApp client
async function getOrCreateClient(parceiro_id) {
    if (clients.has(parceiro_id)) {
        const existingClient = clients.get(parceiro_id);
        const status = clientStatus.get(parceiro_id);
        
        // If client exists and is ready, return it
        if (status?.ready) {
            return existingClient;
        }
    }

    if (!CHROMIUM_PATH) {
        throw new Error('Chromium not available');
    }

    const sessionDir = path.join(AUTH_PATH, `session-${parceiro_id}`);
    if (fs.existsSync(sessionDir)) {
        cleanLocks(sessionDir);
    }

    console.log(`Creating client for: ${parceiro_id}`);

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: parceiro_id,
            dataPath: AUTH_PATH
        }),
        puppeteer: {
            headless: true,
            executablePath: CHROMIUM_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    // Event handlers
    client.on('qr', async (qr) => {
        console.log(`QR received for ${parceiro_id}`);
        const qrDataUrl = await qrcode.toDataURL(qr);
        qrCodes.set(parceiro_id, qrDataUrl);
        clientStatus.set(parceiro_id, {
            connected: false,
            ready: false,
            hasQrCode: true
        });
    });

    client.on('ready', () => {
        console.log(`✅ Client ready: ${parceiro_id}`);
        qrCodes.delete(parceiro_id);
        clientStatus.set(parceiro_id, {
            connected: true,
            ready: true,
            hasQrCode: false
        });
    });

    client.on('authenticated', () => {
        console.log(`Authenticated: ${parceiro_id}`);
        clientStatus.set(parceiro_id, {
            connected: true,
            ready: false,
            hasQrCode: false,
            authenticating: true
        });
    });

    client.on('auth_failure', (msg) => {
        console.error(`Auth failure ${parceiro_id}:`, msg);
        clientStatus.set(parceiro_id, {
            connected: false,
            ready: false,
            error: 'Authentication failed'
        });
    });

    client.on('disconnected', (reason) => {
        console.log(`Disconnected ${parceiro_id}:`, reason);
        clients.delete(parceiro_id);
        clientStatus.set(parceiro_id, {
            connected: false,
            ready: false
        });
    });

    clients.set(parceiro_id, client);

    try {
        await client.initialize();
    } catch (error) {
        console.error(`Init error ${parceiro_id}:`, error.message);
        clientStatus.set(parceiro_id, {
            connected: false,
            ready: false,
            error: error.message
        });
    }

    return client;
}

// ==================== API ENDPOINTS ====================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: CHROMIUM_PATH ? 'ok' : 'limited',
        chromium: {
            available: !!CHROMIUM_PATH,
            path: CHROMIUM_PATH
        },
        activeSessions: clients.size,
        timestamp: new Date().toISOString()
    });
});

// Get status
app.get('/status/:parceiro_id', (req, res) => {
    const { parceiro_id } = req.params;
    const status = clientStatus.get(parceiro_id) || {
        connected: false,
        ready: false,
        hasQrCode: false
    };
    res.json(status);
});

// Initialize client
app.get('/initialize/:parceiro_id', async (req, res) => {
    try {
        const { parceiro_id } = req.params;
        await getOrCreateClient(parceiro_id);
        
        // Wait for QR
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const status = clientStatus.get(parceiro_id) || {};
        res.json({
            success: true,
            status,
            hasQrCode: qrCodes.has(parceiro_id)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get QR Code
app.get('/qr/:parceiro_id', async (req, res) => {
    try {
        const { parceiro_id } = req.params;
        
        if (!clients.has(parceiro_id)) {
            await getOrCreateClient(parceiro_id);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const qrCode = qrCodes.get(parceiro_id);
        if (qrCode) {
            res.json({ success: true, qr: qrCode });
        } else {
            const status = clientStatus.get(parceiro_id);
            if (status?.ready) {
                res.json({ success: true, ready: true, connected: true, message: 'Already connected' });
            } else if (status?.authenticating) {
                res.json({ success: false, message: 'Authenticating, please wait...' });
            } else {
                res.json({ success: false, message: 'QR not ready yet, please try again in a few seconds' });
            }
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send message - accepts both formats: {phone, message} or {telefone, mensagem}
app.post('/send/:parceiro_id', async (req, res) => {
    try {
        const { parceiro_id } = req.params;
        // Accept both field name formats
        const telefone = req.body.telefone || req.body.phone || req.body.phone_number;
        const mensagem = req.body.mensagem || req.body.message;

        if (!telefone || !mensagem) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: telefone/phone and mensagem/message' 
            });
        }

        const client = clients.get(parceiro_id);
        if (!client) {
            return res.status(400).json({ 
                success: false, 
                error: 'Client not initialized. Please scan QR code first.' 
            });
        }

        const status = clientStatus.get(parceiro_id);
        if (!status?.ready) {
            return res.status(400).json({ 
                success: false, 
                error: 'Client not ready. Please wait for connection or scan QR code again.' 
            });
        }

        // Format phone number
        let numero = telefone.replace(/\D/g, '');
        if (!numero.startsWith('351')) {
            numero = '351' + numero;
        }
        numero = numero + '@c.us';

        // Send message with error handling for known whatsapp-web.js bugs
        try {
            const result = await client.sendMessage(numero, mensagem);
            res.json({ 
                success: true, 
                message: 'Message sent',
                messageId: result?.id?._serialized || result?.id || 'sent'
            });
        } catch (sendError) {
            // Known bug: "Cannot read properties of undefined (reading 'markedUnread')"
            // This error often occurs AFTER the message is sent successfully
            if (sendError.message && sendError.message.includes('markedUnread')) {
                console.log(`Message likely sent despite error: ${sendError.message}`);
                res.json({ 
                    success: true, 
                    message: 'Message sent (with warning)',
                    warning: 'Message was sent but confirmation had issues'
                });
            } else {
                throw sendError;
            }
        }
    } catch (error) {
        console.error(`Send error:`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout (disconnect session)
app.post('/logout/:parceiro_id', async (req, res) => {
    try {
        const { parceiro_id } = req.params;
        const client = clients.get(parceiro_id);
        
        if (client) {
            await client.logout();
            await client.destroy();
            clients.delete(parceiro_id);
            clientStatus.delete(parceiro_id);
            qrCodes.delete(parceiro_id);
            
            // Remove session files
            const sessionDir = path.join(AUTH_PATH, `session-${parceiro_id}`);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
        }
        
        res.json({ success: true, message: 'Logged out and session cleared' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Restart client
app.post('/restart/:parceiro_id', async (req, res) => {
    try {
        const { parceiro_id } = req.params;
        
        // Destroy existing client if any
        const existingClient = clients.get(parceiro_id);
        if (existingClient) {
            try {
                await existingClient.destroy();
            } catch (e) { /* ignore */ }
            clients.delete(parceiro_id);
        }
        
        clientStatus.delete(parceiro_id);
        qrCodes.delete(parceiro_id);
        
        // Create new client
        await getOrCreateClient(parceiro_id);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const status = clientStatus.get(parceiro_id) || {};
        res.json({ 
            success: true, 
            message: 'Client restarted',
            status,
            hasQrCode: qrCodes.has(parceiro_id)
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Disconnect (without logout - keeps session)
app.post('/disconnect/:parceiro_id', async (req, res) => {
    try {
        const { parceiro_id } = req.params;
        const client = clients.get(parceiro_id);
        
        if (client) {
            await client.destroy();
            clients.delete(parceiro_id);
            clientStatus.delete(parceiro_id);
            qrCodes.delete(parceiro_id);
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all sessions (admin)
app.get('/sessions', (req, res) => {
    const sessions = [];
    for (const [parceiro_id, status] of clientStatus.entries()) {
        sessions.push({
            parceiro_id,
            ...status
        });
    }
    res.json({
        total: sessions.length,
        sessions
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('==========================================');
    console.log(`WhatsApp Service running on port ${PORT}`);
    console.log(`Chromium: ${CHROMIUM_PATH || 'NOT FOUND'}`);
    console.log('==========================================');
});
