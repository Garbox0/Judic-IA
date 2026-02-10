
import { MercadoPagoConfig, PreApprovalPlan } from 'mercadopago';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN_PROD || process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!accessToken) {
    console.error("❌ MERCADOPAGO_ACCESS_TOKEN not found in .env.local");
    process.exit(1);
}

const client = new MercadoPagoConfig({ accessToken });
const preApprovalPlan = new PreApprovalPlan(client);

async function createPlans() {
    console.log("🚀 Creating MercadoPago Recurring Plans...");

    try {
        // 1. Monthly Plan
        const monthlyPlan = await preApprovalPlan.create({
            body: {
                reason: "Suscripción Mensual - Judic-IA Suite Pro",
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: 25000,
                    currency_id: "ARS",
                    billing_day_proportional: false,
                },
                back_url: "https://judic-ia.com/dashboard/settings?status=success",
                payment_methods_allowed: {
                    payment_types: [{ id: "credit_card" }, { id: "debit_card" }]
                }
            }
        });
        console.log("\n✅ MONTHLY PLAN CREATED:");
        console.log(`   ID: ${monthlyPlan.id}`);
        console.log(`   Name: ${monthlyPlan.reason}`);

        // 2. Annual Plan
        const annualPlan = await preApprovalPlan.create({
            body: {
                reason: "Suscripción Anual - Judic-IA Suite Pro (2 meses bonificados)",
                auto_recurring: {
                    frequency: 12,
                    frequency_type: "months",
                    transaction_amount: 250000, // 25000 * 10
                    currency_id: "ARS"
                },
                back_url: "https://judic-ia.com/dashboard/settings?status=success",
                payment_methods_allowed: {
                    payment_types: [{ id: "credit_card" }, { id: "debit_card" }]
                }
            }
        });
        console.log("\n✅ ANNUAL PLAN CREATED:");
        console.log(`   ID: ${annualPlan.id}`);
        console.log(`   Name: ${annualPlan.reason}`);

        console.log("\n⚠️  SAVE THESE IDs IN YOUR .env.local AND VERCEL ENV VARIABLES:");
        console.log(`MP_PLAN_PRO_MONTHLY=${monthlyPlan.id}`);
        console.log(`MP_PLAN_PRO_ANNUAL=${annualPlan.id}`);

    } catch (error) {
        console.error("❌ Error creating plans:", error);
    }
}

createPlans();
