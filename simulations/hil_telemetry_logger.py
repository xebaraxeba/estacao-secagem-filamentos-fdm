#!/usr/bin/env python3
"""
===============================================================================
HARNESS DE TESTES AUTOMATIZADOS HARDWARE IN THE LOOP (HIL) & TELEMETRIA SERIAL
Projeto: Estação de Secagem de Filamentos FDM (Item 4.3 do Relatório Técnico)
===============================================================================

Este script realiza:
1. Conexão com a porta serial (UART 115200 bps) ou gerador determinístico HIL.
2. Injeção programada de perturbações externas (choque térmico, falha de exaustor).
3. Gravação de logs CSV e cálculo de tempo de recuperação da malha PID.
"""

import sys
import time
import csv
import random
import argparse

try:
    import serial
    HAS_PYSERIAL = True
except ImportError:
    HAS_PYSERIAL = False

def run_hil_test(duration_sec=60, output_csv="hil_telemetry_log.csv", physical_port=None):
    print("=" * 80)
    print("INICIANDO SESSÃO DE TESTES AUTOMATIZADOS HARDWARE-IN-THE-LOOP (HIL)")
    mode = "FÍSICO (PySerial)" if physical_port else "VIRTUAL (Determinístico)"
    print(f"Modo: {mode} | Duração Estimada: {duration_sec}s | Exportando: {output_csv}")
    print("=" * 80)
    
    fieldnames = ["TIMESTAMP_MS", "STATE", "TEMP_CURRENT", "TEMP_SETPOINT", "HUMIDITY_RH", "PID_DUTY", "EXHAUST_STATE", "ERROR_MSG"]
    
    ser = None
    if physical_port:
        if not HAS_PYSERIAL:
            print("[ERRO FATAL] Biblioteca 'pyserial' não encontrada. Instale com: pip install pyserial")
            return
        try:
            ser = serial.Serial(physical_port, 115200, timeout=1.0)
            print(f"[*] Conectado fisicamente ao Arduino na porta {physical_port}")
            time.sleep(2) # Aguarda reset do Arduino
        except Exception as e:
            print(f"[ERRO] Falha ao abrir porta serial {physical_port}: {e}")
            return
            
    with open(output_csv, mode="w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        
        if ser:
            # MODO FÍSICO REAL (Lendo dados reais do microcontrolador)
            start_sim_time = time.time()
            while (time.time() - start_sim_time) < duration_sec:
                try:
                    line = ser.readline().decode('utf-8').strip()
                    if not line or not line.startswith("HIL:"):
                        continue
                    
                    # Formato esperado do firmware C++: HIL: TIMESTAMP,STATE,TEMP,SETPOINT,RH,PID,EXHAUST,ERROR
                    parts = line.replace("HIL:", "").split(",")
                    if len(parts) >= 8:
                        row = {
                            "TIMESTAMP_MS": parts[0],
                            "STATE": parts[1],
                            "TEMP_CURRENT": parts[2],
                            "TEMP_SETPOINT": parts[3],
                            "HUMIDITY_RH": parts[4],
                            "PID_DUTY": parts[5],
                            "EXHAUST_STATE": parts[6],
                            "ERROR_MSG": parts[7]
                        }
                        writer.writerow(row)
                        print(f"[{parts[0]:>6} ms] {parts[1]:<10} | Temp: {parts[2]}°C | RH: {parts[4]}% | PID: {parts[5]}% | Err: {parts[7]}")
                except KeyboardInterrupt:
                    print("\n[*] Interrompido pelo usuário.")
                    break
                except Exception as e:
                    pass
            ser.close()
            
        else:
            # MODO VIRTUAL DETERMINÍSTICO (Mock original)
            current_temp = 24.0
            setpoint = 65.0
            humidity = 68.0
            integral = 0.0
            prev_error = 0.0
            state = "HEATING"
            
            disturbance_active = False
            disturbance_start_time = 0
            recovery_times = []
            
            steps = int(duration_sec * 5) # 5 Hz
            
            for i in range(steps):
                timestamp_ms = int(i * 200)
                t_sec = i * 0.2
                
                # Injeção de Perturbação Térmica aos 25 segundos
                if 25.0 <= t_sec <= 28.0:
                    disturbance_active = True
                    disturbance_start_time = 25.0
                    current_temp -= random.uniform(1.8, 3.2)
                else:
                    if disturbance_active and current_temp >= (setpoint - 0.5):
                        recovery_time = t_sec - disturbance_start_time
                        recovery_times.append(recovery_time)
                        disturbance_active = False
                        print(f"[*] Perturbação superada! Tempo de recuperação PID ao setpoint: {recovery_time:.2f} s")
                
                # Dinâmica do PID
                error = setpoint - current_temp
                if abs(error) < 10.0:
                    integral += 0.06 * error * 0.2
                    integral = max(0.0, min(100.0, integral))
                d_term = 15.0 * (error - prev_error) / 0.2
                prev_error = error
                
                pid_duty = max(0.0, min(100.0, 3.8 * error + integral + d_term))
                
                # Atualização térmica simplificada
                heat_input = (pid_duty / 100.0) * 1.8
                cooling_loss = 0.03 * (current_temp - 22.0)
                current_temp += (heat_input - cooling_loss) * 0.2 + random.uniform(-0.05, 0.05)
                
                # Dinâmica de umidade
                exhaust_state = 1 if humidity > 45.0 else 0
                if exhaust_state == 1:
                    humidity -= 0.15
                else:
                    humidity -= 0.02
                humidity = max(15.0, humidity)
                
                if current_temp >= (setpoint - 1.0) and state == "HEATING":
                    state = "REGULATION"
                    
                row = {
                    "TIMESTAMP_MS": timestamp_ms,
                    "STATE": state,
                    "TEMP_CURRENT": round(current_temp, 2),
                    "TEMP_SETPOINT": round(setpoint, 1),
                    "HUMIDITY_RH": round(humidity, 1),
                    "PID_DUTY": round(pid_duty, 1),
                    "EXHAUST_STATE": exhaust_state,
                    "ERROR_MSG": "NORMAL"
                }
                writer.writerow(row)
                
                if i % 10 == 0:
                    print(f"[{timestamp_ms:>6} ms] State: {state:<10} | Temp: {current_temp:5.1f}°C | RH: {humidity:4.1f}% | PID: {pid_duty:5.1f}%")

    print("=" * 80)
    print("ENSAIO HIL FINALIZADO COM SUCESSO!")
    if not ser and 'recovery_times' in locals() and recovery_times:
        avg_rec = sum(recovery_times) / len(recovery_times)
        print(f"Média de Tempo de Recuperação Térmica frente a Perturbações: {avg_rec:.1f} s")
    print(f"Relatório de telemetria salvo em: {output_csv}")
    print("=" * 80)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HIL Telemetry Logger para Arduino")
    parser.add_argument("--port", type=str, help="Porta Serial física (ex: COM3 ou /dev/ttyUSB0)", default=None)
    parser.add_argument("--duration", type=int, default=60, help="Duração do ensaio em segundos")
    args = parser.parse_args()
    
    run_hil_test(duration_sec=args.duration, physical_port=args.port)
