#include "FSM.h"

FiniteStateMachine::FiniteStateMachine() {
    _currentState = STATE_IDLE;
    _selectedProfileIndex = 1; // Padrão inicial: PETG (65°C)
    _cycleStartTime = 0;
    _targetDurationMs = 0;
}

void FiniteStateMachine::begin() {
    _currentState = STATE_PROFILE_SELECT;
    _targetDurationMs = PROFILES[_selectedProfileIndex].durationMin * 60000UL;
}

void FiniteStateMachine::nextProfile() {
    if (_currentState == STATE_IDLE || _currentState == STATE_PROFILE_SELECT) {
        _selectedProfileIndex = (_selectedProfileIndex + 1) % TOTAL_PROFILES;
        _targetDurationMs = PROFILES[_selectedProfileIndex].durationMin * 60000UL;
        _currentState = STATE_PROFILE_SELECT;
    }
}

void FiniteStateMachine::startCycle() {
    if (_currentState == STATE_PROFILE_SELECT || _currentState == STATE_IDLE || _currentState == STATE_COOLING) {
        _currentState = STATE_HEATING;
        _cycleStartTime = millis();
        _targetDurationMs = PROFILES[_selectedProfileIndex].durationMin * 60000UL;
    }
}

void FiniteStateMachine::stopCycle() {
    if (_currentState == STATE_HEATING || _currentState == STATE_REGULATION) {
        _currentState = STATE_COOLING;
    } else if (_currentState == STATE_COOLING || _currentState == STATE_ALARM_OVERTEMP || _currentState == STATE_ALARM_SENSOR_ERROR) {
        _currentState = STATE_PROFILE_SELECT;
    }
}

void FiniteStateMachine::triggerAlarm(DryerState alarmState) {
    _currentState = alarmState;
}

void FiniteStateMachine::resetToIdle() {
    _currentState = STATE_PROFILE_SELECT;
}

void FiniteStateMachine::update(float currentTemp, unsigned long currentTimeMs) {
    float setpoint = PROFILES[_selectedProfileIndex].targetTemp;

    switch (_currentState) {
        case STATE_HEATING:
            // Se aproximou de 1°C do setpoint, entra no regime de regulação fina
            if (currentTemp >= (setpoint - 1.0f)) {
                _currentState = STATE_REGULATION;
            }
            // Verifica tempo total de ciclo
            if ((currentTimeMs - _cycleStartTime) >= _targetDurationMs) {
                _currentState = STATE_COOLING;
            }
            break;

        case STATE_REGULATION:
            // Verifica se o tempo de secagem terminou
            if ((currentTimeMs - _cycleStartTime) >= _targetDurationMs) {
                _currentState = STATE_COOLING;
            }
            break;

        case STATE_COOLING:
            // Arrefecimento até temperatura ambiente segura (< 35°C)
            if (currentTemp <= 35.0f) {
                _currentState = STATE_IDLE;
            }
            break;

        case STATE_IDLE:
        case STATE_PROFILE_SELECT:
        case STATE_ALARM_OVERTEMP:
        case STATE_ALARM_SENSOR_ERROR:
        default:
            break;
    }
}

unsigned long FiniteStateMachine::getElapsedTimeMs(unsigned long currentTimeMs) const {
    if (_currentState == STATE_HEATING || _currentState == STATE_REGULATION) {
        return (currentTimeMs - _cycleStartTime);
    }
    return 0;
}

unsigned long FiniteStateMachine::getRemainingTimeMs(unsigned long currentTimeMs) const {
    if (_currentState == STATE_HEATING || _currentState == STATE_REGULATION) {
        unsigned long elapsed = (currentTimeMs - _cycleStartTime);
        if (elapsed < _targetDurationMs) {
            return (_targetDurationMs - elapsed);
        }
    }
    return 0;
}

const char* FiniteStateMachine::getStateName() const {
    switch (_currentState) {
        case STATE_IDLE: return "IDLE";
        case STATE_PROFILE_SELECT: return "SELECT";
        case STATE_HEATING: return "HEATING";
        case STATE_REGULATION: return "REGULATION";
        case STATE_COOLING: return "COOLING";
        case STATE_ALARM_OVERTEMP: return "ALARM_TEMP";
        case STATE_ALARM_SENSOR_ERROR: return "ALARM_I2C";
        default: return "UNKNOWN";
    }
}
