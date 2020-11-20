<template>
    <Page ref="page" id="activity" :navigateUrl="navigateUrl">
        <GridLayout rows="auto,*">
            <CActionBar showMenuIcon />
            <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton row="1" :tracks="tracks" />

            <StackLayout  horizontalAlignment="left" verticalAlignment="bottom" row="1" marginBottom="10" backgroundColor="#44000000" width="80%">
                <TextView variant="none" :text="eventsLog" fontSize="12" editable="false" color="#EDEDED" height="100" backgroundColor="transparent"/>
                <StackLayout orientation="horizontal" horizontalAlignment="center" verticalAlignment="bottom" row="1" marginBottom="10">
                    <MDButton class="icon-btn" :text="sessionRunning ? 'mdi-pause' : 'mdi-play'" @tap="onTap('startSession', $event)" />
                    <MDButton class="icon-btn" v-show="sessionPaused" :text="'mdi-stop'" @tap="onTap('stopSession', $event)" />
                </StackLayout>
            </StackLayout>
        </GridLayout>
    </Page>
</template>

<script lang="ts" src="./Home.ts" />
