// shared/argus-geo.js
// Argus Geometry & Distance Calculator Library
// Shared across satellite, finance, and any page with spatial data.
// Provides: distance, bearing, area, point registry, distance-to picker UI.

window.ArgusGeo = (function() {
  'use strict';

  var R_KM = 6371; // Earth radius in km

  // ── Core Math ──

  function toRad(deg) { return deg * Math.PI / 180; }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  /** Haversine distance between two points in km */
  function distance(lat1, lon1, lat2, lon2) {
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Initial bearing from point 1 to point 2 in degrees (0-360) */
  function bearing(lat1, lon1, lat2, lon2) {
    var dLon = toRad(lon2 - lon1);
    var y = Math.sin(dLon) * Math.cos(toRad(lat2));
    var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  /** Midpoint between two coordinates */
  function midpoint(lat1, lon1, lat2, lon2) {
    var dLon = toRad(lon2 - lon1);
    var Bx = Math.cos(toRad(lat2)) * Math.cos(dLon);
    var By = Math.cos(toRad(lat2)) * Math.sin(dLon);
    var lat3 = Math.atan2(
      Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)),
      Math.sqrt((Math.cos(toRad(lat1)) + Bx) * (Math.cos(toRad(lat1)) + Bx) + By * By)
    );
    var lon3 = toRad(lon1) + Math.atan2(By, Math.cos(toRad(lat1)) + Bx);
    return { lat: toDeg(lat3), lon: toDeg(lon3) };
  }

  /** Destination point given start, bearing (degrees), and distance (km) */
  function destination(lat, lon, bearingDeg, distKm) {
    var d = distKm / R_KM;
    var brng = toRad(bearingDeg);
    var lat1 = toRad(lat);
    var lon1 = toRad(lon);
    var lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    var lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
    return { lat: toDeg(lat2), lon: toDeg(lon2) };
  }

  /** Area of a circle in km² given radius in km */
  function circleArea(radiusKm) {
    return Math.PI * radiusKm * radiusKm;
  }

  /** Total distance along an array of [lat, lon] points */
  function polylineLength(points) {
    var total = 0;
    for (var i = 1; i < points.length; i++) {
      total += distance(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    }
    return total;
  }

  /** Area of a polygon (array of [lat, lon]) using spherical excess — km² */
  function polygonArea(points) {
    if (points.length < 3) return 0;
    // Shoelface on sphere approximation (good for small-to-medium polygons)
    var total = 0;
    for (var i = 0; i < points.length; i++) {
      var j = (i + 1) % points.length;
      total += toRad(points[j][1] - points[i][1]) *
               (2 + Math.sin(toRad(points[i][0])) + Math.sin(toRad(points[j][0])));
    }
    return Math.abs(total * R_KM * R_KM / 2);
  }

  /** Check if two circles overlap. Returns overlap distance (negative = gap) */
  function circlesOverlap(lat1, lon1, r1km, lat2, lon2, r2km) {
    var d = distance(lat1, lon1, lat2, lon2);
    return (r1km + r2km) - d; // positive = overlap
  }

  /** Intersection area of two overlapping circles (km²) — lens/vesica piscis */
  function circleIntersectionArea(lat1, lon1, r1km, lat2, lon2, r2km) {
    var d = distance(lat1, lon1, lat2, lon2);
    if (d >= r1km + r2km) return 0; // no overlap
    if (d + r1km <= r2km) return Math.PI * r1km * r1km; // circle 1 inside circle 2
    if (d + r2km <= r1km) return Math.PI * r2km * r2km; // circle 2 inside circle 1

    var r = r1km, R = r2km;
    var part1 = r * r * Math.acos((d * d + r * r - R * R) / (2 * d * r));
    var part2 = R * R * Math.acos((d * d + R * R - r * r) / (2 * d * R));
    var part3 = 0.5 * Math.sqrt((-d + r + R) * (d + r - R) * (d - r + R) * (d + r + R));
    return part1 + part2 - part3;
  }

  // ── Formatting ──

  function formatDist(km, useMiles) {
    if (useMiles) {
      var mi = km * 0.621371;
      return mi < 1 ? (mi * 5280).toFixed(0) + ' ft' : mi.toFixed(2) + ' mi';
    }
    return km < 1 ? (km * 1000).toFixed(0) + ' m' : km.toFixed(2) + ' km';
  }

  function formatArea(km2, useMiles) {
    if (useMiles) {
      return (km2 * 0.386102).toFixed(3) + ' mi²';
    }
    return km2 < 1 ? (km2 * 1e6).toFixed(0) + ' m²' : km2.toFixed(3) + ' km²';
  }

  function formatBearing(deg) {
    var dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return Math.round(deg) + '° ' + dirs[Math.round(deg / 22.5) % 16];
  }

  // ── Point Registry ──
  // Pages register their point sources; the picker aggregates them all.

  var _pointSources = []; // [{name, icon, fn}] — fn() returns [{lat, lon, label}]

  function registerPointSource(name, icon, fn) {
    _pointSources.push({ name: name, icon: icon, fn: fn });
  }

  function getAllPoints() {
    var pts = [];
    for (var i = 0; i < _pointSources.length; i++) {
      var src = _pointSources[i];
      try {
        var srcPts = src.fn();
        for (var j = 0; j < srcPts.length; j++) {
          srcPts[j].source = src.name;
          srcPts[j].icon = srcPts[j].icon || src.icon;
        }
        pts = pts.concat(srcPts);
      } catch (e) { /* source not available */ }
    }
    return pts;
  }

  // ── Public API ──
  return {
    distance: distance,
    bearing: bearing,
    midpoint: midpoint,
    destination: destination,
    circleArea: circleArea,
    polylineLength: polylineLength,
    polygonArea: polygonArea,
    circlesOverlap: circlesOverlap,
    circleIntersectionArea: circleIntersectionArea,
    formatDist: formatDist,
    formatArea: formatArea,
    formatBearing: formatBearing,
    registerPointSource: registerPointSource,
    getAllPoints: getAllPoints,
    R_KM: R_KM
  };
})();
