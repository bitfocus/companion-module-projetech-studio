import type {
	CompanionActionContext,
	CompanionActionDefinitions,
	CompanionInputFieldDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldTextInput,
} from '@companion-module/base'
import type { StudioInstance } from './main.js'
import { findLayer } from './composition.js'

/**
 * Actions map to Projetech Studio API functions (same names and parameters as vMix functions, e.g. `Cut`, `Fade`,
 * `PreviewInput`, `SetVolume`). Inputs are numbered in the order of the Projetech Studio list, starting at 1.
 * The ProLume actions (Projetech Studio 1.5) take a layer and a column by number or by name.
 */

/** ProLume layer: a number (layer 1 = the bottom one) or the name shown on the grid; variables allowed. */
export const layerOption = (label = 'Layer (number, 1 = bottom, or name)'): CompanionInputFieldTextInput => ({
	type: 'textinput',
	id: 'layer',
	label,
	default: '1',
	useVariables: true,
})

/** ProLume column: a number (column 1 = the left one) or the name shown on the grid; variables allowed. */
export const columnOption = (label = 'Column (number or name)'): CompanionInputFieldTextInput => ({
	type: 'textinput',
	id: 'column',
	label,
	default: '1',
	useVariables: true,
})

/** What an action's or a feedback's callback context offers to read variables. */
export type VariableParser = Pick<CompanionActionContext, 'parseVariablesInString'>

