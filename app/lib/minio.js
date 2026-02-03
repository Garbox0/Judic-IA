
import * as Minio from 'minio';

const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY
});

// Check for missing critical configuration
if (!process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
    console.warn("⚠️ MinIO credentials missing in environment variables. Functionality may be limited.");
}

export const BUCKET_NAME = 'knowledge-base';

export async function ensureBucket(bucketName = BUCKET_NAME) {
    try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            console.log(`Creating bucket: ${bucketName}`);
            await minioClient.makeBucket(bucketName, '');
            // Set policy to public read
            const policy = {
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: { AWS: ["*"] },
                        Action: ["s3:GetObject"],
                        Resource: [`arn:aws:s3:::${bucketName}/*`]
                    }
                ]
            };
            await minioClient.setBucketPolicy(bucketName, JSON.stringify(policy));
        }
    } catch (err) {
        // Suppress errors if credentials aren't set (dev mode without MinIO)
        if (process.env.MINIO_ACCESS_KEY) {
            console.error('Error ensuring bucket:', err);
        }
    }
}

export default minioClient;
