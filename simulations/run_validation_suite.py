#!/usr/bin/env python3
import sys
import os
import argparse

# Adiciona o diretório atual ao path para poder importar os módulos
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import state_space_thermal
    import fickian_diffusion
    import hil_telemetry_logger
except ImportError as e:
    print(f"Erro ao importar módulos de simulação: {e}")
    sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Hub de Validação Computacional (Estação de Secagem FDM)")
    parser.add_argument("--hil-port", type=str, help="Porta Serial física (opcional)", default=None)
    parser.add_argument("--hil-duration", type=int, default=60, help="Duração do ensaio HIL em segundos")
    args = parser.parse_args()

    print("\n" + "="*80)
    print(" INICIANDO SUÍTE DE VALIDAÇÃO COMPUTACIONAL (ITEM 4)")
    print("="*80 + "\n")

    # 1. Simulação em Espaço de Estados (Validação PID)
    print(">>> 1. Executando Simulação Térmica em Espaço de Estados (PID vs On-Off)...")
    res_thermal = state_space_thermal.run_simulation(duration_seconds=1200, dt=0.1, setpoint=65.0)
    print("... OK.\n")

    # 2. Simulação de Difusão Fickiana (Dessorção)
    print(">>> 2. Executando Simulação Numérica de Difusão Fickiana (PETG a 65°C)...")
    fickian_diffusion.calculate_fickian_desorption()
    print("... OK.\n")

    # 3. Teste HIL / Telemetria
    print(">>> 3. Executando Logging de Telemetria HIL (Hardware-In-The-Loop)...")
    hil_telemetry_logger.run_hil_test(duration_sec=args.hil_duration, physical_port=args.hil_port)
    print("... OK.\n")

    print("="*80)
    print(" SUÍTE FINALIZADA COM SUCESSO.")
    print(" Os gráficos matemáticos foram salvos em: docs/img/")
    print(" O arquivo CSV de telemetria foi salvo em: hil_telemetry_log.csv")
    print("="*80 + "\n")

if __name__ == "__main__":
    main()
