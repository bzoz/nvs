const fs = require('fs');
const path = require('path');

function loadState() {
	return require(path.join(process.cwd(), '.nvs_bisect.json'));
}

function saveState(state) {
	fs.writeFileSync(path.join(process.cwd(), '.nvs_bisect.json'),
									 JSON.stringify(state, null, 2));
}

function getStatus() {
	const state = loadState();
	let status = new Map();
	if (state && state.log) {
		state.log.forEach(function(version) {
			status.set(`${version.remoteName}/${version.semanticVersion}/${version.arch}`,
								 version.status);
		});
	}
	return status;
}

module.exports = {
  getStatus,
  loadState,
  saveState
}