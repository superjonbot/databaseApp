const http = require('http');

const DB_PORT = 8901;
const PORT = 8902;
const SHARD_START_PORT = 8905;

// When we discover the length of the ordered list from the DB, we stash it here.
let knownListLength;

function sendJSONResponse(res, status, response) {
    const message = JSON.stringify(response);

    res.writeHead(status, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(message),
    });

    res.end(message);
}

// Request for DB; modified to accept port number
function makeDatabaseRequest(pathname, callback, port = DB_PORT) {
    http.get(`http://localhost:${port}${pathname}`, (dbResponse) => {
        dbResponse.setEncoding('utf8');

        let rawUTF8 = '';

        dbResponse.on('data', (chunk) => {
            rawUTF8 += chunk;
        });

        dbResponse.on('end', () => {
            callback(JSON.parse(rawUTF8));
        });
    });
}

// Request for Shard Directory
function makeDirectoryRequest(callback) {
    http.get(`http://localhost:${SHARD_START_PORT}/range`, dbResponse => {
        dbResponse.setEncoding('utf8');

        let rawUTF8 = '';

        dbResponse.on('data', chunk => {
            rawUTF8 += chunk;
        });

        dbResponse.on('end', () => {
            callback(JSON.parse(rawUTF8));
        });
    });
}

function findSegment(res, knownLength, position) {

    function tryNext(index) {
        makeDatabaseRequest(`/query?index=${index}`, (data) => {
            const { result } = data;

            if (result.start <= position && position <= result.end) {
                return sendJSONResponse(res, 200, data);
            }

            tryNext(index + 1);
        });
    }

    tryNext(0);
}

// find segment using binary search
function binarySearch(res, knownLength, position, port = DB_PORT) {
    let currentStep = knownLength / 2;
    function tryNext(index) {
        makeDatabaseRequest(`/query?index=${index}`, data => {
            const { result } = data;
            // Check if the position is within the current segment
            if (result.start <= position && position <= result.end) {
                return sendJSONResponse(res, 200, data);
            }
            // Update the step amount for the next search
            let stepAmount = Math.ceil(currentStep / 2);
            currentStep = stepAmount;
            // Determine the next index to query
            if (position > result.end) {
                let nextIndex = Math.min(index + stepAmount, knownLength - 1);
                tryNext(nextIndex);
            } else if (result.start > position) {
                let nextIndex = Math.max(index - stepAmount, 0);
                tryNext(nextIndex);
            }
        }, port);
    }

    // Start the search from the middle of the list
    tryNext(Math.floor(knownLength / 2));
}

function findShard(array, position){
  for (const obj of array) {
    if (obj.start <= position && position <= obj.end) {
      return obj;
    }
  }
  return null; // Return null if no matching object is found
};
function shardSearch(res, knownLength, position) {
  let shard;
  makeDirectoryRequest((data) => {
    shard = findShard(data.result, position);
    const {port,length} = shard;
    return binarySearch(res, length, position, port)
  });
}
// Obj to assign search types
const searchFunctions = {
  shard: shardSearch,
  binary: binarySearch,
  brute: findSegment,
};
function getRange(res) {
    makeDatabaseRequest('/range', (data) => {
        const { length } = data.result;

        knownListLength = length;

        sendJSONResponse(res, 200, data);
    });
}

const server = http.createServer((req, res) => {
    const base = `http://localhost:${server.address().port}`;
    const url = new URL(req.url, base);

    const response = { result: null };
    let status = 404;

    if (url.pathname === '/range') {
        return getRange(res);
    }

    if (url.pathname === '/media-segment') {
        const position = parseInt(url.searchParams.get('position'), 10);
        const searchType = url.searchParams.get('searchType') || 'brute';
        const validSearchTypes = ['binary', 'brute', 'shard'];
        // validate
        if (searchType && !validSearchTypes.includes(searchType)) {
            throw new Error(`Invalid searchType: ${searchType}`);
        }

        if (!Number.isNaN(position)) {
            return searchFunctions[searchType](res, knownListLength, position);
        }
    }

    sendJSONResponse(res, status, response);
});

server.on('listening', () => {
    const { port } = server.address();
    console.log('Application server listening on port', port);
});

server.listen(PORT);
