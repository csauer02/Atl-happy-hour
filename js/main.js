/**
 * Main JavaScript File for ATL Happy Hour
 *
 * This file includes:
 *  - Initialization of the Google Map and geocoding for restaurant markers.
 *  - Loading restaurant data from CSV.
 *  - Rendering of desktop view (sidebar) and mobile view (carousel).
 *  - Filtering logic (day filters and "Happening Now") that updates both views.
 *  - Swipe functionality for the mobile carousel.
 *
 * The code has been reworked so that filtering in mobile mode rebuilds the carousel,
 * ensuring that only restaurants meeting the filter criteria appear.
 */

/* ================================
   GLOBAL VARIABLES
================================ */
let map;                         // Google Map instance
let geocoder;                    // Geocoder for converting addresses
let allRestaurants = [];         // Array holding all restaurant data loaded from CSV
const markerMap = {};            // Mapping: restaurant.id => google.maps.Marker instance

// Mobile carousel variables
let currentSlideIndex = 0;       // Current index for the mobile carousel
let slidesData = [];             // Array holding slide data: { neighborhood, restaurant }

/* ================================
   MAP INITIALIZATION & DATA LOADING
================================ */
// Called by the Google Maps API after the script loads
function initMap() {
  // Create the map centered on Atlanta
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });

  // Initialize the geocoder for converting addresses to coordinates
  geocoder = new google.maps.Geocoder();

  // Load restaurant data from a published Google Sheets CSV
  loadCSVData();
}

// Loads restaurant data using PapaParse from a CSV URL
function loadCSVData() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      // Sort restaurants alphabetically by neighborhood
      const data = results.data.sort((a, b) => {
        const nA = (a.Neighborhood || '').toLowerCase();
        const nB = (b.Neighborhood || '').toLowerCase();
        return nA.localeCompare(nB);
      });
      // Assign a unique ID to each restaurant entry
      data.forEach((row, index) => row.id = index);
      allRestaurants = data;

      // Render the desktop sidebar view
      renderDesktopView();
      // Update mobile carousel if in mobile mode
      if (window.innerWidth <= 800) {
        updateMobileCarousel();
      }
      // Apply the initial filter (default is All Days)
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
// Render restaurant cards grouped by neighborhood for desktop view.
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return;
  container.innerHTML = '';

  // Group restaurants by neighborhood.
  const groups = {};
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    groups[nb] = groups[nb] || [];
    groups[nb].push(r);
  });

  // Build sections for each neighborhood.
  for (const neighborhood in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    // Create a sticky header that zooms the map to all markers in that neighborhood.
    const nbHeader = document.createElement('div');
    nbHeader.className = 'neighborhood-header';
    nbHeader.textContent = neighborhood;
    nbHeader.addEventListener('click', () => {
      const bounds = new google.maps.LatLngBounds();
      groups[neighborhood].forEach(r => {
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

    // Create a container for the restaurant cards in this neighborhood.
    const contentDiv = document.createElement('div');
    contentDiv.className = 'neighborhood-content';

    groups[neighborhood].forEach(restaurant => {
      const card = createRestaurantCard(restaurant);
      contentDiv.appendChild(card);
      // Create/update the map marker for each restaurant.
      createOrUpdateMarker(restaurant);
    });

    section.appendChild(contentDiv);
    container.appendChild(section);
  }
}

/* ================================
   MOBILE CAROUSEL RENDERING & UPDATES
================================ */
// Rebuilds the mobile carousel slides based on the current filter.
function updateMobileCarousel() {
  const mobileCarousel = document.getElementById('mobile-carousel');
  if (!mobileCarousel || window.innerWidth > 800) return;
  
  const slidesContainer = document.getElementById('carousel-slides');
  slidesContainer.innerHTML = '';
  slidesData = [];
  
  // Loop over all restaurants and add only those that pass the filter.
  allRestaurants.forEach(r => {
    if (isRestaurantVisible(r)) {
      const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
      slidesData.push({ neighborhood: nb, restaurant: r });
    }
  });
  
  // Build a slide for each visible restaurant.
  slidesData.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-slide-index', idx);
    
    // In mobile mode, we only show the restaurant card (omit neighborhood header).
    const card = createRestaurantCard(item.restaurant, true);
    slide.appendChild(card);
    slidesContainer.appendChild(slide);
    
    // Ensure the marker exists.
    createOrUpdateMarker(item.restaurant);
  });
  
  // Reset slide index and update carousel position.
  currentSlideIndex = 0;
  updateCarouselPosition();
  
  // Reattach swipe listeners.
  addSwipeListeners();
}

// Adds touch event listeners for swipe navigation on the mobile carousel.
function addSwipeListeners() {
  const slidesContainer = document.getElementById('carousel-slides');
  // Remove any previous listeners to prevent duplicates.
  slidesContainer.removeEventListener('touchstart', handleTouchStart);
  slidesContainer.removeEventListener('touchend', handleTouchEnd);
  
  slidesContainer.addEventListener('touchstart', handleTouchStart);
  slidesContainer.addEventListener('touchend', handleTouchEnd);
}

let touchStartX = 0;
function handleTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
}
function handleTouchEnd(e) {
  const touchEndX = e.changedTouches[0].screenX;
  const swipeThreshold = 30; // Minimum distance in pixels
  if (touchEndX < touchStartX - swipeThreshold) {
    nextSlide();
  } else if (touchEndX > touchStartX + swipeThreshold) {
    prevSlide();
  }
  // After a swipe, auto-select the restaurant in the current slide.
  if (slidesData[currentSlideIndex]) {
    selectRestaurant(slidesData[currentSlideIndex].restaurant.id);
  }
}

