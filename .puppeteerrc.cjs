const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Força o Render a baixar o Chrome DENTRO da pasta do seu projeto
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};