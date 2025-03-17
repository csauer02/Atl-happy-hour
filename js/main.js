document.addEventListener("DOMContentLoaded", function() {
  // Ensure that your sheet is published. Use the "/pubhtml" version of the URL.
  var publicSpreadsheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRMxih2SsybskeLkCCx-HNENiyM3fY3QaLj7Z_uw-Qw-kp7a91cShfW45Y9IZTd6bKYv-1-MTOVoWFH/pubhtml?gid=0&single=true';

  Tabletop.init({
    key: publicSpreadsheetUrl,
    callback: processData,
    simpleSheet: true,
    debug: true // enables debug logs in the console
  });
});

function processData(data) {
  console.log("Data fetched from Google Sheet:", data);
  
  // If data is empty or undefined, then there may be an issue with accessing the sheet.
  if (!data || data.length === 0) {
    console.error("No data was returned. Please check that your Google Sheet is published to the web and that the URL is correct.");
    return;
  }

  // Group data by Neighborhood
  var neighborhoods = {};
  data.forEach(function(row) {
    // Ensure your column names exactly match what is in your sheet (e.g., "Neighborhood")
    var neighborhood = row.Neighborhood ? row.Neighborhood.trim() : "Uncategorized";
    if (!neighborhoods[neighborhood]) {
      neighborhoods[neighborhood] = [];
    }
    neighborhoods[neighborhood].push(row);
  });

  // Container where neighborhood sections will be added
  var container = document.getElementById('neighborhoods');
  container.innerHTML = ""; // Clear any existing content

  // For each neighborhood, create a section with a table
  Object.keys(neighborhoods).forEach(function(neighborhood) {
    var section = document.createElement('section');
    section.className = 'neighborhood';
    section.id = neighborhood.toLowerCase().replace(/\s+/g, '-');

    // Neighborhood header
    var header = document.createElement('div');
    header.className = 'neighborhood-header';
    header.textContent = neighborhood;
    section.appendChild(header);

    // Table wrapper and table
    var tableWrapper = document.createElement('div');
    tableWrapper.className = 'table-wrapper';
    var table = document.createElement('table');

    // Table header row
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    
    // Restaurant & Deal header cell
    var thRest = document.createElement('th');
    thRest.className = 'rest-col';
    thRest.textContent = 'Restaurant & Deal';
    headerRow.appendChild(thRest);

    // Weekday header cells (Mon-Fri)
    var days = ['M', 'T', 'W', 'T', 'F'];
    days.forEach(function(day) {
      var th = document.createElement('th');
      th.textContent = day;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body: loop through each restaurant for this neighborhood
    var tbody = document.createElement('tbody');
    neighborhoods[neighborhood].forEach(function(row) {
      var tr = document.createElement('tr');
      tr.className = 'rest-row';
      
      // Row click opens the restaurant URL
      tr.addEventListener('click', function() {
        if(row.RestaurantURL) {
          window.open(row.RestaurantURL, '_blank');
        }
      });

      // Restaurant & Deal cell
      var tdInfo = document.createElement('td');
      tdInfo.className = 'rest-info';
      tdInfo.innerHTML = `
        <div class="rest-header">
          <img class="rest-icon" src="${row.ImageURL}" alt="${row.RestaurantName}">
          <span class="rest-name">${row.RestaurantName}</span>
          <div class="maps-link" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.RestaurantName)}+Atlanta','_blank');">
            <svg viewBox="0 0 24 24">
              <path d="M21 10c0 5.5-9 13-9 13S3 15.5 3 10a9 9 0 1118 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        </div>
        <span class="overall-deal">${row.Deal}</span>
      `;
      tr.appendChild(tdInfo);

      // Weekday cells for Mon, Tue, Wed, Thu, Fri.
      var weekdayKeys = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
      weekdayKeys.forEach(function(day) {
        var td = document.createElement('td');
        td.className = 'day-cell';
        // If the cell value is "yes", display a checkmark. Otherwise, show any provided text.
        if(row[day] && row[day].toLowerCase() === "yes") {
          td.innerHTML = '<div class="checkmark">✔</div>';
        } else if (row[day] && row[day].trim() !== "") {
          td.innerHTML = `<div>${row[day]}</div>`;
        }
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);
    container.appendChild(section);
  });
}
