<template>
    <Page ref="page" :navigateUrl="navigateUrl" :enableSwipeBackNavigation="!updatingFirmware">
        <StackLayout>
            <CActionBar :title="$t('update')" :disableBackButton="updatingFirmware" :glasses="connectedGlasses" :battery="glassesBattery" />
            <GridLayout rows="auto, *, auto, auto" height="100%" backgroundColor="#EDEDED">
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
                        <Label marginTop="10" fontSize="24" :color="accentColor" :text="Math.round(currentProgress * 100) + '%'" textAlignment="center" verticalAlignment="center" />
                        <MDProgress marginTop="10" :value="currentProgress * 100" maxValue="100" :color="accentColor" />
                    </StackLayout>
                </StackLayout>
                <TextView row="1" :text="firmwareRunLog" fontSize="10" editable="false" backgroundColor="#EDEDED" v-if="devMode" />
                <MDButton :isEnabled="!updatingFirmware" marginBottom="20" row="2" :text="$t('update_glasses')" @tap="onTap('sendUpdate')" />
                <MDButton v-if="devMode" marginBottom="20" row="3" :text="$t('reboot_glasses')" @tap="onTap('reboot')" />
            </GridLayout>
        </StackLayout>
    </Page>
</template>
<script lang="ts" src="./FirmwareUpdate.ts" />
