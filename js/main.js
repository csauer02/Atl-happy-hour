/**
 * Main JavaScript File for ATL Happy Hour
 *
 * This version forces all restaurants to be visible, ignoring any day/happening-now filters.
 * It uses your earlier Google Maps API key and includes orientation logic:
 *   - Desktop or mobile landscape → sidebar + map.
 *   - Mobile portrait → bottom carousel.
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
    // Mobile portrait: hide sidebar, show carousel
    document.getElementById('sidebar').style.display = 'none';
    document.getElementById('mobile-carousel').style.display = 'block';
    updateMobileCarousel();
  } else {
    // Desktop or mobile landscape: show sidebar, hide carousel
    document.getElementById('sidebar').style.display = 'block';
    document.getElementById('mobile-carousel').style.display = 'none';
    renderDesktopView();
  }
}

/* ================================
   MAP & DATA LOADING
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
      // Sort restaurants by Neighborhood (alphabetically)
      const data = results.data.sort((a, b) => {
        return (a.Neighborhood || '').toLowerCase().localeCompare((b.Neighborhood || '').toLowerCase());
      });
      // Assign a unique id
      data.forEach((row, i) => { row.id = i; });
      allRestaurants = data;
      // Render the desktop view initially
      renderDesktopView();
      // Update layout (possibly switching to mobile carousel)
      updateLayout();
      // Force all restaurants to be visible
      applyFilters();
    },
    error: (err) => {
      console.error('Error parsing CSV:', err);
    }
  });
}

/* ================================
   DESKTOP VIEW
================================ */
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return;
  container.innerHTML = '';

  // Group by Neighborhood
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
      // Force it to be visible → no filter check
      const card = createRestaurantCard(r);
      content.appendChild(card);
      createOrUpdateMarker(r);
    });
    // If content has children, show the section
    if (content.children.length > 0) {
      section.appendChild(content);
      container.appendChild(section);
    }
  }
}

/* ================================
   MOBILE CAROUSEL (PORTRAIT)
================================ */
function updateMobileCarousel() {
  if (!isMobilePortrait()) return;

  const slidesContainer = document.getElementById('carousel-slides');
  slidesContainer.innerHTML = '';
  slidesData = [];

  // Force all restaurants to be visible
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    slidesData.push({ restaurant: r, neighborhood: nb });
    createOrUpdateMarker(r);
  });

  slidesData.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-slide-index', idx);

    // In mobile mode, only the restaurant card is shown (no neighborhood header)
    const card = createRestaurantCard(item.restaurant, true);
    slide.appendChild(card);
    slidesContainer.appendChild(slide);
  });

  currentSlideIndex = 0;
  updateCarouselPosition();
  addSwipeListeners();
}

// Updates the carousel’s transform offset
function updateCarouselPosition() {
  if (!isMobilePortrait()) return;
  const carousel = document.getElementById('mobile-carousel');
  const slidesContainer = document.getElementById('carousel-slides');
  const slideWidth = carousel.clientWidth;
  const offset = -currentSlideIndex * slideWidth;
  slidesContainer.style.transform = `translateX(${offset}px)`;
}

// Swipe gesture logic
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

// Returns a Google S2 favicon URL for the given restaurant URL
function getFaviconURL(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
  } catch (e) {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
  }

// Extracts the address from a Google Maps URL (the “q” parameter)
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
  // Update markers
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
  // Highlight the selected card
  document.querySelectorAll('.restaurant-card').forEach(card => card.classList.remove('selected'));
  const selectedCard = document.querySelector(`.restaurant-card[data-id="${selectedId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    if (!isMobilePortrait()) {
      // On desktop or landscape, scroll into view in the sidebar
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
}

/* ================================
   FILTERS - FORCED "ALL VISIBLE"
================================ */
function applyFilters() {
  // Instead of actual filtering, we do nothing or just re-render everything
  // (since isRestaurantVisible is effectively forced to "true").
  renderDesktopView();
  if (isMobilePortrait()) {
    updateMobileCarousel();
  }
}

/* ================================
   EVENT LISTENERS
================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Orientation or resizing toggles between mobile portrait and desktop/landscape
  window.addEventListener('resize', updateLayout);
  window.addEventListener('orientationchange', () => setTimeout(updateLayout, 100));
});