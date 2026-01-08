// list_plans.js
require('dotenv').config({ path: '.env.local' });
const { MercadoPagoConfig, PreApprovalPlan } = require('mercadopago');
const fs = require('fs');

async function listPlans() {
    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const preApprovalPlan = new PreApprovalPlan(client);

    try {
        console.log("Searching for plans...");
        const response = await preApprovalPlan.search({
            options: {
                limit: 5,
                offset: 0
            }
        });

        const plans = response.results || [];
        console.log(`Found ${plans.length} plans.`);

        // Find the one created recently or with 25000
        const targetPlan = plans.find(p => p.auto_recurring && p.auto_recurring.transaction_amount === 25000);

        if (targetPlan) {
            console.log("✅ Found 25000 ARS Plan!");
            console.log("ID:", targetPlan.id);
            fs.writeFileSync('plan_id.txt', targetPlan.id);
        } else if (plans.length > 0) {
            console.log("⚠️ 25000 plan not found. Latest plan:");
            console.log("ID:", plans[0].id);
            console.log("Amount:", plans[0].auto_recurring.transaction_amount);
            fs.writeFileSync('plan_id.txt', plans[0].id); // Fallback to latest
        } else {
            console.log("❌ No plans found.");
        }

    } catch (error) {
        console.error("❌ Error listing plans:", error);
    }
}

listPlans();
