const {join} = require('path');

module.exports = {
  // Obriga o Puppeteer a instalar o Chrome dentro da pasta do projeto
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};  