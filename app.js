// Initialize map centred on North West UK (Liverpool area)
let map = L.map('map').setView([53.4721, -2.9578], 8);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDc2fBzmChqhQLAkq_McjdQByt1lmEZyKY",
  authDomain: "abacus-customer-map.firebaseapp.com",
  projectId: "abacus-customer-map",
  storageBucket: "abacus-customer-map.firebasestorage.app",
  messagingSenderId: "108028759858",
  appId: "1:108028759858:web:44f13cd07dc6bd74f2912b"
};

// Google Sheets Configuration
// REPLACE THIS with your Google Apps Script web app URL
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwEdAiHOUoQm2uAHeYgXrUP-L7HpH_MNG5ycfOkqd-p4LFLJAuSV283He-zO6GuNi4/exec';

// Initialize Firebase
let db = null;
let storage = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    storage = firebase.storage();
} catch (error) {
    console.error('Firebase initialization error:', error);
    alert('Database connection failed. Using local storage only.');
}

// Storage key (fallback for local storage)
const STORAGE_KEY = 'abacus_installations';

// State management
let currentImages = [];
let installations = [];
let isAdminMode = false;
let activeFilters = ['all']; // Array to support multiple filters
let userLocation = null;
let editingInstallationId = null;
let currentModalImages = [];
let currentModalImageIndex = 0;

// Privacy settings
const PRIVACY_RADIUS_KM = 0.5; // Show approximate location within 500m

// Load installations from localStorage
function loadInstallations() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// Load installations from Firebase
async function loadInstallationsFromFirebase() {
    if (!db) {
        return loadInstallations(); // Fallback to localStorage
    }
    
    try {
        const snapshot = await db.collection('installations').orderBy('createdAt', 'desc').get();
        const installations = [];
        snapshot.forEach(doc => {
            installations.push({ ...doc.data(), id: doc.id });
        });
        return installations;
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        return loadInstallations(); // Fallback to localStorage
    }
}

// Toggle admin mode
function toggleAdminMode() {
    const password = prompt('Enter admin password:');
    if (password === 'abacus2025') {
        isAdminMode = !isAdminMode;
        document.body.classList.toggle('admin-mode', isAdminMode);
        updateAdminButton();
        renderInstallations();
        alert(isAdminMode ? 'Admin mode enabled' : 'Admin mode disabled');
    } else if (password !== null) {
        alert('Incorrect password');
    }
}

// Logout from admin mode
function logoutAdmin() {
    if (confirm('Are you sure you want to logout from admin mode?')) {
        isAdminMode = false;
        document.body.classList.remove('admin-mode');
        updateAdminButton();
        renderInstallations();
        alert('Logged out successfully');
    }
}

// Update admin button text
function updateAdminButton() {
    const btn = document.getElementById('adminToggleBtn');
    if (btn) {
        btn.textContent = isAdminMode ? '🔓 Admin Mode (Active)' : '🔐 Admin Mode';
    }
}

// Filter by single technology (All button)
function filterTechnology(tech) {
    activeFilters = [tech];
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === tech);
    });
    renderInstallations();
}

// Toggle filter (multi-select for specific technologies)
function toggleFilter(tech) {
    // Remove 'all' if it's active
    if (activeFilters.includes('all')) {
        activeFilters = [];
    }
    
    // Toggle the filter
    const index = activeFilters.indexOf(tech);
    if (index > -1) {
        activeFilters.splice(index, 1);
    } else {
        activeFilters.push(tech);
    }
    
    // If no filters selected, default to 'all'
    if (activeFilters.length === 0) {
        activeFilters = ['all'];
    }
    
    // Update button states
    document.querySelectorAll('.btn-filter').forEach(btn => {
        const filterValue = btn.dataset.filter;
        if (filterValue === 'all') {
            btn.classList.toggle('active', activeFilters.includes('all'));
        } else {
            btn.classList.toggle('active', activeFilters.includes(filterValue));
        }
    });
    
    renderInstallations();
}

// Randomize location for privacy (offset by up to PRIVACY_RADIUS_KM)
function getPrivateLocation(lat, lng) {
    if (isAdminMode) return { lat, lng };
    
    // Offset in kilometers
    const offsetKm = PRIVACY_RADIUS_KM;
    const latOffset = (Math.random() - 0.5) * (offsetKm / 111); // 1 degree lat ≈ 111km
    const lngOffset = (Math.random() - 0.5) * (offsetKm / (111 * Math.cos(lat * Math.PI / 180)));
    
    return {
        lat: lat + latOffset,
        lng: lng + lngOffset
    };
}

