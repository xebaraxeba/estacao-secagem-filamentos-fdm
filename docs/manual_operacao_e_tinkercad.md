# Manual de Prototipagem Virtual no Autodesk Tinkercad Circuits

Este guia fornece o passo a passo ilustrado para reproduzir e simular o circuito completo da Estação de Secagem de Filamentos no ambiente gratuito **Autodesk Tinkercad Circuits**.

---

## 1. Componentes Necessários no Tinkercad

Abra o [Autodesk Tinkercad](https://www.tinkercad.com/circuits) e adicione à área de trabalho:
1. **1x Arduino Uno R3**
2. **1x Protoboard Pequena / Média**
3. **1x Display LCD 16x2 com Módulo I²C (PCF8574)**
4. **1x Sensor de Temperatura e Umidade** (no Tinkercad pode-se utilizar o sensor BME280 / TMP36 / DHT11 como modelo representativo)
5. **1x Transistor MOSFET N-Channel** (ou Módulo MOSFET IRF520 / IRLZ44N)
6. **1x Transistor NPN (2N2222 ou TIP120)**
7. **2x Motores DC / Ventoinhas 12V** (representando a Ventoinha Primária do Dissipador e o Exaustor Secundário)
8. **1x Elemento de Carga / Lâmpada 12V ou Resistor de Potência** (representando a Pastilha Peltier TEC1-12706 no simulador)
9. **1x Fonte de Alimentação DC de Bancada** (Ajustada para `12.0 V` e limite de `6.0 A`)
10. **2x Botões Tácteis (Pushbuttons)**
11. **2x Resistores de 10 kΩ (Marrom-Preto-Laranja)** para Pull-Down dos botões
12. **1x Resistor de 220 Ω (Vermelho-Vermelho-Marrom)** para o Gate do MOSFET
13. **1x Resistor de 1 kΩ (Marrom-Preto-Vermelho)** para a Base do transistor 2N2222
14. **1x Diodo 1N4007** (Diodo de roda-livre do motor de exaustão)

---

## 2. Mapa de Conexões Pino a Pino (Wiring Table)

### 2.1. Conexões do Arduino Uno
| Pino Arduino | Destino | Função | Cor do Fio |
|---|---|---|---|
| **5V** | Barramento Vermelho (+) da Protoboard | Linha de Alimentação Lógica 5V | Vermelho |
| **GND** | Barramento Azul (-) da Protoboard | Linha de Terra Comum (Lógica) | Preto |
| **A4 (SDA)** | Pino SDA do LCD 16x2 e Pino SDA do BME280 | Barramento de Dados I²C | Azul |
| **A5 (SCL)** | Pino SCL do LCD 16x2 e Pino SCL do BME280 | Barramento de Clock I²C | Amarelo |
| **D2** | Terminal 1 do Botão 1 (BTN_SELECT) | Entrada com Pull-Down de 10k | Verde |
| **D3** | Terminal 1 do Botão 2 (BTN_START) | Entrada com Pull-Down de 10k | Laranja |
| **D9 (PWM)** | Resistor 220Ω $\rightarrow$ Gate do MOSFET IRF520 | Modulação PID Relay Windowing | Roxo |
| **D10** | Resistor 1kΩ $\rightarrow$ Base do Transistor 2N2222 | Acionamento do Exaustor | Cinza |

### 2.2. Conexões da Fonte de 12V e Estágio de Potência
| Terminal Fonte 12V | Destino | Função | Cor do Fio |
|---|---|---|---|
| **+12V (Positivo)** | Terminal (+) da Pastilha Peltier TEC1-12706 | Alimentação direta da pastilha | Vermelho Grosso |
| **+12V (Positivo)** | Terminal (+) da Ventoinha Primária (Dissipador)| Alimentação contínua do cooler | Vermelho |
| **+12V (Positivo)** | Terminal (+) da Ventoinha Secundária (Exaustor)| Alimentação do motor do exaustor | Vermelho |
| **GND (Negativo)** | Barramento Azul (-) da Protoboard (GND Arduino)| Unificação obrigatória de terras | Preto Grosso |
| **GND (Negativo)** | Terminal *Source* do MOSFET IRF520 | Retorno de terra de alta corrente | Preto Grosso |
| **GND (Negativo)** | Terminal *Emissor* do Transistor 2N2222 | Retorno de terra do exaustor | Preto |

### 2.3. Conexões do MOSFET e Pastilha Peltier
- **Gate**: Conectado ao pino `D9` do Arduino através de resistor de 220 Ω; resistor de 10 kΩ entre Gate e GND (*pull-down*).
- **Drain (Dreno)**: Conectado diretamente ao fio negativo (-) da Pastilha Peltier TEC1-12706.
- **Source (Fonte)**: Conectado ao GND comum.

### 2.4. Conexões do Display LCD 16x2 com Módulo I2C
- **GND** $\rightarrow$ Linha GND da Protoboard.
- **VCC** $\rightarrow$ Linha 5V da Protoboard.
- **SDA** $\rightarrow$ Pino `A4` do Arduino.
- **SCL** $\rightarrow$ Pino `A5` do Arduino.

---

## 3. Instruções de Execução da Simulação no Tinkercad

1. Abra a aba de **Código** no Tinkercad e selecione o modo **Texto**.
2. Copie e cole o código-fonte fornecido no arquivo `firmware/FilamentDryerPID.ino`.
3. Clique no botão **"Iniciar Simulação"**.
4. Observe:
   - O display LCD exibirá a tela de inicialização e entrará no menu de perfil (ex: `PETG: 65C / 4h`).
   - Pressione o botão `BTN_SELECT` (D2) para alternar entre os materiais: `PLA (48°C)`, `PETG (65°C)`, `ABS (78°C)`, `TPU (52°C)`, `Nylon (75°C)`, `PC (90°C)`.
   - Pressione `BTN_START` (D3) para deflagrar o ciclo de secagem.
   - O pino `D9` passará a modular a carga com o algoritmo de Janela Temporal de 5 segundos.
   - Abra o **Monitor Serial** (taxa 115200 bps) para ver os dados de telemetria HIL sendo transmitidos em tempo real a 5 Hz.
