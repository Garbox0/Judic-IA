
import { MercadoPagoConfig } from 'mercadopago';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
const existingId = process.env.MP_PREAPPROVAL_PLAN_ID;

if (!existingId) {
    console.log("No ID found in env.");
    process.exit(0);
}

async function checkId() {
    console.log(`🔍 Checking ID from .env: ${existingId}`);
    try {
        // Try to fetch as Preapproval Plan
        const res = await fetch(`https://api.mercadopago.com/preapproval_plan/${existingId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (res.ok) {
            const data = await res.json();
            console.log("\n✅ IS A VALID RECURRING PLAN:");
            console.log(`   Internal ID: ${data.id}`);
            console.log(`   Reason: ${data.reason}`);
            console.log(`   Auto Recurring: ${JSON.stringify(data.auto_recurring)}`);
            console.log(`   Init Point: ${data.init_point}`);
            console.log("   ---");
            console.log("   CONCLUSION: You have a valid plan ID, but the codebase uses 'checkout/preferences' endpoint.");
        } else {
            console.log(`\n❌ Not a Preapproval Plan (Status: ${res.status}). Checking if it is a Preference...`);
            // Try to fetch as Preference
            const resPref = await fetch(`https://api.mercadopago.com/checkout/preferences/${existingId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (resPref.ok) {
                const dataP = await resPref.json();
                console.log("\n⚠️  IS A PREFERENCE (One-time payment link):");
                console.log(`   Items: ${JSON.stringify(dataP.items)}`);
            } else {
                console.log("\n❌ Invalid ID. Neither Plan nor Preference.");
            }
        }

    } catch (error) {
        console.error("Error checking:", error);
    }
}

checkId();
