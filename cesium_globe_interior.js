// =====================================================================
//  GEOSCI INTERACTIVE GLOBE  (Cesium)
//  Drop-in replacement for your existing script. Your HTML ids/classes are
//  unchanged: #cesiumContainer, .layer-item[data-layer], #volcanoInfo,
//  #closePanel, #articleLink, #resetViewButton, .info-* elements.
//  All new UI is created from this file, so you don't need to edit your HTML.
// =====================================================================

// --------------------------
// VIEWER
// --------------------------
const viewer = new Cesium.Viewer("cesiumContainer", {
    animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false,
    fullscreenButton: false, selectionIndicator: false, infoBox: false,
    baseLayer: false                       // ignored by older Cesium versions
});

viewer.cesiumWidget.creditContainer.style.display = "none";
viewer.scene.requestRenderMode = false;    // needed for pulsing quakes + idle spin
viewer.imageryLayers.removeAll();

// full-page container (footer removed): make the globe fill the window
document.head.appendChild(Object.assign(document.createElement("style"), { textContent:
    "html,body{margin:0;height:100%;overflow:hidden;background:#000}#cesiumContainer{position:fixed!important;inset:0;width:100%!important;height:100%!important;z-index:0}.cesium-viewer-bottom{display:none!important}" }));

const scene = viewer.scene, globe = scene.globe;
scene.backgroundColor = Cesium.Color.BLACK;
globe.baseColor = Cesium.Color.BLACK;
globe.enableLighting = false;
globe.showGroundAtmosphere = false;
globe.depthTestAgainstTerrain = false;
scene.skyAtmosphere.show = false;
scene.fog.enabled = false;
const camCtl = scene.screenSpaceCameraController;
camCtl.minimumZoomDistance = 300000;
camCtl.maximumZoomDistance = 6.0e7;
camCtl.enableTilt = false;     // always look straight at the centre of the globe
camCtl.enableLook = false;

const NOW = () => viewer.clock.currentTime;
const HOME = { lon: -20, lat: 40, height: 27000000 };
const GOLD = "#b79b5b";

// faint adaptive lat/long grid so the dark globe doesn't feel empty
let gridLayer = viewer.imageryLayers.addImageryProvider(new Cesium.GridImageryProvider({
    cells: 2,
    color: Cesium.Color.fromCssColorString(GOLD).withAlpha(0.10),
    glowColor: Cesium.Color.fromCssColorString(GOLD).withAlpha(0.0),
    backgroundColor: Cesium.Color.TRANSPARENT
}));

// --------------------------
// SMALL HELPERS
// --------------------------
const $ = (s, r = document) => r.querySelector(s);
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const loadGeo = url => Cesium.GeoJsonDataSource.load(url).catch(e => { console.warn("Could not load", url, e); return null; });
const state = { dragging: false, flying: false, touring: false, lastInput: performance.now(), spin: true };

// every flight ends looking straight down, so the centre of the globe stays in the middle of the screen
function flyTo(lon, lat, height, duration = 2.5) {
    viewer.camera.cancelFlight(); state.flying = true;
    viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, height),
        orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
        duration, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => { state.flying = false; }, cancel: () => { state.flying = false; }
    });
}
function flyToCartesian(pos, height, duration) {
    const c = Cesium.Cartographic.fromCartesian(pos);
    flyTo(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude), height, duration);
}
function resetViewer() { flyTo(HOME.lon, HOME.lat, HOME.height, 3); }

// --------------------------
// LOADING OVERLAY + TOAST
// --------------------------
const style = el("style", "", `
:root{--gx-gold:#b79b5b;--gx-bg:rgba(10,14,13,.72);--gx-line:rgba(255,255,255,.09)}
.gx-dock{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);display:flex;gap:2px;padding:5px;background:var(--gx-bg);border:1px solid var(--gx-line);border-radius:14px;backdrop-filter:blur(14px) saturate(1.2);z-index:50;font:500 12px Inter,system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.45);opacity:0;transition:opacity .8s .6s}
.gx-dock.ready{opacity:1}
.gx-dock button{display:flex;align-items:center;gap:7px;font:500 12px Inter,sans-serif;color:rgba(241,236,222,.78);background:transparent;border:0;padding:9px 13px;border-radius:10px;cursor:pointer;transition:background .2s,color .2s}
.gx-dock button svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.gx-dock button:hover{background:rgba(255,255,255,.07);color:#fff}
.gx-dock button.on{background:rgba(183,155,91,.2);color:#e6d3a1}
.gx-dock .sep{width:1px;background:var(--gx-line);margin:6px 3px}
@media(max-width:760px){.gx-dock button span{display:none}.gx-dock button{padding:10px}}
.gx-pop,.gx-card,.gx-search{position:fixed;left:50%;bottom:76px;transform:translateX(-50%);width:min(360px,92vw);background:rgba(10,14,13,.86);border:1px solid var(--gx-line);border-radius:14px;color:#ece7d8;z-index:50;font:13px/1.55 Inter,system-ui,sans-serif;backdrop-filter:blur(16px) saturate(1.2);box-shadow:0 18px 50px rgba(0,0,0,.5)}
.gx-pop{padding:16px 18px;display:none;left:auto;right:24px;top:50%;bottom:auto;transform:translateY(-50%);width:min(360px,calc(100vw - 48px));box-sizing:border-box}.gx-pop.open{display:block}
.gx-pop-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--gx-line)}
.gx-pop-head h4{margin:0;line-height:1.4}
.gx-close{flex:0 0 auto;appearance:none;border:1px solid rgba(183,155,91,.42);border-radius:8px;background:rgba(183,155,91,.12);color:#e6d3a1;padding:7px 10px;font:600 11px Inter,system-ui,sans-serif;letter-spacing:.02em;cursor:pointer;transition:background .18s,border-color .18s,color .18s}
.gx-close:hover{background:rgba(183,155,91,.25);border-color:rgba(183,155,91,.7);color:#fff3d2}
.gx-close:focus-visible{outline:2px solid #d6bd7b;outline-offset:3px}
@media(max-width:760px){.gx-pop{right:12px;width:min(360px,calc(100vw - 24px));max-height:72vh;overflow-y:auto}}
.gx-pop h4{margin:0 0 10px;font:600 10px Inter;letter-spacing:.16em;text-transform:uppercase;color:var(--gx-gold)}
.gx-seg{display:flex;gap:2px;margin:8px 0 12px;padding:3px;background:rgba(255,255,255,.05);border-radius:9px}
.gx-seg button{flex:1;font:500 12px Inter;color:rgba(241,236,222,.7);background:transparent;border:0;padding:.5em;border-radius:7px;cursor:pointer}
.gx-seg button.on{background:rgba(183,155,91,.25);color:#f0e2bb}
.gx-pop label{display:block;font-size:12px;color:rgba(241,236,222,.75)}
.gx-pop input[type=range]{width:100%;accent-color:var(--gx-gold);margin-top:4px}
.gx-legend{display:flex;flex-wrap:wrap;gap:4px 11px;margin-top:10px;font-size:11px;color:rgba(241,236,222,.65)}
.gx-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px}
.gx-stats{margin-top:12px;padding-top:11px;border-top:1px solid var(--gx-line);font-size:12px;color:rgba(241,236,222,.85)}
.gx-card{width:min(500px,92vw);padding:18px 22px;display:none}.gx-card.open{display:block}
.gx-card h3{margin:0 0 6px;font:700 19px Inter;letter-spacing:-.3px}
.gx-card .eb{font:600 10px Inter;letter-spacing:.16em;text-transform:uppercase;color:var(--gx-gold);margin-bottom:5px}
.gx-card .nav{display:flex;gap:6px;margin-top:14px;align-items:center}
.gx-card .nav button{font:500 12px Inter;color:#e6d3a1;background:rgba(183,155,91,.14);border:0;padding:.55em 1.1em;border-radius:8px;cursor:pointer}
.gx-card .nav button:hover{background:rgba(183,155,91,.28)}.gx-card .nav button[disabled]{opacity:.35;cursor:default}
.gx-card .nav span{margin-left:auto;font-size:12px;color:rgba(241,236,222,.5)}
.gx-search{display:none;background:transparent;border:0;box-shadow:none;backdrop-filter:none}.gx-search.open{display:block}
.gx-search input{width:100%;box-sizing:border-box;padding:.9em 1.1em;background:rgba(10,14,13,.9);border:1px solid var(--gx-line);color:#f1f1e8;font:14px Inter,sans-serif;border-radius:12px;outline:none;backdrop-filter:blur(14px)}
.gx-search input:focus{border-color:rgba(183,155,91,.6)}
.gx-search ul{list-style:none;margin:5px 0 0;padding:4px;background:rgba(10,14,13,.92);border:1px solid var(--gx-line);border-radius:12px;max-height:220px;overflow:auto}
.gx-search ul:empty{display:none}
.gx-search li{padding:.55em .8em;color:#e8e4d6;cursor:pointer;font:13px Inter;display:flex;justify-content:space-between;border-radius:8px}
.gx-search li:hover{background:rgba(183,155,91,.16)}
.gx-search li small{color:var(--gx-gold);text-transform:uppercase;letter-spacing:.1em;font-size:10px}
.gx-tip{position:fixed;pointer-events:none;z-index:70;background:rgba(10,14,13,.9);border:1px solid var(--gx-line);color:#f1f1e8;padding:5px 10px;font:12px Inter,sans-serif;border-radius:8px;display:none;white-space:nowrap;backdrop-filter:blur(8px)}
.gx-load{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#050807;color:var(--gx-gold);font:500 11px Inter;letter-spacing:.3em;text-transform:uppercase;z-index:100;transition:opacity .8s}
.gx-toast{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:rgba(10,14,13,.9);border:1px solid var(--gx-line);color:#f1f1e8;padding:8px 16px;font:13px Inter;z-index:80;border-radius:10px;display:none;backdrop-filter:blur(10px)}
`);
document.head.appendChild(style);
const loadingEl = el("div", "gx-load", "Loading the Earth…"); document.body.appendChild(loadingEl);
const toastEl = el("div", "gx-toast"); document.body.appendChild(toastEl);
function toast(msg, ms = 3500) { toastEl.textContent = msg; toastEl.style.display = "block"; clearTimeout(toast.t); toast.t = setTimeout(() => toastEl.style.display = "none", ms); }
const tipEl = el("div", "gx-tip"); document.body.appendChild(tipEl);

