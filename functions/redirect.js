var https = require('https');
var bmob = require('./bmob');

function getUrl (slink, callback) {

    let siteId = process.env.site_for_use || "";

    https.get(`https://${siteId}/slinkcon/mbed/${slink}`, function (res) {
        res.setEncoding('utf-8');
        let html = "";
        res.on('data', function(data) {
            html += data;
        });
        res.on('end', function() {
            try {
                let data = JSON.parse(html);
                data = JSON.parse(data.data);
                if (data && data.lid) {
                    bmob.retrieveURL(data.lid, callback);
                } else {callback(null);}
            } catch (error) {
                callback(null);
            }
        });
    });
}

exports.handler = function (event, context, callback) {

    let slink = event.queryStringParameters.slink || "";
    getUrl(slink, url => {
        callback(null, {
            statusCode: 302,
            headers: { "Location": url || "https://error.yuuno.cc" },
            body: ""
        });
    });

}
