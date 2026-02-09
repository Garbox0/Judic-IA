import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// GET: Obtener facturas del usuario autenticado
export async function GET(req) {
    try {
        // Auth via Bearer token
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return NextResponse.json({ error: "No autorizado - falta token" }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
        }

        const { data: invoices, error } = await supabaseAdmin
            .from("invoices")
            .select("*")
            .eq("user_id", user.id)
            .order("payment_date", { ascending: false });

        if (error) {
            console.error("Error fetching invoices:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ invoices });
    } catch (error) {
        console.error("Invoices API error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
