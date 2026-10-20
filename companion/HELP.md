## Projetech Studio

Controls **Projetech Studio**, the event video switcher and player by Projetech Eventos, over its vMix-compatible TCP API (port 8099 by default). Projetech Studio: https://studio.projetech.com.br

The module's labels are in Portuguese (Brazil), the language of Projetech Studio. English summary below, full help in Portuguese after it.

### Setup

1. In Projetech Studio, the API is on by default: _Saída / Config → API (compatível com vMix)_, TCP port 8099.
2. Add a **Projetech Studio** connection and fill in **IP do Projetech Studio** (the PC running it, `127.0.0.1` on the same PC) and **Porta TCP** (8099).
3. Drag buttons from _Presets → Projetech Studio_: one button per input (1–16) with tally (green on preview, red on air), plus CUT, FADE, STOP, FTB, REC, STREAM, LED output and Outputs 2 to 5, and the Modo PLume grid (see below).

### Troubleshooting

- **Connection stays red or orange:** check that Projetech Studio is open, that the IP and port match _Saída / Config → API_ and that both PCs are on the same network. The Projetech Studio installer allows it through Windows Firewall; any other firewall must allow TCP 8099.
- **A button lights up for the wrong input:** inputs are numbered by their position in the Projetech Studio list, so moving items changes their numbers.
- **Buttons go dark when the connection drops:** tally is cleared until Projetech Studio answers again, so an old program/preview is never shown.

### Actions

Cut, Fade (optional duration), Preview input, Take (input straight to air), Stop (back to the wait screen), Fade to black, Play / Pause / Play-Pause / Restart, input loop, overlays, input audio to program, input and master volume, recording, streaming, LED output, auxiliary outputs (Output 2 to 5: multiview, one input or the program on another monitor; Outputs 3–5 need Projetech Studio 1.2.12 or newer), timer (start / pause / reset / set), master/slave take over and take the stream, a free API function, and the Modo PLume actions (below).

Inputs are numbered in the order of the Projetech Studio list (1, 2, 3…). Where an action asks for an input, 0 means "whatever is on preview".

### Feedbacks and variables

- Feedbacks: input tally (program or preview), recording, streaming, LED output on, auxiliary output (2 to 5) on, fade to black, master/slave role, connected, and the Modo PLume ones (below).
- Variables: `active_number`, `active_name`, `preview_number`, `preview_name`, `program_remaining`, `recording`, `streaming`, `input_N_name`, `connected`, `sync_role`, `sync_partner`, `sync_state`, and the Modo PLume ones (below).

### Master/slave: switch the hardware switcher when the master fails

Two Projetech Studio computers can be linked as master and slave (Projetech Studio 1.2+, _Sincronia_ tab): the slave mirrors everything and takes over by itself when the master stops answering. To make Companion switch your hardware switcher (ATEM, Roland…) to the slave at that moment:

1. Add **two** Projetech Studio connections, one per computer (e.g. `studio_a` = master, `studio_b` = slave).
2. Create a **Trigger** with the event _Variable changed_ and two conditions: `$(studio_b:sync_role)` = `master` **and** `$(studio_a:connected)` = `0`.
3. As its action, cut the switcher to the input that carries computer B.

The second condition matters: if only the network between the two computers failed, A is still alive (and connected to Companion), so the switcher is left alone. The actions _Sincronia: assumir como master_ and _Sincronia: assumir a transmissão_ are accepted by the slave too.

### Modo PLume (clip grid, Projetech Studio 1.5)

With the Modo PLume on (Projetech Studio 1.5 or newer, per project), a grid of layers × columns drives the program: firing a clip or a column puts it straight on air. Layer 1 is the bottom one and columns count from the left. Wherever an action or feedback asks for a layer or a column, type its number or the name shown on the grid (variables are accepted). With an older Projetech Studio, or a project without a grid, these buttons stay dark.

