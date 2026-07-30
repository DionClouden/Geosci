const viewer = new Cesium.Viewer("cesiumContainer", {

    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false

});


// PERFORMANCE SETTINGS

viewer.scene.requestRenderMode = true;

viewer.scene.maximumRenderTimeChange = Infinity;


// REMOVE CESIUM SATELLITE IMAGERY

viewer.imageryLayers.removeAll();


// DARK SPACE / PLANET STYLE

viewer.scene.globe.baseColor =
    Cesium.Color.fromCssColorString("#020202");

viewer.scene.globe.enableLighting = false;

viewer.scene.fog.enabled = false;

viewer.scene.skyAtmosphere.show = false;

viewer.scene.globe.showGroundAtmosphere = false;

viewer.scene.globe.dynamicAtmosphereLighting = false;


// LOAD LAND GEOJSON

// LOAD CONTINENTS GEOJSON
Cesium.GeoJsonDataSource.load("data/continents.json")
.then(function(dataSource){

    viewer.dataSources.add(dataSource);

    const entities = dataSource.entities.values;

    for (let i = 0; i < entities.length; i++) {

        const entity = entities[i];

        if (entity.polygon) {

            entity.polygon.show = true;

            entity.polygon.fill = true;

            entity.polygon.material =
                Cesium.Color.fromCssColorString("red");

            entity.polygon.outline = true;

            entity.polygon.outlineColor =
                Cesium.Color.fromCssColorString("#b79b5b");

                entity.polygon.height = 0;
entity.polygon.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;

        }

    }

    viewer.scene.requestRender();

});
        


// ICELAND MARKER

viewer.entities.add({

    name: "Iceland",

    position: Cesium.Cartesian3.fromDegrees(
        -19.0,
        64.9
    ),

    point: {

        pixelSize: 25,

        color: Cesium.Color.fromCssColorString("#e07a3f"),

        outlineColor: Cesium.Color.BLACK,

        outlineWidth: 4

    }

});


// CAMERA VIEW FROM SPACE

viewer.camera.flyTo({

    destination: Cesium.Cartesian3.fromDegrees(
        -20,
        40,
        10000000
    ),

    duration: 3

});















