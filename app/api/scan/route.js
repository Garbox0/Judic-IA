import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/api-auth';
import { scanFile } from '@/lib/clamav';

export async function POST(request) {
    // 🛡️ Auth required
    const auth = await verifyAuth(request);
    if (auth.error) return auth.response;

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof Blob)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 25MB limit
        if (file.size > 25 * 1024 * 1024) {
            return NextResponse.json({ error: 'File too large (max 25MB)' }, { status: 413 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const result = await scanFile(buffer, file.name || 'upload');

        return NextResponse.json(result);
    } catch (error) {
        console.error('Scan error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
