const map = L.map('example2').setView([45.18453, 5.75], 13);

L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {
    maxZoom: 180,
    pmIgnore: false,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: ['a', 'b', 'c']
}).addTo(map);

map.pm.addControls({
    position: 'topleft'
});

map.pm.Toolbar.createCustomControl({name:"alertBox",block: "custom",className: "save-button",title: "Count layers",onClick: ()=>{
    generateGeoJson();
},toggle: false});





function findLayers(map) {
    let layers = [];
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline || layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.CircleMarker) {
            layers.push(layer);
        }
    });

    // filter out layers that don't have the leaflet-geoman instance
    layers = layers.filter((layer) => !!layer.pm);

    // filter out everything that's leaflet-geoman specific temporary stuff
    layers = layers.filter((layer) => !layer._pmTempLayer);

    return layers;
}

function importGeo() {
    const prom = prompt();
    if (prom) {
        importGeoJSON(JSON.parse(prom));
    }
}

function importGeoJSON(feature) {
    const geoLayer = L.geoJSON(feature, {
        style(feature) {
            return feature.properties.options;
        },
        pointToLayer(feature, latlng) {
            switch (feature.properties.type) {
                case 'marker':
                    return new L.Marker(latlng);
                case 'circle':
                    return new L.Circle(latlng, feature.properties.options);
                case 'circlemarker':
                    return new L.CircleMarker(latlng, feature.properties.options);
            }
        }
    });

    geoLayer.getLayers().forEach((layer) => {
        if (layer._latlng) {
            var latlng = layer.getLatLng();
        } else {
            var latlng = layer.getLatLngs();
        }
        switch (layer.feature.properties.type) {
            case 'rectangle':
                new L.Rectangle(latlng, layer.options).addTo(map);
                break;
            case 'circle':
                console.log(layer.options);
                new L.Circle(latlng, layer.options).addTo(map);
                break;
            case 'polygon':
                new L.Polygon(latlng, layer.options).addTo(map);
                break;
            case 'polyline':
                new L.Polyline(latlng, layer.options).addTo(map);
                break;
            case 'marker':
                new L.Marker(latlng, layer.options).addTo(map);
                break;
            case 'circlemarker':
                new L.CircleMarker(latlng, layer.options).addTo(map);
                break;
        }
    });
}
function generateGeoJson() {
    const fg = L.featureGroup();
    const layers = findLayers(map);

    const geo = {
        type: 'FeatureCollection',
        features: []
    };
    layers.forEach(function (layer) {
        const geoJson = JSON.parse(JSON.stringify(layer.toGeoJSON()));
        if (!geoJson.properties) {
            geoJson.properties = {};
        }

        geoJson.properties.options = JSON.parse(JSON.stringify(layer.options));

        if (layer.options.radius) {
            const radius = parseFloat(layer.options.radius);
            if (radius % 1 !== 0) {
                geoJson.properties.options.radius = radius.toFixed(6);
            } else {
                geoJson.properties.options.radius = radius.toFixed(0);
            }
        }

        if (layer instanceof L.Rectangle) {
            geoJson.properties.type = 'rectangle';
        } else if (layer instanceof L.Circle) {
            geoJson.properties.type = 'circle';
        } else if (layer instanceof L.CircleMarker) {
            geoJson.properties.type = 'circlemarker';
        } else if (layer instanceof L.Polygon) {
            geoJson.properties.type = 'polygon';
        } else if (layer instanceof L.Polyline) {
            geoJson.properties.type = 'polyline';
        } else if (layer instanceof L.Marker) {
            geoJson.properties.type = 'marker';
        }

        geo.features.push(geoJson);
    });
    if (window.nsWebViewBridge) {
        window.nsWebViewBridge.emit('geojson', JSON.stringify(geo));
    } else {
        console.log(JSON.stringify(geo));
        alert(JSON.stringify(geo));

    }
}
