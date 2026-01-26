
const fetch = require('node-fetch'); // or global fetch if Node 18+

const URL = "https://www.saij.gob.ar/26994-nacional-codigo-civil-comercial-nacion-lns0005965-2014-10-01/123456789-0abc-defg-g56-95000scanyel?&o=1&f=Total%7CFecha%7CEstado%20de%20Vigencia/Vigente%2C%20de%20alcance%20general%7CTema%5B5%2C1%5D%7COrganismo%5B5%2C1%5D%7CAutor%5B5%2C1%5D%7CJurisdicci%F3n/Nacional%7CTribunal%5B5%2C1%5D%7CPublicaci%F3n%5B5%2C1%5D%7CColecci%F3n%20tem%E1tica%5B5%2C1%5D%7CTipo%20de%20Documento/Legislaci%F3n/Ley/C%F3digo&t=9";

async function debug() {
    console.log(`Fetching from ${URL}...`);
    try {
        const res = await fetch(URL);
        const text = await res.text();
        console.log("Length:", text.length);
        console.log("First 1500 chars:", text.substring(0, 1500));

        // Check for specific markers
        if (text.includes('article') || text.includes('art-content')) {
            console.log("Found semantic article tags or classes!");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

debug();
