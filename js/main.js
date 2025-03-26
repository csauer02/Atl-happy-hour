/**
 * Main JavaScript File for ATL Happy Hour
 *
 * This file includes:
 *  - Initialization of Google Map and geocoding for restaurant markers.
 *  - Loading restaurant data from CSV.
 *  - Rendering for desktop and mobile views (carousel).
 *  - Filtering logic and interaction (day filters and "Happening Now").
 *  - Swipe functionality for the mobile carousel.
 *
 * Each function is thoroughly commented for clarity.
 */

// Global variables
let map;                         // Google Map instance
let geocoder;                    // Geocoder for address lookup
let allRestaurants = [];         // Array holding all restaurant data from CSV
const markerMap = {};            // Mapping: restaurant.id => google.maps.Marker instance

// Mobile carousel variables
let currentSlideIndex = 0;       // Current index for the mobile carousel
let slidesData = [];             // Array holding slide data for mobile carousel: { neighborhood, restaurant }

/* ================================
   MAP INITIALIZATION & DATA LOADING
================================ */
// Called by Google Maps API once the script loads
function initMap() {
  // Create the map centered on Atlanta
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });

  // Initialize the geocoder for address-to-coordinate conversion
  geocoder = new google.maps.Geocoder();

  // Load restaurant data from CSV via Google Sheets
  loadCSVData();
}

// Loads restaurant data using PapaParse from a published Google Sheets CSV
function loadCSVData() {
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: (results) => {
      // Sort restaurants by neighborhood (alphabetically)
      const data = results.data.sort((a, b) => {
        const nA = (a.Neighborhood || '').toLowerCase();
        const nB = (b.Neighborhood || '').toLowerCase();
        return nA.localeCompare(nB);
      });
      // Assign a unique ID to each restaurant entry
      data.forEach((row, index) => {
        row.id = index;
      });
      allRestaurants = data;

      // Render views and apply initial filters
      renderDesktopView();
      renderMobileCarousel();
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
// Render restaurant cards grouped by neighborhood for desktop view
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return; // Abort if sidebar not found
  container.innerHTML = '';

  // Group restaurants by neighborhood
  const groups = {};
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(r);
  });

  // Create a section for each neighborhood group
  for (const neighborhood in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    // Create a sticky header that zooms to the neighborhood markers when clicked
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

    // Container for restaurant cards within this neighborhood
    const contentDiv = document.createElement('div');
    contentDiv.className = 'neighborhood-content';

    // Create each restaurant card and its marker
    groups[neighborhood].forEach(restaurant => {
      const card = createRestaurantCard(restaurant);
      contentDiv.appendChild(card);
      createOrUpdateMarker(restaurant);
    });

    section.appendChild(contentDiv);
    container.appendChild(section);
  }
}

/* ================================
   MOBILE CAROUSEL RENDERING
================================ */
// Render the mobile carousel with one restaurant card per slide
function renderMobileCarousel() {
  const carousel = document.getElementById('mobile-carousel');
  if (!carousel) return; // Abort if mobile carousel container not found
  const slidesContainer = document.getElementById('carousel-slides');
  slidesContainer.innerHTML = '';
  slidesData = [];

  // Create slide data: one slide per restaurant (ignoring neighborhood header for mobile)
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    slidesData.push({ neighborhood: nb, restaurant: r });
  });

  // Create a slide for each restaurant
  slidesData.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-slide-index', idx);

    // For mobile, only include the restaurant card (omit neighborhood header)
    const card = createRestaurantCard(item.restaurant, true /* isMobile */);
    slide.appendChild(card);

    slidesContainer.appendChild(slide);

    // Ensure a marker exists for the restaurant
    createOrUpdateMarker(item.restaurant);
  });

  // Attach click events for carousel navigation arrows
  document.getElementById('carousel-left').addEventListener('click', () => {
    prevSlide();
  });
  document.getElementById('carousel-right').addEventListener('click', () => {
    nextSlide();
  });

  // Enable swipe gestures on mobile
  addSwipeListeners();

  // Set the initial slide position
  updateCarouselPosition();
}

// Add touch event listeners to support swipe gestures
function addSwipeListeners() {
  const slidesContainer = document.getElementById('carousel-slides');
  let touchStartX = 0;
  let touchEndX = 0;
  const swipeThreshold = 30; // Minimum distance (in pixels) to count as a swipe

  slidesContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  });

  slidesContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < touchStartX - swipeThreshold) {
      nextSlide();
    } else if (touchEndX > touchStartX + swipeThreshold) {
      prevSlide();
    }
    // After swipe, auto-select the restaurant on the current slide
    const currentRestaurant = slidesData[currentSlideIndex].restaurant;
    selectRestaurant(currentRestaurant.id);
  });
}

// Navigate to the previous slide
function prevSlide() {
  currentSlideIndex = Math.max(0, currentSlideIndex - 1);
  updateCarouselPosition();
}

// Navigate to the next slide
function nextSlide() {
  currentSlideIndex = Math.min(slidesData.length - 1, currentSlideIndex + 1);
  updateCarouselPosition();
}