// Get anonymized address
function getPrivateAddress(address) {
    if (isAdminMode) return address;
    
    // Remove extra whitespace
    const cleanAddress = address.trim();
    
    // Try multiple UK postcode patterns - more aggressive matching
    // Full postcode: L7 1AA, WA1 2BB, SW1A 1AA, etc.
    let postcodeMatch = cleanAddress.match(/([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}/i);
    if (postcodeMatch) {
        return `${postcodeMatch[1].toUpperCase()} Area`;
    }
    
    // Try to find any postcode-like pattern anywhere in the string
    postcodeMatch = cleanAddress.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/gi);
    if (postcodeMatch && postcodeMatch.length > 0) {
        // Take the last match (likely to be the postcode)
        const lastMatch = postcodeMatch[postcodeMatch.length - 1];
        return `${lastMatch.toUpperCase()} Area`;
    }
    
    // Try to extract from comma-separated format
    const parts = cleanAddress.split(',').map(p => p.trim()).filter(p => p.length > 0);
    
    // Check each part for a postcode
    for (let i = parts.length - 1; i >= 0; i--) {
        const part = parts[i];
        const match = part.match(/([A-Z]{1,2}\d{1,2}[A-Z]?)/i);
        if (match) {
            return `${match[1].toUpperCase()} Area`;
        }
    }
    
    // Fallback: use city name
    if (parts.length >= 2) {
        const city = parts[parts.length - 2];
        if (city.length > 2 && !city.match(/^\d/)) {
            return `${city} Area`;
        }
    }
    
    return 'Local Area';
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function normalizePostcode(postcode) {
    return (postcode || '').toUpperCase().replace(/\s+/g, '');
}

// Find nearby installations
async function findNearbyInstallations() {
    const input = document.getElementById('postcodeInput');
    const postcode = input.value.trim();
    
    if (!postcode) {
        alert('Please enter a postcode or city name');
        return;
    }
    
    // Show loading state
    const searchBtn = event?.target || document.querySelector('.distance-input-group button');
    const originalText = searchBtn?.textContent;
    if (searchBtn) {
        searchBtn.disabled = true;
        searchBtn.textContent = 'Searching...';
    }
    
    try {
        const coords = await geocodeAddress(postcode);
        if (!coords) {
            alert('Could not find that location. Please try a different postcode or city name.');
            return;
        }
        
        userLocation = coords;
    
        // Calculate distances and sort (based on postcode coordinates)
        const updatedInstallations = [];
        const normalizedSearchPostcode = normalizePostcode(postcode);
        for (const install of installations) {
            if (!isValidCoordinates(install.coordinates)) {
                const installPostcode = getInstallationPostcode(install);
                if (installPostcode) {
                    const installCoords = await geocodeAddress(installPostcode);
                    if (installCoords) {
                        install.coordinates = installCoords;
                        install.updatedAt = new Date().toISOString();
                        updatedInstallations.push(install);
                    }
                }
            }

            const installPostcodeNormalized = normalizePostcode(getInstallationPostcode(install));
            if (normalizedSearchPostcode && installPostcodeNormalized && normalizedSearchPostcode === installPostcodeNormalized) {
                install.distance = 0;
                install.exactPostcodeMatch = true;
            } else if (isValidCoordinates(install.coordinates)) {
                install.distance = calculateDistanceMiles(
                    coords.lat, coords.lng,
                    install.coordinates.lat, install.coordinates.lng
                );
                install.exactPostcodeMatch = false;
            } else {
                install.distance = Infinity;
                install.exactPostcodeMatch = false;
            }
        }

        if (updatedInstallations.length > 0) {
            saveInstallations();
            await Promise.all(updatedInstallations.map(install => saveInstallationToFirebase(install)));
        }
        
        // Zoom to user location
        map.setView([coords.lat, coords.lng], 11);
        
        // Re-render with distances
        renderInstallations();
        
        // Scroll to gallery section
        setTimeout(() => {
            const gallerySection = document.getElementById('gallerySection');
            if (gallerySection && gallerySection.classList.contains('visible')) {
                gallerySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 500);
    } catch (error) {
        console.error('Search error:', error);
        alert('An error occurred while searching. Please try again.');
    } finally {
        // Restore button state
        if (searchBtn) {
            searchBtn.disabled = false;
            searchBtn.textContent = originalText || 'Search';
        }
    }
}

// Save installations to localStorage
function saveInstallations() {
    try {
        const safeInstallations = installations.map(install => ({
            ...install,
            images: []
        }));
        const jsonData = JSON.stringify(safeInstallations);
        localStorage.setItem(STORAGE_KEY, jsonData);
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            alert('Storage limit exceeded! Try removing some images or older installations.');
        } else {
            alert('Error saving installation. Please try again.');
        }
        throw error;
    }
}

// Save installation to Firebase
async function saveInstallationToFirebase(installation) {
    if (!db) {
        return; // Fallback already saved to localStorage
    }
    
    try {
        // Convert numeric ID to string for Firebase
        const installationData = { ...installation, id: String(installation.id) };
        await db.collection('installations').doc(String(installation.id)).set(installationData);
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        alert('Could not save to cloud database. Data saved locally only.');
        return false;
    }
}

// Delete installation from Firebase
async function deleteInstallationFromFirebase(installId) {
    if (!db) {
        return;
    }
    
    try {
        await db.collection('installations').doc(String(installId)).delete();
    } catch (error) {
        console.error('Error deleting from Firebase:', error);
    }
}

// Handle image preview with compression
function handleImagePreview(event) {
    const files = event.target.files;
    
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Compress image if it's too large
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Resize if larger than 1200px
                const maxDimension = 1200;
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = (height / width) * maxDimension;
                        width = maxDimension;
                    } else {
                        width = (width / height) * maxDimension;
                        height = maxDimension;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Compress to JPEG with 0.8 quality
                const compressedData = canvas.toDataURL('image/jpeg', 0.8);
                currentImages.push(compressedData);
                renderImagePreviewFromCurrentImages();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Remove image from preview
function removeImage(index) {
    currentImages.splice(index, 1);
    renderImagePreviewFromCurrentImages();
}

// Geocode address using Nominatim with rate limiting and timeout
let lastGeocodingCall = 0;
async function geocodeAddress(address) {
    try {
        // Respect Nominatim rate limit (1 request per second)
        const now = Date.now();
        const timeSinceLastCall = now - lastGeocodingCall;
        if (timeSinceLastCall < 1000) {
            await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastCall));
        }
        lastGeocodingCall = Date.now();
        
        // Add timeout to prevent hanging (15 seconds for mobile)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        // Try with UK country code first
        let response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)},UK&countrycodes=gb&limit=1`,
            { 
                signal: controller.signal,
                headers: {
                    'User-Agent': 'AbacusEnergyMap/1.0'
                }
            }
        );
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (data && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.error('Geocoding request timed out');
            alert('The address lookup timed out. Please try again.');
        } else {
            console.error('Geocoding error:', error);
        }
    }
    return null;
}

// Handle form submission
async function handleSubmit(event) {
    event.preventDefault();
    
    const customerName = document.getElementById('customerName').value;
    const postcode = document.getElementById('postcode').value.trim().toUpperCase();
    
    // Use postcode only for geocoding and storage
    const fullAddress = postcode;
    
    // Get selected technologies
    const technologyCheckboxes = document.querySelectorAll('input[name="technology"]:checked');
    const technologyTypes = Array.from(technologyCheckboxes).map(cb => cb.value);
    
    if (technologyTypes.length === 0) {
        alert('Please select at least one technology type');
        return;
    }
    
    // Get selected brands
    const brandsInstalled = getSelectedBrands();
    if (brandsInstalled.length === 0) {
        alert('Please select at least one installed brand');
        return;
    }
    
    const installYearInput = document.getElementById('installYear').value;
    const installYear = installYearInput ? String(parseInt(installYearInput, 10)) : String(new Date().getFullYear());
    const description = document.getElementById('description').value;

    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;

    try {
        const isEditing = Boolean(editingInstallationId);
        // Geocode using the postcode only
        const coords = await geocodeAddress(fullAddress);
        
        if (!coords) {
            alert('Could not find the postcode. Please check it is correct.');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            return;
        }
        let installation = null;
        if (editingInstallationId) {
            const existingIndex = installations.findIndex(i => String(i.id) === String(editingInstallationId));
            if (existingIndex === -1) {
                alert('Installation not found. Please try again.');
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
                return;
            }
            const existing = installations[existingIndex];
            const preparedImages = await prepareImagesForSave(existing.id || editingInstallationId);
            installation = {
                ...existing,
                customerName,
                postcode,
                address: fullAddress,
                technologyTypes,
                brandsInstalled,
                productInstalled: brandsInstalled.join(', '),
                installYear,
                description,
                images: preparedImages,
                coordinates: coords,
                updatedAt: new Date().toISOString()
            };
            installations[existingIndex] = installation;
        } else {
            const newId = Date.now();
            const preparedImages = await prepareImagesForSave(newId);
            installation = {
                id: newId,
                customerName,
                postcode,
                address: fullAddress,
                technologyTypes: technologyTypes,
                brandsInstalled,
                productInstalled: brandsInstalled.join(', '),
                installYear,
                description,
                images: preparedImages,
                coordinates: coords,
                createdAt: new Date().toISOString()
            };
            installations.push(installation);
        }
        
        saveInstallations();
        await saveInstallationToFirebase(installation);

        // Reset form
        resetInstallationForm();
        editingInstallationId = null;

        // Close modal and refresh display
        closeAddModal();
        renderInstallations();

        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        alert(isEditing ? 'Installation updated successfully!' : 'Installation added successfully!');
    } catch (error) {
        alert('An error occurred while adding the installation. Please try again.');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Render installations on map and in gallery
function renderInstallations() {
    const gallerySection = document.getElementById('gallerySection');
    const galleryTitle = document.getElementById('galleryTitle');
    const gallerySubtitle = document.getElementById('gallerySubtitle');
    
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) {
            map.removeLayer(layer);
        }
    });

    // Clear gallery
    const galleryGrid = document.getElementById('gallery-grid');
    galleryGrid.innerHTML = '';
    
    // Filter installations
    let filteredInstallations = installations.filter(install => {
        if (activeFilters.includes('all')) return true;
        // Check if installation has any of the selected technologies
        const techs = install.technologyTypes || (install.technologyType ? [install.technologyType] : []);
        return techs.some(tech => activeFilters.includes(tech));
    });
    
    // Show gallery only if user searched for location (not in admin mode viewing)
    if (!isAdminMode && userLocation) {
        gallerySection.classList.add('visible');
        galleryTitle.textContent = 'Installations Near You';
        gallerySubtitle.textContent = `Showing ${Math.min(filteredInstallations.length, 6)} closest installations to your location`;
    } else if (isAdminMode) {
        gallerySection.classList.add('visible');
        galleryTitle.textContent = 'All Installations (Admin View)';
        gallerySubtitle.textContent = `Managing ${filteredInstallations.length} installation(s)`;
    } else {
        gallerySection.classList.remove('visible');
    }

    if (filteredInstallations.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <p>No installations found near your location</p>
            </div>
        `;
        return;
    }
    
    // Sort by distance if user location is set (BEFORE slicing for gallery)
    if (userLocation) {
        filteredInstallations.sort((a, b) => (
            (Number.isFinite(a.distance) ? a.distance : Infinity) - (Number.isFinite(b.distance) ? b.distance : Infinity)
        ));
    }
    
    // For non-admin users, only show closest 6 installations in gallery (after sorting)
    const displayInstallations = isAdminMode ? filteredInstallations : filteredInstallations.slice(0, 6);

    // Add markers for ALL filtered installations to map
    filteredInstallations.forEach(installation => {
        const privateCoords = getPrivateLocation(installation.coordinates.lat, installation.coordinates.lng);
        const privateAddress = getPrivateAddress(installation.address);
        
        // Add marker to map
        const marker = L.marker([privateCoords.lat, privateCoords.lng])
            .addTo(map);
        
        const distanceBadge = Number.isFinite(installation.distance) ? 
            `<span class="distance-badge">${formatDistanceBadge(installation)}</span>` : '';
        
        let installTechs = installation.technologyTypes || (installation.technologyType ? [installation.technologyType] : ['solar']);
        let installTechLabels = installTechs.map(t => getTechnologyLabel(t)).join(', ');
        
        // Get first image for popup preview
        const popupImageHtml = installation.images.length > 0 
            ? `<img src="${installation.images[0]}" alt="Installation" style="width: 100%; height: 150px; object-fit: cover; border-radius: 6px; margin-bottom: 0.5rem;">` 
            : '';
        
        marker.bindPopup(`
            <div class="popup-content">
                ${popupImageHtml}
                <h3>${isAdminMode ? installation.customerName : privateAddress}${distanceBadge}</h3>
                <p><strong>Technology:</strong> ${installTechLabels}</p>
                <p><strong>Brands Installed:</strong> ${getInstallationBrandsText(installation)}</p>
                ${!isAdminMode ? `
                    <button onclick="showDetail('${installation.id}')" style="background: #2E4591; color: white; padding: 0.75rem 1rem; border: none; border-radius: 6px; cursor: pointer; width: 100%; margin: 0.5rem 0; font-size: 1rem;">View Photos & Details</button>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                        <button onclick="requestCallback('${installation.id}', 'phone')" style="background: #48bb78; color: white; padding: 0.75rem 0.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">📞 Request Call</button>
                        <button onclick="requestCallback('${installation.id}', 'visit')" style="background: #2E4591; color: white; padding: 0.75rem 0.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">🏠 Request Visit</button>
                    </div>
                ` : `
                    <p><strong>Installation Year:</strong> ${getInstallationYear(installation)}</p>
                    <div class="admin-actions">
                        <button onclick="showDetail('${installation.id}')" style="background: #2E4591; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">View Details</button>
                        <button onclick="openEditModal('${installation.id}')" style="background: #00ABED; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">Edit</button>
                        <button onclick="deleteInstallation('${installation.id}')" class="btn-delete" style="flex: 0.5; margin-top: 0;">🗑️ Delete</button>
                    </div>
                `}
            </div>
        `);
        
        // On mobile, open full modal instead of popup
        marker.on('click', function(e) {
            if (window.innerWidth <= 768) {
                e.target.closePopup();
                showDetail(installation.id);
            }
        });
    });
    
    // Add gallery cards (limited to closest 6 for non-admin)
    displayInstallations.forEach(installation => {
        const privateAddress = getPrivateAddress(installation.address);
        
        const card = document.createElement('div');
        card.className = 'installation-card';
        card.onclick = () => showDetail(installation.id);
        
        const imageHtml = installation.images.length > 0 
            ? `<img src="${installation.images[0]}" alt="Installation" class="card-image">`
            : `<div class="card-image" style="display:flex;align-items:center;justify-content:center;background:#f7fafc;">
                 <svg width="60" height="60" fill="#cbd5e0" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"></path>
                 </svg>
               </div>`;

        const distanceText = Number.isFinite(installation.distance) ? 
            `<p><strong>Distance:</strong> <span class="distance-badge" style="margin-left:0;">${formatDistanceBadge(installation, true)}</span></p>` : '';
        
        let cardTechs = installation.technologyTypes || (installation.technologyType ? [installation.technologyType] : ['solar']);
        let cardTechLabels = cardTechs.map(t => getTechnologyLabel(t)).join(', ');
        
        card.innerHTML = `
            ${imageHtml}
            <div class="card-content">
                <h3>${privateAddress}</h3>
                <p><strong>Technology:</strong> ${cardTechLabels}</p>
                <p><strong>Brands Installed:</strong> ${getInstallationBrandsText(installation)}</p>
                ${distanceText}
                ${isAdminMode ? `
                    <p><strong>Customer:</strong> ${installation.customerName}</p>
                    <p><strong>Installation Year:</strong> ${getInstallationYear(installation)}</p>
                    <button class="btn" style="background: #00ABED; color: white; margin-top: 0.5rem; width: 100%;" onclick="event.stopPropagation(); openEditModal('${installation.id}')">✏️ Edit Installation</button>
                    <button class="btn-delete" onclick="event.stopPropagation(); deleteInstallation(${installation.id})">🗑️ Delete Installation</button>
                ` : ''}
            </div>
        `;
        
        galleryGrid.appendChild(card);
    });

    // Fit map to show all markers
    if (filteredInstallations.length > 0) {
        if (userLocation) {
            // If user searched for location, stay zoomed on their area
            map.setView([userLocation.lat, userLocation.lng], 11);
        } else {
            // Otherwise, zoom to fit all filtered installations or default to Liverpool
            const bounds = L.latLngBounds(filteredInstallations.map(i => {
                const privateCoords = getPrivateLocation(i.coordinates.lat, i.coordinates.lng);
                return [privateCoords.lat, privateCoords.lng];
            }));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
        }
    } else {
        // No installations, default to Liverpool area
        map.setView([53.4721, -2.9578], 9);
    }
}

