const dns = require("dns");
const https = require("https");

const host = "aeecmwzmarjzliwctqcx.supabase.co";

console.log(`🔍 Testing DNS resolution for: ${host}`);

dns.lookup(host, (err, address, family) => {
    console.log("👉 dns.lookup result:", { err: err?.message, address, family });

    if (err) {
        console.error("❌ DNS LOOKUP FAILED. Node cannot find the host.");
        return;
    }

    console.log("🌍 Attempting HTTPS connection...");
    const req = https.request(
        { hostname: host, path: "/rest/v1/", method: "GET", timeout: 8000 },
        (res) => {
            console.log("✅ HTTPS connection establised. Status:", res.statusCode);
            res.resume();
        }
    );

    req.on("timeout", () => {
        console.error("⏳ HTTPS TIMEOUT");
        req.destroy(new Error("timeout"));
    });

    req.on("error", (e) => console.error("❌ HTTPS ERROR:", e.message));
    req.end();
});
