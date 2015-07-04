declare var Promise:any;

import Schema from './util/schema';
import Search from './util/search';
import {initLogging, log} from './util/logging'

export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

export default
class Trip {
    db:any;
    boom:any;
    joi:any;
    _:any; // underscore.js
    schema:any;
    search:any;
    paginationDefaultSize:number = 10;
    imageUtil:any;
    uuid:any;
    imageSize:any;


    constructor() {
        this.register.attributes = {
            pkg: require('./../../package.json')
        };

        this.boom = require('boom');
        this.joi = require('joi');
        this._ = require('underscore');
        this.schema = new Schema();
        this.imageUtil = require('locator-image-utility').image;
        this.imageSize = require('locator-image-utility').size;
        this.uuid = require('node-uuid');
        this.search = new Search();

    }

    /**
     * Setup method for initializing the search algo for searching a trip.
     * @param database
     * @param callback
     */
    public getSetupData() {
        return ({key: this.search.viewName_Search, value: this.search.searchList});
    }


    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('ark-database', (server, next) => {
            this.db = server.plugins['ark-database'];
            next();
        });

        this._register(server, options);
        initLogging(server);
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

        // get all trips according to the search opts
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

        // get 10 trips.. not useful
        server.route({
            method: 'GET',
            path: '/trips',
            config: {
                auth: false,
                handler: this.getTrips,
                description: 'Get all trips',
                tags: ['api', 'trip'],
                notes: 'Use /trips/search/:opts instead of this route to get better results'
            }
        });

        // get all my trips
        server.route({
            method: 'GET',
            path: '/users/my/trips',
            config: {
                handler: this.getMyTrips,
                description: 'Get all my trips',
                tags: ['api', 'trip'],
                validate: {
                    query: {
                        date: this.joi.date()
                    }
                }
            }
        });

