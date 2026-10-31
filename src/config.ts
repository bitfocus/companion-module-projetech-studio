import { Regex, type SomeCompanionConfigField } from '@companion-module/base'

/** Connection settings, edited in the connection's configuration page. */
export interface StudioConfig {
	/** IP of the PC running Projetech Studio. */
	host: string
	/** TCP API port, set in Projetech Studio under Config → API (8099 by default). */
	port: number
	/** How often the XML state is polled, in ms. Tally and activators are pushed and do not depend on it. */
	pollInterval: number
}

export const getConfigFields = (): SomeCompanionConfigField[] => [
	{
		type: 'static-text',
		id: 'info',
		width: 12,
		label: 'Projetech Studio',
		value:
			'IP address of the computer running Projetech Studio and its TCP API port (in Projetech Studio: Config → API). Inputs are numbered in the order of its list.',
	},
	{ type: 'textinput', id: 'host', label: 'Projetech Studio IP', width: 8, regex: Regex.IP, default: '127.0.0.1' },
	{ type: 'number', id: 'port', label: 'TCP port', width: 4, min: 1, max: 65535, default: 8099 },
	{
		type: 'number',
		id: 'pollInterval',
		label: 'Refresh interval (ms)',
		width: 4,
		min: 100,
		max: 5000,
		default: 500,
	},
]
