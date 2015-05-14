import Search from './util/search';

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
    imageSchema:any
    gm:any;
    regex:any;
    search:any;
    _:any; // underscore.js

    constructor() {
        this.register.attributes = {
            name: 'ark-trip',
            version: '0.1.0'
        };

        this.boom = require('boom');
        this.joi = require('joi');
        this.gm = require('gm');
        this.regex = require('locators-regex');
        this._ = require('underscore');
        this.initSchemas();
        this.search = new Search();
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
        this.imageSchema = this.joi.object({
            hapi: {
                headers: {
                    'content-type': this.joi.string()
                        .regex(this.regex.imageContentType)
                        .required()
                }
            }
        }).options({allowUnknown: true}).required();

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
                    this.searchTrips(request, reply);
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

        // get a (one of optional many) picture of a particular trip
        server.route({
            method: 'GET',
            path: '/trips/{tripid}/{name}.{ext}',
            config: {
                // TODO: check auth
                auth: false,
                handler: (request, reply) => {
                    // create file name
                    var file = request.params.name + '.' + request.params.ext;

                    // get and reply file stream from database
                    reply(this.db.getPicture(request.params.tripid, file));
                },
                description: 'Get a picture of a ' +
                'particular trip by id. Could be any picture of the trip.',
                notes: 'sample call: /trips/1222123132/nameOfTheTrip-trip.jpg',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required(),
                        name: this.joi.string()
                            .required(),
                        ext: this.joi.string()
                            .required().regex(this.regex.imageExtension)
                    }
                }

            }
        });

        // update a  picture of a trip
        server.route({
            method: ['PUT', 'POST'],
            path: '/trips/{tripid}/picture',
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

                    var ext = request.payload.file.hapi.headers['content-type']
                        .match(this.regex.imageExtension);

                    // file, which will be updated
                    var filename = request.payload.nameOfTrip + '-trip.' + ext;
                    var thumbname = request.payload.nameOfTrip + '-trip-thumb.' + ext;


                    // "/i/" will be mapped to /api/vX/ from nginx
                    var url = '/i/users/' + request.params.userid + '/' + filename;
                    var thumbURL = '/i/users/' + request.params.userid + '/' + thumbname;

                    var imageLocation = {
                        picture: url,
                        thumbnail: thumbURL
                    };

                    function replySuccess() {
                        reply({
                            message: 'ok',
                            imageLocation
                        });
                    }

                    // create a read stream and crop it
                    var readStream = this.gm(request.payload.file)
                        .crop(request.payload.width
                        , request.payload.height
                        , request.payload.xCoord
                        , request.payload.yCoord)
                        .resize(200,200) // TODO: needs to be discussed
                        .stream();

                    // create a read stream and crop it
                    var thumbnailStream = this.gm(request.payload.file)
                        .crop(request.payload.width
                        , request.payload.height
                        , request.payload.xCoord
                        , request.payload.yCoord)
                        .resize(120,120) // TODO: needs to be discussed
                        .stream();

                    this.db.savePicture(request.params.tripid, filename, readStream)
                        .then(() => {
                            return this.db.savePicture(request.params.tripid, thumbname, thumbnailStream);
                        })
                        .then(() => {
                            return this.db.updateDocument(request.params.tripid, {images: imageLocation});
                        })
                        .then(replySuccess)
                        .catch((err) => {
                            return reply(this.boom.badRequest(err));
                        });

                },
                description: 'Update/Change the picture of a particular trip',
                notes: 'The picture in the database will be updated. The User defines which one.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: {
                        nameOfTrip: this.joi.string().required(),
                        // validate file type to be an image
                        file: this.joi.object({
                            hapi: {
                                headers: {
                                    'content-type': this.joi.string()
                                        .regex(this.regex.imageContentType)
                                        .required()
                                }
        // update a  picture of a trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}/picture/more',
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

                    // check first if entry exist in the database
                    this.db.entryExist(request.params.tripid, request.payload.nameOfFile)
                        .catch((err) => {
                            return reply(this.boom.badRequest(err));
                        }).then((value) => {

                            var ext = request.payload.file.hapi.headers['content-type']
                                .match(this.regex.imageExtension);

                            // file, which will be updated
                            var filename = request.payload.nameOfFile + '.' + ext;
                            var thumbname = request.payload.nameOfFile + '-thumb.' + ext;

                            // "/i/" will be mapped to /api/vX/ from nginx
                            var url = '/i/trips/' + request.params.tripid + '/' + filename;
                            var thumbURL = '/i/trips/' + request.params.tripid + '/' + thumbname;

                            var imageLocation = {
                                picture: url,
                                thumbnail: thumbURL
                            };

                            function replySuccess() {
                                reply({
                                    message: 'ok',
                                    imageLocation
                                });
                            }

                            // create a read stream and crop it
                            var readStream = this.gm(request.payload.file)
                                .crop(request.payload.width
                                , request.payload.height
                                , request.payload.xCoord
                                , request.payload.yCoord)
                                .resize(1500, 675) // TODO: needs to be discussed
                                .stream();

                            // create a read stream and crop it
                            var thumbnailStream = this.gm(request.payload.file)
                                .crop(request.payload.width
                                , request.payload.height
                                , request.payload.xCoord
                                , request.payload.yCoord)
                                .resize(120, 120) // TODO: needs to be discussed
                                .stream();

                            this.db.savePicture(request.params.tripid, filename, readStream)
                                .then(() => {
                                    return this.db.savePicture(request.params.tripid, thumbname, thumbnailStream);
                                })
                                .then(() => {
                                    return this.db.updateDocument(request.params.tripid, {images: imageLocation});
                                })
                                .then(replySuccess)
                                .catch((err) => {
                                    return reply(this.boom.badRequest(err));
                                });
                        });

                },
                description: 'Update/Change the picture of a particular trip',
                notes: 'The picture in the database will be updated. The User defines which one.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: {
                        nameOfFile: this.joi.string().min(1).required(),
                        // validate file type to be an image
                        file: this.imageSchema,
                        // validate that a correct dimension object is emitted
                        width: this.joi.number().integer().required(),
                        height: this.joi.number().integer().required(),
                        xCoord: this.joi.number().integer().required(),
                        yCoord: this.joi.number().integer().required()


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

        // create the views for couchdb
        server.route({
            method: 'POST',
            path: '/trips/setup',
            config: {
                handler: (request, reply) => {
                    this.db.createView(this.search.viewName_Search, this.search.searchList, (err, msg)=> {
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

    private searchTrips(request, reply) {
        // split by _ -> city.mood1.mood2.moodX
        var opts = request.params.opts.split(".");
        // save first parameter and remove it from list
        var city = opts.shift();
        // create query for couchdb
        var query = {
            city: (city || ""),
            moods: (opts.join('.') || ""),
            start_date: (request.query.start_date || ""),
            end_date: (request.query.end_date || ""),
            budget: (request.query.budget || ""),
            persons: (request.query.persons || ""),
            days: (request.query.days || ""),
            accommodations: (request.query.accommodations || "")
        };
        this.db.searchTripsByQuery(query, (err, data)=> {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            this._.sortBy(data, 'relevance');
            reply(data);
        });
    }
}