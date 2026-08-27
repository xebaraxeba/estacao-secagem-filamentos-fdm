/**
 * ============================================================================
 * ESTAÇÃO DE SECAGEM DE FILAMENTOS FDM: SIMULADOR & PROTOTIPAGEM VIRTUAL
 * Item 3: Metodologia e Desenvolvimento Prático do Projeto
 * Engine de Física Termodinâmica, Barramento I2C, PID Relay Windowing e HIL
 * ============================================================================
 */

// --- 1. CONFIGURAÇÕES & PERFIS DE MATERIAIS POLIMÉRICOS ---
const PROFILES = {
  PLA:   { name: "PLA",   targetTemp: 48.0, maxSafeTemp: 55.0, durationMin: 240, Kp: 3.2, Ki: 0.05, Kd: 12.0, c0: 0.85 },
  PETG:  { name: "PETG",  targetTemp: 65.0, maxSafeTemp: 75.0, durationMin: 240, Kp: 3.8, Ki: 0.06, Kd: 15.0, c0: 1.20 },
  ABS:   { name: "ABS",   targetTemp: 78.0, maxSafeTemp: 90.0, durationMin: 300, Kp: 4.5, Ki: 0.08, Kd: 18.0, c0: 0.60 },
  TPU:   { name: "TPU",   targetTemp: 52.0, maxSafeTemp: 60.0, durationMin: 480, Kp: 3.0, Ki: 0.04, Kd: 10.0, c0: 1.50 },
  NYLON: { name: "NYLON", targetTemp: 75.0, maxSafeTemp: 85.0, durationMin: 480, Kp: 4.2, Ki: 0.07, Kd: 16.0, c0: 2.80 },
  PC:    { name: "PC",    targetTemp: 90.0, maxSafeTemp: 95.0, durationMin: 360, Kp: 5.0, Ki: 0.10, Kd: 20.0, c0: 0.45 }
};

// --- 2. ESTADO GLOBAL DO SISTEMA ---
const State = {
  activeProfileKey: "PETG",
  controlMode: "PID", // "PID" ou "ONOFF"
  fsmState: "IDLE",   // IDLE, HEATING, REGULATION, COOLING, ALARM_OVERTEMP, ALARM_I2C
  
  // Parâmetros Físicos Atuais
  chamberTemp: 24.0,
  chamberHum: 68.0,
  heaterTemp: 24.0,
  spoolTemp: 24.0,
  
  // Ambiente Externo
  ambientTemp: 22.0,
  ambientHum: 65.0,
  
  // Controle PID e Relay Windowing
  pidEffort: 0.0,     // 0 a 100%
  integral: 0.0,
  prevError: 0.0,
  dFiltered: 0.0,
  
  windowSizeMs: 5000,
  windowStartTime: 0,
  isMosfetActive: false,
  isExhaustActive: false,
  
  // Falhas Injetadas HIL
  faultI2C: false,
  faultOvertemp: false,
  thermalShockActive: false,
  
  // Temporização e Estatísticas
  cycleStartTime: 0,
  elapsedCycleMs: 0,
  simTimeMs: 0,
  
  // Buffers de Telemetria e Gráficos
  historyTemp: [],
  historySetpoint: [],
  historyPid: [],
  historyTime: [],
  maxHistoryPoints: 200,
  
  telemetryLogs: [],
  totalTelemetryLines: 0
};

// --- 3. INICIALIZAÇÃO DA APLICAÇÃO ---
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initControls();
  initCanvases();
  initDraggableComponents();
  startSimulationLoop();

  // Redesenha gráficos ao redimensionar a janela
  window.addEventListener("resize", () => {
    drawOscilloscope();
    drawFickianChart();
  });
});

// --- 4. GERENCIAMENTO DE TABS ---
function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanes = document.querySelectorAll(".tab-pane");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add("active");

      // Redesenha gráficos se necessário
      if (targetId === "tab-telemetry") drawOscilloscope();
      if (targetId === "tab-fick") drawFickianChart();
    });
  });
}

