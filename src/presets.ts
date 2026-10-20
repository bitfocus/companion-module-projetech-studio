import { combineRgb, type CompanionOptionValues, type CompanionPresetDefinitions } from '@companion-module/base'
import { RED, GREEN, WHITE, BLACK, YELLOW, ORANGE, CYAN, DIM_BG, DIM_TEXT } from './feedbacks.js'
import { GRID_SIZE } from './variables.js'

/** Categories of the Modo PLume presets (a fixed 8 × 8 grid: buttons of cells that do not exist stay dim). */
export const PLUME_CLIPS = 'Modo PLume: clipes'
export const PLUME_COLUMNS = 'Modo PLume: colunas'
export const PLUME_LAYERS = 'Modo PLume: camadas'

const BUTTON = combineRgb(40, 44, 56)

/**
 * Ready-made buttons: one per input (1–16) that loads it on preview and lights green on preview and red on air, plus
 * the switcher controls, and the Modo PLume's clips, columns and layers. Companion rewrites the `$(projetech-studio:…)`
 * prefix to the connection's label.
 */
export function getPresets(): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}
	for (let i = 1; i <= 16; i++) {
		presets[`input_${i}`] = {
			type: 'button',
			category: 'Inputs',
			name: `Input ${i}`,
			style: {
				text: `$(projetech-studio:input_${i}_name)\\n${i}`,
				size: '14',
				color: WHITE,
				bgcolor: combineRgb(40, 44, 56),
			},
			steps: [{ down: [{ actionId: 'previewInput', options: { input: i } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'tally',
					options: { input: i, which: 'preview' },
					style: { bgcolor: GREEN, color: WHITE },
				},
				{ feedbackId: 'tally', options: { input: i, which: 'program' }, style: { bgcolor: RED, color: WHITE } },
			],
		}
	}
	const simple = (
		id: string,
		text: string,
		actionId: string,
		options: CompanionOptionValues,
		feedbackId?: string,
		bg = combineRgb(40, 44, 56),
	) => {
		presets[id] = {
			type: 'button',
			category: 'Switcher',
			name: text,
			style: { text, size: '18', color: WHITE, bgcolor: bg },
			steps: [{ down: [{ actionId, options }], up: [] }],
			feedbacks: feedbackId ? [{ feedbackId, options: {}, style: { bgcolor: RED, color: WHITE } }] : [],
		}
	}
	simple('cut', 'CUT', 'cut', { input: 0 })
	simple('fade', 'FADE', 'fade', { input: 0, duration: 0 })
	simple('stop', 'STOP', 'stop', {})
	simple('ftb', 'FTB', 'fadeToBlack', {}, 'fadeToBlack')
	simple('rec', 'REC', 'recording', { cmd: 'StartStopRecording' }, 'recording')
	simple('stream', 'STREAM', 'streaming', { cmd: 'StartStopStreaming', slot: 0 }, 'streaming')
	simple('output', 'SAÍDA\\nLED', 'output', { cmd: 'Fullscreen' }, 'output')
	// One button per auxiliary output; Saída 2 keeps its preset id.
	for (const n of [2, 3, 4, 5]) {
		presets[n === 2 ? 'aux' : `aux_${n}`] = {
			type: 'button',
			category: 'Switcher',
			name: `SAÍDA ${n}`,
			style: { text: `SAÍDA ${n}`, size: '18', color: WHITE, bgcolor: combineRgb(40, 44, 56) },
			steps: [{ down: [{ actionId: 'aux', options: { output: n, cmd: 'StartStopExternal' } }], up: [] }],
			feedbacks: [{ feedbackId: 'aux', options: { output: n }, style: { bgcolor: RED, color: WHITE } }],
		}
	}

	// Master/slave link: the role of this computer (green MASTER, blue SLAVE) and the two takeovers.
	presets['sync_role'] = {
		type: 'button',
		category: 'Sincronia',
		name: 'Papel na sincronia',
		style: {
			text: '$(projetech-studio:sync_role)\\n$(projetech-studio:sync_partner)',
			size: '14',
			color: WHITE,
			bgcolor: combineRgb(40, 44, 56),
		},
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'syncRole', options: { role: 'master' }, style: { bgcolor: GREEN, color: WHITE } },
			{ feedbackId: 'syncRole', options: { role: 'slave' }, style: { bgcolor: combineRgb(47, 59, 232), color: WHITE } },
		],
	}
	presets['sync_takeover'] = {
		type: 'button',
		category: 'Sincronia',
		name: 'Assumir como master',
		style: { text: 'ASSUMIR\\nMASTER', size: '14', color: WHITE, bgcolor: combineRgb(120, 80, 0) },
		steps: [{ down: [{ actionId: 'syncTakeOver', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'syncRole', options: { role: 'master' }, style: { bgcolor: GREEN, color: WHITE } }],
	}
	presets['sync_stream'] = {
		type: 'button',
		category: 'Sincronia',
		name: 'Assumir transmissão',
		style: { text: 'ASSUMIR\\nSTREAM', size: '14', color: WHITE, bgcolor: combineRgb(120, 0, 0) },
		steps: [{ down: [{ actionId: 'syncTakeStream', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'streaming', options: {}, style: { bgcolor: RED, color: WHITE } }],
	}

	addPlumePresets(presets)
	return presets
}

/**
 * Modo PLume (Projetech Studio 1.5): the 8 × 8 cells (the top layer first, as on the grid; dim when empty, yellow when
 * selected, green on air), the columns with NEXT / PREV / EJECT ALL, and per layer X (eject), B (bypass), S (solo) and its
 * countdown (red when the clip is ending).
 */
function addPlumePresets(presets: CompanionPresetDefinitions): void {
	for (let l = GRID_SIZE; l >= 1; l--) {
		for (let c = 1; c <= GRID_SIZE; c++) {
			const cell = { layer: String(l), column: String(c) }
			presets[`plume_clip_${l}_${c}`] = {
				type: 'button',
				category: PLUME_CLIPS,
				name: `Clipe: camada ${l}, coluna ${c}`,
				style: {
					text: `$(projetech-studio:clip_${l}_${c}_name)\\nC${c}·L${l}`,
					size: '14',
					color: WHITE,
					bgcolor: BUTTON,
				},
				steps: [{ down: [{ actionId: 'triggerClip', options: cell }], up: [] }],
				feedbacks: [
					{ feedbackId: 'clipEmpty', options: cell, style: { bgcolor: DIM_BG, color: DIM_TEXT } },
					{ feedbackId: 'clipSelected', options: cell, style: { bgcolor: YELLOW, color: BLACK } },
					{ feedbackId: 'clipActive', options: cell, style: { bgcolor: GREEN, color: WHITE } },
				],
			}
		}
	}

	for (let c = 1; c <= GRID_SIZE; c++) {
		presets[`plume_column_${c}`] = {
			type: 'button',
			category: PLUME_COLUMNS,
			name: `Coluna ${c}`,
			style: { text: `$(projetech-studio:column_${c}_name)\\nCOL ${c}`, size: '14', color: WHITE, bgcolor: BUTTON },
			steps: [{ down: [{ actionId: 'triggerColumn', options: { column: String(c) } }], up: [] }],
			feedbacks: [
				{ feedbackId: 'columnActive', options: { column: String(c) }, style: { bgcolor: GREEN, color: WHITE } },
			],
		}
	}
	const columnButton = (
		id: string,
		text: string,
		actionId: string,
		options: CompanionOptionValues,
		bgcolor = BUTTON,
	) => {
		presets[id] = {
			type: 'button',
			category: PLUME_COLUMNS,
			name: text.replace('\\n', ' '),
			style: { text, size: '18', color: WHITE, bgcolor },
			steps: [{ down: [{ actionId, options }], up: [] }],
			feedbacks: [],
		}
	}
	columnButton('plume_next_column', 'NEXT\\nCOL', 'columnStep', { direction: 'next' })
	columnButton('plume_prev_column', 'PREV\\nCOL', 'columnStep', { direction: 'prev' })
	columnButton('plume_eject_all', 'EJECT\\nALL', 'ejectAll', {}, combineRgb(120, 0, 0))

	for (let n = 1; n <= GRID_SIZE; n++) {
		const layer = String(n)
		presets[`plume_layer_${n}_eject`] = {
			type: 'button',
			category: PLUME_LAYERS,
			name: `Camada ${n}: ejetar`,
			style: { text: `X\\nL${n}`, size: '18', color: WHITE, bgcolor: BUTTON },
			steps: [{ down: [{ actionId: 'ejectLayer', options: { layer } }], up: [] }],
			feedbacks: [],
		}
		presets[`plume_layer_${n}_bypass`] = {
			type: 'button',
			category: PLUME_LAYERS,
			name: `Camada ${n}: bypass`,
			style: { text: `B\\nL${n}`, size: '18', color: WHITE, bgcolor: BUTTON },
			steps: [{ down: [{ actionId: 'layerBypass', options: { layer, mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'layerBypass', options: { layer }, style: { bgcolor: ORANGE, color: BLACK } }],
		}
		presets[`plume_layer_${n}_solo`] = {
			type: 'button',
			category: PLUME_LAYERS,
			name: `Camada ${n}: solo`,
			style: { text: `S\\nL${n}`, size: '18', color: WHITE, bgcolor: BUTTON },
			steps: [{ down: [{ actionId: 'layerSolo', options: { layer, mode: 'toggle' } }], up: [] }],
			feedbacks: [{ feedbackId: 'layerSolo', options: { layer }, style: { bgcolor: CYAN, color: BLACK } }],
		}
		presets[`plume_layer_${n}_remaining`] = {
			type: 'button',
			category: PLUME_LAYERS,
			name: `Camada ${n}: tempo restante`,
			style: { text: `L${n}\\n$(projetech-studio:layer_${n}_remaining)`, size: '18', color: WHITE, bgcolor: BUTTON },
			steps: [{ down: [], up: [] }],
			feedbacks: [{ feedbackId: 'layerEnding', options: { layer }, style: { bgcolor: RED, color: WHITE } }],
		}
	}
}
