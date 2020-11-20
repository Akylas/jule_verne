import { BgService } from '~/services/android/BgService';

@JavaProxy('com.akylas.juleverne.BgServiceBinder')
@NativeClass
export class BgServiceBinder extends android.os.Binder {
    service: BgService;
    constructor() {
        super();
    }
    getService() {
        return this.service;
    }
    setService(service:  BgService) {
        this.service = service;
    }
}