// Navigate to the previous slide.
function prevSlide() {
  currentSlideIndex = Math.max(0, currentSlideIndex - 1);
  updateCarouselPosition();
}

// Navigate to the next slide.
function nextSlide() {
  currentSlideIndex = Math.min(slidesData.length - 1, currentSlideIndex + 1);
  updateCarouselPosition();
}

// Update the carousel's visible position using the mobile carousel container's width.
function updateCarouselPosition() {
  const carousel = document.getElementById('mobile-carousel');
  const slidesContainer = document.getElementById('carousel-slides');
  const slideWidth = carousel.clientWidth || window.innerWidth;
  const offset = -currentSlideIndex * slideWidth;
  slidesContainer.style.transform = `translateX(${offset}px)`;
}

// Recalculate carousel position on window resize/orientation change.
window.addEventListener('resize', updateCarouselPosition);
window.addEventListener('orientationchange', () => {
  setTimeout(updateCarouselPosition, 100);
});

/* ================================
   GEOCODING & MARKER CREATION
================================ */
// Creates (or updates) a map marker for a given restaurant using its address extracted from the Maps URL.
function createOrUpdateMarker(restaurant) {
  if (!markerMap[restaurant.id]) {
    const address = getAddressFromMapsURL(restaurant.MapsURL);
    if (!address) return;
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const location = results[0].geometry.location;
        const marker = new google.maps.Marker({
          position: location,
          map: map,
          opacity: 0.3, // Initially dimmed
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          }
        });
        markerMap[restaurant.id] = marker;
        // Clicking the marker selects the restaurant.
        marker.addListener('click', () => {
          selectRestaurant(restaurant.id);
        });
      } else {
        console.warn('Geocode failed for address:', address, 'Status:', status);
      }
    });
  }
}

/* ================================
   RESTAURANT CARD CREATION
================================ */
// Creates and returns a restaurant card element for desktop or mobile view.
// If isMobile is true, extra elements (such as a neighborhood header) are omitted.
function createRestaurantCard(restaurant, isMobile = false) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);

  // Get favicon URL based on the restaurant's URL.
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);
  const iconSize = isMobile ? 40 : 48;

  // Build the inner HTML of the card.
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
      <img src="${faviconURL}" alt="${restaurant.RestaurantName}" onerror="this.onerror=null; this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    </div>
  `;

  // When the card is clicked, select the restaurant.
  card.addEventListener('click', () => {
    selectRestaurant(restaurant.id);
  });

  return card;
}

/**
 * Helper function: getFaviconURL
 * Returns a Google S2 favicon URL for the given restaurant URL.
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
 * Helper function: getAddressFromMapsURL
 * Extracts the "q" parameter from a Google Maps URL to obtain the address.
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
   RESTAURANT SELECTION & HIGHLIGHTING
================================ */
// Updates the selected restaurant: adjusts marker opacity and highlights the corresponding card.
function selectRestaurant(selectedId) {
  // Update markers: set selected marker to full opacity and pan/zoom the map.
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

  // Remove "selected" class from all restaurant cards and add it to the chosen one.
  document.querySelectorAll('.restaurant-card').forEach(card => card.classList.remove('selected'));
  const selectedCard = document.querySelector(`.restaurant-card[data-id="${selectedId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    // In desktop view, scroll the selected card into view.
    if (window.innerWidth > 800) {
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/* ================================
   FILTERING LOGIC
================================ */
// Determines if a restaurant should be visible based on the current filter settings.
function isRestaurantVisible(restaurant) {
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  const activeDays = getActiveDayFilters();
  let filterDays = [];
  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, etc.
  if (happeningNow && todayIndex >= 1 && todayIndex <= 5) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
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

// Applies filters to the desktop view and then updates the mobile carousel accordingly.
function applyFilters() {
  const activeDays = getActiveDayFilters();
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  let filterDays = [];
  const todayIndex = new Date().getDay();
  if (happeningNow && todayIndex >= 1 && todayIndex <= 5) {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    filterDays.push(days[todayIndex]);
  } else if (activeDays.length > 0) {
    filterDays = activeDays;
  }

  // Update desktop view: show/hide restaurant cards.
  document.querySelectorAll('.restaurant-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const r = allRestaurants.find(x => String(x.id) === id);
    let show = true;
    if (filterDays.length > 0) {
      show = filterDays.some(day => {
        const col = getCsvColumn(day);
        return r[col] && r[col].toLowerCase() === 'yes';
      });
    }
    card.style.display = show ? '' : 'none';
    // Also update corresponding map markers.
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });

  // Hide empty neighborhood sections in desktop view.
  document.querySelectorAll('.neighborhood-section').forEach(section => {
    const visibleCards = section.querySelectorAll('.restaurant-card:not([style*="display: none"])');
    section.style.display = visibleCards.length ? '' : 'none';
  });

  // For mobile mode, rebuild the carousel based on the filter.
  if (window.innerWidth <= 800) {
    updateMobileCarousel();
  }
}

// Returns an array of active day filters (ignores the "all" button).
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
   FILTER LISTENERS INITIALIZATION
================================ */
// Initialize event listeners for the day filter buttons and "Happening Now" toggle.
function initFilterListeners() {
  const dayButtons = document.querySelectorAll('#day-filter button');
  const happeningNowToggle = document.getElementById('happening-now-toggle');
  const allButton = document.querySelector('#day-filter button[data-day="all"]');
  const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };

  // Listener for the "Happening Now" toggle.
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

  // Listener for individual day filter buttons.
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

// Initialize filter listeners once the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', initFilterListeners);