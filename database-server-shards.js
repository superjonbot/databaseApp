const http = require('http');

const PORT = 8901;
const DATABASE_SIZE = 9999999;
const SHARD_START_PORT = 8905;
const shardCount = 20;

// Create fake media segment data and populate the database with the results.
// (The "database" is simply an ordered list in memory above.)
const createFakeMediaSegmentsData = databaseSize => {
    // Initialize the media timeline cursor
    const orderedList = [];
    let timelineCursor = Date.now();
    const maxDuration = 10000;
    const minDuration = 5000;

    for (let i = 0; i < databaseSize; i++) {
        const duration = Math.round(Math.random() * (maxDuration - minDuration) + minDuration);

        orderedList.push({
            duration,
            start: timelineCursor,
            end: timelineCursor + duration,
            index: i,
        });

        timelineCursor += duration;
    }
    return orderedList;
};
// Takes in data to be split into shards and the number of shards to create.
const createShardData = (shardData, shardCount) => {
    if (!Number.isInteger(shardCount) || shardCount <= 0) {
        throw new Error('Invalid shardCount: must be a positive integer.');
    }
    const shardSize = Math.ceil(shardData.length / shardCount);
    const shards = [];
    for (let i = 0; i < shardCount; i++) {
        shards.push(shardData.slice(i * shardSize, (i + 1) * shardSize));
    }
    return shards;
};
// Send a response to the client.
const sendResponse = (res, status, message) => {
  const responseMessage = JSON.stringify(message);
  setTimeout(() => {
      res.writeHead(status, {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(responseMessage),
      });
      res.end(responseMessage);
  }, 10);
};
// Create a server that hosts the data set.
const createServer = (dataSet, port) => {
    const server = http.createServer((req, res) => {
        const base = `http://localhost:${server.address().port}`;
        const url = new URL(req.url, base);

        const response = { result: null };
        let status = 404;

        if (url.pathname === '/range') {
            status = 200;
            response.result = {
                start: dataSet[0].start,
                end: dataSet[dataSet.length - 1].end,
                length: dataSet.length,
            };
        } else if (url.pathname === '/query') {
            const index = parseInt(url.searchParams.get('index'), 10);
            const result = dataSet[index] || null;

            if (result) {
                status = 200;
            }

            response.result = result;
        } else {
            response.result = null;
        }

        sendResponse(res, status, response);
    });

    server.on('listening', () => {
        console.log(`Database server hosting ${dataSet.length} records, listening on port`, port);
    });

    server.listen(port);
};
// Create a server that hosts the shard directory.
const createShardDirectoryServer = (shards, port) => {
    const server = http.createServer((req, res) => {
        const base = `http://localhost:${server.address().port}`;
        const url = new URL(req.url, base);

        const response = { result: null };
        let status = 404;

        if (url.pathname === '/range') {
            status = 200;
            response.result = shards.map((shard, index) => {
                return {
                    start: shard[0].start,
                    end: shard[shard.length - 1].end - 1,
                    length: shard.length,
                    port: port + index + 1,
                };
            });
        } else {
            response.result = null;
        }

        sendResponse(res, status, response);
    });

    server.on('listening', () => {
        console.log(`Shard Directory Server, listening on port`, port);
    });

    server.listen(port);
};

const orderedList = createFakeMediaSegmentsData(DATABASE_SIZE);
// Split ordered list into shards
const shardData = createShardData(orderedList, shardCount);
// Start the server.
createServer(orderedList, PORT);
// Start the shard directory server
createShardDirectoryServer(shardData, SHARD_START_PORT);
// Start the shard servers
shardData.forEach((shard, index) => {
    createServer(shard, SHARD_START_PORT + index + 1);
});
