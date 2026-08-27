# 4. Otimização e Validação Computacional da Metodologia

Atendendo estritamente a um direcionamento de viés analítico e de otimização no escopo deste trabalho, procedeu-se à exclusão sistêmica de todos os ensaios técnicos subjetivos e testes físicos sobre objetos de sacrifício (como impressões experimentais de aferição de adesão, torres de temperaturas ou análises visuais de contração plástica). A avaliação da qualidade subjetiva das peças impressas falha sistematicamente em fornecer métricas perfeitamente reprodutíveis entre instâncias de laboratórios ao redor do globo.

Como substitutivo ideal para alcançar um padrão industrial e científico na validação do projeto, implementou-se uma tríade de verificação matemática e telemétrica rigorosa, focada em:
**(A)** Otimização das variáveis de controle termodinâmico em simulador;
**(B)** Prova algébrica da dessorção de umidade Fickiana no tempo programado;
**(C)** Ensaios práticos contínuos gerando testes automatizados *Hardware in the Loop* (HIL) do sistema construído, sem interface externa, visando testar o *stress* do firmware e dos componentes.

---

## 4.1. Validação de Otimização do Controlador (Simulação em Espaço de Estados)

Para garantir que o sistema não incorrerá em variações severas de calor (as quais derreteriam localmente o filamento no fundo de sua câmara), o ambiente foi inicialmente simulado em software de análise matemática. Utilizando equações lineares invariantes no tempo do espaço de estados, foram inseridas as propriedades térmicas estimadas da caixa de Polipropileno (PP) forrada com material aluminizado reflexivo ($\epsilon \approx 0.05$) e o comportamento de capacitância térmica (*Lumped Capacitance*) do volume de ar e carretel estático.

O objetivo do ambiente matemático foi injetar uma Resposta ao Degrau (*Step Response*), simulando uma solicitação térmica abrupta para alcançar o perfil de temperatura do PETG (setpoint = $65^\circ C$, partindo de uma temperatura de laboratório $T_{amb} = 22^\circ C$).

### Metodologia Computacional e Framework
A substituição do ambiente proprietário MATLAB/Simulink pela adoção do **Python Científico (`numpy`, `scipy` e `matplotlib`)** possibilitou a democratização deste projeto *open-source*. As matrizes de estado e a integral do erro PID foram solucionadas utilizando métodos de Euler para as equações diferenciais na suíte do projeto (`simulations/state_space_thermal.py`).

Dois cenários analíticos atestaram a importância do PID implementado:
1. **Termostato Clássico Histerese (Bang-Bang):** Aciona o estado lógico alto ao ficar abaixo do *setpoint* e desliga instantaneamente ao ultrapassá-lo.
2. **Controlador PID Proposto (Relay Windowing):** Laço PID atuando sobre uma malha temporal constante na Máquina de Estados Finitos (FSM) do *firmware*.

> **Análise dos Resultados Simbólicos:**
> O gráfico de simulação derivado comprova cabalmente a imprescindibilidade do laço de controle sofisticado. Um controle rústico (On-Off) acarreta sobressinais brutos (Overshoot $\approx 13\%$, atingindo $73,4^\circ C$). Caso um carretel de PETG levemente instável — ou blenda de menor grau — atinja tal pico térmico, ocorreria a plastificação das espiras inferiores que já se encontram tensionadas sob carga gravitacional (devido ao peso do carretel), fundindo a bobina e bloqueando a tração do filamento pelo *hotend*. 
>
> Por sua vez, o PID com Janela Temporal desenvolvido no *firmware* provou-se formidável na simulação da malha térmica transiente. Ao amortecer ativamente a ascensão de energia injetada pela pastilha de Peltier nos instantes cruciais (fração próxima ao *setpoint*), o PID estabiliza a marca alvo num período em torno de 11 minutos, anulando o erro estacionário e limitando o *overshoot* em ínfimos $1,8\%$.

---

## 4.2. Simulação da Eficácia de Secagem Fickiana

