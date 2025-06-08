#!/usr/bin/env node

const fs = require('fs'),
    _ = require('underscore'),
    gs = require('gramschmidt'),
    geoProject = require('geojson-project');

const geojson = JSON.parse(fs.readFileSync('examples/polyline.json', 'utf8'));

var coords = geojson.features[0].geometry.coordinates;

coords = _.map(coords, function(v){ return [v[1],v[0]]; });

console.log(coords);

var coordsOrtho = gs.apply(this, coords );

var Fout = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "LineString",
                "coordinates": _.map(coords, function(v){ return [v[1],v[0]]; })
            }
        }
    ]
};

fs.writeFile('examples/polyline2.json', JSON.stringify(Fout, null, 4));

//console.log(coords);

//console.log(coordsOrtho);

