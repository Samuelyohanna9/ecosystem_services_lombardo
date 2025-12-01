export function setupSidebarHandle(sidebar, sidebarHandle){
  const btnClose = document.getElementById("btnClose");

  function positionHandle(){
    const mapPage = document.getElementById("mapPage");
    const pageRect = mapPage.getBoundingClientRect();

    if(sidebar.classList.contains("open")){
      const sbRect = sidebar.getBoundingClientRect();
      sidebarHandle.style.left = (sbRect.right - pageRect.left - 10) + "px";
      sidebarHandle.classList.add("open");
      sidebarHandle.setAttribute("aria-label","Hide sidebar");
    } else {
      sidebarHandle.style.left = "0px";
      sidebarHandle.classList.remove("open");
      sidebarHandle.setAttribute("aria-label","Show sidebar");
    }
  }

  sidebarHandle.addEventListener("click", ()=>{
    sidebar.classList.toggle("open");
    positionHandle();
  });

  btnClose.addEventListener("click", ()=>{
    sidebar.classList.remove("open");
    positionHandle();
  });

  window.addEventListener("resize", positionHandle);

  
  return { positionHandle };
}