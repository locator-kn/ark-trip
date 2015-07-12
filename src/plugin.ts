declare var Promise:any;

import Schema from './util/schema';
import Search from './util/search';
import {initLogging, log, logError, logCorrupt} from './util/logging'

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
    scheduler:any;


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
        this.scheduler = require('node-schedule');


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

        this.registerScheduledJob();
        
        // payload for image
        var imagePayload = {
            output: 'stream',
            parse: true,
            allow: 'multipart/form-data',
            maxBytes: 1048576 * 6 // 6MB
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
        server.route({
            method: 'GET',
            path: '/trips/{tripid}/{name}.{ext}',
            config: {
                auth: false,
                handler: (request, reply) => {
                    var documentId = request.params.tripid;
                    var name = request.params.name;
                    var ext = request.params.ext;
                    var size = request.query.size;

                    if (size) {
                        reply().redirect('/api/v1/data/' + documentId + '/' + name + '.' + ext + '?size=' + size);
                    } else {
                        reply().redirect('/api/v1/data/' + documentId + '/' + name + '.' + ext);
                    }

                },
                description: 'Get a picture of a ' +
                'particular trip by id. Could be any picture of the trip.',
                notes: 'sample call: /trips/1222123132/nameOfTheTrip-trip.jpg. The url is found, when a ' +
                'trip is requested with GET /trips/:tripId',
                tags: ['api', 'trip'],
                validate: {
                    params: this.schema.imageRequestSchema
                }
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
                }
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
                }
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
                }
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
                }
            }
        });

        // Register
        return 'register';
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
            moods: (request.query.moods || ""),
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
            if (data.length) {
                data.sort(function (a, b) {
                    if (a.relevance < b.relevance) return 1;
                    if (a.relevance > b.relevance) return -1;
                    return 0;
                });
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

    private getQueryDate(query:any):Date {
        if (!query || !query.date) {
            return null;
        }
        return query.date;
    }

    private registerScheduledJob():void {
        // every day at 02:00
        var job = this.scheduler.scheduleJob('0 2 * * *', () => {
            // check integrity of all locations
            this.db.getAllTrips().then(res => {

                res.forEach((trip:any) => {

                    this.joi.validate(trip, this.schema.tripSchemaPost.unknown(), (err, result) => {
                        if (result.preTrip) {
                            return;
                        }

                        if (err) {
                            logCorrupt('This trip is corrupt: ' + trip._id + ' Because of: ' + err)
                        }
                    })

                })
            }).catch(err => logError(err));
        })
    }
}