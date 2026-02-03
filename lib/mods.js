import {
  Browsers,
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  jidDecode,
  DisconnectReason,
} from '@whiskeysockets/baileys';
import NodeCache from 'node-cache';
import chalk from 'chalk';
import { smsg } from './message.js';
import fs from 'fs';

const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
const groupCache = new NodeCache({ stdTTL: 3600, checkperiod: 300 });

let reintentos = {};

const cleanJid = (jid = '') => jid.replace(/:\d+/, '').split('@')[0];

export async function startModBot(m, client, caption = '', phone = '', chatId = '') {
  const id = phone || (m?.sender || '').split('@')[0];
  const sessionFolder = `./Sessions/Mods/${id}`;

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: undefined,
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

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      sock.isInit = true;
      sock.userId = cleanJid(sock.user?.id?.split('@')[0]);
      const botDir = sock.userId + '@s.whatsapp.net';
      if (!global.db.data.settings[botDir]) global.db.data.settings[botDir] = {};
      global.db.data.settings[botDir].type = 'Mod';
      if (!global.conns.find((c) => c.userId === sock.userId)) global.conns.push(sock);
      console.log(chalk.green(`[ MOD-BOT ] Conectado: ${sock.userId}`));
    }

    if (connection === 'close') {
      const botId = sock.userId || id;
      const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.reason || 0;
      const intentos = reintentos[botId] || 0;
      reintentos[botId] = intentos + 1;

      if ([DisconnectReason.connectionClosed, DisconnectReason.connectionLost, DisconnectReason.timedOut, DisconnectReason.connectionReplaced].includes(reason)) {
        setTimeout(() => startModBot(m, client, caption, phone, chatId), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (let raw of messages) {
      if (!raw.message) continue;
      let msg = await smsg(sock, raw);
      try {
        // Aquí podrías usar handler si quieres comandos para Mod
      } catch (err) {
        console.log(chalk.gray(`[ MOD-BOT ] ${err}`));
      }
    }
  });

  return sock;
}