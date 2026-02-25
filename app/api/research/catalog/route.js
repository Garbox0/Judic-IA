import { NextResponse } from 'next/server';
import { load } from 'cheerio';

// ─── In-memory cache ───────────────────────────────────────────────
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Fallback hardcoded catalog — Tribunales reales PBA ─────────────
// Fuente: estructura judicial de la Provincia de Buenos Aires (SCBA)
const FALLBACK_CATALOG = {
    camaras: [
        // Suprema Corte
        'Suprema Corte de Justicia (SCBA)',
        // Civil y Comercial — por departamento judicial
        'Camara de Apelacion Civil y Comercial — Azul',
        'Camara de Apelacion Civil y Comercial — Bahia Blanca',
        'Camara de Apelacion Civil y Comercial — Dolores',
        'Camara de Apelacion Civil y Comercial — Junin',
        'Camara de Apelacion Civil y Comercial — La Matanza',
        'Camara de Apelacion Civil y Comercial — La Plata',
        'Camara de Apelacion Civil y Comercial — Lomas de Zamora',
        'Camara de Apelacion Civil y Comercial — Mar del Plata',
        'Camara de Apelacion Civil y Comercial — Mercedes',
        'Camara de Apelacion Civil y Comercial — Meron',
        'Camara de Apelacion Civil y Comercial — Morón',
        'Camara de Apelacion Civil y Comercial — Necochea',
        'Camara de Apelacion Civil y Comercial — Pergamino',
        'Camara de Apelacion Civil y Comercial — Quilmes',
        'Camara de Apelacion Civil y Comercial — San Isidro',
        'Camara de Apelacion Civil y Comercial — San Martin',
        'Camara de Apelacion Civil y Comercial — San Nicolas',
        'Camara de Apelacion Civil y Comercial — Trenque Lauquen',
        'Camara de Apelacion Civil y Comercial — Zarate Campana',
        // Laboral — Sala / departamento
        'Tribunal del Trabajo — Azul',
        'Tribunal del Trabajo — Bahia Blanca',
        'Tribunal del Trabajo — Junin',
        'Tribunal del Trabajo — La Matanza',
        'Tribunal del Trabajo — La Plata',
        'Tribunal del Trabajo — Lomas de Zamora',
        'Tribunal del Trabajo — Mar del Plata',
        'Tribunal del Trabajo — Mercedes',
        'Tribunal del Trabajo — Meron',
        'Tribunal del Trabajo — Necochea',
        'Tribunal del Trabajo — Pergamino',
        'Tribunal del Trabajo — Quilmes',
        'Tribunal del Trabajo — San Isidro',
        'Tribunal del Trabajo — San Martin',
        'Tribunal del Trabajo — San Nicolas',
        'Tribunal del Trabajo — Trenque Lauquen',
        // Contencioso Administrativo
        'Camara de Apelacion Contencioso Administrativo — La Plata',
        'Camara de Apelacion Contencioso Administrativo — Mar del Plata',
        'Camara de Apelacion Contencioso Administrativo — San Martin',
        'Camara de Apelacion Contencioso Administrativo — Bahia Blanca',
        // Familia
        'Tribunal Colegiado de Familia — La Plata',
        'Tribunal Colegiado de Familia — Mar del Plata',
        'Tribunal Colegiado de Familia — Bahia Blanca',
        'Tribunal Colegiado de Familia — San Isidro',
        'Tribunal Colegiado de Familia — San Martin',
        'Tribunal Colegiado de Familia — Lomas de Zamora',
        'Tribunal Colegiado de Familia — Quilmes',
        'Tribunal Colegiado de Familia — Morón',
        // Penal / Garantias
        'Tribunal en lo Criminal — Azul',
        'Tribunal en lo Criminal — Bahia Blanca',
        'Tribunal en lo Criminal — La Plata',
        'Tribunal en lo Criminal — Lomas de Zamora',
        'Tribunal en lo Criminal — Mar del Plata',
        'Tribunal en lo Criminal — Meron',
        'Tribunal en lo Criminal — San Isidro',
        'Tribunal en lo Criminal — San Martin',
        'Camara de Apelacion y Garantias en lo Penal — Azul',
        'Camara de Apelacion y Garantias en lo Penal — Bahia Blanca',
        'Camara de Apelacion y Garantias en lo Penal — Dolores',
        'Camara de Apelacion y Garantias en lo Penal — Junin',
        'Camara de Apelacion y Garantias en lo Penal — La Matanza',
        'Camara de Apelacion y Garantias en lo Penal — La Plata',
        'Camara de Apelacion y Garantias en lo Penal — Lomas de Zamora',
        'Camara de Apelacion y Garantias en lo Penal — Mar del Plata',
        'Camara de Apelacion y Garantias en lo Penal — Mercedes',
        'Camara de Apelacion y Garantias en lo Penal — Meron',
        'Camara de Apelacion y Garantias en lo Penal — Necochea',
        'Camara de Apelacion y Garantias en lo Penal — Pergamino',
        'Camara de Apelacion y Garantias en lo Penal — Quilmes',
        'Camara de Apelacion y Garantias en lo Penal — San Isidro',
        'Camara de Apelacion y Garantias en lo Penal — San Martin',
        'Camara de Apelacion y Garantias en lo Penal — San Nicolas',
        'Camara de Apelacion y Garantias en lo Penal — Trenque Lauquen',
        'Camara de Apelacion y Garantias en lo Penal — Zarate Campana',
        // Previsional / Seguridad Social
        'Juzgado en lo Contencioso Administrativo (Previsional) — La Plata',
    ],
    departamentos: [
        'Azul', 'Bahia Blanca', 'Dolores', 'Junin',
        'La Matanza', 'La Plata', 'Lomas de Zamora', 'Mar del Plata',
        'Mercedes', 'Meron', 'Morón', 'Necochea', 'Pergamino',
        'Quilmes', 'San Isidro', 'San Martin', 'San Nicolas',
        'Trenque Lauquen', 'Zarate Campana'
    ]
};

