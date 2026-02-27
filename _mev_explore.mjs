/**
 * MEV SCBA - Exploración post-login
 * Objetivo: entender la interfaz de búsqueda por parte luego del login
 */
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

puppeteer.use(StealthPlugin());

const MEV_URL = 'https://mev.scba.gov.ar/loguin.asp';
const USER = process.env.SCBA_MEV_USER || 'Garbox0';
const PASS = process.env.SCBA_MEV_PASS || 'GbrlArq2025!';

async function exploreMEV() {
    console.log('[MEV Explore] Lanzando navegador...');
    const browser = await puppeteer.launch({
        headless: false, // visible para depuración
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
        defaultViewport: { width: 1280, height: 900 },
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    try {
        // ── 1. Login ──────────────────────────────────────────────────────────
        console.log('[MEV Explore] Navegando al login...');
        await page.goto(MEV_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({ path: '_mev_01_login.png', fullPage: false });

        // Capturar campos del form de login
        const loginFields = await page.evaluate(() =>
            Array.from(document.querySelectorAll('input, select')).map(el => ({
                tag: el.tagName, name: el.name, id: el.id, type: el.type, value: el.value
            }))
        );
        console.log('[MEV Explore] Campos login:', JSON.stringify(loginFields, null, 2));

        // Capturar scripts externos para encontrar Validar_loguin
        const scriptSrcs = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            return scripts.map(s => s.src);
        });
        console.log('[MEV Explore] Scripts externos:', scriptSrcs);

        // Capturar página completa HTML para debug
        const fullHTML = await page.content();
        const fs = await import('fs');
        fs.writeFileSync('_mev_login_page.html', fullHTML);
        console.log('[MEV Explore] HTML guardado en _mev_login_page.html');

        // Setear valores directamente
        await page.evaluate((u, p) => {
            document.querySelector('input[name="usuario"]').value = u;
            document.querySelector('input[name="clave"]').value = p;
        }, USER, PASS);

        await page.screenshot({ path: '_mev_02_filled.png', fullPage: false });

        // Click en el botón real (respetando el onsubmit handler)
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
            page.click('#Submit1'),
        ]);

        console.log('[MEV Explore] Post-login URL:', page.url());
        await page.screenshot({ path: '_mev_03_postlogin.png', fullPage: true });

        // ── 2. Analizar interfaz post-login ──────────────────────────────────
        const postLoginData = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'))
                .map(a => ({ text: a.textContent.trim(), href: a.href }))
                .filter(a => a.text.length > 2 && a.text.length < 80);

            const forms = Array.from(document.querySelectorAll('form')).map(f => ({
                action: f.action,
                method: f.method,
                fields: Array.from(f.querySelectorAll('input, select, textarea')).map(el => ({
                    tag: el.tagName, name: el.name, id: el.id, type: el.type,
                    options: el.tagName === 'SELECT'
                        ? Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
                        : undefined
                }))
            }));

            return {
                url: window.location.href,
                title: document.title,
                links,
                forms,
                bodyText: document.body.innerText.slice(0, 2000)
            };
        });

        console.log('[MEV Explore] Página post-login:', JSON.stringify(postLoginData, null, 2));
        writeFileSync('_mev_postlogin.json', JSON.stringify(postLoginData, null, 2));
        console.log('[MEV Explore] Guardado en _mev_postlogin.json');

        // ── 3. Buscar enlace a "Consulta de Causas" o similar ────────────────
        const causeLink = postLoginData.links.find(l =>
            /consulta|causa|expediente|buscar|parte/i.test(l.text + l.href)
        );
        if (causeLink) {
            console.log('[MEV Explore] Enlace de búsqueda encontrado:', causeLink);

            await page.goto(causeLink.href, { waitUntil: 'networkidle2', timeout: 30000 });
            console.log('[MEV Explore] URL búsqueda:', page.url());
            await page.screenshot({ path: '_mev_04_search.png', fullPage: true });

            const searchData = await page.evaluate(() => {
                const forms = Array.from(document.querySelectorAll('form')).map(f => ({
                    action: f.action,
                    method: f.method,
                    fields: Array.from(f.querySelectorAll('input, select, textarea')).map(el => ({
                        tag: el.tagName, name: el.name, id: el.id, type: el.type,
                        options: el.tagName === 'SELECT'
                            ? Array.from(el.options).map(o => ({ value: o.value, text: o.text }))
                            : undefined
                    }))
                }));
                return {
                    url: window.location.href,
                    title: document.title,
                    forms,
                    bodyText: document.body.innerText.slice(0, 3000)
                };
            });

            writeFileSync('_mev_searchpage.json', JSON.stringify(searchData, null, 2));
            console.log('[MEV Explore] Interfaz de búsqueda guardada en _mev_searchpage.json');
        } else {
            console.log('[MEV Explore] No se encontró enlace de búsqueda. Revisá _mev_postlogin.json');
        }

        // Esperar 5 segundos para poder ver el browser antes de cerrar
        await new Promise(r => setTimeout(r, 5000));

    } catch (err) {
        console.error('[MEV Explore] Error:', err.message);
        await page.screenshot({ path: '_mev_error.png', fullPage: true }).catch(() => {});
    } finally {
        await browser.close();
    }
}

exploreMEV();
