import {
	combineRgb,
	type CompanionFeedbackBooleanEvent,
	type CompanionFeedbackContext,
	type CompanionFeedbackDefinitions,
} from '@companion-module/base'
import type { StudioInstance } from './main.js'
import type { CompositionClip, CompositionColumn, CompositionLayer } from './api.js'
import { auxOutputOption, auxOutputNumber, columnOption, layerOption, optionText } from './actions.js'
import { clipAt, findColumn, findLayer } from './composition.js'

export const RED = combineRgb(200, 0, 0)
export const GREEN = combineRgb(0, 160, 0)
export const WHITE = combineRgb(255, 255, 255)
export const BLACK = combineRgb(0, 0, 0)
export const YELLOW = combineRgb(230, 190, 0)
export const ORANGE = combineRgb(255, 152, 0)
export const CYAN = combineRgb(18, 196, 248)
export const VIOLET = combineRgb(124, 77, 255)
/** An empty cell of the grid: dimmed. */
export const DIM_BG = combineRgb(24, 26, 32)
export const DIM_TEXT = combineRgb(90, 94, 104)

/**
 * Boolean feedbacks. Tally comes from the pushed vMix tally string (one digit per input: 0 off, 1 program, 2 preview);
 * the other flags come from activator pushes and the polled XML state, the ProLume grid included.
 */
