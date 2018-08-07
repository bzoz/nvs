'use strict';

const fs = require('fs');
const path = require('path');
const use = require('./use');
const list = require('./list');
const addRemove = require('./addRemove');

function loadState() {
	return require(path.join(process.cwd(), '.nvs_bisect.json'));
}

function saveState(state) {
	fs.writeFileSync(path.join(process.cwd(), '.nvs_bisect.json'),
									 JSON.stringify(state, null, 2));
}

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
	saveState({
		hasGood: false,
		hasBad: false
	});
}

function markVersion(status) {
	let state = loadState();
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
		saveState(state);
	}
}

function next() {
	let state = loadState();
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
		let badIdx = -1, goodIdx = -1;
		let idx = 0;
		for (; idx < versions.length; ++idx) {
			const entry = statusMap.get(versions[idx].semanticVersion);
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
			}
		}
		if (possible.length === 0) {
			return `Broken by ${versions[badIdx].semanticVersion}`;
		} else {
			const useIdx = possible[Math.floor(possible.length / 2)];
			const useVersion = versions[useIdx];
			
			if (useVersion.local) {
				return use.use(useVersion, false);
			} else {
				return addRemove.addAsync(useVersion, true);
			}
		}
	}).then((result) => {
		saveState(state);
		return result;
	})
}
module.exports = bisect