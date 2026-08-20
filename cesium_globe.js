


// --------------------------
// CESIUM VIEWER
// --------------------------

const viewer = new Cesium.Viewer("cesiumContainer", {

    animation: false,

    timeline: false,

    baseLayerPicker: false,

    geocoder: false,

    homeButton: false,

    sceneModePicker: false,

    navigationHelpButton: false,

    fullscreenButton: false,


    // remove Cesium UI

    selectionIndicator: false,

    infoBox: false


});
console.log("VIEWER CREATED");



// remove Cesium credit

viewer.cesiumWidget.creditContainer.style.display = "none";




// --------------------------
// PERFORMANCE
// --------------------------

viewer.scene.requestRenderMode = false;





// --------------------------
// REMOVE SATELLITE IMAGERY
// --------------------------

viewer.imageryLayers.removeAll();




// --------------------------
// DARK SPACE STYLE
// --------------------------


// black background

viewer.scene.backgroundColor =
    Cesium.Color.BLACK;



// dark globe

viewer.scene.globe.baseColor =
    Cesium.Color.fromCssColorString("#101010");

viewer.scene.globe.show = true;

viewer.scene.globe.baseColor =
    Cesium.Color.BLACK;

// remove blue atmosphere

viewer.scene.skyAtmosphere.show = false;

viewer.scene.globe.showGroundAtmosphere = false;

viewer.scene.fog.enabled = false;



// remove lighting changes

viewer.scene.globe.enableLighting = false;











// --------------------------
// CONTINENTS
// --------------------------

let continentLayer = null;

Cesium.GeoJsonDataSource.load(
    "data/continents.json"
)
.then(function(dataSource){

    continentLayer = dataSource;

    viewer.dataSources.add(continentLayer);

    const entities =
        continentLayer.entities.values;


    for(let i = 0; i < entities.length; i++){

        const entity = entities[i];


        if(entity.polygon){

            entity.polygon.material =
                Cesium.Color.fromCssColorString("#000000");


            entity.polygon.fill = false;


            entity.polygon.outline = true;


            entity.polygon.outlineColor =
                Cesium.Color.fromCssColorString(
                    "#b79b5b"
                );

        }

    }


    continentLayer.show = true;

    viewer.scene.requestRender();

});



// ---------------------
// MOUNTAIN RANGES
// ---------------------

let mountainLayer = null;
let activeMountainLabel = null;
let mountainLabelLayer = null;

mountainLabelLayer =
new Cesium.CustomDataSource("mountain labels");


viewer.dataSources.add(mountainLabelLayer);



Cesium.GeoJsonDataSource.load(
    "data/mountains.geojson"
)

.then(function(dataSource){


    mountainLayer = dataSource;


    viewer.dataSources.add(mountainLayer);


    mountainLayer.show = false;
    mountainLabelLayer.show = false;



    const entities =
        mountainLayer.entities.values;



    for(let i = 0; i < entities.length; i++){


        const entity = entities[i];



        if(entity.polygon){


            entity.polygon.material =
                Cesium.Color.fromCssColorString("#D97832")
                .withAlpha(0.5);



            entity.polygon.outline = true;


            entity.polygon.outlineColor =
                Cesium.Color.fromCssColorString("#b79b5b")
                .withAlpha(1);



            entity.polygon.height =
                undefined;


            entity.polygon.heightReference =
                Cesium.HeightReference.NONE;


        }



        
// Mountain range information label
if(entity.properties){

    const lon =
        entity.properties.labellon.getValue();

    const lat =
        entity.properties.labellat.getValue();


    entity.position =
        Cesium.Cartesian3.fromDegrees(
            lon,
            lat,
            15000
        );



};

entity.mountainData = {

    name:
    entity.properties.name.getValue(),

    highestPeak:
    entity.properties["highest peak"].getValue(),

    country:
    entity.properties["highest peak country"].getValue()

};

entity.clickLabel = new Cesium.LabelGraphics({

    text: "",

    font:
        "500 14px Inter",

    fillColor:
        Cesium.Color.fromCssColorString("#d7c7a0"),

    outlineColor:
        Cesium.Color.BLACK,

    outlineWidth:
        3,

    style:
        Cesium.LabelStyle.FILL_AND_OUTLINE,

    showBackground:
        true,

    backgroundColor:
        Cesium.Color.BLACK.withAlpha(0.65),

    pixelOffset:
        new Cesium.Cartesian2(0,-25),

    disableDepthTestDistance:
        0,

    show:
        false

});

entity.label = new Cesium.LabelGraphics({

    text:
        entity.properties.name.getValue(),

    font:
        "500 13px Inter",

    fillColor:
        Cesium.Color.fromCssColorString("#d7c7a0"),

    outlineColor:
        Cesium.Color.BLACK,

    outlineWidth:
        2,

    style:
        Cesium.LabelStyle.FILL_AND_OUTLINE,

    showBackground:
        true,

    backgroundColor:
        Cesium.Color.BLACK.withAlpha(0.5),

    pixelOffset:
        new Cesium.Cartesian2(0,-10),

    disableDepthTestDistance:
        0,

    show:
        false

});

    }

    viewer.scene.requestRender();

});





