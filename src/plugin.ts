export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

export default
class Trip {
    db:any;
    boom:any;
    joi:any;
    tripSchemaPost:any;
    tripSchemaPUT:any;

    viewName_Search = '_design/search';

    // TODO: fix compiler errors for 'emit', 'getRow' and 'send'
    // TODO: performance measurement for relevance check
    // list for couchdb the search a trip
    searchList = {
        views: {
            city: {
                "map": function (doc) {
                    if (doc.type == 'trip') {
                        emit(doc.city, doc);
                    }
                }
            }
        },
        lists: {
            searchlist: function (head, req) {
                var RELEVANCE_CONFIG = {
                    RELEVANCE_SUM: 1,
                    RELEVANCE_MOODS: 0.4,
                    RELEVANCE_DAYS: 0.2,
                    RELEVANCE_PERSONS: 0.2,
                    RELEVANCE_BUDGET: 0.1,
                    RELEVANCE_ACCOMMODATIONS: 0.1
                };
                var row;
                var result = [];
                var queryParams = JSON.stringify(req.query);
                while (row = getRow()) {
                    // city param is required
                    if (queryParams != '{}' && (row.key == req.query.city)) {
                        var moods_relevance;
                        var possibleRelevance;
                        // status object for relevance check
                        var relevance = {
                            moods: 0,
                            budget: 0,
                            persons: 0,
                            days: 0,
                            accommodations: 0
                        };
                        // set 'toPush' variable true and set it only false, if required param like mood don't hit
                        var toPush = true;
                        if (req.query.moods) {
                            // set 'toPush' false -> don't add row to result list
                            toPush = false;
                            // object for relevance calculation of moods
                            moods_relevance = {
                                moods_sum: 0,
                                moods_hit: 0
                            };
                            // split params to get all moods
                            var moods = req.query.moods.split('_');
                            // check if trip contains requried mood
                            moods.forEach(function (mood) {
                                moods_relevance.moods_sum++;
                                if (row.value.category.indexOf(mood) > -1) {
                                    toPush = true;
                                    moods_relevance.moods_hit++;
                                }
                            });
                        }
                        // do not check date, if mood check don't successful..
                        if (toPush) {
                            if (req.query.start_date && req.query.end_date) {
                                // check date range of trip
                                if (req.query.start_date > row.value.start_date || req.query.end_date < row.value.end_date) {
                                    // don't add trip if is out of range
                                    toPush = false;
                                }
                            }
                        }
                        // if date and moods okay, check further params for relevance calculation
                        if (toPush) {
                            if (req.query.moods) {
                                possibleRelevance = RELEVANCE_CONFIG.RELEVANCE_MOODS;
                                relevance.moods = RELEVANCE_CONFIG.RELEVANCE_MOODS / moods_relevance.moods_sum * moods_relevance.moods_hit;
                            }
                            if (req.query.budget) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_BUDGET;
                                if (req.query.budget <= row.value.budget) {
                                    relevance.budget = RELEVANCE_CONFIG.RELEVANCE_BUDGET;
                                }
                            }
                            if (req.query.persons) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_PERSONS;
                                if (req.query.persons <= row.value.budget) {
                                    relevance.persons = RELEVANCE_CONFIG.RELEVANCE_BUDGET;
                                }
                            }
                            if (req.query.days) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_DAYS;
                                if (req.query.days <= row.value.days) {
                                    relevance.days = RELEVANCE_CONFIG.RELEVANCE_DAYS;
                                }
                            }
                            if (req.query.accommodations) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_ACCOMMODATIONS;
                                if (req.query.accommodations <= row.value.accommodations) {
                                    relevance.accommodations = RELEVANCE_CONFIG.RELEVANCE_ACCOMMODATIONS;
                                }
                            }

                            // relevance calculation
                            var total = 0;
                            for (var property in relevance) {
                                total += relevance[property];
                            }
                            row.value.relevance = (total * 100 / possibleRelevance);

                            // push relevant trip to result array
                            result.push(row.value);
                        }
                    }
                }

                if(req.query.limit) {
                    // TODO: sort array by relevance
                    // TODO: send only 'limit' trips
                }

                send(JSON.stringify(result))
            }
        }
    };

    constructor() {
        this.register.attributes = {
            name: 'ark-trip',
            version: '0.1.0'
        };

        this.boom = require('boom');
        this.joi = require('joi');
        this.initSchemas();
    }


    /**
     *    Init validation schemas for POST and PUT method.
     *    We need two schemas because PUT required '_id' and '_rev'.
     */
    private initSchemas():void {
        // basic trip schema
        var trip = this.joi.object().keys({
            title: this.joi.string().required(),
            // read form session
            userid: this.joi.string().optional(),
            description: this.joi.string().required(),
            city: this.joi.string().required(),
            start_date: this.joi.date(),
            end_date: this.joi.date(),
            budget: this.joi.number(),
            overnight: this.joi.number(),
            category: this.joi.string(),
            locations: this.joi.array(),
            pics: this.joi.array(),
            type: this.joi.string().required().valid('trip')
        });

        // required elements for PUT method.
        var putMethodElements = this.joi.object().keys({
            _id: this.joi.string().required(),
            _rev: this.joi.string().required()
        });

        this.tripSchemaPost = trip;
        this.tripSchemaPUT = putMethodElements.concat(trip);
    }

    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('ark-database', (server, next) => {
            this.db = server.plugins['ark-database'];
            next();
        });

        this._register(server, options);
        next();
    };

    private _register(server, options) {
        // get all trips
        server.route({
            method: 'GET',
            path: '/trips/search/{opts}',
            config: {
                auth: false,
                handler: (request, reply) => {
                    // split by _ -> city_mood1_mood2_moodX
                    var opts = request.params.opts.split("_");
                    // save first parameter and remove it from list
                    var city = opts.shift();
                    // create query for couchdb
                    var query = {
                        city: (city || ""),
                        moods: (opts.join('_') || ""),
                        start_date: (request.query.start_date || ""),
                        end_date: (request.query.end_date || ""),
                        budget: (request.query.budget || ""),
                        persons: (request.query.persons || ""),
                        days: (request.query.days || ""),
                        accommodations: (request.query.accommodations || "")
                    };
                    console.log(query);
                    this.db.searchTripsByQuery(query, (err, data)=> {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Search for trips',
                notes: 'Search functionality  is not supported with swagger',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        opts: this.joi.string()
                            .required().description('city_mood1_mood2_moodX')
                    }
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/trips',
            config: {
                auth: false,
                handler: (request, reply) => {
                    this.db.getTrips((err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Get all trips',
                tags: ['api', 'trip']
            }
        });

        // get a particular trip
        server.route({
            method: 'GET',
            path: '/trips/{tripid}',
            config: {
                auth: false,
                handler: (request, reply) => {
                    this.db.getTripById(request.params.tripid, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Get particular trip by id',
                notes: 'sample call: /trips/1222123132',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    }
                }

            }
        });

        // create a new trip
        server.route({
            method: 'POST',
            path: '/trips',
            config: {
                handler: (request, reply) => {
                    // TODO: read user id from session and create trip with this info
                    this.db.createTrip(request.payload, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Create new trip',
                tags: ['api', 'trip'],
                validate: {
                    payload: this.tripSchemaPost
                        .required()
                        .description('Trip JSON object')
                }

            }
        });

        // create the views for couchdb
        server.route({
            method: 'POST',
            path: '/trips/setup',
            config: {
                handler: (request, reply) => {
                    this.db.createView(this.viewName_Search, this.searchList, (err, msg)=> {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        } else {
                            reply(msg);
                        }
                    });
                },
                description: 'Setup all views and lists for couchdb',
                tags: ['api', 'trip']
            }
        });

        // update a particular trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}',
            config: {
                handler: (request, reply) => {
                    this.db.updateTrip(request.payload._id, request.payload._rev, request.payload, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Update particular trip',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: this.tripSchemaPUT
                        .required()
                        .description('Trip JSON object')
                }

            }
        });


        // delete a particular trip
        server.route({
            method: 'DELETE',
            path: '/trips/{tripid}',
            config: {
                handler: (request, reply) => {
                    this.db.deleteTripById(request.params.tripid, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'delete a particular trip',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    }
                }
            }
        });

        // Register
        return 'register';
    }
}