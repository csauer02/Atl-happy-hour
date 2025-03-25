/**
 * Main JavaScript File
 *
 * Implements:
 * 1) Fetching and parsing CSV data (PapaParse).
 * 2) Google Maps with dynamic geocoding of each venue's address.
 * 3) A day filter (All Days, Monday–Sunday) to show/hide venues.
 * 4) Updated styling & layout to match the new “Atlanta Socializers” brand.
 */

document.addEventListener('DOMContentLoaded', init);

/**
 * init
 * 
 * Main entry point once DOM is loaded.
 * - Parses the CSV from Google Sheets.
 * - Initializes the map.
 * - Sets up day filter logic.
 */
function init() {
  // CSV URL published from your Google Sheet (ensure it ends with &output=csv)
  const csvUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';

  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      console.log('CSV Data:', results.data);
      window.venuesData = results.data || [];
      // Initialize the map first (so it's ready to place markers).
      initMap();
      // Set up day filter buttons.
      initDayFilter();
      // Default to "all" day filter on load.
      updateUI('all');
    },
    error: (err) => {
      console.error('Error parsing CSV:', err);
    },
  });
}

/**
 * initMap
 *
 * Initializes the Google Map instance. This function sets a center in Atlanta,
 * but markers are added dynamically once we geocode each venue.
 */
function initMap() {
  // Create a map centered on Atlanta.
  window.map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
  });

  // Pre-initialize a place to store markers so we can clear them on filter changes.
  window.allMarkers = [];
}

/**
 * initDayFilter
 *
 * Attaches click listeners to each day filter button, so that when clicked,
 * the UI is updated to show only venues open on that day.
 */
function initDayFilter() {
  const buttons = document.querySelectorAll('#day-filter button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Remove 'active' class from all buttons
      buttons.forEach((b) => b.classList.remove('active'));
      // Add 'active' class to the clicked button
      btn.classList.add('active');
      // Update the UI based on the selected day
      const day = btn.getAttribute('data-day');
      updateUI(day);
    });
  });
}

/**
 * updateUI
 *
 * Re-renders the list of venues and the map markers based on the chosen day filter.
 * If `selectedDay` = "all", shows all venues. Otherwise, only shows venues
 * that are not marked "Closed" (or empty) on that day.
 *
 * @param {string} selectedDay - e.g. "all", "monday", "tuesday", ...
 */
function updateUI(selectedDay) {
  const container = document.getElementById('venue-list');
  container.innerHTML = '';

  // Clear existing markers from the map
  if (window.allMarkers && window.allMarkers.length) {
    window.allMarkers.forEach((m) => m.setMap(null));
  }
  window.allMarkers = [];

  // Filter the venue data based on the selected day
  const filteredData = window.venuesData.filter((venue) => {
    if (selectedDay === 'all') return true;
    // Check if this venue is "closed" or blank on the chosen day
    const dayValue = venue[getCsvColumnForDay(selectedDay)] || '';
    if (!dayValue || dayValue.toLowerCase().includes('closed')) {
      return false;
    }
    return true;
  });

  // For each venue in the filtered list, create a new HTML block + map marker
  filteredData.forEach((venue) => {
    // 1) Create the venue list item
    const venueDiv = document.createElement('div');
    venueDiv.classList.add('venue-item');

    // Build day-specific hours string
    let dayHoursHTML = '';
    if (selectedDay === 'all') {
      // Show all days
      dayHoursHTML = '<ul>';
      ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((day) => {
        const val = venue[day] || '';
        if (val && !val.toLowerCase().includes('closed')) {
          dayHoursHTML += `<li><strong>${day}:</strong> ${val}</li>`;
        }
      });
      dayHoursHTML += '</ul>';
    } else {
      // Show only the chosen day
      const chosenDayVal = venue[getCsvColumnForDay(selectedDay)] || '';
      dayHoursHTML = `<p><strong>${capitalize(selectedDay)}:</strong> ${chosenDayVal}</p>`;
    }

    // Basic address extraction (just the 'q' param from MapsURL)
    const address = getAddressFromMapsURL(venue.MapsURL) || '';

    // Build the final HTML
    venueDiv.innerHTML = `
      <h2>${venue.RestaurantName || ''}</h2>
      <p>${address}</p>
      ${dayHoursHTML}
      <p><a href="${venue.MapsURL || '#'}" target="_blank">View on Google Maps</a></p>
    `;

    container.appendChild(venueDiv);

    // 2) Geocode the venue and create a map marker
    const addressToGeocode = getAddressFromMapsURL(venue.MapsURL);
    if (addressToGeocode) {
      geocodeAddress(addressToGeocode, (location) => {
        if (location) {
          const marker = new google.maps.Marker({
            position: location,
            map: window.map,
          });

          const infoWindow = new google.maps.InfoWindow({
            content: createInfoWindowContent(venue),
          });

          marker.addListener('click', () => {
            infoWindow.open(window.map, marker);
          });

          window.allMarkers.push(marker);
        }
      });
    }
  });
}

