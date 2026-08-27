#ifndef SENSOR_BME280_H
#define SENSOR_BME280_H

#include <Arduino.h>
#include <Wire.h>

class SensorBME280 {
private:
    uint8_t _i2cAddress;
    bool _isOnline;
    uint8_t _errorCount;
    
    // Filtros de média móvel (8 amostras)
    static const uint8_t FILTER_SIZE = 8;
    float _tempHistory[FILTER_SIZE];
    float _humHistory[FILTER_SIZE];
    uint8_t _filterIndex;
    bool _filterFilled;
    
    float _currentTemp;
    float _currentHumidity;
    float _currentPressure;
    
public:
    SensorBME280(uint8_t i2cAddr = 0x76);
    
    bool begin();
    bool readData();
    
    float getTemperature() const { return _currentTemp; }
    float getHumidity() const { return _currentHumidity; }
    float getPressure() const { return _currentPressure; }
    bool isHealthy() const { return _isOnline && (_errorCount < 3); }
    uint8_t getErrorCount() const { return _errorCount; }
    
    // Método auxiliar para injeção de valores em ambiente de teste/simulação HIL
    void injectValues(float temp, float hum, float press = 1013.25);
};

#endif // SENSOR_BME280_H
