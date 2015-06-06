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
    paginationDefaultSize:number = 10;
    imageUtil:any;
    uuid:any;
    regex:any;


    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.boom = require('boom');
        this.joi = require('joi');
        this._ = require('underscore');
        this.schema = new Schema();
        this.search = new Search();
        this.imageUtil = require('locator-image-utility').image;
        this.regex = require('locator-image-utility').regex;
        this.uuid = require('node-uuid');

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
        // payload for image
        var imagePayload = {
            output: 'stream',
            parse: true,
            allow: 'multipart/form-data',
            // TODO: evaluate real value
            maxBytes: 1048576 * 6 // 6MB
        };

        var swaggerUpload = {
            'hapi-swagger': {
                payloadType: 'form'
            }
        };

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

        server.route({
            method: 'GET',
            path: '/users/my/trips',
            config: {
                handler: this.getMyTrips,
                description: 'Get all my trips',
                tags: ['api', 'trip']
            }
        });

        server.route({
            method: 'GET',
            path: '/users/my/trips/{tripid}',
            config: {
                handler: this.getTripById,
                description: 'Get a specific trip. Results in the same as calling GET /trips/:tripId.',
                tags: ['api', 'trip']
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
                        tripid: this.joi.string().required()
                    }
                }
            }
        });

        server.route({
            method: 'GET',
            path: '/users/{userid}/trips{opt}', //TODO evaluate given options
            config: {
                auth: false,
                handler: this.getTipsOfUser,
                description: 'Get all trips of this specific user',
                tags: ['api', 'trip', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string().required()
                    }
                }
            }
        });
        // get a (one of optional many) picture of a particular trip
        // TODO: redirect it to one special route handling pictures
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
                            .required().regex(this.regex.imageExtension)
                    }
                }

            }
        });

        // update/create the main picture of a trip
        server.route({
            method: ['PUT', 'POST'],
            path: '/trips/{tripid}/picture',
            config: {
                payload: imagePayload,
                handler: this.savePicture,
                description: 'Update/Change the main picture of a particular trip',
                notes: 'The picture in the database will be updated. The User defines which one.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string().required()
                    },
                    payload: this.schema.imageSchemaPost
                },
                plugins: swaggerUpload
            }
        });

        // create a picture of a trip
        server.route({
            method: 'POST',
            path: '/trips/{tripid}/picture/more',
            config: {
                payload: imagePayload,
                handler: (request, reply) => {
                    // create image with random uuid
                    // TODO: think of a better approach
                    this.savePicture(request, reply, this.uuid.v4())
                },
                description: 'Create one of many pictures of a particular trip',
                notes: 'Will save a picture for this trip. Not the main picture.',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string().required()
                    },
                    payload: this.schema.imageSchemaPost
                },
                plugins: swaggerUpload
            }
        });

        // update a  picture of a trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}/picture/more',
            config: {
                payload: imagePayload,
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
                },
                plugins: swaggerUpload
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
                }
            }
        });

        // create a new trip with form data
        server.route({
            method: 'POST',
            path: '/trips/image',
            config: {
                payload: imagePayload,
                handler: (request, reply) => {
                    // create an empty "preTrip" before uploading a picture
                    this.db.createTrip({type: "preTrip"}, (err, data) => {
                        if (err) {
                            return reply(this.boom.wrap(err, 400));
                        }
                        // add the generated id from database to the request object
                        request.params.tripid = data.id;
                        // get user id from authentication credentials
                        request.payload.userid = request.auth.credentials._id;

                        // save picture to the just created document
                        this.savePicture(request, reply, false);
                    });
                },
                description: 'Creates a new trip with form data. Used when a picture is uploaded first',
                tags: ['api', 'trip'],
                validate: {
                    payload: this.schema.imageSchemaPost
                },
                plugins: swaggerUpload
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
                }
            }
        });
        
        // delete a particular trip
        server.route({
            method: 'DELETE',
            path: '/trips/{tripid}',
            config: {
                handler: this.deleteTripById,
                description: 'delete a particular trip. Note this user must be owner of this trip',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string().required()
                    }
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

        // Register
        return 'register';
    }

    /**
     * Save picture.
     *
     * @param request
     * @param reply
     */
    private savePicture = (request, reply, name) => {

        this.isItMyTrip(request.aut.credentials._id, request.params.tripid)
            .catch((err) => reply(err))
            .then(() => {

                // set name of file, if not defined
                if (!name) {
                    name = request.payload.nameOfTrip + '-trip'
                }

                // extract only needed information of the request object
                var stripped = this.imageUtil.stripHapiRequestObject(request);

                // set the trip, where the picture should be saved
                stripped.options.id = request.params.tripid;

                // create object for processing images
                var imageProcessor = this.imageUtil.processor(stripped.options);
                if (imageProcessor.error) {
                    console.log(imageProcessor);
                    return reply(this.boom.badRequest(imageProcessor.error))
                }

                // get info needed for output or database
                var metaData = imageProcessor.createFileInformation(name);

                // create a read stream and crop it
                var readStream = imageProcessor.createCroppedStream(stripped.cropping, {x: 1500, y: 675});  // TODO: size needs to be discussed
                var thumbnailStream = imageProcessor.createCroppedStream(stripped.cropping, {x: 120, y: 120});

                this.db.savePicture(stripped.options.id, metaData.attachmentData, readStream)
                    .then(() => {
                        metaData.attachmentData.name = metaData.thumbnailName;
                        return this.db.savePicture(stripped.options.id, metaData.attachmentData, thumbnailStream);
                    }).then(() => {
                        return this.db.updateDocument(stripped.options.id, {images: metaData.imageLocation});
                    }).then((value) => {
                        this.replySuccess(reply, metaData.imageLocation, value)
                    }).catch((err) => {
                        return reply(this.boom.badRequest(err));
                    });
            });
    };

    /**
     * Function to update picture.
     * @param request
     * @param reply
     */
    private updatePicture = (request, reply) => {
        // check first if entry exist in the database
        var file = request.payload.nameOfFile;
        this.db.entryExist(request.params.tripid, file)
            .catch((err) => {
                return reply(this.boom.badRequest(err));
            }).then(() => {
                this.savePicture(request, reply, file);
            });

    };

    /**
     * reply a success message for uploading a picture.
     *
     * @param reply
     * @param imageLocation
     */
    private replySuccess = (reply, imageLocation, dbresponse) => {
        reply({
            message: 'ok',
            imageLocation: imageLocation,
            id: dbresponse.id,
            rev: dbresponse.rev
        });
    };

    /**
     * create a new Trip.
     *
     * @param request
     * @param reply
     */
    private createTrip = (request, reply) => {

        // get user id from authentication credentials
        request.payload.userid = request.auth.credentials._id;
        request.payload.type = 'trip';

        this.db.createTrip(request.payload, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            return reply(data);
        });
    };

    /**
     * Update a Trip.
     *
     * @param request
     * @param reply
     */
    private updateTrip = (request, reply) => {
        this.isItMyTrip(request.auth.credentials._id, request.params.tripid).then(() => {
            return this.db.updateTrip(request.params.tripid, request.payload)
        }).then((data) => {
            return reply(data);
        }).catch((err) => {
            return reply(this.boom.badRequest(err));
        });
    };

    /**
     * get all Trips in Database.
     *
     * @param request
     * @param reply
     */
    private getTrips = (request, reply) => {
        var paginationOptions = this.getPaginationOption(request);
        this.db.getTrips({limit: paginationOptions.page_size, skip: paginationOptions.offset}, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    private getTipsOfUser = (request, reply) => {
        this.db.getUserTrips(request.paramas.userid, (err, data) => {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            reply(data);
        });
    };

    /**
     * Retrieve all trips from this user
     *
     * @param request
     * @param reply
     */
    private getMyTrips = (request, reply) => {
        this.db.getUserTrips(request.auth.credentials._id, (err, data) => {
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
        this.isItMyTrip(request.auth.credentials._id, request.params.tripid).then(() => {
            return this.db.deleteTripById(request.params.tripid)
        }).then((data) => {
            return reply(data);
        }).catch(err => reply(err));
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
                return reply(this.boom.badRequest(err));
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
            persons: (request.query.persons || ""),
            days: (request.query.days || "")
        };
        this.db.searchTripsByQuery(query, (err, data)=> {
            if (err) {
                return reply(this.boom.wrap(err, 400));
            }
            this._.sortBy(data, 'relevance');
            reply(this.getPaginatedItems(request, data));
        });
    }

    /**
     * Returns a list with paginated items, call after search and sort by relevance.
     *
     * NOTE: Use of couchdb limit and skip param in search:
     * parameter 'limit' in lists doesn't work, because it limits only the number of rows to use for search.
     * But it is possible (and realistic), that the trip with the most relevance is at number 'limit+1'.
     * And this one will not include in search, if we use the limit option in lists.
     *
     * Only use after search function!
     *
     * @param request
     * @param data
     * @returns {*}
     */
    private  getPaginatedItems = (request, data) => {
        var paginationOption = this.getPaginationOption(request);
        var paginatedItems = this._.rest(data, paginationOption.offset).slice(0, paginationOption.page_size);
        return paginatedItems;
    };

    /**
     * Returns object with options for pagination.
     *
     * @param request
     * @returns {{page_size: (page_size|number), offset: number}}
     */
    private getPaginationOption = (request) => {
        var page = (request.query.page || 1),
            page_size = (request.query.page_size || this.paginationDefaultSize),
            offset = (page - 1) * page_size;
        return {page_size: page_size, offset: offset};
    };

    /**
     * Utility method for checking if the given userid belongs to the given tripid
     * @param userid
     * @param tripid
     * @returns {Promise|Promise<T>}
     */
    private isItMyTrip(userid:string, tripid:string):Promise {
        return new Promise((reject, resolve) => {

            this.db.getTripById(tripid, (err, data) => {

                if (err) {
                    return reject(this.boom.badRequest(err));
                }

                if (data.userid !== userid) {
                    return reject(this.boom.forbidden());
                }

                return resolve(data);
            });
        });
    }
}