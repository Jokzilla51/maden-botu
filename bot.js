const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const autoEat = require('mineflayer-auto-eat').plugin;
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { handleChatCaptcha, handleWindowCaptcha } = require('./captcha');
const stats = require('./stats');
const { sendDiscordNotification } = require('./notifier');
const { initDiscordBridge } = require('./discordBridge');

const http = require('http');

// Yapılandırma dosyasını yükle
const configPath = path.join(__dirname, 'config.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Render.com & Cloud Hostings için HTTP Durum / Canlılık Sunucusu
const HTTP_PORT = process.env.PORT || (config.webViewer && config.webViewer.port) || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  const statusHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Minecraft VIP Bot Durumu</title>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; text-align: center; padding: 40px; }
          .card { background: #1e293b; border-radius: 12px; max-width: 500px; margin: 0 auto; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
          h1 { color: #38bdf8; margin-top: 0; }
          .badge { display: inline-block; background: #22c55e; color: #000; font-weight: bold; padding: 6px 16px; border-radius: 20px; font-size: 14px; margin-bottom: 20px; }
          .stat { margin: 12px 0; font-size: 16px; text-align: left; border-bottom: 1px solid #334155; padding-bottom: 8px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>⛏️ VIP Madenci Botu</h1>
          <div class="badge">● ÇALIŞIYOR (7/24 AKTİF)</div>
          <div class="stat"><b>Sunucu:</b> ${config.server.host}</div>
          <div class="stat"><b>Kullanıcı:</b> ${config.auth.username}</div>
          <div class="stat"><b>Çalışma Süresi:</b> ${stats.getUptime()}</div>
          <div class="stat"><b>Toplam Kırılan:</b> ${stats.totalMined} blok</div>
          <div class="stat"><b>Kazma Hızı:</b> ${stats.getHourlyRate()} blok/saat</div>
        </div>
      </body>
    </html>
  `;
  res.end(statusHtml);
});

server.listen(HTTP_PORT, () => {
  console.log(chalk.blue.bold(`[HTTP SUNUCU] Render / Web Canlılık Servisi aktif (Port: ${HTTP_PORT})`));
});

let bot = null;
let isMining = false;
let isDepositing = false;
let isPaused = false;
let shouldReconnect = true;
let reconnectTimeout = null;
let lastBlockMinedTime = Date.now();
let lastRepairTime = 0;
let watchdogInterval = null;

// Terminal Giriş-Çıkış Arayüzü (PowerShell üzerinden botu yönetme)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function printHelp() {
  console.log(chalk.cyan.bold('\n--- 📋 POWERSHELL KONSOL KOMUTLARI ---'));
  console.log(chalk.yellow('cikis / exit / quit / kapat') + ' -> Botu sunucudan çıkarır ve programı tamamen kapatır.');
  console.log(chalk.yellow('dur / stop') + '                 -> Madenciliği duraklatır (sunucuda kalır).');
  console.log(chalk.yellow('basla / start / devam') + '      -> Madenciliği başlatır / devam ettirir.');
  console.log(chalk.yellow('durum / status / info') + '      -> Botun anlık sağlık, açlık, konum ve elindeki eşya durumunu gösterir.');
  console.log(chalk.yellow('istatistik / stats') + '         -> Detaylı kazma hızı, kırılan blok sayısı ve süre tablosunu gösterir.');
  console.log(chalk.yellow('envanter / inv') + '            -> Botun envanterindeki eşyaları listeler.');
  console.log(chalk.yellow('copat / clean') + '              -> Envanterdeki gereksiz taş/toprak/netherrack çöplerini yere atar.');
  console.log(chalk.yellow('tamir / repair') + '            -> Kazmaları tamir etme komutunu (/fix all) çalıştırır.');
  console.log(chalk.yellow('depola / pv') + '               -> Hemen /pv kasalarına eşya aktarımını başlatır.');
  console.log(chalk.yellow('warp [isim]') + '               -> VIP alanına (veya belirtilen alana) ışınlanır.');
  console.log(chalk.yellow('/komut veya mesaj') + '          -> Sunucuya doğrudan komut veya sohbet mesajı gönderir.');
  console.log(chalk.yellow('yardim / help') + '             -> Bu yardım listesini ekrana yazdırır.');
  console.log(chalk.cyan.bold('------------------------------------\n'));
}

rl.on('line', async (line) => {
  const input = line.trim();
  if (!input) return;

  const lower = input.toLowerCase();

  // 1. Sunucudan Çıkış ve Kapatma
  if (['cikis', 'exit', 'quit', 'kapat', 'dc'].includes(lower)) {
    console.log(chalk.red.bold('\n[ÇIKIŞ] Bot sunucudan çıkarılıyor ve kapatılıyor...'));
    shouldReconnect = false;
    clearTimeout(reconnectTimeout);
    clearInterval(watchdogInterval);
    if (bot) {
      bot.quit();
    }
    setTimeout(() => {
      console.log(chalk.gray('[ÇIKIŞ] Program sonlandırıldı.'));
      process.exit(0);
    }, 1000);
    return;
  }

  // 2. Yardım Menüsü
  if (['yardim', 'help', 'komutlar'].includes(lower)) {
    printHelp();
    return;
  }

  // 3. İstatistik Tablosu
  if (['istatistik', 'stats', 'stat', 'rapor'].includes(lower)) {
    stats.printDashboard();
    return;
  }

  if (!bot) {
    console.log(chalk.red('[HATA] Bot henüz sunucuya bağlı değil.'));
    return;
  }

  // 4. Duraklatma ve Başlatma
  if (['stop', 'dur', 'pause'].includes(lower)) {
    isPaused = true;
    console.log(chalk.red.bold('[KONTROL] Bot madenciliği duraklattı. (Sunucuda bekliyor)'));
    return;
  }

  if (['start', 'basla', 'devam', 'resume'].includes(lower)) {
    isPaused = false;
    lastBlockMinedTime = Date.now();
    console.log(chalk.green.bold('[KONTROL] Bot madenciliği başlattı / devam ediyor.'));
    if (!isMining && !isDepositing) startMiningLoop();
    return;
  }

  // 5. Durum Sorgulama
  if (['durum', 'status', 'info', 'bilgi'].includes(lower)) {
    const pos = bot.entity ? bot.entity.position.floored() : { x: 0, y: 0, z: 0 };
    const health = bot.health || 0;
    const food = bot.food || 0;
    const emptySlots = bot.inventory ? bot.inventory.emptySlotCount() : 0;
    const stateStr = isPaused
      ? chalk.red('DURAKLATILDI')
      : isDepositing
      ? chalk.magenta('PV DEPOLANIYOR')
      : isMining
      ? chalk.green('MADEN KAZIYOR')
      : chalk.yellow('BEKLEMEDE');

    console.log(chalk.cyan.bold('\n--- 🤖 BOT ANLIK DURUM RAPORU ---'));
    console.log(chalk.white(`Durum:        ${stateStr}`));
    console.log(chalk.white(`Can (Health): ${chalk.red(health + ' / 20')} | Açlık: ${chalk.yellow(food + ' / 20')}`));
    console.log(chalk.white(`Konum:        X: ${pos.x}, Y: ${pos.y}, Z: ${pos.z}`));
    console.log(chalk.white(`Boş Slot:     ${chalk.green(emptySlots)} / 36`));

    const held = bot.heldItem;
    if (held) {
      const maxD = held.maxDurability || 1561;
      const remD = maxD - (held.durabilityUsed || 0);
      console.log(chalk.white(`Eldeki Eşya:  ${chalk.yellow(held.name)} (Kalan Can: ${remD}/${maxD})`));
    } else {
      console.log(chalk.white(`Eldeki Eşya:  Boş`));
    }
    console.log(chalk.cyan.bold('---------------------------------\n'));
    return;
  }

  // 6. Envanter Listeleme
  if (['envanter', 'inv', 'inventory', 'canta'].includes(lower)) {
    const items = bot.inventory.items();
    console.log(chalk.cyan.bold(`\n--- 🎒 ENVANTER LİSTESİ (${items.length} Farklı Eşya) ---`));
    if (items.length === 0) {
      console.log(chalk.gray('Envanter tamamen boş.'));
    } else {
      items.forEach((item) => {
        console.log(chalk.white(`- ${chalk.yellow(item.displayName || item.name)}: ${chalk.green(item.count + ' adet')}`));
      });
    }
    console.log(chalk.cyan.bold('--------------------------------------------\n'));
    return;
  }

  // 7. Manuel Çöp Temizleme
  if (['copat', 'cop', 'clean', 'trash'].includes(lower)) {
    console.log(chalk.yellow.bold('[ÇÖP] Envanterdeki gereksiz taş ve çöpler yere atılıyor...'));
    await dropJunkItems();
    return;
  }

  // 8. Manuel Tamir Komutu
  if (['tamir', 'repair', 'fix'].includes(lower)) {
    console.log(chalk.blue.bold(`[TAMİR] ${config.repair.command} komutu gönderiliyor...`));
    bot.chat(config.repair.command);
    return;
  }

  // 9. Manuel Depolama
  if (['depola', 'pv'].includes(lower)) {
    console.log(chalk.yellow.bold('[KONTROL] Manuel PV depolama tetiklendi.'));
    depositToVaults();
    return;
  }

  // 10. Warp
  if (lower.startsWith('warp')) {
    const parts = input.split(' ');
    if (parts.length > 1) {
      bot.chat(`/warp ${parts[1]}`);
    } else {
      bot.chat(config.mining.warpCommand);
    }
    return;
  }

  // 11. Doğrudan Komut / Mesaj Gönderme
  bot.chat(input);
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initBot() {
  console.log(chalk.cyan.bold('===================================================='));
  console.log(chalk.cyan.bold(`   MINECRAFT VIP OTOMATIK NETHERITE MADENCI BOT    `));
  console.log(chalk.cyan.bold('===================================================='));
  console.log(chalk.gray(`Sunucu: ${config.server.host}:${config.server.port}`));
  console.log(chalk.gray(`Kullanıcı Adı: ${config.auth.username}`));

  const botOptions = {
    host: config.server.host,
    port: config.server.port,
    username: config.auth.username
  };

  if (config.server.version) {
    botOptions.version = config.server.version;
  }

  bot = mineflayer.createBot(botOptions);

  // Eklentileri yükle
  bot.loadPlugin(pathfinder);
  if (config.mining.autoEat) {
    bot.loadPlugin(autoEat);
  }

  // Olay Dinleyicileri
  bot.once('spawn', onSpawn);
  bot.on('chat', onChat);
  bot.on('messagestr', onMessageStr);
  bot.on('kicked', onKicked);
  bot.on('error', onError);
  bot.on('end', onEnd);
  bot.on('death', onDeath);
  bot.on('health', onHealth);
  bot.on('windowOpen', onWindowOpen);

  // Watchdog (Donma / Sıkışma / Maden Yenilenmeme Takibi)
  startWatchdog();
}

async function onSpawn() {
  console.log(chalk.green.bold(`[BAĞLANDI] ${bot.username} sunucuya başarıyla giriş yaptı!`));
  lastBlockMinedTime = Date.now();

  if (config.discord && config.discord.enabled) {
    sendDiscordNotification(
      config.discord.webhookUrl,
      'Bot Sunucuya Bağlandı',
      `**${bot.username}** sunucuya giriş yaptı ve maden döngüsüne hazırlanıyor.\nSunucu: \`${config.server.host}\``,
      65280
    );
  }

  // Web Viewer (Tarayıcıdan 3D izleme)
  if (config.webViewer && config.webViewer.enabled) {
    try {
      const { mineflayer: viewer } = require('prismarine-viewer');
      viewer(bot, { port: config.webViewer.port, firstPerson: true });
      console.log(chalk.magenta.bold(`[WEB VIEWER] Botu canlı izlemek için tarayıcıda açın: http://localhost:${config.webViewer.port}`));
    } catch (err) {
      console.log(chalk.yellow(`[WEB VIEWER] Web arayüzü başlatılamadı: ${err.message}`));
    }
  }

  // Otomatik Giriş (/login veya /register)
  if (config.auth.autoLogin) {
    console.log(chalk.blue(`[GİRİŞ] ${config.auth.loginDelayMs / 1000} saniye içinde giriş komutu gönderilecek...`));
    await sleep(config.auth.loginDelayMs);
    bot.chat(`/login ${config.auth.password}`);
  }

  // Offhand Eşya (Totem / Kalkan) Kuşan
  await equipOffhand();

  // Warp VIP'e Işınlanma
  console.log(chalk.blue(`[WARP] ${config.auth.warpDelayMs / 1000} saniye içinde ${config.mining.warpCommand} gönderilecek...`));
  await sleep(config.auth.warpDelayMs);
  bot.chat(config.mining.warpCommand);

  // Madencilik döngüsünü başlat
  await sleep(3000);
  startMiningLoop();
}

function onChat(username, message) {
  if (username === bot.username) return;
  console.log(chalk.gray(`[SOHBET] ${username}: ${message}`));
  handleChatCaptcha(bot, message, config);
}

function onMessageStr(message) {
  handleChatCaptcha(bot, message, config);
}

function onWindowOpen(window) {
  handleWindowCaptcha(bot, window, config);
}

function onKicked(reason) {
  console.log(chalk.red.bold(`[ATILDI] Sunucudan atıldı. Sebep: ${reason}`));
  if (config.discord && config.discord.enabled) {
    sendDiscordNotification(
      config.discord.webhookUrl,
      'Bot Sunucudan Atıldı (Kick)',
      `**Sebep:** ${reason}\n10 saniye sonra otomatik tekrar bağlanılacak.`,
      16711680
    );
  }
}

function onError(err) {
  console.log(chalk.red.bold(`[HATA] Bot hatası: ${err.message}`));
}

function onEnd(reason) {
  isMining = false;
  isDepositing = false;
  clearTimeout(reconnectTimeout);

  if (!shouldReconnect) {
    console.log(chalk.gray('[BAĞLANTI] Kullanıcı isteğiyle çıkış yapıldı.'));
    return;
  }

  console.log(chalk.yellow.bold(`[BAĞLANTI KESİLDİ] Bağlantı sonlandı (${reason}). 10 saniye sonra tekrar bağlanılıyor...`));
  reconnectTimeout = setTimeout(() => {
    initBot();
  }, 10000);
}

function onDeath() {
  console.log(chalk.red.bold('[ÖLÜM] Bot öldü! Yeniden doğması ve madene dönmesi bekleniyor...'));
  isMining = false;
  if (config.discord && config.discord.enabled) {
    sendDiscordNotification(config.discord.webhookUrl, 'Bot Öldü!', 'Bot öldü ve 5 saniye sonra VIP madenine geri dönecek.', 16711680);
  }

  setTimeout(async () => {
    bot.chat(config.mining.warpCommand);
    await sleep(3000);
    startMiningLoop();
  }, 5000);
}

function onHealth() {
  if (config.mining.autoEat && bot.autoEat) {
    if (bot.food < 15) {
      bot.autoEat.eat().catch(() => {});
    }
  }
}

/**
 * Sol ele Totem veya Kalkan alma
 */
async function equipOffhand() {
  if (!config.offhand || (!config.offhand.autoEquipTotem && !config.offhand.autoEquipShield)) return;
  const offItem = bot.inventory.items().find((i) => i.name === 'totem_of_undying' || i.name === 'shield');
  if (offItem) {
    try {
      await bot.equip(offItem, 'off-hand');
    } catch (e) {}
  }
}

/**
 * Envanterdeki gereksiz çöp blokları (taş, toprak, netherrack) yere at
 */
async function dropJunkItems() {
  if (!config.junkDropper || !config.junkDropper.enabled) return;
  const junkList = config.junkDropper.items || [];
  const junkItems = bot.inventory.items().filter((i) => junkList.includes(i.name));

  for (const item of junkItems) {
    try {
      await bot.tossStack(item);
      await sleep(100);
    } catch (e) {}
  }
}

/**
 * Watchdog / Sıkışma & Yenilenmeme Kontrolcüsü
 */
function startWatchdog() {
  clearInterval(watchdogInterval);
  if (!config.watchdog || !config.watchdog.enabled) return;

  const timeout = config.watchdog.noBlockTimeoutMs || 45000;
  watchdogInterval = setInterval(async () => {
    if (isMining && !isPaused && !isDepositing) {
      const timeSinceLastBlock = Date.now() - lastBlockMinedTime;
      if (timeSinceLastBlock > timeout) {
        console.log(chalk.yellow.bold(`[WATCHDOG] ${Math.round(timeout / 1000)} saniyedir blok kırılamadı (sıkışma veya maden boş)!`));
        console.log(chalk.yellow(`[WATCHDOG] Konumu yenilemek için ${config.mining.warpCommand} yeniden gönderiliyor...`));
        bot.chat(config.mining.warpCommand);
        lastBlockMinedTime = Date.now();
        await sleep(2000);
      }
    }
  }, 10000);
}

/**
 * En iyi kazmayı seç, eline al ve gerekirse otomatik tamir komutu (/fix all) gönder
 */
async function equipBestPickaxe() {
  const pickaxes = bot.inventory.items().filter((item) => item.name.includes('pickaxe'));
  if (pickaxes.length === 0) {
    console.log(chalk.red.bold('[KAZMA UYARISI] Envanterde hiç kazma bulunamadı!'));
    return false;
  }

  // Kazmaları türüne göre sırala (Netherite > Diamond > Iron > Stone > Gold > Wood)
  const priority = ['netherite_pickaxe', 'diamond_pickaxe', 'iron_pickaxe', 'stone_pickaxe', 'golden_pickaxe', 'wooden_pickaxe'];
  pickaxes.sort((a, b) => priority.indexOf(a.name) - priority.indexOf(b.name));

  let selectedPickaxe = null;
  for (const pick of pickaxes) {
    const maxDurability = pick.maxDurability || 1561;
    const durabilityUsed = pick.durabilityUsed || 0;
    const remainingDurability = maxDurability - durabilityUsed;

    // Otomatik Tamir Kontrolü (/fix all, /repair vb.)
    if (config.repair && config.repair.enabled && remainingDurability <= config.repair.triggerDurability) {
      const now = Date.now();
      const cooldown = config.repair.cooldownMs || 10000;
      if (now - lastRepairTime > cooldown) {
        console.log(chalk.blue.bold(`[TAMİR] Kazmanın canı azaldı (${remainingDurability}/${maxDurability}). ${config.repair.command} çalıştırılıyor...`));
        bot.chat(config.repair.command);
        lastRepairTime = now;
        await sleep(1000);
      }
    }

    if (remainingDurability > config.mining.minPickaxeDurability) {
      selectedPickaxe = pick;
      break;
    } else {
      console.log(chalk.yellow(`[KAZMA] ${pick.name} canı çok az (${remainingDurability}), kırılmaması için atlandı.`));
    }
  }

  if (!selectedPickaxe) {
    console.log(chalk.red.bold('[KAZMA UYARISI] Kullanılabilir dayanıklılıkta kazma kalmadı! Bot duraklatılıyor.'));
    isPaused = true;
    return false;
  }

  try {
    await bot.equip(selectedPickaxe, 'hand');
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Envanter doluluk kontrolü
 */
function isInventoryFull() {
  const emptySlots = bot.inventory.emptySlotCount();
  return emptySlots <= 2;
}

/**
 * Kasaya depolanacak eşyalar
 */
function getDepositItemsInInventory() {
  return bot.inventory.items().filter((item) => config.vault.depositItems.includes(item.name));
}

/**
 * Anti-Cheat Yumuşak Kafa Çevirme (Smooth LookAt)
 */
async function smoothLookAt(targetVec) {
  if (!config.antiCheat.humanizeRotations) {
    return bot.lookAt(targetVec);
  }

  const steps = config.antiCheat.rotationSteps || 4;
  const delay = config.antiCheat.rotationStepDelayMs || 25;

  const currentYaw = bot.entity.yaw;
  const currentPitch = bot.entity.pitch;

  const delta = targetVec.minus(bot.entity.position.offset(0, bot.entity.height, 0));
  const targetYaw = Math.atan2(-delta.x, -delta.z);
  const groundDistance = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
  const targetPitch = Math.atan2(delta.y, groundDistance);

  for (let i = 1; i <= steps; i++) {
    const intermediateYaw = currentYaw + ((targetYaw - currentYaw) * i) / steps;
    const intermediatePitch = currentPitch + ((targetPitch - currentPitch) * i) / steps;
    await bot.look(intermediateYaw, intermediatePitch, true);
    await sleep(delay);
  }
}

/**
 * Ana Madencilik Döngüsü
 */
async function startMiningLoop() {
  if (isMining || isDepositing || isPaused) return;
  isMining = true;
  console.log(chalk.green.bold('[MADENCİ] Otomatik kazma döngüsü başladı...'));
  lastBlockMinedTime = Date.now();

  let loopCount = 0;

  while (isMining && !isPaused) {
    loopCount++;

    // Her 10 blokta bir çöpleri temizle ve sol eli kontrol et
    if (loopCount % 10 === 0) {
      await dropJunkItems();
      await equipOffhand();
    }

    // 1. Envanter kontrolü
    if (isInventoryFull()) {
      // Önce çöpleri at, hala doluysa PV'ye git
      await dropJunkItems();
      if (isInventoryFull()) {
        console.log(chalk.yellow.bold('[ENVANTER] Envanter doldu! PV kasalarına depolama başlatılıyor...'));
        isMining = false;
        await depositToVaults();
        break;
      }
    }

    // 2. Kazma kontrolü ve kuşanma
    const hasPickaxe = await equipBestPickaxe();
    if (!hasPickaxe) {
      isMining = false;
      break;
    }

    // 3. Yakındaki hedeflenen blokları bul (netherite_block vb.)
    const targetBlockIds = [];
    for (const name of config.mining.targetBlocks) {
      const b = bot.registry.blocksByName[name];
      if (b) targetBlockIds.push(b.id);
    }

    if (targetBlockIds.length === 0) {
      console.log(chalk.red('[HATA] Hedef bloklar bulunamadı!'));
      await sleep(2000);
      continue;
    }

    // Yakındaki blokları ara
    const blockPositions = bot.findBlocks({
      matching: targetBlockIds,
      maxDistance: config.mining.miningRadius,
      count: 32
    });

    if (blockPositions.length === 0) {
      // Yarıçap içinde blok kalmadıysa
      // Anti-AFK hafif hareket
      if (config.antiCheat.antiAfkJiggle) {
        bot.setControlState('sneak', true);
        await sleep(100);
        bot.setControlState('sneak', false);
      }

      await sleep(1200);
      continue;
    }

    // En yakın bloğu seç
    const botPos = bot.entity.position;
    blockPositions.sort((a, b) => botPos.distanceTo(a) - botPos.distanceTo(b));
    const targetPos = blockPositions[0];
    const targetBlock = bot.blockAt(targetPos);

    if (!targetBlock || !bot.canDigBlock(targetBlock)) {
      await sleep(150);
      continue;
    }

    try {
      // Bloğun merkezine yumuşakça bak
      const blockCenter = targetPos.offset(0.5, 0.5, 0.5);
      await smoothLookAt(blockCenter);

      // İnsan benzeri kazma öncesi gecikme
      const preDigDelay = getRandomDelay(config.antiCheat.digDelayMinMs, config.antiCheat.digDelayMaxMs);
      await sleep(preDigDelay);

      // Bloğu kaz
      await bot.dig(targetBlock);
      lastBlockMinedTime = Date.now();

      // İstatistik kaydet
      stats.recordBlockMined(targetBlock.name);

      // Discord Dönüm Noktası Bildirimi (Örn: Her 250 blokta bir)
      if (config.discord && config.discord.enabled) {
        const milestone = config.discord.milestoneEvery || 250;
        if (stats.totalMined % milestone === 0) {
          sendDiscordNotification(
            config.discord.webhookUrl,
            `Dönüm Noktası: ${stats.totalMined} Blok Kırıldı!`,
            `⛏️ **Toplam Kırılan:** ${stats.totalMined} blok\n⚡ **Hız:** ${stats.getHourlyRate()} blok/saat\n⏳ **Süre:** ${stats.getUptime()}`,
            15844367
          );
        }
      }

      await sleep(40);
    } catch (err) {
      await sleep(150);
    }
  }

  isMining = false;
}

/**
 * /pv 1, /pv 2... Kasalarına otomatik depolama
 */
async function depositToVaults() {
  if (isDepositing) return;
  isDepositing = true;
  console.log(chalk.magenta.bold('[DEPO] PV Kasalarına eşya aktarımı başlıyor...'));

  const pvList = config.vault.pvList || [1, 2, 3, 4, 5];
  let totalDepositedThisRound = 0;

  for (let i = 0; i < pvList.length; i++) {
    const pvNum = pvList[i];
    const itemsToDeposit = getDepositItemsInInventory();

    if (itemsToDeposit.length === 0) {
      console.log(chalk.green.bold('[DEPO] Aktarılacak tüm madenler kasalara konuldu!'));
      break;
    }

    console.log(chalk.blue(`[PV] /pv ${pvNum} açılıyor... (Kalan farklı eşya sayısı: ${itemsToDeposit.length})`));
    bot.chat(`/pv ${pvNum}`);

    let chestWindow = null;
    try {
      chestWindow = await waitForWindow(bot, 5000);
    } catch (err) {
      console.log(chalk.red(`[PV] /pv ${pvNum} penceresi açılamadı veya zaman aşımına uğradı!`));
      await sleep(config.vault.pvCommandDelayMs);
      continue;
    }

    try {
      const chestSlotsCount = chestWindow.inventoryStart;

      for (const item of chestWindow.items()) {
        if (item.slot < chestSlotsCount) continue;

        if (config.vault.depositItems.includes(item.name)) {
          let hasEmptyChestSlot = false;
          for (let slot = 0; slot < chestSlotsCount; slot++) {
            if (!chestWindow.slots[slot]) {
              hasEmptyChestSlot = true;
              break;
            }
          }

          if (!hasEmptyChestSlot) {
            console.log(chalk.yellow(`[PV] /pv ${pvNum} tamamen doldu! Sıradaki PV'ye geçilecek.`));
            break;
          }

          const count = item.count;
          await bot.clickWindow(item.slot, 0, 1);
          totalDepositedThisRound += count;
          const delay = getRandomDelay(config.vault.depositDelayMinMs, config.vault.depositDelayMaxMs);
          await sleep(delay);
        }
      }
    } catch (err) {
      console.log(chalk.red(`[PV HATA] Eşya aktarma hatası: ${err.message}`));
    } finally {
      bot.closeWindow(chestWindow);
      await sleep(config.vault.pvCommandDelayMs);
    }
  }

  stats.recordDeposit(totalDepositedThisRound);

  const remaining = getDepositItemsInInventory();
  if (remaining.length > 0 && isInventoryFull()) {
    console.log(chalk.red.bold('[UYARI] Tüm yapılandırılmış PV kasaları DOLU ve envanter hâlâ dolu!'));
    isPaused = true;
    if (config.discord && config.discord.enabled) {
      sendDiscordNotification(
        config.discord.webhookUrl,
        'Tüm PV Kasaları Doldu!',
        'Yapılandırılmış tüm PV kasaları doldu ve envanterde yer kalmadı. Bot madenciliği durdurdu.',
        16711680
      );
    }
  } else {
    console.log(chalk.green.bold('[BAŞARILI] Depolama işlemi tamamlandı. Madene geri dönülüyor...'));
    bot.chat(config.mining.warpCommand);
    lastBlockMinedTime = Date.now();
    await sleep(2500);
  }

  isDepositing = false;
  if (!isPaused) {
    startMiningLoop();
  }
}

function waitForWindow(botInstance, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timer = null;
    const onWindowOpen = (win) => {
      clearTimeout(timer);
      resolve(win);
    };

    botInstance.once('windowOpen', onWindowOpen);

    timer = setTimeout(() => {
      botInstance.removeListener('windowOpen', onWindowOpen);
      reject(new Error('Window timeout'));
    }, timeoutMs);
  });
}

// Discord Uzaktan Kontrol Arayüzü
const botControl = {
  getBot: () => bot,
  isPaused: () => isPaused,
  isDepositing: () => isDepositing,
  isMining: () => isMining,
  pause: () => {
    isPaused = true;
    console.log(chalk.red.bold('[DISCORD] Madencilik duraklatıldı.'));
  },
  resume: () => {
    isPaused = false;
    lastBlockMinedTime = Date.now();
    console.log(chalk.green.bold('[DISCORD] Madencilik devam ediyor.'));
    if (!isMining && !isDepositing) startMiningLoop();
  },
  triggerDeposit: () => {
    depositToVaults();
  },
  dropJunk: () => {
    dropJunkItems();
  },
  exit: () => {
    shouldReconnect = false;
    clearTimeout(reconnectTimeout);
    clearInterval(watchdogInterval);
    if (bot) bot.quit();
    setTimeout(() => process.exit(0), 1000);
  }
};

initDiscordBridge(botControl, config);

// Botu başlat
initBot();
