/**
 * Main JavaScript File for ATL Happy Hour
 *
 * This version retains the full filtering logic and sticky neighborhood headers.
 * It always uses the desktop view (sidebar + map) on desktop and mobile landscape.
 * In mobile portrait mode, the layout is changed so that:
 *   - The header remains at the top.
 *   - The restaurant panel (sidebar) appears below the header and takes 40% of available vertical space.
 *   - The map view appears below the restaurant panel and takes the remaining 60%.
 *   - The footer is fixed to the bottom.
 *
 * The available vertical height is computed dynamically (viewport height minus header and footer heights).
 */

/* ================================
   GLOBAL VARIABLES
================================ */
let map;
let geocoder;
let allRestaurants = [];
const markerMap = {};

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

function loadCSVData() {
  const csvUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: results => {
      const data = results.data.sort((a, b) => {
        const nA = (a.Neighborhood || '').toLowerCase();
        const nB = (b.Neighborhood || '').toLowerCase();
        return nA.localeCompare(nB);
      });
      data.forEach((row, i) => { row.id = i; });
      allRestaurants = data;
      renderDesktopView();
      applyFilters();
      updateMainContentHeight();
    },
    error: err => {
      console.error('Error parsing CSV:', err);
    }
  });
}

/* ================================
   LAYOUT ADJUSTMENT
================================ */
// In desktop and mobile landscape, use the standard sidebar+map layout.
// In mobile portrait, dynamically set the main content height.
function updateMainContentHeight() {
  const header = document.getElementById('global-header');
  const footer = document.getElementById('global-footer');
  const mainContent = document.getElementById('main-content');
  
  // Get computed heights (if header/footer wrap, use their actual height)
  const headerHeight = header.getBoundingClientRect().height;
  const footerHeight = footer.getBoundingClientRect().height;
  const availableHeight = window.innerHeight - headerHeight - footerHeight;
  
  // If in mobile portrait mode, set main content height dynamically and adjust panels
  if (window.innerWidth <= 800 && window.innerHeight > window.innerWidth) {
    mainContent.style.height = availableHeight + 'px';
    // Set sidebar (restaurant panel) height to 40% and map container to 60%
    document.getElementById('sidebar').style.height = (availableHeight * 0.4) + 'px';
    document.getElementById('map-container').style.height = (availableHeight * 0.6) + 'px';
  } else {
    // In desktop/landscape, remove any inline height
    mainContent.style.height = '';
    document.getElementById('sidebar').style.height = '';
    document.getElementById('map-container').style.height = '';
  }
}

// Call updateMainContentHeight on resize/orientation change.
function updateLayout() {
  if (window.innerWidth <= 800 && window.innerHeight > window.innerWidth) {
    // Mobile portrait: adjust main content height dynamically.
    updateMainContentHeight();
  } else {
    // Desktop and mobile landscape: ensure main content flows normally.
    document.getElementById('main-content').style.height = '';
    document.getElementById('sidebar').style.height = '';
    document.getElementById('map-container').style.height = '';
  }
  // Always render the desktop view.
  renderDesktopView();
  applyFilters();
}

/* ================================
   DESKTOP VIEW RENDERING
================================ */
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return;
  container.innerHTML = '';

  const groups = {};
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(r);
  });
  for (const nb in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    const nbHeader = document.createElement('div');
    nbHeader.className = 'neighborhood-header';
    nbHeader.textContent = nb;
    nbHeader.addEventListener('click', () => {
      const bounds = new google.maps.LatLngBounds();
      groups[nb].forEach(r => {
        const marker = markerMap[r.id];
        if (marker) bounds.extend(marker.getPosition());
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds);
    });
    section.appendChild(nbHeader);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'neighborhood-content';
    groups[nb].forEach(r => {
      const card = createRestaurantCard(r);
      contentDiv.appendChild(card);
      createOrUpdateMarker(r);
    });
    section.appendChild(contentDiv);
    container.appendChild(section);
  }
}

/* ================================
   MAP MARKERS
================================ */
function createOrUpdateMarker(restaurant) {
  if (!markerMap[restaurant.id]) {
    const address = getAddressFromMapsURL(restaurant.MapsURL);
    if (!address) return;
    geocoder.geocode({ address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const marker = new google.maps.Marker({
          position: results[0].geometry.location,
          map: map,
          opacity: 0.3,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          }
        });
        markerMap[restaurant.id] = marker;
        marker.addListener('click', () => selectRestaurant(restaurant.id));
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
    <div class="restaurant-right">
      <img src="${faviconURL}" alt="${restaurant.RestaurantName}"
           onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    </div>
  `;

  card.addEventListener('click', () => selectRestaurant(restaurant.id));

  return card;
}

function getFaviconURL(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  } catch (e) {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
  }
}

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
  document.querySelectorAll('.restaurant-card').forEach(card => card.classList.remove('selected'));
  const selectedCard = document.querySelector(`.restaurant-card[data-id="${selectedId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/* ================================
   FILTER LOGIC
================================ */
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
function getCsvColumn(day) {
  const mapping = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
  return mapping[day] || day;
}
function isRestaurantVisible(restaurant) {
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  const activeDays = getActiveDayFilters();
  let filterDays = [];
  const todayIndex = new Date().getDay();
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
function applyFilters() {
  document.querySelectorAll('.restaurant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const r = allRestaurants.find(x => String(x.id) === id);
    let show = true;
    if (r) {
      show = isRestaurantVisible(r);
    }
    card.style.display = show ? '' : 'none';
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });
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

  dayButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const day = btn.getAttribute('data-day');
      if (day === 'all') {
        dayButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (happeningNowToggle.checked) happeningNowToggle.checked = false;
      } else {
        if (happeningNowToggle.checked) happeningNowToggle.checked = false;
        btn.classList.toggle('active');
        const anyActive = Array.from(dayButtons).some(b =>
          b.getAttribute('data-day') !== 'all' && b.classList.contains('active')
        );
        if (anyActive) {
          allButton.classList.remove('active');
        } else {
          allButton.classList.add('active');
        }
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

document.addEventListener('DOMContentLoaded', () => {
  initFilterListeners();
  updateLayout();
  window.addEventListener('resize', () => {
    updateLayout();
    updateMainContentHeight();
  });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateLayout();
      updateMainContentHeight();
    }, 100);
  });
});