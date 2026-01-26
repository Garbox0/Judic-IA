
const fetch = require('node-fetch');

const URL = "https://www.infoleg.gob.ar/?page_id=119";

async function scrapeSitemap() {
    console.log(`Fetching Sitemap from ${URL}...`);
    try {
        const res = await fetch(URL);
        const html = await res.text();
        console.log("Length:", html.length);

        // Simple regex to find links with text
        const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
        let match;
        const links = [];

        while ((match = linkRegex.exec(html)) !== null) {
            const href = match[1];
            const text = match[2].replace(/<[^>]*>/g, '').trim(); // Remove inner tags
            if (text.length > 3 && !href.startsWith('#')) {
                links.push({ text, href });
            }
        }

        console.log("Found links:");
        links.forEach(l => console.log(`- [${l.text}](${l.href})`));

    } catch (e) {
        console.error("Error:", e);
    }
}

scrapeSitemap();
