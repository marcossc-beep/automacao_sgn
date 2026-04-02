const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Isso força o download para dentro da pasta do projeto
  cacheDirectory: join(process.cwd(), '.cache', 'puppeteer'),
};