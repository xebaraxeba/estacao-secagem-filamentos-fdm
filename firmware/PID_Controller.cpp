#include "PID_Controller.h"

PIDController::PIDController(unsigned long windowSizeMs) {
    _windowSizeMs = windowSizeMs;
    _kp = 3.8;
    _ki = 0.06;
    _kd = 15.0;
    reset();
}

void PIDController::setTunings(float kp, float ki, float kd) {
    _kp = kp;
    _ki = ki;
    _kd = kd;
}

void PIDController::reset() {
    _integralTerm = 0.0f;
    _previousError = 0.0f;
    _derivativeFiltered = 0.0f;
    _outputPercent = 0.0f;
    _onTimeMs = 0.0f;
    _windowStartTime = millis();
    _lastComputeTime = millis();
}

float PIDController::compute(float setpoint, float currentVal, unsigned long currentTimeMs) {
    float dt = (currentTimeMs - _lastComputeTime) / 1000.0f;
    if (dt <= 0.001f) {
        dt = 0.2f; // Fallback de 200 ms
    }
    _lastComputeTime = currentTimeMs;

    float error = setpoint - currentVal;

    // Ação Proporcional
    float pTerm = _kp * error;

    // Ação Integral com Anti-Windup dinâmico
    // Só integra se estiver próximo do setpoint (±10°C) para evitar saturação no arranque
    if (abs(error) < 10.0f) {
        _integralTerm += (_ki * error * dt);
        // Limita a ação integral a 0%..100%
        if (_integralTerm > 100.0f) _integralTerm = 100.0f;
        if (_integralTerm < 0.0f) _integralTerm = 0.0f;
    } else if (error <= -10.0f) {
        _integralTerm = 0.0f; // Zera se ultrapassou com folga
    }

    // Ação Derivativa com filtro passa-baixas simples (alfa = 0.7)
    float dRaw = (error - _previousError) / dt;
    _derivativeFiltered = 0.7f * _derivativeFiltered + 0.3f * dRaw;
    float dTerm = _kd * _derivativeFiltered;
    _previousError = error;

    // Somatório das ações de controle
    float totalEffort = pTerm + _integralTerm + dTerm;

    // Saturação de saída [0.0% a 100.0%]
    if (totalEffort > 100.0f) totalEffort = 100.0f;
    if (totalEffort < 0.0f) totalEffort = 0.0f;

    _outputPercent = totalEffort;
    _onTimeMs = (_outputPercent / 100.0f) * (float)_windowSizeMs;

    return _outputPercent;
}

bool PIDController::isMosfetActive(unsigned long currentTimeMs) {
    // Gerenciamento da Janela Temporal Proporcional (Relay Windowing)
    if (currentTimeMs - _windowStartTime >= _windowSizeMs) {
        _windowStartTime += _windowSizeMs;
        // Evita deriva de tempo em caso de atraso
        if (currentTimeMs - _windowStartTime > _windowSizeMs) {
            _windowStartTime = currentTimeMs;
        }
    }

    unsigned long timeInWindow = currentTimeMs - _windowStartTime;
    return (timeInWindow < (unsigned long)_onTimeMs);
}