        // get a particular trip of "me"
        server.route({
            method: 'GET',
            path: '/users/my/trips/{tripid}',
            config: {
                handler: (request, reply) => {
                    reply(this.db.getTripById(request.params.tripid))
                },
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
                handler: (request, reply) => {
                    reply(this.db.getTripById(request.params.tripid));
                },
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

        // get all trips of a user
        server.route({
            method: 'GET',
            path: '/users/{userid}/trips',
            config: {
                auth: false,
                handler: this.getTripsOfUser,
                description: 'Get all trips of this specific user',
                tags: ['api', 'trip', 'user'],
                validate: {
                    params: {
                        userid: this.joi.string().required()
                    },
                    query: {
                        date: this.joi.date()
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
                }
            }
        });

        // update a particular trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}',
            config: {
                handler: (request, reply) => {
                    return reply(this.db.updateTrip(request.params.tripid, request.auth.credentials._id, request.payload));
                },
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

        // update a particular trip
        server.route({
            method: ['PUT', 'POST'],
            path: '/trips/{tripid}/togglePublic',
            config: {
                handler: (request, reply) => {
                    return reply(this.db.togglePublicTrip(request.params.tripid, request.auth.credentials._id));
                },
                description: 'Change a trip from private to public or vice verca',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string()
                            .required()
                    }
                }
            }
        });

        // delete a particular trip
        server.route({
            method: 'DELETE',
            path: '/trips/{tripid}',
            config: {
                handler: (request, reply) => {
                    reply(this.db.deleteTripById(request.params.tripid, request.auth.credentials._id));
                },
                description: 'delete a particular trip. Note this user must be owner of this trip',
                tags: ['api', 'trip'],
                validate: {
                    params: {
                        tripid: this.joi.string().required()
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

                    reply().redirect('/api/v1/data/' + request.params.tripid + '/' + request.params.name + '.' + request.params.ext + '/?');

              /*      // create file name
                    var file = request.params.name + '.' + request.params.ext;

                    // get and reply file stream from database
                    reply(this.db.getPicture(request.params.tripid, file));*/
                },
                description: 'Get a picture of a ' +
                'particular trip by id. Could be any picture of the trip.',
                notes: 'sample call: /trips/1222123132/nameOfTheTrip-trip.jpg. The url is found, when a ' +
                'trip is requested with GET /trips/:tripId',
                tags: ['api', 'trip'],
                validate: {
                    params: this.schema.imageRequestSchema
                },
                query: this.joi.object().keys({
                    size: this.joi.string().valid([
                        this.imageSize.mini.name,
                        this.imageSize.midi.name,
                        this.imageSize.maxi.name,
                        this.imageSize.thumb.name
                    ])
                }).unknown()
            }
        });


        /**
         * Depcrated Routes
         */

            // create a new trip with form data
        server.route({
            method: 'POST',
            path: '/trips/image',
            config: {
                payload: imagePayload,
                handler: (request, reply) => {
                    return reply(this.boom.resourceGone('Maybe it will come back later. Who knows'));
                    //this.createTripWithPicture,
                },
                description: 'Creates a new trip with form data. Used when a picture is uploaded first',
                tags: ['api', 'trip'],
                validate: {
                    payload: this.schema.imageSchemaPost
                },
                plugins: swaggerUpload
            }
        });

        // update/create the main picture of a trip
        server.route({
            method: ['PUT', 'POST'],
            path: '/trips/{tripid}/picture',
            config: {
                payload: imagePayload,
                handler: (request, reply) => {
                    return reply(this.boom.resourceGone('Maybe it will come back later. Who knows'));
                    // this.mainPicture
                },
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
                    return reply(this.boom.resourceGone('Maybe it will come back later. Who knows'));
                    //this.otherTripPicture,
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
                handler: (request, reply) => {
                    return reply(this.boom.resourceGone('Maybe it will come back later. Who knows'));
                    //this.updatePicture,
                },
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

        // Register
        return 'register';
    }

    private mainPicture(request:any, reply:any):void {
        this.isItMyTrip(request.aut.credentials._id, request.params.tripid)
            .catch(err => reply(err))
            .then(() => {
                var name = request.payload.nameOfTrip + '-trip';
                var stripped = this.imageUtil.stripHapiRequestObject(request);
                stripped.options.id = request.params.tripid;

                this.savePicture(stripped.options, stripped.cropping, name, reply)
            });
    }


    private otherTripPicture(request:any, reply:any):void {
        this.isItMyTrip(request.aut.credentials._id, request.params.tripid)
            .catch((err) => reply(err))
            .then(() => {
                var name = this.uuid.v4();
                var stripped = this.imageUtil.stripHapiRequestObject(request);
                stripped.options.id = request.params.tripid;

                this.savePicture(stripped.options, stripped.cropping, name, reply)
            });
    }

    /**
     * Function to update picture.
     * @param request
     * @param reply
     */
    private updatePicture(request, reply) {
        var name = request.payload.nameOfFile;

        this.isItMyTrip(request.aut.credentials._id, request.params.tripid)
            .then(() => {
                return this.db.entryExist(request.params.tripid, name)
            }).then(() => {
                var stripped = this.imageUtil.stripHapiRequestObject(request);
                stripped.options.id = request.params.tripid;

                this.savePicture(stripped.options, stripped.cropping, name, reply)
            }).catch((err) => reply(err));
    }

    private createTripWithPicture(request, reply) {
        // create an empty "preTrip" before uploading a picture
        var userid = request.auth.credentials._id;
        this.db.createTrip({type: "preTrip", userid: userid}, (err, data) => {
            if (err) {
                return reply(this.boom.badRequest(err));
            }

            // get user id from authentication credentials
            request.payload.userid = userid;

            var stripped = this.imageUtil.stripHapiRequestObject(request);
            stripped.options.id = data.id;
            name = request.payload.nameOfTrip + '-trip';

            // save picture to the just created document
            this.savePicture(stripped.options, stripped.cropping, name, reply)
        });
    }

    /**
     * Save picture.
     *
     * @param requestData
     * @param cropping
     * @param name
     * @param reply
     */
    private savePicture(requestData:any, cropping:any, name:string, reply:any):void {

        // create object for processing images
        var imageProcessor = this.imageUtil.processor(requestData);
        if (imageProcessor.error) {
            return reply(this.boom.badRequest(imageProcessor.error))
        }

        // get requestData needed for output or database (filename, url, attachmentdata)
        var pictureData = imageProcessor.createFileInformation(name);
        var attachmentData = pictureData.attachmentData;

        // create a read stream and crop it
        var readStream = imageProcessor.createCroppedStream(cropping, {x: 1500, y: 675});  // TODO: size needs to be discussed

        this.db.savePicture(requestData.id, attachmentData, readStream)
            .then(() => {
                return this.db.updateDocumentWithoutCheck(requestData.id, {images: {picture: pictureData.url}});
            }).then((value:any) => {
                value.imageLocation = pictureData.url;
                reply(value).created(pictureData.url);
            }).catch(reply)

            //  save all other kinds of images after replying
            .then(() => {
                readStream = imageProcessor.createCroppedStream(cropping, this.imageSize.thumb.size); // Thumbnail
                attachmentData.name = this.imageSize.thumb.name;
                return this.db.savePicture(requestData.id, attachmentData, readStream)
            }).then(() => {
                readStream = imageProcessor.createCroppedStream(cropping, this.imageSize.mini.size); // mini
                attachmentData.name = this.imageSize.mini.name;
                return this.db.savePicture(requestData.id, attachmentData, readStream)
            }).then(() => {
                readStream = imageProcessor.createCroppedStream(cropping, this.imageSize.midi.size); // midi
                attachmentData.name = this.imageSize.midi.name;
                return this.db.savePicture(requestData.id, attachmentData, readStream)
            }).then(() => {
                readStream = imageProcessor.createCroppedStream(cropping, this.imageSize.maxi.size); // maxi
                attachmentData.name = this.imageSize.maxi.name;
                return this.db.savePicture(requestData.id, attachmentData, readStream)
            }).catch(err => log(err));
    }

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

        return reply(this.db.createTrip(request.payload));

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

    private getTripsOfUser = (request, reply) => {
        var date = this.getQueryDate(request.query);
        reply(this.db.getUserTrips(request.params.userid, date));
    };

    /**
     * Retrieve all trips from this user
     *
     * @param request
     * @param reply
     */
    private getMyTrips = (request, reply) => {
        var date = this.getQueryDate(request.query);
        this.db.getMyTrips(request.auth.credentials._id, date, (err, data) => {
            if (err) {
                return reply(this.boom.badRequest(err));
            }
            reply(data);
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
            // if trips with query params found
            if (data.length > 0) {
                this._.sortBy(data, 'relevance');
                reply(this.getPaginatedItems(request, data));
            } else {
                // if no trips found return all trips of city
                this.db.getTripsByCity(query.city, (err, data) => {
                    if (err) {
                        return reply(this.boom.wrap(err, 400));
                    }
                    reply(this.getPaginatedItems(request, data));
                })
            }

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
    private isItMyTrip(userid:string, tripid:string):any {
        return new Promise((reject, resolve) => {

            this.db.getTripById(tripid, (err, data) => {

                if (err) {
                    return reject(this.boom.badRequest(err));
                }

                if (!data.userid || data.userid !== userid) {
                    return reject(this.boom.forbidden());
                }

                return resolve(data);
            });
        });
    }

    private getQueryDate(query:any):Date {
        if (!query || !query.date) {
            return null;
        }
        return query.date;
    }
}