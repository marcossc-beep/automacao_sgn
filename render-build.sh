#!/usr/bin/env bash
set -o errexit

npm install
# Garante a instalação do Chrome dentro da pasta do projeto
npx puppeteer browsers install chrome


# # PARA POR NO RENDERNo painel do Render, quando você for criar o "Web Service", coloque o Build Command como: ./render-build.sh (em vez do tradicional npm install).