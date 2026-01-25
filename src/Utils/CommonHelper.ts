import { Logzer } from "./Logger";
import { v4 as uuidv4 } from 'uuid';

export class CommonHelper {

    static sleep(ms: number): Promise<void> {
        console.log(`[⏳⏳⏳] >> Sleeping for ${ms} ms...`);
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateUUID(): string {
        return uuidv4();
    }
        
}