var Hapi = require('hapi');
var https = require('https');
var strformat = require('strformat');

var server = new Hapi.Server();
server.connection({ port: 4000 });
//server.connection({ port: process.env.PORT, host: process.env.IP});

var endPoints = {
	"articlelistontopic" : "https://alexaserver-noyda.c9.io/articlelistontopic/{0}/start/{1}/length/{2}",
	"articledetail" : "https://alexaserver-noyda.c9.io/articledetail/keyword/{0}"
};

var sessionData = {};

server.route({
	method: 'GET',
	path: '/',
	handler: function (request, reply) {
		sessionData = {};
		reply('Welcome Alexa!');
	}
});

server.route({
	method: 'GET',
	path: '/articlelistontopic/{topic}',
	handler: function (request, reply) {
		var currentSession = {};
		if (sessionData.sessionInfo) {
			currentSession = sessionData.sessionInfo;
			currentSession.start = currentSession.start + currentSession.length;
		} else {
			currentSession.topic = request.params.topic;
			currentSession.start = 0;
			currentSession.length = 1;
		}
		console.log('Query /articlelistontopic/' + currentSession.topic);
		try {
			var url = strformat(endPoints.articlelistontopic, currentSession.topic, currentSession.start, currentSession.length);
			var req = https.get(url);
			req.on('response', function (response) {
				sessionData.sessionInfo = currentSession;
				sessionData.response = response;
				console.log(sessionData.sessionInfo.start.toString());
				reply(response);
			});
		} catch (e) {
			console.log(e.message());
		}
	}
});

server.route({
	method: 'GET',
	path: '/articledetail/keyword/{keyword}',
	handler: function (request, reply) {
		var keyword = request.params.keyword;
		console.log("Query /articledetail/keyword/" + keyword);
		try {
			var url = strformat(endPoints.articledetail, keyword);
			var req = https.get(url);
			req.on('response', function (response) {
				reply(response);
			});
		} catch (e) {
			console.log(e.message());
		}
	}
});

server.start(function () {
	console.log('Server running at:', server.info.uri);
});
