const haversine = require('haversine-distance');

/**
 * Calculates distance in meters between two coordinates and checks if within maximum radius
 * @param {{ lat: number, lng: number } | { latitude: number, longitude: number }} teacherLoc 
 * @param {{ lat: number, lng: number } | { latitude: number, longitude: number }} studentLoc 
 * @param {number} maxRadiusMeters - default is 30 meters
 * @returns {{ isWithinRange: boolean, distance: number }}
 */
const checkLocation = (teacherLoc, studentLoc, maxRadiusMeters = 30) => {
  if (!teacherLoc || !studentLoc) {
    return { isWithinRange: false, distance: Infinity };
  }

  // Format locations for haversine-distance package: { latitude, longitude } or [lat, lon]
  const p1 = {
    latitude: Number(teacherLoc.lat ?? teacherLoc.latitude),
    longitude: Number(teacherLoc.lng ?? teacherLoc.longitude)
  };

  const p2 = {
    latitude: Number(studentLoc.lat ?? studentLoc.latitude),
    longitude: Number(studentLoc.lng ?? studentLoc.longitude)
  };

  if (isNaN(p1.latitude) || isNaN(p1.longitude) || isNaN(p2.latitude) || isNaN(p2.longitude)) {
    return { isWithinRange: false, distance: Infinity };
  }

  const distance = haversine(p1, p2); // returns distance in meters
  const isWithinRange = distance <= maxRadiusMeters;

  return {
    isWithinRange,
    distance: Math.round(distance * 10) / 10 // rounded to 1 decimal place
  };
};

module.exports = {
  checkLocation
};
