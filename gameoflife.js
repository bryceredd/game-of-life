var http = require('http')

var host = "dev.i.tv"
var port = 3000
var units = {}

var tick = 0


// defaults
var boardSize = {width:10, height:10}
var unitId = "123"








/* game of life rules:
Any live cell with fewer than two live neighbours dies, as if caused by under-population.
Any live cell with two or three live neighbours lives on to the next generation.
Any live cell with more than three live neighbours dies, as if by overcrowding.
Any dead cell with exactly three live neighbours becomes a live cell, as if by reproduction.
*/

function life(board) {

    function neighbors(i,j) {
        var total = 0
        for(var x=-1; x<2; x++) {
            for(var y=-1; y<2; y++) {
                if(lookup(board, i+x, j+y)) total++
            }
        }

        if(lookup(board, i, j)) total--

        return total
    }

    for(var i=0; i<boardSize.width; i++) {
        for(var j=0; j<boardSize.height; j++) {
            if(neighbors(i,j) < 2) destroy(lookup(board, i, j))
            if(neighbors(i,j) > 3) destroy(lookup(board, i, j))
            if(neighbors(i,j) == 3) create(i,j)
        }
    }

}

function requestBoard(cb) {
    sendRequest(new locations(), function(data) {

        var board = {}
        data.map(function(location) { 
            board[location.point.x+","+location.point.y] = location.unitId
        })

        cb(board)
    })
}

function destroy(unitId) {
    if(!unitId) return

    sendRequest(new kill(unitId))
}

function create(x, y) {
    sendRequest(new spawn(x, y), function(data) {

        units[data.unitId] = data.unitToken
    })
}




// helper methods 

function hsvToRgb(h, s, v){
    var r, g, b;

    var i = Math.floor(h * 6);
    var f = h * 6 - i;
    var p = v * (1 - s);
    var q = v * (1 - f * s);
    var t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }

    return "#" + decimalToHex(Math.floor(r * 255)) + decimalToHex(Math.floor(g * 255)) + decimalToHex(Math.floor(b * 255))
}

function decimalToHex(d, padding) {
    var hex = Number(d).toString(16);
    padding = typeof (padding) === "undefined" || padding === null ? padding = 2 : padding;

    while (hex.length < padding) {
        hex = "0" + hex;
    }

    return hex;
}


function lookup(board, x, y) {
    return board[x+","+y]
}
function set(board, x, y, obj) {
    board[x+","+y] = obj
}

function sendRequest(options, cb) {
    options.body = options.body && JSON.stringify(options.body) 

    options.headers["Content-Type"] = "application/json"
    options.headers["Content-Length"] = options.body && options.body.length || 0


    if(options.method == "GET") {
        http.request(options, result).end()
    }

    if(options.method == "DELETE") {
        http.request(options, result).end()
    }

    if(options.method == "POST") {
        var postRequest = http.request(options, result)
        postRequest.write(options.body)
        postRequest.end()
    }

    function result(res) {

        var page = ""
        res.on('data', function(chunk) { page += chunk })
        res.on('end', function() { 
            if(cb) cb(JSON.parse(page)) 
        })
    }
}




// requests

var request = function() {
    this.host = host
    this.port = port
    this.method = "GET"
    this.headers = {}
}

var state = function() {
    this.path = "/game"
}
state.prototype = new request()

var locations = function() {
    this.path = "/world/locations"
}
locations.prototype = new request()

var spawn = function(x, y)  {
    this.path = "/units"
    this.method = "POST"
    this.body = {
        requestedPoint: {x:x,y:y}, 
        unitDescription: {
            source: "http://github.com/bryceredd/gameoflife", 
            notes: "game of life", 
            name: "game of life cell", 
            kind: "human",
            color: hsvToRgb((tick/100)%1, 1, 1)
        }
    }
}
spawn.prototype = new request()

var kill = function(unitId) {
    this.path = "/units/"+unitId
    this.method = "DELETE"
    this.headers["X-Auth-Token"] = units[unitId]
}
kill.prototype = new request()



sendRequest(new state(), function(data) {
    boardSize = data.worldFieldInfo.fieldSize
    var refershInterval = data.msTickInterval

//    setInterval(function() {
        console.log('creating randomness')

        for(var i=0; i<boardSize.width * boardSize.height / 4; i++) {
            var x = Math.floor(Math.random() * boardSize.width)
            var y = Math.floor(Math.random() * boardSize.height)

            sendRequest(new spawn(x, y))
        }
//   }, 10000)

    setInterval(function() { 
        tick++
        requestBoard(function(board) { life(board) })
    }, refershInterval)

})

