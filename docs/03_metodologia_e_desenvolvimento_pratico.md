# 3. Metodologia e Desenvolvimento Prático do Projeto

Conduzir o projeto desde a fundamentação teórica até a concretização de um protótipo físico e virtual funcional exige uma sequência lógica e metodológica rigorosa. O planejamento obedeceu ao conceito de *End-to-End* (ponta a ponta), integrando desde a concepção geométrica e isolamento termodinâmico da câmara até a arquitetura eletroeletrônica, prototipagem virtual no Autodesk Tinkercad Circuits e desenvolvimento de firmware modular em C/C++ com controle em malha fechada (BANERJEE, 2021)¹.

---

## 3.1. Projeto Mecânico e CAD (Computer-Aided Design)

O envelope físico do sistema deve desempenhar três funções críticas simultâneas:
1. Fornecer isolamento térmico eficiente contra o meio externo, minimizando perdas condutivas e radiativas.
2. Servir de suporte estrutural de baixo atrito para carretéis de filamento variando de 500 g a 1000 g.
3. Garantir um volume selado e hermético com dinâmica de fluxo convectivo forçado para dessorção e exaustão controlada de vapor d'água (VALENTAN et al., 2019)¹.

```
 +-----------------------------------------------------------------------+
 |                     CÂMARA DE SECAGEM HERMÉTICA                      |
 |                                                                       |
 |   +---------------------------------------------------------------+   |
 |   | PAREDES DE POLIPROPILENO (PP) + ESPUMA EXPANDIDA ALUMINIZADA  |   |
 |   |                                                               |   |
 |   |      +-------------------------------------------------+      |   |
 |   |      |             CARRETEL DE FILAMENTO               |      |   |
 |   |      |                (500g a 1000g)                   |      |   |
 |   |      |                                                 |      |   |
 |   |      |           [ Eixo com Rolamentos 608ZZ ]         |      |   |
 |   |      +-------------------------------------------------+      |   |
 |   |                               |                               |   |
 |   |            Fluxo de Ar Convectivo Forçado (65°C)              |   |
 |   |                               v                               |   |
 |   |     +----------------------------------------------------+    |   |
 |   |     |    Duto Defletor Térmico Impresso em 3D            |    |   |
 |   |     |    +------------------------------------------+    |    |   |
 |   |     |    | Ventoinha Primária 12V (Convecção Cont.) |    |    |   |
 |   |     |    | Dissipador Aletado de Alumínio           |    |    |   |
 |   |     |    | Pastilha Peltier TEC1-12706 (Face Quente)|    |    |   |
 |   |     |    +------------------------------------------+    |    |   |
 |   |     +----------------------------------------------------+    |   |
 |   |                               |                               |   |
 |   |   [ Sensor BME280 - I2C ]     |  [ Exaustor Secundário 12V ]  |   |
 |   |   (Temperatura e Umidade)     |  (Acionamento por Histerese)  |   |
 |   +---------------------------------------------------------------+   |
 +-----------------------------------------------------------------------+
```

### 3.1.1. Seleção e Adequação do Contentor Principal
Para garantir padronização e máxima replicabilidade, descartou-se a manufatura de gabinetes artesanais em materiais frágeis. Em seu lugar, adotou-se a alteração mecânica de uma caixa hermética comercial injetada em **Polipropileno (PP)** de grau industrial (espessura nominal de parede de 2,5 mm e volume interno de aproximadamente 6,5 litros). O Polipropileno destaca-se por sua alta temperatura de deflexão térmica ($HDT \approx 100^\circ\text{C}$), excelente estabilidade química e custo acessível (VALENTAN et al., 2019)¹.

### 3.1.2. Blindagem Térmica e Eficiência Energética
Para mitigar as perdas por radiação infravermelha e condução através das paredes de PP, o interior da câmara foi integralmente revestido com **manta de espuma de polietileno expandido aluminizado** de 5 mm de espessura (IFG, 2024)¹. A face reflexiva de alumínio possui emissividade térmica reduzida ($\epsilon \approx 0,05$), refletindo mais de 90% da radiação infravermelha incidente de volta ao volume de ar interno. Esta blindagem reduz a constante de dissipação térmica do sistema, permitindo que a pastilha termoelétrica opere com ciclo de trabalho (*duty cycle*) médio significativamente menor para manter o *setpoint* estabelecido.

