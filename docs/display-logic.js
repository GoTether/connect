async function reverseGeocode(lat, lon) {
  const res = await fetch(`https://api.opencagedata.com/geocode/v1/json?q=${lat}+${lon}&key=${OPENCAGE_API_KEY}`);
  const data = await res.json();
  if (!data?.results?.length) return `${lat}, ${lon}`;

  const components = data.results[0].components;
  const parts = [
    components.road,
    components.neighbourhood,
    components.suburb,
    components.city || components.town || components.village,
    components.state
  ].filter(Boolean);

  return parts.join(", ");
}
