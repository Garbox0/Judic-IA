import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * 🛡️ Helper para propagación manual de cookies en redirecciones. 
 * Vital para evitar el bucle de login en Vercel/Producción.
 */
function applyCookies(srcResponse, destResponse) {
    srcResponse.cookies.getAll().forEach((cookie) => {
        destResponse.cookies.set(cookie.name, cookie.value, cookie.options)
    })
    return destResponse
}

export async function middleware(request) {
    // 🛡️ 0. SEGURIDAD (CSP A+)
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

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)

    const { pathname } = request.nextUrl

    // 🛡️ 1. Sanitización
    if (pathname.includes('..') || pathname.includes('//')) {
        return new NextResponse(null, { status: 400 })
    }

    // Respuesta base
    let response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    // 🔗 2. CONFIGURAR SUPABASE (Unificado para estabilidad)
    // El nombre de la cookie DEBE coincidir con lib/supabase.js
    const AUTH_COOKIE = 'sb-judicia-auth'

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: { name: AUTH_COOKIE },
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
                    response = NextResponse.next({ request: { headers: requestHeaders } })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // 👤 3. IDENTIFICAR USUARIO & ROL
    const { data: { user } } = await supabase.auth.getUser()

    let role = null
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        role = profile?.role
    }

    // 🔍 Contextos de ruteo
    const isClientZone = pathname.startsWith('/consultas')
    const isDashboardPath = pathname.startsWith('/dashboard')
    const isHomePath = pathname === '/'
    const sp = request.nextUrl.searchParams
    const hasClientContext = sp.has('lawyerId') || sp.has('lawyer') || sp.has('cid') || sp.has('code') || sp.has('token_hash')

    // 🏁 4. DISPATCHER DE REDIRECCIONES
    let finalResponse = response

    // A. Zona Cliente (Intake)
    if (isClientZone && pathname.includes('/auth') && !hasClientContext && !user) {
        finalResponse = applyCookies(response, NextResponse.redirect(new URL('/', request.url)))
    }
    // B. Dashboard / Home / Login Loop Prevention
    else if (isHomePath) {
        if (hasClientContext) {
            const consultasUrl = new URL('/consultas/auth', request.url)
            sp.forEach((value, key) => consultasUrl.searchParams.set(key, value))
            finalResponse = applyCookies(response, NextResponse.redirect(consultasUrl))
        } else if (user && role === 'lawyer') {
            finalResponse = applyCookies(response, NextResponse.redirect(new URL('/dashboard', request.url)))
        } else if (user && role === 'client') {
            finalResponse = applyCookies(response, NextResponse.redirect(new URL('/consultas/auth', request.url)))
        }
    }
    else if (isDashboardPath) {
        if (!user) {
            finalResponse = applyCookies(response, NextResponse.redirect(new URL('/login', request.url)))
        } else if (role === 'client') {
            const loginUrl = new URL('/consultas/auth/login', request.url)
            loginUrl.searchParams.set('error', 'access_denied')
            finalResponse = applyCookies(response, NextResponse.redirect(loginUrl))
        }
    }
    // C. APIs Privadas
    else if (pathname.startsWith('/api/') &&
        !pathname.includes('/api/auth') &&
        !pathname.includes('/api/mp/webhook') &&
        !pathname.includes('/api/webhook/whatsapp') &&
        !pathname.includes('/api/demo') &&
        !pathname.includes('/api/chat') &&
        !pathname.includes('/api/intake')
    ) {
        if (!user) {
            finalResponse = applyCookies(response, NextResponse.json({ error: 'Unauthenticated' }, { status: 401 }))
        }
    }

    // 🛡️ 5. APLICACIÓN FINAL DE CABECERAS
    finalResponse.headers.set('Content-Security-Policy', cspHeader)
    finalResponse.headers.set('x-nonce', nonce)

    return finalResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