### 3.1.3. Sistema de Mancais de Baixo Atrito
No interior da câmara, instalou-se um par de suportes impressos em 3D (filamento PETG resistente a 80°C) equipados com **rolamentos de esferas blindados modelo 608ZZ** (diâmetro interno 8 mm, diâmetro externo 22 mm). Dois roletes de apoio permitem que o carretel gire livremente sobre seu eixo central sem impor resistência mecânica ao tracionador do extrusor, permitindo tanto o condicionamento *off-line* quanto a alimentação direta do filamento aquecido durante a impressão (*in-situ drying*).

### 3.1.4. Defletores Aerodinâmicos e Convecção Forçada
O módulo térmico é encapsulado por um duto defletor impresso em 3D, projetado para direcionar o ar aquecido uniformemente pela base do carretel, forçando uma circulação toroidal contínua. Isso elimina gradientes térmicos espaciais e pontos quentes (*hotspots*), garantindo que o número de Biot ($Bi < 0,1$) permaneça no regime de capacitância concentrada (KEYHANI, 2026)⁹.

---

## 3.2. Prototipagem Virtual (Tinkercad) e Arquitetura Elétrica

Com o objetivo de validar o funcionamento lógico, testar a compatibilidade entre níveis de tensão e gerar uma documentação didática aberta à comunidade científica e *maker*, o circuito eletrônico completo foi prototipado e simulado na plataforma **Autodesk Tinkercad Circuits** (BANERJEE, 2021)¹.

A arquitetura elétrica é segmentada em três malhas funcionais complementares:

```
                            ARQUITETURA ELÉTRICA EM 3 MALHAS

  +------------------------------------------------------------------------------------+
  | 1. MALHA LÓGICA DE BAIXA TENSÃO (5V / 3.3V)                                        |
  |                                                                                    |
  |   +----------------------------------------------------------------------------+   |
  |   |                          ARDUINO UNO / NANO (ATmega328P)                   |   |
  |   |                                                                            |   |
  |   |   [A4: SDA] -------------------+-----------------------+                   |   |
  |   |   [A5: SCL] -------------+     |                       |                   |   |
  |   |   [5V / 3.3V] -----+     |     |                       |                   |   |
  |   |   [GND] -------+   |     |     |                       |                   |   |
  |   |                |   |     |     |                       |                   |   |
  |   |   [D2: BTN_SEL]|   |  +--+-----+----------+     +------+-------------+     |   |
  |   |   [D3: BTN_RUN]|   |  |   DISPLAY LCD     |     |   SENSOR BOSCH     |     |   |
  |   |   [D9: PWM_PID]|   |  |   16x2 com I2C    |     |   BME280 (MEMS)    |     |   |
  |   |   [D10: EXAUST]|   |  | (Endereço 0x27)   |     | (Endereço 0x76)    |     |   |
  |   +----------------+---+--+-------------------+-----+--------------------+-----+   |
  +--------------------+---+-----------------------------------------------------------+
                       |   |
  +--------------------+---+-----------------------------------------------------------+
  | 2. MALHA DE ATUAÇÃO E PWM (12V POTÊNCIA)                                           |
  |                                                                                    |
  |   +-----------------------+           +----------------------------------------+   |
  |   | FONTE 12V 10A DC      |---(+12V)->| Pastilha Peltier TEC1-12706 (+)        |   |
  |   | (Alimentação Chaveada)|           | Pastilha Peltier TEC1-12706 (-)        |   |
  |   | GND Unificado --------+-(GND)     +--------------------+-------------------+   |
  |   +-----------------------+                                |                       |
  |                                                     [DRENO (Drain)]                |
  |                                                            |                       |
  |   [D9 PWM Arduino] -------------------------> [GATE] MÓDULO MOSFET IRF520          |
  |                                               [SOURCE] ----> GND Unificado         |
  +------------------------------------------------------------------------------------+
  | 3. MALHA DE EXAUSTÃO E CONVECÇÃO                                                   |
  |                                                                                    |
  |   (+12V Direto) ----------------------------> Ventoinha Primária (Convecção Cont.) |
  |                                                                                    |
  |   [D10 Digital Arduino] -> [Base] 2N2222 -> Ventoinha Secundária (Exaustor Sat.)   |
  +------------------------------------------------------------------------------------+
```

