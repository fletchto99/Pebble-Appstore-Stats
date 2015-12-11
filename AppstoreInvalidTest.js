var request = require('request');

//Settings
//var mainURL = 'https://api2.getpebble.com/v2/apps/collection/all/watchfaces?limit=100'; //watchfaces
var mainURL = 'https://api2.getpebble.com/v2/apps/collection/all/watchapps-and-companions?limit=100';
var hardware = 'chalk';
var filterhardware = false;

var offset = 0;
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
                if (!pbw.latest_release && pbw.companions.ios == null && pbw.companions.android == null) {
                    pbws.push(pbw);
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

getAllPBWs(mainURL + (filterhardware ? ('&filter_hardware=true&hardware=' + hardware) : ''), function (pbws) {
    console.log(pbws.length + ' invalid pbws');
    pbws.forEach(function(pbw) {
        console.log(pbw.title + ' ' + pbw.id);
    })
});
