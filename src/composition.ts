import type { CompositionClip, CompositionColumn, CompositionLayer, CompositionState } from './api.js'

/**
 * The Modo ProLume grid as actions, feedbacks and variables read it. Layers and columns are found the way Projetech
 * Studio finds them in a FUNCTION: a number first (Camada 1 = the bottom layer, Coluna 1 = the left column), then the
 * key, then the name shown on the grid, whatever the case.
 */

const sameText = (a: string, b: string): boolean => a.toUpperCase() === b.toUpperCase()

function find<T extends { number: number; key: string; name: string }>(items: T[], text: string): T | undefined {
	const t = text.trim()
	if (t === '') return undefined
	if (/^[+-]?\d+$/.test(t)) {
		const n = parseInt(t, 10)
		if (n >= 1 && n <= items.length) return items.find((i) => i.number === n)
	}
	const key = t.replace(/^[{(]|[})]$/g, '')
	return items.find((i) => i.key !== '' && sameText(i.key, key)) ?? items.find((i) => sameText(i.name, t))
}

export function findLayer(c: CompositionState | null, text: string): CompositionLayer | undefined {
	return c ? find(c.layers, text) : undefined
}

export function findColumn(c: CompositionState | null, text: string): CompositionColumn | undefined {
	return c ? find(c.columns, text) : undefined
}

/** The clip in a layer's column; undefined for an empty cell. */
export function clipAt(layer: CompositionLayer | undefined, column: number): CompositionClip | undefined {
	return layer?.clips.find((c) => c.column === column)
}

/** The clip on air in a layer; undefined when it is empty. */
export function clipOnAir(layer: CompositionLayer | undefined): CompositionClip | undefined {
	return layer && layer.clip > 0 ? clipAt(layer, layer.clip) : undefined
}

/** A layer's clip clock now, in milliseconds. */
export interface LayerClock {
	elapsed: number
	remaining: number
	duration: number
}

/**
 * The clock of the clip on air (null when the layer is empty or plays a live input or an image, which have no
 * duration). While it runs, the time since the XML was read is added: a looping clip wraps around, the others stop at
 * their end.
 */
export function layerClock(layer: CompositionLayer | undefined, readAt: number, now: number): LayerClock | null {
	if (!layer || layer.clip <= 0 || layer.duration <= 0 || layer.state === 'Empty') return null
	const duration = layer.duration
	const loop = clipOnAir(layer)?.playMode === 'Loop'
	const dt = layer.state === 'Running' ? Math.max(0, now - readAt) : 0
	let elapsed = layer.position + dt
	let remaining = layer.remaining - dt
	if (loop) {
		elapsed = ((elapsed % duration) + duration) % duration
		if (remaining < 0) remaining = ((remaining % duration) + duration) % duration
	} else {
		elapsed = Math.min(elapsed, duration)
		remaining = Math.max(0, remaining)
	}
	return { elapsed, remaining, duration }
}

/** mm:ss (minutes go past 59); `up` rounds the seconds up, as a countdown shows them. */
export function mmss(ms: number, up = false): string {
	const s = Math.max(0, up ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
	return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
