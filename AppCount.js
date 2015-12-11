var request = require('request');
var unzip = require('unzip');

//Settings
//var mainURL = 'https://api2.getpebble.com/v2/apps/collection/all/watchfaces?limit=100'; //watchfaces
var mainURL = 'https://api2.getpebble.com/v2/apps/collection/all/watchapps-and-companions?limit=100';
var hardware = 'basalt';
var filterhardware = true;
var MAX_QUEUE = 30;


//Vars
var offset = 0;
var pebbleJS = 0;
var error = 0;
var analyzed = 0;
var skipped = 0;
var someJS = 0;

function getAllPBWs(url, callback, pbws) {
    if (!pbws) {
        pbws = [];
    }
    request.get({
        url: url,
        json: true
    }, function (error, response, body) {
        if (body.data && body.data.length > 0) {
            body.data.forEach(function (pbw) {
                if (pbw.latest_release && pbw.latest_release.pbw_file) {
                    pbws.push(pbw.latest_release.pbw_file);
                } else {
                    skipped++;
                }
            });
            console.log('Now analyzing offset ' + offset++);
            if (body.links.nextPage) {
                getAllPBWs(body.links.nextPage, callback, pbws);
            } else {
                callback(pbws);
            }
        }
    });
}

var queue = 0;

function printResults(pbws, index) {
    if (!index) {
        index = 0;
    }
    if (index < pbws.length) {
        if (pbws[index]) {
            var addToQueue = function() {
                queue++;
                var fetch = function (retry) {
                    var err = false;

                    var fail = function () {
                        err = true;
                        if (!retry) {
                            retry = 0;
                        }
                        if (retry < 5) {
                            fetch(retry + 1);
                        } else {
                            error++;
                            analyzed++;
                            queue--;
                        }
                    };

                    request(pbws[index]).on('error', function () {
                        fail();
                    }).pipe(unzip.Parse().on('error', function () {
                        fail();
                    })).on('entry', function (entry) {
                        var fileName = entry.path;
                        if (!err && fileName === "pebble-js-app.js") {
                            someJS++;
                            var result = '';
                            entry.on('readable', function () {
                                var chunk;
                                while ((chunk = entry.read()) != null) {
                                    result += chunk;
                                }
                            }).on('end', function () {
                                if (result.indexOf('simply-pebble.js') > 0) {
                                    pebbleJS++;
                                }
                                entry.autodrain(); //free up the entry's memory
                            });
                        } else {
                            entry.autodrain();
                        }
                    }).on('finish', function () {
                        if (!err) {
                            analyzed++;
                            queue--;
                        }
                    });
                };
                fetch();
            };
        } else {
            error++;
            analyzed++;
        }

        var checkQueue = function() {
            if (queue < MAX_QUEUE) {
                addToQueue();
            } else {
                setTimeout(checkQueue, 500);
            }
        };

        checkQueue();
        printResults(pbws, index + 1);
    } else {
        var done = function () {
            setTimeout(function () {
                if (analyzed >= pbws.length) {
                    displayResults();
                    process.exit(0);
                } else {
                    console.log(analyzed + ' analyzed out of ' + pbws.length);
                    done();
                }
            }, 5000);
        };
        done();
    }
}

getAllPBWs(mainURL + (filterhardware ? ('&filter_hardware=true&hardware=' + hardware) : ''), function (pbws) {
    printResults(pbws);
});

function displayResults() {
    console.log('There are ' + pebbleJS + ' PebbleJS pbws');
    console.log('There are ' + someJS + ' pbws using some JS');
    console.log('Out of ' + analyzed + ' pbws analyzed');
    console.log();
    console.log('Note: ' + error + ' pbws failed analysis');
    console.log('Note: ' + skipped + ' apps were skipped because they do not have a PBW');
}

process.on('SIGINT', function () {
    displayResults();
    process.exit();
});