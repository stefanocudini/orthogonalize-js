
(function (factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD
        define([], factory);
    } else if (typeof module !== 'undefined' && module.exports) {
        // Node/CommonJS
        module.exports = factory();
    } else {
        // Browser globals
        window.Orthogonalize = factory();
    }
})(function () {

    "use strict";

    const EARTH_RADIUS = 6371008.8;
    const DEG = Math.PI / 180;
    const RAD = 180 / Math.PI;

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function project(lon, lat, centerLon, centerLat) {

        const lambda = lon * DEG;
        const phi = lat * DEG;
        const lambda0 = centerLon * DEG;
        const phi0 = centerLat * DEG;

        const dLambda = lambda - lambda0;

        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);
        const sinPhi0 = Math.sin(phi0);
        const cosPhi0 = Math.cos(phi0);

        const cosC =
            sinPhi0 * sinPhi +
            cosPhi0 * cosPhi * Math.cos(dLambda);

        const c = Math.acos(
            Math.max(-1, Math.min(1, cosC))
        );

        if (c < 1e-12) {
            return { x: 0, y: 0 };
        }

        const k = c / Math.sin(c);

        return {
            x: EARTH_RADIUS * k * cosPhi * Math.sin(dLambda),
            y: EARTH_RADIUS * k * (
                cosPhi0 * sinPhi -
                sinPhi0 * cosPhi * Math.cos(dLambda)
            )
        };
    }

    function unproject(x, y, centerLon, centerLat) {

        const lambda0 = centerLon * DEG;
        const phi0 = centerLat * DEG;

        const rho = Math.hypot(x, y);

        if (rho < 1e-8) {
            return [centerLon, centerLat];
        }

        const c = rho / EARTH_RADIUS;
        const sinC = Math.sin(c);
        const cosC = Math.cos(c);

        const sinPhi0 = Math.sin(phi0);
        const cosPhi0 = Math.cos(phi0);

        const phi = Math.asin(
            cosC * sinPhi0 +
            (y * sinC * cosPhi0) / rho
        );

        const lambda = lambda0 + Math.atan2(
            x * sinC,
            rho * cosPhi0 * cosC -
            y * sinPhi0 * sinC
        );

        return [lambda * RAD, phi * RAD];
    }

    class DSU {

        constructor(n) {
            this.parent = Array.from({ length: n }, (_, i) => i);
            this.rank = new Array(n).fill(0);
        }

        find(x) {
            if (this.parent[x] !== x) {
                this.parent[x] = this.find(this.parent[x]);
            }
            return this.parent[x];
        }

        union(a, b) {

            let ra = this.find(a);
            let rb = this.find(b);

            if (ra === rb) return;

            if (this.rank[ra] < this.rank[rb]) {
                [ra, rb] = [rb, ra];
            }

            this.parent[rb] = ra;

            if (this.rank[ra] === this.rank[rb]) {
                this.rank[ra]++;
            }
        }

        average(values) {

            const sums = new Map();

            values.forEach((value, i) => {

                const root = this.find(i);

                if (!sums.has(root)) {
                    sums.set(root, { sum: 0, count: 0 });
                }

                const item = sums.get(root);
                item.sum += value;
                item.count++;
            });

            return values.map((_, i) => {
                const item = sums.get(this.find(i));
                return item.sum / item.count;
            });
        }
    }

    // Orientamento orginale
    function dominantOrientation(points) {

        let sumCos = 0;
        let sumSin = 0;

        for (let i = 0; i < points.length - 1; i++) {

            const dx = points[i + 1].x - points[i].x;
            const dy = points[i + 1].y - points[i].y;
            const length = Math.hypot(dx, dy);

            if (length < 1e-8) continue;

            const angle = Math.atan2(dy, dx);

            sumCos += length * Math.cos(4 * angle);
            sumSin += length * Math.sin(4 * angle);
        }

        if (Math.hypot(sumCos, sumSin) < 1e-10) {
            return 0;
        }

        return Math.atan2(sumSin, sumCos) / 4;
    }

    // Ortogonalizzazione di una linea o di un anello
    function orthogonalizePath(coords, closed, orientationMode) {

        if (!Array.isArray(coords) || coords.length < 3) {
            return coords;
        }

        let input = coords.slice();

        // Rimuove temporaneamente il punto finale duplicato
        if (closed) {

            const first = input[0];
            const last = input[input.length - 1];

            if (
                first[0] === last[0] &&
                first[1] === last[1]
            ) {
                input.pop();
            }
        }

        const n = input.length;

        if (n < 3) return coords;

        // Centro della proiezione
        let centerLon = 0;
        let centerLat = 0;

        input.forEach(p => {
            centerLon += p[0];
            centerLat += p[1];
        });

        centerLon /= n;
        centerLat /= n;

        // Proiezione metrica
        const points = input.map(p =>
            project(p[0], p[1], centerLon, centerLat)
        );

        // Orientamento della griglia
        let angle = 0;

        if (orientationMode === "original") {
            angle = dominantOrientation(
                closed ? points.concat([points[0]]) : points
            );
        }

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        // Rotazione nella griglia ortogonale
        const grid = points.map(p => ({
            x: p.x * cos + p.y * sin,
            y: -p.x * sin + p.y * cos
        }));

        const dsuX = new DSU(n);
        const dsuY = new DSU(n);

        const edgeCount = closed ? n : n - 1;

        // Classificazione dei segmenti
        for (let i = 0; i < edgeCount; i++) {

            const j = (i + 1) % n;

            const dx = grid[j].x - grid[i].x;
            const dy = grid[j].y - grid[i].y;

            if (Math.hypot(dx, dy) < 1e-8) continue;

            if (Math.abs(dx) >= Math.abs(dy)) {
                // Segmento orizzontale: stessa Y
                dsuY.union(i, j);
            } else {
                // Segmento verticale: stessa X
                dsuX.union(i, j);
            }
        }

        // Allineamento delle coordinate
        const xs = dsuX.average(grid.map(p => p.x));
        const ys = dsuY.average(grid.map(p => p.y));

        // Rotazione inversa e ritorno a lon/lat
        const result = grid.map((p, i) => {

            const x = xs[i];
            const y = ys[i];

            const originalX = x * cos - y * sin;
            const originalY = x * sin + y * cos;

            const lonlat = unproject(
                originalX,
                originalY,
                centerLon,
                centerLat
            );

            return lonlat.concat(input[i].slice(2));
        });

        // Chiusura dell'anello
        if (closed) {
            result.push(result[0].slice());
        }

        return result;
    }

    // Elaborazione geometrie
    function processGeometry(geometry, orientationMode) {

        if (!geometry) return geometry;

        const g = clone(geometry);

        switch (g.type) {

            case "LineString":

                g.coordinates = orthogonalizePath(
                    g.coordinates,
                    false,
                    orientationMode
                );

                break;

            case "MultiLineString":

                g.coordinates = g.coordinates.map(line =>
                    orthogonalizePath(line, false, orientationMode)
                );

                break;

            case "Polygon":

                // Solo anello esterno: i buchi vengono ignorati
                if (g.coordinates.length > 0) {
                    g.coordinates[0] = orthogonalizePath(
                        g.coordinates[0],
                        true,
                        orientationMode
                    );
                }

                break;

            case "MultiPolygon":

                // Solo anello esterno di ciascun poligono
                g.coordinates = g.coordinates.map(polygon => {

                    if (polygon.length > 0) {
                        polygon[0] = orthogonalizePath(
                            polygon[0],
                            true,
                            orientationMode
                        );
                    }

                    return polygon;
                });

                break;

            case "GeometryCollection":

                g.geometries = g.geometries.map(geometry =>
                    processGeometry(geometry, orientationMode)
                );

                break;

            case "Point":
            case "MultiPoint":
                break;
        }

        return g;
    }

    // Elaborazione GeoJSON
    function processGeoJSON(obj, orientationMode) {

        if (!obj) return obj;

        const result = clone(obj);

        switch (result.type) {

            case "Feature":

                result.geometry = processGeometry(
                    result.geometry,
                    orientationMode
                );

                break;

            case "FeatureCollection":

                result.features = result.features.map(feature =>
                    processGeoJSON(feature, orientationMode)
                );

                break;

            case "GeometryCollection":

                result.geometries = result.geometries.map(geometry =>
                    processGeometry(geometry, orientationMode)
                );

                break;

            default:

                return processGeometry(result, orientationMode);
        }

        return result;
    }

    function Orthogonalize(options, geojson) {

        options = options || {};

        const orientationMode = options.orientationMode || "cardinal";

        if (!geojson || typeof geojson !== "object") {
            throw new Error("GeoJSON non valido");
        }

        return processGeoJSON(geojson, orientationMode);
    }

    return Orthogonalize;

});
