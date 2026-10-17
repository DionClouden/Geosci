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
.gx-pop{padding:16px 18px;display:none}.gx-pop.open{display:block}
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
    if (name === "volcanoes") volcanoLayer.show = on;
    if (name === "glaciers") { if (glacierLayer) glacierLayer.show = on; if (seaIceLayer) seaIceLayer.show = on; }
    if (name === "plates" && plateLayer) plateLayer.show = on;
    if (name === "mountains" && mountainLayer) { mountainLayer.show = on; if (!on) { mountainLabelLayer.entities.removeAll(); mountainLabelLayer.show = false; setHover(null); } }
    if (name === "quakes") setQuakes(on);
    layerBtns().forEach(b => { if (b.dataset.layer === name) b.classList.toggle("active", !!on); });
    syncDock();
}
layerBtns().forEach(b => b.addEventListener("click", () => setLayer(b.dataset.layer, !layerOn(b.dataset.layer))));

// --------------------------
// LIVE EARTHQUAKES (USGS) + X-RAY SLAB VIEW
// --------------------------
const quakes = { visible: false, data: [], range: "day", minMag: 2.5, xray: false, recent: [], timer: null, loading: false };
const quakeLayer = new Cesium.CustomDataSource("earthquakes"); viewer.dataSources.add(quakeLayer); quakeLayer.show = false;
const FEEDS = { day: "all_day", week: "2.5_week", month: "2.5_month" };
const SURF_H = 30000;                                                     // draw quakes 30 km up so they never z-fight with the globe
const DEPTH_STOPS = [[35, "#ff5a3c", "0–35 km"], [70, "#ff9a3c", "35–70"], [150, "#ffd23c", "70–150"], [300, "#7be07b", "150–300"], [500, "#3cb4ff", "300–500"], [9999, "#a06cff", "500+ km"]];
const depthColor = d => Cesium.Color.fromCssColorString((DEPTH_STOPS.find(s => d < s[0]) || DEPTH_STOPS[5])[1]);
const quakeSize = m => Math.max(5, Math.pow(Math.max(m, 0), 1.9) * 0.6);
const qPos = q => Cesium.Cartesian3.fromDegrees(q.lon, q.lat, quakes.xray ? -q.depth * 1000 : SURF_H);
const setStatus = t => { const n = document.getElementById("gxstatus"); if (n) n.textContent = t; console.info("[quakes]", t); };

const shells = [410, 660].map(km => viewer.entities.add({
    position: Cesium.Cartesian3.ZERO, show: false,
    ellipsoid: {
        radii: new Cesium.Cartesian3(6378137 - km * 1000, 6378137 - km * 1000, 6356752 - km * 1000), fill: false, outline: true,
        outlineColor: Cesium.Color.fromCssColorString(km === 410 ? "#3cb4ff" : "#a06cff").withAlpha(0.35), slicePartitions: 36, stackPartitions: 18
    }
}));

function setXray(on) {
    quakes.xray = on;
    globe.translucency.enabled = on; globe.translucency.frontFaceAlpha = on ? 0.22 : 1.0; globe.translucency.backFaceAlpha = 1.0;
    shells.forEach(s => s.show = on);
    quakeLayer.entities.values.forEach(e => { if (e.quake) { e.position = qPos(e.quake); e.point.disableDepthTestDistance = on ? Number.POSITIVE_INFINITY : 0; } });
    syncDock();
    if (on && quakes.visible) toast("X-ray on: colour shows depth, with the mantle shells drawn at 410 km and 660 km");
}

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
        const e = ents.add({ position: qPos(q), point: { pixelSize: quakeSize(q.mag), color: depthColor(q.depth).withAlpha(0.92), outlineColor: Cesium.Color.BLACK.withAlpha(0.6), outlineWidth: 1, disableDepthTestDistance: quakes.xray ? Number.POSITIVE_INFINITY : 0 } });
        e.quake = q; if (Date.now() - q.time < 3 * 3600e3) quakes.recent.push(e);
    });
    ents.resumeEvents(); quakeLayer.show = quakes.visible; updateQuakeStats(list);
}
function setQuakes(on) {
    quakes.visible = on; quakeLayer.show = on;
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
    quakes: '<svg viewBox="0 0 24 24"><path d="M2 12h4l2-6 4 12 3-9 2 3h5"/></svg>', xray: '<svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    tour: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>', search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
    spin: '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 11-2.5-5.8"/><path d="M20 4v4h-4"/></svg>', grid: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4zM4 12h16M12 4v16"/></svg>'
};
const dock = el("div", "gx-dock", `
<button data-a="quakes" title="Live earthquakes (Q)">${IC.quakes}<span>Earthquakes</span></button><button data-a="xray" title="X-ray: show depth (X)">${IC.xray}<span>X-ray</span></button><i class="sep"></i>
<button data-a="tour" title="Guided tour (T)">${IC.tour}<span>Tour</span></button><button data-a="search" title="Search">${IC.search}<span>Search</span></button><i class="sep"></i>
<button data-a="spin" class="on" title="Idle spin">${IC.spin}<span>Spin</span></button><button data-a="grid" class="on" title="Grid">${IC.grid}<span>Grid</span></button>`);
setTimeout(() => dock.classList.add("ready"), 100);
document.body.appendChild(dock);

