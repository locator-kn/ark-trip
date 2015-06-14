import Search from './util/search';

export function setup(database:any, callback:any) {

    var search = new Search();
    database.rawMethod('save', {key: search.viewName_Search, value: search.searchList}, callback);
}
