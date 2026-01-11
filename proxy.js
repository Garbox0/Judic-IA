import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function proxy(request) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // REFRESH SESSION & GET USER
    const { data: { user } } = await supabase.auth.getUser()
    console.log(`[PROXY] Path: ${request.nextUrl.pathname} | User: ${user?.email}`)

    // 1. Must be logged in
    if (!user) {
        if (request.nextUrl.pathname.startsWith('/dashboard')) {
            console.log("Redirecting to Login (No User)")
            return NextResponse.redirect(new URL('/login', request.url))
        }
        return response
    }

    // [New] Fetch Role from Profiles (More secure than metadata)
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    const role = profile?.role || 'client' // Fallback to client if missing

    // 🛡️ SECURITY BARRIER: PROTECT DASHBOARD
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        // 2. Must NOT be a client
        if (role === 'client') {
            console.log("Redirecting Client Blocked")
            const loginUrl = new URL('/consultas/auth/login', request.url)
            loginUrl.searchParams.set('error', 'access_denied')
            loginUrl.searchParams.set('error_description', 'Acceso Restringido: Los clientes no pueden ver el panel de abogados.')
            return NextResponse.redirect(loginUrl)
        }
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
