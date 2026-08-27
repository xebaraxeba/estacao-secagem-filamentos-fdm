#ifndef PID_CONTROLLER_H
#define PID_CONTROLLER_H

#include <Arduino.h>

class PIDController {
private:
    float _kp;
    float _ki;
    float _kd;
    
    float _integralTerm;
    float _previousError;
    float _derivativeFiltered;
    
    unsigned long _windowStartTime;
    unsigned long _windowSizeMs;
    unsigned long _lastComputeTime;
    
    float _outputPercent; // 0.0% a 100.0%
    float _onTimeMs;
    
public:
    PIDController(unsigned long windowSizeMs = 5000);
    
    void setTunings(float kp, float ki, float kd);
    void reset();
    
    // Calcula o esforço do PID e atualiza o estado do pino do MOSFET baseado na Janela Temporal
    float compute(float setpoint, float currentVal, unsigned long currentTimeMs);
    bool isMosfetActive(unsigned long currentTimeMs);
    
    float getOutputPercent() const { return _outputPercent; }
    float getKp() const { return _kp; }
    float getKi() const { return _ki; }
    float getKd() const { return _kd; }
};

#endif // PID_CONTROLLER_H
