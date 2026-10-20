import { TCPHelper, InstanceStatus } from '@companion-module/base'
import { XMLParser } from 'fast-xml-parser'
import type { StudioInstance } from './main.js'

/** One entry of the input list, as reported in the XML state. */
export interface StudioInput {
	/** Position in the Projetech Studio list, starting at 1 (what actions call "input"). */
	number: number
	key: string
	title: string
	type: string
	/** "Running", "Paused" or "Completed". */
	state: string
	/** Playback position and duration in milliseconds (0 for live inputs). */
	position: number
	duration: number
	loop: boolean
}

/** An auxiliary output ("Saída 2" to "Saída 5"): a multiview, one input or the program on another monitor. */
export interface AuxOutputState {
	number: number
	active: boolean
	/** "Multiview", "Input" or "Program". */
	mode: string
}

/** A column of the Modo ProLume grid (`<column>` of `<composition>`), Coluna 1 = the left one. */
export interface CompositionColumn {
	number: number
	key: string
	/** The name shown on the grid ("Coluna N" when it has none). */
	name: string
}

/** A cell of a layer that holds a clip (`<clip>` of a `<layer>`; empty cells are not listed). */
export interface CompositionClip {
	column: number
	/** The input's number in the list. */
	input: number
	key: string
	/** The name shown on the grid (the input's name when the cell has none). */
	name: string
	/** "Loop", "OnceClear" or "OnceHold". */
	playMode: string
	/** "Normal" or "Toggle". */
	trigger: string
	/** "#RRGGBB", or "" when none. */
	color: string
	/** On air in its layer. */
	connected: boolean
}

/** A layer of the grid (`<layer>`); Camada 1 is the bottom one. */
export interface CompositionLayer {
	number: number
	key: string
	/** The name shown on the grid ("Camada N" when it has none). */
	name: string
	/** 0–100. */
	opacity: number
	volume: number
	/** "Alpha", "Add", "Screen", "Multiply" or "LumaKey". */
	blend: string
	bypass: boolean
	solo: boolean
	locked: boolean
	ignoreColumnTrigger: boolean
	/** "Fade" or "Cut". */
	transition: string
	transitionMs: number
	autopilot: string
	/** Column of the clip on air (0 = none) and its input. */
	clip: number
	input: number
	/** "Running", "Paused", "Completed" or "Empty". */
	state: string
	/** When the XML was read: milliseconds since the clip's IN, its duration (0 for live inputs and images), what is left. */
	position: number
	duration: number
	remaining: number
	/** The layer's clock is in the warning colour (the clip is ending). */
	warning: boolean
	clips: CompositionClip[]
}

/** The Modo ProLume grid (`<composition>`, Projetech Studio 1.5 or newer, whenever the project has a grid). */
export interface CompositionState {
	/** The mode is on (the grid drives the program). */
	enabled: boolean
	/** Video master of the composition, 0–100. */
	master: number
	/** The column fired last, the selected layer and column (0 = none). */
	column: number
	selectedLayer: number
	selectedColumn: number
	columns: CompositionColumn[]
	layers: CompositionLayer[]
	/** Date.now() when the XML was read: the layers' clocks run on from it between polls. */
	readAt: number
}

/** Everything the module knows about Projetech Studio; feedbacks and variables are computed from this. */
export interface StudioState {
	inputs: StudioInput[]
	/** Input number on air (0 = wait screen) and on preview (0 = none). */
	active: number
	preview: number
	recording: boolean
	streaming: boolean
	/** LED output window on. */
	fullscreen: boolean
	/** Output 2 on (vMix's external output; pushed by the External activator). */
	external: boolean
	/** Every auxiliary output, Saída 2 first (the `<auxOutputs>` element; empty for Projetech Studio before 1.2.12). */
	auxOutputs: AuxOutputState[]
	fadeToBlack: boolean
	/** vMix tally string: one digit per input in list order, 0 = off, 1 = program, 2 = preview. */
	tally: string
	/** This module's TCP connection to Projetech Studio is up (the failover recipe checks the other computer with it). */
	connected: boolean
	/** Master/slave link of this Projetech Studio with another one (the `<sync>` element of the XML state). */
	sync: SyncState
	/** The Modo ProLume grid; null when the project has none or Projetech Studio is older than 1.5. */
	composition: CompositionState | null
}

/** Role of this computer on the master/slave link. */
export type SyncRole = 'master' | 'slave' | 'standalone'

