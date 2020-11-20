<template>
    <GridLayout id="listitem" :rippleColor="color" height="60" columns="auto,*" :backgroundColor="selected ? color : 'white'">
        <CheckBox v-show="checked !== null" :checked="checked" verticalAlignment="center" @checkedChange="onCheckedChange" />
        <CanvasLabel
            @tap="onTap" @longPress="onLongPress"
            col="1"
            id="listitemcanvaslabel"
            paddingLeft="16"
            :color="defaultTextColor"
            fontSize="14"
            class="robotoMedium"
            borderBottomWidth="1"
            :borderBottomColor="borderColor"
            backgroundColor="transparent"
        >
            <CSpan
                :visibilty="icon ? 'visible' : 'hidden'"
                textAlignment="center"
                verticalAlignment="center"
                :color="coloredIcon ? color : 'white'"
                fontSize="18"
                :fontFamily="mdiFontFamily"
                :text="icon"
                width="36"
                height="36"
                :backgroundColor="coloredIcon ? null : color"
                borderRadius="7"
            />
            <CSpan :color="textColor" :paddingLeft="icon ? 50 : 0" fontSize="15" verticalAlignment="center" :text="title" />
            <CSpan v-show="rightTitle" fontWeight="400" textAlignment="right" color="#A4A4A4" paddingRight="45" fontSize="12" verticalAlignment="center" :text="rightTitle" />
            <CSpan :visibility="chevron ? 'visible' : 'hidden'" paddingRight="15" textAlignment="right" :fontFamily="mdiFontFamily" fontSize="14" verticalAlignment="middle" text="mdi-chevron-right" />
        </CanvasLabel>
    </GridLayout>
</template>

<script lang="ts" src="./ListItem.ts"></script>
