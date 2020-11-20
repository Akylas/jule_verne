<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <StackLayout>
            <CActionBar :title="$t('settings')" showMenuIcon />
            <GridLayout rows="auto, *" height="100%" backgroundColor="white">
                <ScrollView row="1">
                    <StackLayout>
                        <GridLayout class="settings-section settings-section-holder" columns="*,auto" rows="auto,auto">
                            <Label col="0" row="0" class="settings-section-title" :text="$t('units') | uppercase" />
                            <Label col="0" row="1" class="settings-section-desc" :text="$t('imperial_unit_desc')" />
                            <Switch :ios:backgroundColor="accentColor" v-model="imperialUnit" rowSpan="2" col="1" verticalAlignment="center" />
                        </GridLayout>
                    </StackLayout>
                </ScrollView>
            </GridLayout>
        </StackLayout>
    </Page>
</template>

<script lang="ts" src="./Settings.ts" />
