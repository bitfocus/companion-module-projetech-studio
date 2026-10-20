// Protocol tests for StudioApi against a local fake of the Projetech Studio TCP API (same replies as the real one).
// Run with `yarn test` (builds first, then uses Node's built-in test runner on dist/).
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import { StudioApi, parseComposition } from '../dist/api.js'
import { getVariableValues } from '../dist/variables.js'
import { findColumn, findLayer } from '../dist/composition.js'
import { getActions, levelValue } from '../dist/actions.js'
import { getFeedbacks } from '../dist/feedbacks.js'
import { getPresets } from '../dist/presets.js'

const names = ['Abertura vídeo', 'Apresentação São João', 'Câmera 1 (NDI)']
const xml = [
	'<vmix>',
	'  <version>27.0.0.1</version>',
	'  <inputs>',
	...names.map(
		(n, i) =>
			`    <input key="k${i + 1}" number="${i + 1}" type="Video" title="${n}" state="Paused" position="1000" duration="61000" loop="False">${n}</input>`,
	),
	'  </inputs>',
	'  <preview>2</preview>',
	'  <active>1</active>',
	'  <fadeToBlack>False</fadeToBlack>',
	'  <recording>False</recording>',
	'  <external>False</external>',
	'  <streaming>False</streaming>',
	'  <fullscreen>True</fullscreen>',
	'  <auxOutputs>',
	'    <auxOutput number="2" active="False" mode="Multiview" />',
	'    <auxOutput number="3" active="True" mode="Program" />',
	'  </auxOutputs>',
	'  <sync role="Slave" state="Ready" connected="True" partner="PC-PALCO" partnerAddress="192.168.0.10:48761" term="3" promoted="False" partnerStreaming="True" />',
	// Modo ProLume (1.5): the attributes column= and clip= share their names with child elements.
	'  <composition enabled="True" master="80" column="2" selectedLayer="1" selectedColumn="1">',
	'    <column number="1" key="c1" name="Abertura" />',
	'    <column number="2" key="c2" name="Encerramento &amp; créditos" />',
	'    <layer number="1" key="l1" name="Fundo LED" opacity="100" volume="90" blend="Alpha" bypass="False" solo="False" locked="False" ignoreColumnTrigger="False" transition="Fade" transitionMs="500" autopilot="Off" clip="2" input="1" state="Running" position="12000" duration="60000" remaining="48000" warning="False">',
	'      <clip column="2" input="1" key="k1" name="Abertura vídeo" playMode="Loop" trigger="Normal" color="#1E88E5" connected="True" />',
	'    </layer>',
	'    <layer number="2" key="l2" name="Logos" opacity="50" volume="100" blend="Screen" bypass="True" solo="False" locked="False" ignoreColumnTrigger="True" transition="Cut" transitionMs="0" autopilot="Off" clip="0" input="0" state="Empty" position="0" duration="0" remaining="0" warning="False">',
	'      <clip column="1" input="2" key="k2" name="Vinheta" playMode="OnceClear" trigger="Normal" connected="False" />',
	'      <clip column="2" input="3" key="k3" name="Câmera 1" playMode="Loop" trigger="Toggle" connected="False" />',
	'    </layer>',
	'  </composition>',
	'</vmix>',
].join('\r\n')

/** Fake server: answers like Projetech Studio and writes in 7-byte pieces, splitting multi-byte characters. */
function startServer() {
	const received = []
	const sockets = new Set()
	let recording = false
	const server = net.createServer((sock) => {
		sockets.add(sock)
		sock.on('close', () => sockets.delete(sock))
		const writeChunked = async (text) => {
			const bytes = Buffer.from(text, 'utf8')
			for (let i = 0; i < bytes.length; i += 7) {
				sock.write(bytes.subarray(i, i + 7))
				await new Promise((r) => setTimeout(r, 1))
			}
		}
		sock.write('VERSION OK 27.0.0.1\r\n')
		let pending = ''
		sock.on('data', async (data) => {
			pending += data.toString('utf8')
			let nl
			while ((nl = pending.indexOf('\r\n')) >= 0) {
				const line = pending.slice(0, nl).trim()
				pending = pending.slice(nl + 2)
				received.push(line)
				const [cmd, arg] = line.split(' ')
				if (cmd === 'SUBSCRIBE' && arg === 'TALLY') sock.write('SUBSCRIBE OK TALLY\r\nTALLY OK 120\r\n')
				else if (cmd === 'SUBSCRIBE' && arg === 'ACTS') sock.write('SUBSCRIBE OK ACTS\r\n')
				else if (cmd === 'XML')
					await writeChunked(`XML ${Buffer.byteLength(xml, 'utf8')}\r\n${xml}\r\nTALLY OK 102\r\n`)
				else if (cmd === 'FUNCTION') {
					sock.write(`FUNCTION OK ${arg}\r\n`)
					if (arg === 'StartStopRecording') {
						recording = !recording
						sock.write(`ACTS OK Recording ${recording ? 1 : 0}\r\n`)
					} else if (arg === 'TriggerClip') {
						// The grid's activators: the name, its numbers, and the value last.
						sock.write(
							'ACTS OK LayerClip 2 1 1\r\nACTS OK Column 1 1\r\nACTS OK Column 2 0\r\nACTS OK LayerBypass 2 0\r\n',
						)
					}
				}
			}
		})
	})
	return new Promise((resolve) =>
		server.listen(0, '127.0.0.1', () =>
			resolve({
				port: server.address().port,
				received,
				dropClients: () => sockets.forEach((s) => s.destroy()),
				close: () => new Promise((r) => server.close(r)),
			}),
		),
	)
}