const quakePop = el("div", "gx-pop", `
<h4>Live earthquakes · USGS</h4>
<div class="gx-seg" data-k="range"><button data-v="day" class="on">Past day</button><button data-v="week">Past week</button><button data-v="month">Past month</button></div>
<label>Minimum magnitude: <b id="gxmag">2.5</b><input type="range" id="gxminmag" min="0" max="7" step="0.5" value="2.5"></label>
<div class="gx-legend" id="gxleg"></div>
<div class="gx-stats"><div id="gxstatus" style="opacity:.6;font-size:11px;margin-bottom:6px">Not loaded yet</div><div id="gxstats">Turn on X-ray to see how deep each quake is.</div></div>`);
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
    { t: "Seeing a slab: the Andes", x: "X-ray colours quakes by depth. Along the Chilean coast they are shallow (red), and they get steadily deeper (yellow, green, blue) as you move inland. That staircase traces the Nazca plate sinking under South America.", v: [-70, -22, 5.5e6], L: { plates: 1, volcanoes: 1, quakes: 1, mountains: 0, glaciers: 0 }, xr: 1 },
    { t: "Ice and rebound", x: "Ice sheets are heavy enough to push the crust down. Where they melt, the land slowly rises back, still happening in places like Scandinavia and Canada thousands of years later.", v: [-45, 72, 8e6], L: { plates: 0, volcanoes: 0, quakes: 0, mountains: 0, glaciers: 1 }, xr: 0 }
];
let tourI = -1;
function tourStep(i) {
    if (i < 0 || i >= TOUR.length) return tourExit();
    state.touring = true; tourI = i; const s = TOUR[i];
    Object.keys(s.L).forEach(k => setLayer(k, !!s.L[k])); setXray(!!s.xr);
    flyTo(s.v[0], s.v[1], s.v[2], 4);
    showCard(`<div class="eb">Tour · ${i + 1} of ${TOUR.length}</div><h3>${s.t}</h3><div>${s.x}</div><div class="nav"><button data-n="-1" ${i == 0 ? "disabled" : ""}>Back</button><button data-n="1">${i == TOUR.length - 1 ? "Finish" : "Next"}</button><button data-n="x">Exit</button><span></span></div>`);
    infoCard.querySelectorAll("button").forEach(b => b.onclick = () => b.dataset.n === "x" ? tourExit() : tourStep(tourI + +b.dataset.n));
    syncDock();
}
function tourExit() { state.touring = false; tourI = -1; hideCard(); syncDock(); }

// dock behaviour
function syncDock() {
    dock.querySelectorAll("button").forEach(b => {
        const a = b.dataset.a;
        const on = a === "quakes" ? quakes.visible : a === "xray" ? quakes.xray : a === "tour" ? state.touring : a === "search" ? searchBox.classList.contains("open") : a === "spin" ? state.spin : a === "grid" ? gridLayer.show : false;
        b.classList.toggle("on", !!on);
    });
    quakePop.classList.toggle("open", quakes.visible && !state.touring && !searchBox.classList.contains("open"));
}
dock.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return; const a = b.dataset.a;
    if (a === "quakes") setLayer("quakes", !quakes.visible);
    if (a === "xray") { if (!quakes.visible) setLayer("quakes", true); setXray(!quakes.xray); }
    if (a === "tour") state.touring ? tourExit() : tourStep(0);
    if (a === "search") { searchBox.classList.toggle("open"); if (searchBox.classList.contains("open")) sIn.focus(); syncDock(); }
    if (a === "spin") { state.spin = !state.spin; syncDock(); }
    if (a === "grid") { gridLayer.show = !gridLayer.show; syncDock(); }
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

    if (!id || !id.volcanoData) return;                         // volcano
    const volcano = id.volcanoData;
    flyTo(volcano.lon, volcano.lat, 2.0e6, 2);
    const panel = document.getElementById("volcanoInfo"); if (!panel) return;
    panel.style.display = "block"; setTimeout(() => panel.classList.add("open"), 10);
    const set = (sel, v, prop = "textContent") => { const n = document.querySelector(sel); if (n) n[prop] = v; };
    set(".info-image", volcano.image, "src"); set(".info-status", String(volcano.status).toUpperCase()); set(".info-name", volcano.name);
    set(".info-location", volcano.country); set(".info-type", volcano.type); set(".info-description", volcano.description);
    const link = document.getElementById("articleLink"); if (link) link.href = volcano.article;
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
    if (k === "x") { if (!quakes.visible) setLayer("quakes", true); setXray(!quakes.xray); }
    if (k === "t") state.touring ? tourExit() : tourStep(0);
    if (k === "escape") { tourExit(); hideCard(); searchBox.classList.remove("open"); syncDock(); }
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