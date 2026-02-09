import { NextResponse } from 'next/server';

// WhatsApp Verify Webhook (GET)
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'judicia_secret';
    if (mode === 'subscribe' && token === verifyToken) {
        return new NextResponse(challenge);
    }
    return new NextResponse('Error', { status: 403 });
}

// WhatsApp Message Handler (POST)
export async function POST(request) {
    try {
        const body = await request.json();
        console.log("WhatsApp Webhook Received:", JSON.stringify(body, null, 2));

        // Here we would process the message and call the AI logic

        return NextResponse.json({ status: 'ok' });
    } catch (e) {
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