// ---------------------
    



// ---------------------
// PLATE BOUNDARIES
// ---------------------

let plateLayer = null;


Cesium.GeoJsonDataSource.load(
    "data/plate_boundaries.json"
)

.then(function(dataSource){


    plateLayer = dataSource;


    viewer.dataSources.add(plateLayer);



    plateLayer.show = false;



    const entities =
        plateLayer.entities.values;



    for(let i = 0; i < entities.length; i++){


        const entity = entities[i];


        if(entity.polyline){


            entity.polyline.width = 1.6;


            entity.polyline.clampToGround = false;



            entity.polyline.material =
                new Cesium.PolylineGlowMaterialProperty({

                    glowPower:0.12,

                    taperPower:0.6,

                    color:
                    Cesium.Color.fromCssColorString(
                        "#b84747"
                    )

                });


        }


    }


    viewer.scene.requestRender();


});




// ---------------------
// GLACIERS 
// ---------------------

Cesium.GeoJsonDataSource.load(
    "data/glaaaaacier.geojson"
    
)

.then(function(dataSource){

    glacierLayer = dataSource;

    viewer.dataSources.add(glacierLayer);

    glacierLayer.show = false;


    const entities =
        glacierLayer.entities.values;


    for(let i = 0; i < entities.length; i++){

        const entity = entities[i];


        if(entity.polygon){

            entity.polygon.material =
                Cesium.Color.fromCssColorString("#bfe8ff")
                .withAlpha(0.45);


            entity.polygon.outline = Cesium.Color.fromCssColorString("#bfe8ff")
                .withAlpha(1);;


            entity.polygon.outlineColor =
                Cesium.Color.WHITE;

        }

    }


    viewer.scene.requestRender();

});





// ---------------------
// VOLCANO LAYER
// ---------------------

let volcanoLayer =
new Cesium.CustomDataSource(
    "volcanoes"
);



viewer.dataSources.add(
    volcanoLayer
);



fetch(
    "data/volcanoes.json"

)

.then(res=>res.json())

.then(volcanoes=>{




    volcanoes.forEach(volcano=>{


        let icon =

        "images/volcano-dormant.svg";




        if(volcano.status==="active")
            icon="images/volcano-active.svg";




        if(volcano.status==="extinct")


            icon="images/volcano-extinct.svg";




            volcanoLayer.entities.add({






                name: volcano.name,





                volcanoData: volcano,


            position:


            Cesium.Cartesian3.fromDegrees(


                volcano.lon,


                volcano.lat,


                50000


            ),



    
            billboard:{


                image:icon,


                width:45,


                height:45,


                verticalOrigin:

                Cesium.VerticalOrigin.BOTTOM,


            

                disableDepthTestDistance:
1000000


            }


        });


    });



    viewer.scene.requestRender();


});





// ---------------------
// FINAL LAYER ORDER
// ---------------------

setTimeout(()=>{


    if(continentLayer){

        viewer.dataSources.lowerToBottom(
            continentLayer
        );

    }



    if(mountainLayer){

        viewer.dataSources.raiseToTop(
            mountainLayer
        );

    }

    if(mountainLabelLayer){

    viewer.dataSources.raiseToTop(
        mountainLabelLayer
    );

}



    if(plateLayer){

        viewer.dataSources.raiseToTop(
            plateLayer
        );

    }



    if(volcanoLayer){

        viewer.dataSources.raiseToTop(
            volcanoLayer
        );

    }



    viewer.scene.requestRender();


},2000);

// ---------------------
// LAYER BUTTONS
// ---------------------

