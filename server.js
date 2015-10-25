var Hapi = require('hapi');
var https = require('https');
var strformat = require('strformat');
var jp = require('jsonpath');

var server = new Hapi.Server();
server.connection({ port: 4000 });
//server.connection({ port: process.env.PORT, host: process.env.IP});

var endPoints = {
	"articlelistontopic" : "https://alexaserver-noyda.c9.io/articlelistontopic/{0}/start/{1}/length/{2}",
	"articledetail" : "https://alexaserver-noyda.c9.io/articledetail/keyword/{0}"
};

// Only one user for this demo. Adding fake sessionId1
var sessionData = {'sessionId1' : {'articlelistontopic' : [], 'articledetail' : []}};

server.route({
	method: 'GET',
	path: '/',
	handler: function (request, reply) {
		sessionData = {'sessionId1' : {'articlelistontopic' : [], 'articledetail' : []}};
		reply('Welcome Alexa!');
	}
});

/*
	articlelistontopic/politics #we can use the same API articlelistontopic/politic
	to retrieve a new list every time.
*/
server.route({
	method: 'GET',
	path: '/articlelistontopic/{keyword}',
	handler: function (request, reply) {
		var currentSession = getSessionState(request, 'articlelistontopic');
		console.log('apiFunction /articlelistontopic/' + currentSession.keyword);
		var url = strformat(endPoints.articlelistontopic, currentSession.keyword, currentSession.start, currentSession.length);
		try {
			var req = https.get(url);
			req.on('response', function (response) {
				var body = '';
				response.on('data', function(d) {
					body += d;
				});
				response.on('end', function () {
					var jsonRes = JSON.parse(body);
					saveSessionState(currentSession, 'articlelistontopic', jsonRes);
				});
				reply(response);
			});
		} catch (e) {
			console.log(e.message());
			reply('Sorry Alexa');
		}
	}
});

/*
	articledetail/keyword/oklahoma #this API assumes the current list exists and
	is stored in the backend. otherwise it returns empty result 
*/
server.route({
	method: 'GET',
	path: '/articledetail/keyword/{keyword}',
	handler: function (request, reply) {
		try {
			var keyword = request.params.keyword;
			var currentSession = getSessionState(request, 'articledetail');
			var previewSession = getSession(request);
			var articleList = [];
			if (previewSession.articlelistontopic && previewSession.articlelistontopic.length > 0) {
				articleList = {'articles': previewSession.articlelistontopic[0].response};
			}
			var result = jp.query(articleList, '$..articles[?(@.title.toLowerCase().indexOf("' + keyword + '") > -1)]');
			saveSessionState(currentSession, 'articledetail', result[0]);
			reply(result[0]);
		} catch (e) {
			console.log(e.message());
			reply('Sorry Alexa');
		}

	}
});

/*
	articledetail/number/2 #this API assumes the current list exists and is
	stored in the backend. otherwise it returns empty result 
*/
server.route({
	method: 'GET',
	path: '/articledetail/number/{number}',
	handler: function (request, reply) {
		try {
			var currentSession = getSessionState(request, 'articledetailNumber');
			var previewSession = getSession(request);
			var articleList = [];
			if (previewSession.articlelistontopic && previewSession.articlelistontopic.length > 0) {
				articleList = {'articles': previewSession.articlelistontopic[0].response};
			}
			var result = jp.query(articleList, '$..articles[' + currentSession.number + ']');
			saveSessionState(currentSession, 'articledetail', result);
			reply(result);
		} catch (e) {
			console.log(e.message());
			reply('Sorry Alexa');
		}
	}
});

function getSession(request) {
	var sessionId = (request.params.sessionId)?request.params.sessionId:'sessionId1';
	return sessionData[sessionId];
}

function getSessionState(request, apiFunction) {
	var currentSession = {};
	currentSession.id = (request.params.sessionId)?request.params.sessionId:'sessionId1';
	var session = sessionData[currentSession.id];
	switch (apiFunction) {
		case 'articlelistontopic':
			if (session.articlelistontopic && session.articlelistontopic.length > 0) {
				previousSession = session.articlelistontopic[0].sessionInfo;
				currentSession.keyword = previousSession.keyword;
				currentSession.start = (previousSession.start)?previousSession.start:1;
				currentSession.length = (previousSession.length)?previousSession.length:1;
				currentSession.start = currentSession.start + currentSession.length;
			} else {
				currentSession.keyword = request.params.keyword;
				currentSession.start = 1;
				currentSession.length = 1;
			}
			console.log('currentSession keyword: ' + currentSession.keyword + ' start= ' + currentSession.start + ' length= ' + currentSession.length);
			break;
		case 'articledetail':
			currentSession.keyword = request.params.keyword;
			console.log('currentSession keyword: ' + currentSession.keyword);
			break;
		case 'articledetailNumber':
			currentSession.number = parseInt(request.params.number) - 1;
			console.log('currentSession number: ' + currentSession.number);
			break;
	}
	return currentSession;
}

function saveSessionState(currentSession, apiFunction, response) {
	var session = sessionData[currentSession.id];
	switch (apiFunction) {
		case 'articlelistontopic':
			session.articlelistontopic.unshift({'sessionInfo' : currentSession, 'response' : response});
			break;
		case 'articledetail':
			session.articledetail.unshift({'sessionInfo' : currentSession, 'response' : response});
			break;
		default:
	}
	console.log(sessionData);
}

server.start(function () {
	console.log('Server running at:', server.info.uri);
});
