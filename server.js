
const PATH = require("path");
const FS = require("fs");
//const MONGODB = require('mongodb');
const REQUEST = require("request");
const WAITFOR = require("waitfor");


var pioConfig = JSON.parse(FS.readFileSync(PATH.join(__dirname, "../.pio.json"), "utf8"));


var config = FS.readFileSync(PATH.join(__dirname, "config", "default.tpl.yaml"), "utf8");
config = config.replace(/%PORT%/g, process.env.PORT);
FS.writeFileSync(PATH.join(__dirname, "config", "default.yaml"), config, "utf8");
// NOTE: Config is taken from `./config/*`.


/*
MONGODB.MongoClient.connect('mongodb://127.0.0.1:27017/uptime', function(err, db) {
	console.log("err", err);
//	console.log("db", db);
	db.close();
});
*/

// Start server.
require("./project/app");




// Configure uptime.

function ensureChecks(callback) {

	var url = "http://127.0.0.1:" + process.env.PORT + "/api/checks";

console.log("url", url);

	return REQUEST(url, function (err, res, body) {
		if (err) return callback(err);

		var existingChecks = {};

		JSON.parse(body).forEach(function (check) {
			existingChecks[check.name] = check;
		});

console.log("existingChecks", existingChecks);

		function ensureChecksProvisioned(serviceId, callback) {

			function ensureCheckProvisioned(checkId, callback) {

				var id = pioConfig['config']['pio'].hostname + "~" + serviceId + "~" + checkId

console.log("Ensure check '" + id + "' is provisioned for service '" + serviceId + "':", pioConfig['config.plugin'][serviceId].checks[checkId]);

				var url = "http://127.0.0.1:" + process.env.PORT + "/api/checks";

				var checkConfig = pioConfig['config.plugin'][serviceId].checks[checkId];
				if (checkConfig.name) {
					return callback(new Error("'name' may NOT be set for checks config '" + checkId + "' for service: " + serviceId));
				}
				checkConfig.name = id;

				if (!checkConfig.url) {
					return callback(new Error("'url' must be set for checks config '" + checkId + "' for service: " + serviceId));
				}

				/*
				@see https://github.com/pinf-io/github.com_fzaninotto_uptime#put-checks
				interval : (optional) Interval of polling
				maxTime : (optional) Slow threshold
				isPaused : (optional) Status of polling
				alertTreshold : (optional) set the threshold of failed pings that will create an alert
				tags : (optional) list of tags (comma-separated values)
				type : (optional) type of check (auto|http|https|udp)
				*/

				console.log("url", url, checkConfig);

				var method = null;
				if (existingChecks[id]) {
					console.log("Update check:", id);

					method = "POST";
					checkConfig.id = existingChecks[id]._id;
					url += "/" + checkConfig.id;
				} else {
					console.log("Creating check:", id);

					method = "PUT";
				}

console.log("url", url);

				return REQUEST({
					method: method,
					url: url,
					body: checkConfig,
					json: true
				}, function (err, res, body) {
					if (err) return callback(err);

console.log("Check created/updated", body);

					return callback(null);
				});
			}

			var waitfor = WAITFOR.serial(callback);
			for (var checkId in pioConfig['config.plugin'][serviceId].checks) {
				waitfor(checkId, ensureCheckProvisioned);
			}
			return waitfor();
		}

		var waitfor = WAITFOR.serial(callback);
		for (var serviceId in pioConfig['config.plugin']) {
			waitfor(serviceId, ensureChecksProvisioned);
		}
		return waitfor();
	});

}

setTimeout(function () {

	ensureChecks(function (err) {
		if (err) {
			console.error("Error ensuring checks", err.stack);
		}
	});

}, 2 * 1000);