document.querySelectorAll(".layer-item")
.forEach(button => {

    button.addEventListener("click", () => {

        const layer = button.dataset.layer;


        // Volcanoes
        if(layer === "volcanoes"){

            volcanoLayer.show =
                !volcanoLayer.show;

            button.classList.toggle("active");

        }

        // Glaciers

        
        if(layer === "glaciers"){

            glacierLayer.show =
                !glacierLayer.show;

                button.classList.toggle("active");

        }


        // Plate boundaries
        if(layer === "plates" && plateLayer){

            plateLayer.show =
                !plateLayer.show;

            button.classList.toggle("active");

        }


        // Mountain ranges
        if(layer === "mountains" && mountainLayer){

            mountainLayer.show =
                !mountainLayer.show;


            // hide popup labels when layer turns off

            if(!mountainLayer.show){

                mountainLabelLayer.entities.removeAll();

                mountainLabelLayer.show = false;

            }


            button.classList.toggle("active");

        }


        viewer.scene.requestRender();

    });

});











// ---------------------
// CLICK OBJECTS
// ---------------------

const handler =
new Cesium.ScreenSpaceEventHandler(
    viewer.scene.canvas
);


handler.setInputAction(function(click){


const picked =
viewer.scene.pick(click.position);



if(!Cesium.defined(picked))
return;



// ---------------------
// MOUNTAIN CLICK
// ---------------------
if(
    picked.id &&
    picked.id.mountainData
){

    // remove old label
    mountainLabelLayer.entities.removeAll();


    const mountain =
        picked.id.mountainData;


    mountainLabelLayer.entities.add({

        position:
        picked.id.position.getValue(),

        label: {

            text:
            mountain.name +
            "\nHighest peak: " +
            mountain.highestPeak +
            "\nCountry: " +
            mountain.country,


            font:
            "500 12px Inter",


            fillColor:
            Cesium.Color.fromCssColorString("#d7c7a0"),


            outlineColor:
            Cesium.Color.BLACK,


            outlineWidth:2,


            style:
            Cesium.LabelStyle.FILL_AND_OUTLINE,


            showBackground:true,


            backgroundColor:
            Cesium.Color.BLACK.withAlpha(0.55),


            disableDepthTestDistance:0

        }

    });


    mountainLabelLayer.show = true;

    return;

}


// ---------------------
// VOLCANO CLICK
// ---------------------

if(
    !picked.id ||
    !picked.id.volcanoData
)
return;



const volcano =
picked.id.volcanoData;



viewer.camera.flyTo({

    destination:
    Cesium.Cartesian3.fromDegrees(

        volcano.lon,

        volcano.lat,

        5000000

    ),

    duration:2

});



const panel =
document.getElementById(
    "volcanoInfo"
);


panel.style.display="block";


setTimeout(()=>{

    panel.classList.add("open");

},10);



document.querySelector(".info-image").src =
volcano.image;


document.querySelector(".info-status").textContent =
volcano.status.toUpperCase();


document.querySelector(".info-name").textContent =
volcano.name;


document.querySelector(".info-location").textContent =
volcano.country;


document.querySelector(".info-type").textContent =
volcano.type;


document.querySelector(".info-description").textContent =
volcano.description;


document.getElementById("articleLink").href =
volcano.article;



viewer.scene.requestRender();



},
Cesium.ScreenSpaceEventType.LEFT_CLICK);



// initial view

viewer.camera.flyTo({

destination:
Cesium.Cartesian3.fromDegrees(
-20,
40,
27000000
),

duration:3

});



//close panel

document.getElementById("closePanel")
.addEventListener("click", ()=>{

    const panel =
    document.getElementById("volcanoInfo");

    panel.classList.remove("open");

    setTimeout(()=>{

        panel.style.display="none";

    },400);

});

document.addEventListener("keydown", function(event){

    if(event.key.toLowerCase() === "r"){

        viewer.camera.flyTo({

            destination: Cesium.Cartesian3.fromDegrees(
                0,
                0,
                25000000
            ),

            orientation: {
                heading: 0,
                pitch: Cesium.Math.toRadians(-90),
                roll: 0
            },

            duration: 2

        });



    }

});

function resetViewer(){

    viewer.camera.flyTo({

        destination:
        Cesium.Cartesian3.fromDegrees(
            -20,
            40,
            27000000
        ),

        orientation:{
            heading:0,
            pitch:Cesium.Math.toRadians(-90),
            roll:0
        },

        duration:3

    });

}


document
.getElementById("resetViewButton")
.addEventListener("click", ()=>{

    resetViewer();

});