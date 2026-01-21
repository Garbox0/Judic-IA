import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
    // 🛡️ 0. CONFIGURACIÓN DE SEGURIDAD (CSP A+)
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' https://apis.google.com https://accounts.google.com https://sdk.mercadopago.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com;
        font-src 'self' https://fonts.gstatic.com data:;
        connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://events.mercadopago.com;
        frame-src 'self' https://accounts.google.com https://*.mercadopago.com;
        object-src 'none';
        base-uri 'self';
        frame-ancestors 'none';
        upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim()

    // Preparar headers de petición con el nonce
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)

    // 🛡️ 1. SEGURIDAD BÁSICA (Sanitización)
    const { pathname } = request.nextUrl
    if (pathname.includes('..') || pathname.includes('//')) {
        return new NextResponse(null, { status: 400 })
    }

    // Inicializar respuesta base
    let response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    // 🔍 2. IDENTIFICAR ENTORNO
    const isClientZone = pathname.startsWith('/consultas')
    const isDashboardPath = pathname.startsWith('/dashboard')
    const isHomePath = pathname === '/'

    const sp = request.nextUrl.searchParams
    const hasClientContext = sp.has('lawyerId') || sp.has('lawyer') || sp.has('cid') ||
        sp.has('code') || sp.has('token_hash')

    // 🔗 3. CONFIGURAR SUPABASE (Aislamiento de Cookies)
    const cookieName = isClientZone ? 'sb-client-token' : 'sb-admin-token'
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: { name: cookieName },
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    // Actualizar cookies en el request para que los siguientes pasos las vean
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    // IMPORTANTE: Regenerar response pero preservando los headers de request que tienen el nonce
                    response = NextResponse.next({
                        request: { headers: requestHeaders },
                    })
                    // Setear cookies en la nueva respuesta
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // 👤 4. OBTENER USUARIO Y ROL (Solo si es necesario para el ruteo)
    const { data: { user } } = await supabase.auth.getUser()
    let role = null
    if (user && (isDashboardPath || isHomePath || isClientZone)) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        role = profile?.role
    }

    // 🏁 5. LÓGICA DE REDIRECCIÓN Y RESPUESTA FINAL
    let finalResponse = response

    // A. Protección de Zona Cliente
    if (isClientZone && pathname.includes('/auth') && !hasClientContext && !user) {
        finalResponse = NextResponse.redirect(new URL('/', request.url))
    }
    // B. Dashboard / Home Redirects
    else if (isHomePath) {
        if (hasClientContext) {
            const consultasUrl = new URL('/consultas/auth', request.url)
            sp.forEach((value, key) => consultasUrl.searchParams.set(key, value))
            finalResponse = NextResponse.redirect(consultasUrl)
        } else if (user && role === 'lawyer') {
            finalResponse = NextResponse.redirect(new URL('/dashboard', request.url))
        } else if (user && role === 'client') {
            finalResponse = NextResponse.redirect(new URL('/consultas/auth', request.url))
        }
    }
    else if (isDashboardPath) {
        if (!user) {
            finalResponse = NextResponse.redirect(new URL('/login', request.url))
        } else if (role === 'client') {
            const loginUrl = new URL('/consultas/auth/login', request.url)
            loginUrl.searchParams.set('error', 'access_denied')
            finalResponse = NextResponse.redirect(loginUrl)
        }
    }
    // C. Protección de APIs
    else if (pathname.startsWith('/api/') &&
        !pathname.includes('/api/auth') &&
        !pathname.includes('/api/mp/webhook') &&
        !pathname.includes('/api/webhook/whatsapp') &&
        !pathname.includes('/api/demo') &&
        !pathname.includes('/api/chat') &&
        !pathname.includes('/api/intake')
    ) {
        if (!user) {
            finalResponse = NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
        }
    }

    // 🛡️ APLICAR CABECERAS DE SEGURIDAD AL FINAL (A+ Score Garantizado)
    finalResponse.headers.set('Content-Security-Policy', cspHeader)
    finalResponse.headers.set('x-nonce', nonce)

    return finalResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