- **Actions** (_Modo PLume: …_): trigger clip, select clip (does not fire), trigger column, select column, next / previous column, next / previous clip of a layer, eject layer, eject all, layer opacity, layer volume and composition master (set, add or subtract, 0–100), layer bypass and solo (on, off, toggle), layer transition (ms, Fade or Cut), layer blend.
- **Feedbacks**: clip on air (green), selected cell (yellow), empty cell (dimmed), fired column, layer bypassed, layer solo, layer's clip ending (red), Modo PLume on.
- **Variables**: `composition_mode`, `composition_master`, `column_current`, `column_current_name`, `column_selected`, `layer_selected`; for layers 1–16 `layer_N_name`, `layer_N_clip_name`, `layer_N_column`, `layer_N_elapsed`, `layer_N_remaining` (mm:ss), `layer_N_remaining_seconds`, `layer_N_progress` (0–100) and `layer_N_opacity`, whose clock keeps counting between polls; `clip_L_C_name` and `column_C_name` for the first 8 layers and columns.
- **Presets**: _Modo PLume: clipes_ (8 × 8 cells, the top layer first as on the grid: dimmed when empty, yellow when selected, green on air), _Modo PLume: colunas_ (columns 1–8 lit when fired, NEXT COL, PREV COL, EJECT ALL) and _Modo PLume: camadas_ (for layers 1–8: X eject, B bypass, S solo and the remaining time, red when the clip is ending).
- While the mode is on, Projetech Studio refuses the switcher actions (Cut, Fade, Preview, Take, Play…) and Stop ejects every layer. A SLAVE refuses every command (send them to the master), and its feedbacks and variables keep following the mirrored grid.

### OSC

Projetech Studio also receives OSC (_Saída / Config → OSC_, UDP port 7000, off by default). In Companion, use this module (recommended) or the **Resolume Arena** module with **Use REST / WebSocket API** unchecked. With that module, the standard actions that need REST (Connect Column, Select Column, Solo Layer and the "… Change" actions) do nothing: replace them with its **OSC: …** actions (OSC: Trigger Column, OSC: Select Column, OSC: Solo Layer, OSC: Set Layer Opacity…). For its feedback (variables, active column, progress), turn on its OSC listener (port 7001): Projetech Studio answers its queries. On a SLAVE the OSC commands are ignored and the state keeps being answered.

---

## Português

Controla o **Projetech Studio** pela TCP API (compatível com vMix), porta 8099 por padrão.

### Configuração

- **IP do Projetech Studio**: IP do PC onde o Projetech Studio está aberto (`127.0.0.1` no mesmo PC).
- **Porta TCP**: a porta configurada em _Saída / Config → API_ (padrão 8099).
- **Intervalo de atualização**: com que frequência o estado (XML) é lido para variáveis e feedbacks (padrão 500 ms). O tally chega por push, independente disso.

### Problemas comuns

- **Conexão fica vermelha ou laranja:** confira se o Projetech Studio está aberto, se o IP e a porta batem com _Saída / Config → API_ e se os dois PCs estão na mesma rede. O instalador do Projetech Studio libera o programa no Firewall do Windows; outro firewall precisa liberar a porta TCP 8099.
- **O botão acende no input errado:** os inputs são numerados pela posição na lista do Projetech Studio; mover itens na lista muda os números.
- **Os botões apagam quando a conexão cai:** o tally é zerado até o Projetech Studio responder de novo, para nunca mostrar um programa/preview antigo.

### Ações

Cut, Fade (com duração), Preview Input, Take (Active Input), Stop (tela de espera), Play / Pause / Play-Pause / Restart, Loop, Overlay (liga/desliga/alternar), Áudio para o PGM, Volume do input, Volume master, Gravação, Streaming, Saída LED, Saída auxiliar (Saída 2 a 5: multiview, um input ou o programa em outro monitor; as Saídas 3 a 5 pedem o Projetech Studio 1.2.12 ou mais novo), Timer (iniciar / pausar / zerar / definir), Fade to Black, Sincronia: assumir como master, Sincronia: assumir a transmissão, Função livre da API e as ações do Modo PLume (abaixo).

Os inputs são numerados na ordem da lista do Projetech Studio (1, 2, 3…). Onde a ação pede um input, 0 significa "o que estiver no preview".

### Feedbacks

- **Tally do input**: vermelho no ar, verde no preview (o botão muda de cor).
- **Gravando**, **Transmitindo**, **Saída LED ligada**, **Saída auxiliar ligada** (Saída 2 a 5), **Fade to black**.
- **Papel na sincronia é…** (MASTER, SLAVE ou independente) e **Conectado ao Projetech Studio**.
- Os do Modo PLume (abaixo).

### Variáveis

`active_number`, `active_name`, `preview_number`, `preview_name`, `program_remaining`, `recording`, `streaming`, `input_N_name`, `connected` (1 enquanto o Companion está conectado a este Projetech Studio), `sync_role` (`master`, `slave` ou `independente`), `sync_partner`, `sync_state`, e as do Modo PLume (abaixo).

### Master/slave: trocar o switcher quando o master cai

