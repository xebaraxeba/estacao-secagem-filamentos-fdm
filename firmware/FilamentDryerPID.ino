/**
 * ============================================================================
 * PROJETO: ESTAÇÃO DE SECAGEM DE FILAMENTOS DE BAIXO CUSTO PARA MANUFATURA ADITIVA (FDM)
 * Item 3: Metodologia e Desenvolvimento Prático do Projeto
 * Plataforma: Arduino Uno / Nano (ATmega328P) & Autodesk Tinkercad Circuits
 * ============================================================================
 * 
 * Descrição:
 * Firmware para controle térmico em malha fechada com algoritmo PID de Janela
 * Temporal Proporcional (Relay Windowing), desumidificação ativa por histerese,
 * interface IHM (LCD 16x2 I2C + Botões), proteções ativas e telemetria HIL (5Hz).
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include "Config.h"
#include "PID_Controller.h"
#include "SensorBME280.h"
#include "FSM.h"
#include "SafetyProtections.h"

// Instanciação dos Módulos
LiquidCrystal_I2C lcd(I2C_ADDR_LCD, 16, 2);
PIDController pid(PID_WINDOW_SIZE_MS);
SensorBME280 bmeSensor(I2C_ADDR_BME280);
FiniteStateMachine fsm;
SafetyProtections safety;

// Variáveis de Temporização Não-Bloqueante
unsigned long lastSampleTime = 0;
unsigned long lastLcdRefresh = 0;
unsigned long lastBtnSelectCheck = 0;
unsigned long lastBtnStartCheck = 0;

// Estado dos Botões
int lastBtnSelectState = LOW;
int lastBtnStartState = LOW;

// Variáveis Globais de Processo
float currentTemperature = 24.0f;
float currentHumidity = 65.0f;
float pidEffortPercent = 0.0f;
bool exhaustFanActive = false;
bool mosfetHeatingActive = false;

// ============================================================================
// CONFIGURAÇÃO INICIAL (SETUP)
// ============================================================================
void setup() {
    // Inicialização da Porta Serial para Telemetria HIL (115200 bps)
    Serial.begin(115200);
    while (!Serial && millis() < 2000); // Aguarda conexão serial
    
    // Cabeçalho de Telemetria HIL (CSV)
    Serial.println(F("TIMESTAMP_MS,STATE,TEMP_CURRENT,TEMP_SETPOINT,HUMIDITY_RH,PID_DUTY,EXHAUST_STATE,ERROR_MSG"));

    // Configuração dos Pinos Digitais
    pinMode(PIN_BTN_SELECT, INPUT);
    pinMode(PIN_BTN_START_STOP, INPUT);
    pinMode(PIN_MOSFET_PWM, OUTPUT);
    pinMode(PIN_EXHAUST_FAN, OUTPUT);
    
    digitalWrite(PIN_MOSFET_PWM, LOW);
    digitalWrite(PIN_EXHAUST_FAN, LOW);

    // Inicialização do Barramento I2C e Sensores
    Wire.begin();
    bmeSensor.begin();

    // Inicialização do Display LCD 16x2
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print(F("FILAMENT DRYER"));
    lcd.setCursor(0, 1);
    lcd.print(F("PID CONTROL V1.0"));
    delay(1500);
    lcd.clear();

    // Inicialização da FSM e PID com perfil padrão (PETG)
    fsm.begin();
    const MaterialProfile& initialProfile = fsm.getCurrentProfile();
    pid.setTunings(initialProfile.Kp, initialProfile.Ki, initialProfile.Kd);
}

// ============================================================================
// LAÇO PRINCIPAL (LOOP DETERMINÍSTICO NÃO-BLOQUEANTE)
// ============================================================================
void loop() {
    unsigned long currentMillis = millis();

    // ------------------------------------------------------------------------
    // 1. LEITURA E TRATAMENTO DA IHM (BOTÕES COM DEBOUNCE)
    // ------------------------------------------------------------------------
    int btnSelectReading = digitalRead(PIN_BTN_SELECT);
    if (btnSelectReading == HIGH && lastBtnSelectState == LOW && (currentMillis - lastBtnSelectCheck > DEBOUNCE_DELAY_MS)) {
        lastBtnSelectCheck = currentMillis;
        fsm.nextProfile();
        const MaterialProfile& prof = fsm.getCurrentProfile();
        pid.setTunings(prof.Kp, prof.Ki, prof.Kd);
    }
    lastBtnSelectState = btnSelectReading;

    int btnStartReading = digitalRead(PIN_BTN_START_STOP);
    if (btnStartReading == HIGH && lastBtnStartState == LOW && (currentMillis - lastBtnStartCheck > DEBOUNCE_DELAY_MS)) {
        lastBtnStartCheck = currentMillis;
        if (fsm.getState() == STATE_PROFILE_SELECT || fsm.getState() == STATE_IDLE) {
            fsm.startCycle();
            pid.reset();
            const MaterialProfile& prof = fsm.getCurrentProfile();
            pid.setTunings(prof.Kp, prof.Ki, prof.Kd);
        } else {
            fsm.stopCycle();
        }
    }
    lastBtnStartState = btnStartReading;

    // ------------------------------------------------------------------------
    // 2. CICLO DE AMOSTRAGEM, CONTROLE PID E TELEMETRIA HIL (5 Hz = 200 ms)
    // ------------------------------------------------------------------------
    if (currentMillis - lastSampleTime >= SAMPLE_INTERVAL_MS) {
        lastSampleTime = currentMillis;

        // Leitura do Sensor BME280 com filtro de média móvel
        bmeSensor.readData();
        currentTemperature = bmeSensor.getTemperature();
        currentHumidity = bmeSensor.getHumidity();

        // Atualização da Máquina de Estados
        fsm.update(currentTemperature, currentMillis);

        const MaterialProfile& activeProfile = fsm.getCurrentProfile();

        // Avaliação de Proteções Críticas (Failsafes)
        bool hasCriticalFault = safety.evaluate(currentTemperature, activeProfile.maxSafeTemp, bmeSensor.isHealthy());
        if (hasCriticalFault) {
            if (safety.isOvertemp()) {
                fsm.triggerAlarm(STATE_ALARM_OVERTEMP);
            } else if (safety.isSensorFault()) {
                fsm.triggerAlarm(STATE_ALARM_SENSOR_ERROR);
            }
        }

        // Execução do Algoritmo PID se o ciclo estiver ativo
        if (fsm.getState() == STATE_HEATING || fsm.getState() == STATE_REGULATION) {
            pidEffortPercent = pid.compute(activeProfile.targetTemp, currentTemperature, currentMillis);
        } else {
            pidEffortPercent = 0.0f;
        }

        // Controle da Malha Secundária de Desumidificação (Exaustor por Histerese)
        if (fsm.getState() == STATE_HEATING || fsm.getState() == STATE_REGULATION) {
            if (currentHumidity >= RH_EXHAUST_ON_THRESHOLD) {
                exhaustFanActive = true;
            } else if (currentHumidity <= RH_EXHAUST_OFF_THRESHOLD) {
                exhaustFanActive = false;
            }
        } else if (fsm.getState() == STATE_COOLING) {
            exhaustFanActive = true; // Mantém exaustor ligado durante resfriamento
        } else {
            exhaustFanActive = false;
        }
        digitalWrite(PIN_EXHAUST_FAN, exhaustFanActive ? HIGH : LOW);

        // Transmissão de Telemetria HIL (Formato CSV Contínuo a 5 Hz)
        Serial.print(currentMillis);
        Serial.print(F(","));
        Serial.print(fsm.getStateName());
        Serial.print(F(","));
        Serial.print(currentTemperature, 2);
        Serial.print(F(","));
        Serial.print(activeProfile.targetTemp, 1);
        Serial.print(F(","));
        Serial.print(currentHumidity, 1);
        Serial.print(F(","));
        Serial.print(pidEffortPercent, 1);
        Serial.print(F(","));
        Serial.print(exhaustFanActive ? 1 : 0);
        Serial.print(F(","));
        Serial.println(safety.getLastError());
    }

    // ------------------------------------------------------------------------
    // 3. ATUAÇÃO DO MOSFET TÉRMICO VIA JANELA TEMPORAL (RELAY WINDOWING)
    // ------------------------------------------------------------------------
    if (fsm.getState() == STATE_HEATING || fsm.getState() == STATE_REGULATION) {
        mosfetHeatingActive = pid.isMosfetActive(currentMillis);
    } else {
        mosfetHeatingActive = false;
    }
    digitalWrite(PIN_MOSFET_PWM, mosfetHeatingActive ? HIGH : LOW);

    // ------------------------------------------------------------------------
    // 4. ATUALIZAÇÃO DA INTERFACE VISUAL NO DISPLAY LCD 16x2 (2.5 Hz = 400 ms)
    // ------------------------------------------------------------------------
    if (currentMillis - lastLcdRefresh >= LCD_REFRESH_MS) {
        lastLcdRefresh = currentMillis;
        renderLCD(currentMillis);
    }
}

// ============================================================================
// RENDERIZAÇÃO FORMATADA NO DISPLAY LCD 16x2
// ============================================================================
void renderLCD(unsigned long currentMillis) {
    const MaterialProfile& prof = fsm.getCurrentProfile();
    DryerState st = fsm.getState();

    lcd.setCursor(0, 0);

    if (st == STATE_ALARM_OVERTEMP) {
        lcd.print(F("!ALARM: OVERTEMP"));
        lcd.setCursor(0, 1);
        lcd.print(F("T > MAX SAFE LIM"));
        return;
    }
    if (st == STATE_ALARM_SENSOR_ERROR) {
        lcd.print(F("!ERR: SENSOR I2C"));
        lcd.setCursor(0, 1);
        lcd.print(F("CHECK WIRING A4 "));
        return;
    }

    // Linha 1: Perfil, Setpoint e Tempo Restante
    lcd.print(prof.name);
    lcd.print(F(" "));
    lcd.print((int)prof.targetTemp);
    lcd.print(F("C "));

    if (st == STATE_HEATING || st == STATE_REGULATION) {
        unsigned long remMs = fsm.getRemainingTimeMs(currentMillis);
        unsigned long remMin = remMs / 60000UL;
        unsigned long remHrs = remMin / 60;
        remMin = remMin % 60;
        if (remHrs < 10) lcd.print('0');
        lcd.print(remHrs);
        lcd.print('h');
        if (remMin < 10) lcd.print('0');
        lcd.print(remMin);
    } else if (st == STATE_COOLING) {
        lcd.print(F("COOLING "));
    } else {
        lcd.print(prof.durationMin / 60);
        lcd.print(F("h [PRONTO]"));
    }

    // Linha 2: Temperatura Atual, Umidade e Indicadores de Atuador
    lcd.setCursor(0, 1);
    lcd.print(F("T:"));
    lcd.print(currentTemperature, 1);
    lcd.print(F("C H:"));
    lcd.print((int)currentHumidity);
    lcd.print(F("% "));

    // Indicador visual de aquecimento (* = MOSFET conduzindo)
    if (mosfetHeatingActive) {
        lcd.print(F("[H]"));
    } else if (exhaustFanActive) {
        lcd.print(F("[F]"));
    } else {
        lcd.print(F("   "));
    }
}
