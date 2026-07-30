


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

Cesium.GeoJsonDataSource.load(
    "data/continents.json"
)
.then(function(dataSource){


    viewer.dataSources.add(dataSource);


    const entities =
        dataSource.entities.values;


    for (let i = 0; i < entities.length; i++) {


        const entity = entities[i];


       if(entity.polygon){


    entity.polygon.material =
        Cesium.Color.TRANSPARENT;


    entity.polygon.fill = true;


    entity.polygon.outline = true;


    entity.polygon.outlineColor =
        Cesium.Color.fromCssColorString(
            "#b79b5b"
        );


}


    }


    viewer.scene.requestRender();


});

    







// ---------------------
// VOLCANO LAYER
// ---------------------

let volcanoLayer =
new Cesium.CustomDataSource("volcanoes");



viewer.dataSources.add(volcanoLayer);



fetch("data/volcanoes.json")

.then(res=>res.json())

.then(volcanoes=>{


volcanoes.forEach(volcano=>{


let icon =
"images/volcano-dormant.svg";


if(volcano.status==="active")
icon="images/volcano-active.svg";


if(volcano.status==="extinct")
icon="images/volcano-extinct.svg";



const entity =
volcanoLayer.entities.add({


name: volcano.name,


volcanoData: volcano,


position:
Cesium.Cartesian3.fromDegrees(

volcano.lon,

volcano.lat,

10000

),



billboard:{


image:icon,

width:45,

height:45,

verticalOrigin:
Cesium.VerticalOrigin.BOTTOM


}



});


});


});

console.log("VOLCANOES LOADED");




// ---------------------
// LAYER BUTTON
// ---------------------

document.querySelectorAll(".layer-item")
.forEach(button=>{


button.addEventListener("click",()=>{


const layer =
button.dataset.layer;


if(layer==="volcanoes"){


volcanoLayer.show =
!volcanoLayer.show;


button.classList.toggle("active");


viewer.scene.requestRender();


}


});


});




// ---------------------
// CLICK VOLCANO
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



if(!picked.id || !picked.id.volcanoData)
return;



const volcano =
picked.id.volcanoData;



// fly there

viewer.camera.flyTo({

destination:
Cesium.Cartesian3.fromDegrees(

volcano.lon,

volcano.lat,

5000000

),

duration:2

});



// open panel


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