// --- 5. EVENTOS DOS CONTROLES IHM & INJEÇÃO DE FALHAS ---
function initControls() {
  // Seletor de Perfis
  const profileButtons = document.querySelectorAll(".btn-profile");
  profileButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      if (State.fsmState === "IDLE" || State.fsmState === "SELECT") {
        profileButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        setProfile(btn.getAttribute("data-profile"));
      }
    });
  });

  // Botões Virtuais do SVG
  const btnSelectVirtual = document.getElementById("btnSelectVirtual");
  if (btnSelectVirtual) {
    btnSelectVirtual.addEventListener("click", () => {
      cycleNextProfile();
    });
  }

  const btnStartVirtual = document.getElementById("btnStartVirtual");
  if (btnStartVirtual) {
    btnStartVirtual.addEventListener("click", () => {
      toggleCycle();
    });
  }

  // Botões de Ação HTML
  const btnStart = document.getElementById("btnStartCycle");
  if (btnStart) {
    btnStart.addEventListener("click", () => toggleCycle());
  }

  const btnStop = document.getElementById("btnEmergencyStop");
  if (btnStop) {
    btnStop.addEventListener("click", () => emergencyStop());
  }

  // Master Digital Twin Button
  const btnDigitalTwin = document.getElementById("btnDigitalTwin");
  if (btnDigitalTwin) {
    btnDigitalTwin.addEventListener("click", () => {
      // Inicia a máquina virtual
      if (State.fsmState === "IDLE" || State.fsmState === "SELECT") {
        toggleCycle();
      }
      
      // Feedback visual global
      btnDigitalTwin.style.background = "#22c55e";
      btnDigitalTwin.style.color = "#070c18";
      btnDigitalTwin.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> TWIN SYNC ON`;
      
      // Pulso nas abas
      document.querySelectorAll(".tab-btn").forEach(t => {
        t.style.transition = "box-shadow 0.3s";
        t.style.boxShadow = "0 0 15px rgba(56, 189, 248, 0.4) inset";
      });
      setTimeout(() => {
        document.querySelectorAll(".tab-btn").forEach(t => t.style.boxShadow = "none");
      }, 1500);
    });
  }

  // Rádios de Modo de Controle (PID vs On-Off)
  document.querySelectorAll("input[name='controlModeRadio']").forEach(radio => {
    radio.addEventListener("change", (e) => {
      State.controlMode = e.target.value;
      State.integral = 0.0;
    });
  });

  // Sliders HIL
  const sliderTamb = document.getElementById("sliderTamb");
  if (sliderTamb) {
    sliderTamb.addEventListener("input", (e) => {
      State.ambientTemp = parseFloat(e.target.value);
      document.getElementById("valTamb").innerText = `${State.ambientTemp.toFixed(1)} °C`;
    });
  }

  const sliderRHamb = document.getElementById("sliderRHamb");
  if (sliderRHamb) {
    sliderRHamb.addEventListener("input", (e) => {
      State.ambientHum = parseFloat(e.target.value);
      document.getElementById("valRHamb").innerText = `${State.ambientHum.toFixed(1)} %`;
    });
  }

  // Injeção de Perturbações
  document.getElementById("btnThermalShock")?.addEventListener("click", () => {
    State.thermalShockActive = true;
    setTimeout(() => { State.thermalShockActive = false; }, 3500);
  });

  document.getElementById("btnDisconnectSensor")?.addEventListener("click", () => {
    State.faultI2C = true;
    State.fsmState = "ALARM_I2C";
  });

  document.getElementById("btnOverTempFault")?.addEventListener("click", () => {
    State.chamberTemp = 92.5;
    State.faultOvertemp = true;
    State.fsmState = "ALARM_OVERTEMP";
  });

  document.getElementById("btnResetFaults")?.addEventListener("click", () => {
    State.faultI2C = false;
    State.faultOvertemp = false;
    State.fsmState = "IDLE";
    State.chamberTemp = State.ambientTemp;
    State.chamberHum = State.ambientHum;
  });

  // Exportar CSV
  document.getElementById("btnExportCSV")?.addEventListener("click", () => exportCSV());
}

function setProfile(key) {
  if (PROFILES[key]) {
    State.activeProfileKey = key;
    State.integral = 0.0;
    State.prevError = 0.0;
    updateUIElements();
  }
}

function cycleNextProfile() {
  const keys = Object.keys(PROFILES);
  const curIdx = keys.indexOf(State.activeProfileKey);
  const nextKey = keys[(curIdx + 1) % keys.length];
  
  document.querySelectorAll(".btn-profile").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-profile") === nextKey);
  });
  setProfile(nextKey);
}

function toggleCycle() {
  if (State.fsmState === "IDLE" || State.fsmState === "SELECT") {
    State.fsmState = "HEATING";
    State.cycleStartTime = Date.now();
    State.integral = 0.0;
    State.windowStartTime = Date.now();
    document.getElementById("startBtnIcon").innerText = "⏸";
    document.getElementById("btnStartCycle").innerHTML = `<span id="startBtnIcon">⏸</span> Pausar Secagem`;
  } else {
    State.fsmState = "COOLING";
    document.getElementById("startBtnIcon").innerText = "▶";
    document.getElementById("btnStartCycle").innerHTML = `<span id="startBtnIcon">▶</span> Iniciar Secagem`;
  }
}

function emergencyStop() {
  State.fsmState = "IDLE";
  State.pidEffort = 0.0;
  State.isMosfetActive = false;
  State.integral = 0.0;
  document.getElementById("startBtnIcon").innerText = "▶";
  document.getElementById("btnStartCycle").innerHTML = `<span id="startBtnIcon">▶</span> Iniciar Secagem`;
}

// --- 6. MOTOR DE SIMULAÇÃO TÉRMICA & FISICA (5 Hz = 200 ms) ---
function startSimulationLoop() {
  const dt = 0.2; // 200 ms por passo de simulação
  
  setInterval(() => {
    State.simTimeMs += 200;
    const now = Date.now();
    const prof = PROFILES[State.activeProfileKey];
    
    // --- 1. AVALIAÇÃO DE FAILSAFES ---
    if (State.faultI2C) {
      State.fsmState = "ALARM_I2C";
      State.pidEffort = 0.0;
      State.isMosfetActive = false;
    } else if (State.chamberTemp >= 90.0 || State.chamberTemp > prof.maxSafeTemp) {
      State.fsmState = "ALARM_OVERTEMP";
      State.pidEffort = 0.0;
      State.isMosfetActive = false;
    }

    // --- 2. CONTROLE PID OU ON-OFF ---
    if (State.fsmState === "HEATING" || State.fsmState === "REGULATION") {
      const setpoint = prof.targetTemp;
      const error = setpoint - State.chamberTemp;

      if (State.controlMode === "PID") {
        // Anti-windup
        if (Math.abs(error) < 10.0) {
          State.integral += prof.Ki * error * dt;
          State.integral = Math.max(0.0, Math.min(100.0, State.integral));
        } else if (error <= -10.0) {
          State.integral = 0.0;
        }

        const dRaw = (error - State.prevError) / dt;
        State.dFiltered = 0.7 * State.dFiltered + 0.3 * dRaw;
        State.prevError = error;

        const pTerm = prof.Kp * error;
        const dTerm = prof.Kd * State.dFiltered;
        
        let effort = pTerm + State.integral + dTerm;
        State.pidEffort = Math.max(0.0, Math.min(100.0, effort));

      } else {
        // Termostato On-Off com Histerese de ±1.0°C
        if (State.chamberTemp < (setpoint - 1.0)) {
          State.pidEffort = 100.0;
        } else if (State.chamberTemp > (setpoint + 1.0)) {
          State.pidEffort = 0.0;
        }
      }

      // Transição de estado FSM
      if (State.fsmState === "HEATING" && State.chamberTemp >= (setpoint - 1.0)) {
        State.fsmState = "REGULATION";
      }

    } else if (State.fsmState === "COOLING") {
      State.pidEffort = 0.0;
      if (State.chamberTemp <= (State.ambientTemp + 3.0)) {
        State.fsmState = "IDLE";
      }
    } else {
      State.pidEffort = 0.0;
    }

    // --- 3. MODULAÇÃO RELAY WINDOWING (5000 ms) ---
    const windowElapsed = (State.simTimeMs % State.windowSizeMs);
    const onTimeMs = (State.pidEffort / 100.0) * State.windowSizeMs;
    State.isMosfetActive = (State.fsmState === "HEATING" || State.fsmState === "REGULATION") && (windowElapsed < onTimeMs);

    // --- 4. EXAUSTOR DE UMIDADE (HISTERESE) ---
    if (State.fsmState === "HEATING" || State.fsmState === "REGULATION") {
      if (State.chamberHum > 45.0) {
        State.isExhaustActive = true;
      } else if (State.chamberHum < 30.0) {
        State.isExhaustActive = false;
      }
    } else if (State.fsmState === "COOLING") {
      State.isExhaustActive = true;
    } else {
      State.isExhaustActive = false;
    }

    // --- 5. MODELO TÉRMICO EM ESPAÇO DE ESTADOS (EQUAÇÕES DIFERENCIAIS) ---
    const P_max = 60.0; // 60W Peltier
    const q_in = (State.isMosfetActive ? 1.0 : 0.0) * P_max;
    
    // Parâmetros de capacitância e condutância
    const C_h = 180.0;
    const C_air = 45.0;
    const C_spool = 900.0;
    const G_ha = 8.5;
    const G_as = 3.2;
    let G_amb = 0.95;

    // Se houver choque térmico (abertura da tampa da estufa)
    if (State.thermalShockActive) {
      G_amb = 12.0; // Perda maciça por convecção livre com o meio externo
    }

    const dx1 = (q_in - G_ha * (State.heaterTemp - State.chamberTemp)) / C_h;
    const dx2 = (G_ha * (State.heaterTemp - State.chamberTemp) - G_as * (State.chamberTemp - State.spoolTemp) - G_amb * (State.chamberTemp - State.ambientTemp)) / C_air;
    const dx3 = (G_as * (State.chamberTemp - State.spoolTemp)) / C_spool;

    State.heaterTemp += dx1 * dt;
    State.chamberTemp += dx2 * dt;
    State.spoolTemp += dx3 * dt;

    // Dinâmica de Umidade
    if (State.isExhaustActive) {
      State.chamberHum = Math.max(State.ambientHum * 0.25, State.chamberHum - 0.25);
    } else if (State.chamberTemp > 35.0) {
      // Dessorção Fickiana libera vapor na câmara
      State.chamberHum = Math.min(85.0, State.chamberHum + 0.05);
    } else {
      State.chamberHum = 0.98 * State.chamberHum + 0.02 * State.ambientHum;
    }

    // --- 6. ATUALIZA HISTÓRICO DE TELEMETRIA ---
    State.historyTime.push((State.simTimeMs / 1000).toFixed(1));
    State.historyTemp.push(State.chamberTemp);
    State.historySetpoint.push(prof.targetTemp);
    State.historyPid.push(State.pidEffort);

    if (State.historyTemp.length > State.maxHistoryPoints) {
      State.historyTime.shift();
      State.historyTemp.shift();
      State.historySetpoint.shift();
      State.historyPid.shift();
    }

    // --- 7. LOG DE TELEMETRIA HIL ---
    logTelemetryLine();

    // --- 8. ATUALIZAÇÃO VISUAL ---
    updateUIElements();
    updateCircuitSvgVisuals(windowElapsed);
    drawOscilloscope();

  }, 200);
}

// --- 7. ATUALIZAÇÃO DE ELEMENTOS DA UI ---
function updateUIElements() {
  const prof = PROFILES[State.activeProfileKey];

  // Gauges
  document.getElementById("gaugeTemp").innerText = `${State.chamberTemp.toFixed(1)} °C`;
  document.getElementById("gaugeSetpoint").innerText = `${prof.targetTemp.toFixed(1)} °C`;
  document.getElementById("gaugeHum").innerText = `${State.chamberHum.toFixed(1)} %`;
  document.getElementById("gaugePid").innerText = `${State.pidEffort.toFixed(1)} %`;
  document.getElementById("gaugeState").innerText = State.fsmState;

  // Progress Bars
  document.getElementById("tempProgressBar").style.width = `${Math.min(100, (State.chamberTemp / 100) * 100)}%`;
  document.getElementById("humProgressBar").style.width = `${Math.min(100, State.chamberHum)}%`;
  document.getElementById("pidProgressBar").style.width = `${Math.min(100, State.pidEffort)}%`;

  // Relay Windowing Tracker
  const onPercent = (State.pidEffort).toFixed(1);
  document.getElementById("windowOnBar").style.width = `${onPercent}%`;
  
  const windowTimeSec = ((State.simTimeMs % State.windowSizeMs) / 1000).toFixed(1);
  document.getElementById("windowTimerText").innerText = `t = ${windowTimeSec}s / 5.0s`;
  document.getElementById("windowCursor").style.left = `${((State.simTimeMs % State.windowSizeMs) / State.windowSizeMs) * 100}%`;

  // LCD 16x2 Text & Global Alarm States
  const lcdL1 = document.getElementById("lcdLine1");
  const lcdL2 = document.getElementById("lcdLine2");
  const sysBadge = document.getElementById("systemStatusBadge");
  const header = document.querySelector(".app-header");
  
  if (State.fsmState === "ALARM_OVERTEMP") {
    if (lcdL1) lcdL1.innerText = "!ALARM: OVERTEMP";
    if (lcdL2) lcdL2.innerText = "T > MAX SAFE LIM";
    if (header) header.style.borderBottom = "2px solid #ef4444";
    if (sysBadge) {
      sysBadge.innerHTML = '<span class="pulse-dot" style="background:#ef4444;box-shadow:0 0 10px #ef4444;"></span> ALARME (OVERTEMP)';
      sysBadge.style.color = "#ef4444";
      sysBadge.style.background = "rgba(239, 68, 68, 0.12)";
      sysBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
    }
  } else if (State.fsmState === "ALARM_I2C") {
    if (lcdL1) lcdL1.innerText = "!ERR: SENSOR I2C";
    if (lcdL2) lcdL2.innerText = "CHECK WIRING A4 ";
    if (header) header.style.borderBottom = "2px solid #ef4444";
    if (sysBadge) {
      sysBadge.innerHTML = '<span class="pulse-dot" style="background:#ef4444;box-shadow:0 0 10px #ef4444;"></span> ALARME (I2C FALHA)';
      sysBadge.style.color = "#ef4444";
      sysBadge.style.background = "rgba(239, 68, 68, 0.12)";
      sysBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
    }
  } else {
    if (lcdL1) lcdL1.innerText = `${prof.name.padEnd(5, " ")} ${Math.round(prof.targetTemp)}C  04h00m`;
    const hIndicator = State.isMosfetActive ? "[H]" : (State.isExhaustActive ? "[F]" : "   ");
    if (lcdL2) lcdL2.innerText = `T:${State.chamberTemp.toFixed(1)}C H:${Math.round(State.chamberHum)}% ${hIndicator}`;
    
    // Normal State Revert
    if (header) header.style.borderBottom = "1px solid var(--border-color)";
    if (sysBadge) {
      sysBadge.innerHTML = '<span class="pulse-dot"></span> SISTEMA ATIVO (5 Hz HIL)';
      sysBadge.style.color = "#4ade80";
      sysBadge.style.background = "rgba(34, 197, 94, 0.12)";
      sysBadge.style.borderColor = "rgba(34, 197, 94, 0.3)";
    }
  }
}

// --- 8. ATUALIZAÇÃO DO ESQUEMA VIRTUAL SVG ---
function updateCircuitSvgVisuals(windowElapsed) {
  // MOSFET LED & Text
  const mosfetText = document.getElementById("mosfetDutyText");
  const mosfetLed = document.getElementById("mosfetLedIndicator");
  const wirePwm = document.getElementById("wirePwmGate");
  const compPeltier = document.getElementById("comp-peltier");

  if (State.isMosfetActive) {
    if (mosfetText) mosfetText.innerText = `PWM: ${State.pidEffort.toFixed(1)}% (ON)`;
    if (mosfetLed) mosfetLed.setAttribute("fill", "#22c55e");
    if (wirePwm) wirePwm.setAttribute("stroke", "#22c55e");
    document.getElementById("peltierPowerReadout").innerText = `Potência Atual: ${(State.pidEffort * 0.6).toFixed(1)} W`;
    document.getElementById("psuPowerReadout").innerText = `I: ${(4.85 * (State.pidEffort / 100)).toFixed(2)}A | ${(58.2 * (State.pidEffort / 100)).toFixed(1)}W`;
  } else {
    if (mosfetText) mosfetText.innerText = `PWM: ${State.pidEffort.toFixed(1)}% (OFF)`;
    if (mosfetLed) mosfetLed.setAttribute("fill", "#64748b");
    if (wirePwm) wirePwm.setAttribute("stroke", "#f59e0b");
    document.getElementById("peltierPowerReadout").innerText = `Potência Atual: 0.0 W`;
    document.getElementById("psuPowerReadout").innerText = `I: 0.15A | 1.8W (Standby)`;
  }

  // Fan 1 (Primary Convection - Always Running)
  const compFan1 = document.getElementById("comp-fan1");
  if (compFan1) compFan1.classList.add("fan-running");

  // Fan 2 (Exhaust - Controlled by Hysteresis)
  const compFan2 = document.getElementById("comp-fan2");
  const exhaustStatus = document.getElementById("exhaustStatusText");
  const wireExhaust = document.getElementById("wireExhaust");

  if (State.isExhaustActive) {
    if (compFan2) compFan2.classList.add("fan-exhaust-running");
    if (exhaustStatus) {
      exhaustStatus.innerText = "STATUS: EXAUSTÃO ATIVA";
      exhaustStatus.setAttribute("fill", "#c084fc");
    }
    if (wireExhaust) wireExhaust.setAttribute("stroke", "#c084fc");
  } else {
    if (compFan2) compFan2.classList.remove("fan-exhaust-running");
    if (exhaustStatus) {
      exhaustStatus.innerText = "STATUS: DESLIGADO";
      exhaustStatus.setAttribute("fill", "#64748b");
    }
    if (wireExhaust) wireExhaust.setAttribute("stroke", "#a855f7");
  }
}

// --- 9. LOG TELEMETRIA HIL & EXPORTAÇÃO CSV ---
function logTelemetryLine() {
  const prof = PROFILES[State.activeProfileKey];
  let errorMsg = "NORMAL";
  if (State.faultI2C) errorMsg = "I2C_DISCONNECT";
  else if (State.faultOvertemp) errorMsg = "THERMAL_RUNAWAY";
  else if (State.thermalShockActive) errorMsg = "THERMAL_SHOCK_WARN";
  
  const row = `${State.simTimeMs},${State.fsmState},${State.chamberTemp.toFixed(2)},${prof.targetTemp.toFixed(1)},${State.chamberHum.toFixed(1)},${State.pidEffort.toFixed(1)},${State.isExhaustActive ? 1 : 0},${errorMsg}`;
  
  State.telemetryLogs.push(row);
  State.totalTelemetryLines++;

  const term = document.getElementById("terminalLogs");
  const countLabel = document.getElementById("terminalLineCount");
  
  if (term && State.totalTelemetryLines % 2 === 0) {
    const lineEl = document.createElement("div");
    lineEl.className = "log-line";
    
    // Add visual cues for faults
    if (errorMsg === "I2C_DISCONNECT" || errorMsg === "THERMAL_RUNAWAY") {
      lineEl.classList.add("error");
    } else if (errorMsg === "THERMAL_SHOCK_WARN") {
      lineEl.classList.add("warning");
    }
    
    lineEl.innerText = row;
    term.appendChild(lineEl);
    
    // Mantém máximo de 80 linhas visíveis no terminal
    if (term.childNodes.length > 80) {
      term.removeChild(term.firstChild);
    }
    term.scrollTop = term.scrollHeight;
  }

  if (countLabel) {
    countLabel.innerText = `${State.totalTelemetryLines} registros HIL`;
  }
}

function exportCSV() {
  const header = "TIMESTAMP_MS,STATE,TEMP_CURRENT,TEMP_SETPOINT,HUMIDITY_RH,PID_DUTY,EXHAUST_STATE,ERROR_MSG\n";
  const csvContent = "data:text/csv;charset=utf-8," + header + State.telemetryLogs.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `telemetria_hil_estacao_secagem_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// --- 10. OSCILOSCÓPIO & GRÁFICOS CANVASES ---
let scopeCanvas, scopeCtx;
let fickCanvas, fickCtx;

function initCanvases() {
  scopeCanvas = document.getElementById("scopeCanvas");
  if (scopeCanvas) scopeCtx = scopeCanvas.getContext("2d");

  fickCanvas = document.getElementById("fickCanvas");
  if (fickCanvas) fickCtx = fickCanvas.getContext("2d");

  drawFickianChart();
}

function drawOscilloscope() {
  if (!scopeCtx || !scopeCanvas) return;
  
  // Ajuste dinâmico de resolução para preencher todo o espaço horizontal disponível
  if (scopeCanvas.clientWidth > 0 && scopeCanvas.width !== scopeCanvas.clientWidth) {
    scopeCanvas.width = scopeCanvas.clientWidth;
  }
  if (scopeCanvas.clientHeight > 0 && scopeCanvas.height !== scopeCanvas.clientHeight) {
    scopeCanvas.height = scopeCanvas.clientHeight;
  }

  const w = scopeCanvas.width;
  const h = scopeCanvas.height;
  
  // Limpa fundo
  scopeCtx.fillStyle = "#070c18";
  scopeCtx.fillRect(0, 0, w, h);

  // Grade
  scopeCtx.strokeStyle = "#162032";
  scopeCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 50) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(x, 0);
    scopeCtx.lineTo(x, h);
    scopeCtx.stroke();
  }
  for (let y = 0; y < h; y += 40) {
    scopeCtx.beginPath();
    scopeCtx.moveTo(0, y);
    scopeCtx.lineTo(w, y);
    scopeCtx.stroke();
  }

  // Linha de Setpoint (Amarelo pontilhado)
  const prof = PROFILES[State.activeProfileKey];
  const setpointY = h - (prof.targetTemp / 100.0) * (h - 40) - 20;
  scopeCtx.strokeStyle = "#eab308";
  scopeCtx.setLineDash([5, 5]);
  scopeCtx.lineWidth = 1.5;
  scopeCtx.beginPath();
  scopeCtx.moveTo(0, setpointY);
  scopeCtx.lineTo(w, setpointY);
  scopeCtx.stroke();
  scopeCtx.setLineDash([]);

  scopeCtx.fillStyle = "#eab308";
  scopeCtx.font = "11px 'Fira Code', monospace";
  scopeCtx.fillText(`Setpoint: ${prof.targetTemp}°C`, 10, setpointY - 6);

  // Traçado da Curva de Temperatura (Ciano)
  if (State.historyTemp.length > 1) {
    scopeCtx.strokeStyle = "#38bdf8";
    scopeCtx.lineWidth = 2.5;
    scopeCtx.beginPath();
    
    const stepX = w / State.maxHistoryPoints;
    for (let i = 0; i < State.historyTemp.length; i++) {
      const x = i * stepX;
      const y = h - (State.historyTemp[i] / 100.0) * (h - 40) - 20;
      if (i === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();
  }

  // Traçado da Curva de PWM PID (Laranja translúcido no fundo)
  if (State.historyPid.length > 1) {
    scopeCtx.strokeStyle = "rgba(245, 158, 11, 0.4)";
    scopeCtx.lineWidth = 1.5;
    scopeCtx.beginPath();
    const stepX = w / State.maxHistoryPoints;
    for (let i = 0; i < State.historyPid.length; i++) {
      const x = i * stepX;
      const y = h - (State.historyPid[i] / 100.0) * (h - 60) - 10;
      if (i === 0) scopeCtx.moveTo(x, y);
      else scopeCtx.lineTo(x, y);
    }
    scopeCtx.stroke();
  }

  // Legenda
  scopeCtx.fillStyle = "#38bdf8";
  scopeCtx.fillText(`— Temp. Atual (${State.chamberTemp.toFixed(1)}°C)`, w - 210, 25);
  scopeCtx.fillStyle = "#f59e0b";
  scopeCtx.fillText(`— Esforço PWM (${State.pidEffort.toFixed(1)}%)`, w - 210, 45);
}

// --- 13. INFO POPUPS (BANCADA VIRTUAL) ---
function initDraggableComponents() {
  const modules = document.querySelectorAll('.circuit-module');
  const popup = document.getElementById('componentInfoPopup');
  const popupTitle = document.getElementById('popupTitle');
  const popupDesc = document.getElementById('popupDesc');
  const popupClose = document.getElementById('popupClose');
  
  if (popupClose) {
    popupClose.addEventListener('click', () => popup.style.display = 'none');
  }

  modules.forEach(mod => {
    mod.style.cursor = 'pointer';
    
    mod.addEventListener('click', (e) => {
      // Ignora se for o botão virtual interno
      if (e.target.closest('.interactive-btn-svg')) return;
      
      if (popup && mod.getAttribute('data-info-title')) {
        popupTitle.innerText = mod.getAttribute('data-info-title');
        popupDesc.innerText = mod.getAttribute('data-info-desc');
        popup.style.display = 'block';
        popup.style.left = `${e.pageX + 15}px`;
        popup.style.top = `${e.pageY + 15}px`;
      }
    });
  });
}

function drawFickianChart() {
  if (!fickCtx || !fickCanvas) return;
  
  // Ajuste dinâmico de resolução
  if (fickCanvas.clientWidth > 0 && fickCanvas.width !== fickCanvas.clientWidth) {
    fickCanvas.width = fickCanvas.clientWidth;
  }
  if (fickCanvas.clientHeight > 0 && fickCanvas.height !== fickCanvas.clientHeight) {
    fickCanvas.height = fickCanvas.clientHeight;
  }

  const w = fickCanvas.width;
  const h = fickCanvas.height;

  fickCtx.fillStyle = "#070c18";
  fickCtx.fillRect(0, 0, w, h);

  const startX = 50;
  const endX = w - 20;
  const stepX = (endX - startX) / 4;

  // Grade Vertical alinhada com as horas
  fickCtx.strokeStyle = "#162032";
  fickCtx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const x = startX + stepX * i;
    fickCtx.beginPath();
    fickCtx.moveTo(x, 20);
    fickCtx.lineTo(x, h - 30);
    fickCtx.stroke();
  }
  // Grade Horizontal
  for (let y = 30; y < h - 30; y += 40) {
    fickCtx.beginPath();
    fickCtx.moveTo(50, y);
    fickCtx.lineTo(w - 20, y);
    fickCtx.stroke();
  }

  // Eixos
  fickCtx.strokeStyle = "#475569";
  fickCtx.lineWidth = 2;
  fickCtx.beginPath();
  fickCtx.moveTo(50, 20);
  fickCtx.lineTo(50, h - 30);
  fickCtx.lineTo(w - 20, h - 30);
  fickCtx.stroke();

  // Rótulos Eixo Y
  fickCtx.fillStyle = "#94a3b8";
  fickCtx.font = "10px 'Fira Code', monospace";
  fickCtx.fillText("1.2%", 15, 35);
  fickCtx.fillText("0.8%", 15, 95);
  fickCtx.fillText("0.4%", 15, 155);
  fickCtx.fillText("0.1%", 15, 215);
  fickCtx.fillText("0.0%", 15, h - 30);

  // Rótulos Eixo X (Horas)
  for (let i = 0; i <= 4; i++) {
    const x = startX + stepX * i;
    // Centraliza levemente o texto subtraindo 6 pixels do X
    fickCtx.fillText(`${i}h`, x - 6, h - 12);
  }

  // Curva Exponencial de Fick: C(t) = C0 * exp(-k*t) + C_eq
  fickCtx.strokeStyle = "#38bdf8";
  fickCtx.lineWidth = 3;
  fickCtx.beginPath();
  
  const points = [
    { x: startX + stepX * 0,  y: 35 },   // 0h: 1.200%
    { x: startX + stepX * 1,  y: 95 },   // 1h: 0.810%
    { x: startX + stepX * 2,  y: 155 },  // 2h: 0.425%
    { x: startX + stepX * 3,  y: 200 },  // 3h: 0.195%
    { x: startX + stepX * 4,  y: 235 }   // 4h: 0.085%
  ];

  for (let i = 0; i < points.length; i++) {
    if (i === 0) fickCtx.moveTo(points[i].x, points[i].y);
    else {
      const xc = (points[i].x + points[i - 1].x) / 2;
      const yc = (points[i].y + points[i - 1].y) / 2;
      fickCtx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
    }
  }
  fickCtx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  fickCtx.stroke();

  // Pontos Marcadores
  points.forEach((p, idx) => {
    fickCtx.fillStyle = "#22c55e";
    fickCtx.beginPath();
    fickCtx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    fickCtx.fill();
    fickCtx.fillStyle = "#f8fafc";
    const labels = ["1.200%", "0.810%", "0.425%", "0.195%", "0.085%"];
    fickCtx.fillText(labels[idx], p.x + 6, p.y - 6);
  });
}
