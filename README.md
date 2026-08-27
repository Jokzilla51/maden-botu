# 🚀 Gelişmiş Minecraft VIP Otomatik Netherite Madenci Botu v2.0

Bu bot, Minecraft sunucularındaki `/warp vip` alanında yer alan Netherite bloklarını (`netherite_block`) 7/24 otomatik olarak kazar, envanter dolduğunda eşyaları `/pv 1`, `/pv 2`... kasalarına aktarır ve gelişmiş koruma sistemleri ile ban/ölüm riskini minimuma indirir.

---

## 🌟 Yeni & Gelişmiş Özellikler (v2.0)

1. **⚡ Canlı İstatistik Dashboard'u (`stats.js`):**
   - Konsolda `istatistik` yazarak botun ne kadar süredir çalıştığını, toplam kaç blok kırdığını, saatlik kazma hızını (blok/saat) ve PV'ye aktarılan maden sayısını görebilirsiniz.
2. **🔨 Otomatik VIP Kazma Tamiri (`/fix all` / `/repair`):**
   - Kazmanın canı belirlenen seviyenin altına düştüğünde sunucunun tamir komutunu otomatik gönderir.
3. **🗑️ Otomatik Çöp Temizleyici (Junk Dropper):**
   - Netherite kazarken envantere dolan taş, toprak, çakıl, netherrack gibi gereksiz blokları otomatik olarak yere fırlatır.
4. **👁️ Watchdog (Sıkışma & Donma Takibi):**
   - Eğer maden yenilenmezse veya bot bir yere takılıp 45 saniye boyunca hiç blok kıramazsa otomatik olarak `/warp vip` atarak konumunu sıfırlar.
5. **🛡️ Sol El Koruyucu (Offhand Totem / Shield):**
   - Envanterde Totem veya Kalkan varsa ölmemek için otomatik olarak sol eline alır.
6. **📱 Discord Webhook Bildirimleri (`notifier.js`):**
   - İsteğe bağlı olarak Discord Webhook URL'nizi girerek telefonunuza anlık bildirim alabilirsiniz:
     - Bot sunucuya girdiğinde / atıldığında (kick).
     - Tüm PV kasaları dolduğunda.
     - Belirli bir blok hedefi aşıldığında (Örn: Her 250 blokta bir).
7. **🧩 Gelişmiş GUI & Sohbet Captcha Çözücü:**
   - Sohbetten gelen matematiksel işlemlerin yanı sıra, ekrana açılan menü/sandık captcha'larını da tespit eder.
8. **🌐 3D Canlı Web İzleyici (Prismarine Viewer):**
   - Oyunu açmanıza gerek kalmadan tarayıcınızdan `http://localhost:3000` adresine girerek botun bakış açısını canlı 3D izleyebilirsiniz.

---

## ⚙️ Yapılandırma (`config.json`)

```json
{
  "server": {
    "host": "mc.sunucunuz.com",
    "port": 25565,
    "version": false
  },
  "auth": {
    "username": "VIP_Madenci",
    "password": "sifreniz123",
    "autoLogin": true
  },
  "mining": {
    "warpCommand": "/warp vip",
    "targetBlocks": ["netherite_block", "ancient_debris"],
    "miningRadius": 4.5
  },
  "vault": {
    "pvList": [1, 2, 3, 4, 5],
    "depositItems": ["netherite_block", "ancient_debris", "netherite_ingot", "netherite_scrap", "diamond_block", "diamond"]
  },
  "repair": {
    "enabled": true,
    "command": "/fix all",
    "triggerDurability": 50
  },
  "junkDropper": {
    "enabled": true,
    "items": ["netherrack", "cobblestone", "stone", "dirt", "gravel", "basalt", "blackstone"]
  },
  "watchdog": {
    "enabled": true,
    "noBlockTimeoutMs": 45000
  },
  "discord": {
    "enabled": false,
    "webhookUrl": "",
    "milestoneEvery": 250
  }
}
```

---

## 🕹️ PowerShell Canlı Konsol Komutları

| Komut | Açıklama |
| :--- | :--- |
| **`cikis`** / **`exit`** | Botu sunucudan güvenle çıkarır ve programı tamamen kapatır. |
| **`istatistik`** / **`stats`** | Saatlik kazanç, toplam kırılan maden ve süre tablosunu gösterir. |
| **`durum`** / **`status`** | Anlık Can, Açlık, Koordinatlar (X, Y, Z), Elindeki kazma canını listeler. |
| **`envanter`** / **`inv`** | Botun çantasındaki tüm eşyaları ve adetlerini gösterir. |
| **`tamir`** / **`repair`** | Kazmaları tamir etme komutunu (`/fix all`) hemen gönderir. |
| **`copat`** / **`clean`** | Envanterdeki taş/çakıl/netherrack çöplerini hemen yere atar. |
| **`depola`** / **`pv`** | Dolmasını beklemeden madenleri hemen `/pv 1`, `/pv 2`... kasalarına aktarır. |
| **`dur`** / **`stop`** | Madenciliği duraklatır (bot sunucuda bekler). |
| **`basla`** / **`devam`** | Madencilik döngüsünü başlatır. |
| **`warp [isim]`** | VIP maden alanına veya belirtilen alana ışınlanır. |
| **`/herhangi_bir_komut`** | Sunucuda doğrudan komut çalıştırır. |
| **`yardim`** / **`help`** | Yardım listesini yazdırır. |

---

## 🏃 Başlatma

```powershell
cd C:\Users\disco\.gemini\antigravity\scratch\minecraft-vip-bot
npm start
```
