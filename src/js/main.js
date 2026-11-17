initControls();
renderAll();
initCuaca();
initBanjir();
initFloodLayer();
window.famaScenariosReady = initScenarios();
window.DASHBOARD_TEST = {
  state,
  DATA,
  selectPO,
  selectDistrict,
  renderAll,
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
};