### 3.2.1. Malha 1: Lógica de Baixa Tensão e Instrumentação (5V / 3.3V)
- **Unidade Central de Processamento**: Arduino Uno / Nano baseado no microcontrolador Microchip ATmega328P operando a 16 MHz com alimentação lógica regulada a 5V.
- **Barramento I²C (Inter-Integrated Circuit)**:
  - As linhas analógicas `A4` (SDA - Serial Data) e `A5` (SCL - Serial Clock) do Arduino atuam como mestre I²C, integrando dois periféricos escravos em paralelo:
    1. **Display LCD 16x2 com Módulo PCF8574**: Endereço I²C padrão `0x27`. Responsável pela interface homem-máquina (IHM), exibindo a temperatura atual, umidade da câmara, *setpoint* selecionado e estado do atuador em tempo real.
    2. **Sensor Bosch BME280**: Módulo sensor MEMS de alta precisão calibrado de fábrica (endereço I²C `0x76`), medindo simultaneamente temperatura ($\pm 0,5^\circ\text{C}$ de precisão), umidade relativa ($\pm 3\%$ de tolerância) e pressão atmosférica (BOSCH, 2022)¹². O BME280 substitui sensores resistivos comuns (DHT11/DHT22) que sofrem descalibração e degradação em ambientes quentes e saturados (COLARES, 2021)¹².
- **Interface Homem-Máquina (Teclas Tácteis)**:
  - Dois botões do tipo *push-button* com resistores de *pull-down* de 10 kΩ:
    - Pino Digital `D2` (`BTN_SELECT`): Alterna os perfis térmicos predefinidos na FSM (PLA, PETG, ABS, TPU, Nylon, PC).
    - Pino Digital `D3` (`BTN_START_STOP`): Inicia ou interrompe o ciclo de secagem ativa.

### 3.2.2. Malha 2: Atuação Térmica e Modulação de Potência (12V)
- **Fonte de Alimentação Chaveada**: Fonte estabilizada de 12 V DC / 10 A (120 W de capacidade contínua), provendo potência com proteção contra curto-circuito e sobrecarga. O terminal negativo (GND) da fonte de 12V é interligado em ponto único com o GND do Arduino, garantindo referência de potencial idêntica em todo o circuito.
- **Estágio de Comutação por MOSFET**:
  - Módulo de transistor de efeito de campo MOSFET canal N (IRF520 ou logic-level IRLZ44N).
  - O pino digital `D9` do Arduino gera o sinal modulado conectado ao terminal *Gate* do MOSFET através de um resistor de amortecimento de 220 Ω (e *pull-down* de 10 kΩ para evitar condução espúria na inicialização).
  - O terminal *Drain* (Dreno) comuta o polo negativo do atuador térmico, enquanto o terminal *Source* (Fonte) é ancorado no barramento de terra comum (GND).
- **Atuador Termoelétrico Peltier (TEC1-12706)**:
  - A pastilha termoelétrica de 40x40 mm opera sob efeito Seebeck inverso: ao circular corrente contínua, uma face absorve calor (face fria) e a face oposta dissipa calor somado às perdas ôhmicas por efeito Joule (face quente) (ILENGO et al., 2023)¹¹.
  - A face quente é acoplada a um dissipador de alumínio anodizado aletado posicionado no interior da câmara com pasta térmica de alta condutividade ($k > 4,5\text{ W/m}\cdot\text{K}$).
  - A face fria permanece voltada para o trocador externo, induzindo a condensação da umidade do ar recirculante nos dissipadores externos através do ponto de orvalho (*dew point*) (ENGG_WASP, 2024)².

