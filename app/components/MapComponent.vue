<template>
    <GridLayout width="100%" height="100%">
        <CartoMap ref="mapView" zoom="16" @mapReady="onMapReady" @mapMoved="onMapMove" />
        <Label
            v-if="devMode && lastUserLocation"
            backgroundColor="rgba(0, 0, 0, 0.533)"
            borderRadius="10"
            marginTop="4"
            padding="4"
            fontSize="11"
            textWrap
            color="white"
            horizontalAlignment="center"
            verticalAlignment="top"
            :text="lastLocationDetails"
        />

        <MDCardView v-if="locationEnabled && showLocationButton" class="floating-btn" margin="8" horizontalAlignment="right" verticalAlignment="bottom" @tap="askUserLocation">
            <Label textAlignment="center" verticalAlignment="middle" class="mdi" :class="locationButtonLabelClass" :text="'mdi-crosshairs-gps'" :color="accentColor" />
        </MDCardView>
    </GridLayout>
</template>

<script lang="ts" src="./MapComponent.ts" />
