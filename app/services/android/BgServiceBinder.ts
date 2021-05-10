import { BgService } from '~/services/android/BgService';
export declare class IBgServiceBinder extends android.os.Binder {
    getService(): BgService;
    setService(service: BgService);
}
// @JavaProxy('com.akylas.juleverne.BgServiceBinder')
// @NativeClass
// export class BgServiceBinder extends android.os.Binder {
//     service: BgService;
//     constructor() {
//         super();
//     }
//     getService() {
//         return this.service;
//     }
//     setService(service:  BgService) {
//         this.service = service;
//     }
// }
export const BgServiceBinder = (android.os.Binder as any).extend('com.akylas.juleverne.BgServiceBinder', {
    // export class BgServiceBinder extends android.os.Binder {
    // service: BgService;
    getService() {
        return this.service;
    },
    setService(service: BgService) {
        this.service = service;
    }
}) as typeof IBgServiceBinder;
