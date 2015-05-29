export default
class Schema {
    joi:any;
    public regex:any;
    public tripSchemaPost:any;
    public tripSchemaPUT:any;
    public imageSchemaPost:any;
    public imageSchemaPut:any;
    basicImageSchema:any;
    private hoek:any;

    constructor() {
        this.joi = require('joi');
        this.regex = require('locators-regex');
        this.hoek = require('hoek');

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
            description_money: this.joi.string(),
            city: this.joi.object().keys({
                title: this.joi.string().required(),
                place_id: this.joi.string().required(),
                id: this.joi.string().required()
            }),
            start_date: this.joi.date().required(),
            end_date: this.joi.date().required(),
            accommodation: this.joi.boolean().required().default(false),
            accommodation_equipment: this.joi.array(),
            moods: this.joi.array().required(),
            locations: this.joi.array(),
            pics: this.joi.array(),
            persons: this.joi.number().integer(),
            active: this.joi.boolean().default(true),
            delete: this.joi.boolean().default(false),
            type: this.joi.string().required().valid('trip')
        });

        // required elements for PUT method.
        var putMethodElements = this.joi.object().keys({
            _id: this.joi.string().required(),
            _rev: this.joi.string().required()
        });

        this.tripSchemaPost = trip;
        this.tripSchemaPUT = putMethodElements.concat(trip);

        // images validation
        this.basicImageSchema = {
            // validate file type to be an image
            file: this.joi.object({
                hapi: {
                    headers: {
                        'content-type': this.joi.string()
                            .regex(this.regex.imageContentType)
                            .required()
                    }
                }
            }).options({allowUnknown: true}).required(),
            // validate that a correct dimension object is emitted
            width: this.joi.number().integer().required(),
            height: this.joi.number().integer().required(),
            xCoord: this.joi.number().integer().required(),
            yCoord: this.joi.number().integer().required()
        };

        this.imageSchemaPost = this.hoek.clone(this.basicImageSchema);
        this.imageSchemaPost.nameOfTrip = this.joi.string().required();

        this.imageSchemaPut = this.hoek.clone(this.basicImageSchema);
        this.imageSchemaPut.nameOfFile = this.joi.string().min(1).required();
    }

}
