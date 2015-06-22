export default
class Schema {
    joi:any;
    public imageValidation:any;
    public tripSchemaPost:any;
    public tripSchemaPUT:any;
    public imageSchemaPost:any;
    public imageSchemaPut:any;
    private basicImageSchema:any;
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

        // optional trip schema document
        var tripSchema = this.joi.object().keys({
            title: this.joi.string(),

            city: this.joi.object().keys({
                title: this.joi.string().required(),
                place_id: this.joi.string().required(),
                id: this.joi.string().required()
            }),

            description: this.joi.string(),

            // require hashmap with locations and its pictures
            locations: this.joi.object().keys().min(1)
                .pattern(/\w\d/, this.joi.object().description('Location id').keys({
                    picture: this.joi.string(),
                    thumbnail: this.joi.string(),
                    googlemap: this.joi.string().required()
                }).and('picture', 'thumbnail').min(1)
            ).description('Hashmap with key location id and value object with image urls'),

            // if equipment is provided, this key must be true
            accommodation: this.joi.when('accommodation_equipment', {
                is: this.joi.array().length(1).required(),
                then: this.joi.valid(true).required(),
                otherwise: this.joi.boolean()
            }),
            accommodation_equipment: this.joi.array(),

            start_date: this.joi.date().min(new Date().setHours(0, 0, 0, 0)),
            end_date: this.joi.date().min(this.joi.ref('start_date')),

            persons: this.joi.number().integer().min(1),

            // TODO: validate max days : https://github.com/hapijs/joi/issues/667
            days: this.joi.number().integer().min(1),

            // optional keys upon creation
            description_money: this.joi.string().allow(''),
            moods: this.joi.array().items(this.joi.string().required()),
            active: this.joi.boolean().default(true),
            delete: this.joi.boolean().default(false)
        });

        var requiredSchema = tripSchema.requiredKeys('title', 'city', 'description', 'moods',
            'start_date', 'end_date', 'persons', 'days', 'accommodation', 'locations');

        // exported schemas
        this.tripSchemaPUT = tripSchema.required().min(1).description('Update Trip JSON object');
        this.tripSchemaPost = requiredSchema.required().description('Trip JSON object');

        // images validation
        this.imageSchemaPost = this.hoek.clone(this.imageValidation.basicImageSchema);
        this.imageSchemaPost.nameOfTrip = this.joi.string().required();

        this.imageSchemaPut = this.imageValidation.basicImageSchema;
        this.imageSchemaPut.nameOfFile = this.joi.string().min(1).required();
    }

}
