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

        // get preview picture of a particular trip
        server.route({
            method: 'GET',
            path: '/trips/{tripid}/{name}-trip.{ext}',
            config: {
                // TODO: check auth
                auth: false,
                handler: (request, reply) => {
                    // create file name
                    var file = request.params.name + '-trip.' + request.params.ext;

                    // get file stream from database
                    this.db.getPicture(request.params.tripid, file, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        // reply stream
                        reply(data)
                    });
                },
                description: 'Get the preview picture of a ' +
                'particular trip by id',
                notes: 'sample call: /trips/1222123132/nameOfTheTrip-trip.jpg',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required(),
                        name: this.joi.string()
                            .required(),
                        ext: this.joi.string()
                            .required().regex(/^jpg|png$/)
                    }
                }

            }
        });

        // update a  picture of a trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}/{name}.{ext}',
            config: {
                // TODO check auth
                auth: false,
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    // TODO: evaluate real value
                    maxBytes: 1000000000000
                },
                handler: (request, reply) => {
                    var width = request.payload.width;
                    var height = request.payload.height;
                    var xCoord = request.payload.xCoord;
                    var yCoord = request.payload.yCoord;

                    var attachmentData = {
                        name: request.payload.filename, // file, which will be overwritten
                        'Content-Type': 'multipart/form-data'
                    };

                    // create a read stream
                    var readStream = request.payload.file;

                },
                description: 'Update/Change the picture of a particular trip',
                note: 'The picture in the database will be updated. The User defines which one',
                tags: ['api', 'trip'],
                validate: {
                    tripid: this.joi.string()
                        .required(),
                    name: this.joi.string()
                        .required(),
                    ext: this.joi.string()
                        .required().regex(/^jpg|png$/),
                    payload: {
                        filename: this.joi.string().required()

                    }
                }
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
}