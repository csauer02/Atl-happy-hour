/**
 * Main JavaScript File
 *
 * - Loads CSV data from your Google Sheet.
 * - Sorts and groups restaurants by neighborhood.
 * - Creates restaurant cards with original favicon & icon links.
 * - Uses dynamic geocoding from the MapsURL query parameter.
 * - Adds map markers that interact with card hover/click events.
 * - Implements day filtering and a "Happening Now" toggle.
 */

// Global variables for map, markers, and info window
let map;
let geocoder;
let infoWindow;
const markerMap = {};  // key: unique id for each restaurant, value: marker reference
let allRestaurants = [];  // Array of restaurant objects (each with a unique id)

// Initialize after Google Maps loads (callback from script tag)
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });
  geocoder = new google.maps.Geocoder();
  infoWindow = new google.maps.InfoWindow();

  // Load CSV data
  loadCSVData();
}

function loadCSVData() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      // Sort by neighborhood name (case-insensitive)
      const data = results.data.sort((a, b) => {
        const nA = (a.Neighborhood || '').toLowerCase();
        const nB = (b.Neighborhood || '').toLowerCase();
        return nA.localeCompare(nB);
      });
      // Assign a unique id to each restaurant
      data.forEach((row, index) => {
        row.id = index;
      });
      allRestaurants = data;
      renderRestaurants();
    },
    error: (err) => {
      console.error('Error parsing CSV:', err);
    }
  });
}

/**
 * renderRestaurants
 * Groups restaurants by neighborhood and renders cards.
 */
function renderRestaurants() {
  const container = document.getElementById('venue-container');
  container.innerHTML = '';

  // Group by neighborhood
  const groups = {};
  allRestaurants.forEach(restaurant => {
    const nb = restaurant.Neighborhood ? restaurant.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(restaurant);
  });

  // For each neighborhood, create a section with a sticky neighborhood band and cards
  for (const neighborhood in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    // Neighborhood sticky band
    const nbHeader = document.createElement('div');
    nbHeader.className = 'neighborhood-header';
    nbHeader.textContent = neighborhood;
    section.appendChild(nbHeader);

    // Container for restaurant cards
    const contentDiv = document.createElement('div');
    contentDiv.className = 'neighborhood-content';

    groups[neighborhood].forEach(restaurant => {
      const card = createRestaurantCard(restaurant);
      contentDiv.appendChild(card);
      // Geocode address and add marker for each restaurant
      const address = getAddressFromMapsURL(restaurant.MapsURL);
      if (address) {
        geocodeAddress(address, (location) => {
          if (location) {
            const marker = new google.maps.Marker({
              position: location,
              map: map,
              animation: google.maps.Animation.DROP
            });
            // Save marker with restaurant id
            markerMap[restaurant.id] = marker;

            // Prepare info window content
            const content = createInfoWindowContent(restaurant);
            marker.addListener('click', () => {
              infoWindow.setContent(content);
              infoWindow.open(map, marker);
              // Optionally pan the map to the marker
              map.panTo(marker.getPosition());
            });
          }
        });
      }
    });

    section.appendChild(contentDiv);
    container.appendChild(section);
  }
  // After rendering, apply current filters
  applyFilters();
}

/**
 * createRestaurantCard
 * Builds the HTML for a restaurant card using the restaurant object.
 */
function createRestaurantCard(restaurant) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);

  // Build favicon URL using helper
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);

  // Build the card inner HTML (favicon, restaurant name, deal description, and icon links)
  card.innerHTML = `
    <img class="rest-icon" src="${faviconURL}" alt="${restaurant.RestaurantName}" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    <div class="restaurant-details">
      <h2>${restaurant.RestaurantName}</h2>
      <p class="deal">${restaurant.Deal || ''}</p>
      <div class="icon-links">
        <a class="homepage-link" href="${restaurant.RestaurantURL}" target="_blank" title="Restaurant Homepage">
          <svg viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4h-2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"></path>
          </svg>
        </a>
        <a class="maps-link" href="${restaurant.MapsURL}" target="_blank" title="Google Maps">
          <svg viewBox="0 0 24 24">
            <path d="M21 10c0 5.5-9 13-9 13S3 15.5 3 10a9 9 0 1118 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </a>
      </div>
    </div>
  `;

  // Hover: highlight marker
  card.addEventListener('mouseover', () => {
    const marker = markerMap[restaurant.id];
    if (marker) {
      marker.setAnimation(google.maps.Animation.BOUNCE);
    }
  });
  card.addEventListener('mouseout', () => {
    const marker = markerMap[restaurant.id];
    if (marker) {
      marker.setAnimation(null);
    }
  });
  // Click: open info window and pan map to marker
  card.addEventListener('click', () => {
    const marker = markerMap[restaurant.id];
    if (marker) {
      const content = createInfoWindowContent(restaurant);
      infoWindow.setContent(content);
      infoWindow.open(map, marker);
      map.panTo(marker.getPosition());
    }
  });

  return card;
}

