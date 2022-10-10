<template>
    <Page ref="page" :navigateUrl="navigateUrl" :enableSwipeBackNavigation="!updatingFirmware" @navigatingTo="onNavigatingTo" @navigatingFrom="onNavigatingFrom">
        <StackLayout>
            <CActionBar :title="$t('update')" :disableBackButton="updatingFirmware" :glasses="connectedGlasses" :battery="glassesBattery" />
            <GridLayout rows="auto, *, auto, auto" height="100%">
                <StackLayout row="0">
                    <StackLayout class="settings-section">
                        <GridLayout class="settings-section-holder" columns="*,auto" rows="30,20">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('glasses') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="glassesName" />
                        </GridLayout>
                    </StackLayout>
                    <StackLayout class="settings-section">
                        <GridLayout class="settings-section-holder" columns="*,auto" rows="30,20">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('file') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="fileName" />
                            <Label col="1" row="1" class="settings-section-desc" :text="fileSize" horizontalAlignment="right" />
                        </GridLayout>
                    </StackLayout>
                    <Label margin="10 20 0 10" fontSize="16" color="#696969" :text="$t('firmware_update_desc')" textAlignment="center" verticalAlignment="center" textWrap />
                    <StackLayout margin="0 10 0 10">
                        <Label marginTop="10" fontSize="24" :color="accentColor" :text="Math.round(currentProgress) + '%'" textAlignment="center" verticalAlignment="center" />
                        <MDProgress marginTop="10" :value="currentProgress" maxValue="100" :color="accentColor" />
                    </StackLayout>
                </StackLayout>
                <TextView row="1" :text="firmwareRunLog" fontSize="10" editable="false" v-if="devMode" />
                <MDButton :isEnabled="!updatingFirmware" marginBottom="20" row="2" :text="$t('update_glasses')" @tap="onTap('sendUpdate')" />
                <MDButton v-if="devMode" marginBottom="20" row="3" :text="$t('reboot_glasses')" @tap="onTap('reboot')" />
            </GridLayout>
        </StackLayout>
    </Page>
</template>
<script lang="ts">
import { Application } from '@nativescript/core';
import { AndroidActivityBackPressedEventData } from '@nativescript/core/application/application-interfaces';
import { showSnack } from '@nativescript-community/ui-material-snackbar';
import { AndroidApplication } from '@nativescript/core/application';
import { File } from '@nativescript/core/file-system';
import {filesize} from 'filesize';
import { Component, Prop } from 'vue-property-decorator';
import { BLEConnectionEventData } from '~/handlers/BluetoothHandler';
import { Catch } from '~/utils';
import { ComponentIds } from '~/vue.prototype';
import FirmwareUpdateComponent from './FirmwareUpdateComponent';
import { BgServiceMethodParams } from './BgServiceComponent';

const TAG = '[FirmwareUpdate]';

@Component({})
export default class FirmwareUpdate extends FirmwareUpdateComponent {
    navigateUrl = ComponentIds.Firmware;
    @Prop({}) firmwareFile: File;

    get glassesName() {
        return this.connectedGlasses && this.connectedGlasses.localName;
    }
    get fileName() {
        return this.firmwareFile && this.firmwareFile.name;
    }
    get fileSize() {
        return this.firmwareFile && filesize(this.firmwareFile.size);
    }
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
    setup(handlers: BgServiceMethodParams) {
        super.setup(handlers);
    }

    onNavigatingTo() {
        this.inFront = true;
        DEV_LOG && console.log(TAG, this.constructor.name, 'onNavigatingTo');
        if (__ANDROID__) {
            Application.android.on(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }
    onNavigatingFrom() {
        this.inFront = false;
        DEV_LOG && console.log(TAG, this.constructor.name, 'onNavigatingFrom');
        if (__ANDROID__) {
            Application.android.off(AndroidApplication.activityBackPressedEvent, this.onAndroidBackButton);
        }
    }
    onAndroidBackButton(data: AndroidActivityBackPressedEventData) {
        if (__ANDROID__) {
            if (!this.inFront) {
                return;
            }
            if (this.updatingFirmware) {
                data.cancel = true;
                showSnack({ message: this.$t('cant_leave_during_firmware_update') });
            }
        }
    }
    onGlassesConnected(e: BLEConnectionEventData) {
        DEV_LOG && console.log(TAG, 'onGlassesConnected');
        super.onGlassesConnected(e);
        this.close();
    }
    onGlassesDisconnected(e: BLEConnectionEventData) {
        DEV_LOG && console.log(TAG, 'onGlassesDisconnected');
        super.onGlassesDisconnected(e);
        this.close();
    }

    @Catch()
    onTap(command: string, event?) {
        switch (command) {
            case 'sendUpdate':
                this.updateFirmware(this.firmwareFile);
                break;
            case 'reboot':
                this.rebootGlasses();
                break;
        }
    }
    close() {
        this.$navigateBackIfUrl(this.navigateUrl);
    }
}
</script>
