const Minio = require('minio');
const fs = require('fs');
const path = require('path');

// VPS Configuration
const minioClient = new Minio.Client({
    endPoint: '147.93.9.185',
    port: 9000,
    useSSL: false,
    accessKey: 'admin',
    secretKey: 'Galadarc2026-'
});

const BUCKET_NAME = 'legislation';
const LOCAL_DIR = path.join(__dirname, '..', 'public', 'legislation');

async function ensureBucket() {
    try {
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (!exists) {
            console.log(`Creating bucket: ${BUCKET_NAME}`);
            await minioClient.makeBucket(BUCKET_NAME, '');
            // Set policy to public read
            const policy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: { AWS: ["*"] },
                        Action: ["s3:GetObject"],
                        Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
                    }
                ]
            };
            await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
            console.log('Bucket created and set to public.');
        } else {
            console.log(`Bucket ${BUCKET_NAME} already exists.`);
        }
    } catch (err) {
        console.error('Error ensuring bucket:', err);
    }
}

async function uploadDirectory(dirPath, remotePrefix = '') {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Recursively upload subdirectory
            const newPrefix = remotePrefix ? `${remotePrefix}/${item}` : item;
            await uploadDirectory(fullPath, newPrefix);
        } else if (stat.isFile() && item.endsWith('.pdf')) {
            const objectName = remotePrefix ? `${remotePrefix}/${item}` : item;
            console.log(`Uploading: ${objectName}...`);
            await minioClient.fPutObject(BUCKET_NAME, objectName, fullPath, {
                'Content-Type': 'application/pdf'
            });
            console.log(`✅ Uploaded ${objectName}`);
        }
    }
}

async function main() {
    console.log('Starting Migration to VPS MinIO...');
    await ensureBucket();
    await uploadDirectory(LOCAL_DIR);
    console.log('Migration Complete! 🚀');
}

main();
