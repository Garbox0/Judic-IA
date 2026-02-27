import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writeFileSync } from 'fs';

puppeteer.use(StealthPlugin());

const SCW_URL = 'https://scw.pjn.gov.ar/scw/home.seam';
const OUTPUT_PATH = '_pjn_parte_tipos_por_jurisdiccion.json';

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function goToPorParte(page) {
  await page.evaluate(() => {
    const normalize = (text = '') => {
      try {
        return String(text)
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .trim();
      } catch {
        return String(text || '').toLowerCase().trim();
      }
    };

    const explicit =
      document.getElementById('formPublica:porParte:header:inactive') ||
      document.getElementById('formPublica:porParte:header:active');
    if (explicit) {
      explicit.click();
      return;
    }

    const nodes = [...document.querySelectorAll('td.rf-tab-hdr, span.rf-tab-lbl, a, li, span')];
    const target = nodes.find((n) => normalize(n.textContent || '').includes('por parte'));
    if (!target) return;
    (target.closest('td.rf-tab-hdr') || target).click();
  });

  await page
    .waitForSelector(
      '#formPublica\\:porParte[style*="display: block"], #formPublica\\:camaraPartes',
      { timeout: 10000 }
    )
    .catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function getJurisdicciones(page) {
  return page.evaluate(() => {
    const sel = document.querySelector('select[name="formPublica:camaraPartes"], #formPublica\\:camaraPartes');
    if (!sel) return [];
    return [...sel.options]
      .map((opt) => ({ value: String(opt.value || ''), label: String(opt.textContent || '').trim() }))
      .filter((opt) => opt.value);
  });
}

async function selectJurisdiccion(page, value) {
  await page.evaluate((jur) => {
    const sel = document.querySelector('select[name="formPublica:camaraPartes"], #formPublica\\:camaraPartes');
    if (!sel) return;
    sel.value = jur;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);

  await new Promise((resolve) => setTimeout(resolve, 1200));
}

async function readTipoParteState(page) {
  return page.evaluate(() => {
    const tipoSelect =
      document.querySelector('select[name="formPublica:tipo"], #formPublica\\:tipo');
    const leyendaNode = document.getElementById('formPublica:leyenda') ||
      document.querySelector('[id*="leyenda"]');

    const options = tipoSelect
      ? [...tipoSelect.options].map((opt) => ({
        value: String(opt.value || ''),
        label: String(opt.textContent || '').trim()
      }))
      : [];

    const enabledOptions = options.filter((opt) => opt.value);
    const isDisabled = Boolean(tipoSelect?.disabled);
    const selectedValue = tipoSelect ? String(tipoSelect.value || '') : '';
    const leyenda = String(leyendaNode?.textContent || '').trim();

    return { options, enabledOptions, isDisabled, selectedValue, leyenda };
  });
}

async function main() {
  console.log('[SCW tipos por jurisdiccion] Iniciando...');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9' });
    await page.setViewport({ width: 1366, height: 900 });

    await page.goto(SCW_URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));

    await goToPorParte(page);

    const jurisdicciones = await getJurisdicciones(page);
    if (!jurisdicciones.length) {
      throw new Error('No se encontro el select de jurisdiccion en Por Parte.');
    }

    const result = {
      extracted_at: new Date().toISOString(),
      source_url: SCW_URL,
      total_jurisdicciones: jurisdicciones.length,
      jurisdicciones: []
    };

    for (const jur of jurisdicciones) {
      await selectJurisdiccion(page, jur.value);
      const state = await readTipoParteState(page);

      result.jurisdicciones.push({
        id: jur.value,
        label: cleanText(jur.label),
        tipo_disabled: state.isDisabled,
        tipo_selected_value: cleanText(state.selectedValue),
        leyenda: cleanText(state.leyenda),
        tipos: state.enabledOptions.map((opt) => ({
          value: cleanText(opt.value),
          label: cleanText(opt.label)
        }))
      });

      const resumenTipos = state.enabledOptions.map((t) => t.value).join(', ') || '(sin tipos)';
      console.log(`[SCW] ${jur.value} ${cleanText(jur.label)} -> ${resumenTipos}`);
    }

    writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), 'utf8');
    console.log(`[SCW tipos por jurisdiccion] Guardado en ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[SCW tipos por jurisdiccion] Error:', err?.message || err);
  process.exitCode = 1;
});
