#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ============================================================================
// MAPEAMENTO DE HARDWARE E PINOS (ARDUINO UNO / NANO)
// ============================================================================
#define PIN_BTN_SELECT      2    // Botão de navegação / seleção de perfil (D2)
#define PIN_BTN_START_STOP  3    // Botão de iniciar/pausar ciclo (D3)
#define PIN_MOSFET_PWM      9    // Saída de modulação para Gate do MOSFET (D9)
#define PIN_EXHAUST_FAN     10   // Saída digital para Base do transistor do Exaustor (D10)
#define PIN_BUZZER          8    // Opcional: Buzzer piezelétrico para alarmes (D8)

// ============================================================================
// ENDEREÇOS DO BARRAMENTO I2C (SDA = A4, SCL = A5)
// ============================================================================
#define I2C_ADDR_LCD        0x27 // Display LCD 16x2 com mochila PCF8574
#define I2C_ADDR_BME280     0x76 // Sensor Bosch MEMS BME280 (ou 0x77)

// ============================================================================
// PARÂMETROS TEMPORAIS E DE CONTROLE
// ============================================================================
#define PID_WINDOW_SIZE_MS  5000 // Janela temporal de chaveamento (Relay Windowing) = 5.0 s
#define SAMPLE_INTERVAL_MS  200  // Taxa de amostragem do PID e Telemetria HIL = 5 Hz (200 ms)
#define LCD_REFRESH_MS      400  // Taxa de atualização do display LCD = 2.5 Hz (400 ms)
#define DEBOUNCE_DELAY_MS   50   // Tempo de debounce para teclas tácteis

// ============================================================================
// LIMITES CRÍTICOS E FAILSAFES (SEGURANÇA TÉRMICA)
// ============================================================================
#define TEMP_CATASTROPHIC_MAX 90.0 // Corte imediato absoluto em qualquer perfil (90°C)
#define SENSOR_TIMEOUT_MAX_COUNT 3 // Desarma se o BME280 falhar em 3 leituras consecutivas
#define RH_EXHAUST_ON_THRESHOLD 45.0 // Limite de saturação de umidade para ligar exaustor (%)
#define RH_EXHAUST_OFF_THRESHOLD 30.0 // Limite para desligar exaustor (histerese de 15%)

// ============================================================================
// ESTRUTURA DE PERFIL DE MATERIAL POLIMÉRICO
// ============================================================================
struct MaterialProfile {
    const char* name;          // Nome do polímero
    float targetTemp;          // Setpoint térmico ideal (°C)
    float maxSafeTemp;         // Limite máximo seguro antes da Tg (°C)
    unsigned long durationMin; // Tempo padrão de secagem (minutos)
    float Kp;                  // Ganho proporcional do PID
    float Ki;                  // Ganho integral do PID
    float Kd;                  // Ganho derivativo do PID
};

// Tabela de perfis térmicos baseada em propriedades termomecânicas reais
const MaterialProfile PROFILES[] = {
    // Nome,   T_set, T_max, Tempo(min), Kp,   Ki,   Kd
    { "PLA",   48.0,  55.0,  240,        3.20, 0.05, 12.0 }, // 4 horas a 48°C
    { "PETG",  65.0,  75.0,  240,        3.80, 0.06, 15.0 }, // 4 horas a 65°C (Perfil Padrão)
    { "ABS",   78.0,  90.0,  300,        4.50, 0.08, 18.0 }, // 5 horas a 78°C
    { "TPU",   52.0,  60.0,  480,        3.00, 0.04, 10.0 }, // 8 horas a 52°C
    { "NYLON", 75.0,  85.0,  480,        4.20, 0.07, 16.0 }, // 8 horas a 75°C
    { "PC",    90.0,  95.0,  360,        5.00, 0.10, 20.0 }  // 6 horas a 90°C
};

#define TOTAL_PROFILES (sizeof(PROFILES) / sizeof(MaterialProfile))

// ============================================================================
// ENUMERAÇÃO DE ESTADOS DA MÁQUINA DE ESTADOS FINITOS (FSM)
// ============================================================================
enum DryerState {
    STATE_IDLE = 0,             // Em espera na bancada
    STATE_PROFILE_SELECT,       // Seleção de perfil na IHM
    STATE_HEATING,              // Aquecimento inicial transiente
    STATE_REGULATION,           // Manutenção estável com PID
    STATE_COOLING,              // Arrefecimento seguro pós-secagem
    STATE_ALARM_OVERTEMP,       // Falha: Sobretemperatura
    STATE_ALARM_SENSOR_ERROR    // Falha: Perda de sensor I2C
};

#endif // CONFIG_H