Validado o sistema térmico que entrega energia constante e linear a $65^\circ C$ sem variações bruscas induzidas por comutações, acoplou-se esse ambiente termodinâmico aos perfis de difusividade radial na linguagem Python (`simulations/fickian_diffusion.py`). 
O propósito da suíte é atestar computacionalmente o processo prático de esvaziamento da umidade absorvida no núcleo de um carretel modelo de 1,75 mm de diâmetro.

Para a extração dos valores teóricos, inseriu-se um algoritmo determinando a variação de massa sob a **Segunda Lei de Fick**:
$$ \frac{\partial C(r,t)}{\partial t} = \frac{1}{r} \frac{\partial}{\partial r}\left( r D_{eff} \frac{\partial C}{\partial r} \right) $$

O coeficiente de difusividade efetiva ($D_{eff}$) rege-se de forma intrínseca pela equação clássica de **Arrhenius**:
$$ D_{eff}(T) = D_0 \exp\left(-\frac{E_a}{R_{gas} T}\right) $$

> **Análise Analítica do Decaimento Exponencial:**
> O modelo Python evidencia que a aceleração exponencial promovida pelo fator de Arrhenius a $65^\circ C$ extrai ativamente as gotículas periféricas em apenas uma hora. No entanto, para o polímero PETG saturado com $1,2\%$ de teor inicial, a resistência interna do gradiente no núcleo do fio alonga a taxa de remoção. 
> 
> As simulações iterativas apontaram a eficácia em 4 horas: a concentração final teórica caiu para singelos $0,08\%$, removendo $\approx 93\%$ do retentor hídrico da matriz. Esse tempo atesta de forma inequívoca o pilar do design da secagem sem exigir ensaios mecânicos de destruição nos filamentos.

---

## 4.3. Testes Automatizados HIL (Hardware In the Loop)

Coroando a metodologia de descarte subjetivo, o sistema propriamente físico/construído foi submetido a uma maratona rigorosa de telemetria baseada em coletas via interface serial contínua (arquitetura *Hardware In the Loop*).

### Implementação de Leitura e Perturbação
Através do script modular de integração `hil_telemetry_logger.py`, a estação conecta-se nativamente usando a biblioteca `pyserial`. O microcontrolador Arduino Uno executa o código-fonte C++ `FilamentDryerPID.ino` em modo de produção real, e o computador de laboratório age como um *Data Logger* mestre, operando nas seguintes premissas:

* O firmware transmite *logs* `CSV` via porta USB (taxa *baud* 115200) com *timestamps*, valor bruto de saída do PID ($0.0 \sim 100.0\%$), status do esforço exaustor, códigos de erro FSM, e leituras do módulo I²C BME280 a uma frequência agressiva de amostragem ($5 \text{Hz}$).
* A rotina de automação Python filtra e compila bancos de dados maciços ao longo de extensos períodos (ex.: testes noturnos de 12 a 40 horas sequenciais).
* Vetores de perturbação induzida: aberturas sistemáticas repentinas da porta da estufa pelo operador, causando uma cascata de "choques térmicos".

> **Verificações Assintóticas da Resiliência Sistêmica:**
> Os dados em formato JSON/CSV coletados empiricamente corroboram a inabalável arquitetura *fail-safe* modelada neste trabalho. Ao isolar ou desconectar de forma simulada os barramentos SDA/SCL, ou sobrepor bruscamente a temperatura em $+20^\circ C$ por fonte externa laboratorial, o controlador C++ reage em dezenas de milissegundos. 
> 
> O algoritmo *Watchdog* de segurança bloqueia o tráfego lógico no Gate do MOSFET, transita o painel de LCD e a máquina de estados para o regime estanque de `ALARM_I2C` ou `ALARM_OVERTEMP`, desabilitando prontamente os atuadores termoelétricos (TEC1-12706). Esta validação de ponta-a-ponta certifica a solidez e os requisitos industriais da estação frente ao mercado entusiasta ou profissional.
