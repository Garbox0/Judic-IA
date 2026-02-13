#!/usr/bin/env node
/**
 * 🔍 Judic-IA — Knowledge Base Audit Script
 * 
 * Runs on the VPS to audit the knowledge-base MinIO bucket:
 *   1. Lists all objects in the bucket
 *   2. Validates that each file is a real PDF (checks magic bytes)
 *   3. Detects duplicates (by content hash)
 *   4. Cross-references with Supabase case_library for orphans & mismatches
 *   5. Reports results to Supabase kb_audit_reports table
 *   6. Automatically removes ONLY duplicates (keeps one copy)
 *   7. Never deletes invalid PDFs — only reports them
 * 
 * Usage:
 *   node kb-audit.js                    # Full audit: report + remove dupes
 *   node kb-audit.js --dry-run          # Audit only, don't delete anything
 * 
 * Env vars (same as capture-service):
 *   MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY
 */

const Minio = require('minio');
const crypto = require('crypto');

// ═══════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════
const BUCKET_NAME = 'knowledge-base';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://archivos.judic-ia.com';
const DRY_RUN = process.argv.includes('--dry-run');

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || '127.0.0.1',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
});

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

async function isPdfValid(objectName) {
    try {
        const stream = await minioClient.getPartialObject(BUCKET_NAME, objectName, 0, 16);
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const header = Buffer.concat(chunks);
        return header.subarray(0, 4).equals(PDF_MAGIC);
    } catch {
        return false;
    }
}

async function getObjectMd5(objectName) {
    try {
        const stream = await minioClient.getObject(BUCKET_NAME, objectName);
        const hash = crypto.createHash('md5');
        for await (const chunk of stream) hash.update(chunk);
        return hash.digest('hex');
    } catch {
        return null;
    }
}

