# Estação de Secagem de Filamentos FDM de Baixo Custo
## Prototipagem Virtual (Tinkercad), Arquitetura Elétrica e Metodologia Prática (Item 3)

Este repositório contém o projeto de engenharia, arquitetura de hardware, esquemáticos elétricos, firmware C/C++ modular para Arduino, modelos de simulação termodinâmica em espaço de estados, difusão Fickiana e aplicação interativa de prototipagem virtual para a **Estação de Secagem de Filamentos de Manufatura Aditiva (FDM)** com controle em malha fechada via PID.

---

## 📁 Estrutura do Projeto

```
c:/Users/xexPC/Desktop/Projetos/
├── docs/                                  # Documentação Técnica e Rigor Científico
│   ├── 03_metodologia_e_desenvolvimento_pratico.md # Item 3 completo (Mecânica, Tinkercad, Firmware)
│   ├── arquitetura_eletrica_detalhada.md           # Análise das 3 malhas elétricas e dimensionamento
│   └── manual_operacao_e_tinkercad.md             # Guia passo a passo de montagem no Tinkercad
├── circuits/                              # Prototipagem Virtual e Circuitos
│   ├── schematic_tinkercad.svg            # Diagrama esquemático vetorial em alta definição
│   ├── wiring_guide_tinkercad.md          # Guia de ligações pino a pino na protoboard
│   ├── bill_of_materials.md               # Lista de componentes (BOM) e custos
│   └── netlist.json                       # Netlist formal dos circuitos em JSON
├── firmware/                              # Código-Fonte Modular C/C++ (Arduino Uno/Nano)
│   ├── FilamentDryerPID.ino               # Sketch principal com loop determinístico e HIL (5Hz)
│   ├── Config.h                           # Pinos, constantes PID e perfis (PLA, PETG, ABS, TPU, Nylon, PC)
│   ├── PID_Controller.h / .cpp            # Algoritmo PID com Relay Windowing (5000 ms) e Anti-Windup
│   ├── SensorBME280.h / .cpp              # Driver BME280 com filtro de média móvel (8 amostras)
│   ├── FSM.h / .cpp                       # Máquina de Estados Finitos de 7 estados
│   └── SafetyProtections.h / .cpp         # Watchdog I²C e corte por sobretemperatura (>90°C)
├── simulations/                           # Modelagem Matemática e Validação HIL
│   ├── state_space_thermal.py             # Modelo em Espaço de Estados (PID vs Termostato On-Off)
│   ├── fickian_diffusion.py               # Solução numérica da 2ª Lei de Fick (Arrhenius)
│   └── hil_telemetry_logger.py            # Automação de testes Hardware-in-the-Loop e exportação CSV
└── app/                                   # Plataforma Web Interativa de Prototipagem Virtual
    ├── index.html                         # Interface interativa (Tinkercad 2D, LCD 16x2, Osciloscópio)
    ├── styles.css                         # Design system industrial em Dark Mode
    └── app.js                             # Engine de simulação física, barramento I²C e telemetria
```

---

## ⚡ Como Executar a Prototipagem Virtual e Simulador

1. **Abrir a Aplicação Web Interativa**:
   - Abra o arquivo [app/index.html](file:///c:/Users/xexPC/Desktop/Projetos/app/index.html) em qualquer navegador web moderno (Google Chrome, Microsoft Edge, Firefox).
   - Você terá acesso imediato à:
     - **Bancada Virtual Tinkercad Circuits**: Simulação em tempo real da corrente elétrica, chaveamento do MOSFET, aquecimento da pastilha Peltier TEC1-12706, rotação das ventoinhas, acionamento do display LCD 16x2 I²C e botões tácteis interativos.
     - **Corte Mecânico da Câmara**: Visualização da caixa de Polipropileno (PP) revestida com isolamento aluminizado ($\epsilon = 0,05$), carretel sobre rolamentos 608ZZ e fluxo de ar convectivo toroidal ($Bi < 0,1$).
     - **Osciloscópio Dinâmico**: Curvas de estabilização térmica em malha fechada comparando o PID proposto frente ao termostato On-Off.
     - **Cinética de Difusão Fickiana**: Gráfico e tabela de remoção de umidade em PETG de 1,75 mm ($1,200\% \rightarrow 0,085\%$).
     - **Injeção de Perturbações (Bancada HIL)**: Injeção de choques térmicos, simulação de falhas de sensor I²C e exportação em 1 clique de arquivo CSV de telemetria serial a 5 Hz.

2. **Montagem no Autodesk Tinkercad**:
   - Consulte o [manual_operacao_e_tinkercad.md](file:///c:/Users/xexPC/Desktop/Projetos/docs/manual_operacao_e_tinkercad.md) e a [wiring_guide_tinkercad.md](file:///c:/Users/xexPC/Desktop/Projetos/circuits/wiring_guide_tinkercad.md) para posicionar os componentes e fazer as ligações pino a pino.
   - Carregue o código do arquivo [FilamentDryerPID.ino](file:///c:/Users/xexPC/Desktop/Projetos/firmware/FilamentDryerPID.ino) na aba de código do Tinkercad e inicie a simulação.

---

## 📊 Principais Resultados de Validação Científica

| Métrica de Desempenho | Controlador PID Proposto (Relay Windowing) | Termostato On-Off Convencional |
|---|---|---|
| **Sobressinal (Overshoot Máximo)** | **1,8% (pico 66,1°C)** | 13,0% (pico 73,4°C - Risco de fusão) |
| **Tempo de Acomodação (±2%)** | **~710 segundos (11,8 min)** | Infinito (Oscilação contínua) |
| **Erro de Regime Permanente** | **< 0,2°C** | Flutuação de ±4,5°C |
| **Dessorção Fickiana de Umidade (PETG 4h)** | **92,9% removida (0,085% residual)** | Não controlada |
