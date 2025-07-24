let map = L.map('map').setView([34.05, -118.25], 11); // center on LA by default
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data © OpenStreetMap contributors'
}).addTo(map);

let houseData = [];
let hospitalData = [];
let houseMarker = null;
let hospitalMarkers = [];

// Amenity layers object to hold LayerGroups
const amenityLayers = {};

// Amenity source definitions
const amenitySources = [
  { file: 'data/hospitals.json', label: 'Hospitals', iconUrl: 'images/hospitals.png' },
  { file: 'data/fire_stations.json', label: 'Fire Stations', iconUrl: 'images/firestations.png' },
  { file: 'data/schools.json', label: 'Schools', iconUrl: 'images/schools.png' },
  { file: 'data/arts_and_rec.json', label: 'Recreation', iconUrl: 'images/art.png' },
  { file: 'data/transportation.json', label: 'Transportation', iconUrl: 'images/bus.png' },
  { file: 'data/physical_features.json', label: 'Physical Features', iconUrl: 'images/park.png' }, 
];

// Initialize layer groups for each amenity
amenitySources.forEach(source => {
  amenityLayers[source.label] = L.layerGroup().addTo(map);
});


fetch('data/houses.json')
  .then(res => res.json())
  .then(houses => {
    houseData = houses;

    // Populate datalist with all addresses
    const dataList = document.getElementById('addressList');
    houseData.forEach(house => {
      const option = document.createElement('option');
      option.value = house.address;
      dataList.appendChild(option);
    });
  });



// Load all amenities data
const amenityData = {};
Promise.all(
  amenitySources.map(source =>
    fetch(source.file)
      .then(res => res.json())
      .then(data => {
        amenityData[source.label] = data;
      })
  )
).then(() => {
  console.log('All amenities loaded');
  document.getElementById('searchBtn').disabled = false;  // enable search now
})

document.getElementById('searchBtn').addEventListener('click', () => {
  const input = document.getElementById('searchBox').value.trim().toLowerCase();
  const match = houseData.find(h => h.address.toLowerCase() === input);

  if (!match) {
    document.getElementById('error').textContent = 'Address not found.';
    return;
  } else {
    document.getElementById('error').textContent = '';
    updateMap(match);
  }
});

let selectedHouse = null;

function updateMap(house) {
  // Clear previous markers
  if (houseMarker) map.removeLayer(houseMarker);
  // Clear previous amenity markers
  Object.values(amenityLayers).forEach(layerGroup => layerGroup.clearLayers())
selectedHouse = house;
  // Add house marker
  houseMarker = L.circleMarker([house.latitude, house.longitude], {
    radius: 8, color: 'blue', fillColor: 'blue', fillOpacity: 0.8
  }).addTo(map).bindPopup(`Total Value: $${house.total_value.toLocaleString()}`).openPopup();

  map.setView([house.latitude, house.longitude], 12);

  // Populate Home Features box
  document.getElementById('bedrooms').textContent = house.bedrooms ?? '--';
  document.getElementById('bathrooms').textContent = house.bathrooms ?? '--';
  document.getElementById('yearBuilt').textContent = house.year ?? '--';
  document.getElementById('sqft').textContent = house.square_footage ?? '--';
  document.getElementById('units').textContent = house.units ?? '--';

// Show Estimated Value
  document.getElementById('estimatedValue').textContent =
    house.estimated_value ? house.estimated_value.toLocaleString() : '--';


  // For each amenity, add nearby markers
  amenitySources.forEach(source => {
    const nearbyAmenities = amenityData[source.label].filter(a => {
      return getDistance(house.latitude, house.longitude, a.latitude, a.longitude) <= 20;
    });

    nearbyAmenities.forEach(a => {
      const marker = L.marker([a.latitude, a.longitude], {
        icon: L.icon({
          iconUrl: source.iconUrl,
          iconSize: [25, 25],
          iconAnchor: [12, 12]
        })
      }).bindPopup(`${source.label}: ${a.name || 'N/A'}`);

      amenityLayers[source.label].addLayer(marker);
    });
  });
}

L.control.layers(null, amenityLayers, { collapsed: false }).addTo(map);



// Haversine formula (miles)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Radius of Earth in miles
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

document.getElementById('whatIfBtn').addEventListener('click', () => {
  if (!selectedHouse) {
    alert("Please select a house first.");
    return;
  }

  // Pull input values (fall back to original if user left input blank)
const whatIfData = {
  'City Tax Rate Area': selectedHouse['City Tax Rate Area'],
  'Roll Year': selectedHouse['Roll Year'],
  'Property Use Type': selectedHouse['Property Use Type'],
  'Number of Buildings': selectedHouse['Number of Buildings'],
  'Year Built': parseInt(document.getElementById('inputYearBuilt').value) || selectedHouse.year,
  'Effective Year': selectedHouse['Effective Year'],
  'Square Footage': parseInt(document.getElementById('inputSqft').value) || selectedHouse.square_footage,
  'Number of Bedrooms': parseInt(document.getElementById('inputBedrooms').value) || selectedHouse.bedrooms,
  'Number of Bathrooms': parseInt(document.getElementById('inputBathrooms').value) || selectedHouse.bathrooms,
  'Number of Units': parseInt(document.getElementById('inputUnits').value) || selectedHouse.units,
  'Zip Code.1': selectedHouse['Zip Code.1'], // Use exact key name
  'num_nearby_arts_and_rec': selectedHouse.num_nearby_arts_and_rec,
  'num_nearby_fire_stations': selectedHouse.num_nearby_fire_stations,
  'num_nearby_hospitals': selectedHouse.num_nearby_hospitals,
  'num_nearby_physical_features': selectedHouse.num_nearby_physical_features,
  'num_nearby_transportation': selectedHouse.num_nearby_transportation,
  'num_nearby_schools': selectedHouse.num_nearby_schools
};

console.log("Sending what-if data:", whatIfData);

  fetch('/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(whatIfData)
  })
  .then(res => res.json())
  .then(result => {
    // Update what-if predicted value
document.getElementById('whatIfValue').textContent = Math.round(result.what_if_value).toLocaleString();

// Display SHAP summary
const shapDiv = document.getElementById('shapValues');
shapDiv.innerHTML = '';  // clear previous content

if (result.shap_summary && result.shap_summary.length > 0) {
  result.shap_summary.forEach(item => {
  const row = document.createElement('div');
  const sign = item.shap_value > 0 ? '+' : '';
  const cleanName = item.feature.replace(/^.*__/, '');
  row.textContent = `${cleanName}: ${sign}${item.shap_value.toFixed(2)}`;
  row.className = item.shap_value >= 0 ? 'positive' : 'negative';
  shapDiv.appendChild(row);
});
} else {
  shapDiv.textContent = 'No SHAP values available.';
}

  })
  .catch(err => {
    console.error('Prediction error:', err);
    alert('Prediction failed.');
  });
});
