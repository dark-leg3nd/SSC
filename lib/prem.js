import {
  Browsers,
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  jidDecode,
} from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import handler from '../handler.js';
import events from '../commands/events.js';
import pino from 'pino';
import fs from 'fs';
import chalk from 'chalk';
import { smsg } from './message.js';

if (!global.connsPrem) global.connsPrem = [];
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const groupCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });
let reintentosPrem = {};

const cleanJid = (jid = '') => jid.replace(/:\d+/, '').split('@')[0];

export async function startPremBot(
  m,
  client,
  caption = '',
  isCode = false,
  phone = '',
  chatId = '',
  commandFlags = {},
  isCommand = false,
  token = ''
) {
  const id = phone || (m?.sender || '').split('@')[0];
  const sessionFolder = `./Sessions/Prem/${id}`;
  const senderId = m?.sender;

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS('Chrome'),
    auth: state,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    syncFullHistory: false,
    getMessage: async () => '',
    msgRetryCounterCache,
    userDevicesCache,
    cachedGroupMetadata: async (jid) => groupCache.get(jid),
    version,
    keepAliveIntervalMs: 60_000,
    maxIdleTimeMs: 120_000,
  });

  sock.isInit = false;
  sock.ev.on('creds.update', saveCreds);
  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
    } else return jid;
  };

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr, isNewLogin }) => {
    if (connection === 'open') {
      sock.uptime = Date.now();
      sock.isInit = true;
      sock.userId = cleanJid(sock.user?.id?.split('@')[0]);
      const botDir = sock.userId + '@s.whatsapp.net';

      if (!globalThis.db.data.settings[botDir]) globalThis.db.data.settings[botDir] = {};
      globalThis.db.data.settings[botDir].botprem = true;
      globalThis.db.data.settings[botDir].botmod = false;
      globalThis.db.data.settings[botDir].type = 'Prem';

      if (!global.connsPrem.find(c => c.userId === sock.userId)) global.connsPrem.push(sock);
      delete reintentosPrem[sock.userId || id];

      console.log(chalk.green(`[ ✿ ] PREMIUM-BOT conectado: ${sock.userId}`));
    }

    if (connection === 'close') {
      const botId = sock.userId || id;
      const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.reason || 0;
      const intentos = reintentosPrem[botId] || 0;
      reintentosPrem[botId] = intentos + 1;

      if ([401, 403].includes(reason) && intentos < 5) {
        console.log(chalk.yellow(`[ ✿ ] PREMIUM-BOT ${botId} cerrado, reintentando ${intentos}/5...`));
        setTimeout(() => startPremBot(m, client, caption, isCode, phone, chatId, {}, isCommand, token), 3000);
      }
    }

    if (qr && isCode && phone && client && chatId && commandFlags[senderId] && token) {
      try {
        // Genera código de vinculación usando token único
        let codeGen = await sock.requestPairingCode(phone, token);
        codeGen = codeGen.match(/.{1,4}/g)?.join("-") || codeGen;

        const msg = await client.sendMessage(chatId, { text: caption });
        const msgCode = await client.sendMessage(chatId, { text: codeGen });
        delete commandFlags[senderId];

        setTimeout(async () => {
          try {
            await client.sendMessage(chatId, { delete: msg.key });
            await client.sendMessage(chatId, { delete: msgCode.key });
          } catch {}
        }, 60000);
      } catch (err) {
        console.error("[Código Error]", err);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (let raw of messages) {
      if (!raw.message) continue;
      let msg = await smsg(sock, raw);
      try { handler(sock, msg, messages); } 
      catch (err) { console.log(chalk.gray(`[ ✿ ] Prem » ${err}`)); }
    }
  });

  try { await events(sock, m); } catch (err) { console.log(chalk.gray(`[ BOT ] → ${err}`)); }

  process.on('uncaughtException', console.error);
  return sock;
}