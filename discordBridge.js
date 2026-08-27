const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const chalk = require('chalk');
const stats = require('./stats');

let discordClient = null;

/**
 * Discord Çift Yönlü Komut Köprüsü
 */
function initDiscordBridge(botControl, config) {
  if (!config.discord || !config.discord.botToken || config.discord.botToken.trim() === '') {
    return;
  }

  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  discordClient.on('ready', () => {
    console.log(chalk.magenta.bold(`[DISCORD BOT] Discord botu aktif: ${discordClient.user.tag}`));
  });

  discordClient.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Belirli bir kanal kısıtlaması varsa kontrol et
    if (config.discord.channelId && config.discord.channelId.trim() !== '') {
      if (message.channel.id !== config.discord.channelId) return;
    }

    const content = message.content.trim();
    if (!content.startsWith('!')) return;

    const args = content.slice(1).split(/ +/);
    const cmd = args.shift().toLowerCase();

    const bot = botControl.getBot();

    // 1. !yardim / !help
    if (cmd === 'yardim' || cmd === 'help' || cmd === 'komutlar') {
      const embed = new EmbedBuilder()
        .setTitle('⛏️ Minecraft VIP Bot - Discord Komutları')
        .setColor(3447003)
        .setDescription('Discord üzerinden Minecraft botunuza şu komutlarla anlık emir verebilirsiniz:')
        .addFields(
          { name: '`!durum`', value: 'Botun canı, açlığı, konumu ve elindeki kazmayı gösterir.', inline: true },
          { name: '`!istatistik`', value: 'Saatlik kazma hızı, süre ve kırılan toplam maden tablosu.', inline: true },
          { name: '`!envanter`', value: 'Botun çantasındaki tüm eşyaları listeler.', inline: true },
          { name: '`!depola` / `!pv`', value: 'Dolmasını beklemeden hemen madenleri /pv kasalarına aktarır.', inline: true },
          { name: '`!dur` / `!stop`', value: 'Madenciliği duraklatır (sunucuda bekler).', inline: true },
          { name: '`!basla` / `!start`', value: 'Madenciliği başlatır veya devam ettirir.', inline: true },
          { name: '`!tamir`', value: 'Kazmaları tamir etme komutunu (/fix all) gönderir.', inline: true },
          { name: '`!copat`', value: 'Taş, çakıl, netherrack gibi çöpleri yere fırlatır.', inline: true },
          { name: '`!warp [isim]`', value: 'VIP alanına veya belirtilen warpa ışınlanır.', inline: true },
          { name: '`!cmd <komut>`', value: 'Sunucuya özel komut gönderir (örn: `!cmd /spawn`).', inline: true },
          { name: '`!cikis`', value: 'Botu sunucudan çıkarır ve kapatır.', inline: true }
        )
        .setFooter({ text: 'Antigravity VIP Discord Controller' })
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    if (!bot) {
      return message.reply('❌ Bot şu anda Minecraft sunucusuna bağlı değil.');
    }

    // 2. !durum
    if (cmd === 'durum' || cmd === 'status' || cmd === 'info') {
      const pos = bot.entity ? bot.entity.position.floored() : { x: 0, y: 0, z: 0 };
      const health = bot.health || 0;
      const food = bot.food || 0;
      const emptySlots = bot.inventory ? bot.inventory.emptySlotCount() : 0;
      const stateStr = botControl.isPaused()
        ? '🔴 DURAKLATILDI'
        : botControl.isDepositing()
        ? '🟣 PV DEPOLANIYOR'
        : botControl.isMining()
        ? '🟢 MADEN KAZIYOR'
        : '🟡 BEKLEMEDE';

      const held = bot.heldItem;
      let heldStr = 'Boş';
      if (held) {
        const maxD = held.maxDurability || 1561;
        const remD = maxD - (held.durabilityUsed || 0);
        heldStr = `${held.name} (${remD}/${maxD} Can)`;
      }

      const embed = new EmbedBuilder()
        .setTitle('🤖 Bot Anlık Durum Raporu')
        .setColor(health > 10 ? 65280 : 16711680)
        .addFields(
          { name: 'Durum', value: stateStr, inline: true },
          { name: 'Sağlık & Açlık', value: `❤️ **${health}/20** | 🍗 **${food}/20**`, inline: true },
          { name: 'Konum (X, Y, Z)', value: `\`${pos.x}, ${pos.y}, ${pos.z}\``, inline: true },
          { name: 'Boş Slot', value: `📦 **${emptySlots} / 36**`, inline: true },
          { name: 'Eldeki Eşya', value: `🔨 **${heldStr}**`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // 3. !istatistik
    if (cmd === 'istatistik' || cmd === 'stats') {
      const embed = new EmbedBuilder()
        .setTitle('📊 Detaylı Madencilik İstatistikleri')
        .setColor(15844367)
        .addFields(
          { name: '⏳ Çalışma Süresi', value: stats.getUptime(), inline: true },
          { name: '⛏️ Toplam Kırılan', value: `**${stats.totalMined} blok**`, inline: true },
          { name: '⚡ Ortalama Hız', value: `**${stats.getHourlyRate()} blok/saat**`, inline: true },
          { name: '🎒 Depolanan Maden', value: `**${stats.totalDeposited} adet** (${stats.pvDepositCycles} sefer)`, inline: true }
        )
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // 4. !envanter
    if (cmd === 'envanter' || cmd === 'inv') {
      const items = bot.inventory.items();
      let desc = '';
      if (items.length === 0) {
        desc = 'Envanter tamamen boş.';
      } else {
        items.forEach((item) => {
          desc += `• **${item.displayName || item.name}**: ${item.count} adet\n`;
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎒 Bot Envanteri (${items.length} Farklı Eşya)`)
        .setColor(3447003)
        .setDescription(desc)
        .setTimestamp();

      return message.reply({ embeds: [embed] });
    }

    // 5. !dur / !stop
    if (cmd === 'dur' || cmd === 'stop') {
      botControl.pause();
      return message.reply('⏸️ **Madencilik duraklatıldı.** Bot sunucuda bekliyor.');
    }

    // 6. !basla / !start
    if (cmd === 'basla' || cmd === 'start' || cmd === 'devam') {
      botControl.resume();
      return message.reply('▶️ **Madencilik başlatıldı!** Bot kazmaya devam ediyor.');
    }

    // 7. !depola / !pv
    if (cmd === 'depola' || cmd === 'pv') {
      botControl.triggerDeposit();
      return message.reply('🎒 **PV Kasalarına depolama işlemi başlatıldı.**');
    }

    // 8. !tamir
    if (cmd === 'tamir' || cmd === 'repair') {
      bot.chat(config.repair.command);
      return message.reply(`🔧 \`${config.repair.command}\` komutu sunucuya gönderildi.`);
    }

    // 9. !copat
    if (cmd === 'copat' || cmd === 'clean') {
      botControl.dropJunk();
      return message.reply('🗑️ **Envanterdeki çöp bloklar yere atılıyor.**');
    }

    // 10. !warp
    if (cmd === 'warp') {
      const warpTarget = args[0] ? `/warp ${args[0]}` : config.mining.warpCommand;
      bot.chat(warpTarget);
      return message.reply(`🌀 \`${warpTarget}\` komutu gönderildi.`);
    }

    // 11. !cmd <komut>
    if (cmd === 'cmd' || cmd === 'komut') {
      const fullCmd = args.join(' ');
      if (!fullCmd) {
        return message.reply('❌ Lütfen göndermek istediğiniz komutu yazın. Örnek: `!cmd /spawn`');
      }
      bot.chat(fullCmd);
      return message.reply(`💬 Sunucuya komut gönderildi: \`${fullCmd}\``);
    }

    // 12. !cikis
    if (cmd === 'cikis' || cmd === 'exit') {
      message.reply('🚪 **Bot sunucudan çıkarılıyor ve kapatılıyor...**');
      botControl.exit();
    }
  });

  discordClient.login(config.discord.botToken).catch((err) => {
    console.log(chalk.red(`[DISCORD BOT HATA] Discord botuna giriş yapılamadı: ${err.message}`));
  });
}

module.exports = {
  initDiscordBridge
};