// --------------------------
// DATA LAYERS (kept from your version, with fixes)
// --------------------------
let continentLayer = null, mountainLayer = null, plateLayer = null, glacierLayer = null, seaIceLayer = null;
const mountainLabelLayer = new Cesium.CustomDataSource("mountain labels");
const highlightLayer = new Cesium.CustomDataSource("highlights");
viewer.dataSources.add(highlightLayer);
const volcanoLayer = new Cesium.CustomDataSource("volcanoes");
viewer.dataSources.add(mountainLabelLayer);
viewer.dataSources.add(volcanoLayer);
mountainLabelLayer.show = false;
const searchIndex = [];

// cluster volcano icons so dense regions stay readable
volcanoLayer.clustering = new Cesium.EntityCluster({ enabled: true, pixelRange: 1, minimumClusterSize: 5 });
function clusterIcon(n) {
    const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
    x.fillStyle = "rgba(8,12,11,.9)"; x.beginPath(); x.arc(32, 32, 28, 0, 6.283); x.fill();
    x.strokeStyle = GOLD; x.lineWidth = 3; x.stroke();
    x.fillStyle = "#d7c7a0"; x.font = "700 22px Inter, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(n, 32, 33);
    return c.toDataURL();
}
volcanoLayer.clustering.clusterEvent.addEventListener((ents, cluster) => {
    cluster.label.show = false; cluster.point.show = false; cluster.billboard.show = true;
    cluster.billboard.image = clusterIcon(ents.length); cluster.billboard.width = cluster.billboard.height = 42;
    cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
    cluster.billboard.disableDepthTestDistance = 1000000;
});

const pContinents = loadGeo("data/continents.json").then(ds => {
    if (!ds) return; continentLayer = ds; viewer.dataSources.add(ds);
    ds.entities.values.forEach(e => {
        if (e.polygon) {
            e.polygon.material = Cesium.Color.BLACK; e.polygon.fill = false;
            e.polygon.outline = true; e.polygon.outlineColor = Cesium.Color.fromCssColorString(GOLD);
        }
    });
});

const MOUNTAIN_FILL = Cesium.Color.fromCssColorString("#79431d"), MOUNTAIN_EDGE = Cesium.Color.fromCssColorString("#585448"), MOUNTAIN_HOT = Cesium.Color.fromCssColorString("#f0c070");
const pMountains = loadGeo("data/mountains.geojson").then(ds => {
    if (!ds) return; mountainLayer = ds; viewer.dataSources.add(ds); ds.show = false;
    ds.entities.values.forEach(e => {
        if (e.polygon) {                                     // (was `entity.any`, which never matched)
            e.polygon.material = MOUNTAIN_FILL; e.polygon.outline = true; e.polygon.outlineColor = MOUNTAIN_EDGE;
            e.polygon.height = undefined; e.polygon.heightReference = Cesium.HeightReference.NONE;
            // pre-built glowing outline, only ever toggled with `show` on hover (cheap, no geometry rebuilds)
            try {
                const h = e.polygon.hierarchy.getValue(NOW());
                if (h && h.positions && h.positions.length > 2) {
                    e.hl = highlightLayer.entities.add({ show: false, polyline: { positions: h.positions.concat([h.positions[0]]), width: 3.5, material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.3, color: MOUNTAIN_HOT }) } });
                }
            } catch (err) { /* ignore odd geometries */ }
        }
        if (!e.properties) return;
        const p = e.properties, g = k => (p[k] ? p[k].getValue() : undefined);
        const lon = g("labellon"), lat = g("labellat");
        if (lon != null && lat != null) e.position = Cesium.Cartesian3.fromDegrees(lon, lat, 15000);
        e.mountainData = { name: g("name"), highestPeak: g("highest peak"), country: g("highest peak country") };
        if (e.mountainData.name && lon != null) searchIndex.push({ name: e.mountainData.name, type: "Mountains", lon, lat, range: 2500000 });
    });
});

