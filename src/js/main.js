initControls();
renderAll();
initCuaca();
initBanjir();
initEws();
initIPU();
initFloodLayer();
initPetaKawalan();
initAmaranDG();
window.famaScenariosReady = initScenarios();
window.DASHBOARD_TEST = {
  state,
  DATA,
  selectPO,
  selectDistrict,
  renderAll,
  setEwsTab,
  renderEws,
  ewsState: () => ({ tab: state.ewsTab, muse: museEwsState.status }),
  filteredRecords,
  poStatus,
  scenarioStats,
  selectScenario,
  openScenarioPO,
  backToScenarioList,
  initScenarios,
  scenarioList: () => SCEN_LIST,
  setScenarios: (list) => {
    applyScenarios(list);
    renderAll();
  },
  ScenarioService,
  scenarioInterventionContext,
  floodLayer: () => ({
    visible: banjirLapisan.tunjuk,
    semua: banjirLapisan.semua,
    filter: banjirPenapis(),
    features: banjirFitur().length,
    dipasang: banjirLapisan.sedia,
  }),
  bukaPopupStesen,
  stesenPopupNode,
  senaraiAmaranRasmi,
  peta: () => {
    const st = map ? map.getStyle() : null;
    const asas = st && st.sources['peta-asas'];
    return {
      asas: petaAsas,
      gayaDimuat,
      tiles: asas ? asas.tiles : null,
      maxzoom: asas ? asas.maxzoom : null,
      attribusi: asas ? asas.attribution : null,
      sumber: st ? Object.keys(st.sources) : [],
      lapisan: {
        banjir: !!(map && map.getLayer('banjir-stesen')),
        amaran: !!(map && map.getLayer('amaran-cuaca')),
        amaranTunjuk:
          map && map.getLayer('amaran-cuaca')
            ? map.getLayoutProperty('amaran-cuaca', 'visibility')
            : null,
      },
      fiturBanjir: banjirFitur().length,
      fiturAmaran: window.FamaAmaranPeta ? FamaAmaranPeta.ujian().fitur : [],
      markerPO: mapMarkers.filter((m) => m.getElement().classList.contains('po-marker')).length,
      markerPOTambahan: mapMarkers.filter((m) => m.getElement().classList.contains('po-tbh'))
        .length,
    };
  },
  gmapsUrl,
  amaranDGMuat: initAmaranDG,
  cuaca: window.FamaCuaca ? FamaCuaca.ujian : null,
};
