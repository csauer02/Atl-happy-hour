/**
 * Main JavaScript File
 *
 * Maintains the original filtering logic (day filters + "Happening Now"),
 * loads CSV data, renders restaurants in a single "sidebar" panel, and
 * displays a Google Map. The layout is handled in normal flow by CSS,
 * so the header/footer can expand/wrap and the sidebar/map can be rearranged
 * in mobile portrait mode.
 */

/* ================================
   GLOBAL VARIABLES
================================ */
let map;                         // Google Map instance
let geocoder;                    // Geocoder for converting addresses
let allRestaurants = [];         // Array holding all restaurant data from CSV
const markerMap = {};            // Mapping: restaurant.id => google.maps.Marker

/* ================================
   MAP INITIALIZATION & DATA LOADING
================================ */
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });
  geocoder = new google.maps.Geocoder();

  loadCSVData();
}

// Loads restaurant data via PapaParse from a published CSV
function loadCSVData() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      // Sort by neighborhood name
      const data = results.data.sort((a, b) => {
        const nA = (a.Neighborhood || '').toLowerCase();
        const nB = (b.Neighborhood || '').toLowerCase();
        return nA.localeCompare(nB);
      });
      // Assign an ID to each row
      data.forEach((row, i) => {
        row.id = i;
      });
      allRestaurants = data;

      // Render the initial view and apply filters
      renderDesktopView();
      applyFilters();
    },
    error: (err) => {
      console.error('Error parsing CSV:', err);
    }
  });
}

/* ================================
   DESKTOP-LIKE VIEW (Sidebar)
================================ */
// Renders the restaurant list grouped by neighborhood into #venue-container.
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return;
  container.innerHTML = '';

  // Group by neighborhood
  const groups = {};
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(r);
  });

  // Build sections
  for (const nb in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    // Neighborhood header
    const nbHeader = document.createElement('div');
    nbHeader.className = 'neighborhood-header';
    nbHeader.textContent = nb;
    nbHeader.addEventListener('click', () => {
      const bounds = new google.maps.LatLngBounds();
      groups[nb].forEach(r => {
        const marker = markerMap[r.id];
        if (marker) {
          bounds.extend(marker.getPosition());
        }
      });
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }
    });
    section.appendChild(nbHeader);

    // Cards
    const contentDiv = document.createElement('div');
    contentDiv.className = 'neighborhood-content';

    groups[nb].forEach(restaurant => {
      const card = createRestaurantCard(restaurant);
      contentDiv.appendChild(card);
      createOrUpdateMarker(restaurant);
    });

    section.appendChild(contentDiv);
    container.appendChild(section);
  }
}

/* ================================
   MAP MARKERS
================================ */
// Creates or updates a marker for a restaurant using geocoder
function createOrUpdateMarker(restaurant) {
  if (!markerMap[restaurant.id]) {
    const address = getAddressFromMapsURL(restaurant.MapsURL);
    if (!address) return;
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const marker = new google.maps.Marker({
          position: results[0].geometry.location,
          map: map,
          opacity: 0.3, // start dim
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          }
        });
        markerMap[restaurant.id] = marker;
        marker.addListener('click', () => selectRestaurant(restaurant.id));
      } else {
        console.warn('Geocode failed for address:', address, 'Status:', status);
      }
    });
  }
}

/* ================================
   RESTAURANT CARD CREATION
================================ */
function createRestaurantCard(restaurant) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);

  const faviconURL = getFaviconURL(restaurant.RestaurantURL);

  card.innerHTML = `
    <div class="restaurant-left">
      <div class="restaurant-top">
        <h2>${restaurant.RestaurantName || ''}</h2>
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
    <div class="restaurant-right" style="width:48px; height:48px;">
      <img src="${faviconURL}" alt="${restaurant.RestaurantName}"
           onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    </div>
  `;

  card.addEventListener('click', () => {
    selectRestaurant(restaurant.id);
  });

  return card;
}

/**
 * getFaviconURL: Returns a Google S2 favicon URL for a restaurant's domain
 */