Dois computadores com Projetech Studio podem ser ligados como master e slave (Projetech Studio 1.2 ou mais novo, aba _Sincronia_): o slave espelha tudo e assume sozinho quando o master para de responder. Para o Companion trocar o switcher de vídeo (ATEM, Roland…) para o slave nesse momento:

1. Crie **duas** conexões Projetech Studio, uma para cada computador (ex.: `studio_a` = master, `studio_b` = slave).
2. Crie um **Trigger** com o evento _Variável mudou_ e duas condições: `$(studio_b:sync_role)` = `master` **e** `$(studio_a:connected)` = `0`.
3. Como ação, corte o switcher para a entrada que recebe o computador B.

A segunda condição é importante: se só a rede entre os dois computadores caiu, o A continua vivo (e conectado ao Companion), e o switcher não é trocado. As ações _Sincronia: assumir como master_ e _Sincronia: assumir a transmissão_ também funcionam no slave.

### Presets

Um botão por input (1–16) com tally, mais CUT, FADE, STOP, FTB, REC, STREAM, Saída LED e Saídas 2 a 5. Na categoria _Sincronia_: o papel deste computador (verde MASTER, azul SLAVE), ASSUMIR MASTER e ASSUMIR STREAM. E as três categorias do Modo PLume (abaixo).

### Modo PLume (grade de clipes, Projetech Studio 1.5)

Com o Modo PLume ligado (Projetech Studio 1.5 ou mais novo, por projeto), a grade de camadas × colunas comanda o programa: disparar um clipe ou uma coluna vai direto ao ar. A camada 1 é a de baixo e as colunas contam da esquerda. Onde a ação ou o feedback pede camada ou coluna, informe o número ou o nome que aparece na grade (aceita variáveis). Com um Projetech Studio mais antigo, ou num projeto sem grade, esses botões ficam apagados.

- **Ações** (_Modo PLume: …_): disparar clipe, selecionar clipe (não dispara), disparar coluna, selecionar coluna, próxima / anterior coluna, próximo / anterior clipe da camada, ejetar camada, ejetar tudo, opacidade e volume da camada e master da composição (definir, aumentar ou diminuir, 0–100), bypass e solo da camada (ligar, desligar, alternar), transição da camada (ms, Fade ou Corte) e blend da camada.
- **Feedbacks**: clipe no ar (verde), célula selecionada (amarelo), célula vazia (apagada), coluna disparada, camada em bypass, camada em solo, clipe da camada terminando (vermelho) e Modo PLume ligado.
- **Variáveis**: `composition_mode`, `composition_master`, `column_current`, `column_current_name`, `column_selected`, `layer_selected`; para as camadas 1 a 16, `layer_N_name`, `layer_N_clip_name`, `layer_N_column`, `layer_N_elapsed`, `layer_N_remaining` (mm:ss), `layer_N_remaining_seconds`, `layer_N_progress` (0–100) e `layer_N_opacity`, com o relógio contando entre as leituras; `clip_L_C_name` e `column_C_name` para as 8 primeiras camadas e colunas.
- **Presets**: _Modo PLume: clipes_ (as 8 × 8 células, a camada de cima primeiro, como na grade: apagada quando vazia, amarela quando selecionada, verde no ar), _Modo PLume: colunas_ (colunas 1 a 8, acesas quando disparadas, NEXT COL, PREV COL e EJECT ALL) e _Modo PLume: camadas_ (para as camadas 1 a 8: X ejeta, B bypass, S solo e o tempo restante, vermelho quando o clipe está terminando).
- Com o modo ligado, o Projetech Studio recusa as ações do switcher (Cut, Fade, Preview, Take, Play…) e o Stop ejeta todas as camadas. Num SLAVE todos os comandos são recusados (mande para o master), e os feedbacks e variáveis continuam seguindo a grade espelhada.

### OSC

O Projetech Studio também recebe OSC (_Saída / Config → OSC_, porta UDP 7000, desligado por padrão). No Companion, use este módulo (recomendado) ou o módulo **Resolume Arena** com **Use REST / WebSocket API** desmarcado. Nesse módulo, as ações padrão que precisam do REST (Connect Column, Select Column, Solo Layer e as "… Change") não fazem nada: troque pelas ações **OSC: …** dele (OSC: Trigger Column, OSC: Select Column, OSC: Solo Layer, OSC: Set Layer Opacity…). Para o retorno (variáveis, coluna ativa, progresso), ligue o OSC Listener do módulo (porta 7001): o Projetech Studio responde às consultas dele. Num SLAVE os comandos OSC são ignorados e o estado continua sendo respondido.
