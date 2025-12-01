import { setKPI, parseNum } from "../utils/kpi.js";
import { setupSidebarHandle } from "../utils/sidebar.js";
import { setupShareButtons, currentUrlWithParams } from "../utils/share.js";

export function initMapPage({ openPage }) {

  const PMTILES_URL  = "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/trees.pmtiles";
  const SOURCE_LAYER = "trees";

  const INITIAL_CENTER = [9.154940775917993, 45.46043264982563];
  const INITIAL_ZOOM   = 10;  
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

  const treeDetails  = document.getElementById("treeDetails");
  const sbSubtitle   = document.getElementById("sbSubtitle");
  const elAreaName   = document.getElementById("treeAreaName");
  const elHeight     = document.getElementById("treeHeight");
  const elDiameter   = document.getElementById("treeDiameter");
  const elCode       = document.getElementById("treeCode");

 
  const searchPanel = document.getElementById("searchPanel");
  const detailPanel = document.getElementById("detailPanel");
  const searchInput = document.getElementById("searchInput");
  const areasList = document.getElementById("areasList");
  const toggleTrees = document.getElementById("toggleTrees");
  const btnToggleFilters = document.getElementById("btnToggleFilters");
  const filterSection = document.getElementById("filterSection");
  const btnClose = document.getElementById("btnClose");

  let lastCenterLL        = null;
  let selectedFeatureName = null;

 
  let allAreas = [];

  const IMAGE_BASE_URL = "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/images/";


  sidebar.classList.add("open");
  positionHandle();


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

 
    if (searchPanel) searchPanel.style.display = "none";
    if (detailPanel) detailPanel.style.display = "flex";

    sidebar.classList.add("open");
    positionHandle();

    if (isTree) {
      const commonName = p.nome_comune || "Tree";
      const sciName    = p.nome_scientifico || "";

      selectedFeatureName = commonName;

      document.getElementById("sbTitle").textContent = commonName;
      if (sbSubtitle) sbSubtitle.textContent = sciName;

      if (treeDetails) treeDetails.style.display = "block";

      siteImage.src = "./svg/ulmus_minor.svg";
      siteImage.alt = sciName || commonName;
      siteImage.style.display = "block";
      hero.style.background = "#ffffff";

      if (elAreaName) elAreaName.textContent = p.nome_area || "—";
      if (elHeight)   elHeight.textContent   = p.altezza || "—";         
      if (elDiameter) elDiameter.textContent = p.diametro_tronco || "—";  
      if (elCode)     elCode.textContent     = f.id ?? p.codice ?? "—";

      setKPI("kpiTrees", 1);

      const eco = getEcoYearRecord(p.ecosystem_yearly);
      const co2kg = eco ? parseNum(eco.co2_absorption_kg) : null;
      const co2t  = Number.isFinite(co2kg) ? co2kg / 1000 : null;
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
      if (!center && e.point) {
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
      if (heroImg !== "") {
        let finalSrc = heroImg;
        
        if (!heroImg.startsWith("http")) { 
          finalSrc = IMAGE_BASE_URL + heroImg;
        }
        
        siteImage.src = finalSrc; 
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
    const co2t  = Number.isFinite(co2kg) ? co2kg / 1000 : null;
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
   
    }

    if (!center && e.point) {
      center = map.unproject(e.point).toArray();
    }

    lastCenterLL = center;
    btnDirections.disabled = false;
  }

  setupShareButtons(() => {
    const title = selectedFeatureName
      ? `Urban Green Lombardy – ${selectedFeatureName}`
      : "Urban Green Lombardy";

    const url = currentUrlWithParams({
      area: selectedFeatureName || ""
    });

    return { title, url };
  });

  
  if (btnToggleFilters) {
    btnToggleFilters.addEventListener("click", () => {
      const isHidden = filterSection.classList.toggle("hidden");
      btnToggleFilters.textContent = isHidden ? "show filters" : "hide filters";
    });
  }

 
  if (toggleTrees) {
    toggleTrees.addEventListener("change", (e) => {
      const showTrees = e.target.checked;
      
     
      if (map.getLayer("trees-points")) {
        map.setLayoutProperty("trees-points", "visibility", showTrees ? "visible" : "none");
      }
      
    
    });
  }


  if (searchInput) {
    searchInput.addEventListener("input", () => {
      filterAreasList();
    });
  }

  if (btnClose) {
    btnClose.addEventListener("click", () => {
      if (searchPanel) searchPanel.style.display = "flex";
      if (detailPanel) detailPanel.style.display = "none";
      selectedFeatureName = null;
      lastCenterLL = null;
      btnDirections.disabled = true;
      
  
      const areaSrc = map.getSource("selected-area");
      const treeSrc = map.getSource("selected-tree");
      if (areaSrc) {
        areaSrc.setData({ type: "FeatureCollection", features: [] });
      }
      if (treeSrc) {
        treeSrc.setData({ type: "FeatureCollection", features: [] });
      }
    });
  }

 
  function filterAreasList() {
    if (!searchInput || !areasList) return;
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    let filtered = allAreas.filter(area => {
      const props = area.properties || {};
      
     
      if (props.element_type === "tree") return false;
      
      if (searchTerm) {
        const name = (props.nome || "").toLowerCase();
        const desc = (props.description || "").toLowerCase();
        const id = String(props.id || "");
        
        return name.includes(searchTerm) || desc.includes(searchTerm) || id.includes(searchTerm);
      }
      
      return true;
    });
    
    renderAreasList(filtered);
  }

  function renderAreasList(areas) {
    if (!areasList) return;
    
    if (areas.length === 0) {
      areasList.innerHTML = `
        <div class="no-results">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <p>No green areas found</p>
        </div>
      `;
      return;
    }
    
    const IMAGE_BASE_URL = "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/images/";
    
    areasList.innerHTML = areas.map((area, index) => {
      const props = area.properties || {};
      

      const title = props.nome || props.description || props.name || (props.id ? `Area ${props.id}` : `Area ${index + 1}`);
      const subtitle = "green area ";
      
      let imageUrl = null;
      let heroImgRaw = props.image || props.url || props.image_url;
      if (heroImgRaw) {
        const heroImg = String(heroImgRaw).trim();
        if (heroImg && !heroImg.startsWith("http")) {
          imageUrl = IMAGE_BASE_URL + heroImg;
        } else if (heroImg) {
          imageUrl = heroImg;
        }
      }
      
      return `
        <div class="area-item" data-area-index="${index}">
          <div class="area-item-content">
            <h3 class="area-item-title">${title}</h3>
            <p class="area-item-subtitle">${subtitle}</p>
            <div class="area-item-icons">
              <svg class="area-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-width="2" stroke-linecap="round"/>
                <circle cx="9" cy="7" r="4" stroke-width="2"/>
              </svg>
              <svg class="area-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="2"/>
                <path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          ${imageUrl ? `<img src="${imageUrl}" alt="${title}" class="area-item-thumb" onerror="this.style.display='none'" />` : ''}
          <svg class="area-item-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      `;
    }).join('');
    
    document.querySelectorAll('.area-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.areaIndex);
        const area = areas[index];
        

        handleClick({ features: [area] });
        

        if (area.geometry && (area.geometry.type === "Polygon" || area.geometry.type === "MultiPolygon")) {
          let center = null;
          try {
            if (area.geometry.type === "Polygon") {
              const ring = area.geometry.coordinates[0];
              let sx = 0, sy = 0;
              ring.forEach(c => { sx += c[0]; sy += c[1]; });
              center = [sx / ring.length, sy / ring.length];
            } else if (area.geometry.type === "MultiPolygon") {
              const ring = area.geometry.coordinates[0][0];
              let sx = 0, sy = 0;
              ring.forEach(c => { sx += c[0]; sy += c[1]; });
              center = [sx / ring.length, sy / ring.length];
            }
            
            if (center) {
              map.flyTo({
                center: center,
                zoom: Math.max(map.getZoom(), 17),
                duration: 1000
              });
            }
          } catch (err) {
            console.error("Error flying to area:", err);
          }
        }
      });
    });
  }

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

    const IMAGE_BASE_URL = "https://pub-df9eaf452da44f0ea2cbbcb1a6cd55ac.r2.dev/images/";

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
      minzoom: 0,
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
      minzoom: 0,
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
      minzoom: 0,
      filter: [
        "all",
        ["!=", ["get", "element_type"], "district"],
        ["!=", ["get", "element_type"], "tree"]
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
      minzoom: 0,
      filter: [
        "all",
        ["!=", ["get", "element_type"], "district"],
        ["!=", ["get", "element_type"], "tree"]
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
      minzoom: 0,
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
        maxzoom: 8,
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

    let attemptCount = 0;
    const maxAttempts = 10; 
    
    function loadFeaturesList() {
      try {
        console.log(`Attempt ${attemptCount + 1}/${maxAttempts} to load features at zoom ${map.getZoom()}`);
        
        const features = map.queryRenderedFeatures({
          layers: ["areas-fill-other", "areas-outline-other", "areas-fill-district", "areas-outline-district"]
        });
        
        console.log(`Found ${features.length} total features`);
        
        if (features.length > 0 || attemptCount >= maxAttempts) {
          const seen = new Set();
          
         
          allAreas = features.filter(f => {
            if (!f || !f.properties) return false;
            
          
            if (f.properties.element_type === "tree") {
              console.log("Skipping tree:", f.properties.nome_comune);
              return false;
            }
            
        
            const identifier = f.properties.nome || f.properties.description || f.properties.id || JSON.stringify(f.properties);
            if (seen.has(identifier)) return false;
            seen.add(identifier);
            
            console.log("Adding area:", f.properties.nome || f.properties.description || f.properties.id);
            return true;
          });
          
          console.log(`Loaded ${allAreas.length} green areas for list (attempt ${attemptCount + 1})`);
          
          if (allAreas.length > 0) {
            renderAreasList(allAreas);
          } else if (attemptCount >= maxAttempts) {
            areasList.innerHTML = `
              <div class="no-results">
                <p>No green areas visible at this zoom level.<br>Zoom in to see more areas.</p>
              </div>
            `;
          } else {
            areasList.innerHTML = `
              <div class="no-results">
                <p>Loading green areas...</p>
              </div>
            `;
          }
        } else {
          attemptCount++;
          setTimeout(loadFeaturesList, 800);  
        }
      } catch (err) {
        console.error("Error loading list:", err);
        attemptCount++;
        if (attemptCount < maxAttempts) {
          setTimeout(loadFeaturesList, 800);
        }
      }
    }
    
  
    setTimeout(loadFeaturesList, 500);

    map.on("moveend", () => {
      if (searchPanel && searchPanel.style.display !== "none") {
        try {
          const features = map.queryRenderedFeatures({
            layers: ["areas-fill-other", "areas-outline-other", "areas-fill-district", "areas-outline-district"]
          });
          
          const existingIds = new Set(allAreas.map(a => {
            const p = a.properties || {};
            return p.nome || p.description || p.id || JSON.stringify(p);
          }));
          
          features.forEach(f => {
            if (!f || !f.properties) return;
            
        
            if (f.properties.element_type === "tree") return;
            
            const identifier = f.properties.nome || f.properties.description || f.properties.id || JSON.stringify(f.properties);
            if (!existingIds.has(identifier)) {
              allAreas.push(f);
              existingIds.add(identifier);
            }
          });
          
          filterAreasList();
        } catch (err) {
         
        }
      }
    });


    map.on("click", "areas-fill-district",    handleClick);
    map.on("click", "areas-outline-district", handleClick);
    map.on("click", "areas-fill-other",       handleClick);
    map.on("click", "areas-outline-other",    handleClick);
    map.on("click", "areas-symbol",           handleClick);
    map.on("click", "trees-points",           handleClick);
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