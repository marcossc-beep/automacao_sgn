#!/usr/bin/env bash
# Sair em caso de erro
set -o errexit

npm install
# Instala o Chrome na pasta definida pela variável de ambiente
npx puppeteer browsers install chrome