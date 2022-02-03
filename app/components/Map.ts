import { Component } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { GeoHandler, SessionEventData } from '~/handlers/GeoHandler';
import MapComponent from './MapComponent';
import { BaseVueComponentRefs } from './BaseVueComponent';
import { ComponentIds } from '~/vue.prototype';

export interface HomeRefs extends BaseVueComponentRefs {
    [key: string]: any;
    mapComp: MapComponent;
}

@Component({
    components: {
        MapComponent
    }
})
export default class Map extends BgServiceComponent {
    navigateUrl = ComponentIds.Map;
    loading = false;
    mounted() {
        super.mounted();
        this.$refs.mapComp.askUserLocation();
    }
    destroyed() {
        super.destroyed();
    }

    onUpdateSessionEvent(e: SessionEventData) {
        // this.log('onUpdateSessionEvent');
    }
}
