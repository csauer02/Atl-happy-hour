/**
 * Main JavaScript File
 *
 * - Loads CSV from Google Sheets.
 * - Sorts & groups by neighborhood.
 * - Desktop: Renders a sidebar with sticky neighborhood headers and vertical card list.
 * - Mobile: Renders a bottom carousel, one card per slide, with left/right arrows.
 * - Google Map with low-opacity markers. Clicking card or marker highlights that restaurant.
 * - Neighborhood header click => fitBounds to show all pins in that neighborhood (desktop).
 * - Day filters & "Happening Now" toggle.
 */

let map;
let geocoder;
let allRestaurants = [];
const markerMap = {}; // key: restaurant.id => google.maps.Marker
// For the mobile carousel
let currentSlideIndex = 0;
let slidesData = []; // Each element is { neighborhood, restaurantObj }

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 33.7490, lng: -84.3880 },
    zoom: 12,
    disableDefaultUI: true
  });
  geocoder = new google.maps.Geocoder();

  loadCSVData();
}

/**
 * loadCSVData
 * Loads CSV, sorts by neighborhood, assigns unique IDs, then calls render functions.
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
      renderDesktopView();
      renderMobileCarousel();
      applyFilters(); // apply initial filters
    },
    error: (err) => {
      console.error('Error parsing CSV:', err);
    }
  });
}

/* ================================
   DESKTOP VIEW RENDERING
================================ */
function renderDesktopView() {
  const container = document.getElementById('venue-container');
  if (!container) return; // in case no sidebar

  container.innerHTML = '';

  // Group by neighborhood
  const groups = {};
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    if (!groups[nb]) groups[nb] = [];
    groups[nb].push(r);
  });

  // Build sections for each neighborhood
  for (const neighborhood in groups) {
    const section = document.createElement('div');
    section.className = 'neighborhood-section';

    // Sticky neighborhood header
    const nbHeader = document.createElement('div');
    nbHeader.className = 'neighborhood-header';
    nbHeader.textContent = neighborhood;
    // Fit bounds on click
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

    // Cards
    const contentDiv = document.createElement('div');
    contentDiv.className = 'neighborhood-content';
    groups[neighborhood].forEach(restaurant => {
      const card = createRestaurantCard(restaurant);
      contentDiv.appendChild(card);
      // Create marker if not already
      createOrUpdateMarker(restaurant);
    });

    section.appendChild(contentDiv);
    container.appendChild(section);
  }
}

/* ================================
   MOBILE CAROUSEL RENDERING
   - One "slide" per restaurant
   - Each slide shows Neighborhood + 1 Card
================================ */
function renderMobileCarousel() {
  const carousel = document.getElementById('mobile-carousel');
  if (!carousel) return; // in case no mobile container

  const slidesContainer = document.getElementById('carousel-slides');
  slidesContainer.innerHTML = '';

  // Build an array of slides data
  allRestaurants.forEach(r => {
    const nb = r.Neighborhood ? r.Neighborhood.trim() : 'Uncategorized';
    slidesData.push({ neighborhood: nb, restaurant: r });
  });

  // Render each slide
  slidesData.forEach((item, idx) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.setAttribute('data-slide-index', idx);

    // Neighborhood label
    const nbLabel = document.createElement('div');
    nbLabel.className = 'neighborhood-label';
    nbLabel.textContent = item.neighborhood;
    slide.appendChild(nbLabel);

    // Restaurant card
    const card = createRestaurantCard(item.restaurant, true /* isMobile */);
    slide.appendChild(card);

    slidesContainer.appendChild(slide);

    // Also create marker if not done yet
    createOrUpdateMarker(item.restaurant);
  });

  // Set up arrow clicks
  document.getElementById('carousel-left').addEventListener('click', () => {
    prevSlide();
  });
  document.getElementById('carousel-right').addEventListener('click', () => {
    nextSlide();
  });

  // Show the first slide
  updateCarouselPosition();
}

function prevSlide() {
  currentSlideIndex = Math.max(0, currentSlideIndex - 1);
  updateCarouselPosition();
}

function nextSlide() {
  currentSlideIndex = Math.min(slidesData.length - 1, currentSlideIndex + 1);
  updateCarouselPosition();
}

function updateCarouselPosition() {
  const slidesContainer = document.getElementById('carousel-slides');
  const slideWidth = slidesContainer.clientWidth;
  const offset = -currentSlideIndex * slideWidth;
  slidesContainer.style.transform = `translateX(${offset}px)`;
}

/* ================================
   MARKER CREATION / UPDATE
================================ */
function createOrUpdateMarker(restaurant) {
  if (!markerMap[restaurant.id]) {
    const address = getAddressFromMapsURL(restaurant.MapsURL);
    if (!address) return;
    geocodeAddress(address, (location) => {
      if (location) {
        const marker = new google.maps.Marker({
          position: location,
          map: map,
          opacity: 0.3, // start dim
          icon: {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(32, 32)
          }
        });
        markerMap[restaurant.id] = marker;
        // Click => highlight
        marker.addListener('click', () => {
          selectRestaurant(restaurant.id);
        });
      }
    });
  }
}

/* ================================
   CREATE RESTAURANT CARD
   - If isMobile, smaller styling
================================ */
function createRestaurantCard(restaurant, isMobile = false) {
  const card = document.createElement('div');
  card.className = 'restaurant-card';
  card.setAttribute('data-id', restaurant.id);

  // Favicon
  const faviconURL = getFaviconURL(restaurant.RestaurantURL);

  // Adjust some sizing if mobile, optional
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
      <img src="${faviconURL}" alt="${restaurant.RestaurantName}" onerror="this.onerror=null; this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com'">
    </div>
  `;

  // On click => highlight
  card.addEventListener('click', () => {
    selectRestaurant(restaurant.id);
  });

  return card;
}

/* ================================
   SELECTION LOGIC
   - Dims all markers except selected => opacity=1
   - Scrolls to the card in desktop or mobile
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

  // Cards (desktop)
  document.querySelectorAll('.restaurant-card').forEach(card => {
    card.classList.remove('selected');
  });
  const selectedCard = document.querySelector(`.restaurant-card[data-id="${selectedId}"]`);
  if (selectedCard) {
    selectedCard.classList.add('selected');
    // If it's in the desktop sidebar, scroll it into view
    if (window.innerWidth > 800) {
      // Desktop
      selectedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // On mobile, find the slide index
      const slideIndex = slidesData.findIndex(s => s.restaurant.id === Number(selectedId));
      if (slideIndex >= 0) {
        currentSlideIndex = slideIndex;
        updateCarouselPosition();
      }
    }
  }
}

/* ================================
   FILTERING LOGIC
================================ */
function applyFilters() {
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

  // For each restaurant card (both desktop & mobile)
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
    // Also hide marker
    const marker = markerMap[id];
    if (marker) {
      marker.setMap(show ? map : null);
    }
  });
}

/* Day filter helpers */
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

/* ================================
   INIT FILTER LISTENERS
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
          if (btn.getAttribute('data-day') === dayMapping[todayIndex]) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
        allButton.classList.remove('active');
      } else {
        // Weekend => revert to All
        dayButtons.forEach(btn => btn.classList.remove('active'));
        allButton.classList.add('active');
      }
    } else {
      // Turned off => "All Days"
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
        // Clear others, ensure "all" is active, turn off "Happening Now"
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

document.addEventListener('DOMContentLoaded', initFilterListeners);
