## Projetech Studio

Controls **Projetech Studio**, the event video switcher and player by Projetech Eventos, over its vMix-compatible TCP API (port 8099 by default). Projetech Studio: https://studio.projetech.com.br

### Setup

1. In Projetech Studio, the API is on by default: _Config → API_, TCP port 8099.
2. Add a **Projetech Studio** connection and fill in **Projetech Studio IP** (the computer running it, `127.0.0.1` on the same computer) and **TCP port** (8099). **Refresh interval** is how often the state is read for variables and feedbacks (500 ms by default); tally is pushed and does not depend on it.
3. Drag buttons from _Presets → Projetech Studio_: one button per input (1–16) with tally (green on preview, red on air), plus CUT, FADE, STOP, FTB, REC, STREAM, the LED output and outputs 2 to 5, the master/slave buttons and the ProLume grid (see below).

### Troubleshooting

- **Connection stays red or orange:** check that Projetech Studio is open, that the IP and port match _Config → API_ and that both computers are on the same network. The Projetech Studio installer allows it through the Windows Firewall; any other firewall must allow TCP 8099.
- **A button lights up for the wrong input:** inputs are numbered by their position in the Projetech Studio list, so moving items changes their numbers.
- **Buttons go dark when the connection drops:** tally is cleared until Projetech Studio answers again, so an old program/preview is never shown.

### Actions

Cut, Fade (optional duration), Preview: load input, Take (input straight to air), Stop (back to the wait screen), Fade to black, Playback (play / pause / play-pause / restart), Input loop, Overlay, All overlays off, Input audio to program, Input volume, Master volume, Recording, Streaming, LED output, Auxiliary output (outputs 2 to 5: a multiview, one input or the program on another monitor; outputs 3–5 need Projetech Studio 1.2.12 or newer), Timer (start / pause / reset / set time), Master/slave: take over as master, Master/slave: take the stream, Free API function, and the ProLume actions (below).

Inputs are numbered in the order of the Projetech Studio list (1, 2, 3…). In Cut, Fade, Playback and Input loop the input is optional: 0 means "whatever is on preview" (or the program, for playback and loop). The time of _Timer → Set time_ and both fields of _Free API function_ accept variables.

### Feedbacks

- **Input tally**: red on air, green on preview.
- **Recording**, **Streaming**, **LED output on**, **Auxiliary output on** (outputs 2 to 5), **Fade to black**.
- **Master/slave role is…** (MASTER, SLAVE or standalone) and **Connected to Projetech Studio**.
- The ProLume ones (below).

### Variables

`active_number`, `active_name`, `preview_number`, `preview_name`, `program_remaining`, `recording`, `streaming`, `input_N_name` (inputs 1–32), `connected` (1 while Companion is connected to this Projetech Studio), `sync_role` (`master`, `slave` or `standalone`), `sync_partner`, `sync_state`, and the ProLume ones (below).

### Master/slave: switch the hardware switcher when the master fails

Two Projetech Studio computers can be linked as master and slave (Projetech Studio 1.2 or newer): the slave mirrors everything and takes over by itself when the master stops answering. To make Companion switch your hardware switcher (ATEM, Roland…) to the slave at that moment:

1. Add **two** Projetech Studio connections, one per computer (e.g. `studio_a` = master, `studio_b` = slave).
2. Create a **Trigger** with the event _Variable changed_ and two conditions: `$(studio_b:sync_role)` = `master` **and** `$(studio_a:connected)` = `0`.
3. As its action, cut the switcher to the input that carries computer B.

The second condition matters: if only the network between the two computers failed, A is still alive (and connected to Companion), so the switcher is left alone. The actions _Master/slave: take over as master_ and _Master/slave: take the stream_ are accepted by the slave too.

The _Master/slave_ presets show the role of this computer (green MASTER, blue SLAVE) and give TAKE MASTER and TAKE STREAM buttons.

### ProLume (clip grid, Projetech Studio 1.5)

With ProLume mode on (_Modo ProLume_ in Projetech Studio 1.5 or newer, per project), a grid of layers × columns drives the program: firing a clip or a column puts it straight on air. Layer 1 is the bottom one and columns count from the left. Wherever an action or feedback asks for a layer or a column, type its number or the name shown on the grid (variables are accepted). With an older Projetech Studio, or a project without a grid, these buttons stay dark.

- **Actions** (_ProLume: …_): trigger clip, select clip (does not fire), trigger column, select column, trigger the next / previous column, next / previous clip of a layer, eject layer, eject all, layer opacity, layer volume and composition master (set, increase or decrease, 0–100), layer bypass and solo (on, off, toggle), layer transition (ms, Fade or Cut), layer blend.
- **Feedbacks**: clip on air (green), selected cell (yellow), empty cell (dimmed), column fired, layer bypassed, layer solo, layer's clip ending (red), ProLume mode on.
- **Variables**: `composition_mode`, `composition_master`, `column_current`, `column_current_name`, `column_selected`, `layer_selected`; for layers 1–16 `layer_N_name`, `layer_N_clip_name`, `layer_N_column`, `layer_N_elapsed`, `layer_N_remaining` (mm:ss), `layer_N_remaining_seconds`, `layer_N_progress` (0–100) and `layer_N_opacity`, whose clock keeps counting between polls; `clip_L_C_name` and `column_C_name` for the first 8 layers and columns.
- **Presets**: _ProLume: clips_ (8 × 8 cells, the top layer first as on the grid: dimmed when empty, yellow when selected, green on air), _ProLume: columns_ (columns 1–8 lit when fired, NEXT COL, PREV COL, EJECT ALL) and _ProLume: layers_ (for layers 1–8: X eject, B bypass, S solo and the remaining time, red when the clip is ending).
- While the mode is on, Projetech Studio refuses the switcher actions (Cut, Fade, Preview, Take, Play…) and Stop ejects every layer. A SLAVE refuses every command (send them to the master), and its feedbacks and variables keep following the mirrored grid.

### OSC

Projetech Studio also receives OSC (_Config → OSC_, UDP port 7000, off by default). In Companion, use this module (recommended) or the **Resolume Arena** module with **Use REST / WebSocket API** unchecked. With that module, the standard actions that need REST (Connect Column, Select Column, Solo Layer and the "… Change" actions) do nothing: replace them with its **OSC: …** actions (OSC: Trigger Column, OSC: Select Column, OSC: Solo Layer, OSC: Set Layer Opacity…). For its feedback (variables, active column, progress), turn on its OSC listener (port 7001): Projetech Studio answers its queries. On a SLAVE the OSC commands are ignored and the state keeps being answered.