/** The text of a text option, with its variables replaced (without a round trip when it has none). */
export async function optionText(context: VariableParser, value: unknown): Promise<string> {
	const raw = (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim()
	return raw.includes('$(') ? (await context.parseVariablesInString(raw)).trim() : raw
}

const levelModeOption: CompanionInputFieldDropdown = {
	type: 'dropdown',
	id: 'mode',
	label: 'Mode',
	default: 'set',
	choices: [
		{ id: 'set', label: 'Set' },
		{ id: 'add', label: 'Increase' },
		{ id: 'subtract', label: 'Decrease' },
	],
}

const levelValueOption = (fallback = 100): CompanionInputFieldNumber => ({
	type: 'number',
	id: 'value',
	label: 'Value (0–100)',
	default: fallback,
	min: 0,
	max: 100,
})

const switchOption: CompanionInputFieldDropdown = {
	type: 'dropdown',
	id: 'mode',
	label: 'Mode',
	default: 'toggle',
	choices: [
		{ id: 'on', label: 'On' },
		{ id: 'off', label: 'Off' },
		{ id: 'toggle', label: 'Toggle' },
	],
}

const directionOption = (next: string, prev: string): CompanionInputFieldDropdown => ({
	type: 'dropdown',
	id: 'direction',
	label: 'Direction',
	default: 'next',
	choices: [
		{ id: 'next', label: next },
		{ id: 'prev', label: prev },
	],
})

/** A level for Value= (0–100): set, or moved from the current one (unknown current value = undefined). */
export function levelValue(mode: unknown, value: unknown, current: number | undefined): number | undefined {
	const v = Math.max(0, Math.min(100, Number(value) || 0))
	if (mode !== 'add' && mode !== 'subtract') return v
	if (current === undefined) return undefined
	return Math.max(0, Math.min(100, current + (mode === 'add' ? v : -v)))
}

/**
 * Input number option. Where the input is optional (min 0), 0 means "the input on preview" (or the program); actions
 * that always need an input start at 1.
 */
const inputOption = (
	label = 'Input (number in the list; 0 = the one on preview)',
	min = 0,
): CompanionInputFieldNumber => ({
	type: 'number',
	id: 'input',
	label,
	default: 1,
	min,
	max: 999,
})

/** An input every action of its kind needs: 1 or more. */
const requiredInputOption = (): CompanionInputFieldNumber => inputOption('Input (number in the list)', 1)

/** Auxiliary output: output 2 (vMix's external output) to output 5 (Projetech Studio 1.2.11 or newer). */
export const auxOutputOption = {
	type: 'dropdown' as const,
	id: 'output',
	label: 'Output',
	default: 2,
	choices: [2, 3, 4, 5].map((n) => ({ id: n, label: `Output ${n}` })),
}

/** The output chosen; buttons made before the option existed act on output 2. */
export const auxOutputNumber = (value: unknown): number => Number(value) || 2

export function getActions(instance: StudioInstance): CompanionActionDefinitions {
	const api = instance.api
	/** `Input=n` only when a specific input was chosen; without it the API acts on the preview/program input. */
	const withInput = (n: unknown): Record<string, number> => (Number(n) > 0 ? { Input: Number(n) } : {})
	/** A relative level needs the current value from the XML state; without it nothing is sent. */
	const sendLevel = (fn: string, params: Record<string, string>, level: number | undefined, what: string): void => {
		if (level === undefined) {
			instance.log(
				'warn',
				`ProLume: ${what} is not in the Projetech Studio state (the grid needs Projetech Studio 1.5 or newer)`,
			)
			return
		}
		api.sendFunction(fn, { ...params, Value: level })
	}

	return {
		cut: {
			name: 'Cut (take without transition)',
			options: [inputOption()],
			callback: async (ev) => api.sendFunction('Cut', withInput(ev.options.input)),
		},
		fade: {
			name: 'Fade (crossfade)',
			options: [
				inputOption(),
				{
					type: 'number',
					id: 'duration',
					label: 'Duration (ms, 0 = project default)',
					default: 0,
					min: 0,
					max: 10000,
				},
			],
			callback: async (ev) =>
				api.sendFunction('Fade', {
					...withInput(ev.options.input),
					Duration: Number(ev.options.duration) > 0 ? Number(ev.options.duration) : undefined,
				}),
		},
		previewInput: {
			name: 'Preview: load input',
			options: [requiredInputOption()],
			callback: async (ev) => api.sendFunction('PreviewInput', { Input: Number(ev.options.input) }),
		},
		take: {
			name: 'Take (input straight to air, default transition)',
			options: [requiredInputOption()],
			callback: async (ev) => api.sendFunction('ActiveInput', { Input: Number(ev.options.input) }),
		},
		stop: {
			name: 'Stop (back to the wait screen)',
			options: [],
			callback: async () => api.sendFunction('Stop'),
		},
		fadeToBlack: {
			name: 'Fade to black (toggle)',
			options: [],
			callback: async () => api.sendFunction('FadeToBlack'),
		},
		playback: {
			name: 'Playback',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Command',
					default: 'PlayPause',
					choices: [
						{ id: 'Play', label: 'Play' },
						{ id: 'Pause', label: 'Pause' },
						{ id: 'PlayPause', label: 'Play / Pause' },
						{ id: 'Restart', label: 'Restart' },
					],
				},
				inputOption('Input (0 = program)'),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), withInput(ev.options.input)),
		},
		loop: {
			name: 'Input loop',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Mode',
					default: 'Loop',
					choices: [
						{ id: 'Loop', label: 'Toggle' },
						{ id: 'LoopOn', label: 'On' },
						{ id: 'LoopOff', label: 'Off' },
					],
				},
				inputOption('Input (0 = program)'),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), withInput(ev.options.input)),
		},
		overlay: {
			name: 'Overlay (over the program)',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Mode',
					default: 'OverlayInput1',
					choices: [
						{ id: 'OverlayInput1', label: 'Toggle' },
						{ id: 'OverlayInput1In', label: 'On' },
						{ id: 'OverlayInput1Off', label: 'Off' },
					],
				},
				requiredInputOption(),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), { Input: Number(ev.options.input) }),
		},
		overlayAllOff: {
			name: 'All overlays off',
			options: [],
			callback: async () => api.sendFunction('OverlayInputAllOff'),
		},
		audio: {
			name: 'Input audio to program',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Mode',
					default: 'Audio',
					choices: [
						{ id: 'Audio', label: 'Toggle' },
						{ id: 'AudioOn', label: 'On' },
						{ id: 'AudioOff', label: 'Off' },
					],
				},
				requiredInputOption(),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), { Input: Number(ev.options.input) }),
		},
		setVolume: {
			name: 'Input volume',
			options: [
				requiredInputOption(),
				{ type: 'number', id: 'value', label: 'Volume (0–100)', default: 100, min: 0, max: 100 },
			],
			callback: async (ev) =>
				api.sendFunction('SetVolume', { Input: Number(ev.options.input), Value: Number(ev.options.value) }),
		},
		setMasterVolume: {
			name: 'Master volume',
			options: [{ type: 'number', id: 'value', label: 'Volume (0–100)', default: 100, min: 0, max: 100 }],
			callback: async (ev) => api.sendFunction('SetMasterVolume', { Value: Number(ev.options.value) }),
		},
		recording: {
			name: 'Recording',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Command',
					default: 'StartStopRecording',
					choices: [
						{ id: 'StartRecording', label: 'Start' },
						{ id: 'StopRecording', label: 'Stop' },
						{ id: 'StartStopRecording', label: 'Toggle' },
					],
				},
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd)),
		},
		streaming: {
			name: 'Streaming',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Command',
					default: 'StartStopStreaming',
					choices: [
						{ id: 'StartStreaming', label: 'Start' },
						{ id: 'StopStreaming', label: 'Stop' },
						{ id: 'StartStopStreaming', label: 'Toggle' },
					],
				},
				{
					type: 'number',
					id: 'slot',
					label: 'Stream (0 = all, 1–3 = that one)',
					default: 0,
					min: 0,
					max: 3,
				},
			],
			callback: async (ev) =>
				api.sendFunction(
					String(ev.options.cmd),
					Number(ev.options.slot) > 0 ? { Value: Number(ev.options.slot) - 1 } : {},
				),
		},
		output: {
			name: 'LED output',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Command',
					default: 'Fullscreen',
					choices: [
						{ id: 'Fullscreen', label: 'Toggle' },
						{ id: 'FullscreenOn', label: 'On' },
						{ id: 'FullscreenOff', label: 'Off' },
					],
				},
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd)),
		},
		aux: {
			name: 'Auxiliary output (outputs 2 to 5: multiview / input / program)',
			options: [
				auxOutputOption,
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Command',
					default: 'StartStopExternal',
					choices: [
						{ id: 'StartExternal', label: 'On' },
						{ id: 'StopExternal', label: 'Off' },
						{ id: 'StartStopExternal', label: 'Toggle' },
					],
				},
			],
			// Output 2 goes without Value, as vMix clients and older Projetech Studio versions send it.
			callback: async (ev) => {
				const n = auxOutputNumber(ev.options.output)
				api.sendFunction(String(ev.options.cmd), n > 2 ? { Value: n } : {})
			},
		},
		timer: {
			name: 'Timer',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Command',
					default: 'StartCountdown',
					choices: [
						{ id: 'StartCountdown', label: 'Start' },
						{ id: 'PauseCountdown', label: 'Pause' },
						{ id: 'StopCountdown', label: 'Reset' },
						{ id: 'SetCountdown', label: 'Set time' },
					],
				},
				{
					type: 'textinput',
					id: 'value',
					label: 'Time (hh:mm:ss)',
					default: '00:05:00',
					useVariables: true,
					isVisibleExpression: `$(options:cmd) == 'SetCountdown'`,
				},
			],
			callback: async (ev, ctx) =>
				api.sendFunction(
					String(ev.options.cmd),
					ev.options.cmd === 'SetCountdown' ? { Value: await optionText(ctx, ev.options.value) } : {},
				),
		},
		// Master/slave link: accepted on the slave too (every other command goes to the master).
		syncTakeOver: {
			name: 'Master/slave: take over as master (on the slave)',
			options: [],
			callback: async () => api.sendFunction('SyncTakeOver'),
		},
		syncTakeStream: {
			name: 'Master/slave: take the stream',
			options: [],
			callback: async () => api.sendFunction('SyncTakeStream'),
		},
		// ---- ProLume (the clip grid, Projetech Studio 1.5): ids and option ids are stored in buttons, never rename them.
		triggerClip: {
			name: 'ProLume: trigger clip (layer and column)',
			options: [layerOption(), columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('TriggerClip', {
					Layer: await optionText(ctx, ev.options.layer),
					Column: await optionText(ctx, ev.options.column),
				}),
		},
		selectClip: {
			name: 'ProLume: select clip (does not fire)',
			options: [layerOption(), columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('SelectClip', {
					Layer: await optionText(ctx, ev.options.layer),
					Column: await optionText(ctx, ev.options.column),
				}),
		},
		triggerColumn: {
			name: 'ProLume: trigger column',
			options: [columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('TriggerColumn', { Column: await optionText(ctx, ev.options.column) }),
		},
		selectColumn: {
			name: 'ProLume: select column (does not fire)',
			options: [columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('SelectColumn', { Column: await optionText(ctx, ev.options.column) }),
		},
		columnStep: {
			name: 'ProLume: trigger the next / previous column',
			options: [directionOption('Next column', 'Previous column')],
			callback: async (ev) => api.sendFunction(ev.options.direction === 'prev' ? 'PreviousColumn' : 'NextColumn'),
		},
		layerClipStep: {
			name: 'ProLume: next / previous clip of a layer',
			options: [layerOption(), directionOption('Next clip', 'Previous clip')],
			callback: async (ev, ctx) =>
				api.sendFunction(ev.options.direction === 'prev' ? 'LayerPreviousClip' : 'LayerNextClip', {
					Layer: await optionText(ctx, ev.options.layer),
				}),
		},
		ejectLayer: {
			name: 'ProLume: eject layer',
			options: [layerOption()],
			callback: async (ev, ctx) => api.sendFunction('EjectLayer', { Layer: await optionText(ctx, ev.options.layer) }),
		},
		ejectAll: {
			name: 'ProLume: eject all',
			options: [],
			callback: async () => api.sendFunction('EjectAll'),
		},
		layerOpacity: {
			name: 'ProLume: layer opacity',
			options: [layerOption(), levelModeOption, levelValueOption()],
			callback: async (ev, ctx) => {
				const layer = await optionText(ctx, ev.options.layer)
				const current = findLayer(api.state.composition, layer)?.opacity
				sendLevel(
					'SetLayerOpacity',
					{ Layer: layer },
					levelValue(ev.options.mode, ev.options.value, current),
					`layer ${layer}`,
				)
			},
		},
		layerVolume: {
			name: 'ProLume: layer volume',
			options: [layerOption(), levelModeOption, levelValueOption()],
			callback: async (ev, ctx) => {
				const layer = await optionText(ctx, ev.options.layer)
				const current = findLayer(api.state.composition, layer)?.volume
				sendLevel(
					'SetLayerVolume',
					{ Layer: layer },
					levelValue(ev.options.mode, ev.options.value, current),
					`layer ${layer}`,
				)
			},
		},
		compositionMaster: {
			name: 'ProLume: composition master (video)',
			options: [levelModeOption, levelValueOption()],
			callback: async (ev) =>
				sendLevel(
					'SetCompositionMaster',
					{},
					levelValue(ev.options.mode, ev.options.value, api.state.composition?.master),
					'the composition master',
				),
		},
		layerBypass: {
			name: 'ProLume: layer bypass (cuts video and audio)',
			options: [layerOption(), switchOption],
			callback: async (ev, ctx) =>
				api.sendFunction(
					ev.options.mode === 'on' ? 'LayerBypassOn' : ev.options.mode === 'off' ? 'LayerBypassOff' : 'LayerBypass',
					{ Layer: await optionText(ctx, ev.options.layer) },
				),
		},
		layerSolo: {
			name: 'ProLume: layer solo',
			options: [layerOption(), switchOption],
			callback: async (ev, ctx) =>
				api.sendFunction(
					ev.options.mode === 'on' ? 'LayerSoloOn' : ev.options.mode === 'off' ? 'LayerSoloOff' : 'LayerSolo',
					{ Layer: await optionText(ctx, ev.options.layer) },
				),
		},
		layerTransition: {
			name: 'ProLume: layer transition',
			options: [
				layerOption(),
				{ type: 'number', id: 'ms', label: 'Duration (ms, 0 = cut)', default: 500, min: 0, max: 10000 },
				{
					type: 'dropdown',
					id: 'type',
					label: 'Type',
					default: 'Fade',
					choices: [
						{ id: 'Fade', label: 'Fade' },
						{ id: 'Cut', label: 'Cut' },
					],
				},
			],
			callback: async (ev, ctx) =>
				api.sendFunction('SetLayerTransition', {
					Layer: await optionText(ctx, ev.options.layer),
					Value: Math.max(0, Math.min(10000, Math.round(Number(ev.options.ms) || 0))),
					Type: ev.options.type === 'Cut' ? 'Cut' : 'Fade',
				}),
		},
		layerBlend: {
			name: 'ProLume: layer blend',
			options: [
				layerOption(),
				{
					type: 'dropdown',
					id: 'blend',
					label: 'Blend',
					default: 'Alpha',
					choices: [
						{ id: 'Alpha', label: 'Normal' },
						{ id: 'Add', label: 'Add' },
						{ id: 'Screen', label: 'Screen' },
						{ id: 'Multiply', label: 'Multiply' },
						{ id: 'LumaKey', label: 'Luma key' },
					],
				},
			],
			callback: async (ev, ctx) =>
				api.sendFunction('SetLayerBlend', {
					Layer: await optionText(ctx, ev.options.layer),
					Value: String(ev.options.blend ?? 'Alpha'),
				}),
		},
		// Escape hatch for API functions without a dedicated action; the text is sent as typed, variables replaced.
		raw: {
			name: 'Free API function (FUNCTION)',
			options: [
				{ type: 'textinput', id: 'name', label: 'Function', default: 'Cut', useVariables: true },
				{
					type: 'textinput',
					id: 'params',
					label: 'Parameters (Input=1&Value=50)',
					default: '',
					useVariables: true,
				},
			],
			callback: async (ev, ctx) => {
				const name = await optionText(ctx, ev.options.name)
				const params = await optionText(ctx, ev.options.params)
				if (name) api.send(params ? `FUNCTION ${name} ${params}` : `FUNCTION ${name}`)
			},
		},
	}
}
