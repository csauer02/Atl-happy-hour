/**
 * Main JavaScript File
 *
 * - Loads CSV data from your Google Sheet.
 * - Sorts and groups restaurants by neighborhood.
 * - Creates restaurant cards with favicon, name, deal description, and icon links.
 * - Dynamically geocodes each restaurant’s MapsURL.
 * - Places map markers that interact with card hover/click events.
 * - Implements filtering based on day and “Happening Now”.
 *
 * When a restaurant card is clicked, all markers are dimmed (low opacity and normal size)
 * except the selected marker—which is enlarged and fully opaque—and the map pans/zooms to it.
 */

// Global variables for map, geocoder, markers, and restaurant data
let map;
let geocoder;
let allRestaurants = [];  // Array of restaurant objects (each with a unique id)
const markerMap = {};     // key: restaurant id, value: marker reference

// Global marker icon objects (will be defined after the Maps API is ready)
let normalIcon, highlightedIcon;

/**
 * initMap
 * Called by the Google Maps API callback.
 */
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });
  geocoder = new google.maps.Geocoder();

  // Define marker icons after Maps API is loaded
  normalIcon = {
    url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
    scaledSize: new google.maps.Size(32, 32)
  };
  highlightedIcon = {
    url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
    scaledSize: new google.maps.Size(48, 48)
  };

  loadCSVData();
}

/**
 * loadCSVData
 * Loads CSV from Google Sheets, sorts by neighborhood, and assigns unique ids.
 */
function loadCSVData() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      const data = results.data.sort((a, b) => {
        const nA = (a.Neighborhood || '').toLowerCase();
        const nB = (b.Neighborhood || '').toLowerCase();
        return nA.localeCompare(nB);
      });
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
 * Groups restaurants by neighborhood and renders restaurant cards.
 */
function renderRestaurants() {
  const container = document.getElementById('venue-container');
  container.innerHTML = '';

  // Group restaurants by neighborhood
  const groups = {};
  allRestaurants.forEach(restaurant => {
    const nb = restaurant.Neighborhood ? restaurant.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(restaurant);
  });

  // Create a section for each neighborhood group
  for (const neighborhood in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    // Sticky neighborhood header
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

      // Geocode restaurant address and create a marker
      const address = getAddressFromMapsURL(restaurant.MapsURL);
      if (address) {
        geocodeAddress(address, (location) => {
          if (location) {
            const marker = new google.maps.Marker({
              position: location,
              map: map,
              animation: google.maps.Animation.DROP,
              icon: normalIcon
            });
            markerMap[restaurant.id] = marker;
          }
        });
      }
    });

    section.appendChild(contentDiv);
    container.appendChild(section);
  }

  // Apply current filters after rendering
  applyFilters();
}

/**
 * createRestaurantCard
 * Builds the HTML for a restaurant card.
 */
function createRestaurantCard(restaurant) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);

  // Get favicon URL from restaurant URL
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);

  // Build the card markup with two columns: left for text and icons; right for the favicon image.
  card.innerHTML = `
    <div class="restaurant-left">
      <div class="restaurant-top">
        <h2>${restaurant.RestaurantName}</h2>
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
      <div class="restaurant-deal">
        <p>${restaurant.Deal || ''}</p>
      </div>
    </div>
    <div class="restaurant-right">
      <img src="${faviconURL}" alt="${restaurant.RestaurantName}" onerror="this.onerror=null; this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    </div>
  `;

  // Hover: highlight marker (bounce effect)
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
  // Click: highlight marker (dim others, enlarge this one, pan/zoom to it)
  card.addEventListener('click', () => {
    highlightMarker(restaurant.id);
  });

  return card;
}

/**
 * getFaviconURL
 * Returns the favicon URL based on the restaurant's homepage.
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
 * Extracts the address (query parameter "q") from a Google Maps URL.
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
 * Uses the Google Geocoding service to obtain the location for an address.
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
 * highlightMarker
 * Dims all markers and highlights the marker corresponding to selectedId.
 * Pans and zooms the map to that marker.
 */
function highlightMarker(selectedId) {
  Object.keys(markerMap).forEach(key => {
    const marker = markerMap[key];
    if (Number(key) === Number(selectedId)) {
      marker.setIcon(highlightedIcon);
      marker.setOpacity(1);
      map.panTo(marker.getPosition());
      map.setZoom(16);
    } else {
      marker.setIcon(normalIcon);
      marker.setOpacity(0.3);
    }
  });
}