### 3.2.3. Malha 3: Convecção Forçada e Exaustão Ativa de Umidade
- **Ventoinha Primária (Convecção Contínua)**: Micro-ventoinha axial *brushless* de 12 V (40x40x10 mm, fluxo de ar de 7,5 CFM), conectada diretamente à linha de 12 V da fonte chaveada. Sopra ar continuamente sobre as aletas do dissipador quente, acelerando a transferência convectiva para a câmara ($h > 45\text{ W/m}^2\cdot\text{K}$).
- **Ventoinha Secundária (Exaustor de Umidade)**: Micro-ventoinha axial de 12 V instalada na válvula de alívio superior da câmara. É acionada pelo pino digital `D10` do microcontrolador através de um transistor bipolar NPN 2N2222 (com resistor de base de 1 kΩ e diodo de roda-livre 1N4007). É disparada unicamente quando o nível de umidade relativa na câmara ultrapassa o limite de saturação, expulsando o vapor dessorvido e renovando o ar (BANERJEE, 2021)¹.

---

## 3.3. Engenharia de Firmware e Lógica de Software

O firmware foi desenvolvido em C/C++ seguindo as melhores práticas da engenharia de software embarcado: arquitetura não bloqueante baseada em amostragem temporal fixa (`millis()`), máquina de estados finitos (FSM), controle PID com modulação por Janela Temporal Proporcional (*Relay Windowing*) e proteções ativas (*failsafes*) (BANERJEE, 2021)¹.

```
                         DIAGRAMA DA MÁQUINA DE ESTADOS (FSM)

       +-------------------------------------------------------------------+
       |                                                                   |
       v                                                                   |
  +---------+    BTN_SELECT     +-----------------+    BTN_START     +-----------+
  |  IDLE   | ----------------> | PROFILE_SELECT  | ---------------> |  HEATING  |
  +---------+                   +-----------------+                  +-----------+
       ^                                                                   |
       |                             T >= (T_set - 1.0°C)                  |
       |                                                                   v
  +-----------+    Tempo Esgotado   +-----------------+             +-------------+
  |  COOLING  | <------------------ |  ACTIVE_CYCLE   | <---------- | REGULATION  |
  +-----------+    ou BTN_STOP      |  (Manutenção)   |  (PID Ativo)| (PID Estável|
       |                            +-----------------+             +-------------+
       |                                     |
       +------------------+                  |
                          |                  |
                          v                  v
                 +--------------------------------------+
                 |      ESTADO DE ALARME / FALHA        |
                 | (T > 90°C ou Erro de Sensor I2C)     |
                 | -> Corta MOSFET D9 imediatamente     |
                 | -> Exibe código de erro no LCD 16x2  |
                 +--------------------------------------+
```

### 3.3.1. Perfis Térmicos Parametrizados
O firmware armazena em memória não volátil (ou constantes em flash) os limites operacionais estritos para os principais materiais poliméricos de engenharia, garantindo que o *setpoint* permaneça com margem de segurança $\Delta T_{seg}$ abaixo da Temperatura de Transição Vítrea ($T_g$) do filamento:

| Identificador | Material Polimérico | $T_g$ Típica (°C) | *Setpoint* Alvo ($T_{set}$) | Limite Alarme ($T_{max}$) | Tempo de Dessorção |
|---|---|---|---|---|---|
| `PROFILE_PLA` | PLA (Ácido Polilático) | 55 °C a 60 °C | **48 °C** | 55 °C | 4 a 6 horas |
| `PROFILE_PETG` | PETG (Glicol Modificado) | 80 °C a 85 °C | **65 °C** | 75 °C | 4 a 6 horas |
| `PROFILE_ABS` | ABS (Acrilonitrila Butadieno) | 100 °C a 105 °C | **78 °C** | 90 °C | 4 a 6 horas |
| `PROFILE_TPU` | TPU (Poliuretano Flexível) | < -20 °C (Vicat 85°C) | **52 °C** | 60 °C | 8 a 12 horas |
| `PROFILE_NYLON`| Poliamida (Nylon PA6/PA12) | 60 °C a 75 °C | **75 °C** | 85 °C | 8 a 12 horas |
| `PROFILE_PC` | Policarbonato | 140 °C a 150 °C | **90 °C** | 105 °C | 6 a 8 horas |

