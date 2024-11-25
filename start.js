const { openTerminal } = require('./utils/launchUtils');
const debug = false;
const bashCommands = [
    'node database-server.js',
    'node application-server.js',
    'node perf-test-client.js binary',
];
const launchDelay = 1000;
const consoleCount = bashCommands.length;

// Open the specified number of terminal windows
for (let i = 0; i < consoleCount; i++) {
    setTimeout(() => {
        openTerminal(`${bashCommands[i]}`, debug);
    }, i * launchDelay);
}
