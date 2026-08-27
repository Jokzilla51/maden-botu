const https = require('https');
const url = require('url');

/**
 * Discord Webhook Bildirim Modülü
 */
function sendDiscordNotification(webhookUrl, title, description, color = 3447003) {
  if (!webhookUrl || typeof webhookUrl !== 'string' || !webhookUrl.startsWith('http')) {
    return;
  }

  try {
    const parsedUrl = new url.URL(webhookUrl);
    const payload = JSON.stringify({
      embeds: [
        {
          title: `⛏️ [Minecraft VIP Bot] ${title}`,
          description: description,
          color: color,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Antigravity VIP Bot'
          }
        }
      ]
    });

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {});
    });

    req.on('error', () => {});
    req.write(payload);
    req.end();
  } catch (err) {
    // Webhook hatası ana akışı etkilemesin
  }
}

module.exports = {
  sendDiscordNotification
};