// Get technology label
function getTechnologyLabel(tech) {
    const labels = {
        'solar': '☀️ Solar PV',
        'heat-pump': '🔥 Heat Pump',
        'battery': '🔋 Battery Storage',
        'ev-charger': '⚡ EV Charger',
        'solar-battery': '☀️🔋 Solar & Battery',
        'heat-pump-solar': '🔥☀️ Heat Pump & Solar'
    };
    return labels[tech] || tech;
}

// Format date to British format (DD/MM/YYYY)
function formatDateBritish(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function isValidCoordinates(coords) {
    return coords && typeof coords.lat === 'number' && typeof coords.lng === 'number' && !Number.isNaN(coords.lat) && !Number.isNaN(coords.lng);
}

function getInstallationPostcode(installation) {
    if (!installation) return '';
    if (installation.postcode) return installation.postcode;
    return extractPostcodeFromAddress(installation.address || '');
}

function formatDistanceBadge(installation, compact = false) {
    if (!Number.isFinite(installation.distance)) return '';
    if (installation.exactPostcodeMatch) {
        return compact ? '0 m' : '0 m away';
    }
    const miles = installation.distance.toFixed(1);
    return compact ? `${miles} mi` : `${miles} mi away`;
}

function getInstallationYear(installation) {
    if (installation.installYear) return installation.installYear;
    if (installation.installDate) {
        const date = new Date(installation.installDate);
        return String(date.getFullYear());
    }
    return '';
}

function getInstallationBrandsText(installation) {
    const brands = installation.brandsInstalled ?? installation.productInstalled ?? '';
    if (Array.isArray(brands)) return brands.join(', ');
    return brands;
}

function getSelectedBrands() {
    const brandCheckboxes = document.querySelectorAll('input[name="brand"]:checked');
    const brands = Array.from(brandCheckboxes).map(cb => cb.value);
    const otherBrandInput = document.getElementById('brandOther');
    if (otherBrandInput && otherBrandInput.value.trim()) {
        brands.push(otherBrandInput.value.trim());
    }
    return brands;
}

function extractPostcodeFromAddress(address) {
    if (!address) return '';
    const match = address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}/i);
    if (match) return match[0].toUpperCase();
    return address.trim().toUpperCase();
}

