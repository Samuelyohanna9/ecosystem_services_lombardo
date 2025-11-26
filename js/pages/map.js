
import { setKPI, parseNum } from "../utils/kpi.js";
import { setupSidebarHandle } from "../utils/sidebar.js";
import { setupShareButtons, currentUrlWithParams } from "../utils/share.js";

export function initMapPage({ openPage }) {

  const PMTILES_URL  = "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/trees.pmtiles";
  const SOURCE_LAYER = "trees";

  const INITIAL_CENTER = [9.154940775917993, 45.46043264982563];
  const INITIAL_ZOOM   = 10.5;
  const MIN_ZOOM       = 4;

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  const style = {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap contributors"
      }
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          "raster-saturation": -1,
          "raster-contrast": 0.05,
          "raster-brightness-min": 0,
          "raster-brightness-max": 0.8
        }
      }
    ]
  };

  const map = new maplibregl.Map({
    container: "mapCanvas",
    style,
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: 20
  });

  map.addControl(new maplibregl.NavigationControl({
    showCompass: false,
    showZoom: true
  }), "top-right");

  map.addControl(new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy: true },
    trackUserLocation: true,
    showUserHeading: true
  }), "top-right");

  class ResetViewControl {
    onAdd(map) {
      this._map = map;
      this._container = document.createElement("button");
      this._container.className = "reset-ctrl maplibregl-ctrl maplibregl-ctrl-group";
      this._container.type = "button";
      this._container.title = "Reset view";
      this._container.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"></path>
        </svg>
      `;
      this._container.onclick = () =>
        map.easeTo({ center: INITIAL_CENTER, zoom: MIN_ZOOM });
      return this._container;
    }
    onRemove() {
      this._container.remove();
      this._map = undefined;
    }
  }
  map.addControl(new ResetViewControl(), "top-right");

  const sidebar       = document.getElementById("sidebar");
  const sidebarHandle = document.getElementById("sidebarHandle");
  const { positionHandle } = setupSidebarHandle(sidebar, sidebarHandle);

  const btnDirections = document.getElementById("btnDirections");
  const hero          = document.getElementById("hero");
  const siteImage     = document.getElementById("siteImage");


  const treeDetails  = document.getElementById("treeDetails");
  const sbSubtitle   = document.getElementById("sbSubtitle");
  const elAreaName   = document.getElementById("treeAreaName");
  const elHeight     = document.getElementById("treeHeight");
  const elDiameter   = document.getElementById("treeDiameter");
  const elCode       = document.getElementById("treeCode");

  let lastCenterLL        = null;
  let selectedFeatureName = null;

  setupShareButtons(() => {
    const title = selectedFeatureName
      ? `Urban Green Lombardy – ${selectedFeatureName}`
      : "Urban Green Lombardy";

    const url = currentUrlWithParams({
      area: selectedFeatureName || ""
    });

    return { title, url };
  });



  function safeParseJSON(maybeJSON) {
    if (typeof maybeJSON !== "string") return maybeJSON;
    try {
      return JSON.parse(maybeJSON);
    } catch {
      return null;
    }
  }


  function getEcoYearRecord(rawEco) {
    if (!rawEco) return null;
    let v = safeParseJSON(rawEco);
    if (!v) return null;

    if (Array.isArray(v)) {
      return v[0] || null;
    }
    if (typeof v === "object") {
      const vals = Object.values(v);
      return vals[0] || null;
    }
    return null;
  }

  
  function getTreesCount(rawTrees, fallbackCount) {
   
    if (typeof fallbackCount === "number" && !Number.isNaN(fallbackCount)) {
      return fallbackCount;
    }
    if (!rawTrees) return null;

    const v = safeParseJSON(rawTrees);
    if (!Array.isArray(v)) return null;

    let sum = 0;
    for (const t of v) {
      const n = parseNum(t?.numerosita);
      if (Number.isFinite(n)) sum += n;
    }
    return sum || null;
  }

  map.on("load", async () => {

    const archive = new pmtiles.PMTiles(PMTILES_URL);
    protocol.add(archive);

    map.addSource("areas", {
      type: "vector",
      url: `pmtiles://${PMTILES_URL}`
    });


    map.addSource("selected-area", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    });

   
    map.addSource("selected-tree", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: []
      }
    });


    map.addLayer({
      id: "areas-fill-district",
      type: "fill",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      filter: ["==", ["get", "element_type"], "district"],
      paint: {
        "fill-color": "#f6e5e3",
        "fill-opacity": 0.35
      }
    });

    map.addLayer({
      id: "areas-outline-district",
      type: "line",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      filter: ["==", ["get", "element_type"], "district"],
      paint: {
        "line-color": "#d26a6a",
        "line-width": 1.4,
        "line-opacity": 0.9
      }
    });


    map.addLayer({
      id: "areas-fill-other",
      type: "fill",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      filter: [
        "all",
        ["!=", ["get", "element_type"], "district"]
      ],
      paint: {
        "fill-color": "#bbf7d0",  
        "fill-opacity": 0.3
      }
    });

 
    map.addLayer({
      id: "areas-outline-other",
      type: "line",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      filter: [
        "all",
        ["!=", ["get", "element_type"], "district"]
      ],
      paint: {
        "line-color": "#16a34a",
        "line-width": 1.2,
        "line-opacity": 0.8
      }
    });


    map.addLayer({
      id: "areas-selected",
      type: "line",
      source: "selected-area",
      minzoom: 11,
      paint: {
        "line-color": "#fbbc04",
        "line-width": 4
      }
    });

    map.addLayer({
      id: "trees-points",
      type: "circle",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 0, 
      filter: ["==", ["get", "element_type"], "tree"],
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 1.4,
          10, 3.5,
          18, 7
        ],
        "circle-color": "#22c55e",       
        "circle-stroke-color": "#064e3b", 
        "circle-stroke-width": 0.8,
        "circle-opacity": 0.9
      }
    });


    map.addLayer({
      id: "tree-selected",
      type: "circle",
      source: "selected-tree",
      minzoom: 0,
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          4, 3.5,
          10, 6,
          18, 10
        ],
        "circle-color": "#facc15",
        "circle-opacity": 0.3,
        "circle-stroke-color": "#f59e0b",
        "circle-stroke-width": 2
      }
    });


    const img = new Image();
    img.src = "./svg/ic-treesl.svg";
    img.onload = () => {
      const SIZE = 64;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.drawImage(img, 0, 0, SIZE, SIZE);

      const imageData = ctx.getImageData(0, 0, SIZE, SIZE);
      map.addImage("tree-icon", imageData, { pixelRatio: 2 });

      map.addLayer({
        id: "areas-symbol",
        type: "symbol",
        source: "areas",
        "source-layer": SOURCE_LAYER,
        minzoom: 3,
        maxzoom: 12,
        layout: {
          "symbol-placement": "point",
          "icon-image": "tree-icon",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-pitch-alignment": "viewport",
          "icon-size": [
            "interpolate", ["linear"], ["zoom"],
            3, 0.6,
            9, 1.2,
            12, 1.5
          ]
        }
      });
    };
    img.onerror = (err) => {
      console.error("Failed to load ./svg/ic-treesl.svg for map icon", err);
    };

    function handleClick(e) {
     
      const f =
        (e.features && e.features[0]) ||
        map.queryRenderedFeatures(e.point, {
          layers: [
            "trees-points",
            "areas-fill-district",
            "areas-outline-district",
            "areas-fill-other",
            "areas-outline-other",
            "areas-symbol"
          ]
        })[0];

      if (!f) return;

      const p = f.properties || {};
      const isTree =
        p.element_type === "tree" && f.geometry && f.geometry.type === "Point";

      if (openPage) openPage("mapPage");

 
      sidebar.classList.add("open");
      positionHandle();

    
      if (isTree) {
        const commonName = p.nome_comune || "Tree";
        const sciName    = p.nome_scientifico || "";

        selectedFeatureName = commonName;

  
        document.getElementById("sbTitle").textContent = commonName;
        if (sbSubtitle) sbSubtitle.textContent = sciName;


        if (treeDetails) treeDetails.style.display = "block";

     
        siteImage.src = "./svg/ulmus_minor.svg";
        siteImage.alt = sciName || commonName;
        siteImage.style.display = "block";
        hero.style.background = "#ffffff";

        if (elAreaName) elAreaName.textContent = p.nome_area || "—";
        if (elHeight)   elHeight.textContent   = p.altezza || "—";         
        if (elDiameter) elDiameter.textContent = p.diametro_tronco || "—";  
        if (elCode)     elCode.textContent     = f.id ?? p.codice ?? "—";

      
        setKPI("kpiTrees", 1);

        const eco = getEcoYearRecord(p.ecosystem_yearly);
        const co2kg = eco ? parseNum(eco.co2_absorption_kg) : null;
        const co2t  = Number.isFinite(co2kg) ? co2kg / 1000 : null;
        setKPI("kpiCO2Seq", co2t, "t");

        const pm10g = eco ? parseNum(eco.pm10_capture_g) : null;
        setKPI("kpiPM", pm10g, "g");

        const rainL = eco ? parseNum(eco.h2o_retention_l) : null;
        setKPI("kpiRain", rainL, "L");

        const econVal = parseNum(p.economic_value_eur);
        setKPI("kpiEur", econVal, "€");

  
        try {
          const treeSrc = map.getSource("selected-tree");
          const areaSrc = map.getSource("selected-area");

          if (treeSrc) {
            treeSrc.setData({
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                geometry: f.geometry,
                properties: {}
              }]
            });
          }
          if (areaSrc) {
            areaSrc.setData({
              type: "FeatureCollection",
              features: []
            });
          }
        } catch (err) {
          console.error("Error updating tree highlight", err);
        }

     
        let center = null;
        if (f.geometry?.type === "Point") {
          center = f.geometry.coordinates;
        }
        if (!center) {
          center = map.unproject(e.point).toArray();
        }
        lastCenterLL = center;

        btnDirections.disabled = false;
        return; 
      }

     
      const featureTitle =
        p.nome ||
        p.description ||
        p.name ||
        (typeof p.id !== "undefined" ? `Area ${p.id}` : "Green Area");

      selectedFeatureName = featureTitle;

      document.getElementById("sbTitle").textContent = featureTitle;
      if (sbSubtitle) sbSubtitle.textContent = "";

      
      if (treeDetails) treeDetails.style.display = "none";

    
      let heroImgRaw = p.image || p.url || p.image_url;
      if (heroImgRaw != null) {
        const heroImg = String(heroImgRaw).trim();
        console.log("Polygon hero image:", heroImg); 
        if (heroImg !== "") {
          siteImage.src = heroImg;
          siteImage.alt = featureTitle;
          siteImage.style.display = "block";
          hero.style.background = "#000";
        } else {
          siteImage.src = "";
          siteImage.style.display = "none";
          hero.style.background = "#111827";
        }
      } else {
        siteImage.src = "";
        siteImage.style.display = "none";
        hero.style.background = "#111827";
      }

   
      const directTreeCount = parseNum(p.number_of_plant);
      let treesTotal = getTreesCount(p.trees, directTreeCount);

  
      if (!Number.isFinite(treesTotal) && p.nome) {
        try {
          const treeFeatures = map.querySourceFeatures("areas", {
            sourceLayer: SOURCE_LAYER,
            filter: [
              "all",
              ["==", ["get", "element_type"], "tree"],
              ["==", ["get", "nome_area"], p.nome]
            ]
          });
          if (treeFeatures && treeFeatures.length) {
            treesTotal = treeFeatures.length;
          }
        } catch (err) {
          console.error("Error counting trees from points", err);
        }
      }

      setKPI("kpiTrees", treesTotal);

 
      const eco = getEcoYearRecord(p.ecosystem_yearly);

      const co2kg = eco ? parseNum(eco.co2_absorption_kg) : null;
      const co2t  = Number.isFinite(co2kg) ? co2kg / 1000 : null;
      setKPI("kpiCO2Seq", co2t, "t");

      const pm10g = eco ? parseNum(eco.pm10_capture_g) : null;
      setKPI("kpiPM", pm10g, "g");

      const rainL = eco ? parseNum(eco.h2o_retention_l) : null;
      setKPI("kpiRain", rainL, "L");

      const econVal = parseNum(p.economic_value_eur);
      setKPI("kpiEur", econVal, "€");


      try {
        const areaSrc = map.getSource("selected-area");
        const treeSrc = map.getSource("selected-tree");

        if (
          areaSrc &&
          f.geometry &&
          (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
        ) {
          areaSrc.setData({
            type: "FeatureCollection",
            features: [{
              type: "Feature",
              geometry: f.geometry,
              properties: {}
            }]
          });
        } else if (areaSrc) {
          areaSrc.setData({
            type: "FeatureCollection",
            features: []
          });
        }

        if (treeSrc) {
          treeSrc.setData({
            type: "FeatureCollection",
            features: []
          });
        }
      } catch (err) {
        console.error("Error updating selected-area highlight", err);
      }


      let center = null;
      try {
        if (f.geometry?.type === "Polygon") {
          const ring = f.geometry.coordinates[0];
          let sx = 0, sy = 0;
          ring.forEach(c => { sx += c[0]; sy += c[1]; });
          center = [sx / ring.length, sy / ring.length];
        } else if (f.geometry?.type === "MultiPolygon") {
          const ring = f.geometry.coordinates[0][0];
          let sx = 0, sy = 0;
          ring.forEach(c => { sx += c[0]; sy += c[1]; });
          center = [sx / ring.length, sy / ring.length];
        } else if (f.geometry?.type === "Point") {
          center = f.geometry.coordinates;
        }
      } catch {
        // ignore
      }

      if (!center) {
        center = map.unproject(e.point).toArray();
      }

      lastCenterLL = center;
      btnDirections.disabled = false;
    }

    
    map.on("click", "areas-fill-district",    handleClick);
    map.on("click", "areas-outline-district", handleClick);
    map.on("click", "areas-fill-other",       handleClick);
    map.on("click", "areas-outline-other",    handleClick);
    map.on("click", "areas-symbol",           handleClick);
    map.on("click", "trees-points",           handleClick);
    map.on("click", handleClick);

    positionHandle();
  });

  btnDirections.addEventListener("click", () => {
    if (!lastCenterLL) return;
    const [lng, lat] = lastCenterLL;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      "_blank"
    );
  });
}