const PLATE_COLORS = { convergent: "#d95555", divergent: "#3fc6b5", transform: "#e0b84a", other: "#b84747" };
const pPlates = loadGeo("data/plate_boundaries.json").then(ds => {
    if (!ds) return; plateLayer = ds; viewer.dataSources.add(ds); ds.show = false;
    ds.entities.values.forEach(e => {
        if (!e.polyline) return;
        let t = ""; if (e.properties) { const k = ["Type", "type", "TYPE", "BOUNDARY", "boundary"].find(x => e.properties[x]); if (k) t = String(e.properties[k].getValue()).toLowerCase(); }
        const cls = /converg|subduct|collision/.test(t) ? "convergent" : /diverg|ridge|rift|spread/.test(t) ? "divergent" : /transform|strike/.test(t) ? "transform" : "other";
        e.polyline.width = 1.8; e.polyline.clampToGround = false;
        e.polyline.material = new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.12, taperPower: 0.6, color: Cesium.Color.fromCssColorString(PLATE_COLORS[cls]) });
    });
});

const ICE_FILL = Cesium.Color.fromCssColorString("#c3e6ff"), ICE_EDGE = Cesium.Color.fromCssColorString("#cdeeff00");
const pGlaciers = loadGeo("data/glaciers.json").then(ds => {
    if (!ds) return; glacierLayer = ds; viewer.dataSources.add(ds); ds.show = false;
    ds.entities.values.forEach(e => { if (e.polygon) { e.polygon.material = ICE_FILL; e.polygon.outline = true; e.polygon.outlineColor = ICE_EDGE; } });
});
const pSeaIce = loadGeo("data/sea_ice.json").then(ds => {
    if (!ds) return; seaIceLayer = ds; viewer.dataSources.add(ds); ds.show = false;
    ds.entities.values.forEach(e => { if (e.polygon) { e.polygon.material = Cesium.Color.fromCssColorString("#bfe5fe98"); e.polygon.outline = false; } });
});

const pVolcanoes = fetch("data/volcanoes.json").then(r => r.json()).then(list => {
    list.forEach(v => {
        const icon = v.status === "active" ? "images/volcano-active.svg" : v.status === "extinct" ? "images/volcano-extinct.svg" : "images/volcano-dormant.svg";
        const e = volcanoLayer.entities.add({
            name: v.name, position: Cesium.Cartesian3.fromDegrees(v.lon, v.lat, 50000),
            billboard: {
                image: icon, width: 45, height: 45, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, disableDepthTestDistance: 1000000,
                scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.0, 2.5e7, 0.55)
            }
        });
        e.volcanoData = v;                                   // assign after creation: Entity options ignore unknown keys
        searchIndex.push({ name: v.name, type: "Volcano", lon: v.lon, lat: v.lat, range: 1800000 });
    });
}).catch(e => console.warn("volcanoes failed", e));

// layer order once everything has loaded (instead of a 2 s timer)
Promise.all([pContinents, pMountains, pPlates, pGlaciers, pSeaIce, pVolcanoes]).then(() => {
    if (continentLayer) viewer.dataSources.lowerToBottom(continentLayer);
    [mountainLayer, mountainLabelLayer, plateLayer, volcanoLayer, quakeLayer].forEach(l => l && viewer.dataSources.raiseToTop(l));
    loadingEl.style.opacity = 0; setTimeout(() => loadingEl.remove(), 900);
});

// --------------------------
// LAYER TOGGLES (works for your existing buttons AND the new dock)
// --------------------------
const layerBtns = () => document.querySelectorAll(".layer-item");
function layerOn(name) {
    switch (name) {
        case "volcanoes": return volcanoLayer.show;
        case "glaciers": return glacierLayer && glacierLayer.show;
        case "plates": return plateLayer && plateLayer.show;
        case "mountains": return mountainLayer && mountainLayer.show;
        case "quakes": return quakes.visible;
    } return false;
}
function setLayer(name, on) {
    if (intOn && on) { toast("Map layers are unavailable in Earth Interior mode."); return; }
    if (name === "volcanoes") {
    volcanoLayer.show = on;

    if (!on) {
        const panel = document.getElementById("volcanoInfo");
        if (panel) {
            panel.classList.remove("open");
            panel.style.display = "none";
        }
    }
}
    if (name === "glaciers") { if (glacierLayer) glacierLayer.show = on; if (seaIceLayer) seaIceLayer.show = on; }
    if (name === "plates" && plateLayer) plateLayer.show = on;
    if (name === "mountains" && mountainLayer) { mountainLayer.show = on; if (!on) { mountainLabelLayer.entities.removeAll(); mountainLabelLayer.show = false; setHover(null); } }
    if (name === "quakes") { setQuakes(on); quakes.popupOpen = !!on; }
    layerBtns().forEach(b => { if (b.dataset.layer === name) b.classList.toggle("active", !!on); });
    syncDock();
}
layerBtns().forEach(b => b.addEventListener("click", () => { if (intOn) { toast("Map layers are locked while Earth Interior is open."); return; } setLayer(b.dataset.layer, !layerOn(b.dataset.layer)); }));

// --------------------------
// LIVE EARTHQUAKES (USGS) + EARTH INTERIOR MODE
// --------------------------
const quakes = { visible: false, popupOpen: false, data: [], range: "day", minMag: 2.5, recent: [], timer: null, loading: false };
const quakeLayer = new Cesium.CustomDataSource("earthquakes"); viewer.dataSources.add(quakeLayer); quakeLayer.show = false;
const FEEDS = { day: "all_day", week: "2.5_week", month: "2.5_month" };
const SURF_H = 30000;                                                     // draw quakes 30 km up so they never z-fight with the globe
const DEPTH_STOPS = [[35, "#ff5a3c", "0–35 km"], [70, "#ff9a3c", "35–70"], [150, "#ffd23c", "70–150"], [300, "#7be07b", "150–300"], [500, "#3cb4ff", "300–500"], [9999, "#a06cff", "500+ km"]];
const depthColor = d => Cesium.Color.fromCssColorString((DEPTH_STOPS.find(s => d < s[0]) || DEPTH_STOPS[5])[1]);
const quakeSize = m => Math.max(5, Math.pow(Math.max(m, 0), 1.9) * 0.6);
const qPos = q => Cesium.Cartesian3.fromDegrees(q.lon, q.lat, SURF_H);
const setStatus = t => { const n = document.getElementById("gxstatus"); if (n) n.textContent = t; console.info("[quakes]", t); };

