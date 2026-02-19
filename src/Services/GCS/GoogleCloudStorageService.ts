import { Storage, Bucket } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';

export class GoogleCloudStorageService {
    private storage: Storage;
    private bucket: Bucket;
    private bucketName: string;

    /**
     * @param bucketName - The name of the GCS bucket
     * @param projectId - (Optional) If not set in your local gcloud config
     */
    constructor(bucketName: string, projectId?: string) {
        this.bucketName = bucketName;
        this.storage = new Storage({ projectId });

        this.bucket = this.storage.bucket(this.bucketName);
    }

    async uploadFile(localPath: string, destinationPath?: string): Promise<string> {
        if (!fs.existsSync(localPath)) {
            throw new Error(`File not found at ${localPath}`);
        }

        const fileName = path.basename(localPath);
        const destination = destinationPath || fileName;

        try {
            await this.bucket.upload(localPath, {
                destination: destination,
                gzip: true,
            });

            console.log(`✅ Uploaded: gs://${this.bucketName}/${destination}`);
            return destination;
        } catch (error) {
            console.error('❌ Upload failed:', error);
            throw error;
        }
    }

    async downloadFile(remoteFile: string, localDest: string): Promise<void> {
        try {
            await this.bucket.file(remoteFile).download({
                destination: localDest,
            });
            console.log(`✅ File downloaded to ${localDest}`);
        } catch (error) {
            console.error('❌ Error downloading file:', error);
            throw error;
        }
    }

    async deleteFile(remoteFile: string): Promise<void> {
        try {
            await this.bucket.file(remoteFile).delete();
            console.log(`🗑️ File deleted: ${remoteFile}`);
        } catch (error) {
            console.error('❌ Error deleting file:', error);
            throw error;
        }
    }

    async listFiles(prefix?: string): Promise<string[]> {
        try {
            const [files] = await this.bucket.getFiles({ prefix });
            return files.map(file => file.name);
        } catch (error) {
            console.error('❌ Error listing files:', error);
            throw error;
        }
    }

    async fileExists(remoteFile: string): Promise<boolean> {
        const [exists] = await this.bucket.file(remoteFile).exists();
        return exists;
    }
}