<template>
    <CartoMap ref="mapView" zoom="16" focusPos="45.2002,5.7222" @mapReady="onMapReady" @mapMoved="onMapMove" />
</template>

<script lang="ts" src="./MapOnlyComponent.ts" />
