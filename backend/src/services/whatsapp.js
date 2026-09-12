const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');

let client;
let clientState = 'starting';
let initializationPromise;

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function buildStatusMessage(order, previousStatus) {
  return [
    `Olá, ${order.cliente}!`,
    `A ordem de serviço ${order.protocolo} foi atualizada.`,
    `Status anterior: ${previousStatus}`,
    `Novo status: ${order.status}`,
    order.observacao ? `Observação: ${order.observacao}` : '',
    'Em caso de dúvidas, entre em contato conosco.',
  ].filter(Boolean).join('\n');
}

function createClient() {
  const nextClient = new Client({
    authStrategy: new LocalAuth({ clientId: 'infortec', dataPath: path.join(__dirname, '../../.wwebjs_auth') }),
    puppeteer: {
      headless: process.env.WHATSAPP_WEB_HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  nextClient.on('qr', (qr) => {
    clientState = 'qr_required';
    console.log('WhatsApp Web precisa ser vinculado. Escaneie este QR Code:');
    qrcode.generate(qr, { small: true });
  });
  nextClient.on('authenticated', () => {
    clientState = 'authenticated';
    console.log('WhatsApp Web autenticado.');
  });
  nextClient.on('ready', () => {
    clientState = 'ready';
    console.log('WhatsApp Web pronto para enviar mensagens.');
  });
  nextClient.on('auth_failure', (message) => {
    clientState = 'auth_failure';
    console.error('Falha na autenticação do WhatsApp Web:', message);
  });
  nextClient.on('disconnected', (reason) => {
    clientState = 'disconnected';
    console.warn('WhatsApp Web desconectado:', reason);
  });

  return nextClient;
}

function initializeWhatsApp() {
  if (initializationPromise) return initializationPromise;
  client = createClient();
  initializationPromise = client.initialize().catch((error) => {
    clientState = 'error';
    console.error('Não foi possível iniciar o WhatsApp Web:', error.message);
  });
  return initializationPromise;
}

function getWhatsAppStatus() {
  return clientState;
}

async function notifyOrderStatus({ order, previousStatus }) {
  const recipient = normalizePhone(order.whatsapp || order.telefone);
  if (!recipient) return { sent: false, skipped: true, reason: 'CUSTOMER_PHONE_NOT_FOUND' };
  if (clientState !== 'ready' || !client) return { sent: false, skipped: true, reason: `WHATSAPP_WEB_${clientState.toUpperCase()}` };

  await client.sendMessage(`${recipient}@c.us`, buildStatusMessage(order, previousStatus));
  return { sent: true, channel: 'whatsapp-web' };
}

module.exports = { getWhatsAppStatus, initializeWhatsApp, notifyOrderStatus };