// ─── Runtime scraper attempt (SCBA old portal) ───────────────────────
async function scrapeScbaCatalog() {
    try {
        const res = await fetch(
            'https://www-2020.scba.gov.ar/jurisprudencia/default2.asp?busca=Fallos+Completos',
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    Accept: 'text/html,application/xhtml+xml'
                },
                signal: AbortSignal.timeout(10000),
                cache: 'no-store'
            }
        );
        if (!res.ok) return null;

        const html = await res.text();
        const $ = load(html);

        // Look for any <select> that contains tribunal/organismo options
        const options = [];
        $('select option').each((_, el) => {
            const val = $(el).attr('value')?.trim();
            const text = $(el).text().trim();
            if (val && val !== '' && text && text.toLowerCase() !== 'seleccionar' && text.toLowerCase() !== 'todas') {
                options.push(text);
            }
        });

        return options.length > 5 ? options : null;
    } catch {
        return null;
    }
}

// ─── GET handler ─────────────────────────────────────────────────────
export async function GET() {
    const now = Date.now();

    // Return cached data if still fresh
    if (cache && (now - cacheTimestamp) < CACHE_TTL_MS) {
        return NextResponse.json(cache, {
            headers: { 'Cache-Control': 'public, max-age=3600' }
        });
    }

    // Try to scrape live catalog
    const scraped = await scrapeScbaCatalog();

    const result = {
        camaras: scraped ?? FALLBACK_CATALOG.camaras,
        departamentos: FALLBACK_CATALOG.departamentos,
        source: scraped ? 'scba_live' : 'fallback',
        updatedAt: new Date().toISOString()
    };

    // Store in cache
    cache = result;
    cacheTimestamp = now;

    return NextResponse.json(result, {
        headers: { 'Cache-Control': 'public, max-age=3600' }
    });
}
