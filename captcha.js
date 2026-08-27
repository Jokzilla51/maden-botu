const chalk = require('chalk');

/**
 * Otomatik sohbet captcha yakalayıcı ve çözücü
 */
function handleChatCaptcha(bot, rawMessage, config) {
  if (!config.captcha || (!config.captcha.autoSolveMath && !config.captcha.autoSolveRepeat)) {
    return false;
  }

  const cleanText = rawMessage.replace(/§[0-9a-fk-or]/gi, '').trim();

  // 1. Matematiksel captcha'lar (Örn: "Lütfen 12 + 7 işleminin sonucunu yazın", "3 * 4 = ?")
  if (config.captcha.autoSolveMath) {
    const mathRegex1 = /(\d+)\s*([\+\-\*])\s*(\d+)\s*(?:=|işleminin|sonucunu|nedir|\?)/i;
    const mathMatch = cleanText.match(mathRegex1);
    if (mathMatch) {
      const num1 = parseInt(mathMatch[1], 10);
      const op = mathMatch[2];
      const num2 = parseInt(mathMatch[3], 10);
      let result = 0;

      if (op === '+') result = num1 + num2;
      else if (op === '-') result = num1 - num2;
      else if (op === '*') result = num1 * num2;

      console.log(chalk.yellow.bold(`[CAPTCHA] Otomatik matematik captcha tespit edildi: ${num1} ${op} ${num2} = ${result}`));
      setTimeout(() => {
        bot.chat(result.toString());
      }, 1000 + Math.random() * 1000);
      return true;
    }
  }

  // 2. Kod tekrarı captcha'ları (Örn: "Doğrulama kodu: 84920", "Lütfen sohbete 'XYZ12' yazınız", "Captcha: 9384")
  if (config.captcha.autoSolveRepeat) {
    const codeRegexes = [
      /(?:captcha|kod|doğrulama|code|güvenlik)[^\w\d]*([a-zA-Z0-9]{3,8})/i,
      /(?:yazınız|yazin|type)\s*['":]?\s*([a-zA-Z0-9]{3,8})\s*['"]?/i
    ];

    for (const regex of codeRegexes) {
      const match = cleanText.match(regex);
      if (match && match[1]) {
        const code = match[1];
        const ignoreWords = ['lutfen', 'lütfen', 'sohbete', 'dogrulama', 'kodu', 'giriniz', 'yaziniz', 'server', 'oyuncu'];
        if (!ignoreWords.includes(code.toLowerCase())) {
          console.log(chalk.yellow.bold(`[CAPTCHA] Otomatik kod captcha tespit edildi: ${code}`));
          setTimeout(() => {
            bot.chat(code);
          }, 1200 + Math.random() * 800);
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Sandık / GUI Doğrulama Menülerini Yakalama
 */
function handleWindowCaptcha(bot, window, config) {
  let titleStr = '';
  try {
    if (typeof window.title === 'string') {
      titleStr = window.title;
    } else if (window.title && typeof window.title === 'object') {
      titleStr = window.title.text || JSON.stringify(window.title);
    }
  } catch (e) {}

  const title = (titleStr || '').toLowerCase();
  if (title.includes('captcha') || title.includes('doğrulama') || title.includes('guvenlik') || title.includes('onay')) {
    console.log(chalk.yellow.bold(`[CAPTCHA MENÜSÜ] Ekrana doğrulama penceresi geldi: "${window.title}"`));
    
    // Genellikle yeşil yün, zümrüt veya onay butonuna tıklanması istenir
    const targetItem = window.items().find(i => 
      i.name.includes('emerald') || 
      i.name.includes('green_wool') || 
      i.name.includes('lime_wool') || 
      i.name.includes('lime_stained_glass_pane') ||
      (i.customName && i.customName.toLowerCase().includes('tıkla'))
    );

    if (targetItem) {
      console.log(chalk.green.bold(`[CAPTCHA MENÜSÜ] Otomatik tıklanacak eşya bulundu: ${targetItem.name} (Slot: ${targetItem.slot})`));
      setTimeout(() => {
        bot.clickWindow(targetItem.slot, 0, 0);
      }, 1000 + Math.random() * 500);
    } else {
      console.log(chalk.yellow('[CAPTCHA MENÜSÜ] Lütfen konsoldan veya oyundan gerekli slota tıklayarak doğrulamayı yapın.'));
    }
  }
}

module.exports = {
  handleChatCaptcha,
  handleWindowCaptcha
};
