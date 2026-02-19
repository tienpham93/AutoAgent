import { v4 as uuidv4 } from 'uuid';

export class CommonHelper {

    static sleep(ms: number): Promise<void> {
        console.log(`[⏳⏳⏳] >> Sleeping for ${ms} ms...`);
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static generateUUID(totalDigits = -12): string {
        return uuidv4().slice(totalDigits);
    }
        
    static getCurrentTimestamp(): number {
        return new Date().getTime();
    }
}