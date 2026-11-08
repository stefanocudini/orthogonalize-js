# orthogonalize-js

JavaScript Geometry Orthogonalize library

Squares the corners of GeoJSON lines and polygons (e.g. building footprints), so that every segment becomes horizontal or vertical on an orthogonal grid, aligned either to the cardinal directions or to the dominant orientation of the shape.

![Image](https://raw.githubusercontent.com/stefanocudini/orthogonalize-js/master/examples/orthogonalize.png)

## Usage

`Orthogonalize(options, geojson)` accepts any GeoJSON object (Geometry, Feature or FeatureCollection) containing LineString/Polygon geometries and returns a new orthogonalized GeoJSON; the input is not modified.

Options:

```js
const OrthoOpts = {
    orientationMode: "cardinal"   // align to north/south/east/west (default)
    //orientationMode: "original" // keep the dominant orientation of the shape
};
```

### Example with Node.js

```js
const fs = require('fs');
const Orthogonalize = require('orthogonalize-js');

const geojson = JSON.parse(fs.readFileSync('examples/shape.json', 'utf8'));

const geojsonOrto = Orthogonalize({ orientationMode: "cardinal" }, geojson);

fs.writeFileSync('shape_ortho.json', JSON.stringify(geojsonOrto, null, 2));
```

### Example with Leaflet

```html
<script src="https://unpkg.com/orthogonalize-js/orthogonalize.src.js"></script>
```

```js
var map = L.map('map', {
    zoom: 17,
    center: [42.31981, 12.69832],
    layers: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
});

var geoLayer = L.geoJson(null, { style: { color: '#0000ff', weight: 5 } }).addTo(map);
var geoOrto  = L.geoJson(null, { style: { color: '#ff0000', weight: 2 } }).addTo(map);

fetch('shape.json')
  .then(res => res.json())
  .then(geojson => {
      geoLayer.addData(geojson);
      geoOrto.addData( Orthogonalize(OrthoOpts, geojson) );
      map.fitBounds(geoLayer.getBounds());
  });
```

See the full demos in [examples/](examples/)