// Update the carousel's visible position based on the current slide index
function updateCarouselPosition() {
  const slidesContainer = document.getElementById('carousel-slides');
  const slideWidth = slidesContainer.clientWidth;
  const offset = -currentSlideIndex * slideWidth;
  slidesContainer.style.transform = `translateX(${offset}px)`;
}

/* ================================
   GEOCODING & MARKER CREATION
================================ */
// Creates or updates a map marker for a given restaurant using its address from MapsURL
function createOrUpdateMarker(restaurant) {
  if (!markerMap[restaurant.id]) {
    // Extract the address from the Google Maps URL (expects a "q" parameter)
    const address = getAddressFromMapsURL(restaurant.MapsURL);
    if (!address) return;
    // Use geocoder to look up the location
    geocoder.geocode({ address: address }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results[0]) {
        const location = results[0].geometry.location;
        // Create the marker with an initial lower opacity (dimmed)
        const marker = new google.maps.Marker({
          position: location,
          map: map,
          opacity: 0.3,
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          }
        });
        markerMap[restaurant.id] = marker;
        // When the marker is clicked, select the restaurant
        marker.addListener('click', () => {
          selectRestaurant(restaurant.id);
        });
      } else {
        console.warn('Geocode was not successful for address:', address, 'Status:', status);
      }
    });
  }
}

/* ================================
   RESTAURANT CARD CREATION
================================ */
// Creates a restaurant card element for desktop or mobile view.
// If isMobile is true, extra elements (like the neighborhood header) are omitted.
function createRestaurantCard(restaurant, isMobile = false) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);

  // Obtain favicon URL using the helper function
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);
  const iconSize = isMobile ? 40 : 48;

  // Build the card's inner HTML
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

  // When the card is clicked, select the corresponding restaurant
  card.addEventListener('click', () => {
    selectRestaurant(restaurant.id);
  });

  return card;
}

/**
 * Helper function: getFaviconURL
 * Returns the Google S2 favicon URL for the restaurant's domain.
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
 * Extracts the "q" parameter from a Google Maps URL to get the address.
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
// Selects a restaurant by its ID, updating marker opacity and card highlighting.
function selectRestaurant(selectedId) {
  // Update map markers: highlight selected, dim others.
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

  // Update card selection styling
  document.querySelectorAll('.restaurant-card').forEach(card => {
    card.classList.remove('selected');
  });
  const selectedCard = document.querySelector(`.restaurant-card[data-id="${selectedId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    // On desktop, scroll the selected card into view within the sidebar.
    if (window.innerWidth > 800) {
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/* ================================
   FILTERING LOGIC
================================ */
// Apply filters based on day selections and the "Happening Now" toggle.
function applyFilters() {
  const happeningNow = document.getElementById('happening-now-toggle').checked;
  const activeDays = getActiveDayFilters();
  let filterDays = [];

  // Determine the days to filter on based on the toggle or active day buttons
  const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, ...
  if (happeningNow && todayIndex >= 1 && todayIndex <= 5) {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    filterDays.push(days[todayIndex]);
  } else if (activeDays.length > 0) {
    filterDays = activeDays;
  }

  // Loop through each restaurant card to show or hide based on filter criteria
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

    // Also show/hide the corresponding map marker
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });

  // Hide entire neighborhood sections if none of their restaurant cards are visible
  document.querySelectorAll('.neighborhood-section').forEach(section => {
    const visibleCards = section.querySelectorAll('.restaurant-card:not([style*="display: none"])');
    section.style.display = visibleCards.length ? '' : 'none';
  });
}

// Returns an array of active day filters based on which day buttons are active.
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
// Initialize event listeners for day filter buttons and the "Happening Now" toggle.
function initFilterListeners() {
  const dayButtons = document.querySelectorAll('#day-filter button');
  const happeningNowToggle = document.getElementById('happening-now-toggle');
  const allButton = document.querySelector('#day-filter button[data-day="all"]');
  const dayMapping = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };

  // Listener for the "Happening Now" toggle
  happeningNowToggle.addEventListener('change', function() {
    if (this.checked) {
      const todayIndex = new Date().getDay();
      if (dayMapping[todayIndex]) {
        dayButtons.forEach(btn => {
          if (btn.getAttribute('data-day') === dayMapping[todayIndex]) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        allButton.classList.remove('active');
      } else {
        // If it's a weekend, revert to "All Days"
        dayButtons.forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
      }
    } else {
      // Toggle off: revert to "All Days"
      dayButtons.forEach(btn => btn.classList.remove('active'));
      allButton.classList.add('active');
    }
    applyFilters();
  });

  // Listener for individual day filter buttons
  dayButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      const day = btn.getAttribute('data-day');
      if (day === 'all') {
        // Activate "All Days" and disable other filters
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
        // Ensure at least one day is active; if none, default to "All Days"
        const anyActive = Array.from(dayButtons).some(b => b.getAttribute('data-day') !== 'all' && b.classList.contains('active'));
        if (anyActive) {
          allButton.classList.remove('active');
        } else {
          allButton.classList.add('active');
        }
        // If the only active day is the current weekday, auto-enable "Happening Now"
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