export interface SyncState {
	role: SyncRole
	/** "Ready", "Syncing", "WaitingPartner", "DualMaster"… */
	state: string
	/** Linked to the partner right now. */
	linked: boolean
	partner: string
	partnerAddress: string
	/** This computer took over after its master stopped answering or closed. */
	promoted: boolean
	/** The partner is streaming ("Assumir transmissão" is possible here). */
	partnerStreaming: boolean
}

/** State flags driven by activator pushes ("ACTS OK <name> <0|1>") and by the XML state. */
type Flag = 'recording' | 'streaming' | 'fullscreen' | 'external' | 'fadeToBlack'

const ACTIVATOR_FLAGS: Record<string, Flag> = {
	Recording: 'recording',
	Streaming: 'streaming',
	Fullscreen: 'fullscreen',
	External: 'external',
	FadeToBlack: 'fadeToBlack',
}

/** The feedbacks that read the Modo ProLume grid: re-checked when the grid's signature changes. */
export const COMPOSITION_FEEDBACKS = [
	'clipActive',
	'clipSelected',
	'clipEmpty',
	'columnActive',
	'layerBypass',
	'layerSolo',
	'layerEnding',
	'compositionMode',
]

/** Bigger than any real XML state; protects against a peer that never sends a line break. */
const MAX_BUFFER_BYTES = 8 * 1024 * 1024

/** An XML request that got no answer for this long is considered lost and is sent again. */
const XML_RESPONSE_TIMEOUT_MS = 5000

/** While a clip plays, the layers' clocks (variables) are recomputed this often, between the XML polls. */
const CLOCK_INTERVAL_MS = 250

const emptySync = (): SyncState => ({
	role: 'standalone',
	state: '',
	linked: false,
	partner: '',
	partnerAddress: '',
	promoted: false,
	partnerStreaming: false,
})

const emptyState = (): StudioState => ({
	inputs: [],
	active: 0,
	preview: 0,
	recording: false,
	streaming: false,
	fullscreen: false,
	external: false,
	auxOutputs: [],
	fadeToBlack: false,
	tally: '',
	connected: false,
	sync: emptySync(),
	composition: null,
})

const ROLES: Record<string, SyncRole> = { Master: 'master', Slave: 'slave' }

/** An element of the parsed XML: attributes under ATTR + name, child elements by tag, text under `text`. */
type XmlNode = Record<string, unknown>

/**
 * Attributes are read with a prefix: `<composition column="2">` has `<column>` children and `<layer clip="1">` has
 * `<clip>` children, and without a prefix the attribute would replace them.
 */
const ATTR = '@_'

/** The child elements of a tag (one, several or none), as a list. */
const nodes = (raw: unknown): XmlNode[] =>
	(raw === undefined || raw === null ? [] : Array.isArray(raw) ? raw : [raw]).filter(
		(n): n is XmlNode => typeof n === 'object' && n !== null,
	)

/** A value read from the XML as text (the parser keeps attributes and texts as strings). */
const asText = (v: unknown): string =>
	typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''

const attr = (n: XmlNode | undefined, name: string): string => asText(n?.[ATTR + name])

const attrInt = (n: XmlNode | undefined, name: string): number => parseInt(attr(n, name), 10) || 0

const attrBool = (n: XmlNode | undefined, name: string): boolean => attr(n, name) === 'True'

/** The text of a text-only element (`<active>3</active>`), or of an element with attributes and text (`<input …>Name</input>`). */
const text = (v: unknown): string => (typeof v === 'object' && v !== null ? asText((v as XmlNode).text) : asText(v))

