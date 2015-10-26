//var PORT = 5000
var LIST_SIZE = 5
var CONTENT_API_BASE = 'http://compositor.api.cnn.com/svc/mcs/v3/search/collection1/type:article/'

/////////////config ends
var Hapi = require('hapi');
var Q = require('q')
var R = require('request')
var SET = require("collections/set");
var _ = require('lodash')
	// headline object: {headline:..., url:...} 
var LIST_STACK = []
var ARTICLE_STACK = []


var ARTICLE_BLACKLIST_SET = SET()

var server = new Hapi.Server();
server.connection({
	port: process.env.PORT,
	host: process.env.IP
});


function log(text) {
	console.log(text)
}

var SECTION_SET = SET(['sport', 'business', 'health', 'tech', 'entertainment', 'living', 'travel', 'politics', 'world', 'us', 'style', 'china', 'asia', 'middleeast', 'africa', 'europe', 'americas'])

function topic_q(topic) {
	var ret
	if (SECTION_SET.has(topic)) {
		ret = 'section:' + topic + '/'
	}
	else {
		ret = 'headline:' + topic + '/'
	}
	return ret
}

function offset_q(offset) {
	return 'rows:5/start:' + offset + '/'
}

var httpGet = function(url) {
	log(url)
	var deferred = Q.defer();
	R(url, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			deferred.resolve(body)
		}
		else {
			deferred.resolve(null)
		}
	})
	return deferred.promise;
}

function build_headline_list(body) {
	var json = JSON.parse(body)
	if (!json.docs) {
		return null
	}
	var ret = _.reduce(json.docs, function(result, item) {
		result.push({
			'url': item.url,
			'headline': item.headline
		})
		return result
	}, [])
	return ret
}

var CURRENT_LIST_OFFSET = 0
var LAST_LIST_QUERY

function getHeadlineList(query, callback) {
	if (LAST_LIST_QUERY == query) {
		CURRENT_LIST_OFFSET += LIST_SIZE
	}
	else {
		CURRENT_LIST_OFFSET = 0
		LAST_LIST_QUERY = null
	}
	query = offset_q(CURRENT_LIST_OFFSET) + query
	httpGet(CONTENT_API_BASE + query)
		.then(function(body) {
			var headline_list = build_headline_list(body)
			if (headline_list) {
				LIST_STACK.push(headline_list)
			}
			else {
				log('empty result')
				headline_list = null
			}
			callback(headline_list)
		})
		.catch(function(error) {
			callback(null)
		})
		.done()

}
server.route({
	method: 'GET',
	path: '/reset',
	handler: function(request, reply) {
		LIST_STACK = []
		ARTICLE_STACK = []
		ARTICLE_BLACKLIST_SET.clear()
		log('/reset')
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
		var keyword = request.params.keyword
		var date = request.params.date
		log('/articlelist/topic/' + keyword + ' date: ' + date)
		var query = topic_q(keyword)
		if (date) {
			query += date + '/'
		}
		getHeadlineList(query, function(list) {
			reply(JSON.stringify(list));
		})

	}
});

server.route({
	method: 'GET',
	path: '/articlelist/{date?}',
	handler: function(request, reply) {
		log('/articlelist')
				var date = request.params.date
		var query = ''
		if (date) {
			query += date + '/'
		}
		getHeadlineList(query, function(list) {
			reply(JSON.stringify(list));
		})

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
})

/*
	articledetail/number/2 #this API assumes the current list exists and is
	stored in the backend. otherwise it returns empty result 
*/
server.route({
	method: 'GET',
	path: '/articledetail/number/{number}',
	handler: function(request, reply) {
		var number = request.params.number
		log('/articledetail/number/' + number)
	}
});

server.start(function() {
	console.log('Server running at:', server.info.uri);
});
