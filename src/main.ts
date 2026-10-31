import {
	InstanceBase,
	InstanceStatus,
	runEntrypoint,
	type CompanionVariableValues,
	type SomeCompanionConfigField,
} from '@companion-module/base'
import { getConfigFields, type StudioConfig } from './config.js'
import { StudioApi } from './api.js'
import { getActions } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { getVariableDefinitions, getVariableValues } from './variables.js'
import { getPresets } from './presets.js'
import { UpgradeScripts } from './upgrades.js'

/**
 * Companion connection for Projetech Studio. The TCP protocol lives in StudioApi; this class wires it to Companion
 * (definitions, configuration, status, variables).
 */
export class StudioInstance extends InstanceBase<StudioConfig> {
	public config: StudioConfig = { host: '127.0.0.1', port: 8099, pollInterval: 500 }
	public readonly api = new StudioApi(this)
	/** Last values sent to Companion, so each update only sends the variables that changed. */
	private lastVariables: CompanionVariableValues = {}

	async init(config: StudioConfig): Promise<void> {
		this.config = config
		this.lastVariables = {}
		this.setActionDefinitions(getActions(this))
		this.setFeedbackDefinitions(getFeedbacks(this))
		this.setVariableDefinitions(getVariableDefinitions())
		this.setPresetDefinitions(getPresets())
		this.updateVariables()
		this.reconnect()
	}

	async destroy(): Promise<void> {
		this.api.disconnect()
	}

	async configUpdated(config: StudioConfig): Promise<void> {
		this.config = config
		this.reconnect()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return getConfigFields()
	}

	/** Called after every state change (several times a second while a clip plays): sends only the changed values. */
	updateVariables(): void {
		const values = getVariableValues(this)
		const changed: CompanionVariableValues = {}
		let any = false
		for (const [id, value] of Object.entries(values)) {
			if (this.lastVariables[id] !== value) {
				changed[id] = value
				any = true
			}
		}
		if (!any) return
		this.lastVariables = values
		this.setVariableValues(changed)
	}

	private reconnect(): void {
		if (!this.config.host) {
			// Without an address the previous connection must not keep running (and its state must not stay on the buttons).
			this.api.stop()
			this.updateStatus(InstanceStatus.BadConfig, 'Set the IP address of Projetech Studio')
			return
		}
		this.updateStatus(InstanceStatus.Connecting)
		this.api.connect(this.config.host, this.config.port || 8099, this.config.pollInterval || 500)
	}
}

runEntrypoint(StudioInstance, UpgradeScripts)
