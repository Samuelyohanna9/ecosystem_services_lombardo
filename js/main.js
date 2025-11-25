import { initHomePage } from "./pages/home.js";
import { initTreesPage } from "./pages/trees.js";
import { initMapPage } from "./pages/map.js";

const navLinks = document.querySelectorAll("nav a");
const pages = document.querySelectorAll(".page");

export function openPage(id){
  pages.forEach(p => p.classList.toggle("active", p.id === id));
  navLinks.forEach(a => a.classList.toggle("active", a.dataset.page === id));
}

navLinks.forEach(a=>{
  a.addEventListener("click", ()=>openPage(a.dataset.page));
});

initHomePage();
initTreesPage();
initMapPage({ openPage });
