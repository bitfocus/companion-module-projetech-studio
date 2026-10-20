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
 * the other flags come from activator pushes and the polled XML state, the Modo ProLume grid included.
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
			name: 'Tally do input',
			description: 'Verdadeiro quando o input está no ar (programa) ou no preview',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [
				{ type: 'number', id: 'input', label: 'Input', default: 1, min: 1, max: 999 },
				{
					type: 'dropdown',
					id: 'which',
					label: 'Estado',
					default: 'program',
					choices: [
						{ id: 'program', label: 'No ar (vermelho)' },
						{ id: 'preview', label: 'Preview (verde)' },
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
			name: 'Gravando',
			description: 'Gravação do PGM em andamento',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => api.state.recording,
		},
		streaming: {
			type: 'boolean',
			name: 'Transmitindo',
			description: 'Pelo menos um stream no ar',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => api.state.streaming,
		},
		output: {
			type: 'boolean',
			name: 'Saída LED ligada',
			description: 'Janela de saída no monitor do LED',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [],
			callback: () => api.state.fullscreen,
		},
		aux: {
			type: 'boolean',
			name: 'Saída auxiliar ligada',
			description: 'Saída 2, 3, 4 ou 5 (multiview, input ou programa em outro monitor) ligada',
			defaultStyle: { bgcolor: combineRgb(18, 196, 248), color: BLACK },
			options: [auxOutputOption],
			callback: (fb) => api.auxActive(auxOutputNumber(fb.options.output)),
		},
		fadeToBlack: {
			type: 'boolean',
			name: 'Fade to black',
			description: 'Saída em preto',
			defaultStyle: { bgcolor: combineRgb(255, 152, 0), color: BLACK },
			options: [],
			callback: () => api.state.fadeToBlack,
		},
		syncRole: {
			type: 'boolean',
			name: 'Papel na sincronia é…',
			description: 'Sincronia master/slave: verdadeiro quando este Projetech Studio tem o papel escolhido',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [
				{
					type: 'dropdown',
					id: 'role',
					label: 'Papel',
					default: 'master',
					choices: [
						{ id: 'master', label: 'MASTER' },
						{ id: 'slave', label: 'SLAVE' },
						{ id: 'standalone', label: 'Independente' },
					],
				},
			],
			callback: (fb) => api.state.connected && api.state.sync.role === fb.options.role,
		},
		connected: {
			type: 'boolean',
			name: 'Conectado ao Projetech Studio',
			description: 'A conexão do Companion com este Projetech Studio está ativa',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [],
			callback: () => api.state.connected,
		},
		// ---- Modo ProLume (the clip grid, Projetech Studio 1.5): ids and option ids are stored in buttons, never rename them.
		clipActive: {
			type: 'boolean',
			name: 'Modo ProLume: clipe no ar',
			description: 'O clipe da célula (camada × coluna) está no ar',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [layerOption(), columnOption()],
			callback: async (fb, ctx) => (await cellOf(fb, ctx)).clip?.connected ?? false,
		},
		clipSelected: {
			type: 'boolean',
			name: 'Modo ProLume: célula selecionada',
			description: 'A célula (camada × coluna) é a selecionada (CLIPE SELECIONADO)',
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
			name: 'Modo ProLume: célula vazia',
			description: 'A célula (camada × coluna) não tem clipe (ou não existe na grade)',
			defaultStyle: { bgcolor: DIM_BG, color: DIM_TEXT },
			options: [layerOption(), columnOption()],
			callback: async (fb, ctx) => (await cellOf(fb, ctx)).clip === undefined,
		},
		columnActive: {
			type: 'boolean',
			name: 'Modo ProLume: coluna disparada',
			description: 'A coluna é a disparada por último',
			defaultStyle: { bgcolor: GREEN, color: WHITE },
			options: [columnOption()],
			callback: async (fb, ctx) => {
				const column = await columnOf(fb, ctx)
				return !!column && api.state.composition?.column === column.number
			},
		},
		layerBypass: {
			type: 'boolean',
			name: 'Modo ProLume: camada em bypass',
			description: 'A camada está em bypass (fora do ar, vídeo e áudio)',
			defaultStyle: { bgcolor: ORANGE, color: BLACK },
			options: [layerOption()],
			callback: async (fb, ctx) => (await layerOf(fb, ctx))?.bypass ?? false,
		},
		layerSolo: {
			type: 'boolean',
			name: 'Modo ProLume: camada em solo',
			description: 'A camada está em solo (só as camadas em solo são vistas e ouvidas)',
			defaultStyle: { bgcolor: CYAN, color: BLACK },
			options: [layerOption()],
			callback: async (fb, ctx) => (await layerOf(fb, ctx))?.solo ?? false,
		},
		layerEnding: {
			type: 'boolean',
			name: 'Modo ProLume: clipe da camada terminando',
			description: 'O tempo restante do clipe da camada está no aviso (vermelho na grade)',
			defaultStyle: { bgcolor: RED, color: WHITE },
			options: [layerOption()],
			callback: async (fb, ctx) => (await layerOf(fb, ctx))?.warning ?? false,
		},
		compositionMode: {
			type: 'boolean',
			name: 'Modo ProLume ligado',
			description: 'O Modo ProLume está ligado neste Projetech Studio (a grade comanda o programa)',
			defaultStyle: { bgcolor: VIOLET, color: WHITE },
			options: [],
			callback: () => api.state.composition?.enabled ?? false,
		},
	}
}
