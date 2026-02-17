import * as fs from 'fs';
import * as path from 'path';

export class FileHelper {
    static readFile(filePath: string): string {
        return fs.readFileSync(path.join(filePath), 'utf-8');
    }

    static readAsBase64(filePath: string): string {
        const fileBuffer = fs.readFileSync(filePath);
        return fileBuffer.toString('base64');
    }

    static readDirectory(dirPath: string): string[] {   
        return fs.readdirSync(dirPath);
    }

    static writeFile(filePath: string, fileName: string, content: any): void {
        if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath, { recursive: true });
        }
        const reportPath = path.join(filePath, fileName);
        fs.writeFileSync(reportPath, JSON.stringify(content, null, 2));
    }

    static getTimestamp(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        return timestamp;
    }

    static retrieveNjkTemplate(filePath: string): string {
        return this.readFile(filePath);
    }

    static isFilePath(input: string): boolean {
        return fs.existsSync(input) && fs.lstatSync(input).isFile();
    }

    static createDirectory(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
}