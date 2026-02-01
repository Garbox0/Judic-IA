import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * 🛡️ Helper para propagación manual de cookies en redirecciones. 
 * Vital para evitar el bucle de login en Vercel/Producción.
 */
function applyCookies(srcResponse, destResponse) {
    const cookies = srcResponse.cookies.getAll()
    cookies.forEach((cookie) => {
        destResponse.cookies.set(cookie.name, cookie.value, cookie.options)
    })
    return destResponse
}

// 🌍 GEO-BLOCK CONFIGURATION
const BLOCKED_COUNTRY_RESPONSE = new NextResponse(JSON.stringify({
    error: 'Access Denied',
    message: 'We are sorry, but Judic-IA is not available in your country.',
    code: 'GEO_BLOCK'
}), { status: 403, headers: { 'Content-Type': 'application/json' } })

export async function middleware(request) {
    const { pathname } = request.nextUrl;

    // 🛡️ -1. GEO BLOCKING (High Priority)
    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry');

    // Webhooks que no deben bloquearse
    const isWebhook =
        pathname.startsWith('/api/mp/webhook') ||
        pathname.startsWith('/api/webhook/whatsapp');

    // IP real (Cloudflare primero) + parse del primer IP si viene lista
    const rawIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for') ||
        request.ip ||
        '';

    const ip = String(rawIp).split(',')[0].trim();

    // ✅ Rutas públicas que deben ser accesibles (auditorías/SEO)
    const isPublicScanPath =
        pathname === '/' ||
        pathname === '/robots.txt' ||
        pathname === '/sitemap.xml' ||
        pathname === '/favicon.ico' ||
        pathname.startsWith('/legal') ||
        pathname.startsWith('/privacy') ||
        pathname.startsWith('/terms') ||
        pathname.startsWith('/security');

    // (Opcional) Norton Safe Web / Symantec scanner por User-Agent
    const ua = request.headers.get('user-agent') || '';
    const isNortonScanner = /norton|safeweb|symantec/i.test(ua);

    // 🛡️ Norton whitelist por IP (si querés mantenerlo, pero ya no dependas solo de esto)
    const isWhitelistedIP = ip && (ip === '172.174.7.55' || ip.startsWith('172.174.'));

    if (country && country !== 'AR' && !isWebhook && !isWhitelistedIP && !isPublicScanPath && !isNortonScanner) {
        console.warn(`⛔ BLOCKED ACCESS from ${country} (IP: ${ip})`);
        return BLOCKED_COUNTRY_RESPONSE;
    }

    // 🛡️ 0. SEGURIDAD (CSP Relaxed for Debugging)
    const nonce = crypto.randomUUID()

    // CSP Relajada: permitimos unsafe-inline/eval para hidratación de Next.js y SDKs externos
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://sdk.mercadopago.com https://static.cloudflareinsights.com https://www.googletagmanager.com https://vercel.live https://*.vercel.live;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://vercel.live;
        img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://www.google-analytics.com https://www.googletagmanager.com https://vercel.live https://*.vercel.live https://vercel.com https://assets.vercel.com;
        font-src 'self' https://fonts.gstatic.com data: https://vercel.live;
        connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://events.mercadopago.com https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://vercel.live https://*.vercel.live https://vitals.vercel-insights.com https://cloudflareinsights.com https://static.cloudflareinsights.com;
        frame-src 'self' https://accounts.google.com https://*.mercadopago.com https://vercel.live https://*.vercel.live;
        object-src 'self';
        worker-src 'self' blob:;
        base-uri 'self';
        frame-ancestors 'self';
        upgrade-insecure-requests;
    `.replace(/\s{2,}/g, ' ').trim()

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)

    const hostname = request.headers.get('host') || ''

    // 🌐 SUBDOMAIN ROUTING
    const isClientSubdomain = hostname.startsWith('consultas.')
    const isMainDomain = hostname === 'judic-ia.com' || hostname === 'www.judic-ia.com' || hostname.includes('localhost')

    // 🛡️ 1. Sanitización
    if (pathname.includes('..') || pathname.includes('//')) {
        return new NextResponse(null, { status: 400 })
    }

    // 🚀 EARLY RETURN: Skip middleware for API routes (webhooks, etc.)
    // This prevents 307 redirects on webhook endpoints
    if (pathname.startsWith('/api/')) {
        return NextResponse.next({ request: { headers: requestHeaders } })
    }

    // 🔀 SUBDOMAIN REDIRECT LOGIC

    // A. Main domain accessing /consultas/* → Redirect to client subdomain
    if (isMainDomain && pathname.startsWith('/consultas')) {
        const clientUrl = new URL(pathname.replace('/consultas', ''), 'https://consultas.judic-ia.com')
        request.nextUrl.searchParams.forEach((value, key) => {
            clientUrl.searchParams.set(key, value)
        })
        console.log(`🔀 Redirecting to client subdomain: ${clientUrl.toString()}`)
        return NextResponse.redirect(clientUrl)
    }

    // B. Client subdomain: Rewrite /* to /consultas/* internally
    // EXCEPTION: /auth/callback must NOT be rewritten, as it resides in app/auth/callback, not app/consultas/auth/callback
    if (isClientSubdomain &&
        !pathname.startsWith('/consultas') &&
        !pathname.startsWith('/api') &&
        !pathname.startsWith('/_next') &&
        !pathname.startsWith('/auth/callback')
    ) {
        const rewriteUrl = request.nextUrl.clone()
        rewriteUrl.pathname = `/consultas${pathname}`
        console.log(`📝 Rewriting ${pathname} to ${rewriteUrl.pathname}`)
        return NextResponse.rewrite(rewriteUrl)
    }

    // C. Client subdomain trying to access lawyer routes → Block
    if (isClientSubdomain && (pathname.startsWith('/dashboard') || pathname === '/login' || pathname === '/register')) {
        return NextResponse.redirect(new URL('/auth', 'https://consultas.judic-ia.com'))
    }

    // Respuesta base
    let response = NextResponse.next({
        request: { headers: requestHeaders },
    })

    // 🔗 2. CONFIGURAR SUPABASE (Unificado para estabilidad)
    const AUTH_COOKIE = isClientSubdomain ? 'sb-judicia-client' : 'sb-judicia-auth';

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookieOptions: { name: AUTH_COOKIE },
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    // En Edge Middleware, solo seteamos en la respuesta
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // 👤 3. IDENTIFICAR USUARIO & ROL
    // IMPORTANTE: Esto mutará 'response' si hay refresco de token, gracias al setAll de arriba
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

    // DEBUG: Trace routing logic (disabled for prod)
    // console.log(`[Middleware] Path: ${pathname}, ClientZone: ${isClientZone}, Context: ${hasClientContext}, User: ${!!user}`);

    // A. Zona Cliente (Intake) - COMENTADO PARA EVITAR REDIRECTS AL HOME

    // B. Dashboard / Home / Login Loop Prevention
    if (isHomePath) {
        if (hasClientContext) {
            const consultasUrl = new URL('/consultas/auth', request.url)
            sp.forEach((value, key) => consultasUrl.searchParams.set(key, value))
            finalResponse = applyCookies(response, NextResponse.redirect(consultasUrl))
        } else if (user && role === 'lawyer') {
            const wantsPublicHome = sp.has('public') || sp.get('view') === 'public'
            if (!wantsPublicHome) {
                finalResponse = applyCookies(response, NextResponse.redirect(new URL('/dashboard', request.url)))
            }
        } else if (user && role === 'client') {
            finalResponse = applyCookies(response, NextResponse.redirect(new URL('/consultas/auth', request.url)))
        }
    }
    else if (isDashboardPath) {
        if (!user || !role) {
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
    // No aplicar CSP en rutas de API para evitar bloqueos innecesarios
    if (!pathname.startsWith('/api/')) {
        finalResponse.headers.set('Content-Security-Policy', cspHeader)
        finalResponse.headers.set('x-nonce', nonce)
    }

    return finalResponse
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
    ],
}