/**
 * getAddressFromMapsURL
 *
 * Extracts the address from a Google Maps URL in the form:
 *   https://maps.google.com/?q=Some+Address+Here
 *
 * @param {string} url - The Maps URL
 * @returns {string|null} The address string or null
 */
function getAddressFromMapsURL(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    return params.get('q'); // the address after '?q='
  } catch (e) {
    console.warn('Invalid Maps URL:', url);
    return null;
  }
}

/**
 * geocodeAddress
 *
 * Uses the Google Maps Geocoding service to get lat/lng for an address.
 *
 * @param {string} address - The address to geocode
 * @param {function} callback - Receives the LatLng result or null on failure
 */
function geocodeAddress(address, callback) {
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address }, (results, status) => {
    if (status === 'OK' && results[0]) {
      callback(results[0].geometry.location);
    } else {
      console.error(`Geocoding failed for "${address}": ${status}`);
      callback(null);
    }
  });
}

/**
 * createInfoWindowContent
 *
 * Builds the HTML content for a Google Maps InfoWindow, showing:
 * - Venue name
 * - Address
 * - All day-by-day hours
 * - A link to the Google Maps URL
 *
 * @param {object} venue - A single venue record from the CSV
 * @returns {string} - HTML for the info window
 */
function createInfoWindowContent(venue) {
  const name = venue.RestaurantName || '';
  const address = getAddressFromMapsURL(venue.MapsURL) || '';
  const link = venue.MapsURL || '#';

  // Build a small list of hours for each day
  let hoursList = '<ul style="padding-left: 1em; margin: 0;">';
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].forEach((day) => {
    const val = venue[day] || '';
    if (val && !val.toLowerCase().includes('closed')) {
      hoursList += `<li><strong>${day}:</strong> ${val}</li>`;
    }
  });
  hoursList += '</ul>';

  return `
    <div style="max-width:250px;">
      <h3 style="margin-top:0;">${name}</h3>
      <p style="margin:0;">${address}</p>
      ${hoursList}
      <p style="margin-top:0.5rem;">
        <a href="${link}" target="_blank" style="color:#e40303; font-weight:bold;">View on Google Maps</a>
      </p>
    </div>
  `;
}

/**
 * getCsvColumnForDay
 *
 * Given a lowercase day string like "monday", returns the CSV column name ("Monday").
 *
 * @param {string} day - e.g. "monday", "tuesday"
 * @returns {string} e.g. "Monday", "Tuesday"
 */
function getCsvColumnForDay(day) {
  return day.charAt(0).toUpperCase() + day.slice(1).toLowerCase();
}

/**
 * capitalize
 *
 * Capitalizes the first letter of a string.
 *
 * @param {string} str
 * @returns {string}
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
