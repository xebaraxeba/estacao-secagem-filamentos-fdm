#!/usr/bin/env python3
"""
===============================================================================
SIMULAÇÃO EM ESPAÇO DE ESTADOS: MODELAGEM TÉRMICA & CONTROLE PID VS ON-OFF
Projeto: Estação de Secagem de Filamentos FDM (Item 4.1 do Relatório Técnico)
===============================================================================

Modelagem em Espaço de Estados (LTI - Linear Time-Invariant):
dx/dt = A*x + B*u + E*T_amb
y = C*x + D*u

Estados:
x1: Temperatura do elemento aquecedor / dissipador (°C)
x2: Temperatura do ar interno da câmara (°C)
x3: Temperatura do carretel de filamento (°C)
"""

import math
import sys
import os

try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

def run_simulation(duration_seconds=1200, dt=0.1, setpoint=65.0, T_amb=22.0):
    # Parâmetros Térmicos do Sistema (Caixa PP forrada com isolamento aluminizado)
    # Capacitâncias Térmicas (J/°C)
    C_heater = 180.0    # Bloco dissipador de alumínio + Peltier
    C_air = 45.0        # Volume de ar interno (6.5 litros)
    C_spool = 900.0     # Carretel de 1kg (PETG/PP)
    
    # Condutâncias Térmicas / Trocas de Calor (W/°C)
    G_ha = 8.5          # Convecção forçada Dissipador -> Ar (Ventoinha primária ligada)
    G_as = 3.2          # Convecção forçada Ar -> Carretel
    G_amb = 0.95        # Perdas Ar -> Ambiente externo (com isolamento aluminizado ε=0.05)
    
    # Potência nominal do atuador térmico Peltier (W)
    P_max = 60.0

    steps = int(duration_seconds / dt)
    time_series = [i * dt for i in range(steps)]

    # -------------------------------------------------------------------------
    # CENÁRIO 1: TERMOSTATO HISTÉRESE ON-OFF (BANG-BANG)
    # -------------------------------------------------------------------------
    t_onoff = []
    T_air_onoff = []
    T_spool_onoff = []
    u_onoff = []
    
    x1, x2, x3 = T_amb, T_amb, T_amb
    heater_state = True
    hysteresis_band = 1.0 # ±1.0°C

    for t in time_series:
        # Lógica Termostática On-Off
        if heater_state and x2 >= (setpoint + hysteresis_band):
            heater_state = False
        elif not heater_state and x2 <= (setpoint - hysteresis_band):
            heater_state = True
        
        u_val = 1.0 if heater_state else 0.0
        q_in = u_val * P_max
        
        # Equações diferenciais (Espaço de Estados)
        dx1 = (q_in - G_ha * (x1 - x2)) / C_heater
        dx2 = (G_ha * (x1 - x2) - G_as * (x2 - x3) - G_amb * (x2 - T_amb)) / C_air
        dx3 = (G_as * (x2 - x3)) / C_spool
        
        x1 += dx1 * dt
        x2 += dx2 * dt
        x3 += dx3 * dt
        
        t_onoff.append(t)
        T_air_onoff.append(x2)
        T_spool_onoff.append(x3)
        u_onoff.append(u_val * 100.0)

    # -------------------------------------------------------------------------
    # CENÁRIO 2: CONTROLADOR PID PROPOSTO (RELAY WINDOWING)
    # -------------------------------------------------------------------------
    t_pid = []
    T_air_pid = []
    T_spool_pid = []
    u_pid_efforts = []
    
    x1, x2, x3 = T_amb, T_amb, T_amb
    
    # Parâmetros PID calibrados para o perfil PETG
    Kp = 3.8
    Ki = 0.06
    Kd = 15.0
    
    integral = 0.0
    prev_error = 0.0
    d_filtered = 0.0
    
    # Janela temporal de 5 segundos
    window_size = 5.0
    window_start = 0.0
    current_duty = 0.0
    
    for t in time_series:
        error = setpoint - x2
        
        # A cada 0.2s (taxa de 5Hz do Arduino) atualiza o PID
        if int(round(t / 0.2)) != int(round((t - dt) / 0.2)):
            # Anti-windup
            if abs(error) < 10.0:
                integral += Ki * error * 0.2
                integral = max(0.0, min(100.0, integral))
            elif error <= -10.0:
                integral = 0.0
                
            d_raw = (error - prev_error) / 0.2
            d_filtered = 0.7 * d_filtered + 0.3 * d_raw
            prev_error = error
            
            p_term = Kp * error
            d_term = Kd * d_filtered
            
            effort = p_term + integral + d_term
            current_duty = max(0.0, min(100.0, effort))
            
        # Relay Windowing
        time_in_win = t % window_size
        on_time = (current_duty / 100.0) * window_size
        u_val = 1.0 if time_in_win < on_time else 0.0
        q_in = u_val * P_max
        
        dx1 = (q_in - G_ha * (x1 - x2)) / C_heater
        dx2 = (G_ha * (x1 - x2) - G_as * (x2 - x3) - G_amb * (x2 - T_amb)) / C_air
        dx3 = (G_as * (x2 - x3)) / C_spool
        
        x1 += dx1 * dt
        x2 += dx2 * dt
        x3 += dx3 * dt
        
        t_pid.append(t)
        T_air_pid.append(x2)
        T_spool_pid.append(x3)
        u_pid_efforts.append(current_duty)

    # -------------------------------------------------------------------------
    # CÁLCULO DE MÉTRICAS COMPARATIVAS
    # -------------------------------------------------------------------------
    # Métricas PID
    max_T_pid = max(T_air_pid)
    overshoot_pid = max(0.0, ((max_T_pid - setpoint) / setpoint) * 100.0)
    
    # Tempo de acomodação (faixa de ±2% do setpoint = ±1.3°C)
    settling_time_pid = None
    band = 0.02 * setpoint
    for i in range(len(T_air_pid) - 1, 0, -1):
        if abs(T_air_pid[i] - setpoint) > band:
            settling_time_pid = time_series[i]
            break
            
    # Erro de regime permanente nos últimos 300s
    last_samples_pid = T_air_pid[-int(300 / dt):]
    steady_error_pid = abs(sum(last_samples_pid) / len(last_samples_pid) - setpoint)

    # Métricas On-Off
    max_T_onoff = max(T_air_onoff)
    overshoot_onoff = ((max_T_onoff - setpoint) / setpoint) * 100.0
    last_samples_onoff = T_air_onoff[-int(300 / dt):]
    oscillation_amp_onoff = (max(last_samples_onoff) - min(last_samples_onoff)) / 2.0

    print("=" * 78)
    print(f"RELATÓRIO COMPARATIVO DE SIMULAÇÃO TÉRMICA EM ESPAÇO DE ESTADOS (SETPOINT = {setpoint}°C)")
    print("=" * 78)
    print(f"{'Métrica':<35} | {'PID Proposto (Relay)':<20} | {'Termostato On-Off':<20}")
    print("-" * 78)
    print(f"{'Sobressinal (Overshoot Máximo)':<35} | {overshoot_pid:.2f}% ({max_T_pid:.1f}°C) {'':<7} | {overshoot_onoff:.2f}% ({max_T_onoff:.1f}°C)")
    print(f"{'Tempo de Acomodação (±2%)':<35} | {settling_time_pid:.1f} s {'':<14} | Infinito (Oscilante)")
    print(f"{'Erro de Regime Permanente':<35} | < {steady_error_pid:.2f}°C {'':<14} | Flutuação ±{oscillation_amp_onoff:.2f}°C")
    print("=" * 78)
    
    if HAS_MATPLOTLIB:
        plt.figure(figsize=(10, 6))
        plt.plot(t_onoff, T_air_onoff, label="Termostato On-Off (Bang-Bang)", color="#ef4444", linewidth=1.5, alpha=0.8)
        plt.plot(t_pid, T_air_pid, label="Controle PID (Relay Windowing)", color="#38bdf8", linewidth=2.5)
        plt.axhline(y=setpoint, color="white", linestyle="--", label="Setpoint (65°C)", alpha=0.5)
        
        plt.title("Validação de Controle em Espaço de Estados: PID vs On-Off", color="white")
        plt.xlabel("Tempo (segundos)", color="lightgrey")
        plt.ylabel("Temperatura Interna (°C)", color="lightgrey")
        
        # Estilo dark mode
        plt.gca().set_facecolor("#0f172a")
        plt.gcf().patch.set_facecolor("#0f172a")
        plt.gca().tick_params(colors="lightgrey")
        for spine in plt.gca().spines.values():
            spine.set_edgecolor("#334155")
            
        plt.legend(facecolor="#1e293b", edgecolor="#334155", labelcolor="white")
        plt.grid(color="#334155", linestyle=":", alpha=0.6)
        
        script_dir = os.path.dirname(os.path.abspath(__file__))
        img_dir = os.path.join(script_dir, "..", "docs", "img")
        os.makedirs(img_dir, exist_ok=True)
        img_path = os.path.join(img_dir, "grafico_2_pid_vs_onoff.png")
        
        plt.savefig(img_path, dpi=300, bbox_inches="tight", facecolor="#0f172a")
        print(f">> Gráfico 2 salvo em: {img_path}")
        plt.close()

    return {
        "pid": {"max_T": max_T_pid, "overshoot": overshoot_pid, "settling_time": settling_time_pid, "ss_error": steady_error_pid},
        "onoff": {"max_T": max_T_onoff, "overshoot": overshoot_onoff, "oscillation": oscillation_amp_onoff}
    }

if __name__ == "__main__":
    run_simulation()
