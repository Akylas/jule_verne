import { filesize } from 'filesize';
import VueStringFilter from 'vue-string-filter';
import { UNITS, convertTime, formatValueToUnit } from '~/helpers/formatter';

export function date(value, formatStr?: string) {
    return convertTime(value, formatStr || 'LLL');
}
const Plugin = {
    install(Vue) {
        Vue.use(VueStringFilter);

        Vue.filter('concat', (value, ln) => `${value} ${ln}`);

        Vue.filter('unit', function (value: any, unit: UNITS, isImperial) {
            return formatValueToUnit(value, unit, isImperial);
        });
        Vue.filter('filesize', function (value: any) {
            return filesize(value);
        });

        Vue.filter('date', date);
    }
};

export default Plugin;
