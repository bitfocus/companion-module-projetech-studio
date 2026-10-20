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
 * The Modo PLume actions (Projetech Studio 1.5) take a layer and a column by number or by name.
 */

/** Modo PLume layer: a number (Camada 1 = the bottom one) or the name shown on the grid; variables allowed. */
export const layerOption = (label = 'Camada (número, 1 = a de baixo, ou nome)'): CompanionInputFieldTextInput => ({
	type: 'textinput',
	id: 'layer',
	label,
	default: '1',
	useVariables: true,
})

/** Modo PLume column: a number (Coluna 1 = the left one) or the name shown on the grid; variables allowed. */
export const columnOption = (label = 'Coluna (número ou nome)'): CompanionInputFieldTextInput => ({
	type: 'textinput',
	id: 'column',
	label,
	default: '1',
	useVariables: true,
})

/** What an action's or a feedback's callback context offers to read variables. */
export type VariableParser = Pick<CompanionActionContext, 'parseVariablesInString'>

/** The text of a layer/column option, with its variables replaced (without a round trip when it has none). */
export async function optionText(context: VariableParser, value: unknown): Promise<string> {
	const raw = (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim()
	return raw.includes('$(') ? (await context.parseVariablesInString(raw)).trim() : raw
}

const levelModeOption: CompanionInputFieldDropdown = {
	type: 'dropdown',
	id: 'mode',
	label: 'Modo',
	default: 'set',
	choices: [
		{ id: 'set', label: 'Definir' },
		{ id: 'add', label: 'Aumentar' },
		{ id: 'subtract', label: 'Diminuir' },
	],
}

const levelValueOption = (fallback = 100): CompanionInputFieldNumber => ({
	type: 'number',
	id: 'value',
	label: 'Valor (0–100)',
	default: fallback,
	min: 0,
	max: 100,
})

const switchOption: CompanionInputFieldDropdown = {
	type: 'dropdown',
	id: 'mode',
	label: 'Modo',
	default: 'toggle',
	choices: [
		{ id: 'on', label: 'Ligar' },
		{ id: 'off', label: 'Desligar' },
		{ id: 'toggle', label: 'Alternar' },
	],
}

const directionOption = (next: string, prev: string): CompanionInputFieldDropdown => ({
	type: 'dropdown',
	id: 'direction',
	label: 'Direção',
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

/** Input number option; for actions where it is optional, 0 means "the input on preview" (or the program). */
const inputOption = (label = 'Input (número na lista; 0 = o que está no preview)') => ({
	type: 'number' as const,
	id: 'input',
	label,
	default: 1,
	min: 0,
	max: 999,
})

/** Auxiliary output: "Saída 2" (vMix's external output) to "Saída 5" (Projetech Studio 1.2.11 or newer). */
export const auxOutputOption = {
	type: 'dropdown' as const,
	id: 'output',
	label: 'Saída',
	default: 2,
	choices: [2, 3, 4, 5].map((n) => ({ id: n, label: `Saída ${n}` })),
}

/** The output chosen; buttons made before the option existed act on Saída 2. */
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
				`Modo PLume: ${what} não está no estado do Projetech Studio (a grade é da versão 1.5 ou mais nova)`,
			)
			return
		}
		api.sendFunction(fn, { ...params, Value: level })
	}

	return {
		cut: {
			name: 'Cut (take sem transição)',
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
					label: 'Duração (ms, 0 = padrão do projeto)',
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
			name: 'Preview: carregar input',
			options: [inputOption('Input')],
			callback: async (ev) => api.sendFunction('PreviewInput', { Input: Number(ev.options.input) }),
		},
		take: {
			name: 'Take (input direto no ar, transição padrão)',
			options: [inputOption('Input')],
			callback: async (ev) => api.sendFunction('ActiveInput', { Input: Number(ev.options.input) }),
		},
		stop: {
			name: 'Stop (volta para a tela de espera)',
			options: [],
			callback: async () => api.sendFunction('Stop'),
		},
		fadeToBlack: {
			name: 'Fade to black (alternar)',
			options: [],
			callback: async () => api.sendFunction('FadeToBlack'),
		},
		playback: {
			name: 'Reprodução',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Comando',
					default: 'PlayPause',
					choices: [
						{ id: 'Play', label: 'Play' },
						{ id: 'Pause', label: 'Pausar' },
						{ id: 'PlayPause', label: 'Play / Pausa' },
						{ id: 'Restart', label: 'Reiniciar' },
					],
				},
				inputOption('Input (0 = programa)'),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), withInput(ev.options.input)),
		},
		loop: {
			name: 'Loop do input',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Modo',
					default: 'Loop',
					choices: [
						{ id: 'Loop', label: 'Alternar' },
						{ id: 'LoopOn', label: 'Ligar' },
						{ id: 'LoopOff', label: 'Desligar' },
					],
				},
				inputOption('Input (0 = programa)'),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), withInput(ev.options.input)),
		},
		overlay: {
			name: 'Overlay (sobre o PGM)',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Modo',
					default: 'OverlayInput1',
					choices: [
						{ id: 'OverlayInput1', label: 'Alternar' },
						{ id: 'OverlayInput1In', label: 'Ligar' },
						{ id: 'OverlayInput1Off', label: 'Desligar' },
					],
				},
				inputOption('Input'),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), { Input: Number(ev.options.input) }),
		},
		overlayAllOff: {
			name: 'Desligar todos os overlays',
			options: [],
			callback: async () => api.sendFunction('OverlayInputAllOff'),
		},
		audio: {
			name: 'Áudio do input para o PGM',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Modo',
					default: 'Audio',
					choices: [
						{ id: 'Audio', label: 'Alternar' },
						{ id: 'AudioOn', label: 'Ligar' },
						{ id: 'AudioOff', label: 'Desligar' },
					],
				},
				inputOption('Input'),
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd), { Input: Number(ev.options.input) }),
		},
		setVolume: {
			name: 'Volume do input',
			options: [
				inputOption('Input'),
				{ type: 'number', id: 'value', label: 'Volume (0–100)', default: 100, min: 0, max: 100 },
			],
			callback: async (ev) =>
				api.sendFunction('SetVolume', { Input: Number(ev.options.input), Value: Number(ev.options.value) }),
		},
		setMasterVolume: {
			name: 'Volume master',
			options: [{ type: 'number', id: 'value', label: 'Volume (0–100)', default: 100, min: 0, max: 100 }],
			callback: async (ev) => api.sendFunction('SetMasterVolume', { Value: Number(ev.options.value) }),
		},
		recording: {
			name: 'Gravação',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Comando',
					default: 'StartStopRecording',
					choices: [
						{ id: 'StartRecording', label: 'Iniciar' },
						{ id: 'StopRecording', label: 'Parar' },
						{ id: 'StartStopRecording', label: 'Alternar' },
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
					label: 'Comando',
					default: 'StartStopStreaming',
					choices: [
						{ id: 'StartStreaming', label: 'Iniciar' },
						{ id: 'StopStreaming', label: 'Parar' },
						{ id: 'StartStopStreaming', label: 'Alternar' },
					],
				},
				{
					type: 'number',
					id: 'slot',
					label: 'Stream (0 = todos, 1–3 = específico)',
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
			name: 'Saída LED',
			options: [
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Comando',
					default: 'Fullscreen',
					choices: [
						{ id: 'Fullscreen', label: 'Alternar' },
						{ id: 'FullscreenOn', label: 'Ligar' },
						{ id: 'FullscreenOff', label: 'Desligar' },
					],
				},
			],
			callback: async (ev) => api.sendFunction(String(ev.options.cmd)),
		},
		aux: {
			name: 'Saída auxiliar (Saída 2 a 5: multiview / input / programa)',
			options: [
				auxOutputOption,
				{
					type: 'dropdown',
					id: 'cmd',
					label: 'Comando',
					default: 'StartStopExternal',
					choices: [
						{ id: 'StartExternal', label: 'Ligar' },
						{ id: 'StopExternal', label: 'Desligar' },
						{ id: 'StartStopExternal', label: 'Alternar' },
					],
				},
			],
			// Saída 2 goes without Value, as vMix clients and older Projetech Studio versions send it.
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
					label: 'Comando',
					default: 'StartCountdown',
					choices: [
						{ id: 'StartCountdown', label: 'Iniciar' },
						{ id: 'PauseCountdown', label: 'Pausar' },
						{ id: 'StopCountdown', label: 'Zerar' },
						{ id: 'SetCountdown', label: 'Definir tempo' },
					],
				},
				{ type: 'textinput', id: 'value', label: 'Tempo (hh:mm:ss, só para "Definir")', default: '00:05:00' },
			],
			callback: async (ev) =>
				api.sendFunction(
					String(ev.options.cmd),
					ev.options.cmd === 'SetCountdown' ? { Value: String(ev.options.value) } : {},
				),
		},
		// Master/slave link: accepted on the slave too (every other command goes to the master).
		syncTakeOver: {
			name: 'Sincronia: assumir como master (no slave)',
			options: [],
			callback: async () => api.sendFunction('SyncTakeOver'),
		},
		syncTakeStream: {
			name: 'Sincronia: assumir a transmissão',
			options: [],
			callback: async () => api.sendFunction('SyncTakeStream'),
		},
		// ---- Modo PLume (the clip grid, Projetech Studio 1.5): ids and option ids are stored in buttons, never rename them.
		triggerClip: {
			name: 'Modo PLume: disparar clipe (camada e coluna)',
			options: [layerOption(), columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('TriggerClip', {
					Layer: await optionText(ctx, ev.options.layer),
					Column: await optionText(ctx, ev.options.column),
				}),
		},
		selectClip: {
			name: 'Modo PLume: selecionar clipe (não dispara)',
			options: [layerOption(), columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('SelectClip', {
					Layer: await optionText(ctx, ev.options.layer),
					Column: await optionText(ctx, ev.options.column),
				}),
		},
		triggerColumn: {
			name: 'Modo PLume: disparar coluna',
			options: [columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('TriggerColumn', { Column: await optionText(ctx, ev.options.column) }),
		},
		selectColumn: {
			name: 'Modo PLume: selecionar coluna (não dispara)',
			options: [columnOption()],
			callback: async (ev, ctx) =>
				api.sendFunction('SelectColumn', { Column: await optionText(ctx, ev.options.column) }),
		},
		columnStep: {
			name: 'Modo PLume: disparar a próxima / a anterior coluna',
			options: [directionOption('Próxima coluna', 'Coluna anterior')],
			callback: async (ev) => api.sendFunction(ev.options.direction === 'prev' ? 'PreviousColumn' : 'NextColumn'),
		},
		layerClipStep: {
			name: 'Modo PLume: próximo / anterior clipe da camada',
			options: [layerOption(), directionOption('Próximo clipe', 'Clipe anterior')],
			callback: async (ev, ctx) =>
				api.sendFunction(ev.options.direction === 'prev' ? 'LayerPreviousClip' : 'LayerNextClip', {
					Layer: await optionText(ctx, ev.options.layer),
				}),
		},
		ejectLayer: {
			name: 'Modo PLume: ejetar camada',
			options: [layerOption()],
			callback: async (ev, ctx) => api.sendFunction('EjectLayer', { Layer: await optionText(ctx, ev.options.layer) }),
		},
		ejectAll: {
			name: 'Modo PLume: ejetar tudo',
			options: [],
			callback: async () => api.sendFunction('EjectAll'),
		},
		layerOpacity: {
			name: 'Modo PLume: opacidade da camada',
			options: [layerOption(), levelModeOption, levelValueOption()],
			callback: async (ev, ctx) => {
				const layer = await optionText(ctx, ev.options.layer)
				const current = findLayer(api.state.composition, layer)?.opacity
				sendLevel(
					'SetLayerOpacity',
					{ Layer: layer },
					levelValue(ev.options.mode, ev.options.value, current),
					`a camada ${layer}`,
				)
			},
		},
		layerVolume: {
			name: 'Modo PLume: volume da camada',
			options: [layerOption(), levelModeOption, levelValueOption()],
			callback: async (ev, ctx) => {
				const layer = await optionText(ctx, ev.options.layer)
				const current = findLayer(api.state.composition, layer)?.volume
				sendLevel(
					'SetLayerVolume',
					{ Layer: layer },
					levelValue(ev.options.mode, ev.options.value, current),
					`a camada ${layer}`,
				)
			},
		},
		compositionMaster: {
			name: 'Modo PLume: master da composição (vídeo)',
			options: [levelModeOption, levelValueOption()],
			callback: async (ev) =>
				sendLevel(
					'SetCompositionMaster',
					{},
					levelValue(ev.options.mode, ev.options.value, api.state.composition?.master),
					'o master da composição',
				),
		},
		layerBypass: {
			name: 'Modo PLume: bypass da camada (corta vídeo e áudio)',
			options: [layerOption(), switchOption],
			callback: async (ev, ctx) =>
				api.sendFunction(
					ev.options.mode === 'on' ? 'LayerBypassOn' : ev.options.mode === 'off' ? 'LayerBypassOff' : 'LayerBypass',
					{ Layer: await optionText(ctx, ev.options.layer) },
				),
		},
		layerSolo: {
			name: 'Modo PLume: solo da camada',
			options: [layerOption(), switchOption],
			callback: async (ev, ctx) =>
				api.sendFunction(
					ev.options.mode === 'on' ? 'LayerSoloOn' : ev.options.mode === 'off' ? 'LayerSoloOff' : 'LayerSolo',
					{ Layer: await optionText(ctx, ev.options.layer) },
				),
		},
		layerTransition: {
			name: 'Modo PLume: transição da camada',
			options: [
				layerOption(),
				{ type: 'number', id: 'ms', label: 'Duração (ms, 0 = corte)', default: 500, min: 0, max: 10000 },
				{
					type: 'dropdown',
					id: 'type',
					label: 'Tipo',
					default: 'Fade',
					choices: [
						{ id: 'Fade', label: 'Fade' },
						{ id: 'Cut', label: 'Corte' },
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
			name: 'Modo PLume: blend da camada',
			options: [
				layerOption(),
				{
					type: 'dropdown',
					id: 'blend',
					label: 'Blend',
					default: 'Alpha',
					choices: [
						{ id: 'Alpha', label: 'Normal' },
						{ id: 'Add', label: 'Somar' },
						{ id: 'Screen', label: 'Tela' },
						{ id: 'Multiply', label: 'Multiplicar' },
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
		// Escape hatch for API functions without a dedicated action; the text is sent as typed.
		raw: {
			name: 'Função livre (FUNCTION da API)',
			options: [
				{ type: 'textinput', id: 'name', label: 'Função', default: 'Cut' },
				{ type: 'textinput', id: 'params', label: 'Parâmetros (Input=1&Value=50)', default: '' },
			],
			callback: async (ev) =>
				api.send(
					String(ev.options.params)
						? `FUNCTION ${ev.options.name} ${ev.options.params}`
						: `FUNCTION ${ev.options.name}`,
				),
		},
	}
}
