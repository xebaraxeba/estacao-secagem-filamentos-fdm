# Guia de Montagem e Fiação no Tinkercad Circuits

Este documento apresenta a especificação técnica detalhada para reproduzir fielmente a montagem física e virtual do circuito da Estação de Secagem de Filamentos no **Autodesk Tinkercad Circuits**.

---

## 1. Diagrama de Blocos de Interconexão

```
 +-----------------------------------------------------------------------------------------------+
 |                                     ESQUEMA DE LIGAÇÕES GERAIS                                |
 +-----------------------------------------------------------------------------------------------+
 
   [ FONTE 12V 10A ]
        (+) +12V -----------------------------------+--------------------+------------------+
                                                    |                    |                  |
                                                    v                    v                  v
                                             [ PELTIER (+) ]      [ FAN_PRIM (+) ]   [ FAN_EXAUST (+)]
                                             [ PELTIER (-) ]      [ FAN_PRIM (-) ]   [ FAN_EXAUST (-)]
                                                    |                    |                  |
                                                    v                    |                  v
                                             [ MOSFET DRENO ]            |           [ COLETOR 2N2222]
                                                    |                    |                  |
        (-) GND  ------+---------------------+------+--------------------+------------------+
                       |                     |
                       v                     v
   [ ARDUINO UNO ]     |              [ MOSFET SOURCE ]
        GND -----------+
        5V -------------------+------------------+
        A4 (SDA) -------------+-------------+    |
        A5 (SCL) -------------+-------+     |    |
                              |       |     |    |
                              v       v     v    v
                       [ LCD 16x2 I2C ]  [ BME280 SENSOR ]
                         SDA, SCL, 5V,     SDA, SCL, 3.3V/5V,
                         GND               GND
 
        D9 (PWM) ------[ 220Ω ]-------> [ MOSFET GATE ]
        D10 (DIG) -----[  1kΩ ]-------> [ BASE 2N2222 ]
        D2 (DIG) <--------------------- [ PUSHBUTTON 1: SELECT ] (com Pull-Down 10k)
        D3 (DIG) <--------------------- [ PUSHBUTTON 2: START/STOP ] (com Pull-Down 10k)
```

---

## 2. Passo a Passo de Montagem na Protoboard

### Etapa 1: Distribuição das Linhas de Alimentação
1. Conecte o pino `5V` do Arduino Uno na trilha vermelha superior `(+)` da Protoboard.
2. Conecte o pino `GND` do Arduino Uno na trilha azul superior `(-)` da Protoboard.
3. Conecte o terminal negativo `(-)` da Fonte de Alimentação 12V na trilha azul inferior `(-)` da Protoboard e crie um jumper interligando as duas trilhas de GND (inferior e superior). **(GND Unificado)**.

### Etapa 2: Instalação dos Botões de Navegação (IHM)
1. Insira os dois botões na divisória central da protoboard.
2. Para cada botão:
   - Conecte um dos terminais na linha `5V` (trilha vermelha).
   - Conecte o terminal oposto correspondente a um resistor de `10 kΩ` que vai para o `GND` (trilha azul).
   - Do nó entre o botão e o resistor de 10k:
     - Leve um fio verde para o pino digital `D2` do Arduino (**BTN_SELECT**).
     - Leve um fio laranja do segundo botão para o pino digital `D3` do Arduino (**BTN_START_STOP**).

### Etapa 3: Instalação do Barramento I²C (LCD 16x2 e BME280)
1. Posicione o módulo LCD 16x2 com mochila I2C (PCF8574):
   - Conecte o pino `GND` ao GND da protoboard.
   - Conecte o pino `VCC` à linha de 5V da protoboard.
   - Conecte o pino `SDA` ao pino `A4` do Arduino Uno.
   - Conecte o pino `SCL` ao pino `A5` do Arduino Uno.
2. Posicione o módulo Sensor BME280:
   - Conecte o pino `GND` ao GND da protoboard.
   - Conecte o pino `VIN / VCC` à linha de 5V (ou 3.3V) da protoboard.
   - Conecte o pino `SDA` em paralelo com a linha SDA (`A4`).
   - Conecte o pino `SCL` em paralelo com a linha SCL (`A5`).

### Etapa 4: Montagem do Circuito de Potência Térmica (MOSFET + Peltier)
1. Posicione o MOSFET Canal N (IRLZ44N / IRF520) na protoboard:
   - **Terminal Gate (Pino 1)**: Conecte através de um resistor de `220 Ω` ao pino `D9` (PWM) do Arduino. Conecte também um resistor de `10 kΩ` entre o Gate e o GND (*pull-down* de segurança).
   - **Terminal Drain (Pino 2 / Aba metálica)**: Conecte ao fio negativo (-) da Pastilha Peltier TEC1-12706.
   - **Terminal Source (Pino 3)**: Conecte ao barramento de terra comum (GND).
2. Conecte o fio positivo (+) da Pastilha Peltier diretamente ao terminal `+12V` da Fonte Chaveada.

### Etapa 5: Montagem do Circuito das Ventoinhas
1. **Ventoinha Primária (Cooler do Dissipador)**:
   - Fio positivo (+) conectado diretamente aos `+12V` da Fonte.
   - Fio negativo (-) conectado diretamente ao `GND`.
2. **Ventoinha Secundária (Exaustor de Saturação de Umidade)**:
   - Fio positivo (+) conectado aos `+12V` da Fonte.
   - Fio negativo (-) conectado ao terminal *Coletor* do transistor NPN 2N2222.
   - Terminal *Emissor* do 2N2222 conectado ao `GND`.
   - Terminal *Base* do 2N2222 conectado através de um resistor de `1 kΩ` ao pino digital `D10` do Arduino.
   - Diodo `1N4007` instalado em paralelo com os terminais do motor da ventoinha (cátodo/faixa prateada no +12V, ânodo no Coletor).
