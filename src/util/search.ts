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
    // list for couchdb the search a trip
    public searchList = {
        views: {
            city: {
                "map": function (doc) {
                    // include only public and not deleted trips in search
                    if (doc.type == 'trip' && doc.public && !doc.delete && doc.public) {
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
                    RELEVANCE_DAYS: 0.1,
                    RELEVANCE_PERSONS: 0.2,
                    RELEVANCE_DATE: 0.3
                };
                var row;
                var result = [];
                var queryParams = JSON.stringify(req.query);
                while (row = getRow()) {
                    // city param is required
                    if (queryParams != '{}' && (row.key.id == req.query.city)) {
                        var possibleRelevance = 0;
                        // status object for relevance check
                        var relevance = {
                            moods: 0,
                            persons: 0,
                            days: 0,
                            date: 0
                        };
                        // set 'toPush' variable true and set it only false, if required param like mood don't hit
                        var toPush = true;

                        // do not check date, if mood check don't successful..
                        if (toPush) {
                            if (req.query.start_date && req.query.end_date) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_DATE;
                                // check date range of trip
                                if (req.query.end_date < row.value.start_date || req.query.end_date > row.value.end_date) {
                                    // don't add trip if is out of range
                                    toPush = false;
                                } else {
                                    relevance.date = RELEVANCE_CONFIG.RELEVANCE_DATE;
                                }
                            }
                        }
                        // if date and moods okay, check further params for relevance calculation
                        if (toPush) {
                            if (req.query.moods) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_MOODS;
                                if(req.query.moods == row.value.moods[0]){
                                    relevance.moods = RELEVANCE_CONFIG.RELEVANCE_MOODS;
                                }
                            }
                            if (req.query.persons) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_PERSONS;
                                if (req.query.persons == row.value.persons) {
                                    relevance.persons = RELEVANCE_CONFIG.RELEVANCE_PERSONS;
                                }
                            }
                            if (req.query.days) {
                                possibleRelevance += RELEVANCE_CONFIG.RELEVANCE_DAYS;
                                if (req.query.days == row.value.days) {
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
                                total = 1 - possibleRelevance;
                                row.value.relevance = (total * 100);
                            } else {
                                row.value.relevance = (total * 100 / possibleRelevance);
                            }

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
