import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

const CREDIT_PACKS = {
  pack_10: { credits: 10, amount: 7500, label: "Pack 10 busquedas" },
  pack_25: { credits: 25, amount: 15000, label: "Pack 25 busquedas" },
  pack_50: { credits: 50, amount: 25000, label: "Pack 50 busquedas" },
};

function isFutureDate(value) {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed > new Date();
}

function hasActivePaidSubscription(profile) {
  if (!profile) return false;
  if (profile.plan_tier === "enterprise") return true;
  if (profile.plan_tier !== "professional") return false;

  if (profile.subscription_status === "active") {
    return isFutureDate(profile.subscription_expiry);
  }

  if (profile.subscription_status === "past_due") {
    return isFutureDate(profile.grace_period_ends_at);
  }

  return false;
}

export async function POST(request) {
  const auth = await verifyAuth(request);
  if (auth.error) return auth.response;

  const userId = auth.user.id;
  const body = await request.json().catch(() => ({}));
  const { pack_id } = body;

  const pack = CREDIT_PACKS[pack_id];
  if (!pack) {
    return NextResponse.json({ error: "Pack invalido" }, { status: 400 });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MP no configurado" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const isSuperUser =
    auth.user?.email === "gbrlescalada@gmail.com" &&
    userId === "365cd259-4f1e-4004-a677-1eda06a5147e";

  if (!isSuperUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, plan_tier, subscription_expiry, grace_period_ends_at")
      .eq("id", userId)
      .single();

    const hasActiveSub = hasActivePaidSubscription(profile);
    if (!hasActiveSub) {
      return NextResponse.json(
        {
          error: "SUBSCRIPTION_REQUIRED",
          message: "Necesitas una suscripcion profesional activa para comprar creditos extra.",
        },
        { status: 403 }
      );
    }
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;

  const { data: purchase, error: dbError } = await supabase
    .from("credit_purchases")
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
    console.error("[mp/credits/create] Error creating purchase record:", dbError);
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
    external_reference: `credits:${purchase.id}:${userId}`,
    back_urls: {
      success: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/research?credits=ok`,
      failure: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/research?credits=error`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/research?credits=pending`,
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
    console.error("[mp/credits/create] MP preference error:", mpData);
    await supabase.from("credit_purchases").delete().eq("id", purchase.id);
    return NextResponse.json({ error: "Error al crear preferencia MP" }, { status: 500 });
  }

  return NextResponse.json({
    init_point: mpData.init_point,
    purchase_id: purchase.id,
  });
}
