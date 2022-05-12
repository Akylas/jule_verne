<template>
    <Page ref="page" :navigateUrl="navigateUrl">
        <StackLayout backgroundColor="white">
            <CActionBar :title="$t('map')" showMenuIcon />
            <StackLayout>
                <MapComponent ref="mapComp" height="100%" width="100%" showLocationButton :showFiltered="devMode" />
            </StackLayout>
        </StackLayout>
    </Page>
</template>

<script lang="ts" src="./Map.ts" />
