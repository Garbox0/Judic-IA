import { NextResponse } from 'next/server';
import { searchByExpediente } from '../../../lib/captchaSolver';

export async function GET(request) {
    try {
        console.log("Iniciando test de extracción profunda CSJ 1/2023");
        const result = await searchByExpediente({
            jurisdiccion: '0', // CSJ
            jurisdictionName: 'CSJN',
            numero: '1',
            anio: '2023'
        });

        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