function resetInstallationForm() {
    document.getElementById('installationForm').reset();
    document.querySelectorAll('input[name="technology"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="brand"]').forEach(cb => cb.checked = false);
    const otherBrandInput = document.getElementById('brandOther');
    if (otherBrandInput) otherBrandInput.value = '';
    document.getElementById('imagePreview').innerHTML = '';
    currentImages = [];
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Add New Installation';
    const submitBtn = document.getElementById('submitInstallationBtn');
    if (submitBtn) submitBtn.textContent = 'Add Installation';
}

// async function prepareImagesForSave(installId) {
//     if (!storage) {
//         return [...currentImages];
//     }

//     const uploads = currentImages.map(async (img, index) => {
//         if (typeof img === 'string' && img.startsWith('data:image')) {
//             const fileRef = storage.ref().child(`installations/${installId}/image_${Date.now()}_${index}.jpg`);
//             await fileRef.putString(img, 'data_url');
//             return await fileRef.getDownloadURL();
//         }
//         return img;
//     });

//     const results = await Promise.all(uploads);
//     return results.filter(Boolean);
// }

async function prepareImagesForSave(installId) {
    if (!storage) {
        return [...currentImages];
    }

    const uploads = currentImages.map(async (img, index) => {
        if (typeof img === 'string' && img.startsWith('data:image')) {
            try {
                // Convert data URL to blob
                const response = await fetch(img);
                const blob = await response.blob();
                
                // Use modular Firebase SDK syntax
                const { ref, uploadBytes, getDownloadURL } = storage;
                const storageRef = ref(storage, `installations/${installId}/image_${Date.now()}_${index}.jpg`);
                const uploadTask = await uploadBytes(storageRef, blob);
                const downloadURL = await getDownloadURL(uploadTask.ref);
                return downloadURL;
            } catch (error) {
                console.error('Error uploading image:', error);
                return img; // Fallback to data URL if upload fails
            }
        }
        return img;
    });

    const results = await Promise.all(uploads);
    return results.filter(Boolean);
}