function fakeInstance() {
	const calls = { status: [], feedbacks: 0, variables: 0, logs: [] }
	return {
		calls,
		updateStatus: (status) => calls.status.push(status),
		log: (level, message) => calls.logs.push(`${level}: ${message}`),
		checkFeedbacks: () => calls.feedbacks++,
		updateVariables: () => calls.variables++,
	}
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const server = await startServer()
const instance = fakeInstance()
const api = new StudioApi(instance)
api.connect('127.0.0.1', server.port, 60_000)
await wait(600)

after(async () => {
	api.disconnect()
	await server.close()
})

test('connects and subscribes to tally and activators', () => {
	assert.ok(instance.calls.status.includes('ok'))
	assert.deepEqual(server.received.slice(0, 3), ['SUBSCRIBE TALLY', 'SUBSCRIBE ACTS', 'XML'])
})

test('reads the XML state, counting its length in UTF-8 bytes', () => {
	assert.deepEqual(
		api.state.inputs.map((i) => i.title),
		names,
	)
	assert.equal(api.state.active, 1)
	assert.equal(api.state.preview, 2)
	assert.equal(api.state.fullscreen, true)
	assert.equal(api.inputByNumber(1)?.duration, 61000)
})

test('reads the master/slave link and the connection state', () => {
	assert.equal(api.state.connected, true)
	assert.equal(api.state.sync.role, 'slave')
	assert.equal(api.state.sync.partner, 'PC-PALCO')
	assert.equal(api.state.sync.linked, true)
	assert.equal(api.state.sync.partnerStreaming, true)
	assert.equal(api.state.sync.promoted, false)
})

test('reads the auxiliary outputs (Saída 2 follows <external>)', () => {
	assert.deepEqual(api.state.auxOutputs, [
		{ number: 2, active: false, mode: 'Multiview' },
		{ number: 3, active: true, mode: 'Program' },
	])
	assert.equal(api.auxActive(2), false)
	assert.equal(api.auxActive(3), true)
	assert.equal(api.auxActive(4), false)
})

test('keeps the line that arrives right after the XML document', () => {
	assert.equal(api.state.tally, '102')
})

test('sends functions with URL-encoded parameters', async () => {
	api.sendFunction('Fade', { Input: 2, Duration: 500, Value: undefined })
	api.sendFunction('SetCountdown', { Value: '00:05:00' })
	await wait(200)
	assert.ok(server.received.includes('FUNCTION Fade Input=2&Duration=500'))
	assert.ok(server.received.includes('FUNCTION SetCountdown Value=00%3A05%3A00'))
})

test('follows activator pushes', async () => {
	api.sendFunction('StartStopRecording')
	await wait(200)
	assert.equal(api.state.recording, true)
})

test('reads the Modo ProLume grid (a layer with one clip, a layer with two)', () => {
	const c = api.state.composition
	assert.ok(c)
	assert.deepEqual([c.enabled, c.master, c.column, c.selectedLayer, c.selectedColumn], [true, 80, 2, 1, 1])
	assert.deepEqual(
		c.columns.map((x) => [x.number, x.name]),
		[
			[1, 'Abertura'],
			[2, 'Encerramento & créditos'],
		],
	)
	assert.equal(c.layers.length, 2)
	const [bottom, top] = c.layers
	assert.deepEqual(bottom.clips, [
		{
			column: 2,
			input: 1,
			key: 'k1',
			name: 'Abertura vídeo',
			playMode: 'Loop',
			trigger: 'Normal',
			color: '#1E88E5',
			connected: true,
		},
	])
	assert.deepEqual(
		[bottom.clip, bottom.input, bottom.state, bottom.position, bottom.duration, bottom.remaining, bottom.volume],
		[2, 1, 'Running', 12000, 60000, 48000, 90],
	)
	assert.deepEqual(
		top.clips.map((x) => [x.column, x.name, x.playMode, x.trigger, x.color]),
		[
			[1, 'Vinheta', 'OnceClear', 'Normal', ''],
			[2, 'Câmera 1', 'Loop', 'Toggle', ''],
		],
	)
	assert.deepEqual(
		[top.name, top.opacity, top.blend, top.bypass, top.ignoreColumnTrigger, top.transition],
		['Logos', 50, 'Screen', true, true, 'Cut'],
	)
	assert.equal(parseComposition(undefined, 0), null) // an older Projetech Studio, or a project without a grid
})

// The XML the app writes (tests/fixtures/api/composition-state.xml of the Projetech Studio repository, compared byte for
// byte with the C# and Swift writers); skipped where the module is built on its own.
const appFixture = new URL('../../../tests/fixtures/api/composition-state.xml', import.meta.url)

test('reads the grid exactly as Projetech Studio writes it', { skip: !existsSync(appFixture) }, () => {
	const other = new StudioApi(fakeInstance())
	other.onXml(readFileSync(appFixture, 'utf8'))
	const c = other.state.composition
	assert.ok(c)
	assert.deepEqual(
		c.columns.map((x) => x.name),
		['Abertura', 'Coluna 2', 'Palestra – Câmera', 'Encerramento & créditos', 'Coluna 5'],
	)
	assert.deepEqual(
		c.layers.map((l) => [l.number, l.name, l.clip, l.clips.length]),
		[
			[1, 'Fundo LED', 2, 3],
			[2, 'Camada 2', 1, 2],
			[3, 'Logo "SP" <1>', 3, 2],
			[4, 'Camada 4', 0, 0],
		],
	)
	assert.deepEqual(
		c.layers[2].clips.map((x) => [x.column, x.connected, x.color]),
		[
			[1, false, ''],
			[3, true, '#FDD835'],
		],
	)
	assert.deepEqual(
		[c.column, c.selectedLayer, c.selectedColumn, c.layers[2].warning, c.layers[1].bypass],
		[2, 1, 4, true, true],
	)
})

test('finds layers and columns by number, then key, then name', () => {
	const c = api.state.composition
	assert.equal(findLayer(c, '2')?.name, 'Logos')
	assert.equal(findLayer(c, ' fundo led ')?.number, 1)
	assert.equal(findLayer(c, 'l2')?.number, 2)
	assert.equal(findLayer(c, '9'), undefined)
	assert.equal(findLayer(null, '1'), undefined)
	assert.equal(findColumn(c, 'ENCERRAMENTO & CRÉDITOS')?.number, 2)
	assert.equal(levelValue('set', 120, undefined), 100)
	assert.equal(levelValue('add', 30, 80), 100)
	assert.equal(levelValue('subtract', 30, 50), 20)
	assert.equal(levelValue('add', 10, undefined), undefined) // relative without the current value: nothing is sent
})

test('computes the grid variables, the clip clock running on between polls', () => {
	const c = api.state.composition
	const v = getVariableValues({ api }, c.readAt + 2000)
	assert.equal(v.composition_mode, 1)
	assert.equal(v.composition_master, 80)
	assert.equal(v.column_current, 2)
	assert.equal(v.column_current_name, 'Encerramento & créditos')
	assert.equal(v.layer_selected, 1)
	assert.equal(v.layer_1_name, 'Fundo LED')
	assert.equal(v.layer_1_clip_name, 'Abertura vídeo')
	assert.equal(v.layer_1_column, 2)
	assert.equal(v.layer_1_elapsed, '00:14')
	assert.equal(v.layer_1_remaining, '00:46')
	assert.equal(v.layer_1_remaining_seconds, 46)
	assert.equal(v.layer_1_progress, 23)
	assert.equal(v.layer_1_opacity, 100)
	assert.equal(v.layer_2_remaining, '') // empty layer
	assert.equal(v.layer_3_name, '') // no such layer
	assert.equal(v.clip_2_2_name, 'Câmera 1')
	assert.equal(v.clip_1_1_name, '')
	assert.equal(v.column_2_name, 'Encerramento & créditos')
	// A looping clip wraps around: 50 s later it is 2 s into its next pass.
	assert.equal(getVariableValues({ api }, c.readAt + 50_000).layer_1_elapsed, '00:02')
})

test('the presets use only actions, feedbacks and options that exist', () => {
	const instance = { api, log: () => {} }
	const actions = getActions(instance)
	const feedbacks = getFeedbacks(instance)
	const presets = getPresets()
	for (const [id, preset] of Object.entries(presets)) {
		for (const step of preset.steps)
			for (const a of [...step.down, ...step.up]) {
				assert.ok(actions[a.actionId], `${id}: action ${a.actionId}`)
				const ids = actions[a.actionId].options.map((o) => o.id)
				for (const option of Object.keys(a.options)) assert.ok(ids.includes(option), `${id}: ${a.actionId}.${option}`)
			}
		for (const f of preset.feedbacks) {
			assert.ok(feedbacks[f.feedbackId], `${id}: feedback ${f.feedbackId}`)
			const ids = feedbacks[f.feedbackId].options.map((o) => o.id)
			for (const option of Object.keys(f.options)) assert.ok(ids.includes(option), `${id}: ${f.feedbackId}.${option}`)
		}
	}
	const prolume = Object.values(presets).filter((p) => p.category.startsWith('Modo ProLume'))
	assert.equal(prolume.length, 64 + 8 + 3 + 8 * 4)
	assert.deepEqual(
		[...new Set(prolume.map((p) => p.category))],
		['Modo ProLume: clipes', 'Modo ProLume: colunas', 'Modo ProLume: camadas'],
	)
	assert.equal(presets.prolume_clip_8_1.steps[0].down[0].actionId, 'triggerClip') // the top layer first, as on the grid
	assert.equal(
		Object.keys(presets).indexOf('prolume_clip_8_1') < Object.keys(presets).indexOf('prolume_clip_1_1'),
		true,
	)
})

test('the grid feedbacks read the state (numbers, names and variables)', async () => {
	const feedbacks = getFeedbacks({ api, log: () => {} })
	const ctx = { parseVariablesInString: async (text) => text.replace('$(internal:x)', '2') }
	const check = async (id, options) => feedbacks[id].callback({ options }, ctx)
	assert.equal(await check('clipActive', { layer: '1', column: '2' }), true)
	assert.equal(await check('clipActive', { layer: 'Fundo LED', column: '$(internal:x)' }), true)
	assert.equal(await check('clipActive', { layer: '2', column: '1' }), false)
	assert.equal(await check('clipEmpty', { layer: '1', column: '1' }), true)
	assert.equal(await check('clipEmpty', { layer: '2', column: '1' }), false)
	assert.equal(await check('clipEmpty', { layer: '8', column: '8' }), true) // not in the grid
	assert.equal(await check('clipSelected', { layer: '1', column: '1' }), true)
	assert.equal(await check('columnActive', { column: 'Encerramento & créditos' }), true)
	assert.equal(await check('layerBypass', { layer: 'logos' }), true)
	assert.equal(await check('layerSolo', { layer: '1' }), false)
	assert.equal(await check('layerEnding', { layer: '1' }), false)
	assert.equal(await check('compositionMode', {}), true)
})

test('sends the grid functions with encoded names and follows the grid activators', async () => {
	api.sendFunction('TriggerClip', { Layer: 'Fundo LED', Column: 2 })
	await wait(200)
	assert.ok(server.received.includes('FUNCTION TriggerClip Layer=Fundo%20LED&Column=2'))
	// "ACTS OK LayerClip 2 1 1": layer 2, column 1, on air (the value is the last word).
	const c = api.state.composition
	assert.equal(c.layers[1].clip, 1)
	assert.deepEqual(
		c.layers[1].clips.map((x) => x.connected),
		[true, false],
	)
	assert.equal(c.column, 1)
	assert.equal(c.layers[1].bypass, false)
	assert.equal(api.state.recording, true) // the legacy "Recording 1" still works
})

test('clears the state when the connection drops', async () => {
	server.dropClients()
	await wait(300)
	assert.equal(api.state.tally, '')
	assert.equal(api.state.inputs.length, 0)
	assert.equal(api.state.recording, false)
	assert.equal(api.state.connected, false)
	assert.equal(api.state.sync.role, 'standalone')
	assert.deepEqual(api.state.auxOutputs, [])
	assert.equal(api.state.composition, null)
})
