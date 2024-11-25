//Launch Utils

const { exec } = require('child_process');
const fs = require('fs');

// opens a new terminal window and runs a specified command
const openTerminal = (command, debug = false) => {
    const fullCommand = `cd ${process.cwd()} && ${command}`;
    if (debug) {
        console.log(`[Debug] ${fullCommand}`);
    } else {
        exec(`osascript -e 'tell application "Terminal" to do script "${fullCommand}"'`);
    }
};

module.exports = {
    openTerminal,
};
