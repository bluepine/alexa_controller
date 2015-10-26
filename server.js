var PORT = 5000
var LIST_SIZE = 5
var CONTENT_API_BASE = 'http://compositor.api.cnn.com/svc/mcs/v3/search/collection1/type:article/'

/////////////config ends
var Hapi = require('hapi');

var LIST_STACK = []
var ARTICLE_STACK = []

var SET = require("collections/set");
var ARTICLE_BLACKLIST_SET = SET()

var server = new Hapi.Server();
server.connection({
	port: PORT
});
//server.connection({ port: process.env.PORT, host: process.env.IP});

var endPoints = {
	"articlelistontopic": "https://alexaserver-noyda.c9.io/articlelistontopic/{0}/start/{1}/length/{2}",
	"articledetail": "https://alexaserver-noyda.c9.io/articledetail/keyword/{0}"
};

function log(text){
	console.log(text)
}

server.route({
	method: 'GET',
	path: '/reset',
	handler: function(request, reply) {
		LIST_STACK = []
		ARTICLE_STACK = []
		ARTICLE_BLACKLIST_SET.clear()
		reply('');
	}
});

/*
	articlelistontopic/politics #we can use the same API articlelistontopic/politic
	to retrieve a new list every time.
*/
server.route({
	method: 'GET',
	path: '/articlelist/topic/{keyword}/{date?}',
	handler: function(request, reply) {
		var keyword =  request.params.keyword
		var date = request.params.date
		log('/articlelist/topic/' + keyword + ' date: ' + date)
		reply('');
	}
});

server.route({
	method: 'GET',
	path: '/articlelist/{date?}',
	handler: function(request, reply) {
		var keyword =  request.params.keyword
		log('/articlelist' + keyword)
	}
});


/*
	articledetail/keyword/oklahoma #this API assumes the current list exists and
	is stored in the backend. otherwise it returns empty result 
*/
server.route({
	method: 'GET',
	path: '/articledetail/keyword/{keyword}',
	handler: function(request, reply) {
			var keyword = request.params.keyword;
			log('/articledetail/keyword' + keyword)
	}
});

/*
	articledetail/number/2 #this API assumes the current list exists and is
	stored in the backend. otherwise it returns empty result 
*/
server.route({
	method: 'GET',
	path: '/articledetail/number/{number}',
	handler: function(request, reply) {
		var number = request.params.number
		log('/articledetail/number/'+number)
	}
});

server.start(function() {
	console.log('Server running at:', server.info.uri);
});
