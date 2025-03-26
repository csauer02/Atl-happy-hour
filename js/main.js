/**
 * Main JavaScript File for ATL Happy Hour
 *
 * This solution supports a harmonized experience:
 * - In desktop and mobile landscape mode, the standard sidebar+map view is used.
 * - In mobile portrait mode (narrow & taller than wide), the sidebar is hidden and a bottom carousel is shown.
 *
 * The carousel is re-built (from filtered restaurants) when in mobile portrait mode.
 * Swipe gestures are supported to navigate between slides.
 */

/* ================================
   GLOBAL VARIABLES
================================ */
let map;                           // Google Map instance
let geocoder;                      // For converting addresses to coordinates
let allRestaurants = [];           // Loaded restaurant data
const markerMap = {};              // restaurant.id → google.maps.Marker

// Mobile carousel state
let currentSlideIndex = 0;
let slidesData = [];               // Array of { restaurant, neighborhood }

/* ================================
   HELPER FUNCTIONS
================================ */
// Returns true if viewport is in mobile portrait mode.
function isMobilePortrait() {
  return window.innerWidth <= 800 && window.innerHeight > window.innerWidth;
}

/* ================================
   LAYOUT ADJUSTMENT
================================ */
// Adjusts which view to show based on screen size and orientation.
function updateLayout() {
  if (isMobilePortrait()) {
    // Mobile portrait: hide sidebar, show carousel.
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mobile-carousel').style.display = 'block';
    updateMobileCarousel();
  } else {
    // Desktop or mobile landscape: show sidebar, hide carousel.
    document.getElementById('sidebar').style.display = 'block';
    document.getElementById('mobile-carousel').style.display = 'none';
    // (Re)render the desktop view.
    renderDesktopView();
  }
}

/* ================================
   MAP INITIALIZATION & DATA LOADING
================================ */
// Called by Google Maps API after the script loads.
function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });
  geocoder = new google.maps.Geocoder();
  loadCSVData();
}

// Loads restaurant data via PapaParse from a published CSV.
function loadCSVData() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      // Sort restaurants alphabetically by Neighborhood.
      const data = results.data.sort((a, b) => {
        return (a.Neighborhood || '').toLowerCase().localeCompare((b.Neighborhood || '').toLowerCase());
      });
      // Assign a unique id.
      data.forEach((row, i) => { row.id = i; });
      allRestaurants = data;
      renderDesktopView();
      updateLayout();
      applyFilters();
    },
    error: (err) => {
      console.error('Error parsing CSV:', err);
    }
  });
}

/* ================================
   DESKTOP VIEW RENDERING
================================ */
// Renders the desktop sidebar view.
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return;
  container.innerHTML = '';

  // Group restaurants by Neighborhood.
  const groups = {};
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(r);
  });

  // For each neighborhood, create a section.
  for (const nb in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    const header = document.createElement('div');
    header.className = 'neighborhood-header';
    header.textContent = nb;
    header.addEventListener('click', () => {
      const bounds = new google.maps.LatLngBounds();
      groups[nb].forEach(r => {
        const marker = markerMap[r.id];
        if (marker) bounds.extend(marker.getPosition());
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds);
    });
    section.appendChild(header);

    const content = document.createElement('div');
    content.className = 'neighborhood-content';
    groups[nb].forEach(r => {
      // Only add if the restaurant passes the filter.
      if (isRestaurantVisible(r)) {
        const card = createRestaurantCard(r);
        content.appendChild(card);
      }
      createOrUpdateMarker(r);
    });
    section.appendChild(content);

    // Hide the section if no cards are visible.
    if (content.children.length > 0) {
      container.appendChild(section);
    }
  }
}

/* ================================
   MOBILE CAROUSEL RENDERING (PORTRAIT)
================================ */
// Builds the carousel using only restaurants that pass the filter.
function updateMobileCarousel() {
  if (!isMobilePortrait()) return;

  const carousel = document.getElementById('mobile-carousel');
  const slidesContainer = document.getElementById('carousel-slides');
  slidesContainer.innerHTML = '';
  slidesData = [];

  // Build slidesData from filtered restaurants.
  allRestaurants.forEach(r => {
    if (isRestaurantVisible(r)) {
      const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
      slidesData.push({ restaurant: r, neighborhood: nb });
    }
    createOrUpdateMarker(r);
  });

  // Create a slide for each visible restaurant.
  slidesData.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-slide-index', idx);
    // In mobile mode, only the restaurant card is shown.
    const card = createRestaurantCard(item.restaurant, true);
    slide.appendChild(card);
    slidesContainer.appendChild(slide);
  });

  currentSlideIndex = 0;
  updateCarouselPosition();
  addSwipeListeners();
}

