const chalk = require('chalk');

class StatsTracker {
  constructor() {
    this.startTime = Date.now();
    this.totalMined = 0;
    this.totalDeposited = 0;
    this.pvDepositCycles = 0;
    this.blocksBreakdown = {};
  }

  recordBlockMined(blockName) {
    this.totalMined++;
    this.blocksBreakdown[blockName] = (this.blocksBreakdown[blockName] || 0) + 1;
  }

  recordDeposit(itemCount) {
    this.totalDeposited += itemCount;
    this.pvDepositCycles++;
  }

  getUptime() {
    const diff = Date.now() - this.startTime;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours} sa ${minutes} dk ${seconds} sn`;
  }

  getHourlyRate() {
    const hours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    if (hours < 0.001) return this.totalMined;
    return Math.round(this.totalMined / hours);
  }

  printDashboard() {
    console.log(chalk.cyan.bold('\n======================================================'));
    console.log(chalk.yellow.bold('             📊 DETAYLI BOT İSTATİSTİKLERİ             '));
    console.log(chalk.cyan.bold('======================================================'));
    console.log(chalk.white(`⏳ Çalışma Süresi:     ${chalk.green(this.getUptime())}`));
    console.log(chalk.white(`⛏️  Toplam Kırılan:     ${chalk.green.bold(this.totalMined + ' blok')}`));
    console.log(chalk.white(`⚡ Ortalama Kazma Hızı: ${chalk.yellow(this.getHourlyRate() + ' blok/saat')}`));
    console.log(chalk.white(`🎒 Depolanan Madenler:  ${chalk.magenta(this.totalDeposited + ' adet')} (${this.pvDepositCycles} sefer PV'ye aktarıldı)`));
    
    if (Object.keys(this.blocksBreakdown).length > 0) {
      console.log(chalk.gray('--- Kırılan Maden Dağılımı ---'));
      for (const [block, count] of Object.entries(this.blocksBreakdown)) {
        console.log(chalk.white(`  • ${chalk.yellow(block)}: ${chalk.green(count + ' adet')}`));
      }
    }
    console.log(chalk.cyan.bold('======================================================\n'));
  }
}

module.exports = new StatsTracker();
