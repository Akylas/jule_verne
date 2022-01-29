<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <StackLayout>
            <CActionBar :title="$t('settings')" showMenuIcon />
            <CollectionView :items="items">
                <v-template if="item.type === 'shift'">
                    <GridLayout>
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto,auto">
                        <Label row="0" class="settings-section-title" :text="$t('screen_offset') | uppercase" textAlignment="center" />
                        <Label row="1" class="settings-section-desc" :text="item.description" />
                        <GridLayout padding="20" row="2" horizontalAlignment="center" verticalAlignment="center" rows="45,120,45" columns="45,150,45">
                            <MDButton row="1" class="settings-shift-button" :text="'mdi-arrow-left-bold-circle'" @tap="shift(1, 0)" @touch="onShiftTouch($event, 1, 0)" />
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
                                    :translateX="item.currentShift ? -item.currentShift.x / 2 : 0"
                                    :translateY="item.currentShift ? -item.currentShift.y / 2 : 0"
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
                                        @tap="onButtonTap('drawTestImage')"
                                    />
                                </StackLayout>
                            </GridLayout>
                        </GridLayout>
                    </GridLayout>
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'config'">
                    <GridLayout>
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto">
                        <Label row="0" class="settings-section-title" :text="item.name | uppercase" />
                        <Label row="1" class="settings-section-desc" :text="item.size | filesize" />
                        <MDButton col="1" rowSpan="2" v-show="!item.isSystem" variant="text" class="icon-btn" text="mdi-delete" @tap="onButtonTap('deleteCfg', item, $event)" />
                    </GridLayout>
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'switch'">
                    <GridLayout>
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto">
                        <Label row="0" class="settings-section-title" :text="item.title | uppercase" />
                        <Label row="1" class="settings-section-desc" :text="item.subtitle" />
                        <Switch :ios:backgroundColor="accentColor" :checked="item.checked" @checkedChange="onCheckedChange(item, $event)" rowSpan="2" col="1" verticalAlignment="center" />
                    </GridLayout>
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'header'">
                    <GridLayout>
                    <GridLayout columns="*,auto">
                        <Label class="settings-header" :text="item.title | uppercase" />
                        <MDButton variant="text" col="1" v-show="item.buttonTitle" :text="item.buttonTitle" @tap="onButtonTap(item.id, item, $event)" :color="accentColor" :rippleColor="accentColor" />
                    </GridLayout>
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'button'">
                    <GridLayout>
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto,auto">
                        <Label row="0" class="settings-section-title" :text="item.title | uppercase" />
                        <Label row="1" v-show="item.subtitle" class="settings-section-desc" :text="item.subtitle" />
                        <MDButton variant="outline" rowSpan="2" col="1" :text="item.buttonTitle" @tap="onButtonTap(item.id, item, $event)" :color="accentColor" :rippleColor="accentColor" />
                    </GridLayout>
                    </GridLayout>
                </v-template>
                <v-template if="item.type === 'slider'">
                    <GridLayout>
                    <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto,auto">
                        <Label row="0" class="settings-section-title" :text="item.title | uppercase" />
                        <Label row="1" class="settings-section-desc" :text="item.subtitle" />
                        <MDSlider
                            margin="10 -0 10 -0"
                            :color="accentColor"
                            :backgroundColor="accentColor"
                            row="2"
                            colSpan="2"
                            :value="item.value"
                            @valueChange="onSliderChange(item, $event)"
                            minValue="0"
                            maxValue="15"
                            verticalAlignment="center"
                        />
                    </GridLayout>
                    </GridLayout>
                </v-template>
            </CollectionView>
        </StackLayout>
    </Page>
</template>

<script lang="ts" src="./Settings.ts" />
