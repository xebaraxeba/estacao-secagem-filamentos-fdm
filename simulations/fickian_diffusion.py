#!/usr/bin/env python3
"""
===============================================================================
MODELAGEM DE DIFUSÃO FICKIANA & DESSORÇÃO DE UMIDADE EM FILAMENTOS CILÍNDRICOS
Projeto: Estação de Secagem de Filamentos FDM (Item 4.2 do Relatório Técnico)
===============================================================================

Equação de Difusão em Coordenadas Cilíndricas (Segunda Lei de Fick):
dC/dt = (1/r) * d/dr ( r * D_eff * dC/dr )

Dependência de Temperatura (Relação de Arrhenius):
D_eff(T) = D_0 * exp( -E_a / (R_gas * T_K) )
"""

import math
import os

try:
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

def calculate_fickian_desorption():
    # Parâmetros Físico-Químicos do PETG e Geometria do Filamento
    # Raio do filamento padrão 1.75mm (em metros)
    radius = (1.75 / 2.0) * 1e-3  # 0.875 mm = 0.000875 m
    
    # Parâmetros de Arrhenius para Dessorção de Água em PETG
    D_0 = 4.2e-5            # Fator pré-exponencial (m²/s)
    E_a = 48200.0           # Energia de ativação (J/mol)
    R_gas = 8.314           # Constante universal dos gases (J/(mol·K))
    
    T_celsius = 65.0        # Temperatura de secagem controlada (°C)
    T_kelvin = T_celsius + 273.15
    
    # Coeficiente de difusão efetivo D_eff a 65°C (338.15 K)
    D_eff = D_0 * math.exp(-E_a / (R_gas * T_kelvin))
    
    # Concentração inicial de umidade retida no filamento após saturação em 80% RH
    C_0 = 1.200 # 1.200% em massa
    C_eq = 0.020 # Umidade residual em equilíbrio com ar quente seco (%)
    
    # Discretização em Diferenças Finitas Unidimensionais Radiais
    N_nodes = 50
    dr = radius / (N_nodes - 1)
    
    # Perfil radial inicial uniforme de umidade
    C = [C_0 for _ in range(N_nodes)]
    r_nodes = [i * dr for i in range(N_nodes)]
    
    total_time_hours = 4.0
    total_time_seconds = total_time_hours * 3600.0
    
    # Critério de estabilidade de Von Neumann para difusão explícita: dt <= dr² / (2 * D_eff)
    dt = 0.4 * (dr * dr) / (2.0 * D_eff)
    num_steps = int(total_time_seconds / dt)
    
    print("=" * 86)
    print("SIMULAÇÃO ALGÉBRICA DA DESSORÇÃO DE UMIDADE FICKIANA EM PETG (1.75 mm / 65°C)")
    print(f"D_eff calculado a {T_celsius}°C: {D_eff:.4e} m²/s | Raio: {radius*1e3:.3f} mm")
    print("=" * 86)
    print(f"{'Tempo (h)':<10} | {'Concentração Retida (%)':<25} | {'Remoção Saturada (%)':<25} | {'Condição do Polímero'}")
    print("-" * 86)
    
    logged_hours = [0.0, 1.0, 2.0, 3.0, 4.0]
    next_log_idx = 0
    current_time_s = 0.0
    
    # Para plotagem do gráfico
    history_t_hours = []
    history_C_mean = []
    
    for step in range(num_steps + 1):
        t_hours = current_time_s / 3600.0
        
        if next_log_idx < len(logged_hours) and (t_hours >= logged_hours[next_log_idx] or step == num_steps):
            # Integração radial ponderada pelo volume cilíndrico para obter a concentração média global
            # Integral(2*pi*r * C(r) dr) / (pi * R²)
            numerator = 0.0
            for i in range(N_nodes - 1):
                r_mid = 0.5 * (r_nodes[i] + r_nodes[i+1])
                c_mid = 0.5 * (C[i] + C[i+1])
                numerator += 2.0 * r_mid * c_mid * dr
            C_mean = numerator / (radius * radius)
            
            removed_pct = ((C_0 - C_mean) / (C_0 - C_eq)) * 100.0
            
            condition = ""
            if t_hours < 0.5:
                condition = "Crítica (Risco de severa microebulição)"
            elif t_hours < 1.5:
                condition = "Ruim (Ainda ocasionando bolhas e opacidade)"
            elif t_hours < 2.5:
                condition = "Regular (Redução de hidrólise molecular perceptível)"
            elif t_hours < 3.5:
                condition = "Boa (Adequado p/ impressões não estruturais)"
            else:
                condition = "Excelente (< 0.10% umidade - Resistência mecânica plena)"
                
            print(f"{logged_hours[next_log_idx]:<10.1f} | {C_mean:<25.4f}% | {removed_pct:<25.1f}% | {condition}")
            next_log_idx += 1
            
        # Condição de contorno na superfície (r = R): equilíbrio rápido com a corrente de ar quente
        C[-1] = C_eq
        
        # Atualização pelo método das diferenças finitas explícitas
        C_new = list(C)
        # Centro (r = 0): simetria cilíndrica dC/dr = 0 -> dC/dt = 4 * D_eff * (C[1] - C[0]) / dr²
        C_new[0] = C[0] + 4.0 * D_eff * dt * (C[1] - C[0]) / (dr * dr)
        
        for i in range(1, N_nodes - 1):
            r_i = r_nodes[i]
            d2C_dr2 = (C[i+1] - 2*C[i] + C[i-1]) / (dr * dr)
            dC_dr = (C[i+1] - C[i-1]) / (2 * dr)
            C_new[i] = C[i] + D_eff * dt * (d2C_dr2 + (1.0 / r_i) * dC_dr)
            
        # Gravar histórico para plot a cada ~36 segundos (0.01h)
        if step % max(1, int(36.0 / dt)) == 0:
            numerator = 0.0
            for i in range(N_nodes - 1):
                r_mid = 0.5 * (r_nodes[i] + r_nodes[i+1])
                c_mid = 0.5 * (C[i] + C[i+1])
                numerator += 2.0 * r_mid * c_mid * dr
            history_t_hours.append(t_hours)
            history_C_mean.append(numerator / (radius * radius))
            
        C = C_new
        current_time_s += dt
        
    print("=" * 86)
    
    if HAS_MATPLOTLIB:
        plt.figure(figsize=(10, 6))
        plt.plot(history_t_hours, history_C_mean, color="#22c55e", linewidth=2.5, label="Difusão Fickiana (PETG a 65°C)")
        plt.fill_between(history_t_hours, history_C_mean, 0, color="#22c55e", alpha=0.1)
        
        plt.axhline(y=0.10, color="#ef4444", linestyle="--", label="Limite Seguro Impressão (0.1%)", alpha=0.8)
        
        plt.title("Gráfico 1: Curva de Dessorção de Umidade Fickiana (Cilíndrica)", color="white")
        plt.xlabel("Tempo de Exposição (Horas)", color="lightgrey")
        plt.ylabel("Concentração de Umidade Retida (%)", color="lightgrey")
        
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
        img_path = os.path.join(img_dir, "grafico_1_difusao_fickiana.png")
        
        plt.savefig(img_path, dpi=300, bbox_inches="tight", facecolor="#0f172a")
        print(f">> Gráfico 1 salvo em: {img_path}")
        plt.close()

if __name__ == "__main__":
    calculate_fickian_desorption()
