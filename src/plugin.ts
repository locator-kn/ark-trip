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
            // TODO: city or plz? optional or required? url ok?
            path: '/trips/search/{opt?}',
            config: {
                auth: false,
                handler: (request, reply) => {
                    this.searchTrips(request, (err, data) => {
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

    // search handler
    private searchTrips(request, callback) {
        if (request.params.opt) {
            // split by _ -> city_mood1_mood2_moodX
            var opts = request.params.opt.split("_");
            // check if city param is committed.
            if (opts[0]) {
                // save first parameter and remove it from array
                var city = opts.shift();
                var query = {
                    startkey: [city, (request.query.checkin || "")],
                    endkey: [city, (request.query.checkout || {})]
                };
                this.db.getTripsByCityQuery(query, (err, data) => {
                    if (err) {
                        callback(err);
                    } else {
                        this.restrictSearchByMoods(data, opts, callback);
                    }
                });
            } else {
                this.db.getTrips((err, data) => {
                    if (err) {
                        callback(err);
                    } else {
                        this.restrictSearchByMoods(data, opts, callback);
                    }
                })
            }
        } else {
            // if no city and no mood committed
            this.db.getTrips(callback);
        }
    }

    private restrictSearchByMoods(data, opts, callback) {
        // check if moods committed
        if (opts.length > 0) {
            var elements = [];
            data.forEach((element)=> {
                // to save no duplicated elements
                var toPush = false;
                opts.forEach((mood)=> {
                    // check if element contains a required mood
                    if (element.category.indexOf(mood) > -1) {
                        toPush = true;
                        // TODO: break each -> currently only one match of a category required
                    }
                });
                if (toPush) {
                    elements.push(element);
                }
            });
            callback(null, elements);
        } else {
            callback(null, data);
        }
    }

}