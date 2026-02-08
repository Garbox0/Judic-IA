import { NextResponse } from "next/server";

export async function POST() {
    try {
        const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

        if (!accessToken) {
            throw new Error("Missing MERCADOPAGO_ACCESS_TOKEN");
        }

        const planPayload = {
            reason: "Judic-IA Professional",
            auto_recurring: {
                frequency: 1,
                frequency_type: "months",
                transaction_amount: 25000,
                currency_id: "ARS"
            }
        };

        const response = await fetch(
            "https://api.mercadopago.com/preapproval_plan",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(planPayload)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error("MP PLAN ERROR:", data);
            return NextResponse.json(
                { error: data },
                { status: response.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("PLAN CREATE ERROR:", error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}
