'use strict';

const use = require('./use');
const list = require('./list');
const addRemove = require('./addRemove');
const bisectState = require('./bisectState');

function bisect(args) {
	if (args.length === 1) {
			return 'usage: nvs bisect [help|start|bad|good|skip|next]';
	}
	switch (args[1]) {
		case 'start':
			return start();
		case 'bad':
			return markVersion('bad');
		case 'good':
			return markVersion('good');
		case 'skip':
			return markVersion('skip');
		case 'next':
			return next();
		case 'help':
		default:
			return ['usage: nvs bisect [help|start|bad|good|skip|reset]', '',
							'nvs bisect help', '\tprints this long help message.',
							'nvs bisect start', '\treset bisect state and start bisection, passing custom bad/good names or revisions is not supported.',
							'nvs bisect bad', '\tmark current version as bad.',
							'nvs bisect good', '\tmark current version as good.',
							'nvs bisect skip', '\tmark current version as untestable.',
							'nvs bisect next', '\tfind next bisection to test and download it.',
							'nvs log/reply is not supported - edit .nvs_bisect.json file to achive the same result'];
	}
}

function start() {
	bisectState.saveState({
		hasGood: false,
		hasBad: false
	});
}

function markVersion(status) {
	let state = bisectState.loadState();
	let version = use.getCurrentVersion();
	if (!version) {
		return 'No NVS node instane in use';
	}
	if (state.remoteName && state.remoteName != version.remoteName) {
		return `Cannot bisect between ${state.remoteName} and ${version.remoteName} Nodes`;
	}
	state.remoteName = version.remoteName;
	if (status === 'bad') {
		state.hasBad = true;
	} else if (status === 'good') {
		state.hasGood = true;
	}
	version.status = status;
	state.log = state.log || [];
	state.log.push(version);
	if (state.hasBad && state.hasGood) {
		return selectNext(state);
	} else {
		bisectState.saveState(state);
	}
}

function next() {
	let state = bisectState.loadState();
	if (state.hasBad && state.hasGood) {
		return selectNext(state);
	} else {
		return 'At least one version has to be marked as good and one as bad.';
	}
}

function selectNext(state) {
	const versionsPromise = list.getRemoteVersionsAsync(state.remoteName);
	let badCount = 0;
	let statusMap = new Map();
	state.log.forEach(function(version) {
		if (version.status === 'bad')
			++badCount;
		statusMap.set(version.semanticVersion, version);
	});
	return versionsPromise.then(versions => {
		let possible = new Array();
		let possibleLocal = new Array();
		let resultMsg = new Array();
		let badIdx = -1, goodIdx = -1;
		let idx = 0;
		for (; idx < versions.length; ++idx) {
			const entry = statusMap.get(versions[idx].semanticVersion);
			if (!entry)
				continue;
			if (entry.status === 'bad') {
				break;
			}
			if (entry.status === 'good') {
				return 'Version marked as good is never than any bad version, cannot bisect.';
			}
		}
		for (; idx < versions.length; ++idx) {
			const entry = statusMap.get(versions[idx].semanticVersion);
			if (entry) {
				switch (entry.status) {
					case 'bad':
						--badCount;
						badIdx = idx;
						possible.length = 0;
						possibleLocal.length = 0;
						break;
					case 'good':
						if (badCount !== 0) {
							return 'Version marked as good is never than a bad version, cannot bisect.';
						}
						goodIdx = idx;
						break;
					default:
						break;
				}
				if (goodIdx === idx)
					break;
			} else {
				possible.push(idx);
				if (versions[idx].local) {
					possibleLocal.push(idx);
				}
			}
		}
		if (possible.length === 0) {
			return `Broken by ${versions[badIdx].semanticVersion}, last good ` +
						 `version: ${versions[goodIdx].semanticVersion}`;
		} else {
			// If possible try using already installed Node version
			const useIdx = possibleLocal.length === 0
									 ? possible[Math.floor(possible.length / 2)]
									 : possibleLocal[Math.floor(possibleLocal.length / 2)]; 
			const useVersion = versions[useIdx];
			console.log(`Looking between bad ${versions[badIdx].semanticVersion} ` +
									`and ${versions[goodIdx].semanticVersion} good versions. ` +
									`Now testing ${useVersion.semanticVersion}.`);
			console.log(`There are ${possible.length} versions left (` +
									`${possibleLocal.length} already installed), roughly ` +
									`${Math.ceil(Math.log2(possible.length))} step(s) left.`);
			if (useVersion.local) {
				return use.use(useVersion, false);
			} else {
				state.installed = state.installed || []
				state.installed.push(useVersion);
				return addRemove.addAsync(useVersion, true);
			}
		}
	}).then((result) => {
		bisectState.saveState(state);
		return result;
	})
}

module.exports = {
	bisect
}
