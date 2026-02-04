import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper: Verificar si el usuario es admin
async function verifyAdmin(req) {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
        return { error: "No autorizado", status: 401 };
    }

    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return { error: "Token inválido", status: 401 };
    }

    // Verificar rol admin
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profile?.role !== "admin") {
        return { error: "Acceso denegado", status: 403 };
    }

    return { user, supabaseAdmin };
}

// GET: Listar todas las facturas (con datos del usuario)
export async function GET(req) {
    const auth = await verifyAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = auth;

    try {
        // Obtener facturas con datos del perfil del usuario
        const { data: invoices, error } = await supabaseAdmin
            .from("invoices")
            .select(`
                *,
                profiles:user_id (
                    id,
                    email,
                    full_name,
                    cuit
                )
            `)
            .order("status", { ascending: true }) // pending first
            .order("payment_date", { ascending: false });

        if (error) {
            console.error("Error fetching invoices:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ invoices });
    } catch (error) {
        console.error("Admin invoices error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: Crear una factura manualmente (asignarla a un usuario)
export async function POST(req) {
    const auth = await verifyAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = auth;

    try {
        const body = await req.json();
        const { user_id, description, amount } = body;

        if (!user_id) {
            return NextResponse.json({ error: "user_id requerido" }, { status: 400 });
        }

        const { data: invoice, error } = await supabaseAdmin
            .from("invoices")
            .insert({
                user_id,
                status: 'pending',
                description: description || 'Suscripción Mensual - Judic-IA Suite Pro',
                amount: amount || 25000,
                payment_date: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error("Error creating invoice:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ invoice });
    } catch (error) {
        console.error("Create invoice error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: Actualizar factura (subir PDF y datos de ARCA)
export async function PATCH(req) {
    const auth = await verifyAdmin(req);
    if (auth.error) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin } = auth;

    try {
        const body = await req.json();
        const {
            invoice_id,
            file_url,
            // Campos de ARCA opcionales
            invoice_number,
            cae,
            cae_expiry,
            invoice_date,
            invoice_type,
            client_name,
            client_cuit
        } = body;

        if (!invoice_id) {
            return NextResponse.json({ error: "invoice_id requerido" }, { status: 400 });
        }

        const updates = {
            status: 'issued',
            issued_at: new Date().toISOString(),
            invoice_date: invoice_date || new Date().toISOString().split('T')[0]
        };

        // Añadir campos opcionales si están presentes
        if (file_url) updates.file_url = file_url;
        if (invoice_number) updates.invoice_number = invoice_number;
        if (cae) updates.cae = cae;
        if (cae_expiry) updates.cae_expiry = cae_expiry;
        if (invoice_type) updates.invoice_type = invoice_type;
        if (client_name) updates.client_name = client_name;
        if (client_cuit) updates.client_cuit = client_cuit;

        const { data: invoice, error } = await supabaseAdmin
            .from("invoices")
            .update(updates)
            .eq("id", invoice_id)
            .select()
            .single();

        if (error) {
            console.error("Error updating invoice:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`📄 Invoice ${invoice_id} marked as issued - CAE: ${cae || 'N/A'}`);
        return NextResponse.json({ invoice });
    } catch (error) {
        console.error("Update invoice error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
