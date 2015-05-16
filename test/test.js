'use strict';
var Code = require('code');
var Hapi = require('hapi');
var Lab = require('lab');

// home made plugin
var Trip = require('../index');

// Test shortcuts
var lab = exports.lab = Lab.script();
var expect = Code.expect;
var test = lab.test;

var request, server, Trip;

// set up the whole test
lab.before(function (done) {

    // set up server
    server = new Hapi.Server();
    server.connection({host: 'localhost', port: 3030});

    Trip = new Trip();

    // register needed plugins
    server.register(Trip, function (err) {
        if (err) {
            return done(err);
        }
        done();
    });
});

// test request for a trip on correct validation
lab.experiment('Trip plugin', function () {

    // function to be called before each test
    lab.beforeEach(function (done) {
        // do nothing (so far)
        done();
    });

    test('returns a bad request when extension of file is not correct', function (done) {

        request = {
            method: 'GET',
            url: '/trips/anyArbitryryID/arbitrary.exe'
        };

        // send the request to server
        server.inject(request, function (err) {
            expect(err.statusCode).to.equal(400);
            expect(err.result.message).to.equal('child "ext" fails because ' +
                '["ext" with value "exe" fails to match the required pattern: /^jpg|png|jpeg$/]');
            done();
        });
    });

    test('returns a not found when the name of a requested file is empty', function (done) {

        request = {
            method: 'GET',
            url: '/trips/anyArbitryryID/.png'
        };

        // send the request to server
        server.inject(request, function (err) {
            // no mapped route
            expect(err.statusCode).to.equal(404);
            done();
        });
    });

});