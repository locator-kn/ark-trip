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
                    RELEVANCE_MOODS: 0.5,
                    RELEVANCE_DAYS: 0.3,
                    RELEVANCE_PERSONS: 0.2
                };
                var row;
                var result = [];
                var queryParams = JSON.stringify(req.query);
                while (row = getRow()) {
                    // city param is required
                    if (queryParams != '{}' && (row.key.id == req.query.city)) {
                        var moods_relevance;
                        var possibleRelevance = 0;
                        // status object for relevance check
                        var relevance = {
                            moods: 0,
                            persons: 0,
                            days: 0
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
                                if (row.value.moods.indexOf(mood) > -1) {
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
                            if (req.query.persons) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_PERSONS;
                                if (req.query.persons <= row.value.persons) {
                                    relevance.persons = RELEVANCE_CONFIG.RELEVANCE_PERSONS;
                                }
                            }
                            if (req.query.days) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_DAYS;
                                if (req.query.days <= row.value.days) {
                                    relevance.days = RELEVANCE_CONFIG.RELEVANCE_DAYS;
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
