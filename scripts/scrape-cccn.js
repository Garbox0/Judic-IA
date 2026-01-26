
const fs = require('fs');
const cheerio = require('cheerio');
const https = require('http'); // InfoLeg uses http for some reason, or we force it. Actually lets use fetch if node 18+

// URL provided by user: http://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm
// Note: InfoLeg HTML is notoriously messy (nested tables, missing tags).
// We will use a fetch and then cheerio load.

const URL = "http://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm";
const OUT_PATH = "d:/Antigravity/Judic-IA/app/dashboard/legislation/data/cccn.js";

async function scrape() {
    console.log(`Fetching from ${URL}...`);

    try {
        const res = await fetch(URL);
        const arrayBuffer = await res.arrayBuffer();
        // Decode as ISO-8859-1 (Latin1) because InfoLeg is old and usually not UTF-8
        const decoder = new TextDecoder('iso-8859-1');
        const html = decoder.decode(arrayBuffer);

        console.log("Parsing HTML...");
        const $ = cheerio.load(html);

        let structure = [];
        let currentLevel = { level: "TÍTULO PRELIMINAR", chapters: [] };
        let currentChapter = { title: "General", articles: [] };

        // InfoLeg structure is usually flattened <p> tags with bold text.
        // We iterate through all <p> tags in the main container.
        // The container is usually a table cell or just the body in texact.

        const contentNodes = $('p, div, td');

        console.log(`Found ${contentNodes.length} paragraphs. Processing...`);

        // Heuristics for parsing
        // Titles: "LIBRO PRIMERO", "TITULO I" etc (Usually centered or bold)
        // Articles: "ARTICULO 1°" or "ARTICULO 1º"

        let bookName = "";
        let titleName = "";

        contentNodes.each((i, el) => {
            const rawText = $(el).text().trim().replace(/\s+/g, ' ');
            const html = $(el).html();

            // Heuristic: Check for Bold tags explicitly
            // InfoLeg uses <b>TITULO</b> or <p style="font-weight: bold">TITULO</p>
            const hasBold = $(el).find('b').length > 0 || ($(el).attr('style') && $(el).attr('style').includes('bold'));

            // LIBROS / TITULOS
            if (rawText.match(/^(LIBRO|TÍTULO PRELIMINAR|TITULO|CAPITULO)/i)) {
                if (hasBold || rawText.length < 100) {
                    // New Level or Chapter
                    if (rawText.startsWith('LIBRO') || rawText.startsWith('TÍTULO PRELIMINAR')) {
                        if (currentChapter && currentChapter.articles.length > 0) currentLevel.chapters.push(currentChapter);
                        if (currentLevel && currentLevel.chapters.length > 0) structure.push(currentLevel);
                        currentLevel = { level: rawText, chapters: [] };
                        currentChapter = { title: "Inicio", articles: [] };
                    } else {
                        // Chapter/Title
                        if (currentChapter && currentChapter.articles.length > 0) currentLevel.chapters.push(currentChapter);
                        currentChapter = { title: rawText, articles: [] };
                    }
                    return;
                }
            }

            // ARTICLES
            // Match "Art. 1" or "ARTICULO 1"
            const artMatch = rawText.match(/^(?:Art\.|ARTICULO)\s*(\d+)\s*[°º\.]?/i);

            if (artMatch) {
                const num = artMatch[1];
                let title = "S/N";
                let content = rawText;

                // Split by Em Dashes or Dots
                // "ARTICULO 1° — Fuentes y aplicacion."
                const dashSplit = rawText.split(/—|-/); // InfoLeg uses different dashes
                if (dashSplit.length > 1) {
                    // Try to extract title
                    const candidate = dashSplit[1].trim();
                    if (candidate.length < 100 && candidate.includes('.')) {
                        title = candidate.split('.')[0];
                        content = dashSplit.slice(1).join(' ').trim();
                    } else {
                        // sometimes no title, just text
                        content = dashSplit.slice(1).join(' ').trim();
                    }
                } else {
                    // Fallback: Split by first dot
                    const firstDot = rawText.indexOf('.');
                    if (firstDot > -1 && firstDot < 100) {
                        const preDot = rawText.substring(0, firstDot);
                        // Clean "ARTICULO 1"
                        title = preDot.replace(/^(?:Art\.|ARTICULO)\s*\d+\s*[°º\.]?/, '').trim();
                        content = rawText.substring(firstDot + 1).trim();
                    }
                }

                currentChapter.articles.push({
                    number: num,
                    title: title || `Art. ${num}`,
                    content: content
                });
            } else {
                // Continuation
                if (currentChapter && currentChapter.articles.length > 0 && rawText.length > 5) {
                    const lastArt = currentChapter.articles[currentChapter.articles.length - 1];
                    // Avoid appending navigation links or footnotes
                    if (!rawText.includes('Anterior') && !rawText.includes('Siguiente')) {
                        lastArt.content += "\n\n" + rawText;
                    }
                }
            }
        });

        // Push remainders
        if (currentChapter.articles.length > 0) currentLevel.chapters.push(currentChapter);
        if (currentLevel.chapters.length > 0) structure.push(currentLevel);

        console.log(`Parsed ${structure.length} books.`);
        let totalArts = 0;
        structure.forEach(b => b.chapters.forEach(c => totalArts += c.articles.length));
        console.log(`Parsed approx ${totalArts} articles.`);

        // Write to file
        const fileContent = `export const cccnData = ${JSON.stringify({
            id: 'cccn',
            title: 'Código Civil y Comercial de la Nación',
            lastUpdate: new Date().toISOString().split('T')[0], // Today
            structure: structure
        }, null, 2)};`;

        fs.writeFileSync(OUT_PATH, fileContent);
        console.log("Done! File written.");

    } catch (e) {
        console.error("Error scraping:", e);
    }
}

scrape();
