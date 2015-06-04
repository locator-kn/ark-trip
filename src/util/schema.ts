export default
class Schema {
    joi:any;
    public imageValidation:any;
    public tripSchemaPost:any;
    public tripSchemaPUT:any;
    public imageSchemaPost:any;
    public imageSchemaPut:any;
    basicImageSchema:any;
    private hoek:any;

    constructor() {
        this.joi = require('joi');
        this.imageValidation = require('locator-image-utility').validation;
        this.hoek = require('hoek');

        this.initSchemas();
    }

    /**
     *    Init validation schemas for POST and PUT method.
     *    We need two schemas because PUT required '_id' and '_rev'.
     */
    private initSchemas():void {

        // required trip schema document
        var tripSchema = this.joi.object().keys({
            title: this.joi.string().required(),

            city: this.joi.object().keys({
                title: this.joi.string().required(),
                place_id: this.joi.string().required(),
                id: this.joi.string().required()
            }).required(),

            description: this.joi.string().required(),

            description_money: this.joi.string(),

            // if equipment is provided, this key must be true
            accommodation: this.joi.when('accommodation_equipment', {
                is: this.joi.array().required(),
                then: this.joi.valid(true).required(),
                otherwise: this.joi.boolean().required()
            }),
            accommodation_equipment: this.joi.array(),

            start_date: this.joi.date().min('now').required(),
            end_date: this.joi.date().min(this.joi.ref('start_date')).required(),

            persons: this.joi.number().integer().min(1).required(),

            // TODO: validate max days : https://github.com/hapijs/joi/issues/667
            days: this.joi.number().integer().min(1),

            // optional keys upon creation
            moods: this.joi.array(),
            locations: this.joi.array(),

            // TODO: Frontend?
            active: this.joi.boolean().default(true),
            delete: this.joi.boolean().default(false),
        });


        this.tripSchemaPUT = tripSchema.keys({id: this.joi.string().required()});
        
        this.tripSchemaPost = tripSchema;

        // images validation
        this.imageSchemaPost = this.hoek.clone(this.imageValidation.basicImageSchema);
        this.imageSchemaPost.nameOfTrip = this.joi.string().required();

        this.imageSchemaPut = this.imageValidation.basicImageSchema;
        this.imageSchemaPut.nameOfFile = this.joi.string().min(1).required();
    }

}
