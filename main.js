/*jslint node:true, vars:true, bitwise:true, unparam:true */
/*jshint unused:true */
// Leave the above lines for propper jshinting
//Type Node.js Here :)

var http = require('http'); //helps with http methods
var path = require('path'); //helps with file paths
var fs = require('fs'); //helps with file system tasks
var WebSocketServer = require('websocket').server; //Used since this is the W3C standard
var mraa = require("mraa"); //io library for nodejs - gotta have this!


var digitalAccelerometer = require('jsupm_mma7660');
// Instantiate an MMA7660 on I2C bus 0
var myDigitalAccelerometer = new digitalAccelerometer.MMA7660(
	   digitalAccelerometer.MMA7660_I2C_BUS,
	   digitalAccelerometer.MMA7660_DEFAULT_I2C_ADDR);
	 
// place device in standby mode so we can write registers
myDigitalAccelerometer.setModeStandby();
	 
// enable 64 samples per second
myDigitalAccelerometer.setSampleRate(digitalAccelerometer.MMA7660.AUTOSLEEP_64);
	 
// place device into active mode
myDigitalAccelerometer.setModeActive();
	 
var x, y, z;
	x = digitalAccelerometer.new_intp();
	y = digitalAccelerometer.new_intp();
	z = digitalAccelerometer.new_intp();
	 
var ax, ay, az;
	ax = digitalAccelerometer.new_floatp();
	ay = digitalAccelerometer.new_floatp();
	az = digitalAccelerometer.new_floatp();
	 


function requestHandler(req, res) {
	var
	content = '',
	fileName = path.basename(req.url),//the file that was requested
	localFolder = __dirname + '/';//where the files are located in the ./node_app_slot directory
    //console.log("filename: " + fileName);
    //console.log("localFlder: " + localFolder);  //Uncomment these two lines for trouble shooting!..
 
	//NOTE: __dirname returns the root folder that this javascript file is in.
 
    switch(fileName){
        // index.html and index2.html are used to do further testing without coorrupting logic and syntax of a working html file
        // Responding with HTML Codes is required to have a solid web app!
        case 'index.html':
                res.writeHead(200, { 'content-encoding': 'utf8' });
                break;
        case 'index2.html':
                res.writeHead(200, { 'content-encoding': 'utf8' });
                break;
            
        // I feel its best practice to compress fils and let the browser uncompress
        case 'three.js':
                res.writeHead(200, { 'content-encoding': 'gzip' });
                fileName = fileName + ".gz";
                // console.log("Sending: " + fileName);
                break;
        
        default:
                //if the file was not found, set a 404 header...
                res.writeHead(404, {'Content-Type': 'text/html'});
		          //send a custom 'file not found' message
		          //and then close the request
                res.end('<h1>You goober!  The page you are looking for cannot be found or is deep in the Matrix!!!</h1>');
                break;
    }

    content = localFolder + fileName;//setup the file name to be returned
    console.log("Content" + content);
 
		//reads the file referenced by 'content' and then calls the anonymous function we pass in
    fs.readFile(content,function(err,contents){
        //if the fileRead was successful...
        if(!err)
        {
            //send the contents and then close the request
            res.end(contents);
        } 
        else 
        {
            //otherwise, let us inspect the eror in the console
            console.dir(err);
            res.writeHead(404, {'Content-Type': 'text/html'});
		          //send a custom 'file not found' message
		          //and then close the request
            res.end('<h1>Well.....for some reason the RTOS could not read the file!</h1>');
        };
    });
};

// Gotta have a web server running to get things going!
var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(81, function() {
    console.log((new Date()) + ' Web server is listening on port 3000');
});

wsServer = new WebSocketServer({ 
   httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
    
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

//When connected to the ws client this code runs!  Yay figuring this out was a pain and its a hack but anyway.....
wsServer.on('connect', function (connection){
    console.log('WebSocket Client Connected');
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
    connection.on('close', function() {
        console.log('echo-protocol Connection Closed');
    });
    connection.on('connect', function(message) {
        if (message.type === 'utf8') {
            console.log("Received: '" + message.utf8Data + "'");
            }
        });
   // Sit in this time out loop and send accelerometer data.....
    function sendAccelData() {
        myDigitalAccelerometer.getRawValues(x, y, z);
        outputStr = "Raw values: x = " + digitalAccelerometer.intp_value(x) + " y = " + digitalAccelerometer.intp_value(y) +
	       " z = " + digitalAccelerometer.intp_value(z);
        console.log(outputStr);
        connection.sendUTF("Accel," + digitalAccelerometer.intp_value(x) + "," + digitalAccelerometer.intp_value(y) + "," + digitalAccelerometer.intp_value(z));
        setTimeout(sendAccelData, 125);
    }
    sendAccelData();  
    
    // DONT FORGET TO ADD MEMORY CLEANUP ROUTINE 
    
});

//This is ran upon the initial GET request....I am not sure if this is needed but will leave it alone for now...
wsServer.on('request', function (request){
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    var connection = request.accept('echo-protocol', request.origin);
    console.log((new Date()) + ' Connection accepted.');
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            console.log('Received Message: ' + message.utf8Data);
            connection.sendUTF("Accel,50,50,20");
        }
        else if (message.type === 'binary') {
            console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
            connection.sendBytes(message.binaryData);
        }
    });
    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
});

//Create the http server
http.createServer(requestHandler)
 
//listen for an HTTP request on port 3000
.listen(3000);