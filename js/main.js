/**
 * Main JavaScript File
 *
 * This script handles:
 * - Fetching and parsing CSV data using PapaParse.
 * - Dynamically generating restaurant tables grouped by neighborhood.
 * - Implementing the "Happening now" filter based on the current weekday.
 * - Managing UI interactions, including an instantly shrinking global header on scroll.
 */

document.addEventListener("DOMContentLoaded", function() {
  // CSV URL published from your Google Sheet (ensure it ends with &output=csv)
  var csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';

  // Parse the CSV data using PapaParse
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
      console.log("CSV Data:", results.data);
      // Process CSV data to generate neighborhood sections and restaurant tables
      processData(results.data);
      // Apply the "Happening now" filter immediately in case the toggle is active
      filterRows();
    },
    error: function(err) {
      console.error("Error parsing CSV:", err);
    }
  });

  // Setup event listener for the "Happening now" toggle filter
  const toggleButton = document.getElementById('happening-now-toggle');
  if (toggleButton) {
    toggleButton.addEventListener('change', filterRows);
  }

  // Setup scroll listener to manage the global header shrink effect (instant shrink)
  window.addEventListener('scroll', function() {
    var globalHeader = document.getElementById('global-header');
    // Instantly add the "pinned" class when scrolled more than 50px
    if (window.scrollY > 50) {
      globalHeader.classList.add('pinned');
    } else {
      globalHeader.classList.remove('pinned');
    }
  });
});

/**
 * getDomain
 * 
 * Extracts the domain name from a given URL and removes any "www." prefix.
 *
 * @param {string} url - The URL from which to extract the domain.
 * @returns {string|null} - The cleaned domain name or null if invalid.
 */
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (error) {
    return null;
  }
}

/**
 * getFaviconURL
 * 
 * Generates a favicon URL using Google's favicon service based on the restaurant's URL.
 * Returns a default favicon if the URL is invalid.
 *
 * @param {string} restaurantURL - The restaurant homepage URL.
 * @returns {string} - The generated favicon URL.
 */
