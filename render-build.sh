#!/usr/bin/env bash
# Sair em caso de erro
set -o errexit

# Define a variável localmente para o processo de build
export PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer

npm install
# Força a instalação no caminho correto
npx puppeteer browsers install chrome