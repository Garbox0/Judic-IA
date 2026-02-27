import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

const ALERT_PACKS = {
  alert_pack_1: { credits: 1, amount: 8900, label: "Pack 1 alerta (30 dias)" },
  alert_pack_10: { credits: 10, amount: 59000, label: "Pack 10 alertas (30 dias c/u)" },
  alert_pack_100: { credits: 100, amount: 429000, label: "Pack 100 alertas (30 dias c/u)" },
};

export async function POST(request) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.response;

  const userId = auth.user.id;
  const body = await request.json().catch(() => ({}));
  const { pack_id } = body;

  const pack = ALERT_PACKS[pack_id];
  if (!pack) {
    return NextResponse.json({ error: "Pack inválido" }, { status: 400 });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MP no configurado" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, plan_tier")
    .eq("id", userId)
    .single();

  const hasActiveSub =
    profile?.subscription_status === "active" ||
    profile?.subscription_status === "past_due" ||
    profile?.plan_tier === "enterprise";

  if (!hasActiveSub) {
    return NextResponse.json(
      {
        error: "SUBSCRIPTION_REQUIRED",
        message: "Necesitás una suscripción activa para comprar créditos de alerta."
      },
      { status: 403 }
    );
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;

  const { data: purchase, error: dbError } = await supabase
    .from("alert_credit_purchases")
    .insert({
      user_id: userId,
      pack_id,
      credits: pack.credits,
      amount_ars: pack.amount,
      status: "pending",
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("[mp/alerts/create] Error creating purchase record:", dbError);
    return NextResponse.json({ error: "Error al iniciar compra" }, { status: 500 });
  }

  const preference = {
    items: [
      {
        id: pack_id,
        title: `Judic-IA - ${pack.label}`,
        quantity: 1,
        unit_price: pack.amount,
        currency_id: "ARS",
      },
    ],
    payer: userEmail ? { email: userEmail } : undefined,
    external_reference: `alert_credits:${purchase.id}:${userId}`,
    back_urls: {
      success: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/research?alert_credits=ok`,
      failure: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/research?alert_credits=error`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/research?alert_credits=pending`,
    },
    auto_return: "approved",
    notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/mp/webhook`,
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preference),
  });

  const mpData = await mpRes.json();
  if (!mpRes.ok) {
    console.error("[mp/alerts/create] MP preference error:", mpData);
    await supabase.from("alert_credit_purchases").delete().eq("id", purchase.id);
    return NextResponse.json({ error: "Error al crear preferencia MP" }, { status: 500 });
  }

  return NextResponse.json({
    init_point: mpData.init_point,
    purchase_id: purchase.id,
  });
}
