//process console arguments
var dataSource = process.argv.find(val => val.indexOf('csv') !== -1);
console.log('dataSource', dataSource);
var patientId = dataSource.substr(0,dataSource.lastIndexOf('.'));

var WebSocketClient = require('websocket').client;

function readCsv(filename, callback) {
  var fs = require('fs');
  var csv = require('csv');
	
  var csv_parser = csv.parse({ delimiter: ',' }, function(err, data){
    if (err)
      throw err;  
  
    function parseElapsedTime(str) { // 'hh:mm:ss.mmm'    
      // Remove quotes if in str
      if (str.charAt(0) === "'") 
        str = str.slice(1, str.length - 1);   
    
      var regexp = /([0-9]*):([0-9]*).([0-9]*)/;
      var match = regexp.exec(str);
      var t = parseInt(match[1])*60 + parseInt(match[2]) + parseInt(match[3]) * 0.001;  // s
      return t;
    }
  

    var fs = (data.length-3)/(parseElapsedTime(data[data.length-1][0]) - parseElapsedTime(data[3][0]));
	  var record = { fs: fs, signals: {} };    
    for (var channel_index = 1; channel_index < data[0].length; channel_index++) {
      var key = data[0][channel_index];
      // Remove quotes if in key
      if (key.charAt(0) === "'") 
        key = key.slice(1, key.length - 1);   
	  record.signals[key] = [];
      for (var i = 3; i < data.length; i++)
        record.signals[key].push(parseFloat(data[i][channel_index]));  
    }
    callback(record);
  });
  fs.createReadStream(filename).pipe(csv_parser);
}	


var client = new WebSocketClient();

client.on('connectFailed', function(error) {
  console.log('Connect Error: ' + error.toString());
});

client.on('connect', function(connection) {
  console.log('WebSocket Client Connected');
  connection.on('error', function(error) {
    console.log("Connection Error: " + error.toString());
  });
  connection.on('close', function() {
    console.log('Connection Closed');
  });
  
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      try {
        var payload = JSON.parse(message.utf8Data);
        if (payload.type !== 'stream') {
          console.log("Received: '" + message.utf8Data + "'");
        }
      } catch (e) {
        // do nothing if there's an error.
      }
    }
  });
        
  readCsv(dataSource, function(record) {
    var fs = record.fs;
    var signals = record.signals;	
	
    var t_start = new Date().getTime(); // start timestamp in ms
	var index_prev = 0;

	// Periodically generate demo data and send
	setInterval(function() {
	  var t = new Date().getTime(); // current timestamp in ms
      var index = Math.floor((t - t_start)*fs/1000);
	  
	  // Generate and send curves streams data
	  for (var key in signals) {
		  var buf = [];  
      for (var i = index_prev; i < index; i++){
        //after data is finished, start pusing from the beginning
		    buf.push(signals[key][ i % signals[key].length ]);	
      }
		  connection.sendUTF(JSON.stringify({ type: 'input_stream', data: { id: patientId, [key]: buf } }));      		
	  }
	  index_prev = index;//start from last index of previous interval 
	  
	  // Send parameters
      connection.sendUTF(JSON.stringify({ type: 'input_stream', data: {  id: patientId, hr: (80 + Math.random()*20).toFixed(0) } }));      
	  	  
    }, 150); // ms
	
  });


});

client.connect('ws://localhost:3000/', 'ws');