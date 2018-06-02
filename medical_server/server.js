// --------------------- declaring and initializing ------------------------------
var port = 3000;
var info = "Patient monitoring server PoC v0.1";

var http = require('http');
var express = require('express');
var WebSocketServer = require('websocket').server;
var mongoManger = require('./mongo-manager');

// configure Express
var app = express();
app.use(express.static(`${__dirname}/public`));
app.use('/data',express.static(`${__dirname}/data`));

mongoManger.connectToMongDb('Monitor');

// --------------------- routings ------------------------------
app.get('/', function(req, res) {
  res.sendfile(`${__dirname}/public/index.html`);
});
app.get('/archive', function(req, res) {
  res.sendfile(`${__dirname}/public/archive.html`);
});
app.get('/api/archive', function(req, res) {
  mongoManger.getAllRecords().then(records => {
    console.log('all records', records);
    res.json(records);
  });
});
app.get('/api/archive/download', function(req, res) {
  var userId = req.query.userId;
  if(userId == null)
    return;
  mongoManger.findOneRecord({userId: userId}, {}, (doc) => {
    var fs = require('fs');
    var fileName = `${userId}_recod.xlsx`;
    saveToExcel(doc, fileName, () => {
      res.send(`data/${fileName}`);
    });
  });
});


// --------------------- Server setup  ------------------------------
var http_server;
try {
  http_server = http.createServer(app).listen(port);
} catch (err  ) {
  console.log('Error:\n  ' + err.name + ':' + err.message + '\n  ' + err.stack);  
  process.exit(1);
} 

// --------------------- WebSocket setup ------------------------------
var workSheet_server = new WebSocketServer({
  httpServer: http_server,
  // Firefox 7 alpha has a bug that drops the connection on large fragmented messages
  fragmentOutgoingMessages: false
});

var connections = [];
function broadcast(message) {
  connections.forEach(function(destination) {
    destination.sendUTF(JSON.stringify(message));
  });
}

// --------------------- WebSocket message handling ------------------------------
workSheet_server.on('request', function(request) {
	
  console.log('request.origin', request.origin);
  
  var connection = request.accept('workSheet', request.origin);
  connections.push(connection);//all clients who requested that server are stored to connections array

  console.log(connection.remoteAddress + " connected - Protocol Version " + connection.webSocketVersion);

  connection.sendUTF(JSON.stringify({ type: "hello", msg: info }));

  // Handle closed connections
  connection.on('close', function() {
    console.log(connection.remoteAddress + " disconnected");
    // remove the connection from the pool
    var index = connections.indexOf(connection);
    if (index !== -1) {
      connections.splice(index, 1);
    }
  });

  // Handle incoming messages
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      try {
        var payload = JSON.parse(message.utf8Data);
        if (payload.type === 'input_stream') {
          console.log('Broadcast data', payload.data);
          // rebroadcast stream to all web-clients
          broadcast({ type: 'stream', data: payload.data });
          
          saveToDataBase(payload.data);
        }
      } catch (e) {
        // do nothing if there's an error.
      }
    }
  });
});

// --------------------- Helpers ------------------------------
function saveToDataBase(data) {
  console.log('save to DB: ', data);
  var patientId = data['id'];

  if ('hr' in data) { 
    mongoManger.findOneAndUpdateRecord(
      {userId: patientId}, 
      {$set: {hr: data.hr}}, 
      {upsert: true},
      (document) => {
        console.log('hr updated');
      }
    );
  }
  if ('MLII' in data) {
    mongoManger.findOneAndUpdateRecord(
      {userId: patientId}, 
      {$set: {mlii: data['MLII']}}, 
      {upsert: true},
      (document) => {
        console.log('MLII updated');
      }
    );
  }
  if ('V5' in data) {
    mongoManger.findOneAndUpdateRecord(
      {userId: patientId}, 
      {$set: {v5: data['V5']}}, 
      {upsert: true},
      (document) => {
        console.log('V5 updated');
      }
    );
  }
}

function saveToExcel(doc, fileName, callback) {
    //https://github.com/chuanyi/msexcel-builder
    var excelbuilder = require('msexcel-builder');

    var workbook = excelbuilder.createWorkbook('./data', fileName);
    var workSheet = workbook.createSheet('User record', 2, doc.mlii.length+3);
    workSheet.set(1,1,'HR');
    workSheet.set(2,1,doc.hr);
    workSheet.set(1,2,'MLII');
    doc.mlii.forEach((el, i) => {
      workSheet.set(1,3+i, el);
    });
    workSheet.set(2,2, 'V5');
    doc.v5.forEach((el, i) => {
      workSheet.set(2,3+i, el);
    });
    workbook.save(function(err){
      if (err)
        return console.log('Error during excel writing');
      console.log('Excel created');
      callback();
  });
}

console.log("Test patient monitoring server ready!");
