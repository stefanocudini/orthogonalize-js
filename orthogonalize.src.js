/*
 2015 © Stefano Cudini
 Orthogonalize.js, a Javascript polyline orthogonalizer library
 http://labs.easyblog.it/maps/orthogonalize-js

 based on: Openstreetmap iD editor:
 https://github.com/openstreetmap/iD/blob/master/modules/actions/orthogonalize.js
*/
(function (factory) {
    if(typeof define === 'function' && define.amd) {
    //AMD
        define(['underscore'], factory);
    } else if(typeof module !== 'undefined') {
    // Node/CommonJS
        module.exports = factory(require('underscore'));
    } else {

    // Browser globals
        if(typeof window._ === 'undefined')
            throw 'Underscore must be loaded first';

        window.Orthogonalize = factory(_);
    }
})(function (_) {
    /*
     * Based on https://github.com/openstreetmap/potlatch2/blob/master/net/systemeD/potlatch2/tools/Quadrilateralise.as
     */

    var threshold = 15, // degrees within right or straight to alter
        lowerThreshold = Math.cos((90 - threshold) * Math.PI / 180),
        upperThreshold = Math.cos(threshold * Math.PI / 180);

    function geoEuclideanDistance(a, b) {
        var x = a[0] - b[0], y = a[1] - b[1];
        return Math.sqrt((x * x) + (y * y));
    }

    function geoInterp(p1, p2, t) {
        return [p1[0] + (p2[0] - p1[0]) * t,
                p1[1] + (p2[1] - p1[1]) * t];
    }

    function calcMotion(b, i, array) {

        var a = array[(i - 1 + array.length) % array.length],
            c = array[(i + 1) % array.length],
            p = subtractPoints(a, b),
            q = subtractPoints(c, b),
            scale, dotp;

        scale = 2 * Math.min(geoEuclideanDistance(p, [0, 0]), geoEuclideanDistance(q, [0, 0]));
        p = normalizePoint(p, 1.0);
        q = normalizePoint(q, 1.0);

        dotp = filterDotProduct(p[0] * q[0] + p[1] * q[1]);

        // nasty hack to deal with almost-straight segments (angle is closer to 180 than to 90/270).
        if (array.length > 3) {
            if (dotp < -0.707106781186547) {
                dotp += 1.0;
            }
        } else if (dotp && Math.abs(dotp) < corner.dotp) {
            corner.i = i;
            corner.dotp = Math.abs(dotp);
        }

        return normalizePoint(sumPoints(p, q), 0.1 * dotp * scale);
    }

    function squareness(points) {
        return points.reduce(function(sum, val, i, array) {
            var dotp = normalizedDotProduct(i, array);

            dotp = filterDotProduct(dotp);
            return sum + 2.0 * Math.min(Math.abs(dotp - 1.0), Math.min(Math.abs(dotp), Math.abs(dotp + 1)));
        }, 0);
    }

    function normalizedDotProduct(i, points) {
        var a = points[(i - 1 + points.length) % points.length],
            b = points[i],
            c = points[(i + 1) % points.length],
            p = subtractPoints(a, b),
            q = subtractPoints(c, b);

        p = normalizePoint(p, 1.0);
        q = normalizePoint(q, 1.0);

        return p[0] * q[0] + p[1] * q[1];
    }

    function subtractPoints(a, b) {
        //console.log('subtractPoints',a,b)
        if(!a[0] || !b[0]) return null;
        return [a[0] - b[0], a[1] - b[1]];
    }

    function sumPoints(a, b) {

        return [a[0] + b[0], a[1] + b[1]];
    }

    function normalizePoint(point, scale) {
        var vector = [0, 0];
        var length = Math.sqrt(point[0] * point[0] + point[1] * point[1]);
        if (length !== 0) {
            vector[0] = point[0] / length;
            vector[1] = point[1] / length;
        }

        vector[0] *= scale;
        vector[1] *= scale;

        return vector;
    }

    function filterDotProduct(dotp) {
        if (lowerThreshold > Math.abs(dotp) || Math.abs(dotp) > upperThreshold) {
            return dotp;
        }

        return 0;
    }

    return function(geojson, t) {

        if (t === null || !isFinite(t)) t = 1;
        t = Math.min(Math.max(+t, 0), 1);

        //var way = graph.entity(wayId),
        //    nodes = graph.childNodes(way),
        var coords = geojson.features[0].geometry.coordinates;
        var nodes = _.map(coords, function(v, k) {
            return {
                id: k,
                loc: [ v[1], v[0] ]
            };
        });

        var points = _.chain(nodes).uniq().pluck('loc').value(),
            corner = {i: 0, dotp: 1},
            iterations = 1000,
            epsilon = 1/iterations,
            node, loc, score, motions, i, j;


        var oriPoints = _.clone(points),
            newPoints = [],
            score = Infinity;

        for (i = 0; i < iterations; i++) {
            
            motions = points.map( calcMotion );

            for (j = 0; j < motions.length; j++)
                points[j] = sumPoints(points[j], motions[j]);
            
            var newScore = squareness(points);
            if (newScore < score) {
                newPoints = _.clone(points);
                score = newScore;
            }

            if (score < epsilon) {
                break;
            }
            
            if((i%100)==0)   //each 10 cycles
                L.polyline(newPoints, {color: '#0e0',weight:3, opacity:i/1000}).addTo(map);
        }

        points = newPoints;

        for (i = 0; i < points.length; i++) {
            // only move the points that actually moved
            if (oriPoints[i][0] !== points[i][0] || oriPoints[i][1] !== points[i][1]) {
                
                //loc = projection.invert(points[i]);
                //node = graph.entity(nodes[i].id);
                //graph = graph.replace( node.move(geoInterp(node.loc, loc, t)) );

                points[i] = geoInterp(oriPoints[i], points[i], t);
                //console.log('geoInterp', oriPoints[i], points[i]);
                
                L.circleMarker(oriPoints[i], {color: '#00f'}).addTo(map);
                L.circleMarker(points[i], {color: '#f00', radius:5}).addTo(map);
            }
        }

        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {},
                    "geometry": {
                        "type": "LineString",
                        "coordinates": _.map(points, function(p) {
                            return [ p[1], p[0] ]
                        })
                    }
                }
            ]
        };

    };

});