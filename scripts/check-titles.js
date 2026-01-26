
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const urls = [
    "https://www.infoleg.gob.ar/?page_id=87",
    "https://www.infoleg.gob.ar/?page_id=55",
    "https://www.infoleg.gob.ar/?page_id=103"
];

async function check() {
    for (const url of urls) {
        try {
            const res = await fetch(url);
            const html = await res.text();
            const $ = cheerio.load(html);
            const title = $('title').text().trim();
            const h1 = $('h1').text().trim() || $('.entry-title').text().trim(); // WordPress typical
            console.log(`URL: ${url}`);
            console.log(`Title: ${title}`);
            console.log(`H1: ${h1}`);
            console.log('---');
        } catch (e) {
            console.log(`Error ${url}: ${e.message}`);
        }
    }
}
check();
