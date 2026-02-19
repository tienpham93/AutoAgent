import * as fs from 'fs';
import * as path from 'path';

export class TerminalLogger {
    private static logFileStream: fs.WriteStream;
    private static originalStdoutWrite: any;
    private static originalStderrWrite: any;

    /**
     * Call this ONCE at the very top of your main execution file.
     */
    public static initialize(fileName: string, sessionId?: string) {
        const sessionSuffix = sessionId ? `_${sessionId}` : '';
        const logPath = path.join(`${fileName}${sessionSuffix}.log`);
        
        this.logFileStream = fs.createWriteStream(logPath, { flags: 'a' });
        
        console.log(`[📁] >> Full terminal output will be saved to: ${logPath}`);

        // Save original write functions
        this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
        this.originalStderrWrite = process.stderr.write.bind(process.stderr);

        process.stdout.write = (chunk: any, encoding?: any, callback?: any): boolean => {
            TerminalLogger.writeToFile(chunk);
            return TerminalLogger.originalStdoutWrite(chunk, encoding, callback);
        };

        // Override stderr (console.error, process.stderr.write)
        process.stderr.write = (chunk: any, encoding?: any, callback?: any): boolean => {
            TerminalLogger.writeToFile(chunk);
            return TerminalLogger.originalStderrWrite(chunk, encoding, callback);
        };
    }

    private static writeToFile(chunk: any) {
        if (!this.logFileStream) return;

        // Convert chunk to string
        const stringChunk = chunk.toString();

        // Regex to strip ANSI color codes (e.g. \u001b[32m)
        const cleanString = stringChunk.replace(
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, 
            ''
        );

        this.logFileStream.write(cleanString);
    }
}