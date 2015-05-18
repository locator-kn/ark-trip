import Search from './util/search';
import Schema from './util/schema';

export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

export default
class Trip {
    db:any;
    boom:any;
    joi:any;
    gm:any;
    search:any;
    _:any; // underscore.js
    schema:any;

    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.boom = require('boom');
        this.joi = require('joi');
        this.gm = require('gm');
        this._ = require('underscore');
        this.schema = new Schema();
        this.search = new Search();
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
                handler: this.searchTrips,
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
                handler: this.getTrips,
                description: 'Get all trips',
                tags: ['api', 'trip']
            }
        });

        // get a (one of optional many) picture of a particular trip
        server.route({
            method: 'GET',
            path: '/trips/{tripid}/{name}.{ext}',
            config: {
                auth: false,
                handler: (request, reply) => {
                    // create file name
                    var file = request.params.name + '.' + request.params.ext;

                    // get and reply file stream from database
                    reply(this.db.getPicture(request.params.tripid, file));
                },
                description: 'Get a picture of a ' +
                'particular trip by id. Could be any picture of the trip.',
                notes: 'sample call: /trips/1222123132/nameOfTheTrip-trip.jpg. The url is found, when a ' +
                'trip is requested with GET /trips/:tripId',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required(),
                        name: this.joi.string()
                            .required(),
                        ext: this.joi.string()
                            .required().regex(this.schema.regex.imageExtension)
                    }
                }

            }
        });

        // update/create the main picture of a trip
        server.route({
            method: ['PUT', 'POST'],
            path: '/trips/{tripid}/picture',
            config: {
                auth: false,
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    // TODO: evaluate real value
                    maxBytes: 1000000000000
                },
                handler: this.savePicture,
                description: 'Update/Change the main picture of a particular trip',
                notes: 'The picture in the database will be updated. The User defines which one.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: this.schema.imageSchemaPost
                }
            }
        });

        // create a picture of a trip
        server.route({
            method: 'POST',
            path: '/trips/{tripid}/picture/more',
            config: {
                auth: false,
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    // TODO: evaluate real value
                    maxBytes: 1000000000000
                },
                handler: this.savePicture,
                description: 'Create one of many pictures of a particular trip',
                notes: 'Will save a picture for this trip. Not the main picture.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: this.schema.imageSchemaPost
                }
            }
        });

        // update a  picture of a trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}/picture/more',
            config: {
                auth: false,
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    // TODO: evaluate real value
                    maxBytes: 1000000000000
                },
                handler: this.updatePicture,
                description: 'Update/Change one of the pictures of a particular trip',
                notes: 'The picture in the database will be updated. The User defines which one.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: this.schema.imageSchemaPut
                }
            }
        });


        // get a particular trip
        server.route({
            method: 'GET',
            path: '/trips/{tripid}',
            config: {
                auth: false,
                handler: this.getTripById,
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
                handler: this.createTrip,
                description: 'Create new trip',
                tags: ['api', 'trip'],
                validate: {
                    payload: this.schema.tripSchemaPost
                        .required()
                        .description('Trip JSON object')
                }
            }
        });

        // create a new trip with form data
        server.route({
            method: 'POST',
            path: '/trips/image',
            config: {
                payload: {
                    output: 'stream',
                    parse: true,
                    allow: 'multipart/form-data',
                    // TODO: evaluate real value
                    maxBytes: 1000000000000
                },
                handler: this.savePicture,
                description: 'Creates a new trip with form data. Used when a picture is uploaded first',
                tags: ['api', 'trip'],
                validate: {
                    payload: this.schema.imageSchemaPost
                }
            }

        });

        // create the views for couchdb
        server.route({
            method: 'POST',
            path: '/trips/setup',
            config: {
                handler: this.createSearchView,
                description: 'Setup all views and lists for couchdb',
                tags: ['api', 'trip']
            }
        });

        // update a particular trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}',
            config: {
                handler: this.updateTrip,
                description: 'Update particular trip',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    },
                    payload: this.schema.tripSchemaPUT
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
                handler: this.deleteTripById,
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

    /**
     * Function to get file information for a file, from a request.
     *
     * @param request
     * @returns {{ext: string, filename: string, thumbname: string, url: string, thumbURL: string, imageLocation: {}}}
     */
    private getFileInformation(request:any, originalName) {
        var file = {
            ext: '',
            filename: '',
            thumbname: '',
            url: '',
            thumbURL: '',
            imageLocation: {}
        };

        file.ext = request.payload.file.hapi.headers['content-type']
            .match(this.schema.regex.imageExtension);

        if(originalName){
            // file, which will be updated
            var _file = request.payload.nameOfFile.split('.')[0];
            file.filename = _file + '.' + file.ext;
            file.thumbname = _file + '-thumb.' + file.ext;
        } else {
            // file, which will be updated
            file.filename = request.payload.nameOfTrip + '-trip.' + file.ext;
            file.thumbname = request.payload.nameOfTrip + '-trip-thumb.' + file.ext;
        }


        // "/i/" will be mapped to /api/vX/ from nginx
        file.url = '/i/trips/' + request.params.tripid + '/' + file.filename;
        file.thumbURL = '/i/trips/' + request.params.tripid + '/' + file.thumbname;

        file.imageLocation = {
            picture: file.url,
            thumbnail: file.thumbURL
        };
        return file;
    }

    /**
     * Save picture.
     *
     * @param request
     * @param reply
     */
    private savePicture = (request, reply, originalName) => {

        var file = this.getFileInformation(request, originalName);

        // create a read stream and crop it
        // TODO: size needs to be discussed
        var readStream = this.crop(request, 1500, 675);
        var thumbnailStream = this.crop(request, 120, 120);

        this.db.savePicture(request.params.tripid, file.filename, readStream)
            .then(() => {
                return this.db.savePicture(request.params.tripid, file.thumbname, thumbnailStream);
            }).then(() => {
                return this.db.updateDocument(request.params.tripid, {images: file.imageLocation});
            })
            .then((value) => {
                this.replySuccess(reply, file.imageLocation, value.id)
            })
            .catch((err) => {
                return reply(this.boom.badRequest(err));
            });

    };

    /**
     * Function to update picture.
     * @param request
     * @param reply
     */
    private updatePicture = (request, reply) => {
        // check first if entry exist in the database
        this.db.entryExist(request.params.tripid, request.payload.nameOfFile)
            .catch((err) => {
                return reply(this.boom.badRequest(err));
            }).then(() => {
                this.savePicture(request, reply, true);
            });

    };

    /**
     * Crop a payload file and return a stream.
     *
     * @param request
     * @param x
     * @param y
     * @returns {any}
     */
    private crop(request, x, y) {
        return this.gm(request.payload.file)
            .crop(request.payload.width,
            request.payload.height,
            request.payload.xCoord,
            request.payload.yCoord)
            .resize(x, y)
            .stream();
    }

    /**
     * reply a success message.
     *
     * @param reply
     * @param imageLocation
     */
    private replySuccess = (reply, imageLocation, documentid) => {
        reply({
            message: 'ok',
            imageLocation: imageLocation,
            id: documentid
        });
    };

    /**
     * create a new Trip.
     *
     * @param request
     * @param reply
     */
    private createTrip = (request, reply) => {
        // TODO: read user id from session and create trip with this info
        this.db.createTrip(request.payload, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Update a Trip.
     *
     * @param request
     * @param reply
     */
    private updateTrip = (request, reply) => {
        this.db.updateTrip(request.payload._id, request.payload._rev, request.payload, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * get all Trips in Database.
     * TODO: limit number of returned trips.
     *
     * @param request
     * @param reply
     */
    private getTrips = (request, reply) => {
        this.db.getTrips((err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Get trip by id.
     *
     * @param request
     * @param reply
     */
    private getTripById = (request, reply) => {
        this.db.getTripById(request.params.tripid, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Delete Trip by id.
     *
     * @param request
     * @param reply
     */
    private deleteTripById = (request, reply) => {
        this.db.deleteTripById(request.params.tripid, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Create or update view with search functionality, locatoed in /util/search.
     *
     * @param request
     * @param reply
     */
    private createSearchView = (request, reply) => {
        this.db.createView(this.search.viewName_Search, this.search.searchList, (err, msg)=> {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            } else {
                reply(msg);
            }
        });
    };

    /**
     * Function to search trips in database. The search algo is located in util/search.
     *
     * @param request
     * @param reply
     */
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