/**
 * getFaviconURL
 * Generates a favicon URL from the restaurant homepage URL.
 */
function getFaviconURL(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  } catch (error) {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
  }
}

/**
 * getAddressFromMapsURL
 * Extracts the address from a MapsURL in the format:
 *   https://maps.google.com/?q=Some+Address+Here
 */
function getAddressFromMapsURL(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    return params.get('q');
  } catch (e) {
    console.warn('Invalid Maps URL:', url);
    return null;
  }
}

/**
 * geocodeAddress
 * Uses the Google Geocoding service to get LatLng for an address.
 */
function geocodeAddress(address, callback) {
  geocoder.geocode({ address: address }, (results, status) => {
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
 * Builds HTML content (similar to the restaurant card) for the map info window.
 */
function createInfoWindowContent(restaurant) {
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);
  return `
    <div class="info-window">
      <img class="rest-icon" src="${faviconURL}" alt="${restaurant.RestaurantName}" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
      <h3>${restaurant.RestaurantName}</h3>
      <p class="deal">${restaurant.Deal || ''}</p>
      <div class="icon-links">
        <a class="homepage-link" href="${restaurant.RestaurantURL}" target="_blank" title="Restaurant Homepage">
          <svg viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4h-2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"></path>
          </svg>
        </a>
        <a class="maps-link" href="${restaurant.MapsURL}" target="_blank" title="Google Maps">
          <svg viewBox="0 0 24 24">
            <path d="M21 10c0 5.5-9 13-9 13S3 15.5 3 10a9 9 0 1118 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        </a>
      </div>
    </div>
  `;
}

/* Filtering Logic */

// Returns an array of active day filters (e.g., ['mon','wed']) or an empty array if "all" is active
function getActiveDayFilters() {
  const buttons = document.querySelectorAll('#day-filter button');
  let activeDays = [];
  buttons.forEach(btn => {
    if (btn.classList.contains('active')) {
      const day = btn.getAttribute('data-day');
      if (day !== 'all') activeDays.push(day);
    }
  });
  return activeDays;
}

/**
 * applyFilters
 * Filters restaurants based on:
 * 1. The "Happening Now" toggle (if on, uses the current weekday if Mon-Fri).
 * 2. The active day filter buttons (if any are selected other than "all").
 * Restaurants are shown only if at least one of the filtered day columns equals "yes".
 */
function applyFilters() {
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  const activeDays = getActiveDayFilters();
  let filterDays = [];

  // If "Happening Now" is active and today is Mon-Fri, use current day (short code: mon,tue,wed,thu,fri)
  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  if (happeningNow && todayIndex >= 1 && todayIndex <= 5) {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    filterDays.push(days[todayIndex]);
  } else if (activeDays.length > 0) {
    filterDays = activeDays;
  }
  // If no specific filter is active (or "All Days" is active), filterDays remains empty meaning show all.

  // Loop through each restaurant card and its marker
  document.querySelectorAll('.restaurant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    // Find the corresponding restaurant object
    const restaurant = allRestaurants.find(r => String(r.id) === id);
    let show = true;
    if (filterDays.length > 0) {
      // Check if any of the filtered day columns contains "yes" (case-insensitive)
      show = filterDays.some(day => {
        // Our CSV columns for days: use "Mon", "Tue", "Wed", "Thu", "Fri"
        const col = day.toUpperCase();
        return restaurant[col] && restaurant[col].toLowerCase() === 'yes';
      });
    }
    // Show/hide the card
    card.style.display = show ? '' : 'none';
    // Also update the marker visibility
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });
}

/* Day Filter Button & Happening Now Toggle Listeners */
function initFilterListeners() {
  // Day filter buttons: allow multi-select; "all" resets other selections
  const buttons = document.querySelectorAll('#day-filter button');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const day = btn.getAttribute('data-day');
      if (day === 'all') {
        // Reset all buttons: mark only "all" active
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      } else {
        // Toggle this button
        btn.classList.toggle('active');
        // If any non-"all" button is active, remove "all"
        let anyActive = Array.from(buttons).some(b => b.getAttribute('data-day') !== 'all' && b.classList.contains('active'));
        if (anyActive) {
          document.querySelector('#day-filter button[data-day="all"]').classList.remove('active');
        } else {
          // If none selected, revert to "all"
          document.querySelector('#day-filter button[data-day="all"]').classList.add('active');
        }
      }
      applyFilters();
    });
  });

  // Happening Now toggle
  document.getElementById('happening-now-toggle').addEventListener('change', () => {
    applyFilters();
  });
}

// Initialize filter listeners after DOM content is loaded
document.addEventListener('DOMContentLoaded', initFilterListeners);