function renderImagePreviewFromCurrentImages() {
    const previewContainer = document.getElementById('imagePreview');
    previewContainer.innerHTML = '';
    currentImages.forEach((img, i) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        const moveLeftDisabled = i === 0 ? 'disabled' : '';
        const moveRightDisabled = i === currentImages.length - 1 ? 'disabled' : '';
        previewItem.innerHTML = `
            <img src="${img}" alt="Preview">
            <button type="button" onclick="removeImage(${i})">×</button>
            <div class="preview-reorder">
                <button type="button" ${moveLeftDisabled} onclick="moveImageLeft(${i})">◀</button>
                <button type="button" ${moveRightDisabled} onclick="moveImageRight(${i})">▶</button>
            </div>
        `;
        previewContainer.appendChild(previewItem);
    });
}

function moveImageLeft(index) {
    if (index <= 0) return;
    const temp = currentImages[index - 1];
    currentImages[index - 1] = currentImages[index];
    currentImages[index] = temp;
    renderImagePreviewFromCurrentImages();
}

function moveImageRight(index) {
    if (index >= currentImages.length - 1) return;
    const temp = currentImages[index + 1];
    currentImages[index + 1] = currentImages[index];
    currentImages[index] = temp;
    renderImagePreviewFromCurrentImages();
}

