import { Component } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { GeoHandler, SessionEventData } from '~/handlers/GeoHandler';
import { ComponentIds } from './App';
import MapComponent from './MapComponent';
import { BaseVueComponentRefs } from './BaseVueComponent';

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

    setup(geoHandler: GeoHandler) {

        if (!geoHandler) {
            return;
        }
    }
}
