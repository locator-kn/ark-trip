# Trip


### How to use - plugin
## Setup
- POST to /trips/setup

## pagination
- maximal number of return object is currently 100 **TODO: needs to be discussed**
- implemented for GET routes:
  - /trips
  - /trips/search

### how to use - pagination
- add payload parameters for 'page' and 'page_size'
e.g.: ```{limit: 10, skip: 10}``` => result: 11 - 20 

## Search
#### parameters

|Parameter| optional / required | info |
|---|---|---|
|city| required | /trips/search/**city**|
|mood| optional | /trips/search/**.mood1.mood2.mood3**|
|city/mood| required| /trips/search/**cityid.mood1.mood2**|
|checkin/checkout| optional | /trips/search/cityid.mood1/**?start_date=2014-04-20T00:00:00.000Z&end_date=2016-04-20T00:00:00.000Z**|
|days|optional|/trips/search/cityid.mood1/**?days=2**|
|persons|optional|/trips/search/cityid.mood1/**?persons=3**|
|pagination|optional|/trips/search/cityid.mood1/**?page=1&page_size=10**|

start_date=2014-04-20T00:00:00.000Z&end_date=2016-04-20T00:00:00.000Z

#### result relevance
|parameter|relevance|
|---|---|
|moods|0.5/(number of moods)|
|days|0.3|
|persons|0.2|
|**SUM:**|**1.0**|

#### example call
**/trips/search/58433437e7710a957cd798b0774a79385389035b.buddytrip.mood2.mood3?budget=100start_date=2014-04-20T00:00:00.000Z&end_date=2016-04-20T00:00:00.000Z&persons=3** 

!!! Wichtig: Wenn nicht alle parameter übermittelt werden, soll die Summe aller Parameter trotzdem 1 sein! (Übereinstimmungen / Summe der übermittelten Parameter) 


### Routes
####GET

|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/trips   | return only first 100 trips  | json object | statusCode: 404 | 
|/trips/:tripID   |  return a particular trip by id | json object | statusCode: 404 | 
|/trips/search/*(see below)   | search for a trip | json object with all matches | statusCode: 404 |
*/trips/search/58433437e7710a957cd798b0774a79385389035b.buddytrip.mood2.mood3?budget=100start_date=2014-04-20T00:00:00.000Z&end_date=2016-04-20T00:00:00.000Z&persons=3 
!!before '?' no '/' (at the moment..)"



####POST
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/trips   | create new trip  | statusCode: 200 | statusCode: 404 |
|/trips/setup   | setup all routes and lists for trip plugin  | statusCode: 200 | statusCode: 404 |

####PUT
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/trips/:tripID   | update particular trip by id  | statusCode: 200 | statusCode: 404 |

####DELETE
|Ressource   | Description  |  on Success | on Failure |
|---|---|---|---|
|/trips/:tripID   | delete particular trip by id  | statusCode: 200 | statusCode: 404 |

### Dummy Json Results
##### Specific Trip - GET /trips/:tripID
```
{
  "_id": "1849ef313fbc39f078084f9168000e16",
  "_rev": "4-c726329a4e810962443ce5a7a176b00c",
  "title": "my trip",
  "userid": "adsf5as87f57a65f7a6578asdf57865",
  "description": "bla bla bla",
  "description_money": "Du solltest so X Geld mitbringen ..., für ..."
  "city": {
    "id": "58433437e7710a957cd798b0774a79385389035b",
    "title": "Konstanz",
    "place_id": "ChIJWx8MOBv2mkcR0JnfpbdrHwQ"
  },
  "start_date": "2015-04-20T00:00:00.000Z",
  "end_date": "2015-04-23T00:00:00.000Z",
  "duration": "2",
  "persons": "3",
  "accommodation": "true",
  "accommodation_equipment" : ["shower", "breakfast", "tv"],
  "locations": [],
  "pics": [],
  "moods": ["halligallidrecksaufest", "grilsontour"],
  "activ": "true",
  "delete": "false",
  "type": "trip"
}
```

##### Multiple Trips, filtered by arguments - GET /trips/search/{city.moods}/?...
(whats the difference? We should provide a thumbnail in the trip overview, not an array of big size pics)
```
[
    {
        ...
        "thumbnail":[...],
        ...
    },
    {
       ...
    },
    {
      ...
    },
    {
      ...
    }
]
```

