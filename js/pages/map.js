import { setKPI, parseNum } from "../utils/kpi.js";
import { setupSidebarHandle } from "../utils/sidebar.js";
import { setupShareButtons, currentUrlWithParams } from "../utils/share.js";

export function initMapPage({ openPage }) {

  const PMTILES_URL =
    "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/trees.pmtiles";
  const SOURCE_LAYER = "trees";

  const INITIAL_CENTER = [9.154940775917993, 45.46043264982563];
  const INITIAL_ZOOM = 10.5;
  const MIN_ZOOM = 4;

  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol("pmtiles", protocol.tile);

  // Base style
  const style = {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: "© OpenStreetMap",
      },
    },
    layers: [
      {
        id: "osm",
        type: "raster",
        source: "osm"
      },
    ],
  };

  const map = new maplibregl.Map({
    container: "mapCanvas",
    style,
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    minZoom: MIN_ZOOM,
    maxZoom: 20,
  });

  // Zoom & geolocate only (NO fullscreen)
  map.addControl(new maplibregl.NavigationControl({
    showCompass: false   // remove compass
  }), "top-right");

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }),
    "top-right"
  );

  // Reset view button
  class ResetViewControl {
    onAdd(map) {
      this._map = map;
      this._container = document.createElement("button");
      this._container.className =
        "reset-ctrl maplibregl-ctrl maplibregl-ctrl-group";
      this._container.type = "button";
      this._container.title = "Reset view";
      this._container.innerHTML = `
        <svg viewBox="0 0 24 24">
          <path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"></path>
        </svg>`;
      this._container.onclick = () => {
        map.easeTo({ center: INITIAL_CENTER, zoom: MIN_ZOOM });
      };
      return this._container;
    }
    onRemove() {
      this._container.remove();
      this._map = undefined;
    }
  }
  map.addControl(new ResetViewControl(), "top-right");

  // Sidebar
  const sidebar = document.getElementById("sidebar");
  const sidebarHandle = document.getElementById("sidebarHandle");
  const { positionHandle } = setupSidebarHandle(sidebar, sidebarHandle);

  const btnDirections = document.getElementById("btnDirections");
  const hero = document.getElementById("hero");
  const siteImage = document.getElementById("siteImage");

  let lastCenterLL = null;
  let selectedFeatureId = null;
  let selectedFeatureName = null;

  // Social sharing
  setupShareButtons(() => {
    const title = selectedFeatureName
      ? `Urban Green – ${selectedFeatureName}`
      : "Urban Green Lombardy";

    const url = currentUrlWithParams({
      area: selectedFeatureName || "",
    });

    return { title, url };
  });

  // -------------------------------------------------------
  // MAP LOAD
  // -------------------------------------------------------
  map.on("load", async () => {
    //
    // 🎨 MAKE BASEMAP GREY **after style loads**
    //
    map.setPaintProperty("osm", "raster-saturation", -1);
    map.setPaintProperty("osm", "raster-brightness-min", 0.85);
    map.setPaintProperty("osm", "raster-brightness-max", 1.05);
    map.setPaintProperty("osm", "raster-contrast", 0.1);

    //
    // TREE ICON
    //
    const ICON = 64;
    const c = document.createElement("canvas");
    c.width = c.height = ICON;
    const ctx = c.getContext("2d");

    ctx.beginPath();
    ctx.arc(ICON * 0.5, ICON * 0.40, ICON * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = "#22c55e";
    ctx.shadowColor = "rgba(0,0,0,.18)";
    ctx.shadowBlur = 4;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#6b4f2a";
    ctx.fillRect(ICON * 0.47, ICON * 0.46, ICON * 0.06, ICON * 0.26);

    ctx.beginPath();
    ctx.ellipse(ICON * 0.5, ICON * 0.78, ICON * 0.22, ICON * 0.09, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,.20)";
    ctx.fill();

    map.addImage("tree-icon", ctx.getImageData(0, 0, ICON, ICON), {
      pixelRatio: 2,
    });

    //
    // PMTILES SOURCE
    //
    const archive = new pmtiles.PMTiles(PMTILES_URL);
    protocol.add(archive);

    map.addSource("areas", {
      type: "vector",
      url: `pmtiles://${PMTILES_URL}`,
    });

    //
    // SYMBOL LAYER
    //
    map.addLayer({
      id: "areas-symbol",
      type: "symbol",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 3,
      maxzoom: 12,
      layout: {
        "icon-image": "tree-icon",
        "icon-size": [
          "interpolate", ["linear"], ["zoom"],
          3, 0.6,
          9, 1.2,
          11.9, 1.5,
        ],
        "icon-allow-overlap": true,
      },
    });

    //
    // FILL / OUTLINE LAYERS
    //
    map.addLayer({
      id: "areas-fill",
      type: "fill",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": [
          "interpolate", ["linear"], ["zoom"],
          11, 0.25,
          13, 0.45,
        ],
      },
    });

    map.addLayer({
      id: "areas-outline",
      type: "line",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      paint: {
        "line-color": "#052e16",
        "line-width": 1.2,
      },
    });

    //
    // SELECTED HIGHLIGHT
    //
    map.addLayer({
      id: "areas-selected",
      type: "line",
      source: "areas",
      "source-layer": SOURCE_LAYER,
      minzoom: 11,
      paint: {
        "line-color": "#fbbc04",
        "line-width": 3.5,
        "line-opacity": 1,
      },
      filter: ["==", ["id"], -1],
    });

    //
    // CLICK HANDLER
    //
    function applySelectionFilter() {
      if (selectedFeatureId !== null) {
        map.setFilter("areas-selected", ["==", ["id"], selectedFeatureId]);
      } else if (selectedFeatureName) {
        map.setFilter("areas-selected", ["==", ["get", "name"], selectedFeatureName]);
      } else {
        map.setFilter("areas-selected", ["==", ["id"], -1]);
      }
    }

    function handleClick(e) {
      const f =
        e.features?.[0] ||
        map.queryRenderedFeatures(e.point, {
          layers: ["areas-fill", "areas-outline", "areas-symbol"],
        })[0];

      if (!f) return;

      const p = f.properties || {};
      selectedFeatureId = f.id ?? null;
      selectedFeatureName = p.name ?? null;
      applySelectionFilter();

      openPage("mapPage");

      document.getElementById("sbTitle").textContent =
        p.name || "Green Area";

      // Image
      if (p.url?.trim()) {
        siteImage.src = p.url;
        siteImage.alt = p.name;
        siteImage.style.display = "block";
        hero.style.background = "#000";
      } else {
        siteImage.src = "";
        siteImage.style.display = "none";
        hero.style.background = "#111827";
      }

      // KPIs
      setKPI("kpiTrees", p.number_of_plants ?? p.trees_count ?? p.n_trees);
      setKPI("kpiCO2Seq", p.co2_sequestered_kg ?? p.co2_absorption_kg, "t");

      const pm10 = parseNum(p.pm10_capture_g);
      const pm25 = parseNum(p.pm25_capture_g);
      setKPI("kpiPM", (pm10 || 0) + (pm25 || 0), "g");

      setKPI("kpiRain", p.h2o_precipitation_l ?? p.h2o_retention_l, "L");

      setKPI(
        "kpiEur",
        p.co2_absorption_value_eur ??
          p.co2_stock_value_eur ??
          p.energy_value_eur,
        "€"
      );

      // Centroid
      let center;
      try {
        if (f.geometry.type === "Polygon") {
          const ring = f.geometry.coordinates[0];
          const sx = ring.reduce((a, c) => a + c[0], 0);
          const sy = ring.reduce((a, c) => a + c[1], 0);
          center = [sx / ring.length, sy / ring.length];
        }
      } catch {}

      if (!center) center = map.unproject(e.point).toArray();
      lastCenterLL = center;

      btnDirections.disabled = false;
      sidebar.classList.add("open");
      positionHandle();
    }

    map.on("click", "areas-fill", handleClick);
    map.on("click", "areas-outline", handleClick);
    map.on("click", "areas-symbol", handleClick);
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

  window.addEventListener("unload", () => protocol.removeAll());
}
