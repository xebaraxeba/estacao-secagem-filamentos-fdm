# Arquitetura Elétrica e Dimensionamento de Potência

Este documento detalha a topologia elétrica, os cálculos de dimensionamento, dissipação térmica, compatibilidade de níveis lógicos e proteção contra ruídos da **Estação de Secagem de Filamentos de Manufatura Aditiva (FDM)**.

---

## 1. Topologia de Alimentação e Distribuição

A estação opera com duas faixas de tensão interdependentes conectadas com **ponto único de aterramento (Star Ground)**:

```
                              [ REDE AC 110V / 220V ]
                                         |
                                         v
                         +-------------------------------+
                         | FONTE CHAVEADA 12V 10A (120W) |
                         +---------------+---------------+
                                         |
               +-------------------------+------------------------+
               | (+12V BARRAMENTO DE POTÊNCIA)                    | (+12V LÓGICA)
               v                                                  v
     +-------------------+                              +-------------------+
     | Pastilha Peltier  |                              | Vin Arduino Nano/ |
     | TEC1-12706 (60W)  |                              | Uno (Regulador 5V)|
     +---------+---------+                              +---------+---------+
               |                                                  |
       [Dreno MOSFET]                                     +-------+-------+
               |                                          | (5V)          | (3.3V)
     +---------+---------+                                v               v
     | Módulo MOSFET     |                      +-------------+   +-------------+
     | IRLZ44N / IRF520  |                      | Display LCD |   | Sensor MEMS |
     +---------+---------+                      | 16x2 + I2C  |   | BME280      |
               |                                +------+------+   +------+------+
     +---------+---------------------------------------+-----------------+
     |                     BARRAMENTO COMUM DE TERRA (GND)               |
     +-------------------------------------------------------------------+
```

---

## 2. Dimensionamento da Malha de Potência (12V)

### 2.1. Carga Principal: Módulo Termoelétrico Peltier (TEC1-12706)
- **Tensão Nominal ($V_{max}$)**: 12,0 V a 14,4 V DC.
- **Corrente Máxima ($I_{max}$)**: 6,0 A.
- **Potência Térmica/Dissipada Máxima ($Q_{max} + P_{joule}$)**: $\approx 60\text{ W}$ a $72\text{ W}$.
- **Resistência Interna Estimada ($R_{int}$)**: $\approx 1,98\ \Omega$.

### 2.2. Chaveamento por MOSFET Canal N (IRLZ44N / IRF520)
Para comutar a corrente de 6 A com segurança e sem superaquecimento do transistor:
- **Resistência em Condução ($R_{DS(on)}$)**:
  - *IRLZ44N (Logic-Level)*: $R_{DS(on)} \approx 0,022\ \Omega$ com $V_{GS} = 5\text{ V}$.
  - Potência dissipada em condução contínua:
    $$P_{cond} = I^2 \times R_{DS(on)} = (6\text{ A})^2 \times 0,022\ \Omega = 0,792\text{ W}$$
  - Com dissipador básico de alumínio ($\theta_{JA} \approx 15^\circ\text{C/W}$), a elevação de temperatura do semicondutor é de apenas:
    $$\Delta T = P \times \theta_{JA} = 0,792\text{ W} \times 15^\circ\text{C/W} = 11,88^\circ\text{C}$$
- **Circuito de Acionamento do Gate**:
  - Resistor em série no Gate ($R_G = 220\ \Omega$): Limita o pico de corrente de carga da capacitância intrínseca do Gate ($C_{iss} \approx 1700\text{ pF}$) a $I_{peak} = 5\text{ V} / 220\ \Omega = 22,7\text{ mA}$, perfeitamente dentro do limite seguro do ATmega328P ($I_{max} = 40\text{ mA}$).
  - Resistor de *pull-down* ($R_{PD} = 10\text{ k}\Omega$): Garante estado desligado (LOW) durante o *bootloader* e *reset* do microcontrolador.

### 2.3. Ventoinhas de Convecção e Exaustão
- **Ventoinha Primária (Convecção do Dissipador)**: 12 V DC / 0,15 A (1,8 W) conectada direto no barramento de 12V.
- **Ventoinha Secundária (Exaustor de Umidade)**: 12 V DC / 0,18 A (2,16 W) acionada por transistor NPN 2N2222:
  - Corrente de coletor: $I_C = 180\text{ mA}$.
  - Ganho mínimo ($\beta_{sat} \approx 20 \Rightarrow I_B \ge 9\text{ mA}$).
  - Resistor de base: $R_B = (5\text{ V} - 0,7\text{ V}) / 9\text{ mA} \approx 470\ \Omega$ (usou-se $1\text{ k}\Omega$ para operação com $I_B \approx 4,3\text{ mA}$, suficiente para saturar com $V_{CE(sat)} < 0,2\text{ V}$).
  - Diodo de proteção contra força contra-eletromotriz: 1N4007 em antiparalelo com a bobina do motor.

### 2.4. Balanço de Corrente e Potência Total do Sistema
| Subsistema | Tensão (V) | Corrente Máx. (A) | Potência Máx. (W) |
|---|---|---|---|
| Pastilha Peltier TEC1-12706 | 12 V | 5,50 A | 66,0 W |
| Ventoinha Primária (Dissipador) | 12 V | 0,15 A | 1,8 W |
| Ventoinha Secundária (Exaustor) | 12 V | 0,18 A | 2,16 W |
| Arduino Uno / Nano + LCD + BME280 | 12 V (via Vin) | 0,08 A | 0,96 W |
| **Total Simultâneo (Pico)** | **12 V** | **5,91 A** | **70,92 W** |
| **Capacidade da Fonte Recomendada** | **12 V** | **10,00 A** | **120,0 W** |
| **Margem de Segurança Operacional** | - | **+40,9% de folga** | **+49,08 W de reserva** |

---

## 3. Malha Lógica, Barramento I²C e Compatibilidade de Níveis

### 3.1. Topologia do Barramento I²C
- Linhas: **SDA (Pino A4)** e **SCL (Pino A5)** no Arduino Uno/Nano.
- Frequência de Operação: Modo Standard (100 kHz).
- Endereçamento:
  - Display LCD 16x2 com PCF8574: Endereço `0x27` (7 bits).
  - Sensor Bosch BME280: Endereço `0x76` (pino SDO aterrado) ou `0x77` (pino SDO em VCC).
- Resistores de *Pull-up*: O módulo BME280 comercial e o módulo I2C do LCD já integram resistores de elevação de 4,7 kΩ para a linha de 5V/3.3V, mantendo as bordas de subida bem definidas ($t_r < 1000\text{ ns}$).

### 3.2. Circuito de Botões IHM (Pinos D2 e D3)
- Configuração com resistores externos de *pull-down* de 10 kΩ:
  - Botão não pressionado $\rightarrow$ Nível lógico LOW (0 V).
  - Botão pressionado $\rightarrow$ Nível lógico HIGH (5 V).
  - Pinos configurados como `INPUT` com rotina de *software debounce* de 50 ms.