// Interactive Earth-interior canvas mode. The illustration is schematic, not a 3D geological model.
const LAYERS = [
    { name: "Crust", depth: "5–70 km", thickness: "5–70 km", temp: "up to ~1,000°C", desc: "The thin, solid outer shell. Oceanic crust is generally thinner; continental crust can be much thicker.", color: "#83b9ae", outer: 1.00, inner: .985 },
    { name: "Upper mantle", depth: "to ~660 km", thickness: "to 660 km", temp: "~500–1,600°C", desc: "Hot, mostly solid silicate rock that can deform and flow slowly over geological time.", color: "#d67c4c", outer: .985, inner: .72 },
    { name: "Transition zone", depth: "410–660 km", thickness: "250 km", temp: "~1,400–1,900°C", desc: "A mantle region where pressure changes the crystal structure of minerals.", color: "#bd6545", outer: .72, inner: .62 },
    { name: "Lower mantle", depth: "660–2,900 km", thickness: "~2,240 km", temp: "~1,900–3,700°C", desc: "Dense, high-pressure rock extending toward the core–mantle boundary.", color: "#a94e3b", outer: .62, inner: .35 },
    { name: "Outer core", depth: "2,900–5,150 km", thickness: "~2,260 km", temp: "~4,000–5,500°C", desc: "A liquid iron–nickel-rich layer. Its moving metal helps generate Earth's magnetic field.", color: "#e2a23d", outer: .35, inner: .19 },
    { name: "Inner core", depth: "5,150–6,371 km", thickness: "~1,220 km radius", temp: "~5,000–6,000°C", desc: "A solid iron-rich centre, kept solid by the immense pressure despite its high temperature.", color: "#f2d67e", outer: .19, inner: 0 }
];
const LAYER_NAMES = ["volcanoes", "glaciers", "plates", "mountains", "quakes"];
let intOn = false, intSaved = null, intFrame = 0, intRAF = 0, intSelected = 0, intContinentRings = [];
const interiorOverlay = el("div", "gx-int", '<canvas aria-label="Interactive schematic Earth cross-section"></canvas><button type="button" class="gx-x" aria-label="Close Earth interior">×</button><div class="gx-intcard"></div>');
document.body.appendChild(interiorOverlay);
const intCanvas = interiorOverlay.querySelector("canvas"), intCtx = intCanvas.getContext("2d"), intCard = interiorOverlay.querySelector(".gx-intcard");
const interiorStyle = el("style", "", `
.gx-int{position:fixed;inset:0;z-index:90;display:none;overflow:hidden;background:transparent;color:#ece7d8;font:13px/1.5 Inter,system-ui,sans-serif;pointer-events:none}.gx-int.open{display:block}.gx-int canvas{display:none}.gx-x{position:absolute;top:20px;right:24px;z-index:2;width:42px;height:42px;border:1px solid rgba(255,255,255,.18);border-radius:12px;background:rgba(10,14,13,.9);color:#f0e2bb;font-size:27px;cursor:pointer;pointer-events:auto}.gx-intcard{position:absolute;right:24px;bottom:24px;width:min(320px,calc(100vw - 48px));max-height:42vh;overflow:auto;padding:18px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(10,14,13,.88);backdrop-filter:blur(14px);box-sizing:border-box;pointer-events:auto}.gx-intcard .eb{color:#b79b5b;font-size:10px;letter-spacing:.15em;text-transform:uppercase}.gx-intcard h3{margin:6px 0;font-size:20px}.gx-intcard p{color:rgba(241,236,222,.8);margin:8px 0}.gx-intcard dl{display:grid;grid-template-columns:90px 1fr;gap:7px;font-size:12px}.gx-intcard dt{color:#b79b5b}.gx-intcard dd{margin:0}.gx-int-nav{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:16px}.gx-int-nav button{appearance:none;border:1px solid rgba(183,155,91,.4);border-radius:9px;background:rgba(183,155,91,.13);color:#f0e2bb;padding:8px 10px;font:600 12px Inter,system-ui,sans-serif;cursor:pointer;transition:background .18s,border-color .18s}.gx-int-nav button:hover:not(:disabled){background:rgba(183,155,91,.28);border-color:rgba(183,155,91,.75)}.gx-int-nav button:disabled{opacity:.35;cursor:default}.gx-int-nav span{font-size:11px;opacity:.6;white-space:nowrap}.gx-intcard .hint{font-size:10px;opacity:.65;margin-top:12px}@media(max-width:860px){.gx-intcard{right:12px;bottom:12px;max-height:32vh;padding:12px}.gx-x{top:12px;right:12px}}
`);
document.head.appendChild(interiorStyle);
function setIntCard(i) {
    intSelected = Math.max(0, Math.min(LAYERS.length - 1, i));
    const l = LAYERS[intSelected];
    intCard.innerHTML = `<div class="eb">Earth structure · layer ${intSelected + 1} of ${LAYERS.length}</div><h3>${l.name}</h3><p>${l.desc}</p><dl><dt>Depth</dt><dd>${l.depth}</dd><dt>Thickness</dt><dd>${l.thickness}</dd><dt>Temperature</dt><dd>${l.temp}</dd></dl><div class="gx-int-nav"><button type="button" data-int-step="-1" ${intSelected === 0 ? "disabled" : ""} aria-label="Previous Earth layer">← Previous</button><span>${intSelected + 1} / ${LAYERS.length}</span><button type="button" data-int-step="1" ${intSelected === LAYERS.length - 1 ? "disabled" : ""} aria-label="Next Earth layer">Deeper →</button></div><p class="hint">Use the arrows to move through Earth's layers. Drag the globe to rotate and scroll to zoom.</p>`;
    intCard.querySelectorAll('[data-int-step]').forEach(button => button.addEventListener('click', () => {
        if (!intOn || button.disabled) return;
        setIntCard(intSelected + Number(button.dataset.intStep));
        updateInteriorLayerVisibility();
    }));
}
function resizeIntCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(1, interiorOverlay.clientWidth), h = Math.max(1, interiorOverlay.clientHeight);
    intCanvas.width = Math.round(w * dpr); intCanvas.height = Math.round(h * dpr); intCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawInt() {
    if (!intOn) return;
    const w = interiorOverlay.clientWidth, h = interiorOverlay.clientHeight;
    intCtx.clearRect(0, 0, w, h);
    const small = w < 700, cx = small ? w * .42 : w * .42, cy = h * .49, r = Math.min(w * (small ? .39 : .31), h * .39);
    // restrained stars / technical rings
    intCtx.save(); intCtx.strokeStyle = "rgba(183,155,91,.10)"; intCtx.lineWidth = 1;
    for (let rr = r * .45; rr < r * 2.5; rr += r * .28) { intCtx.beginPath(); intCtx.arc(cx, cy, rr, 0, Math.PI * 2); intCtx.stroke(); }
    intCtx.restore();
    // Draw each geological band as a full concentric circle, then reveal the right half as a cutaway.
    intCtx.save(); intCtx.beginPath(); intCtx.rect(cx - r, cy - r, r, r * 2); intCtx.clip();
    for (let i = 0; i < LAYERS.length; i++) {
        const layer = LAYERS[i], outerR = r * layer.outer, innerR = r * layer.inner;
        intCtx.beginPath(); intCtx.arc(cx, cy, outerR, 0, Math.PI * 2);
        intCtx.arc(cx, cy, Math.max(0, innerR), 0, Math.PI * 2, true);
        intCtx.closePath(); intCtx.fillStyle = layer.color; intCtx.globalAlpha = i === intSelected ? .98 : .78; intCtx.fill("evenodd");
        intCtx.globalAlpha = 1; intCtx.strokeStyle = i === intSelected ? "#f5e7bd" : "rgba(255,240,210,.28)"; intCtx.lineWidth = i === intSelected ? 2.4 : 1; intCtx.stroke();
    }
    intCtx.restore();
    // Cut face and outer outline
    intCtx.strokeStyle = "rgba(244,229,190,.8)"; intCtx.lineWidth = 1.5; intCtx.beginPath(); intCtx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2); intCtx.stroke();
    intCtx.beginPath(); intCtx.moveTo(cx, cy-r); intCtx.lineTo(cx, cy+r); intCtx.stroke();
    intCtx.fillStyle = "#ece7d8"; intCtx.font = "600 11px Inter,system-ui,sans-serif"; intCtx.fillText("EARTH INTERIOR · SCHEMATIC", 28, 34);
    intCtx.fillStyle = "rgba(236,231,216,.5)"; intCtx.font = "11px Inter,system-ui,sans-serif"; intCtx.fillText("Select a layer", 28, 52);
    // Leader labels on the right side of the section
    const labelX = Math.min(w - 190, cx + r + 26), labelY = Math.max(86, cy - r + 22), gap = Math.min(55, (h - labelY - 45) / LAYERS.length);
    LAYERS.forEach((l, i) => {
        const yy = labelY + i * gap, rr = r * ((l.outer + l.inner) / 2), xx = cx + Math.sqrt(Math.max(0, rr * rr - Math.min(rr * rr, (cy - yy) * (cy - yy))));
        intCtx.strokeStyle = i === intSelected ? l.color : "rgba(236,231,216,.28)"; intCtx.lineWidth = i === intSelected ? 1.8 : 1; intCtx.beginPath(); intCtx.moveTo(cx, yy); intCtx.lineTo(labelX - 10, yy); intCtx.stroke();
        intCtx.fillStyle = l.color; intCtx.beginPath(); intCtx.arc(labelX - 10, yy, 3, 0, Math.PI * 2); intCtx.fill();
        intCtx.fillStyle = i === intSelected ? "#f6e8c5" : "rgba(236,231,216,.76)"; intCtx.font = `${i === intSelected ? "600" : "400"} 12px Inter,system-ui,sans-serif`; intCtx.fillText(l.name, labelX, yy + 4);
    });
    intFrame += 1; intRAF = requestAnimationFrame(drawInt);
}
function intPointer(e) {
    const rect = intCanvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top, w = rect.width, h = rect.height;
    const cx = w * .42, cy = h * .49, r = Math.min(w * (w < 700 ? .39 : .31), h * .39), dist = Math.hypot(x-cx, y-cy);
    if (dist > r || x > cx) {
        // Clicking a layer label selects that named layer too.
        const labelX = Math.min(w - 190, cx + r + 26), labelY = Math.max(86, cy - r + 22), gap = Math.min(55, (h - labelY - 45) / LAYERS.length);
        if (x >= labelX - 30 && gap > 0) { const i = Math.round((y-labelY)/gap); if (i >= 0 && i < LAYERS.length) setIntCard(i); }
        return;
    }
    const frac = dist / r;
    // Radius bands are ordered from surface inward.
    let idx = LAYERS.findIndex(l => frac <= l.outer && frac >= l.inner);
    if (idx < 0) idx = frac > .985 ? 0 : frac > .72 ? 1 : frac > .62 ? 2 : frac > .35 ? 3 : frac > .19 ? 4 : 5;
    setIntCard(idx);
}
// 3D interior model: real Cesium ellipsoid entities, rendered in the same scene/camera
// as the globe. The geographic globe, imagery, grid, and map overlays are hidden while active.
const interiorSource = new Cesium.CustomDataSource("earth-interior-3d");
viewer.dataSources.add(interiorSource);
interiorSource.show = false;
const interiorEntities = [];
const EARTH_R = 6371000;

