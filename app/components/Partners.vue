<template>
    <Page ref="page">
        <GridLayout rows="auto,*,auto,auto,auto" backgroundColor="white">
            <CActionBar :title="$tc('partners')" :backgroundColor="backgroundColor" />
            <ScrollView row="1">
                <StackLayout>
                    <WrapLayout margin="20">
                        <Image src="~/assets/images/logos/Prefecture-Region-Auvergne-Rhone-Alpes-scaled.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Region-Auvergne-Rhone-Alpes.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Departement-de-lIsere.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Ville-de-Grenoble.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Hexagone.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/CEA-Grenoble.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/greoble_green.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/CCN2-Grenoble.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/SPEDIDAM.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Office-du-Tourisme-de-Grenoble.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Fondation-Louis-Vicat-scaled.jpg" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Grenoble-Alpes-Metropole.jpg" width="28%" margin="8" />
                        <Image src="res://activelook_logo" width="28%" margin="8" />
                        <Image src="res://activemotion_logo" width="28%" margin="8" />
                        <Image src="res://akylas_logo" width="28%" margin="8" />
                    </WrapLayout>
                </StackLayout>
            </ScrollView>
        </GridLayout>
    </Page>
</template>

<script lang="ts">
import { Component } from 'vue-property-decorator';
import { backgroundColor } from '~/variables';
import BaseVueComponent from './BaseVueComponent';

@Component({})
export default class Partners extends BaseVueComponent {
    backgroundColor = backgroundColor;
    mounted() {
        super.mounted();
    }
    destroyed() {
        super.destroyed();
    }
}
</script>