// Request callback/visit
function requestCallback(installId, type) {
    // Convert to string for comparison since Firebase IDs are strings
    const installation = installations.find(i => String(i.id) === String(installId));
    if (!installation) return;
    
    const typeText = type === 'phone' ? 'phone call' : 'property visit';
    
    // Create a simple form in the modal
    const detailModal = document.getElementById('detailModal');
    const detailContent = document.getElementById('detailContent');
    
    detailContent.innerHTML = `
        <h3>Request a ${typeText === 'phone call' ? 'Callback' : 'Property Visit'}</h3>
        <p style="color: #718096; margin: 1rem 0;">We'll connect you with the customer who had this installation so you can learn more about their experience.</p>
        <form id="enquiryForm" onsubmit="submitEnquiry(event, '${installId}', '${type}')">
            <div class="form-group">
                <label>Your Name *</label>
                <input type="text" id="enquiryName" required>
            </div>
            <div class="form-group">
                <label>Phone Number *</label>
                <input type="tel" id="enquiryPhone" required placeholder="07XXX XXXXXX">
            </div>
            <div class="form-group">
                <label>Email Address *</label>
                <input type="email" id="enquiryEmail" required placeholder="your.email@example.com">
            </div>
            <div class="form-group">
                <label>Your Postcode *</label>
                <input type="text" id="enquiryPostcode" required placeholder="e.g., L30 1RD">
            </div>
            <div class="form-group">
                <label>Message (Optional)</label>
                <textarea id="enquiryMessage" placeholder="Any specific questions or preferred contact times..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%;">Submit Request</button>
        </form>
    `;
    
    detailModal.classList.add('active');
}

