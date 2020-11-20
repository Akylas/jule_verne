import VueStringFilter from 'vue-string-filter';
import { UNITS, convertTime, formatValueToUnit } from '~/helpers/formatter';
const Plugin = {
    install(Vue) {

        Vue.use(VueStringFilter);

        Vue.filter('concat', (value, ln) => `${value} ${ln}`);

        Vue.filter('unit', function(value: any, unit: UNITS, isImperial) {
            return formatValueToUnit(value, unit, isImperial);
        });

        Vue.filter('date', function(value, formatStr?: string) {
            return convertTime(value, formatStr || 'LLL');
        });
    }
};

export default Plugin;