const intShells = [
    // Fill is authored directly as #RRGGBBAA. Parse each channel explicitly rather
    // than relying on Cesium's CSS parser to interpret 8-digit hex colours.
    {name:"Crust", radius:EARTH_R, fill:"#a4c1bbf6"},
    {name:"Upper mantle", radius:EARTH_R*.985, fill:"#1aa255cb"},
    {name:"Transition zone", radius:EARTH_R*.72, fill:"#bd65458c"},
    {name:"Lower mantle", radius:EARTH_R*.62, fill:"#a94e3bb8"},
    {name:"Outer core", radius:EARTH_R*.35, fill:"#e2a23ddf"},
    {name:"Inner core", radius:EARTH_R*.19, fill:"#f2d67eff"}
];
function intShellColor(shell) {
    const hex = shell.fill.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const a = (hex.length >= 8 ? parseInt(hex.slice(6, 8), 16) : 255) / 255;
    return new Cesium.Color(r, g, b, a);
}
function intOutlineColor(shell, alpha) {
    const c = intShellColor(shell);
    return new Cesium.Color(c.red, c.green, c.blue, alpha);
}
intShells.forEach((shell, i) => {
    const entity = interiorSource.entities.add({
        id: "gx-interior-layer-" + i,
        position: Cesium.Cartesian3.ZERO,
        ellipsoid: {
            radii: new Cesium.Cartesian3(shell.radius, shell.radius, shell.radius),
            material: new Cesium.ColorMaterialProperty(intShellColor(shell)),
            outline: true,
            outlineColor: intOutlineColor(shell, 0.82),
            subdivisions: 64, stackPartitions: 48, slicePartitions: 64
        }
    });
    entity.interiorLayerIndex = i;
    interiorEntities.push(entity);
});
// As you navigate deeper, hide shells already passed so the selected fill never
// gets washed out by overlapping outer ellipsoids. Remaining shells retain their
// individually authored #RRGGBBAA material colours.
function updateInteriorLayerVisibility() {
    interiorEntities.forEach((entity, idx) => {
        const shell = intShells[idx];
        entity.show = idx >= intSelected;
        if (!entity.ellipsoid) return;
        entity.ellipsoid.material = new Cesium.ColorMaterialProperty(intShellColor(shell));
        entity.ellipsoid.outline = true;
        entity.ellipsoid.outlineColor = intOutlineColor(shell, idx === intSelected ? 1 : 0.46);
    });
}
let intSavedScene = null;
function setInterior(on) {
    on = !!on;
    if (on === intOn) return;
    intOn = on;
    if (intOn) {
        intSaved = Object.fromEntries(LAYER_NAMES.map(n => [n, layerOn(n)]));
        // Save all visual state, then remove the map's surface and thematic layers.
        intSavedScene = {
            globeShow: globe.show,
            imagery: Array.from({length: viewer.imageryLayers.length}, (_, i) => ({layer: viewer.imageryLayers.get(i), show: viewer.imageryLayers.get(i).show})),
            sources: Array.from({length: viewer.dataSources.length}, (_, i) => ({source: viewer.dataSources.get(i), show: viewer.dataSources.get(i).show})),
            gridShow: gridLayer.show,
            camera: {destination: viewer.camera.positionWC.clone(), direction: viewer.camera.directionWC.clone(), up: viewer.camera.upWC.clone()}
        };
        LAYER_NAMES.forEach(n => setLayer(n, false));
        globe.show = false;
        for (let i=0; i<viewer.imageryLayers.length; i++) viewer.imageryLayers.get(i).show = false;
        for (let i=0; i<viewer.dataSources.length; i++) viewer.dataSources.get(i).show = false;
        gridLayer.show = false;
        interiorEntities.forEach(entity => { entity.show = true; });
        interiorSource.show = true;
        updateInteriorLayerVisibility();
        interiorOverlay.classList.add("open");
        intCanvas.style.display = "none";
        setIntCard(intSelected);
        // Aim at the 3D Earth model. Cesium's standard rotate/zoom controls remain active.
        viewer.camera.setView({
            // Start at the equator from a side-on view, looking toward +Y with Z up.
            destination: new Cesium.Cartesian3(0, -EARTH_R * 3.15, 0),
            orientation: { direction: new Cesium.Cartesian3(0, 1, 0), up: new Cesium.Cartesian3(0, 0, 1) }
        });
        camCtl.enableRotate = true; camCtl.enableZoom = true; camCtl.enableTilt = true; camCtl.enableLook = false;
    } else {
        interiorOverlay.classList.remove("open");
        interiorSource.show = false;
        if (intSavedScene) {
            globe.show = intSavedScene.globeShow;
            intSavedScene.imagery.forEach(x => { if (viewer.imageryLayers.contains(x.layer)) x.layer.show = x.show; });
            intSavedScene.sources.forEach(x => { if (viewer.dataSources.contains(x.source)) x.source.show = x.show; });
            gridLayer.show = intSavedScene.gridShow;
            camCtl.enableTilt = false; camCtl.enableLook = false;
            intSavedScene = null;
            resetViewer();
        }
        if (intSaved) { Object.entries(intSaved).forEach(([n, wasOn]) => setLayer(n, wasOn)); intSaved = null; }
    }
    syncDock();
}
interiorOverlay.querySelector(".gx-x").addEventListener("click", () => setInterior(false));
intCanvas.addEventListener("click", intPointer);
window.addEventListener("resize", () => { if (intOn) resizeIntCanvas(); });
async function loadQuakes() {
    if (quakes.loading) return; quakes.loading = true; setStatus("Loading earthquakes from USGS…");
    const base = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/";
    const urls = [base + FEEDS[quakes.range] + ".geojson", base + "2.5_day.geojson"];
    let json = null, lastErr = null;
    for (const u of urls) {
        try { const r = await fetch(u, { cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); json = await r.json(); break; }
        catch (e1) { lastErr = e1; try { json = await Cesium.Resource.fetchJson({ url: u }); break; } catch (e2) { lastErr = e2; } }
    }
    quakes.loading = false;
    if (!json || !json.features) { const m = "Could not download the USGS feed: " + (lastErr && lastErr.message ? lastErr.message : lastErr); setStatus(m); toast(m, 6000); return; }
    try {
        quakes.data = json.features.filter(f => f.geometry && f.geometry.coordinates).map(f => ({ lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], depth: Math.max(0, f.geometry.coordinates[2] || 0), mag: f.properties.mag || 0, place: f.properties.place, time: f.properties.time, url: f.properties.url, tsunami: f.properties.tsunami }));
        rebuildQuakes(); setStatus(quakes.data.length.toLocaleString() + " earthquakes downloaded · updated " + new Date().toLocaleTimeString());
    } catch (err) { console.error(err); setStatus("Could not draw the quakes: " + err.message); toast("Could not draw the quakes: " + err.message, 6000); }
}
function rebuildQuakes() {
    const ents = quakeLayer.entities; ents.suspendEvents(); ents.removeAll(); quakes.recent = [];
    const list = quakes.data.filter(q => q.mag >= quakes.minMag);
    list.forEach(q => {
        const e = ents.add({ position: qPos(q), point: { pixelSize: quakeSize(q.mag), color: depthColor(q.depth).withAlpha(0.92), outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 1, disableDepthTestDistance: 0 } });
        e.quake = q; if (Date.now() - q.time < 3 * 3600e3) quakes.recent.push(e);
    });
    ents.resumeEvents(); quakeLayer.show = quakes.visible; updateQuakeStats(list);
}
function setQuakes(on) {
    quakes.visible = on; quakeLayer.show = on;
    layerBtns().forEach(b => { if (b.dataset.layer === "quakes") b.classList.toggle("active", !!on); });
    if (on && !quakes.data.length) loadQuakes();
    clearInterval(quakes.timer); if (on) quakes.timer = setInterval(loadQuakes, 5 * 60e3);
    syncDock();
}
// pulse the freshest quakes
viewer.clock.onTick.addEventListener(() => {
    if (!quakes.visible || !quakes.recent.length) return;
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 350);
    quakes.recent.forEach(e => { e.point.outlineWidth = 1 + 3 * k; e.point.outlineColor = Cesium.Color.WHITE.withAlpha(0.75 * (1 - k * 0.6)); });
});

