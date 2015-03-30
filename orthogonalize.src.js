/*
 2015 © Stefano Cudini
 Orthogonalize.js, a Javascript polyline orthogonalizer library
 http://labs.easyblog.it/maps/orthogonalize-js
*/

(function() {
    'use strict';

    //TODO

    // both algorithms combined for awesome performance
    function orthogonalize(points, tolerance, highestQuality) {

        if (points.length <= 1) return points;

        var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

        points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
        points = _orthogonalize(points, sqTolerance);

        return points;
    }

    // export as AMD module / Node module / browser or worker variable
    if (typeof define === 'function' && define.amd) define(function() {
        return orthogonalize;
    });
    else if (typeof module !== 'undefined') module.exports = orthogonalize;
    else if (typeof self !== 'undefined') self.orthogonalize = orthogonalize;
    else window.orthogonalize = orthogonalize;

})();