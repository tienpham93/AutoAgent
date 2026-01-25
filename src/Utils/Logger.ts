import * as fs from 'fs';
import * as path from 'path';

export class Logzer {

    public static logFilePath = path.join(__dirname, '../execution.log');
    public static logStream = fs.createWriteStream(this.logFilePath, { flags: 'w' }); // 'w' to overwrite each session
    
    static streamLog(message: string): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${message}\n`;
        process.stdout.write(formattedMessage);
        this.logStream.write(formattedMessage);
    }
}