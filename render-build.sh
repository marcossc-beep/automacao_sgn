#!/usr/bin/env bash
set -o errexit

npm install
# Instala o chrome
npx puppeteer browsers install chrome

# CRIA UM ATALHO FIXO: Pega o caminho de onde o chrome foi instalado e linka para 'chrome-bin'
ln -sf $(npx puppeteer browsers bin chrome) ./chrome-bin