#ifndef FSM_H
#define FSM_H

#include <Arduino.h>
#include "Config.h"

class FiniteStateMachine {
private:
    DryerState _currentState;
    uint8_t _selectedProfileIndex;
    unsigned long _cycleStartTime;
    unsigned long _targetDurationMs;
    
public:
    FiniteStateMachine();
    
    void begin();
    void nextProfile();
    void startCycle();
    void stopCycle();
    void triggerAlarm(DryerState alarmState);
    void resetToIdle();
    
    void update(float currentTemp, unsigned long currentTimeMs);
    
    DryerState getState() const { return _currentState; }
    uint8_t getProfileIndex() const { return _selectedProfileIndex; }
    const MaterialProfile& getCurrentProfile() const { return PROFILES[_selectedProfileIndex]; }
    
    unsigned long getElapsedTimeMs(unsigned long currentTimeMs) const;
    unsigned long getRemainingTimeMs(unsigned long currentTimeMs) const;
    const char* getStateName() const;
};

#endif // FSM_H
