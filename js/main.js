// Wait for the DOM to be fully loaded before running the script
document.addEventListener("DOMContentLoaded", function() {
  // CSV URL published from your Google Sheet (ensure it ends with &output=csv)
  var csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pub?gid=0&single=true&output=csv';

  // Use PapaParse to download and parse the CSV data
  Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
      console.log("CSV Data:", results.data);
      processData(results.data);
      // After processing the data, run the filter in case the toggle is active
      filterRows();
    },
    error: function(err) {
      console.error("Error parsing CSV:", err);
    }
  });

  // Set up the toggle button for filtering "Happening now"
  const toggleButton = document.getElementById('happening-now-toggle');
  if (toggleButton) {
    // When the toggle changes, run the filterRows function
    toggleButton.addEventListener('change', filterRows);
  }
});

/**
 * getDomain - Extracts the domain name from a given URL.
 * Removes any "www." prefix for a cleaner look.
 *
 * @param {string} url - The full URL from which to extract the domain.
 * @returns {string|null} - The domain name or null if the URL is invalid.
 */
function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (error) {
    return null;
  }
}

/**
 * getFaviconURL - Generates a favicon URL dynamically for a restaurant.
 * If no valid domain is found, returns a default favicon URL.
 *
 * @param {string} restaurantURL - The URL of the restaurant's homepage.
 * @returns {string} - The URL to the favicon.
 */
function getFaviconURL(restaurantURL) {
  const domain = getDomain(restaurantURL);
  if (!domain) {
    return 'https://www.google.com/s2/favicons?sz=64&domain=example.com'; // Default favicon if no valid domain
  }
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}

/**
 * processData - Processes CSV data and generates the restaurant tables grouped by neighborhood.
 *
 * The function groups the CSV rows by neighborhood, creates a section for each neighborhood,
 * and builds a table for each section. Each restaurant row is assigned a "data-deals" attribute
 * based on which weekdays (Mon-Fri) have a deal (where the CSV column has "yes").
 *
 * @param {Array} data - Parsed CSV data (array of objects).
 */
function processData(data) {
  // Group data by Neighborhood
  var neighborhoods = {};
  data.forEach(function(row) {
    var neighborhood = row.Neighborhood ? row.Neighborhood.trim() : "Uncategorized";
    if (!neighborhoods[neighborhood]) {
      neighborhoods[neighborhood] = [];
    }
    neighborhoods[neighborhood].push(row);
  });

  // Get the container element where neighborhood sections will be appended
  var container = document.getElementById('neighborhoods');
  container.innerHTML = ""; // Clear any existing content

  // Loop through each neighborhood to create sections and tables
  Object.keys(neighborhoods).forEach(function(neighborhood) {
    // Create a section element for the neighborhood
    var section = document.createElement('section');
    section.className = 'neighborhood';
    section.id = neighborhood.toLowerCase().replace(/\s+/g, '-');

    // Create the neighborhood header element
    var header = document.createElement('div');
    header.className = 'neighborhood-header';
    header.textContent = neighborhood;
    section.appendChild(header);

    // Create table wrapper and table elements
    var tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    var table = document.createElement('table');

    // Build the table header row
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');

    // Header cell for Restaurant & Deal column
    var thRest = document.createElement('th');
    thRest.className = 'rest-col';
    thRest.textContent = 'Restaurant & Deal';
    headerRow.appendChild(thRest);

    // Header cells for weekdays (Mon-Fri)
    var days = ['M', 'T', 'W', 'T', 'F'];
    days.forEach(function(day) {
      var th = document.createElement('th');
      th.textContent = day;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Build the table body by iterating through each restaurant in the neighborhood
    var tbody = document.createElement('tbody');
    neighborhoods[neighborhood].forEach(function(row) {
      // Create a table row for the restaurant
      var tr = document.createElement('tr');
      tr.className = 'rest-row';

      // --- NEW CODE: Set the data-deals attribute based on weekday deal availability ---
      // Mapping weekday keys to day numbers: Monday=1, Tuesday=2, ..., Friday=5.
      var weekdayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      var deals = [];
      weekdayKeys.forEach(function(day, index) {
        // Check if the restaurant has a deal for the day (case-insensitive "yes")
        if (row[day] && row[day].toLowerCase() === "yes") {
          deals.push(index + 1); // Add day number (index + 1)
        }
      });
      // Set a comma-separated list of deal day numbers as a custom attribute
      tr.setAttribute('data-deals', deals.join(','));

      // --- End of NEW CODE for filtering ---

      // Get the favicon dynamically from the RestaurantURL
      var faviconURL = getFaviconURL(row.RestaurantURL);

      // Create restaurant info cell with clickable icons (homepage and Google Maps)
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

      // Create weekday cells for Mon, Tue, Wed, Thu, Fri.
      weekdayKeys.forEach(function(day) {
        var td = document.createElement('td');
        td.className = 'day-cell';
        // If the deal for this day is marked "yes", display a checkmark
        if (row[day] && row[day].toLowerCase() === "yes") {
          td.innerHTML = '<div class="checkmark">✔</div>';
        } else if (row[day] && row[day].trim() !== "") {
          // Otherwise, if there's a custom deal text, display it
          td.innerHTML = `<div>${row[day]}</div>`;
        }
        tr.appendChild(td);
      });

      // Append the completed row to the table body
      tbody.appendChild(tr);
    });

    // Finalize table structure by appending tbody, wrapping it, and then appending to section
    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);
    container.appendChild(section);
  });
}

/**
 * filterRows - Filters restaurant rows based on the user's current weekday.
 *
 * When the "Happening now" toggle is enabled, this function retrieves the current day (Monday–Friday)
 * and displays only those restaurant rows that have a deal on that day, as indicated by the custom
 * data-deals attribute. If it’s a weekend (Saturday or Sunday) or the toggle is off, all rows are shown.
 */
function filterRows() {
  // Get the current day: JavaScript's getDay() returns 0 (Sun) to 6 (Sat)
  let currentDay = new Date().getDay();
  
  // For filtering, consider only weekdays: Monday (1) through Friday (5)
  // If today is Saturday (6) or Sunday (0), set currentDay to null (i.e., do not filter)
  if (currentDay === 0 || currentDay === 6) {
    currentDay = null;
  }
  
  // Select all restaurant rows (each row has the class "rest-row")
  const rows = document.querySelectorAll('.rest-row');
  
  // Loop over each row to determine whether to show or hide it
  rows.forEach(row => {
    // If the toggle is enabled and we're on a valid weekday, filter rows
    if (document.getElementById('happening-now-toggle').checked && currentDay !== null) {
      // Retrieve the comma-separated list of deal day numbers from the row's data attribute
      const dealDays = row.getAttribute('data-deals');
      // Check if the current day (as a string) is included in the dealDays list
      if (dealDays && dealDays.split(',').map(day => day.trim()).includes(String(currentDay))) {
        row.style.display = ''; // Show the row if there is a deal today
      } else {
        row.style.display = 'none'; // Hide the row if no deal is available today
      }
    } else {
      // If the toggle is off (or it's a weekend), show all rows
      row.style.display = '';
    }
  });
}