function getFaviconURL(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  } catch (e) {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
  }
}

/**
 * getAddressFromMapsURL: Extracts "q" parameter from a Google Maps URL
 */
function getAddressFromMapsURL(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);
    return params.get('q');
  } catch (e) {
    return null;
  }
}

/* ================================
   RESTAURANT SELECTION
================================ */
function selectRestaurant(selectedId) {
  // Markers
  Object.keys(markerMap).forEach(key => {
    const marker = markerMap[key];
    if (Number(key) === Number(selectedId)) {
      marker.setOpacity(1);
      map.panTo(marker.getPosition());
      map.setZoom(16);
    } else {
      marker.setOpacity(0.3);
    }
  });

  // Cards
  document.querySelectorAll('.restaurant-card').forEach(card => {
    card.classList.remove('selected');
  });
  const selectedCard = document.querySelector(`.restaurant-card[data-id="${selectedId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    // Scroll the selected card into view (no special mobile portrait logic needed)
    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ================================
   FILTER LOGIC
================================ */
// Returns an array of active day filters
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

// Maps day abbreviations to CSV column names
function getCsvColumn(day) {
  const mapping = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
  return mapping[day] || day;
}

// Check if a restaurant should be visible based on day/happening-now
function isRestaurantVisible(restaurant) {
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  const activeDays = getActiveDayFilters();
  let filterDays = [];
  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, ...
  if (happeningNow && todayIndex >= 1 && todayIndex <= 5) {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    filterDays.push(days[todayIndex]);
  } else if (activeDays.length > 0) {
    filterDays = activeDays;
  }

  if (filterDays.length > 0) {
    return filterDays.some(day => {
      const col = getCsvColumn(day);
      return restaurant[col] && restaurant[col].toLowerCase() === 'yes';
    });
  }
  return true;
}

// Applies the filter to hide/show cards and markers
function applyFilters() {
  document.querySelectorAll('.restaurant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const r = allRestaurants.find(x => String(x.id) === id);
    let show = true;
    if (r) {
      show = isRestaurantVisible(r);
    }
    card.style.display = show ? '' : 'none';

    // Hide/show marker
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });

  // Hide entire neighborhood sections if none of their cards are visible
  document.querySelectorAll('.neighborhood-section').forEach(section => {
    const visibleCards = section.querySelectorAll('.restaurant-card:not([style*="display: none"])');
    section.style.display = visibleCards.length ? '' : 'none';
  });
}

/* ================================
   FILTER LISTENERS
================================ */
function initFilterListeners() {
  const dayButtons = document.querySelectorAll('#day-filter button');
  const happeningNowToggle = document.getElementById('happening-now-toggle');
  const allButton = document.querySelector('#day-filter button[data-day="all"]');
  const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };

  // "Happening Now" toggle
  happeningNowToggle.addEventListener('change', function() {
    if (this.checked) {
      const todayIndex = new Date().getDay();
      if (dayMapping[todayIndex]) {
        dayButtons.forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('data-day') === dayMapping[todayIndex]);
        });
        allButton.classList.remove('active');
      } else {
        dayButtons.forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
      }
    } else {
      dayButtons.forEach(btn => btn.classList.remove('active'));
      allButton.classList.add('active');
    }
    applyFilters();
  });

  // Day filter buttons
  dayButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const day = btn.getAttribute('data-day');
      if (day === 'all') {
        dayButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (happeningNowToggle.checked) {
          happeningNowToggle.checked = false;
        }
      } else {
        if (happeningNowToggle.checked) {
          happeningNowToggle.checked = false;
        }
        btn.classList.toggle('active');
        const anyActive = Array.from(dayButtons).some(b => b.getAttribute('data-day') !== 'all' && b.classList.contains('active'));
        if (anyActive) {
          allButton.classList.remove('active');
        } else {
          allButton.classList.add('active');
        }
        // If only the current weekday is active => auto "Happening Now"
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

// Initialize filter listeners once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initFilterListeners);