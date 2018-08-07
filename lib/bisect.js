'use strict';

const fs = require('fs');
const path = require('path');
const Error = require('./error');
const use = require('./use');

const statusJsonFile = path.join(process.cwd(), '.nvs_bisect.json');

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
	fs.writeFileSync(statusJsonFile, JSON.stringify({
		hasGood: false,
		hasBad: false,
	}));
}

function markVersion(status) {
	let state = require(statusJsonFile);
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
	console.log(require('util').inspect(state.log));
	if (state.hasBad && state.hasGood) {
		return selectNext(state);
	} else {
		fs.writeFileSync(statusJsonFile, JSON.stringify(state, null, 2));
	}
}

function next() {
	let state = require(statusJsonFile);
	if (state.hasBad && state.hasGood) {
		return selectNext(state);
	} else {
		return 'At least one version has to be marked as good and one as bad.';
	}
}


function selectNext() {
	return 'todo';
}
module.exports = bisect