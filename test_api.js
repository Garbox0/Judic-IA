// Native fetch in Node 18+

async function testApi() {
    console.log("Testing API...");
    try {
        const response = await fetch('http://localhost:3000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Test message",
                history: [],
                mode: "sales"
            })
        });

        const text = await response.text();
        console.log("Status:", response.status);
        try {
            const data = JSON.parse(text);
            console.log("Response:", data);

            if (response.status === 200 && data.reply) {
                console.log("✅ API IS WORKING!");
            } else {
                console.error("❌ API FAILED.");
            }
        } catch (e) {
            console.error("❌ RESPONSE IS NOT JSON. RAW OUTPUT:");
            console.log(text.substring(0, 500)); // Print first 500 chars
        }
    } catch (error) {
        console.error("❌ NETWORK ERROR:", error);
    }
}

testApi();