function getFaviconURL(restaurantURL) {
  const domain = getDomain(restaurantURL);
  if (!domain) {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com';
  }
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

/**
 * processData
 * 
 * Processes parsed CSV data and dynamically builds restaurant tables grouped by neighborhood.
 * Each restaurant row is assigned a "data-deals" attribute listing the weekdays (Mon-Fri) 
 * when a deal is available (mapped as Monday=1, Tuesday=2, etc.).
 *
 * @param {Array} data - The array of CSV data objects.
 */
function processData(data) {
  // Group CSV data by Neighborhood
  var neighborhoods = {};
  data.forEach(function(row) {
    var neighborhood = row.Neighborhood ? row.Neighborhood.trim() : "Uncategorized";
    if (!neighborhoods[neighborhood]) {
      neighborhoods[neighborhood] = [];
    }
    neighborhoods[neighborhood].push(row);
  });

  // Select the container where neighborhood sections will be inserted
  var container = document.getElementById('neighborhoods');
  container.innerHTML = ""; // Clear any existing content

  // Loop through each neighborhood to build its section and table
  Object.keys(neighborhoods).forEach(function(neighborhood) {
    // Create a section element for the neighborhood
    var section = document.createElement('section');
    section.className = 'neighborhood';
    section.id = neighborhood.toLowerCase().replace(/\s+/g, '-');

    // Create a sticky neighborhood header displaying the neighborhood name
    var header = document.createElement('div');
    header.className = 'neighborhood-header';
    header.textContent = neighborhood;
    section.appendChild(header);

    // Create a table wrapper and the table element
    var tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    var table = document.createElement('table');

    // Build the table header with a fixed Restaurant & Deal column and weekday columns (Mon-Fri)
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');

    // Restaurant & Deal header cell (fixed width)
    var thRest = document.createElement('th');
    thRest.className = 'rest-col';
    thRest.textContent = 'Restaurant & Deal';
    headerRow.appendChild(thRest);

    // Create header cells for weekdays (Mon-Fri)
    var days = ['M', 'T', 'W', 'T', 'F'];
    days.forEach(function(day) {
      var th = document.createElement('th');
      th.textContent = day;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Build the table body by looping over each restaurant in the neighborhood
    var tbody = document.createElement('tbody');
    neighborhoods[neighborhood].forEach(function(row) {
      // Create a table row for the restaurant
      var tr = document.createElement('tr');
      tr.className = 'rest-row';

      // --- NEW: Set the data-deals attribute based on weekday deal availability ---
      var weekdayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      var deals = [];
      weekdayKeys.forEach(function(day, index) {
        if (row[day] && row[day].toLowerCase() === "yes") {
          deals.push(index + 1); // Map Monday=1, Tuesday=2, etc.
        }
      });
      tr.setAttribute('data-deals', deals.join(','));

      // Generate the restaurant's favicon URL dynamically from its URL
      var faviconURL = getFaviconURL(row.RestaurantURL);

      // Build the restaurant info cell including favicon, name, and clickable icons
      var tdInfo = document.createElement('td');
      tdInfo.className = 'rest-info';
      tdInfo.innerHTML = `
        <div class="rest-header">
          <img class="rest-icon" src="${faviconURL}" alt="${row.RestaurantName}" onerror="this.onerror=null; this.src='https://www.google.com/s2/favicons?sz=64&domain=example.com';">
          <span class="rest-name">${row.RestaurantName}</span>
          <div class="icon-links">
            <a class="homepage-link" href="${row.RestaurantURL}" target="_blank" title="Restaurant Homepage" onclick="event.stopPropagation();">
              <svg viewBox="0 0 24 24">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4h-2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"></path>
              </svg>
            </a>
            <a class="maps-link" href="${row.MapsURL ? row.MapsURL : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(row.RestaurantName) + '+Atlanta')}" target="_blank" title="Google Maps" onclick="event.stopPropagation();">
              <svg viewBox="0 0 24 24">
                <path d="M21 10c0 5.5-9 13-9 13S3 15.5 3 10a9 9 0 1118 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </a>
          </div>
        </div>
        <span class="overall-deal">${row.Deal}</span>
      `;
      tr.appendChild(tdInfo);

      // Create weekday cells (Mon-Fri) and display a checkmark if a deal exists
      weekdayKeys.forEach(function(day) {
        var td = document.createElement('td');
        td.className = 'day-cell';
        if (row[day] && row[day].toLowerCase() === "yes") {
          td.innerHTML = '<div class="checkmark">✔</div>';
        } else if (row[day] && row[day].trim() !== "") {
          td.innerHTML = `<div>${row[day]}</div>`;
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    // Finalize the table structure and append the section to the main container
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);
    container.appendChild(section);
  });
}

/**
 * filterRows
 * 
 * Filters restaurant rows based on the "Happening now" toggle and the user's current weekday.
 * Each row's custom data-deals attribute is used to determine if a deal is available today.
 * On weekends or if the toggle is off, all rows are displayed.
 */
function filterRows() {
  // Determine the current weekday (0 = Sunday, 1 = Monday, …, 6 = Saturday)
  let currentDay = new Date().getDay();
  // Only filter for weekdays (Mon-Fri); on weekends, do not filter.
  if (currentDay === 0 || currentDay === 6) {
    currentDay = null;
  }
  
  // Select all restaurant rows
  const rows = document.querySelectorAll('.rest-row');
  rows.forEach(row => {
    if (document.getElementById('happening-now-toggle').checked && currentDay !== null) {
      const dealDays = row.getAttribute('data-deals');
      if (dealDays && dealDays.split(',').map(day => day.trim()).includes(String(currentDay))) {
        row.style.display = ''; // Show row if a deal is available today
      } else {
        row.style.display = 'none'; // Hide row if no deal is available
      }
    } else {
      // If toggle is off or it's the weekend, show all rows
      row.style.display = '';
    }
  });
}