import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client as MinioClient } from 'minio';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'text/plain': 'txt',
};
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'chat-attachments';
const CLAMAV_URL = `${process.env.CLAMAV_API_URL}/scan`;
const MINIO_PUBLIC_BASE = process.env.CLAMAV_API_URL; // mismo dominio: archivos.judic-ia.com

function getAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function getMinioClient() {
    return new MinioClient({
        endPoint: process.env.MINIO_ENDPOINT,
        port: parseInt(process.env.MINIO_PORT || '9000'),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY,
        secretKey: process.env.MINIO_SECRET_KEY,
    });
}

export async function POST(request) {
    const supabase = getAdminClient();

    // 1. Autenticación (Bearer o cookie)
    const auth = request.headers.get('Authorization');
    let userId = null;
    let role = 'user'; // 'user' = cliente, 'lawyer' = abogado

    if (auth?.startsWith('Bearer ')) {
        const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
        if (user) { userId = user.id; role = 'lawyer'; }
    }
    // Si no hay Bearer → es el cliente (inquiryId actúa como bearer token implícito)

    // 2. Parsear multipart
    let formData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: 'Formato inválido' }, { status: 400 });
    }

    const file = formData.get('file');
    const inquiryId = formData.get('inquiryId');
    const senderRole = formData.get('role') || role; // 'user' | 'lawyer'

    if (!file || !inquiryId) {
        return NextResponse.json({ error: 'Faltan parámetros: file e inquiryId' }, { status: 400 });
    }

    // 3. Validar tipo
    const mimeType = file.type;
    const ext = ALLOWED_TYPES[mimeType];
    if (!ext) {
        return NextResponse.json({
            error: 'Tipo de archivo no permitido. Permitidos: PDF, JPG, PNG, DOCX, DOC, TXT'
        }, { status: 422 });
    }

    // 4. Validar tamaño
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > MAX_SIZE_BYTES) {
        return NextResponse.json({ error: 'El archivo supera el límite de 10 MB' }, { status: 413 });
    }
    const buffer = Buffer.from(bytes);

    // 5. Verificar que la inquiry existe y el solicitante tiene acceso
    const { data: inquiry } = await supabase
        .from('inquiries')
        .select('assigned_lawyer_id, status')
        .eq('id', inquiryId)
        .maybeSingle();

    if (!inquiry) {
        return NextResponse.json({ error: 'Consulta no encontrada' }, { status: 404 });
    }

    // Si es abogado, verificar que le pertenece
    if (senderRole === 'lawyer' && userId && inquiry.assigned_lawyer_id !== userId) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    // 6. ClamAV scan
    try {
        const scanForm = new FormData();
        scanForm.append('file', new Blob([buffer], { type: mimeType }), file.name);

        const scanRes = await fetch(CLAMAV_URL, {
            method: 'POST',
            headers: { 'X-API-Key': process.env.CLAMAV_API_KEY },
            body: scanForm,
            signal: AbortSignal.timeout(30000),
        });

        if (!scanRes.ok) {
            console.error('[upload] ClamAV HTTP error:', scanRes.status);
            return NextResponse.json({ error: 'Error al analizar el archivo. Intentá de nuevo.' }, { status: 500 });
        }

        const scanResult = await scanRes.json();
        // ClamAV responde: { status: 'OK' | 'FOUND', ...}
        if (scanResult.status !== 'OK') {
            console.warn('[upload] Archivo infectado detectado:', scanResult);
            return NextResponse.json({
                error: 'El archivo fue bloqueado por razones de seguridad.'
            }, { status: 422 });
        }
    } catch (err) {
        console.error('[upload] ClamAV error:', err);
        return NextResponse.json({ error: 'No se pudo verificar la seguridad del archivo.' }, { status: 500 });
    }

    // 7. Subir a MinIO
    const objectName = `${inquiryId}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    try {
        const minio = getMinioClient();
        await minio.putObject(BUCKET, objectName, buffer, buffer.length, {
            'Content-Type': mimeType,
        });
    } catch (err) {
        console.error('[upload] MinIO error:', err);
        return NextResponse.json({ error: 'Error al guardar el archivo.' }, { status: 500 });
    }

    const publicUrl = `${MINIO_PUBLIC_BASE}/${BUCKET}/${objectName}`;

    // 8. Insertar mensaje con adjunto
    const { data: msg, error: msgError } = await supabase
        .from('messages')
        .insert({
            inquiry_id: inquiryId,
            role: senderRole,
            content: `📎 ${file.name}`,
            attachment_url: publicUrl,
            attachment_name: file.name,
        })
        .select()
        .single();

    if (msgError) {
        console.error('[upload] message insert error:', msgError);
        return NextResponse.json({ error: 'Archivo subido pero error al guardar el mensaje.' }, { status: 500 });
    }

    // 9. Actualizar last_message en inquiry
    await supabase
        .from('inquiries')
        .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: `📎 ${file.name}`,
        })
        .eq('id', inquiryId);

    return NextResponse.json({ success: true, message: msg, url: publicUrl });
}