// Updates the carousel’s transform offset.
function updateCarouselPosition() {
  if (!isMobilePortrait()) return;
  const carousel = document.getElementById('mobile-carousel');
  const slidesContainer = document.getElementById('carousel-slides');
  const slideWidth = carousel.clientWidth;
  const offset = -currentSlideIndex * slideWidth;
  slidesContainer.style.transform = `translateX(${offset}px)`;
}

// Swipe gesture handling.
let touchStartX = 0;
function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
}
function handleTouchEnd(e) {
  const touchEndX = e.changedTouches[0].screenX;
  const threshold = 30;
  if (touchEndX < touchStartX - threshold) {
    nextSlide();
  } else if (touchEndX > touchStartX + threshold) {
    prevSlide();
  }
  if (slidesData[currentSlideIndex]) {
    selectRestaurant(slidesData[currentSlideIndex].restaurant.id);
  }
}
function addSwipeListeners() {
  const slidesContainer = document.getElementById('carousel-slides');
  slidesContainer.removeEventListener('touchstart', handleTouchStart);
  slidesContainer.removeEventListener('touchend', handleTouchEnd);
  slidesContainer.addEventListener('touchstart', handleTouchStart);
  slidesContainer.addEventListener('touchend', handleTouchEnd);
}
function prevSlide() {
  currentSlideIndex = Math.max(0, currentSlideIndex - 1);
  updateCarouselPosition();
}
function nextSlide() {
  currentSlideIndex = Math.min(slidesData.length - 1, currentSlideIndex + 1);
  updateCarouselPosition();
}

/* ================================
   GEOCODING & MARKER CREATION
================================ */
// Creates a marker for the restaurant if it doesn’t exist.
function createOrUpdateMarker(restaurant) {
  if (!markerMap[restaurant.id]) {
    const address = getAddressFromMapsURL(restaurant.MapsURL);
    if (!address) return;
    geocoder.geocode({ address: address }, (results, status) => {
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
      } else {
        console.warn('Geocode failed for', address, 'Status:', status);
      }
    });
  }
}

/* ================================
   RESTAURANT CARD CREATION
================================ */
// Returns a card element representing the restaurant.
// When isMobile is true, the card is styled for mobile (smaller icon, etc.)
function createRestaurantCard(restaurant, isMobile = false) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);
  const iconSize = isMobile ? 40 : 48;
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
    <div class="restaurant-right" style="width:${iconSize}px; height:${iconSize}px;">
      <img src="${faviconURL}" alt="${restaurant.RestaurantName}" onerror="this.onerror=null;this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    </div>
  `;
  card.addEventListener('click', () => selectRestaurant(restaurant.id));
  return card;
}

/**
 * Helper: getFaviconURL returns a favicon URL for the restaurant domain.
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
 * Helper: getAddressFromMapsURL extracts the "q" parameter from a Google Maps URL.
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

/* ================================
   RESTAURANT SELECTION
================================ */
// Updates marker opacity and highlights the selected restaurant card.
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
    if (window.innerWidth > 800) {
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/* ================================
   FILTERING LOGIC
================================ */
// Determines whether a restaurant should be visible based on active filters.
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

// Applies filters to both desktop and (if applicable) mobile views.
function applyFilters() {
  // Update desktop restaurant cards.
  document.querySelectorAll('.restaurant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const r = allRestaurants.find(x => String(x.id) === id);
    let show = true;
    if (r) {
      show = isRestaurantVisible(r);
    }
    card.style.display = show ? '' : 'none';
    const marker = markerMap[id];
    if (marker) marker.setMap(show ? map : null);
  });
  
  // Hide empty neighborhood sections in desktop view.
  document.querySelectorAll('.neighborhood-section').forEach(section => {
    const visibleCards = section.querySelectorAll('.restaurant-card:not([style*="display: none"])');
    section.style.display = visibleCards.length ? '' : 'none';
  });
  
  // If in mobile portrait mode, rebuild the carousel.
  if (isMobilePortrait()) {
    updateMobileCarousel();
  }
}

// Returns an array of active day filters.
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

// Maps day abbreviations to CSV column names.
function getCsvColumn(day) {
  const mapping = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
  return mapping[day] || day;
}

/* ================================
   FILTER LISTENERS
================================ */
// Initialize listeners for filter buttons and the "Happening Now" toggle.
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
        const anyActive = Array.from(dayButtons).some(b => b.getAttribute('data-day') !== 'all' && b.classList.contains('active'));
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

/* ================================
   EVENT LISTENERS & INITIALIZATION
================================ */
document.addEventListener('DOMContentLoaded', () => {
  initFilterListeners();
  // Update layout on resize/orientation change.
  window.addEventListener('resize', updateLayout);
  window.addEventListener('orientationchange', () => {
    setTimeout(updateLayout, 100);
  });
});