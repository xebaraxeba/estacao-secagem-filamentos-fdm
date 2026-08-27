#ifndef SAFETY_PROTECTIONS_H
#define SAFETY_PROTECTIONS_H

#include <Arduino.h>
#include "Config.h"

class SafetyProtections {
private:
    bool _overtempTriggered;
    bool _sensorFaultTriggered;
    bool _heaterBlocked;
    String _lastErrorMessage;
    
public:
    SafetyProtections();
    
    void reset();
    
    // Avalia condições e retorna true se houver falha crítica
    bool evaluate(float currentTemp, float maxSafeTemp, bool sensorHealthy);
    
    bool isOvertemp() const { return _overtempTriggered; }
    bool isSensorFault() const { return _sensorFaultTriggered; }
    bool isHeaterBlocked() const { return _heaterBlocked; }
    String getLastError() const { return _lastErrorMessage; }
};

#endif // SAFETY_PROTECTIONS_H
