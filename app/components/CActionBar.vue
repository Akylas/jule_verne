<template>
    <GridLayout class="actionBar" columns="auto,*, auto" paddingLeft="5" paddingRight="5">
        <StackLayout col="1" colSpan="3" verticalAlignment="center">
            <Label class="actionBarTitle" :visibility="!!title ? 'visible' : 'hidden'" textAlignment="left" :text="title || '' | uppercase" />
            <Label :visibility="!!subtitle ? 'visible' : 'collapse'" textAlignment="left" class="actionBarSubtitle" :text="subtitle" />
        </StackLayout>
        <Label col="1" v-if="!!showLogo && !title" fontSize="28" color="white" verticalAlignment="center" marginLeft="6" />
        <StackLayout col="0" orientation="horizontal">
            <slot name="left" />
            <MDButton variant="text" :visibility="menuIconVisibility" class="icon-btn" :text="menuIcon" @tap="onMenuIcon" />
        </StackLayout>
        <StackLayout col="2" orientation="horizontal">
            <slot />
        </StackLayout>
    </GridLayout>
</template>

<script lang="ts" src="./CActionBar.ts" />