// --------------------------
// DOCK + POPOVERS
// --------------------------
const IC = {
    quakes: '<svg viewBox="0 0 24 24"><path d="M2 12h4l2-6 4 12 3-9 2 3h5"/></svg>', interior: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2.5"/></svg>',
    tour: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>', search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    spin: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-2.5-5.8"/><path d="M20 4v4h-4"/></svg>', grid: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg>'
};
const dock = el("div", "gx-dock", `
<button data-a="quakes" title="Live earthquakes (Q)">${IC.quakes}<span>Earthquakes</span></button><button data-a="interior" title="Earth interior hemisphere (X)">${IC.interior}<span>Interior</span></button><i class="sep"></i>
<button data-a="tour" title="Guided tour (T)">${IC.tour}<span>Tour</span></button><button data-a="search" title="Search">${IC.search}<span>Search</span></button><i class="sep"></i>
<button data-a="spin" class="on" title="Idle spin">${IC.spin}<span>Spin</span></button><button data-a="grid" class="on" title="Grid">${IC.grid}<span>Grid</span></button>`);
setTimeout(() => dock.classList.add("ready"), 100);
document.body.appendChild(dock);

const quakePop = el("div", "gx-pop", `
<div class="gx-pop-head"><h4>Live earthquakes · USGS</h4><button type="button" class="gx-close" data-close-quakes>Close ×</button></div>
<div class="gx-seg" data-k="range"><button data-v="day" class="on">Past day</button><button data-v="week">Past week</button><button data-v="month">Past month</button></div>
<label>Minimum magnitude: <b id="gxmag">2.5</b><input type="range" id="gxminmag" min="0" max="7" step="0.5" value="2.5"></label>
<div class="gx-legend" id="gxleg"></div>
<div class="gx-stats"><div id="gxstatus" style="opacity:.6;font-size:11px;margin-bottom:6px">Not loaded yet</div><div id="gxstats">Colour shows depth · size shows magnitude.</div></div>`);
document.body.appendChild(quakePop);
$("#gxleg", quakePop).innerHTML = DEPTH_STOPS.map(s => `<span><i style="background:${s[1]}"></i>${s[2]}</span>`).join("") + `<span style="flex-basis:100%;opacity:.7">colour = depth · size = magnitude · pulsing = last 3 h</span>`;
quakePop.querySelectorAll(".gx-seg button").forEach(b => b.onclick = () => { quakePop.querySelectorAll(".gx-seg button").forEach(x => x.classList.remove("on")); b.classList.add("on"); quakes.range = b.dataset.v; loadQuakes(); });
$("#gxminmag", quakePop).oninput = e => { quakes.minMag = +e.target.value; $("#gxmag", quakePop).textContent = e.target.value; rebuildQuakes(); };
function updateQuakeStats(list) {
    if (!list.length) { $("#gxstats", quakePop).textContent = "No quakes match this filter."; return; }
    const big = list.reduce((a, b) => b.mag > a.mag ? b : a), deep = list.reduce((a, b) => b.depth > a.depth ? b : a);
    $("#gxstats", quakePop).innerHTML = `<b>${list.length.toLocaleString()}</b> quakes shown on the globe<br>Largest: <b>M${big.mag.toFixed(1)}</b> ${big.place}<br>Deepest: <b>${Math.round(deep.depth)} km</b> ${deep.place}`;
}