/** The `<composition>` element (the Modo ProLume grid) as state; null when it is absent. */
export function parseComposition(raw: unknown, readAt: number): CompositionState | null {
	const c = nodes(raw)[0]
	if (!c) return null
	return {
		enabled: attrBool(c, 'enabled'),
		master: attrInt(c, 'master'),
		column: attrInt(c, 'column'),
		selectedLayer: attrInt(c, 'selectedLayer'),
		selectedColumn: attrInt(c, 'selectedColumn'),
		columns: nodes(c.column).map((n) => ({ number: attrInt(n, 'number'), key: attr(n, 'key'), name: attr(n, 'name') })),
		layers: nodes(c.layer).map((n) => ({
			number: attrInt(n, 'number'),
			key: attr(n, 'key'),
			name: attr(n, 'name'),
			opacity: attrInt(n, 'opacity'),
			volume: attrInt(n, 'volume'),
			blend: attr(n, 'blend'),
			bypass: attrBool(n, 'bypass'),
			solo: attrBool(n, 'solo'),
			locked: attrBool(n, 'locked'),
			ignoreColumnTrigger: attrBool(n, 'ignoreColumnTrigger'),
			transition: attr(n, 'transition'),
			transitionMs: attrInt(n, 'transitionMs'),
			autopilot: attr(n, 'autopilot'),
			clip: attrInt(n, 'clip'),
			input: attrInt(n, 'input'),
			state: attr(n, 'state'),
			position: attrInt(n, 'position'),
			duration: attrInt(n, 'duration'),
			remaining: attrInt(n, 'remaining'),
			warning: attrBool(n, 'warning'),
			clips: nodes(n.clip).map((x) => ({
				column: attrInt(x, 'column'),
				input: attrInt(x, 'input'),
				key: attr(x, 'key'),
				name: attr(x, 'name'),
				playMode: attr(x, 'playMode'),
				trigger: attr(x, 'trigger'),
				color: attr(x, 'color'),
				connected: attrBool(x, 'connected'),
			})),
		})),
		readAt,
	}
}

/**
 * Client for the Projetech Studio TCP API (port 8099), which follows the vMix TCP API:
 *
 * - every command is one line ending in CRLF (`FUNCTION Cut Input=2`, `XML`, `SUBSCRIBE TALLY`…);
 * - simple replies are one line too (`TALLY OK 0120`, `ACTS OK Recording 1`, `FUNCTION ER <message>`);
 * - `XML` is answered with `XML <length>` followed by the XML document, where length counts UTF-8 bytes.
 *
 * Tally and activators (recording, outputs, the grid's clips and columns…) are pushed by the server after SUBSCRIBE;
 * the rest of the state (input names, positions, preview/program, the grid) comes from polling `XML`.
 */
