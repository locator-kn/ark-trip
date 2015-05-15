// describe the shape of libraries not written in TypeScript
declare
var emit:any;
declare
var getRow:any;
declare
var send:any;

export default
class Search {

    public viewName_Search = '_design/search';

    // TODO: performance measurement for relevance check
    // list for couchdb the search a trip
    public searchList = {
        views: {
            city: {
                "map": function (doc) {
                    if (doc.type == 'trip') {
                        emit(doc.city, doc);
                    }
                }
            }
        },
        lists: {
            searchlist: function (head, req) {
                var RELEVANCE_CONFIG = {
                    RELEVANCE_SUM: 1,
                    RELEVANCE_MOODS: 0.4,
                    RELEVANCE_DAYS: 0.2,
                    RELEVANCE_PERSONS: 0.2,
                    RELEVANCE_BUDGET: 0.1,
                    RELEVANCE_ACCOMMODATIONS: 0.1
                };
                var row;
                var result = [];
                var queryParams = JSON.stringify(req.query);
                while (row = getRow()) {
                    // city param is required
                    if (queryParams != '{}' && (row.key == req.query.city)) {
                        var moods_relevance;
                        var possibleRelevance = 0;
                        // status object for relevance check
                        var relevance = {
                            moods: 0,
                            budget: 0,
                            persons: 0,
                            days: 0,
                            accommodations: 0
                        };
                        // set 'toPush' variable true and set it only false, if required param like mood don't hit
                        var toPush = true;
                        if (req.query.moods) {
                            // set 'toPush' false -> don't add row to result list
                            toPush = false;
                            // object for relevance calculation of moods
                            moods_relevance = {
                                moods_sum: 0,
                                moods_hit: 0
                            };
                            // split params to get all moods
                            var moods = req.query.moods.split('.');
                            // check if trip contains requried mood
                            moods.forEach(function (mood) {
                                moods_relevance.moods_sum++;
                                if (row.value.category.indexOf(mood) > -1) {
                                    toPush = true;
                                    moods_relevance.moods_hit++;
                                }
                            });
                        }
                        // do not check date, if mood check don't successful..
                        if (toPush) {
                            if (req.query.start_date && req.query.end_date) {
                                // check date range of trip
                                if (req.query.start_date > row.value.start_date || req.query.end_date < row.value.end_date) {
                                    // don't add trip if is out of range
                                    toPush = false;
                                }
                            }
                        }
                        // if date and moods okay, check further params for relevance calculation
                        if (toPush) {
                            if (req.query.moods) {
                                possibleRelevance = RELEVANCE_CONFIG.RELEVANCE_MOODS;
                                relevance.moods = RELEVANCE_CONFIG.RELEVANCE_MOODS / moods_relevance.moods_sum * moods_relevance.moods_hit;
                            }
                            if (req.query.budget) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_BUDGET;
                                if (req.query.budget <= row.value.budget) {
                                    relevance.budget = RELEVANCE_CONFIG.RELEVANCE_BUDGET;
                                }
                            }
                            if (req.query.persons) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_PERSONS;
                                if (req.query.persons <= row.value.budget) {
                                    relevance.persons = RELEVANCE_CONFIG.RELEVANCE_BUDGET;
                                }
                            }
                            if (req.query.days) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_DAYS;
                                if (req.query.days <= row.value.days) {
                                    relevance.days = RELEVANCE_CONFIG.RELEVANCE_DAYS;
                                }
                            }
                            if (req.query.accommodations) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_ACCOMMODATIONS;
                                if (req.query.accommodations <= row.value.accommodations) {
                                    relevance.accommodations = RELEVANCE_CONFIG.RELEVANCE_ACCOMMODATIONS;
                                }
                            }

                            // relevance calculation
                            var total = 0;
                            for (var property in relevance) {
                                total += relevance[property];
                            }
                            // workaround if no param hit
                            if (total === 0) {
                                total = 1;
                                if (!possibleRelevance) {
                                    // workaround if only city and date is committed
                                    possibleRelevance = 0.5;
                                }
                                possibleRelevance = possibleRelevance * 2;
                            }
                            row.value.relevance = (total * 100 / possibleRelevance);

                            // push relevant trip to result array
                            result.push(row.value);
                        }
                    }
                }

                send(JSON.stringify(result))
            }
        }
    };
}
