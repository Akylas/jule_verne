<template>
    <Page ref="page" id="activity" :navigateUrl="navigateUrl">
        <Drawer ref="drawer" rightDrawerMode="slide" :gestureEnabled="true">
            <GridLayout rows="auto,*" ~mainContent>
                <CActionBar
                    showMenuIcon
                    showGlassesIcon="true"
                    :glasses="connectedGlasses"
                    :battery="glassesBattery"
                    @longPressGlass="onLongPress('disconnectGlasses', $event)"
                    @tapGlass="onTap('connectGlasses')"
                >
                    <MDButton variant="text" v-show="!bluetoothEnabled" class="icon-btn" text="mdi-bluetooth-off" />
                </CActionBar>
                <MapComponent ref="mapComp" @mapReady="onMapReady" showLocationButton row="1" :tracks="selectedTracks" :viewedFeature="viewedFeatures" />
                <Label row="1" horizontalAlignment="left" color="blue" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentBearing" padding="10" />
                <Label row="1" horizontalAlignment="center" color="black" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="aimingAngle" padding="10" />
                <Label row="1" horizontalAlignment="right" color="red" verticalAlignment="top" fontSize="40" class="mdi" text="mdi-navigation" :rotate="currentComputedBearing" padding="10" />
                <!-- <StackLayout horizontalAlignment="left" verticalAlignment="bottom" row="1" marginBottom="100" backgroundColor="#44000000" width="100%" :isPassThroughParentEnabled="true">
                    <TextView variant="none" :text="eventsLog" fontSize="12" editable="false" color="#EDEDED" height="100" backgroundColor="transparent" isUserInteractionEnabled="false" />
                    <MDButton variant="text" v-show="!!insideFeature" :text="insideFeature ? `play ${insideFeatureName}` : ''" @tap="playCurrentStory" />
                </StackLayout> -->

                <NSImg ref="imageView" width="100" height="100" horizontalAlignment="left" verticalAlignment="bottom" row="1" />
                <StackLayout orientation="horizontal" horizontalAlignment="center" verticalAlignment="bottom" row="1">
                    <MDButton class="floating-btn" :text="sessionRunning ? 'mdi-pause' : 'mdi-play'" @tap="onTap('startSession', $event)" />
                    <MDButton class="floating-btn" v-show="sessionPaused" :text="'mdi-stop'" @tap="onTap('stopSession', $event)" />
                </StackLayout>
                <!-- <MDButton
                    class="small-floating-btn"
                    v-show="connectedGlasses"
                    text="mdi-settings"
                    @tap="onTap('settings', $event)"
                    verticalAlignment="bottom"
                    row="1"
                    horizontalAlignment="left"
                    marginBottom="8"
                /> -->
            </GridLayout>
            <GridLayout ~rightDrawer rows="auto, *, auto" height="100%" backgroundColor="white" width="70%">
                <GridLayout v-show="!!connectedGlasses" columns="auto,*,auto" rows="*,auto,auto,*,30" margin="15 15 30 15">
                    <GridLayout borderRadius="20" width="40" height="40" row="1" rowSpan="2" col="0" backgroundColor="#ececec" marginRight="10" verticalAlignment="top">
                        <label class="menuIcon" :text="'mdi-sunglasses'" verticalAlignment="center" />
                    </GridLayout>
                    <Label col="1" row="1" fontSize="18" :text="connectedGlassesName" verticalAlignment="center" maxLines="2" textWrap />
                    <Label v-show="!!glassesSerialNumber" col="1" row="2" fontSize="14" class="roboto" :text="glassesSubtitle" verticalAlignment="top" maxLines="2" textWrap />
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
                <StackLayout row="1">
                    <MDButton :text="$tc('histoire 1')" @tap="onTap('histoire 1')" />
                    <MDButton :text="$tc('bonjour')" @tap="onTap('hello')" />
                    <MDButton :text="$tc('rideau')" @tap="onTap('rideau')" />
                    <MDButton :text="$tc('demitour')" @tap="onTap('demitour')" />
                    <MDButton :text="$tc('stop')" @tap="onTap('stopPlaying')" />
                </StackLayout>
            </GridLayout>
        </Drawer>
    </Page>
</template>

<script lang="ts" src="./Home.ts" />
