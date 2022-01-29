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
            <GridLayout class="glassIconLayout" rows="*,6,10,8,4,auto,*" columns="*,21,9,*" :visibility="shouldShowGlassesIcon ? 'visible' : 'collapse'">
                <MDButton rowSpan="6" colSpan="4" class="icon-btn" variant="text" :text="'mdi-sunglasses'" @tap="onGlassesButton" @longPress="onLongGlassesButton" />
                <Label isUserInteractionEnabled="false" :backgroundColor="glasses ? '#53da22' : '#ed243e'" borderRadius="4.5" row="2" col="2" />
                <GridLayout :columns="glassesBatteryColumns" backgroundColor="#E4E4E4" width="24" borderRadius="1" height="4" row="4" col="1" colSpan="2">
                    <AbsoluteLayout col="0" :backgroundColor="glassBatteryColor" />
                </GridLayout>
                <Label isUserInteractionEnabled="false" horizontalAlignment="center" fontSize="7" fontWeight="bold" :text="battery + '%'" row="5" col="1" colSpan="2" />
            </GridLayout>
        </StackLayout>
    </GridLayout>
</template>

<script lang="ts" src="./CActionBar.ts" />
