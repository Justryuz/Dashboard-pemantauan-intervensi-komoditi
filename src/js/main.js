initControls();
renderAll();
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
  scenarioDummy: () => JSON.parse(JSON.stringify(SCENARIOS_DUMMY)),
  ScenarioService,
  scenarioInterventionContext,
};
