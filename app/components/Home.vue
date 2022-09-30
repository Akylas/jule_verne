<template>
    <Page ref="page" id="activity" :navigateUrl="navigateUrl" @navigatingTo="onNavigatingTo" @navigatingFrom="onNavigatingFrom" @loaded="onLoaded">
        <Drawer
            ref="drawer"
            :gestureEnabled="true"
            :gestureHandlerOptions="{
                failOffsetYStart: -10,
                failOffsetYEnd: 10
            }"
        >
            <GridLayout rows="auto,*" ~mainContent>
                <CActionBar showMenuIcon>
                    <MDButton variant="text" v-show="!bluetoothEnabled" class="icon-btn" text="mdi-bluetooth-off" />
                    <GlassesIcon :glasses="connectedGlasses" :battery="glassesBattery" @longPress="onLongPress('disconnectGlasses', $event)" @tap="onTap('connectGlasses')" />
                </CActionBar>
                <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton row="1" :tracks="selectedTracks" :viewedFeature="viewedFeatures" />
                <Label row="1" horizontalAlignment="left" color="blue" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentBearing" padding="10" />
                <Label row="1" horizontalAlignment="center" color="black" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="aimingAngle" padding="10" />
                <Label row="1" horizontalAlignment="right" color="red" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentComputedBearing" padding="10" />
                <!-- <StackLayout horizontalAlignment="left" verticalAlignment="bottom" row="1" marginBottom="100" backgroundColor="#44000000" width="100%" :isPassThroughParentEnabled="true">
                    <TextView variant="none" :text="eventsLog" fontSize="12" editable="false" color="#EDEDED" height="100" backgroundColor="transparent" isUserInteractionEnabled="false" />
                    <MDButton variant="text" v-show="!!insideFeature" :text="insideFeature ? `play ${insideFeatureName}` : ''" @tap="playCurrentStory" />
                </StackLayout> -->

                <!-- <AudioPlayerWidget row="1" verticalAlignment="bottom" marginBottom="90" /> -->
                <!-- <MDButton
                    row="1"
                    @tap="onTap('toggleMusicPlayPause', $event)"
                    verticalTextAlignment="bottom"
                    textAlignment="center"
                    v-show="storyPlaying"
                    horizontalAlignment="center"
                    verticalAlignment="bottom"
                    padding="15"
                    marginBottom="90"
                >
                    <Span :fontFamily="mdiFontFamily" :text="'mdi-music' + ' '" fontSize="24" />
                    <Span fontWeight="bold" :text="storyPaused ? $tc('play') : $tc('pause')" verticalAlignment="center" fontSize="20" />
                </MDButton> -->
                <StackLayout orientation="horizontal" horizontalAlignment="center" verticalAlignment="bottom" row="1">
                    <MDButton class="floating-btn" :text="sessionRunning ? 'mdi-pause' : 'mdi-play'" @tap="onTap('startSession')" />
                    <MDButton class="floating-btn" v-show="sessionPaused" :text="'mdi-stop'" @tap="onTap('stopSession')" />
                </StackLayout>
                <MDButton class="small-floating-btn" text="mdi-cog" @tap="onTap('settings')" verticalAlignment="bottom" row="1" horizontalAlignment="left" marginBottom="8" />
            </GridLayout>
            <GridLayout ~rightDrawer rows="auto, *, auto" height="100%" width="70%" :backgroundColor="backgroundColor">
                <GridLayout v-show="!!connectedGlasses" columns="auto,*,auto" rows="*,auto,auto,auto,*,30" margin="15 15 30 15">
                    <GridLayout borderRadius="20" width="40" height="40" row="1" rowSpan="2" col="0" backgroundColor="#ececec" marginRight="10" verticalAlignment="top">
                        <Label class="menuIcon" :text="'mdi-sunglasses'" verticalAlignment="center" />
                    </GridLayout>
                    <Label col="1" row="1" fontSize="18" :text="connectedGlassesName" verticalAlignment="center" maxLines="2" textWrap />
                    <Label v-show="!!glassesSerialNumber" col="1" row="2" fontSize="14" :text="glassesSubtitle" verticalAlignment="top" maxLines="2" textWrap />
                    <Label v-show="!!availableConfigs" col="1" row="3" fontSize="14" :text="availableConfigsLabel" verticalAlignment="top" maxLines="2" textWrap />
                    <MDButton
                        v-show="connectedGlasses && !!connectedGlasses.supportSettings"
                        col="2"
                        rowSpan="4"
                        variant="text"
                        class="menu-btn"
                        :text="'mdi-pencil'"
                        @tap="onTap('changeDeviceName')"
                    />
                </GridLayout>
                <ScrollView row="1">
                    <StackLayout>
                        <MDButton text="Or Gris(1)" @tap="onTap('playStory', '1')" />
                        <MDButton text="Houille Blanche(2)" @tap="onTap('playStory', '2')" />
                        <MDButton text="Or Blanc(3)" @tap="onTap('playStory', '3')" />
                        <MDButton text="Or Vert(4)" @tap="onTap('playStory', '4')" />
                        <MDButton :text="'bonjour'" @tap="onTap('start')" />
                        <MDButton :text="'demitour'" @tap="onTap('uturn')" />
                        <MDButton :text="'exit'" @tap="onTap('exit')" />
                        <MDButton :text="'right'" @tap="onTap('right')" />
                        <MDButton :text="$tc('stop')" @tap="onTap('stopPlaying')" />
                    </StackLayout>
                </ScrollView>
            </GridLayout>
        </Drawer>
    </Page>
</template>

<script lang="ts" src="./Home.ts" />