export class StudioApi {
	private socket: TCPHelper | null = null
	/** Bytes received and not parsed yet. Kept as bytes because the XML length is in bytes and chunks can split characters. */
	private buffer: Buffer = Buffer.alloc(0)
	private pollTimer: NodeJS.Timeout | null = null
	private clockTimer: NodeJS.Timeout | null = null
	/** Time the unanswered XML request was sent (0 = none pending): only one XML request is in flight at a time. */
	private xmlRequestedAt = 0
	private readonly parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: ATTR,
		textNodeName: 'text',
		parseTagValue: false,
		parseAttributeValue: false,
	})

	public state: StudioState = emptyState()

	constructor(private readonly instance: StudioInstance) {}

	/** Opens (or reopens) the connection. TCPHelper reconnects on its own if Projetech Studio closes or restarts. */
	connect(host: string, port: number, pollInterval: number): void {
		this.disconnect()
		this.socket = new TCPHelper(host, port)
		this.socket.on('status_change', (status, message) => {
			this.instance.updateStatus(status, message)
			// Without a connection the last known tally is stale: clear it so buttons do not show an old program/preview.
			if (status !== InstanceStatus.Ok) this.clearState()
		})
		this.socket.on('error', (err) => this.instance.log('error', `TCP: ${err.message}`))
		this.socket.on('connect', () => {
			this.instance.updateStatus(InstanceStatus.Ok)
			this.state.connected = true
			this.afterStateChange(true)
			this.xmlRequestedAt = 0
			this.send('SUBSCRIBE TALLY')
			this.send('SUBSCRIBE ACTS')
			this.requestXml()
		})
		this.socket.on('data', (data) => this.onData(data))
		this.pollTimer = setInterval(() => this.requestXml(), pollInterval)
		// The layers' remaining time keeps counting between polls (only the values that changed are sent).
		this.clockTimer = setInterval(() => {
			if (this.state.composition?.layers.some((l) => l.clip > 0 && l.state === 'Running'))
				this.instance.updateVariables()
		}, CLOCK_INTERVAL_MS)
	}

	disconnect(): void {
		if (this.pollTimer) clearInterval(this.pollTimer)
		if (this.clockTimer) clearInterval(this.clockTimer)
		this.pollTimer = null
		this.clockTimer = null
		this.socket?.destroy()
		this.socket = null
		this.buffer = Buffer.alloc(0)
		this.xmlRequestedAt = 0
	}

	/** Sends one command line; does nothing while disconnected (actions pressed offline are dropped, not queued). */
	send(line: string): void {
		if (!this.socket?.isConnected) return
		this.socket.send(line + '\r\n').catch((err: unknown) => {
			this.instance.log('debug', `Falha ao enviar "${line}": ${err instanceof Error ? err.message : String(err)}`)
		})
	}

	/** `FUNCTION <name> Input=1&Value=…` (vMix syntax); undefined or empty parameters are left out. */
	sendFunction(name: string, params: Record<string, string | number | undefined> = {}): void {
		const query = Object.entries(params)
			.filter(([, v]) => v !== undefined && v !== '')
			.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
			.join('&')
		this.send(query ? `FUNCTION ${name} ${query}` : `FUNCTION ${name}`)
	}

	inputByNumber(n: number): StudioInput | undefined {
		return this.state.inputs.find((i) => i.number === n)
	}

	/** Auxiliary output `n` is on; Saída 2 follows `<external>` and its activator, so it works with any version. */
	auxActive(n: number): boolean {
		if (n <= 2) return this.state.external
		return this.state.auxOutputs.find((o) => o.number === n)?.active ?? false
	}

	/** Polls the XML state, unless the previous request is still unanswered (a slow peer must not pile up requests). */
	private requestXml(): void {
		if (!this.socket?.isConnected) return
		if (this.xmlRequestedAt !== 0 && Date.now() - this.xmlRequestedAt < XML_RESPONSE_TIMEOUT_MS) return
		this.xmlRequestedAt = Date.now()
		this.send('XML')
	}

	// ------------------------------------------------------------ incoming

	private onData(chunk: Buffer): void {
		this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk])
		if (this.buffer.length > MAX_BUFFER_BYTES) {
			this.instance.log('warn', 'Resposta grande demais do Projetech Studio, descartada')
			this.buffer = Buffer.alloc(0)
			return
		}
		for (;;) {
			const nl = this.buffer.indexOf('\r\n')
			if (nl < 0) return
			const line = this.buffer.subarray(0, nl).toString('utf8')
			if (line.startsWith('XML ')) {
				const length = parseInt(line.slice(4), 10)
				const start = nl + 2
				if (!Number.isFinite(length) || length < 0 || length > MAX_BUFFER_BYTES) {
					this.buffer = this.buffer.subarray(start)
					continue
				}
				if (this.buffer.length < start + length) return // wait for the rest of the document
				const xml = this.buffer.subarray(start, start + length).toString('utf8')
				let rest = this.buffer.subarray(start + length)
				if (rest.length >= 2 && rest[0] === 0x0d && rest[1] === 0x0a) rest = rest.subarray(2)
				this.buffer = rest
				this.xmlRequestedAt = 0
				this.onXml(xml)
				continue
			}
			this.buffer = this.buffer.subarray(nl + 2)
			this.onLine(line)
		}
	}

	private onLine(line: string): void {
		if (line.startsWith('TALLY OK ')) {
			const tally = line.slice(9).trim()
			if (tally !== this.state.tally) {
				this.state.tally = tally
				this.instance.checkFeedbacks('tally')
			}
		} else if (line.startsWith('ACTS OK ')) {
			// Activator pushes: "ACTS OK <name> [args…] <value>", the value is the last word ("Recording 1", "Input 3 1",
			// "LayerClip 2 1 1"). Input activators are covered by the tally string.
			const words = line.slice(8).trim().split(/\s+/)
			if (words.length >= 2) this.onActivator(words[0], words.slice(1, -1), words[words.length - 1])
		} else if (line.startsWith('FUNCTION ER ')) {
			this.instance.log('warn', line.slice(12))
		}
	}

	/** One activator push: the switcher's flags, and the grid's clips, columns and layer switches (Projetech Studio 1.5). */
	private onActivator(name: string, args: string[], value: string): void {
		const on = value === '1'
		const flag = ACTIVATOR_FLAGS[name]
		if (flag !== undefined && args.length === 0) {
			if (this.state[flag] !== on) {
				this.state[flag] = on
				this.afterStateChange(true)
			}
			return
		}
		const comp = this.state.composition
		if (!comp) return
		const before = this.compositionSignature()
		const n = args.map((a) => parseInt(a, 10))
		const layer = comp.layers.find((l) => l.number === n[0])
		switch (name) {
			case 'LayerClip': {
				const clip = layer?.clips.find((c) => c.column === n[1])
				if (!layer || !clip) return
				if (on) {
					for (const c of layer.clips) c.connected = c === clip
					layer.clip = clip.column
					layer.input = clip.input
				} else {
					clip.connected = false
					if (layer.clip === clip.column) {
						layer.clip = 0
						layer.input = 0
					}
				}
				break
			}
			case 'Column':
				if (on) comp.column = n[0]
				else if (comp.column === n[0]) comp.column = 0
				break
			case 'LayerBypass':
				if (layer) layer.bypass = on
				break
			case 'LayerSolo':
				if (layer) layer.solo = on
				break
			case 'LayerEnding':
				if (layer) layer.warning = on
				break
			default:
				return
		}
		if (this.compositionSignature() !== before) this.afterStateChange(false, true)
	}

	private onXml(xml: string): void {
		try {
			const doc = this.parser.parse(xml)?.vmix as XmlNode | undefined
			if (!doc) return
			const flagsBefore = this.flagSignature()
			const compositionBefore = this.compositionSignature()
			this.state.inputs = nodes((doc.inputs as XmlNode | undefined)?.input).map((i) => ({
				number: attrInt(i, 'number'),
				key: attr(i, 'key'),
				title: attr(i, 'title') || text(i),
				type: attr(i, 'type'),
				state: attr(i, 'state'),
				position: attrInt(i, 'position'),
				duration: attrInt(i, 'duration'),
				loop: attrBool(i, 'loop'),
			}))
			this.state.active = parseInt(text(doc.active), 10) || 0
			this.state.preview = parseInt(text(doc.preview), 10) || 0
			this.state.recording = text(doc.recording) === 'True'
			this.state.streaming = text(doc.streaming) === 'True'
			this.state.fullscreen = text(doc.fullscreen) === 'True'
			this.state.external = text(doc.external) === 'True'
			this.state.fadeToBlack = text(doc.fadeToBlack) === 'True'
			this.state.auxOutputs = nodes((doc.auxOutputs as XmlNode | undefined)?.auxOutput).map((o) => ({
				number: attrInt(o, 'number'),
				active: attrBool(o, 'active'),
				mode: attr(o, 'mode'),
			}))
			const sync = nodes(doc.sync)[0]
			this.state.sync = sync
				? {
						role: ROLES[attr(sync, 'role')] ?? 'standalone',
						state: attr(sync, 'state'),
						linked: attrBool(sync, 'connected'),
						partner: attr(sync, 'partner'),
						partnerAddress: attr(sync, 'partnerAddress'),
						promoted: attrBool(sync, 'promoted'),
						partnerStreaming: attrBool(sync, 'partnerStreaming'),
					}
				: emptySync()
			this.state.composition = parseComposition(doc.composition, Date.now())
			this.afterStateChange(this.flagSignature() !== flagsBefore, this.compositionSignature() !== compositionBefore)
		} catch (err) {
			this.instance.log('debug', `XML inválido: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	private flagSignature(): string {
		const s = this.state
		return [
			s.recording,
			s.streaming,
			s.fullscreen,
			s.external,
			s.fadeToBlack,
			s.connected,
			s.sync.linked,
			s.sync.promoted,
			s.sync.partnerStreaming,
		]
			.map(Number)
			.join('')
			.concat(s.sync.role, s.sync.state, s.auxOutputs.map((o) => `${o.number}${Number(o.active)}`).join(','))
	}

	/** What the grid's feedbacks read: the mode, the selection, the column fired last, each layer's clip and switches. */
	private compositionSignature(): string {
		const c = this.state.composition
		if (!c) return ''
		return [
			`${Number(c.enabled)}:${c.column}:${c.selectedLayer}:${c.selectedColumn}`,
			c.columns.map((x) => `${x.number}=${x.name}`).join(','),
			...c.layers.map(
				(l) =>
					`${l.number}=${l.name}:${l.clip}:${Number(l.bypass)}${Number(l.solo)}${Number(l.warning)}:` +
					l.clips.map((x) => `${x.column}${x.connected ? '*' : ''}`).join(','),
			),
		].join('|')
	}

	/** Variables only send what changed (see StudioInstance.updateVariables); feedbacks are re-checked when what they read changed. */
	private afterStateChange(flagsChanged: boolean, compositionChanged = false): void {
		this.instance.updateVariables()
		if (flagsChanged)
			this.instance.checkFeedbacks('recording', 'streaming', 'output', 'aux', 'fadeToBlack', 'syncRole', 'connected')
		if (compositionChanged) this.instance.checkFeedbacks(...COMPOSITION_FEEDBACKS)
	}

	private clearState(): void {
		this.state = emptyState()
		this.instance.updateVariables()
		this.instance.checkFeedbacks()
	}
}
