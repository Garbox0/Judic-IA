import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

// GET: Obtener facturas del usuario autenticado
export async function GET(req) {
    try {
        // Crear cliente con cookies para obtener el usuario autenticado
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            {
                cookies: {
                    getAll() {
                        return cookieStore.getAll();
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json({ error: "No autenticado" }, { status: 401 });
        }

        // Usar service role para leer las facturas (bypass RLS issues)
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

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
