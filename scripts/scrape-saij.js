
const fs = require('fs');
const cheerio = require('cheerio');
const fetch = require('node-fetch');

const URL = "https://www.saij.gob.ar/26994-nacional-codigo-civil-comercial-nacion-lns0005965-2014-10-01/123456789-0abc-defg-g56-95000scanyel?&o=1&f=Total%7CFecha%7CEstado%20de%20Vigencia/Vigente%2C%20de%20alcance%20general%7CTema%5B5%2C1%5D%7COrganismo%5B5%2C1%5D%7CAutor%5B5%2C1%5D%7CJurisdicci%F3n/Nacional%7CTribunal%5B5%2C1%5D%7CPublicaci%F3n%5B5%2C1%5D%7CColecci%F3n%20tem%E1tica%5B5%2C1%5D%7CTipo%20de%20Documento/Legislaci%F3n/Ley/C%F3digo&t=9";

async function scrape() {
    console.log(`Fetching SAIJ TOC from ${URL}...`);
    const res = await fetch(URL);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Analyze links in the "arbol" or TOC
    // SAIJ usually has a sidebar or main area with links to "Texto completo" or "Anexos"

    // Look for "Texto Actualizado" link or "Anexo A"
    // Often: <a href="/...">Anexo A...</a>

    const links = $('a');
    console.log(`Found ${links.length} links.`);

    links.each((i, el) => {
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (text.includes('texto actualizado') || text.includes('Anexo') || text.includes('Texto completo')) {
            console.log(`Candidate Link: [${text}] -> ${href}`);
        }
    });

}
scrape();
