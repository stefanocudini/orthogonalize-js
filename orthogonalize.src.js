/*
 2015 © Stefano Cudini
 Orthogonalize.js, a Javascript polyline orthogonalizer library
 http://labs.easyblog.it/maps/orthogonalize-js

 based on: Openstreetmap iD editor:
 https://github.com/openstreetmap/iD/blob/master/modules/actions/orthogonalize.js

 https://github.com/openstreetmap/josm/blob/fadeda909a3333e18809bfab1ca3156b4d56d334/src/org/openstreetmap/josm/actions/OrthogonalizeAction.java
 https://github.com/don-vip

 https://github.com/jdiffen1/gram-schmidt
 
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
        corner = {i: 0, dotp: 1},
        iterations = 1000,
        epsilon = 1/iterations;

    function projection(point) {
        var k = 512 / Math.PI, // scale
            x = 0, y = 0;
        point = d3.geoMercatorRaw(point[0] * Math.PI / 180, point[1] * Math.PI / 180);
        return [point[0] * k + x, y - point[1] * k];
    }
    projection.invert = function(point) {
        var k = 512 / Math.PI, // scale
            x = 0, y = 0;        
        point = d3.geoMercatorRaw.invert((point[0] - x) / k, (y - point[1]) / k);
        return point && [point[0] * 180 / Math.PI, point[1] * 180 / Math.PI];
    };

    function geoEuclideanDistance(a, b) {
        var x = a[0] - b[0], y = a[1] - b[1];
        return Math.sqrt((x * x) + (y * y));
    }

    function geoInterp(p1, p2, t) {
        return [p1[0] + (p2[0] - p1[0]) * t,
                p1[1] + (p2[1] - p1[1]) * t];
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
    
    return function(geojson, t) {

        if (t === null || !isFinite(t)) t = 1;
        t = Math.min(Math.max(+t, 0), 1);


        var motions, i, j,

            coords = geojson.features ? geojson.features[0].geometry.coordinates : geojson.geometry.coordinates,
            points = _.map(coords, function(v, k) {
                var loc = [ v[1], v[0] ];
                return loc;
            });


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
            
        }

        points = newPoints;

        for (i = 0; i < points.length; i++) {
            // only move the points that actually moved
            if (oriPoints[i][0] !== points[i][0] || 
                oriPoints[i][1] !== points[i][1] ) {
                
                //loc = projection.invert(points[i]);
                //node = graph.entity(nodes[i].id);
                //graph = graph.replace( node.move(geoInterp(node.loc, loc, t)) );

                points[i] = geoInterp(oriPoints[i], points[i], t);
                //console.log('geoInterp', oriPoints[i], points[i]);

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