// Submit enquiry form
async function submitEnquiry(event, installId, type) {
    event.preventDefault();
    
    // Convert to string for comparison since Firebase IDs are strings
    const installation = installations.find(i => String(i.id) === String(installId));
    if (!installation) {
        alert('Installation not found. Please try again.');
        return;
    }
    
    const name = document.getElementById('enquiryName').value;
    const phone = document.getElementById('enquiryPhone').value;
    const email = document.getElementById('enquiryEmail').value;
    const postcode = document.getElementById('enquiryPostcode').value;
    const message = document.getElementById('enquiryMessage').value;
    
    const typeText = type === 'phone' ? 'phone call' : 'property visit';
    
    // Create enquiry object
    const enquiry = {
        type,
        customerName: name,
        phone,
        email,
        postcode,
        message,
        interestedInInstallation: installation.id,
        installationAddress: installation.address,
        installationCustomer: installation.customerName,
        technologies: installation.technologyTypes || [installation.technologyType],
        product: getInstallationBrandsText(installation),
        timestamp: new Date().toISOString(),
        submittedAt: new Date().toLocaleString('en-GB', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        })
    };
    
    // Store enquiry in localStorage as backup
    const enquiries = JSON.parse(localStorage.getItem('abacus_enquiries') || '[]');
    enquiries.push(enquiry);
    localStorage.setItem('abacus_enquiries', JSON.stringify(enquiries));
    
    // Send to Google Sheets
    try {
        if (GOOGLE_SHEETS_URL && GOOGLE_SHEETS_URL !== 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE') {
            await fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(enquiry)
            });
        }
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        // Continue anyway - we have the backup in localStorage
    }
    
    // Show success message
    const detailContent = document.getElementById('detailContent');
    detailContent.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
            <h3 style="color: #2E4591; margin-bottom: 1rem;">Request Received!</h3>
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 1.5rem;">
                Thank you ${name}! We've received your request for a ${typeText}.<br><br>
                One of our team will be in touch with you shortly on <strong>${phone}</strong> or <strong>${email}</strong> to arrange for you to speak with the customer about their installation experience.
            </p>
            <button onclick="closeDetailModal()" class="btn btn-primary">Close</button>
        </div>
    `;
}

// Delete installation
async function deleteInstallation(installId) {
    // Convert to string for comparison since Firebase IDs are strings
    const installation = installations.find(i => String(i.id) === String(installId));
    if (!installation) return;
    
    if (!confirm(`Are you sure you want to delete the installation for ${installation.customerName}?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    // Remove from array
    installations = installations.filter(i => String(i.id) !== String(installId));
    saveInstallations();
    
    // Delete from Firebase
    await deleteInstallationFromFirebase(installId);
    
    // Close any open popups
    map.closePopup();
    
    // Re-render
    renderInstallations();
    
    alert('Installation deleted successfully.');
}

// Show installation detail
function showDetail(id) {
    // Convert to string for comparison since Firebase IDs are strings
    const installation = installations.find(i => String(i.id) === String(id));
    if (!installation) return;

    const detailContent = document.getElementById('detailContent');
    
        const imagesHtml = installation.images.length > 0
                ? `<div class="detail-images">
                         ${installation.images.map((img, idx) => `<img src="${img}" alt="Installation" onclick="openImageModal('${installation.id}', ${idx})">`).join('')}
                     </div>`
        : '<p style="color:#718096;">No images available</p>';
    
    const detailTechs = installation.technologyTypes || (installation.technologyType ? [installation.technologyType] : ['solar']);
    const detailTechLabels = detailTechs.map(t => getTechnologyLabel(t)).join(', ');
    
    const privateAddress = getPrivateAddress(installation.address);
    const distanceBadge = Number.isFinite(installation.distance) ? 
        `<span class="distance-badge">${formatDistanceBadge(installation)}</span>` : '';

    if (isAdminMode) {
        // Admin view - show everything
        detailContent.innerHTML = `
            <div class="detail-info">
                <h3>${installation.customerName}</h3>
                <p><strong>Technologies:</strong> ${detailTechLabels}</p>
                <p><strong>Brands Installed:</strong> ${getInstallationBrandsText(installation)}</p>
                <p><strong>Address:</strong> ${installation.address}</p>
                <p><strong>Installation Year:</strong> ${getInstallationYear(installation)}</p>
                ${installation.description ? `<p><strong>Description:</strong> ${installation.description}</p>` : ''}
            </div>
            ${imagesHtml}
            <div class="admin-actions">
                <button onclick="openEditModal('${installation.id}')" style="background: #00ABED; color: white; padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer;">Edit Installation</button>
                <button class="btn-delete" style="margin-top: 0; width: auto;" onclick="deleteInstallation('${installation.id}'); closeDetailModal();">🗑️ Delete This Installation</button>
            </div>
        `;
    } else {
        // Public view - hide customer details
        detailContent.innerHTML = `
            <div class="detail-info">
                <h3>${privateAddress} ${distanceBadge}</h3>
                <p><strong>Technologies:</strong> ${detailTechLabels}</p>
                <p><strong>Brands Installed:</strong> ${getInstallationBrandsText(installation)}</p>
                <p style="color: #718096; font-style: italic; margin-top: 1rem;">For privacy, customer details are not displayed publicly.</p>
            </div>
            ${imagesHtml}
            <div class="enquiry-section" style="margin-top: 2rem;">
                <h4>Interested in this installation?</h4>
                <p style="color: #718096; margin: 0.5rem 0;">Request to speak with this customer about their experience</p>
                <div class="enquiry-buttons">
                    <button class="btn-phone" onclick="requestCallback('${installation.id}', 'phone')">📞 Request Call</button>
                    <button class="btn-visit" onclick="requestCallback('${installation.id}', 'visit')">🏠 Request Visit</button>
                </div>
            </div>
        `;
    }

    document.getElementById('detailModal').classList.add('active');
}

