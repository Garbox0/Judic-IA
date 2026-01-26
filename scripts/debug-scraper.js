
const fetch = require('node-fetch'); // Needs node-fetch or native fetch in Node 18+

const URL = "http://servicios.infoleg.gob.ar/infolegInternet/anexos/235000-239999/235975/texact.htm";

async function debug() {
    console.log(`Fetching from ${URL}...`);
    try {
        const res = await fetch(URL);
        const text = await res.text();
        console.log("Length:", text.length);
        console.log("First 500 chars:", text.substring(0, 500));

        // Check if it's a frame set
        if (text.includes('<frameset')) {
            console.log("WARNING: Page is a frameset!");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

debug();
