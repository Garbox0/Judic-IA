import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
    // 🛡️ 1. SEGURIDAD BÁSICA (Sanitización)
    const { pathname } = request.nextUrl
    if (pathname.includes('..') || pathname.includes('//')) {
        return new NextResponse(null, { status: 400 })
    }

    let response = NextResponse.next({
        request: { headers: request.headers },
    })

    // 🔍 2. IDENTIFICAR ENTORNO
    const isClientZone = pathname.startsWith('/consultas')
    const isDashboardPath = pathname.startsWith('/dashboard')
    const isHomePath = pathname === '/'

    const sp = request.nextUrl.searchParams
    const hasClientContext = sp.has('lawyerId') || sp.has('lawyer') || sp.has('cid') ||
        sp.has('code') || sp.has('token_hash')

    // 🔗 3. SELECCIONAR CORREDOR DE SESIÓN (Aislamiento de Cookies)
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

    // 👤 4. OBTENER USUARIO Y ROL
    const { data: { user } } = await supabase.auth.getUser()
    let role = null
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        role = profile?.role
    }

    // 🛡️ 5. PROTECCIÓN DE ZONA DE CLIENTES (No entrar sin invitación o sesión)
    if (isClientZone && pathname.includes('/auth') && !hasClientContext && !user) {
        console.warn(`[SECURITY] Desvío por falta de contexto en zona cliente: ${pathname}`)
        return NextResponse.redirect(new URL('/', request.url))
    }

    // 🚩 6. LÓGICA DE REDIRECCIÓN (DISPATCHER)

    // A. Si estamos en el HOME
    if (isHomePath) {
        // Prioridad 1: Link de cliente compartido (Contexto explícito)
        if (hasClientContext) {
            const consultasUrl = new URL('/consultas/auth', request.url)
            sp.forEach((value, key) => consultasUrl.searchParams.set(key, value))
            return NextResponse.redirect(consultasUrl)
        }

        // Prioridad 2: Si es Abogado logueado, al Dashboard
        if (user && role === 'lawyer') {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }

        // Prioridad 3: Si es Cliente logueado, a Consultas
        if (user && role === 'client') {
            return NextResponse.redirect(new URL('/consultas/auth', request.url))
        }

        // Si no hay nada, dejarlo en la landing
        return response
    }

    // B. Si estamos en el DASHBOARD
    if (isDashboardPath) {
        if (!user) return NextResponse.redirect(new URL('/login', request.url))

        // Bloquear si el rol es de cliente (seguridad cruzada)
        if (role === 'client') {
            const loginUrl = new URL('/consultas/auth/login', request.url)
            loginUrl.searchParams.set('error', 'access_denied')
            return NextResponse.redirect(loginUrl)
        }
    }

    // C. 🛡️ PROTECCIÓN DE APIs (Evitar acceso anónimo en rutas privadas)
    if (pathname.startsWith('/api/') &&
        !pathname.includes('/api/auth') &&
        !pathname.includes('/api/mp/webhook') &&
        !pathname.includes('/api/webhook/whatsapp') &&
        !pathname.includes('/api/demo') &&
        !pathname.includes('/api/chat') &&
        !pathname.includes('/api/intake')
    ) {
        if (!user) {
            return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
