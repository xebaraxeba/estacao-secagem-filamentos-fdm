@echo off
title Estacao de Secagem de Filamentos FDM
color 0B

echo ========================================================
echo INICIANDO SUITE DE SIMULACAO PYTHON (MATPLOTLIB)
echo ========================================================
echo.
echo Calculando modelagem LTI e Dessorcao Fickiana...
echo Por favor aguarde, gerando os graficos analiticos...
python simulations\run_validation_suite.py
echo.
echo Graficos gerados com sucesso!
echo.

echo ========================================================
echo INICIANDO SERVIDOR WEB LOCAL E INTERFACE DIGITAL TWIN
echo ========================================================
echo.
echo Abrindo o navegador padrao...
start http://localhost:8000/app/index.html
echo.
echo Servidor local rodando na porta 8000. 
echo NAO feche esta janela enquanto estiver usando a plataforma.
echo Para desligar, basta fechar esta tela ou pressionar CTRL+C.
echo.

REM Inicia o servidor HTTP embutido do Python
python -m http.server 8000