const infoCard = el("div", "gx-card"); document.body.appendChild(infoCard);
function showCard(html) { infoCard.innerHTML = html; infoCard.classList.add("open"); }
function hideCard() { infoCard.classList.remove("open"); }

// search
const searchBox = el("div", "gx-search", `<input placeholder="Search a volcano or mountain range…" autocomplete="off"><ul></ul>`); document.body.appendChild(searchBox);
const sIn = $("input", searchBox), sList = $("ul", searchBox);
function runSearch() {
    const q = sIn.value.trim().toLowerCase(); sList.innerHTML = ""; if (!q) return;
    searchIndex.filter(s => s.name && s.name.toLowerCase().includes(q)).slice(0, 8).forEach(s => {
        const li = el("li", "", `<span>${s.name}</span><small>${s.type}</small>`);
        li.onclick = () => { setLayer(s.type === "Volcano" ? "volcanoes" : "mountains", true); flyTo(s.lon, s.lat, s.range, 2.5); searchBox.classList.remove("open"); sIn.value = ""; sList.innerHTML = ""; syncDock(); };
        sList.appendChild(li);
    });
}
sIn.addEventListener("input", runSearch);
sIn.addEventListener("keydown", e => { if (e.key === "Enter") { const f = $("li", sList); if (f) f.click(); } if (e.key === "Escape") { searchBox.classList.remove("open"); syncDock(); } });

// guided tour
const TOUR = [
    { t: "Plates in motion", x: "Earth's surface is cut into rigid plates that move a few centimetres a year, about as fast as fingernails grow. The red, teal and yellow lines show where they meet.", v: [-20, 30, 2.4e7], L: { plates: 1, volcanoes: 0, quakes: 0, mountains: 0, glaciers: 0 }, xr: 0 },
    { t: "The Ring of Fire", x: "Around the Pacific, oceanic plates dive beneath others. This belt holds roughly 75% of the world's active volcanoes and about 90% of its earthquakes.", v: [175, 15, 2.4e7], L: { plates: 1, volcanoes: 1, quakes: 1, mountains: 0, glaciers: 0 }, xr: 0 },
    { t: "Pulling apart: Iceland", x: "Along the Mid-Atlantic Ridge, plates separate and new crust forms. Iceland sits on the ridge and on a hotspot, which is why it is so volcanic.", v: [-19, 63, 2.2e6], L: { plates: 1, volcanoes: 1, quakes: 1, mountains: 0, glaciers: 0 }, xr: 0 },
    { t: "Collision: the Himalaya", x: "India has been ploughing into Asia for about 50 million years and still moves north at roughly 4–5 cm a year. Nothing sinks here, so the crust crumples upward into the world's highest mountains.", v: [84, 28, 3.2e6], L: { plates: 1, volcanoes: 0, quakes: 1, mountains: 1, glaciers: 0 }, xr: 0 },
    { t: "Seeing a slab: the Andes", x: "Earthquake depth can reveal a sinking tectonic plate. Along the Chilean coast quakes are shallow, and they get steadily deeper inland as the Nazca plate descends beneath South America.", v: [-70, -22, 5.5e6], L: { plates: 1, volcanoes: 1, quakes: 1, mountains: 0, glaciers: 0 }, xr: 0 },
    { t: "Ice and rebound", x: "Ice sheets are heavy enough to push the crust down. Where they melt, the land slowly rises back, still happening in places like Scandinavia and Canada thousands of years later.", v: [-45, 72, 8e6], L: { plates: 0, volcanoes: 0, quakes: 0, mountains: 0, glaciers: 1 }, xr: 0 }
];
let tourI = -1;
function tourStep(i) {
    if (i < 0 || i >= TOUR.length) return tourExit();
    state.touring = true; tourI = i; const s = TOUR[i];
    if (intOn) setInterior(false);
    Object.keys(s.L).forEach(k => setLayer(k, !!s.L[k])); if (s.xr) setInterior(true);
    flyTo(s.v[0], s.v[1], s.v[2], 4);
    showCard(`<div class="eb">Tour · ${i + 1} of ${TOUR.length}</div><h3>${s.t}</h3><div>${s.x}</div><div class="nav"><button data-n="-1" ${i == 0 ? "disabled" : ""}>Back</button><button data-n="1">${i == TOUR.length - 1 ? "Finish" : "Next"}</button><button data-n="x">Exit</button><span></span></div>`);
    infoCard.querySelectorAll("button").forEach(b => b.onclick = () => b.dataset.n === "x" ? tourExit() : tourStep(tourI + +b.dataset.n));
    syncDock();
}
function tourExit() { state.touring = false; tourI = -1; hideCard(); syncDock(); }

// dock behaviour
function closeQuakePopup() {
    quakes.popupOpen = false;
    quakePop.classList.remove("open");
}
quakePop.querySelector("[data-close-quakes]").addEventListener("click", closeQuakePopup);

function syncDock() {
    dock.querySelectorAll("button").forEach(b => {
        const a = b.dataset.a;
        const on = a === "quakes" ? quakes.visible : a === "interior" ? intOn : a === "tour" ? state.touring : a === "search" ? searchBox.classList.contains("open") : a === "spin" ? state.spin : a === "grid" ? gridLayer.show : false;
        b.classList.toggle("on", !!on);
    });
    quakePop.classList.toggle("open", quakes.visible && quakes.popupOpen && !state.touring && !searchBox.classList.contains("open"));
}
dock.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a;
    if (a === "quakes") { if (intOn) { toast("Earthquake layer is unavailable in Earth Interior mode."); return; } if (quakes.visible) { setLayer("quakes", false); closeQuakePopup(); } else { setLayer("quakes", true); quakes.popupOpen = true; quakePop.classList.add("open"); syncDock(); } }
    if (a === "interior") setInterior(!intOn);
    if (a === "tour") { if (intOn) { toast("Exit Earth Interior before starting a tour."); return; } state.touring ? tourExit() : tourStep(0); }
    if (a === "search") { if (intOn) { toast("Search is unavailable in Earth Interior mode."); return; } searchBox.classList.toggle("open"); if (searchBox.classList.contains("open")) sIn.focus(); syncDock(); }
    if (a === "spin") { state.spin = !state.spin; syncDock(); }
    if (a === "grid") { if (intOn) { toast("Map layers are locked while Earth Interior is open."); return; } gridLayer.show = !gridLayer.show; syncDock(); }
});

// --------------------------
// CLICK + HOVER
// --------------------------
const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
let hoverEntity = null;