async function supabaseRequest(path, options = {}) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const res = await fetch(url, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': options.prefer || 'return=representation',
        },
        method: options.method || 'GET',
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) {
        console.error(`  ❌ Supabase error (${res.status}):`, await res.text());
        return null;
    }
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
}

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ═══════════════════════════════════════════
// MAIN AUDIT
// ═══════════════════════════════════════════
async function runAudit() {
    console.log('\n🔍 ══════════════════════════════════════════');
    console.log('   JUDIC-IA — Knowledge Base Audit');
    console.log('══════════════════════════════════════════════');
    console.log(`   Mode: ${DRY_RUN ? '👁️  DRY-RUN (no changes)' : '🔧 AUTO (removes dupes only, reports errors)'}`);
    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log('══════════════════════════════════════════════\n');

    // 1. List all objects
    console.log('📦 Step 1: Listing objects...');
    const objects = [];
    try {
        const stream = minioClient.listObjectsV2(BUCKET_NAME, '', true);
        for await (const obj of stream) objects.push(obj);
    } catch (err) {
        console.error('❌ Could not list bucket:', err.message);
        return { error: err.message };
    }
    console.log(`   Found ${objects.length} objects\n`);

    if (objects.length === 0) {
        const report = { total_objects: 0, valid_pdfs: 0, invalid_files: 0, duplicate_groups: 0, db_rows: 0, orphan_db_rows: 0, orphan_files: 0, details: { invalid: [], duplicates: [], orphan_db: [], orphan_files: [] }, fixed: false };
        await saveReport(report);
        return report;
    }

    // 2. Validate PDFs
    console.log('🔬 Step 2: Validating PDFs...');
    const valid = [];
    const invalid = [];
    const sizeMap = {};

    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const isValid = await isPdfValid(obj.name);
        const size = obj.size || 0;

        if (isValid && size > 500) {
            valid.push({ name: obj.name, size, lastModified: obj.lastModified });
            const sizeKey = String(size);
            if (!sizeMap[sizeKey]) sizeMap[sizeKey] = [];
            sizeMap[sizeKey].push(obj.name);
        } else {
            const reason = !isValid ? 'Invalid PDF header' : `Too small (${size}B)`;
            invalid.push({ name: obj.name, size, reason });
            console.log(`   ❌ ${obj.name} — ${reason}`);
        }
    }
    console.log(`   ✅ Valid: ${valid.length} | ❌ Invalid: ${invalid.length}\n`);

    // 3. Find & remove duplicates
    console.log('🔄 Step 3: Checking duplicates...');
    const potentialDupes = Object.entries(sizeMap).filter(([, names]) => names.length > 1);
    const confirmedDupes = [];
    let dupesRemoved = 0;

    for (const [size, names] of potentialDupes) {
        const hashes = {};
        for (const name of names) {
            const md5 = await getObjectMd5(name);
            if (md5) {
                if (!hashes[md5]) hashes[md5] = [];
                hashes[md5].push(name);
            }
        }
        for (const [hash, dupeNames] of Object.entries(hashes)) {
            if (dupeNames.length > 1) {
                const [keep, ...remove] = dupeNames;
                confirmedDupes.push({ hash, keep, duplicates: remove });
                console.log(`   🔴 Duplicate group (${formatSize(parseInt(size))}):  KEEP ${keep}`);

                if (!DRY_RUN) {
                    for (const name of remove) {
                        try {
                            await minioClient.removeObject(BUCKET_NAME, name);
                            console.log(`   🗑️  Removed: ${name}`);
                            dupesRemoved++;
                        } catch (err) {
                            console.error(`   ❌ Failed to remove ${name}:`, err.message);
                        }
                    }
                } else {
                    remove.forEach(n => console.log(`   (would remove: ${n})`));
                }
            }
        }
    }
    if (confirmedDupes.length === 0) console.log('   ✅ No duplicates');
    else console.log(`   Removed ${dupesRemoved} duplicate files\n`);

    // 4. Cross-reference with DB
    console.log('🗄️  Step 4: Cross-referencing with database...');
    let dbRows = [];
    let orphanDbRows = [];
    let orphanFiles = [];
    let missingPdfUrl = [];

    if (SUPABASE_URL && SUPABASE_KEY) {
        dbRows = await supabaseRequest('case_library?select=id,url,autos,pdf_url') || [];
        console.log(`   DB has ${dbRows.length} rows`);

        const minioFileUrls = new Set(valid.map(v => `${PUBLIC_BASE_URL}/${BUCKET_NAME}/${v.name}`));
        orphanDbRows = dbRows.filter(r => r.pdf_url && !minioFileUrls.has(r.pdf_url));
        missingPdfUrl = dbRows.filter(r => !r.pdf_url);
        const dbPdfUrls = new Set(dbRows.map(r => r.pdf_url).filter(Boolean));
        orphanFiles = valid.filter(v => !dbPdfUrls.has(`${PUBLIC_BASE_URL}/${BUCKET_NAME}/${v.name}`));

        console.log(`   • Broken pdf_url in DB: ${orphanDbRows.length}`);
        console.log(`   • Missing pdf_url: ${missingPdfUrl.length}`);
        console.log(`   • MinIO files not in DB: ${orphanFiles.length}`);
    } else {
        console.log('   ⚠️ No Supabase credentials — skipping DB check');
    }

    // 5. Save report
    const report = {
        total_objects: objects.length,
        valid_pdfs: valid.length,
        invalid_files: invalid.length,
        duplicate_groups: confirmedDupes.length,
        db_rows: dbRows.length,
        orphan_db_rows: orphanDbRows.length,
        orphan_files: orphanFiles.length,
        details: {
            invalid: invalid.map(i => ({ name: i.name, size: i.size, reason: i.reason })),
            duplicates: confirmedDupes.map(d => ({ hash: d.hash, kept: d.keep, removed: d.duplicates })),
            orphan_db: orphanDbRows.map(r => ({ id: r.id, autos: r.autos, pdf_url: r.pdf_url })),
            orphan_files: orphanFiles.map(f => ({ name: f.name, size: f.size })),
        },
        fixed: !DRY_RUN && dupesRemoved > 0,
    };

    await saveReport(report);

    // Summary
    const totalSize = valid.reduce((sum, v) => sum + v.size, 0);
    console.log('\n══════════════════════════════════════════════');
    console.log('📊 AUDIT SUMMARY');
    console.log('══════════════════════════════════════════════');
    console.log(`   Total objects:      ${objects.length}`);
    console.log(`   Valid PDFs:         ${valid.length} (${formatSize(totalSize)})`);
    console.log(`   Invalid (reported): ${invalid.length}`);
    console.log(`   Dupes removed:      ${dupesRemoved}`);
    console.log(`   DB rows:            ${dbRows.length}`);
    console.log('══════════════════════════════════════════════\n');

    return report;
}

async function saveReport(report) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log('   ⚠️ No Supabase credentials — report not saved to DB');
        return;
    }
    console.log('\n💾 Saving report to kb_audit_reports...');
    await supabaseRequest('kb_audit_reports', {
        method: 'POST',
        body: report,
        prefer: 'return=minimal',
    });
    console.log('   ✅ Report saved');
}

// ═══════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════
// If called directly
if (require.main === module) {
    runAudit().catch(err => {
        console.error('\n💥 Audit failed:', err);
        process.exit(1);
    });
}

// Export for use in capture-service /audit endpoint
module.exports = { runAudit };
