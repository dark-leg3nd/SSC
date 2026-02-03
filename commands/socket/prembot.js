// commands/premium/codeprem.js
import { startPremBot } from '../../lib/prem.js';

let commandFlags = [];
const premCooldown = {};

export default {
  command: ['codeprem'],
  run: async (client, m, args, command) => {
    const sender = m.sender;
    const db = global.db.data;
    db.premUsers = db.premUsers || {};
    const now = Date.now();

    if (!args[0])
      return client.reply(m.chat, '❌ Debes ingresar tu token asignado.', m);

    const userToken = args[0].toUpperCase();
    const myToken = db.premUsers[sender];

    // Verificar si tiene token
    if (!myToken)
      return client.reply(m.chat, '❌ No tienes ningún token asignado. Pide uno al owner.', m);

    // Cooldown de 2 minutos
    if (premCooldown[sender] && now - premCooldown[sender] < 120_000) {
      const remaining = 120_000 - (now - premCooldown[sender]);
      return client.reply(m.chat, `⏳ Espera ${msToTime(remaining)} antes de intentar nuevamente.`, m);
    }

    // Verificar token
    if (userToken !== myToken)
      return client.reply(m.chat, '❌ Token incorrecto. Intenta nuevamente.', m);

    // Token correcto → iniciar Premium-Bot y generar código de Baileys
    const phone = sender.split('@')[0];
    const caption = `\`✤\` Generando tu *Premium-Bot*...\n\n> 💠 Token: ${userToken}`;

    commandFlags[sender] = true;
    const sock = await startPremBot(m, client, caption, true, phone, m.chat, commandFlags, true);

    // El startPremBot ya devuelve un socket con QR o código
    // Si quieres que se envíe automáticamente el código generado de Baileys:
    if (sock?.lastPairingCode) {
      await client.sendMessage(
        m.chat,
        { text: `🔑 Tu código de vinculación es:\n\n${sock.lastPairingCode}` },
        { quoted: m }
      );
    }

    // Guardar cooldown y eliminar token usado
    premCooldown[sender] = now;
    delete db.premUsers[sender];

    return client.reply(m.chat, `✅ Premium-Bot vinculado correctamente usando tu token.`, m);
  }
};

// Función para cooldown
function msToTime(duration) {
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / 60000) % 60);

  if (minutes) {
    return `${minutes} minuto${minutes > 1 ? 's' : ''}, ${seconds} segundo${seconds > 1 ? 's' : ''}`;
  } else {
    return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
  }
}