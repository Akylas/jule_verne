import { Component } from 'vue-property-decorator';
import BgServiceComponent from '~/components/BgServiceComponent';
import { ComponentIds } from './App';

@Component({
    components: {
    }
})
export default class Settings extends BgServiceComponent {
    navigateUrl = ComponentIds.Settings;
    constructor() {
        super();
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }

}