/**
 * getActiveDayFilters
 * Returns an array of active day filters (e.g., ['mon', 'wed']) or empty if "all" is active.
 */
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
 * Helper: getCsvColumn
 * Converts a short day code (e.g. "mon") to the CSV column name (e.g. "Mon").
 */
function getCsvColumn(day) {
  const mapping = { 'mon': 'Mon', 'tue': 'Tue', 'wed': 'Wed', 'thu': 'Thu', 'fri': 'Fri' };
  return mapping[day] || day;
}

/**
 * applyFilters
 * Filters restaurants based on:
 * - The "Happening Now" toggle (if active, uses the current weekday for Mon-Fri).
 * - The active day filter buttons (if any are selected besides "all").
 * A restaurant is shown if its CSV column (e.g., "Mon") equals "yes".
 */
function applyFilters() {
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  const activeDays = getActiveDayFilters();
  let filterDays = [];

  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  if (happeningNow && todayIndex >= 1 && todayIndex <= 5) {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    filterDays.push(days[todayIndex]);
  } else if (activeDays.length > 0) {
    filterDays = activeDays;
  }
  
  document.querySelectorAll('.restaurant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const restaurant = allRestaurants.find(r => String(r.id) === id);
    let show = true;
    if (filterDays.length > 0) {
      show = filterDays.some(day => {
        const col = getCsvColumn(day);
        return restaurant[col] && restaurant[col].toLowerCase() === 'yes';
      });
    }
    card.style.display = show ? '' : 'none';
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });
}

/* Listeners for Day Filter Buttons & Happening Now Toggle */
function initFilterListeners() {
  const dayButtons = document.querySelectorAll('#day-filter button');
  const happeningNowToggle = document.getElementById('happening-now-toggle');
  const allButton = document.querySelector('#day-filter button[data-day="all"]');
  // Mapping: 1=Mon, 2=Tue, etc.
  const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };

  // When the "Happening Now" toggle changes:
  happeningNowToggle.addEventListener('change', function() {
    if (this.checked) {
      // Determine current day (if Mon-Fri)
      const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, etc.
      if (dayMapping[todayIndex]) {
        dayButtons.forEach(btn => {
          // Set active only on the current day
          if (btn.getAttribute('data-day') === dayMapping[todayIndex]) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        // Remove "all" selection
        allButton.classList.remove('active');
      } else {
        // For weekend days, simply clear specific filters (or you might leave "all" active)
        dayButtons.forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
      }
    } else {
      // Toggle off: clear all day filters; revert to "All Days"
      dayButtons.forEach(btn => btn.classList.remove('active'));
      allButton.classList.add('active');
    }
    applyFilters();
  });

  // When a day filter button is clicked:
  dayButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const day = btn.getAttribute('data-day');

      if (day === 'all') {
        // Clear all other selections, ensure "all" is active,
        // and clear the "Happening Now" toggle.
        dayButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (happeningNowToggle.checked) {
          happeningNowToggle.checked = false;
        }
      } else {
        // If any specific day is clicked while "Happening Now" is on, turn it off.
        if (happeningNowToggle.checked) {
          happeningNowToggle.checked = false;
        }
        // Toggle the selected day button
        btn.classList.toggle('active');
        // Remove "all" if any specific day is active
        const anySpecificActive = Array.from(dayButtons).some(b => 
          b.getAttribute('data-day') !== 'all' && b.classList.contains('active')
        );
        if (anySpecificActive) {
          allButton.classList.remove('active');
        } else {
          // If none selected, revert to "all"
          allButton.classList.add('active');
        }

        // If only the current day is active, automatically set the "Happening Now" toggle
        const activeDays = Array.from(dayButtons)
          .filter(b => b.getAttribute('data-day') !== 'all' && b.classList.contains('active'))
          .map(b => b.getAttribute('data-day'));
        const todayIndex = new Date().getDay();
        const currentDay = dayMapping[todayIndex] || null;
        if (currentDay && activeDays.length === 1 && activeDays[0] === currentDay) {
          happeningNowToggle.checked = true;
        }
      }
      applyFilters();
    });
  });
}


// Initialize filter listeners after DOM content loads
document.addEventListener('DOMContentLoaded', initFilterListeners);