export function getFeedbacks(instance: StudioInstance): CompanionFeedbackDefinitions {
	const api = instance.api
	const layerOf = async (
		fb: CompanionFeedbackBooleanEvent,
		ctx: CompanionFeedbackContext,
	): Promise<CompositionLayer | undefined> => findLayer(api.state.composition, await optionText(ctx, fb.options.layer))
	const columnOf = async (
		fb: CompanionFeedbackBooleanEvent,
		ctx: CompanionFeedbackContext,
	): Promise<CompositionColumn | undefined> =>
		findColumn(api.state.composition, await optionText(ctx, fb.options.column))
	/** The cell of the feedback's layer and column: its clip (undefined when empty), and both found. */
	const cellOf = async (
		fb: CompanionFeedbackBooleanEvent,
		ctx: CompanionFeedbackContext,
	): Promise<{ layer?: CompositionLayer; column?: CompositionColumn; clip?: CompositionClip }> => {
		const layer = await layerOf(fb, ctx)
		const column = await columnOf(fb, ctx)
		return { layer, column, clip: column ? clipAt(layer, column.number) : undefined }
	}
	return {
		tally: {
			type: 'boolean',
			name: 'Input tally',
			description: 'True when the input is on air (program) or on preview',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{ type: 'number', id: 'input', label: 'Input', default: 1, min: 1, max: 999 },
				{
					type: 'dropdown',
					id: 'which',
					label: 'State',
					default: 'program',
					choices: [
						{ id: 'program', label: 'On air (red)' },
						{ id: 'preview', label: 'Preview (green)' },
					],
				},
			],
			callback: (fb) => {
				const n = Number(fb.options.input)
				const digit = api.state.tally.charAt(n - 1)
				return fb.options.which === 'preview' ? digit === '2' : digit === '1'
			},
		},
		recording: {
			type: 'boolean',
			name: 'Recording',
			description: 'The program is being recorded',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => api.state.recording,
		},
		streaming: {
			type: 'boolean',
			name: 'Streaming',
			description: 'At least one stream is on air',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => api.state.streaming,
		},
		output: {
			type: 'boolean',
			name: 'LED output on',
			description: 'The output window on the LED monitor is on',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => api.state.fullscreen,
		},
		aux: {
			type: 'boolean',
			name: 'Auxiliary output on',
			description: 'Output 2, 3, 4 or 5 (multiview, input or program on another monitor) is on',
			defaultStyle: { bgcolor: combineRgb(18, 196, 248), color: BLACK },
			options: [auxOutputOption],
			callback: (fb) => api.auxActive(auxOutputNumber(fb.options.output)),
		},
		fadeToBlack: {
			type: 'boolean',
			name: 'Fade to black',
			description: 'The output is faded to black',
			defaultStyle: { bgcolor: combineRgb(255, 152, 0), color: BLACK },
			options: [],
			callback: () => api.state.fadeToBlack,
		},
		syncRole: {
			type: 'boolean',
			name: 'Master/slave role is…',
			description: 'True when this Projetech Studio has the chosen role on the master/slave link',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'role',
					label: 'Role',
					default: 'master',
					choices: [
						{ id: 'master', label: 'MASTER' },
						{ id: 'slave', label: 'SLAVE' },
						{ id: 'standalone', label: 'Standalone' },
					],
				},
			],
			callback: (fb) => api.state.connected && api.state.sync.role === fb.options.role,
		},
		connected: {
			type: 'boolean',
			name: 'Connected to Projetech Studio',
			description: "Companion's connection to this Projetech Studio is up",
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [],
			callback: () => api.state.connected,
		},
		// ---- ProLume (the clip grid, Projetech Studio 1.5): ids and option ids are stored in buttons, never rename them.
		clipActive: {
			type: 'boolean',
			name: 'ProLume: clip on air',
			description: 'The clip of the cell (layer × column) is on air',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [layerOption(), columnOption()],
			callback: async (fb, ctx) => (await cellOf(fb, ctx)).clip?.connected ?? false,
		},
		clipSelected: {
			type: 'boolean',
			name: 'ProLume: selected cell',
			description: 'The cell (layer × column) is the selected one',
			defaultStyle: { bgcolor: YELLOW, color: BLACK },
			options: [layerOption(), columnOption()],
			callback: async (fb, ctx) => {
				const c = api.state.composition
				const { layer, column } = await cellOf(fb, ctx)
				return !!c && !!layer && !!column && c.selectedLayer === layer.number && c.selectedColumn === column.number
			},
		},
		clipEmpty: {
			type: 'boolean',
			name: 'ProLume: empty cell',
			description: 'The cell (layer × column) has no clip (or is not on the grid)',
			defaultStyle: { bgcolor: DIM_BG, color: DIM_TEXT },
			options: [layerOption(), columnOption()],
			callback: async (fb, ctx) => (await cellOf(fb, ctx)).clip === undefined,
		},
		columnActive: {
			type: 'boolean',
			name: 'ProLume: column fired',
			description: 'The column is the one fired last',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [columnOption()],
			callback: async (fb, ctx) => {
				const column = await columnOf(fb, ctx)
				return !!column && api.state.composition?.column === column.number
			},
		},
		layerBypass: {
			type: 'boolean',
			name: 'ProLume: layer bypassed',
			description: 'The layer is bypassed (off air, video and audio)',
			defaultStyle: { bgcolor: ORANGE, color: BLACK },
			options: [layerOption()],
			callback: async (fb, ctx) => (await layerOf(fb, ctx))?.bypass ?? false,
		},
		layerSolo: {
			type: 'boolean',
			name: 'ProLume: layer solo',
			description: 'The layer is soloed (only soloed layers are seen and heard)',
			defaultStyle: { bgcolor: CYAN, color: BLACK },
			options: [layerOption()],
			callback: async (fb, ctx) => (await layerOf(fb, ctx))?.solo ?? false,
		},
		layerEnding: {
			type: 'boolean',
			name: "ProLume: layer's clip ending",
			description: "The remaining time of the layer's clip is in the warning range (red on the grid)",
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [layerOption()],
			callback: async (fb, ctx) => (await layerOf(fb, ctx))?.warning ?? false,
		},
		compositionMode: {
			type: 'boolean',
			name: 'ProLume mode on',
			description: 'ProLume mode is on in this Projetech Studio (the grid drives the program)',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => api.state.composition?.enabled ?? false,
		},
	}
}
