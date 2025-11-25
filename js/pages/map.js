
import { setKPI, parseNum } from "../utils/kpi.js";
import { setupSidebarHandle } from "../utils/sidebar.js";
import { setupShareButtons, currentUrlWithParams } from "../utils/share.js";

export function initMapPage({ openPage }) {

  const PMTILES_URL  = "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/trees.pmtiles";
  const SOURCE_LAYER = "trees";

  const INITIAL_CENTER = [9.154940775917993, 45.46043264982563];
  const INITIAL_ZOOM   = 10.5;
  const MIN_ZOOM       = 4;

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

  const sidebar       = document.getElementById("sidebar");
  const sidebarHandle = document.getElementById("sidebarHandle");
  const { positionHandle } = setupSidebarHandle(sidebar, sidebarHandle);

  const btnDirections = document.getElementById("btnDirections");
  const hero          = document.getElementById("hero");
  const siteImage     = document.getElementById("siteImage");

  let lastCenterLL        = null;
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


 map.addLayer({
  id: "areas-fill",
  type: "fill",
  source: "areas",
  "source-layer": SOURCE_LAYER,
  minzoom: 11,
  paint: {
    "fill-color": "#f6e5e3",
    "fill-opacity": 0.35    // << more transparent
  }
});

map.addLayer({
  id: "areas-outline",
  type: "line",
  source: "areas",
  "source-layer": SOURCE_LAYER,
  minzoom: 11,
  paint: {
    "line-color": "#d26a6a",
    "line-width": 1.4,
    "line-opacity": 0.9      // << slightly softer like screenshot
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
          layers: ["areas-fill", "areas-outline", "areas-symbol"]
        })[0];

      if (!f) return;

      const p = f.properties || {};
      selectedFeatureName = p.name ?? null;

      if (openPage) openPage("mapPage");

      document.getElementById("sbTitle").textContent = p.name || "Green Area";

      if (p.url && String(p.url).trim() !== "") {
        siteImage.src = p.url;
        siteImage.alt = p.name || "Green area image";
        siteImage.style.display = "block";
        hero.style.background = "#000";
      } else {
        siteImage.src = "";
        siteImage.style.display = "none";
        hero.style.background = "#111827";
      }

      setKPI("kpiTrees",  p.number_of_plants ?? p.trees_count ?? p.n_trees);
      setKPI("kpiCO2Seq", p.co2_sequestered_kg ?? p.co2_absorption_kg, "t");

      const pm10 = parseNum(p.pm10_capture_g);
      const pm25 = parseNum(p.pm25_capture_g);
      const pmTot = (isFinite(pm10) ? pm10 : 0) + (isFinite(pm25) ? pm25 : 0);
      setKPI("kpiPM", pmTot, "g");

      setKPI("kpiRain", p.h2o_precipitation_l ?? p.h2o_retention_l, "L");

      setKPI(
        "kpiEur",
        p.co2_absorption_value_eur ??
        p.co2_stock_value_eur ??
        p.energy_value_eur,
        "€"
      );

      try {
        const src = map.getSource("selected-area");

        if (
          src &&
          f.geometry &&
          (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon")
        ) {
          const highlightFeature = {
            type: "Feature",
            geometry: f.geometry,
            properties: {}
          };

          src.setData({
            type: "FeatureCollection",
            features: [highlightFeature]
          });
        } else if (src) {
          src.setData({
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
      }

      if (!center) {
        center = map.unproject(e.point).toArray();
      }

      lastCenterLL = center;

      btnDirections.disabled = false;
      sidebar.classList.add("open");
      positionHandle();
    }

    map.on("click", "areas-fill",    handleClick);
    map.on("click", "areas-outline", handleClick);
    map.on("click", "areas-symbol",  handleClick);
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
