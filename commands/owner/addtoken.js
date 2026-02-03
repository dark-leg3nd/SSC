// commands/mod/addtoken.js
import { resolveLidToRealJid } from "../../lib/utils.js";

export default {
  command: ['addtoken'],
  isOwner: true,
  run: async (client, m, args, command) => {
    if (!args[0])
      return client.reply(m.chat, '❌ Debes mencionar a un usuario o poner su número.', m);

    const db = global.db.data;
    db.premUsers = db.premUsers || {}; // Base de tokens Premium

    // Resolver JID del usuario
    let userJid = args[0].includes('@') ? args[0] : args[0] + '@s.whatsapp.net';
    try { userJid = await resolveLidToRealJid(userJid, client, m.chat); } catch {}

    // Generar token automático
    const token = Math.random().toString(36).slice(2, 10).toUpperCase();

    // Guardar token en DB
    db.premUsers[userJid] = token;

    return client.reply(
      m.chat,
      `✅ Token asignado a ${userJid} : *${token}*\n> El usuario ahora puede usarlo con:\n\`codeprem ${token}\``,
      m
    );
  }
};