// Modal controls
function openAddModal() {
    editingInstallationId = null;
    resetInstallationForm();
    document.getElementById('addModal').classList.add('active');
}

function closeAddModal() {
    editingInstallationId = null;
    document.getElementById('addModal').classList.remove('active');
}

function openEditModal(installId) {
    const installation = installations.find(i => String(i.id) === String(installId));
    if (!installation) return;

    editingInstallationId = String(installId);
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = 'Edit Installation';
    const submitBtn = document.getElementById('submitInstallationBtn');
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    document.getElementById('customerName').value = installation.customerName || '';
    document.getElementById('postcode').value = getInstallationPostcode(installation);
    document.getElementById('description').value = installation.description || '';
    document.getElementById('installYear').value = getInstallationYear(installation);

    document.querySelectorAll('input[name="technology"]').forEach(cb => {
        cb.checked = (installation.technologyTypes || []).includes(cb.value);
    });

    const brands = installation.brandsInstalled || (installation.productInstalled ? installation.productInstalled.split(',') : []);
    const normalizedBrands = brands.map(b => b.trim().toLowerCase());
    document.querySelectorAll('input[name="brand"]').forEach(cb => {
        cb.checked = normalizedBrands.includes(cb.value.toLowerCase());
    });
    const otherBrandInput = document.getElementById('brandOther');
    if (otherBrandInput) {
        const knownBrands = Array.from(document.querySelectorAll('input[name="brand"]')).map(cb => cb.value.toLowerCase());
        const customBrands = normalizedBrands.filter(b => !knownBrands.includes(b));
        otherBrandInput.value = customBrands.join(', ');
    }

    currentImages = installation.images ? [...installation.images] : [];
    renderImagePreviewFromCurrentImages();

    document.getElementById('addModal').classList.add('active');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.remove('active');
}

function openImageModal(installId, index) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('imageModalImg');
    if (!modal || !img) return;
    const installation = installations.find(i => String(i.id) === String(installId));
    if (!installation || !installation.images || installation.images.length === 0) return;

    currentModalImages = installation.images;
    currentModalImageIndex = Math.max(0, Math.min(index, currentModalImages.length - 1));
    img.src = currentModalImages[currentModalImageIndex];
    modal.classList.add('active');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('imageModalImg');
    if (!modal || !img) return;
    img.src = '';
    modal.classList.remove('active');
    currentModalImages = [];
    currentModalImageIndex = 0;
}

function showPrevImage() {
    if (!currentModalImages.length) return;
    currentModalImageIndex = (currentModalImageIndex - 1 + currentModalImages.length) % currentModalImages.length;
    const img = document.getElementById('imageModalImg');
    if (img) img.src = currentModalImages[currentModalImageIndex];
}

function showNextImage() {
    if (!currentModalImages.length) return;
    currentModalImageIndex = (currentModalImageIndex + 1) % currentModalImages.length;
    const img = document.getElementById('imageModalImg');
    if (img) img.src = currentModalImages[currentModalImageIndex];
}

// Export data
function exportData() {
    const dataStr = JSON.stringify(installations, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `abacus-installations-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
}

// Close modals on background click
document.getElementById('addModal').addEventListener('click', function(e) {
    if (e.target === this) closeAddModal();
});

document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) closeDetailModal();
});

document.getElementById('imageModal').addEventListener('click', function(e) {
    if (e.target === this) closeImageModal();
});

// Brand selection handles with getSelectedBrands()

// Expose functions globally so they can be called from Leaflet popup HTML
window.showDetail = showDetail;
window.requestCallback = requestCallback;
window.deleteInstallation = deleteInstallation;
window.closeDetailModal = closeDetailModal;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.showPrevImage = showPrevImage;
window.showNextImage = showNextImage;
window.moveImageLeft = moveImageLeft;
window.moveImageRight = moveImageRight;
window.submitEnquiry = submitEnquiry;
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.closeAddModal = closeAddModal;
window.toggleAdminMode = toggleAdminMode;
window.logoutAdmin = logoutAdmin;
window.filterTechnology = filterTechnology;
window.toggleFilter = toggleFilter;
window.findNearbyInstallations = findNearbyInstallations;
window.exportData = exportData;

// Load installations on startup
(async function initializeApp() {
    installations = await loadInstallationsFromFirebase();
    renderInstallations();
})();