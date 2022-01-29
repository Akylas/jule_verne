import Vue from 'nativescript-vue';
import { ItemEventData } from '@nativescript/core/ui/list-view';
import { Component, Prop } from 'vue-property-decorator';
import { darkColor } from '~/variables';

export interface Option {
    title: string;
    subtitle?: string;
}

@Component({})
export default class OptionSelect extends Vue {
    darkColor = darkColor;
    @Prop({})
    public options: Option[];

    public height = 300;
    @Prop({ default: 'available devices' })
    title: string;
    public constructor() {
        super();
    }

    public close(value?: Option) {
        this.$modal.close(value);
        // this.indicator.hide();
    }

    mounted() {}

    public onItemTap(result: Option) {
        // console.log('Item Tapped at cell index: ' + args.index);
        // const result = this.options[args.index];
        if (result) {
            this.close(result);
            // this.bleService.once(BLEConnectedEvent, ()=>{
            //     this.close();
            // })
            // this.bleService.connect(device.UUID);
        }
    }
}
