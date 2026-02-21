import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAuth } from "@/lib/api-auth";

const CREDIT_PACKS = {
  pack_10: { credits: 10, amount: 7250,  label: "Pack 10 búsquedas" },
  pack_25: { credits: 25, amount: 15000, label: "Pack 25 búsquedas" },
  pack_50: { credits: 50, amount: 25000, label: "Pack 50 búsquedas" },
};

export async function POST(request) {
  // 1. Autenticar
  const auth = await verifyAuth(request);
  if (auth.error) return auth.response;
  const userId = auth.user.id;

  const body = await request.json().catch(() => ({}));
  const { pack_id } = body;

  // 2. Validar pack
  const pack = CREDIT_PACKS[pack_id];
  if (!pack) {
    return NextResponse.json({ error: "Pack inválido" }, { status: 400 });
  }

  // 3. Crear preferencia de pago en MercadoPago (pago único, no suscripción)
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({ error: "MP no configurado" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const isSuperUser = auth.user?.email === 'gbrlescalada@gmail.com' && userId === '365cd259-4f1e-4004-a677-1eda06a5147e';

  if (!isSuperUser) {
    // 3b. Verificar suscripción activa — los credits son complemento, no reemplazo
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, plan_tier")
      .eq("id", userId)
      .single();

    // active = suscripción paga vigente o trial activo
    // past_due = pago fallido con 7 días de gracia — aún puede comprar
    const hasActiveSub =
      profile?.subscription_status === "active" ||
      profile?.subscription_status === "past_due" ||
      profile?.plan_tier === "enterprise";

    if (!hasActiveSub) {
      return NextResponse.json(
        { error: "SUBSCRIPTION_REQUIRED", message: "Necesitás una suscripción activa para comprar créditos extra." },
        { status: 403 }
      );
    }
  }

  // 4. Obtener email del usuario para prellenar MP
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const userEmail = authUser?.user?.email;

  // 5. Crear registro pendiente en credit_purchases
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
    console.error("❌ Error creating purchase record:", dbError);
    return NextResponse.json({ error: "Error al iniciar compra" }, { status: 500 });
  }

  // 6. Crear preferencia MP (pago único)
  const preference = {
    items: [
      {
        id: pack_id,
        title: `Judic-IA – ${pack.label}`,
        quantity: 1,
        unit_price: pack.amount,
        currency_id: "ARS",
      },
    ],
    payer: userEmail ? { email: userEmail } : undefined,
    // external_reference: purchase.id (UUID de credit_purchases)
    // El webhook lo usa para identificar qué compra aprobar
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
    console.error("❌ MP preference error:", mpData);
    // Limpiar registro pendiente
    await supabase.from("credit_purchases").delete().eq("id", purchase.id);
    return NextResponse.json({ error: "Error al crear preferencia MP" }, { status: 500 });
  }

  return NextResponse.json({
    init_point: mpData.init_point,         // URL para redirigir al usuario
    purchase_id: purchase.id,
  });
}
