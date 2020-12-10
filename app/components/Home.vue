<template>
    <Page ref="page" id="activity" :navigateUrl="navigateUrl">
        <Drawer ref="drawer" rightDrawerMode="slide">
            <GridLayout rows="auto,*" ~mainContent>
                <CActionBar showMenuIcon />
                <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton row="1" :tracks="selectedTracks" />
                <Label row="1" horizontalAlignment="left" color="blue" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentBearing" padding="10" />
                <Label row="1" horizontalAlignment="center" color="black" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="aimingAngle" padding="10" />
                <Label row="1" horizontalAlignment="right" color="red" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentComputedBearing" padding="10" />
                <StackLayout horizontalAlignment="left" verticalAlignment="bottom" row="1" marginBottom="100" backgroundColor="#44000000" width="100%">
                    <TextView variant="none" :text="eventsLog" fontSize="12" editable="false" color="#EDEDED" height="100" backgroundColor="transparent" />
                </StackLayout>
                <StackLayout orientation="horizontal" horizontalAlignment="center" verticalAlignment="bottom" row="1">
                    <MDButton class="floating-btn" :text="sessionRunning ? 'mdi-pause' : 'mdi-play'" @tap="onTap('startSession', $event)" />
                    <MDButton class="floating-btn" v-show="sessionPaused" :text="'mdi-stop'" @tap="onTap('stopSession', $event)" />
                </StackLayout>
            </GridLayout>
        </Drawer>
    </Page>
</template>

<script lang="ts" src="./Home.ts" />
