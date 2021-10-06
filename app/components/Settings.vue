<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <StackLayout>
            <CActionBar :title="$t('settings')" showMenuIcon />
            <GridLayout rows="auto, *" height="100%" backgroundColor="white">
                <ScrollView row="1">
                    <StackLayout>
                        <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto" v-if="connectedGlasses">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('gesture') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="$t('gesture_desc')" />
                            <Switch :ios:backgroundColor="accentColor" :checked="gestureEnabled" @checkedChange="switchGesture" rowSpan="2" col="1" verticalAlignment="center" />
                        </GridLayout>
                        <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto" v-if="connectedGlasses">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('auto_luminance') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="$t('sensor_desc')" />
                            <Switch :ios:backgroundColor="accentColor" :checked="sensorEnabled" @checkedChange="switchSensor" rowSpan="2" col="1" verticalAlignment="center" />
                        </GridLayout>
                        <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto,auto" v-if="connectedGlasses">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('light') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="$t('light_desc')" />
                            <MDSlider
                                margin="10 -0 10 -0"
                                :color="accentColor"
                                :backgroundColor="accentColor"
                                row="2"
                                colSpan="2"
                                :value="levelLuminance"
                                @valueChange="onLuminanceChange"
                                minValue="0"
                                maxValue="15"
                                verticalAlignment="center"
                            />
                        </GridLayout>
                        <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto,auto" v-show="!!currentShift" v-if="connectedGlasses">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('screen_offset') | uppercase" textAlignment="center" />
                            <Label col="0" row="1" class="settings-section-desc" :text="shiftDescription" />
                            <GridLayout padding="20" row="2" col="0" horizontalAlignment="center" verticalAlignment="center" rows="45,120,45" columns="45,150,45">
                                <MDButton row="1" col="0" class="settings-shift-button" :text="'mdi-arrow-left-bold-circle'" @tap="shift(1, 0)" @touch="onShiftTouch($event, 1, 0)" />
                                <MDButton row="1" col="2" class="settings-shift-button" :text="'mdi-arrow-right-bold-circle'" @tap="shift(-1, 0)" @touch="onShiftTouch($event, -1, 0)" />
                                <MDButton row="0" col="1" class="settings-shift-button" :text="'mdi-arrow-up-bold-circle'" @tap="shift(0, 1)" @touch="onShiftTouch($event, 0, 1)" />
                                <MDButton row="2" col="1" class="settings-shift-button" :text="'mdi-arrow-down-bold-circle'" @tap="shift(0, -1)" @touch="onShiftTouch($event, 0, -1)" />
                                <GridLayout row="1" col="1" borderWidth="2" rows="10,*,10" columns="10,*,10" :borderColor="accentColor">
                                    <StackLayout row="1" col="1" :backgroundColor="accentColor" opacity="0.3" />
                                    <StackLayout
                                        row="1"
                                        col="1"
                                        orientation="horizontal"
                                        borderWidth="2"
                                        :borderColor="accentColor"
                                        backgroundColor="transparent"
                                        :translateX="currentShift ? -currentShift.x / 2 : 0"
                                        :translateY="currentShift ? -currentShift.y / 2 : 0"
                                    >
                                        <Label
                                            padding="10"
                                            :color="accentColor"
                                            :text="$t('screen_offset')"
                                            fontSize="20"
                                            fontWeight="bold"
                                            textWrap
                                            horizontalAlignment="center"
                                            textAlignment="center"
                                            verticalAlignment="center"
                                            @tap="onTap('drawTestImage')"
                                        />
                                    </StackLayout>
                                </GridLayout>
                            </GridLayout>
                        </GridLayout>
                        <StackLayout borderTopColor="#F0F0F0" borderTopWidth="8" backgroundColor="white" marginTop="10" padding="8" v-if="devMode && connectedGlasses">
                            <GridLayout class="settings-section-holder" columns="*,auto" rows="auto,auto,auto">
                                <Label col="0" row="0" class="settings-section-title" :text="$t('firmware') | uppercase" />
                                <Label col="0" row="1" class="settings-section-desc" :text="firmwareVersion" />
                                <MDButton variant="outline" row="2" col="0" horizontalAlignment="left" :text="$t('update_firmware')" @tap="onTap('firmwareUpdate')" />
                            </GridLayout>
                        </StackLayout>
                        <StackLayout borderTopColor="#F0F0F0" borderTopWidth="8" backgroundColor="white" marginTop="10" padding="8" v-if="devMode && connectedGlasses">
                            <GridLayout class="settings-section-holder" columns="*,auto" rows="auto,auto,auto">
                                <Label col="0" row="0" class="settings-section-title" :text="$t('beta_firmware') | uppercase" />
                                <MDButton variant="outline" row="2" col="0" horizontalAlignment="left" :text="$t('check_update')" @tap="onTap('checkBetaFirmware')" />
                            </GridLayout>
                        </StackLayout>
                    </StackLayout>
                </ScrollView>
            </GridLayout>
        </StackLayout>
    </Page>
</template>

<script lang="ts" src="./Settings.ts" />
