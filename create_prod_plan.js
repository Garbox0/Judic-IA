// create_prod_plan.js
require('dotenv').config({ path: '.env.local' });
const { MercadoPagoConfig, PreApprovalPlan } = require('mercadopago');
const fs = require('fs');

async function createPlan() {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    if (!accessToken) {
        console.error("❌ ERROR: No MERCADOPAGO_ACCESS_TOKEN found in .env.local");
        return;
    }

    console.log("🔐 Using Access Token:", accessToken.slice(0, 10) + "...");

    const client = new MercadoPagoConfig({ accessToken: accessToken });
    const preApprovalPlan = new PreApprovalPlan(client);

    try {
        const response = await preApprovalPlan.create({
            body: {
                reason: "Suscripción Judic-IA (Producción)",
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: 25000,
                    currency_id: "ARS"
                },
                back_url: "https://judic-ia.com/dashboard/settings",
                status: "active"
            }
        });

        console.log("\n✅ PLAN CREADO EXITOSAMENTE!");
        console.log("ID:", response.id);
        fs.writeFileSync('plan_id.txt', response.id);

    } catch (error) {
        console.error("❌ Error creando el plan:", error);
    }
}

createPlan();
