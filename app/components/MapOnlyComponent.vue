<template>
    <CartoMap ref="mapView" zoom="16" focusPos="45.2002,5.7222" @mapReady="onMapReady" @mapMoved="onMapMove" />
</template>

<script lang="ts">
import { Component, Prop, Watch } from 'vue-property-decorator';
import MapComponent from './MapComponent.vue';

@Component({})
export default class MapOnlyComponent extends MapComponent {}
</script>
