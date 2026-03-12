import { realizarLogin } from "./login.js";
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const CONFIG = {
    timeouts: { navigation: 60000, selector: 22000, ajax: 18000 },
    delays: { typing: 45, min: 1100, max: 2800 }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const randomDelay = () => sleep(Math.floor(Math.random() * (CONFIG.delays.max - CONFIG.delays.min + 1)) + CONFIG.delays.min);

export async function runPareceresAutomation({ user, password, diaryLink, addLog }) {
    const log = msg => {
        const ts = new Date().toLocaleTimeString('pt-BR');
        console.log(`[Pareceres ${ts}] ${msg}`);
        if (addLog) addLog(msg);
    };

    log("🚀 Iniciando Automação de Pareceres - modo dropdown + modal (2026)");

    let bancoPareceres;
    try {
        const filePath = path.join(process.cwd(), 'outros_arquivos', 'pareceres.json');
        bancoPareceres = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        log(`📚 Banco carregado (${Object.keys(bancoPareceres).length} chaves)`);
    } catch (err) {
        log(`❌ Erro pareceres.json → ${err.message}`);
        return { success: false, message: err.message };
    }

    const loginResult = await realizarLogin(user, password, diaryLink, log);
    if (!loginResult.success) return loginResult;

    const { browser: loginBrowser, page: loginPage } = loginResult;
    const cookies = await loginPage.cookies();
    await loginBrowser.close();

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setCookie(...cookies);

    try {
        log(`→ ${diaryLink}`);
        await page.goto(diaryLink, { waitUntil: 'networkidle2', timeout: CONFIG.timeouts.navigation });

        // ─── Localiza e clica na aba PEDAGÓGICO ───────────────────────────────
        const abaClicada = await page.evaluate(() => {
            const candidatos = ["PEDAGÓGICO", "PARECER", "PEDAGOGICO", "Plano Educacional"];
            const els = [...document.querySelectorAll("a, li, span.ui-menuitem-text, .ui-tabview-title")];
            for (const el of els) {
                const t = (el.innerText || "").trim().toUpperCase();
                if (candidatos.some(c => t.includes(c)) && el.offsetParent !== null) {
                    el.click();
                    return t;
                }
            }
            return null;
        });

        if (!abaClicada) throw new Error("Aba Pedagógico/Pareceres não encontrada");

        log(`Aba clicada: ${abaClicada}`);
        await sleep(7000);

        await page.waitForFunction(
            () => !document.querySelector('.blockUI, .ui-blockui, .ajax-loader'),
            { timeout: 20000 }
        ).catch(() => log("Loader demorou, prosseguindo..."));

        // ─── Extrai todos os alunos do <select> ───────────────────────────────
        const alunos = await page.evaluate(() => {
            const select = document.querySelector('select[id*="selectEstudantes_input"]');
            if (!select) return [];

            return Array.from(select.options)
                .filter(opt => opt.value && !opt.value.includes("Selecione") && opt.value.trim())
                .map(opt => ({
                    value: opt.value.trim(),
                    nome: opt.textContent.trim()
                }));
        });

        log(`Encontrados ${alunos.length} alunos no dropdown`);

        if (alunos.length === 0) {
            await page.screenshot({ path: 'debug-sem-alunos.png', fullPage: true });
            throw new Error("Nenhum aluno encontrado no selectEstudantes");
        }

        for (const aluno of alunos) {
            log(`Processando → ${aluno.nome}`);

            // 1. Seleciona o aluno no dropdown
            await page.evaluate((val) => {
                const sel = document.querySelector('select[id*="selectEstudantes_input"]');
                if (sel) {
                    sel.value = val;
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, aluno.value);

            await sleep(4000); // aguarda ajax carregar sanfonas

            // 2. Expande sanfona "Desempenho" se necessário
            const expandiuDesempenho = await page.evaluate(() => {
                const headers = [...document.querySelectorAll('.ui-accordion-header')];
                const target = headers.find(h => h.innerText.includes('Desempenho'));
                if (target && target.getAttribute('aria-expanded') !== 'true') {
                    target.click();
                    return true;
                }
                return false;
            });

            if (expandiuDesempenho) await sleep(1800);

            // 3. Expande sanfona "Pareceres" se necessário
            await page.evaluate(() => {
                const headers = [...document.querySelectorAll('.ui-accordion-header')];
                const target = headers.find(h => h.innerText.includes('Pareceres'));
                if (target && target.getAttribute('aria-expanded') !== 'true') {
                    target.click();
                }
            });
            await sleep(1500);

            // 4. Verifica se já existe parecer lançado (evitar duplicata)
            const jaTemParecer = await page.evaluate(() => {
                const area = document.querySelector('[id*="desempenhoMedias"]');
                if (!area) return false;
                const texts = [...area.querySelectorAll('textarea')].map(t => t.value.trim());
                return texts.some(t => t.length > 10); // heurística simples
            });

            if (jaTemParecer) {
                log(`   ⏭️ Pulando (já tem texto preenchido)`);
                continue;
            }

            // 5. Clica em "Adicionar Registro Pedagógico"
            const botaoAdicionarExiste = await page.evaluate(() => {
                const btn = document.querySelector('a[id*="adicionarRegistroPedagogico"], button[id*="adicionarRegistroPedagogico"]');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (!botaoAdicionarExiste) {
                log(`   ⚠️ Botão "Adicionar Registro Pedagógico" não encontrado`);
                continue;
            }

            await sleep(3500);

            // 6. Digita no modal
            try {
                await page.waitForSelector('textarea', { visible: true, timeout: 12000 });

                // Sorteia frase compatível com o conceito final (se souber qual é)
                // Aqui assumimos 'A' ou 'B' como padrão - melhore depois se quiser ler o CF
                const conceitoPadrao = 'A'; // ← altere ou leia da tela se possível
                const frases = bancoPareceres[conceitoPadrao] || bancoPareceres['B'] || [];
                
                if (frases.length === 0) {
                    log(`   ⚠️ Sem frases para conceito ${conceitoPadrao}`);
                    await page.keyboard.press('Escape');
                    continue;
                }

                const texto = frases[Math.floor(Math.random() * frases.length)];

                await page.click('textarea', { clickCount: 3 });
                await page.keyboard.down('Control');
                await page.keyboard.press('A');
                await page.keyboard.up('Control');
                await page.keyboard.press('Backspace');

                await page.type('textarea', texto, { delay: CONFIG.delays.typing });
                await randomDelay();

                // 7. Salva modal
                await page.evaluate(() => {
                    const btns = [...document.querySelectorAll('button, a.ui-button')];
                    const salvar = btns.find(b => 
                        b.innerText.toUpperCase().includes('SALVAR') || 
                        b.innerText.toUpperCase().includes('GRAVAR') ||
                        b.id?.toLowerCase().includes('salvar')
                    );
                    if (salvar) salvar.click();
                });

                await sleep(5000);
                log(`   ✓ Parecer lançado`);

            } catch (e) {
                log(`   ❌ Erro no modal → ${e.message}`);
                try { await page.keyboard.press('Escape'); } catch {}
            }
        }

        log("Concluído com sucesso!");
        await browser.close();
        return { success: true };

    } catch (err) {
        log(`🛑 Erro crítico: ${err.message}`);
        await page.screenshot({ path: 'debug-erro-final.png', fullPage: true }).catch();
        await browser.close().catch();
        return { success: false, message: err.message };
    }
}