handler.setInputAction(click => {
    const picked = scene.pick(click.position);
    if (!Cesium.defined(picked)) { hideQuakeCard(); return; }
    const id = picked.id;

    if (intOn && id && Number.isInteger(id.interiorLayerIndex)) {
        setIntCard(id.interiorLayerIndex);
        return;
    }

    if (Array.isArray(id)) {                                   // clicked a volcano cluster: zoom in on it
        const pts = id.map(e => e.position.getValue(NOW())); const bs = Cesium.BoundingSphere.fromPoints(pts);
        flyToCartesian(bs.center, Math.max(bs.radius * 3, 1.2e6), 1.6); return;
    }

    if (id && id.quake) {                                       // earthquake
        const q = id.quake, d = new Date(q.time);
        const ctx = q.depth < 70 ? "shallow, typical of plate boundaries and crustal faults" : q.depth < 300 ? "intermediate depth, usually inside a sinking slab" : "very deep, only found in sinking slabs";
        showCard(`<div class="eb">Earthquake · USGS</div><h3>M${q.mag.toFixed(1)} · ${q.place || "Unknown"}</h3><div>${d.toLocaleString()}<br>Depth <b>${Math.round(q.depth)} km</b> (${ctx}).${q.tsunami ? "<br><b>Tsunami alert flag set.</b>" : ""}</div><div class="nav"><button data-n="x">Close</button><span><a href="${q.url}" target="_blank" rel="noopener" style="color:#b79b5b">USGS details ↗</a></span></div>`);
        infoCard.querySelector("button").onclick = hideCard; return;
    }

    if (id && id.mountainData) {                                // mountain range
        mountainLabelLayer.entities.removeAll(); const m = id.mountainData, pos = id.position.getValue(NOW());
        mountainLabelLayer.entities.add({
            position: pos, label: {
                text: `${m.name}\nHighest peak: ${m.highestPeak}\nCountry: ${m.country}`, font: "500 12px Inter", fillColor: Cesium.Color.fromCssColorString("#d7c7a0"),
                outlineColor: Cesium.Color.BLACK, outlineWidth: 2, style: Cesium.LabelStyle.FILL_AND_OUTLINE, showBackground: true, backgroundColor: Cesium.Color.BLACK.withAlpha(0.55), disableDepthTestDistance: 0
            }
        });
        mountainLabelLayer.show = true; flyToCartesian(pos, 3.0e6, 1.8); return;
    }

    
if (!id || !id.volcanoData) return; // volcano

const volcano = id.volcanoData;

flyTo(volcano.lon, volcano.lat, 2.0e6, 2);

const panel = document.getElementById("volcanoInfo");
if (!panel) return;

const image = panel.querySelector(".info-image");

// Start with the image hidden until we know it has loaded.
panel.classList.add("no-image");

panel.style.display = "block";
setTimeout(() => panel.classList.add("open"), 10);

const set = (sel, v, prop = "textContent") => {
    const n = panel.querySelector(sel);
    if (n) n[prop] = v ?? "";
};

// Fill in the volcano information.
set(".info-status", String(volcano.status || "").toUpperCase());
set(".info-name", volcano.name);
set(".info-location", volcano.country);
set(".info-type", volcano.type);
set(".info-description", volcano.description);

// Check whether the photo actually loads.
if (image) {
    const imageUrl = volcano.image;

    // Keep the image hidden if there is no URL.
    if (!imageUrl) {
        image.removeAttribute("src");
        image.onload = null;
        image.onerror = null;
        image.style.display = "none";
    } else {
        image.style.display = "";

        // Remember which image this particular load belongs to.
        image.dataset.requestedSrc = imageUrl;

        image.onload = () => {
            // Ignore an old image finishing after another volcano was selected.
            if (image.dataset.requestedSrc !== imageUrl) return;

            if (image.naturalWidth > 0) {
                panel.classList.remove("no-image");
            } else {
                panel.classList.add("no-image");
            }
        };

        image.onerror = () => {
            if (image.dataset.requestedSrc !== imageUrl) return;
            panel.classList.add("no-image");
        };

        // Hide first so a broken image never leaves a blank space.
        panel.classList.add("no-image");
        image.src = imageUrl;

        // Handle images that loaded immediately from the browser cache.
        if (image.complete) {
            if (image.naturalWidth > 0) {
                panel.classList.remove("no-image");
            } else {
                panel.classList.add("no-image");
            }
        }
    }
}


}, Cesium.ScreenSpaceEventType.LEFT_CLICK);
function hideQuakeCard() { if (!state.touring) hideCard(); }

function setHover(ent) {
    if (hoverEntity === ent) return;
    if (hoverEntity && hoverEntity.hl) hoverEntity.hl.show = false;
    hoverEntity = ent; if (ent && ent.hl && mountainLayer && mountainLayer.show) ent.hl.show = true;
}
[Cesium.ScreenSpaceEventType.LEFT_DOWN, Cesium.ScreenSpaceEventType.RIGHT_DOWN, Cesium.ScreenSpaceEventType.MIDDLE_DOWN].forEach(t => handler.setInputAction(() => { state.dragging = true; tipEl.style.display = "none"; setHover(null); }, t));
[Cesium.ScreenSpaceEventType.LEFT_UP, Cesium.ScreenSpaceEventType.RIGHT_UP, Cesium.ScreenSpaceEventType.MIDDLE_UP].forEach(t => handler.setInputAction(() => { state.dragging = false; }, t));
let lastHover = 0;
handler.setInputAction(move => {                                // hover (throttled: picking is the expensive part)
    const now = performance.now(); if (state.dragging || state.flying || now - lastHover < 80) return; lastHover = now;
    const picked = scene.pick(move.endPosition); let txt = null, mt = null;
    if (Cesium.defined(picked) && picked.id) {
        const id = picked.id;
        if (Array.isArray(id)) txt = `${id.length} volcanoes · click to zoom`;
        else if (id.quake) txt = `M${id.quake.mag.toFixed(1)} · ${Math.round(id.quake.depth)} km deep`;
        else if (id.volcanoData) txt = `${id.volcanoData.name} · ${id.volcanoData.status}`;
        else if (id.mountainData) { txt = id.mountainData.name; mt = id; }
    }
    setHover(mt);
    if (txt) { tipEl.textContent = txt; tipEl.style.display = "block"; tipEl.style.left = move.endPosition.x + 14 + "px"; tipEl.style.top = move.endPosition.y + 14 + "px"; scene.canvas.style.cursor = "pointer"; }
    else { tipEl.style.display = "none"; scene.canvas.style.cursor = "default"; }
}, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

// --------------------------
// IDLE SPIN, KEYS, EXISTING BUTTONS
// --------------------------
["pointerdown", "wheel", "touchstart", "keydown"].forEach(ev => window.addEventListener(ev, () => state.lastInput = performance.now(), { passive: true }));
viewer.clock.onTick.addEventListener(() => {
    if (state.spin && !state.touring && !state.flying && performance.now() - state.lastInput > 7000 && viewer.camera.positionCartographic.height > 8e6)
        viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0008);
});
document.addEventListener("keydown", e => {
    if (/input|textarea/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "r") resetViewer();
    if (k === "q") setLayer("quakes", !quakes.visible);
    if (k === "x") setInterior(!intOn);
    if (k === "t") state.touring ? tourExit() : tourStep(0);
    if (k === "escape") { if (intOn) setInterior(false); tourExit(); hideCard(); searchBox.classList.remove("open"); syncDock(); }
    if (intOn && k === "arrowright") setIntCard(intSelected + 1);
    if (intOn && k === "arrowleft") setIntCard(intSelected - 1);
    if (state.touring && k === "arrowright") tourStep(tourI + 1);
    if (state.touring && k === "arrowleft") tourStep(tourI - 1);
});
const closeBtn = document.getElementById("closePanel");
if (closeBtn) closeBtn.addEventListener("click", () => { const p = document.getElementById("volcanoInfo"); p.classList.remove("open"); setTimeout(() => p.style.display = "none", 400); });
const resetBtn = document.getElementById("resetViewButton");
if (resetBtn) resetBtn.addEventListener("click", resetViewer);

// initial view
flyTo(HOME.lon, HOME.lat, HOME.height, 3);
syncDock();