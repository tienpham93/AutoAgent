

export class CommonHelper {
    static sleep(ms: number): Promise<void> {
        console.log(`[⏳⏳⏳] >> Sleeping for ${ms} ms...`);
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}