### 3.3.2. Algoritmo PID com Janela Temporal Proporcional (Relay Windowing)
O chaveamento de cargas térmicas elevadas (como pastilhas Peltier e resistências PTC com correntes de até 6 A) em frequências altas de PWM tradicional do microcontrolador (490 Hz ou 980 Hz) acarreta perdas severas por comutação capacitiva/indutiva e aquecimento no MOSFET. Para resolver esse problema com rigor termodinâmico, o firmware implementa o algoritmo de **Janela Temporal Proporcional** (*Time-Proportional Relay Windowing*) (MELON, 2026)⁵⁰.

A saída contínua da equação PID padrão:
$$u(t) = K_p \cdot e(t) + K_i \int_0^t e(\tau)\,d\tau + K_d \frac{de(t)}{dt}$$

É normalizada na faixa de $0\%$ a $100\%$ de esforço térmico ($u_{norm}(t) \in [0, 1]$). O tempo de ciclo é fixado em uma janela temporal $T_{window} = 5000\text{ ms}$ (5 segundos). A cada ciclo da janela:
$$t_{on} = T_{window} \times u_{norm}(t)$$
$$t_{off} = T_{window} - t_{on}$$

- Se o PID determinar um esforço de aquecimento de $40\%$ para compensar perdas no perfil PETG (65°C), o pino `D9` impõe nível lógico **HIGH** no *Gate* do MOSFET por $2000\text{ ms}$ e nível lógico **LOW** pelos $3000\text{ ms}$ restantes da janela.
- Esta comutação de baixa frequência preserva os semicondutores, anula ruídos de indução eletromagnética e proporciona uma inércia térmica uniforme na pastilha Peltier.

### 3.3.3. Malha Secundária de Histerese para Desumidificação Ativa
Paralelamente ao laço térmico, uma rotina periódica monitora a umidade relativa ($RH$) registrada no sensor BME280. 
- Caso $RH > RH_{threshold}$ (ex: $RH > 45\%$), o pino `D10` aciona a ventoinha exaustora, drenando o ar saturado de vapor d'água desprendido do carretel.
- O exaustor permanece ligado até que a umidade atinja uma faixa segura ($RH \le 30\%$), implementando uma banda morta de histerese de $15\%$ que impede o liga/desliga intermitente da ventoinha.

### 3.3.4. Mecanismos de Proteção e Failsafes Embarcados
Para mitigar qualquer risco de sobreaquecimento e garantir a integridade dos materiais e do hardware:
1. **Watchdog de Comunicação I²C**: Se o sensor BME280 falhar na transmissão de telemetria por mais de 3 leituras consecutivas (1500 ms), o sistema desarma o Gate do MOSFET (`D9 = LOW`), aciona o exaustor preventivamente e exibe a mensagem de alarme `ERR: I2C_FAIL` no display LCD.
2. **Corte por Sobretemperatura Catastrófica**: Se a leitura de temperatura ultrapassar $90^\circ\text{C}$ absolutos (ou o limite $T_{max}$ do perfil ativo), o ciclo é abortado instantaneamente com alerta sonoro e visual `ALARM: OVERTEMP`.
3. **Filtro Digital de Média Móvel**: As leituras analógicas e digitais passam por um filtro de média móvel exponencial de 8 amostras, eliminando espúrios gerados por ruído eletromagnético da fonte chaveada.
4. **Telemetria Serial Contínua a 5 Hz (Hardware in the Loop)**: A cada 200 ms, o microcontrolador transmite uma linha formatada de dados via porta serial (`UART 115200 bps`), exportando `Timestamp(ms), Estado, Temp_Atual(°C), Temp_Setpoint(°C), Umidade(%), PID_Output(%), Exaustor_State`, permitindo integração e validação automatizada em computador externo (POLITO, 2024)⁶³.
