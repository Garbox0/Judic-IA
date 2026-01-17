import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
    // 🛡️ SECURITY: Request Sanitization (OWASP A03: Injection)
    const { pathname } = request.nextUrl
    if (pathname.includes('..') || pathname.includes('//')) {
        console.warn(`[SECURITY] Blocked suspicious path: ${pathname}`)
        return new NextResponse(null, { status: 400 })
    }

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // 🔍 1. DETERMINAR ZONA PERSONALIZADA
    const isClientZone = request.nextUrl.pathname.startsWith('/consultas')
    const isHomePath = request.nextUrl.pathname === '/'
    const isDashboardPath = request.nextUrl.pathname.startsWith('/dashboard')

    // 🚨 2. VERIFICAR CONTEXTO DE CLIENTE PRIORITARIO (Evitar Secuestro de Sesión)
    const sp = request.nextUrl.searchParams;
    const hasAuthParams = sp.has('code') || sp.has('token_hash') || sp.has('type') || sp.has('error');
    const hasClientParams = sp.has('lawyerId') || sp.has('lawyer') || sp.has('cid') || sp.has('view');
    const hasClientContext = hasAuthParams || hasClientParams;

    // Verificar si ya existe una sesión de cliente activa para el redireccionamiento prioritario
    const clientSupabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: { name: 'sb-client-token' },
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll() { /* Read only here */ }
            }
        }
    )
    const { data: { user: activeClient } } = await clientSupabase.auth.getUser()

    // 🔗 3. CONFIGURAR CLIENTE PRINCIPAL SEGÚN RUTA
    // Usamos tokens aislados: sb-client-token para clientes, sb-admin-token para abogados.
    const cookieName = isClientZone ? 'sb-client-token' : 'sb-admin-token'
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: { name: cookieName },
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request: { headers: request.headers } })
                    cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
                },
            },
        }
    )

    // REFRESH SESSION & GET USER
    const { data: { user } } = await supabase.auth.getUser()
    console.log(`[MIDDLEWARE] Path: ${request.nextUrl.pathname} | User: ${user?.email}`)

    // 🔒 4. PROTECCIÓN BÁSICA
    if (!user) {
        // Redirigir a login si intenta entrar al dashboard sin sesión
        if (isDashboardPath) return NextResponse.redirect(new URL('/login', request.url))

        // Si no hay sesión de admin, pero hay contexto o sesión de cliente, mandar a auth de consultas
        if (isHomePath && (hasClientContext || activeClient)) {
            const consultasUrl = new URL('/consultas/auth', request.url)
            sp.forEach((value, key) => consultasUrl.searchParams.set(key, value))
            return NextResponse.redirect(consultasUrl)
        }
        return response
    }

    // 👤 5. OBTENER ROL Y PERFIL (Solo si hay usuario detectado en la zona actual)
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role || 'client'

    // 🚩 6. DISPATCHER GLOBAL (Home & Protecciones de Rol)
    if (isHomePath) {
        // PRIORIDAD CLIENTE: Si hay contexto de cliente o sesión activa de cliente, ignorar al abogado.
        if (hasClientContext || activeClient) {
            const consultasUrl = new URL('/consultas/auth', request.url)
            sp.forEach((value, key) => consultasUrl.searchParams.set(key, value))
            return NextResponse.redirect(consultasUrl)
        }

        // Si es un "hit" limpio y es abogado, ir al dashboard
        if (role === 'lawyer') return NextResponse.redirect(new URL('/dashboard', request.url))
        if (role === 'client') return NextResponse.redirect(new URL('/consultas/auth', request.url))
    }

    // Bloquear el dashboard a quienes tengan rol cliente (seguridad extra)
    if (isDashboardPath && role === 'client') {
        const loginUrl = new URL('/consultas/auth/login', request.url)
        loginUrl.searchParams.set('error', 'access_denied')
        loginUrl.searchParams.set('error_description', 'Tu perfil es de cliente. Usa el acceso de consultas.')
        return NextResponse.redirect(loginUrl)
    }

    return response
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public files (svg, png, etc)
         * - api (API routes, webhooks)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
