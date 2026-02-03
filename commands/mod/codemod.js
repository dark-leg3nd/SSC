import { startModBot } from '../../lib/mods.js';

export default {
  command: ['codemod'],
  isOwner: true,
  run: async (client, m, args) => {
    const phone = args[0] ? args[0].replace(/\D/g, '') : m.sender.split('@')[0];
    const caption = '✤ Usa este código para vincular tu Mod-Bot';
    
    const sock = await startModBot(m, client, caption, phone, m.chat);
    
    const code = sock.lastPairingCode || 'Error generando código';
    m.reply(`✅ Código de vinculación Mod-Bot:\n\n*${code}*`);
  }
};
