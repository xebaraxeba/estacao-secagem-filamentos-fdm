#include "SafetyProtections.h"

SafetyProtections::SafetyProtections() {
    reset();
}

void SafetyProtections::reset() {
    _overtempTriggered = false;
    _sensorFaultTriggered = false;
    _heaterBlocked = false;
    _lastErrorMessage = "OK";
}

bool SafetyProtections::evaluate(float currentTemp, float maxSafeTemp, bool sensorHealthy) {
    // 1. Verificação de Integridade do Sensor
    if (!sensorHealthy) {
        _sensorFaultTriggered = true;
        _heaterBlocked = true;
        _lastErrorMessage = "ERR: SENSOR I2C FAIL";
        return true;
    }

    // 2. Verificação de Limite Absoluto Catastrófico (>90°C)
    if (currentTemp >= TEMP_CATASTROPHIC_MAX) {
        _overtempTriggered = true;
        _heaterBlocked = true;
        _lastErrorMessage = "ALARM: ABS OVERTEMP >90C";
        return true;
    }

    // 3. Verificação de Limite do Perfil Selecionado
    if (currentTemp > maxSafeTemp) {
        _overtempTriggered = true;
        _heaterBlocked = true;
        _lastErrorMessage = "ALARM: PROFILE Tg LIMIT";
        return true;
    }

    _overtempTriggered = false;
    _sensorFaultTriggered = false;
    _heaterBlocked = false;
    _lastErrorMessage = "NORMAL";
    return false;
}
