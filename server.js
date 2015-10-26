//var PORT = 5000
var LIST_SIZE = 5
var CONTENT_API_BASE = 'http://compositor.api.cnn.com/svc/mcs/v3/search/collection1/type:article/'
var NO_MATCH_RESPONSE = 'NOTMATCH'
var EMPTY_RESULT_RESPONSE = ''
var ERROR_RESULT_RESPONSE = 'ERROR'
var DETAIL_SIZE_LIMIT = 1500
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
var LAST_LIST_QUERY = null

function getHeadlineList(query, callback) {
	log('LAST_LIST_QUERY:' + LAST_LIST_QUERY)
	log('query'+query)
	if (LAST_LIST_QUERY == null) {
		LAST_LIST_QUERY = query
		CURRENT_LIST_OFFSET = 0
	}
	else {
		if (LAST_LIST_QUERY == query) {
			CURRENT_LIST_OFFSET += LIST_SIZE
		}
		else {
			CURRENT_LIST_OFFSET = 0
			LAST_LIST_QUERY = query
		}
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
		reply(EMPTY_RESULT_RESPONSE);
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



function search_headline_list(list, keyword) {
	var arrayLength = list.length;
	for (var i = 0; i < arrayLength; i++) {
		var item = list[i]
		if (item.headline.toLowerCase().indexOf(keyword.toLowerCase()) != -1) {
			return item.url
		}
	}
	return null
}

function url_q(url) {
	return 'url:' + encodeURIComponent(url) + '/'
}


function getDetails(body) {
	if (!body || !body.docs || !body.docs[0] || !body.docs[0].body || !body.docs[0].body.paragraphs) {
		return null
	}
	else {
		var paragraphs = body.docs[0].body.paragraphs
		var ret = ''
		var paragraphs_num = paragraphs.length
		for (var i = 0; i < paragraphs_num; i++) {
			ret += paragraphs[i].plaintext
			if (ret.length >= DETAIL_SIZE_LIMIT) {
				return ret
			}
		}
		return ret
	}
	return null
}

function getArticle(url, callback, donotpush) {
	var query = url_q(url)
	query = CONTENT_API_BASE + query
	httpGet(query)
		.then(function(body) {
			if (body) {
				body = JSON.parse(body)
				var detail = getDetails(body)
				if (detail) {
					if (!donotpush) {
						ARTICLE_STACK.push(url)
					}
					callback({
						'url': url,
						'headline': body.docs[0].headline,
						'body': detail
					})
				}
				else {
					callback(null)
				}
			}
			else {
				callback(null)
			}
		})
		.catch(function(error) {
			callback(null)
		})
		.done()
}
/*
	articledetail/keyword/oklahoma #this API assumes the current list exists and
	is stored in the backend. otherwise it returns empty result 
*/
server.route({
	method: 'GET',
	path: '/articledetail/keyword/{keyword}',
	handler: function(request, reply) {
		var keyword = request.params.keyword;
		log('/articledetail/keyword/' + keyword)
		var list = _.last(LIST_STACK)
		if (list) {
			var url = search_headline_list(list, keyword)
			if (url) {
				getArticle(url, function(detail) {
					if (detail) {
						reply(detail)
					}
					else {
						reply(ERROR_RESULT_RESPONSE)
					}
				})
			}
			else {
				reply(NO_MATCH_RESPONSE)
			}
		}
		else {
			reply(EMPTY_RESULT_RESPONSE)
		}
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
		var list = _.last(LIST_STACK)
		if (list) {
			if(number > list.length){
				reply(NO_MATCH_RESPONSE)
				return
			}
			var url = list[number - 1].url
			if (url) {
				getArticle(url, function(detail) {
					if (detail) {
						reply(detail)
					}
					else {
						reply(ERROR_RESULT_RESPONSE)
					}
				})
			}
			else {
				reply(NO_MATCH_RESPONSE)
			}
		}
		else {
			reply(EMPTY_RESULT_RESPONSE)
		}
	}
});


server.route({
	method: 'GET',
	path: '/currentarticle',
	handler: function(request, reply) {
		log('/currentarticle')
		var url = _.last(ARTICLE_STACK)
		if (url) {
			getArticle(url, function(detail) {
				if (detail) {
					reply(detail)
				}
				else {
					reply(ERROR_RESULT_RESPONSE)
				}
			})
		}
		else {
			reply(EMPTY_RESULT_RESPONSE)
		}
	}
});

server.route({
	method: 'GET',
	path: '/currentlist',
	handler: function(request, reply) {
		log('/currentlist')
		var list = _.last(LIST_STACK)
		if (list) {
			reply(JSON.stringify(list));
		}
		else {
			reply(EMPTY_RESULT_RESPONSE)
		}
	}
});



server.route({
	method: 'GET',
	path: '/previousarticle',
	handler: function(request, reply) {
		log('/previousarticle')
		if (!ARTICLE_STACK || ARTICLE_STACK.length == 1) {
			reply(EMPTY_RESULT_RESPONSE)
			return
		}
		log(ARTICLE_STACK)
		var url = ARTICLE_STACK.pop()
		if (url) {
			getArticle(url, function(detail) {
				if (detail) {
					reply(detail)
				}
				else {
					reply(ERROR_RESULT_RESPONSE)
				}
			}, true)
		}
		else {
			reply(EMPTY_RESULT_RESPONSE)
		}
	}
});

server.route({
	method: 'GET',
	path: '/previouslist',
	handler: function(request, reply) {
		log('/previouslist')
		if (!LIST_STACK || LIST_STACK.length == 1) {
			reply(EMPTY_RESULT_RESPONSE)
			return
		}
		var list = LIST_STACK.pop()
		if (list) {
			reply(JSON.stringify(list));
		}
		else {
			reply(EMPTY_RESULT_RESPONSE)
		}
	}
});

server.start(function() {
	console.log('Server running at:', server.info.uri);
});
