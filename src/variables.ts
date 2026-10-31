import type { CompanionVariableDefinition, CompanionVariableValues } from '@companion-module/base'
import type { StudioInstance } from './main.js'
import { clipAt, clipOnAir, layerClock, mmss } from './composition.js'

/** Variables `input_1_name` … `input_32_name` are defined for the first 32 inputs of the list. */
const MAX_INPUTS = 32

/** ProLume: `layer_N_…` for the layers 1–16 (the grid's maximum). */
export const MAX_LAYERS = 16

/** ProLume: `clip_L_C_name` and `column_C_name` for the first 8 layers and columns (the presets' grid). */
export const GRID_SIZE = 8

const LAYER_FIELDS: [string, string][] = [
	['name', 'name'],
	['clip_name', 'clip on air'],
	['column', 'column of the clip on air'],
	['elapsed', 'elapsed time of the clip (mm:ss)'],
	['remaining', 'remaining time of the clip (mm:ss)'],
	['remaining_seconds', 'remaining seconds of the clip'],
	['progress', 'progress of the clip (0–100)'],
	['opacity', 'opacity (0–100)'],
]

export function getVariableDefinitions(): CompanionVariableDefinition[] {
	const defs: CompanionVariableDefinition[] = [
		{ variableId: 'active_number', name: 'Number of the input on air' },
		{ variableId: 'active_name', name: 'Name of the input on air' },
		{ variableId: 'preview_number', name: 'Number of the input on preview' },
		{ variableId: 'preview_name', name: 'Name of the input on preview' },
		{ variableId: 'program_remaining', name: 'Remaining time of the program (mm:ss)' },
		{ variableId: 'recording', name: 'Recording (1/0)' },
		{ variableId: 'streaming', name: 'Streaming (1/0)' },
		{ variableId: 'connected', name: 'Companion connected to this Projetech Studio (1/0)' },
		{ variableId: 'sync_role', name: 'Master/slave role (master, slave, standalone)' },
		{ variableId: 'sync_partner', name: 'Master/slave partner computer' },
		{ variableId: 'sync_state', name: 'Master/slave link state (Ready, Syncing, WaitingPartner, DualMaster…)' },
	]
	for (let i = 1; i <= MAX_INPUTS; i++) defs.push({ variableId: `input_${i}_name`, name: `Name of input ${i}` })
	defs.push(
		{ variableId: 'composition_mode', name: 'ProLume mode on (1/0)' },
		{ variableId: 'composition_master', name: 'ProLume: composition master (0–100)' },
		{ variableId: 'column_current', name: 'ProLume: number of the column fired last' },
		{ variableId: 'column_current_name', name: 'ProLume: name of the column fired last' },
		{ variableId: 'column_selected', name: 'ProLume: number of the selected column' },
		{ variableId: 'layer_selected', name: 'ProLume: number of the selected layer' },
	)
	for (let n = 1; n <= MAX_LAYERS; n++)
		for (const [field, label] of LAYER_FIELDS)
			defs.push({ variableId: `layer_${n}_${field}`, name: `ProLume: layer ${n}, ${label}` })
	for (let l = 1; l <= GRID_SIZE; l++)
		for (let c = 1; c <= GRID_SIZE; c++)
			defs.push({ variableId: `clip_${l}_${c}_name`, name: `ProLume: name of the clip in layer ${l}, column ${c}` })
	for (let c = 1; c <= GRID_SIZE; c++)
		defs.push({ variableId: `column_${c}_name`, name: `ProLume: name of column ${c}` })
	return defs
}

const SYNC_ROLE_TEXT = { master: 'master', slave: 'slave', standalone: 'standalone' } as const

/**
 * Values computed from the current state; StudioInstance.updateVariables sends only the ones that changed. The layers'
 * clocks run on from the last XML poll while their clip plays (`now`).
 */
export function getVariableValues(instance: StudioInstance, now = Date.now()): CompanionVariableValues {
	const st = instance.api.state
	const active = instance.api.inputByNumber(st.active)
	const preview = instance.api.inputByNumber(st.preview)
	const values: CompanionVariableValues = {
		active_number: st.active || '',
		active_name: active?.title ?? '',
		preview_number: st.preview || '',
		preview_name: preview?.title ?? '',
		program_remaining: active && active.duration > 0 ? mmss(active.duration - active.position) : '',
		recording: st.recording ? 1 : 0,
		streaming: st.streaming ? 1 : 0,
		connected: st.connected ? 1 : 0,
		sync_role: st.connected ? SYNC_ROLE_TEXT[st.sync.role] : '',
		sync_partner: st.sync.partner,
		sync_state: st.sync.state,
	}
	for (let i = 1; i <= MAX_INPUTS; i++) values[`input_${i}_name`] = instance.api.inputByNumber(i)?.title ?? ''

	const c = st.composition
	values.composition_mode = c?.enabled ? 1 : 0
	values.composition_master = c ? c.master : ''
	values.column_current = c && c.column > 0 ? c.column : ''
	values.column_current_name = c && c.column > 0 ? (c.columns.find((x) => x.number === c.column)?.name ?? '') : ''
	values.column_selected = c && c.selectedColumn > 0 ? c.selectedColumn : ''
	values.layer_selected = c && c.selectedLayer > 0 ? c.selectedLayer : ''
	for (let n = 1; n <= MAX_LAYERS; n++) {
		const layer = c?.layers.find((l) => l.number === n)
		const clock = c ? layerClock(layer, c.readAt, now) : null
		values[`layer_${n}_name`] = layer?.name ?? ''
		values[`layer_${n}_clip_name`] = clipOnAir(layer)?.name ?? ''
		values[`layer_${n}_column`] = layer && layer.clip > 0 ? layer.clip : ''
		values[`layer_${n}_elapsed`] = clock ? mmss(clock.elapsed) : ''
		values[`layer_${n}_remaining`] = clock ? mmss(clock.remaining, true) : ''
		values[`layer_${n}_remaining_seconds`] = clock ? Math.max(0, Math.ceil(clock.remaining / 1000)) : ''
		values[`layer_${n}_progress`] = clock
			? Math.max(0, Math.min(100, Math.round((clock.elapsed / clock.duration) * 100)))
			: ''
		values[`layer_${n}_opacity`] = layer ? layer.opacity : ''
	}
	for (let l = 1; l <= GRID_SIZE; l++) {
		const layer = c?.layers.find((x) => x.number === l)
		for (let col = 1; col <= GRID_SIZE; col++) values[`clip_${l}_${col}_name`] = clipAt(layer, col)?.name ?? ''
	}
	for (let col = 1; col <= GRID_SIZE; col++)
		values[`column_${col}_name`] = c?.columns.find((x) => x.number === col)?.name ?? ''
	return values
}
