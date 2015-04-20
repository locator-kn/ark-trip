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
        // Register
        return 'register';
    }

    errorInit(error) {
        if (error) {
            console.log('Error: Failed to load plugin (Trip):', error);
        }
    }
}