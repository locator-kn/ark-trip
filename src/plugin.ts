export interface IRegister {
    (server:any, options:any, next:any): void;
    attributes?: any;
}

/**
 * structure of a trip
 */
export interface ITrip {
    _id: string;
    _rev?: string;
    city: string;
    start_date: Date;
    end_date: Date;
    budget: number;
    locations: string[];
    pics: string[];
}

export default
class Trip {
    db:any;

    constructor() {
        this.register.attributes = {
            name: 'backend-trip',
            version: '0.1.0'
        };
    }

    register:IRegister = (server, options, next) => {
        server.bind(this);

        server.dependency('backend-database', (server, next) => {
            this.db = server.plugins['backend-database'];
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
                handler: (request, reply) => {

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
                handler: (request, reply) => {

                },
                description: 'Get a particular trip',
                tags: ['api', 'trip']
            }
        });

        // create a new trip
        server.route({
            method: 'POST',
            path: '/trips',
            config: {
                handler: (request, reply) => {

                },
                description: 'create a new trip',
                tags: ['api', 'trip']
            }
        });

        // update a particular trip
        server.route({
            method: 'PUT',
            path: '/trips/{tripid}',
            config: {
                handler: (request, reply) => {

                },
                description: 'update a particular trip',
                tags: ['api', 'trip']
            }
        });



        // Register
        return 'register';
    }

    errorInit(error) {
        if (error) {
            console.log('Error: Failed to load plugin (Trip):', error);
        }
    }
}