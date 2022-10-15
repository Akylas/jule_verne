<template>
    <Page ref="page">
        <GridLayout rows="auto,*,auto,auto,auto">
            <CActionBar :title="$tc('partners')" />
            <ScrollView row="1">
                <StackLayout>
                    <WrapLayout margin="20">
                        <Image src="~/assets/images/logos/Ministere-de-la-Culture.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Prefecture-Region-Auvergne-Rhone-Alpes-scaled.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Region-Auvergne-Rhone-Alpes.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Departement-de-lIsere.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Ville-de-Grenoble.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/logo-hexagone-22.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/CEA-Grenoble.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Grenoble-Capitale-verte-europeenne.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/CCN2-Grenoble.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/SPEDIDAM.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Office-du-Tourisme-de-Grenoble.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Fondation-Louis-Vicat-scaled.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Grenoble-Alpes-Metropole.png" width="28%" margin="8" />
                        <Image src="~/assets/images/logos/Logo_fabrique_transparence-rouge-small 2.png" width="28%" margin="8" />
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
