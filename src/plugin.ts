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
                var row;
                var result = [];
                var queryParams = JSON.stringify(req.query);
                while (row = getRow()) {
                    if (queryParams != '{}' && (row.key == req.query.city)) {
                        if (!req.query.start_date || !req.query.end_date) {
                            result.push(row.value);
                        } else {
                            if (req.query.start_date <= row.value.start_date && req.query.end_date >= row.value.end_date) {
                                result.push(row.value);
                            } else {
                                result.push('huhu');
                            }
                        }
                    }
                }
                send(JSON.stringify(result))
            }
        }
    };

    private RELEVANCE_CONFIG = {
        RELEVANCE_SUM: 1,
        RELEVANCE_MOODS: 0.4,
        RELEVANCE_DAYS: 0.2,
        RELEVANCE_PERSONS: 0.2,
        RELEVANCE_BUDGET: 0.1,
        RELEVANCE_ACCOMMODATIONS: 0.1
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

                    var query = {
                        city: (request.query.city || ""),
                        start_date: (request.query.start_date || ""),
                        end_date: (request.query.end_date || "")
                    };
                    this.db.searchTripsByQuery(query, (err, data)=> {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        reply(data);
                    });
                },
                description: 'Search for trips',
                notes: 'Search functionality is not supported with swagger',
                tags: ['api', 'trip']
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

        // create a new trip
        server.route({
            method: 'POST',
            path: '/trips/setup',
            config: {
                auth: false,
                handler: (request, reply) => {
                    this.db.createView('_design/search', this.searchList , (err)=> {
                        reply(err);
                    });
                },
                description: 'Create new trip',
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