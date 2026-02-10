// Global variables
let currentStep = 1;
let selectedDocument = null;
let selectedInputMethod = null;
let formData = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// API base URL: backend runs on 8000. Use same origin only when page is served from backend (/app/); otherwise call backend on 8000
function getApiBase() {
    var o = window.location.origin;
    var path = window.location.pathname || '';
    // When opened from Live Server (e.g. .../frontend/index.html) or any URL other than /app/, use backend port 8000
    if (path.indexOf('/app/') === 0 || path === '/app' || path === '/') {
        return o; // Same origin (backend serving the app)
    }
    // Different server (e.g. port 5500) or file:// - point to backend
    var host = window.location.hostname || 'localhost';
    return (o && o.indexOf('https') === 0 ? 'https' : 'http') + '://' + host + ':8000';
}
const API_BASE = getApiBase();

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    try {
        loadInitialData();
        setupEventListeners();
    } catch (err) {
        console.error('App init error:', err);
    }
});

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('documentForm');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const langToggle = document.getElementById('languageToggle');
    if (langToggle) langToggle.addEventListener('change', handleLanguageToggle);

    // Canvas setup for freehand writing
    setupCanvas();
}

// Load document types from API
async function loadDocumentTypes() {
    try {
        const response = await fetch(`${API_BASE}/document-types`);
        const data = await response.json();
        console.log('Available document types:', data);
    } catch (error) {
        console.error('Error loading document types:', error);
    }
}

// Map step number to content div id
const STEP_CONTENT_IDS = {
    1: 'documentSelection',
    2: 'inputMethods',
    3: 'formInput',
    4: 'previewDownload'
};

// Step navigation
function goToStep(step) {
    // Hide all step content panels
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.add('hidden');
    });

    // Reset step indicators (pills)
    document.querySelectorAll('.step-indicator').forEach(indicator => {
        indicator.classList.remove('active');
        indicator.classList.add('bg-gray-200');
    });

    // Show the content panel for this step
    const contentId = STEP_CONTENT_IDS[step];
    if (contentId) {
        const contentEl = document.getElementById(contentId);
        if (contentEl) contentEl.classList.remove('hidden');
    }

    // Highlight current step indicator
    const stepEl = document.getElementById(`step${step}`);
    if (stepEl) {
        stepEl.classList.remove('bg-gray-200');
        stepEl.classList.add('active');
    }

    currentStep = step;
}

// Document selection
function selectDocument(documentType) {
    selectedDocument = documentType;
    console.log('Selected document:', documentType);

    // Show loading
    showLoading();

    // Load document template
    loadDocumentTemplate(documentType)
        .then(() => {
            hideLoading();
            goToStep(2);
        })
        .catch(error => {
            hideLoading();
            const msg = (error && error.message) ? error.message : 'दस्तावेज टेम्प्लेट लोड गर्न सकेन।';
            showError(msg + '\n\nसर्भर: ' + API_BASE);
        });
}

// Load document template
async function loadDocumentTemplate(documentType) {
    const url = `${API_BASE}/template/${documentType}`;
    try {
        console.log('Fetching template:', url);
        const response = await fetch(url);

        if (!response.ok) {
            const msg = response.status === 404
                ? 'Template not found. Make sure the server is running and templates are loaded.'
                : `Server error: ${response.status} ${response.statusText}`;
            throw new Error(msg);
        }

        var template = await response.json();
        console.log('Template loaded:', template);

        if (template.form_fields && Array.isArray(template.form_fields)) {
            // Ensure province/district data is loaded before building form
            await ensureLocationData();
            generateFormFields(template.form_fields);
        } else {
            throw new Error('Invalid template format: missing form_fields');
        }
    } catch (error) {
        console.error('Error loading template:', error);
        throw error;
    }
}

// Global location data
var locationData = null;
var locationDataPromise = null;

// Fallback: all 7 provinces and their districts (used when API fails). Ward numbers are 1–33 by convention; user types them.
var NEPAL_LOCATIONS_FALLBACK = {
    country: {
        provinces: [
            { province_id: 1, province_name: 'कोशी प्रदेश', districts: [{ district_name: 'भोजपुर' }, { district_name: 'धनकुटा' }, { district_name: 'इलाम' }, { district_name: 'झापा' }, { district_name: 'खोटाङ' }, { district_name: 'मोरङ' }, { district_name: 'ओखलढुंगा' }, { district_name: 'पाँचथर' }, { district_name: 'संखुवासभा' }, { district_name: 'सोलुखुम्बु' }, { district_name: 'सुनसरी' }, { district_name: 'ताप्लेजुङ' }, { district_name: 'तेह्रथुम' }, { district_name: 'उदयपुर' }] },
            { province_id: 2, province_name: 'मधेश प्रदेश', districts: [{ district_name: 'बारा' }, { district_name: 'धनुषा' }, { district_name: 'महोत्तरी' }, { district_name: 'पर्सा' }, { district_name: 'रौतहट' }, { district_name: 'सप्तरी' }, { district_name: 'सर्लाही' }, { district_name: 'सिरहा' }] },
            { province_id: 3, province_name: 'बागमती प्रदेश', districts: [{ district_name: 'भक्तपुर' }, { district_name: 'चितवन' }, { district_name: 'धादिङ' }, { district_name: 'दोलखा' }, { district_name: 'काठमाडौं' }, { district_name: 'काभ्रेपलाञ्चोक' }, { district_name: 'ललितपुर' }, { district_name: 'मकवानपुर' }, { district_name: 'नुवाकोट' }, { district_name: 'रामेछाप' }, { district_name: 'रसुवा' }, { district_name: 'सिन्धुली' }, { district_name: 'सिन्धुपाल्चोक' }] },
            { province_id: 4, province_name: 'गण्डकी प्रदेश', districts: [{ district_name: 'बागलुङ' }, { district_name: 'गोरखा' }, { district_name: 'कास्की' }, { district_name: 'लमजुङ' }, { district_name: 'मनाङ' }, { district_name: 'मुस्ताङ' }, { district_name: 'म्याग्दी' }, { district_name: 'नवलपुर' }, { district_name: 'पर्वत' }, { district_name: 'स्याङ्जा' }, { district_name: 'तनहुँ' }] },
            { province_id: 5, province_name: 'लुम्बिनी प्रदेश', districts: [{ district_name: 'अर्घाखाँची' }, { district_name: 'बाँके' }, { district_name: 'बर्दिया' }, { district_name: 'दाङ' }, { district_name: 'गुल्मी' }, { district_name: 'कपिलवस्तु' }, { district_name: 'पाल्पा' }, { district_name: 'परासी' }, { district_name: 'प्यूठान' }, { district_name: 'रोल्पा' }, { district_name: 'रुपन्देही' }, { district_name: 'पूर्वी रुकुम' }] },
            { province_id: 6, province_name: 'कर्णाली प्रदेश', districts: [{ district_name: 'दैलेख' }, { district_name: 'डोल्पा' }, { district_name: 'हुम्ला' }, { district_name: 'जाजरकोट' }, { district_name: 'जुम्ला' }, { district_name: 'कालिकोट' }, { district_name: 'मुगु' }, { district_name: 'सल्यान' }, { district_name: 'सुर्खेत' }, { district_name: 'पश्चिम रुकुम' }] },
            { province_id: 7, province_name: 'सुदूरपश्चिम प्रदेश', districts: [{ district_name: 'अछाम' }, { district_name: 'बैतडी' }, { district_name: 'बझाङ' }, { district_name: 'बाजुरा' }, { district_name: 'डडेल्धुरा' }, { district_name: 'दार्चुला' }, { district_name: 'डोटी' }, { district_name: 'कैलाली' }, { district_name: 'कञ्चनपुर' }] }
        ]
    }
};

// Load document types and location data
async function loadInitialData() {
    await Promise.all([loadDocumentTypes(), loadLocationData()]);
}

// Ensure location data is ready (wait for it if still loading). Call this before generating form with province/district.
function ensureLocationData() {
    if (locationData && locationData.country && locationData.country.provinces && locationData.country.provinces.length > 0) {
        return Promise.resolve();
    }
    if (!locationDataPromise) {
        locationDataPromise = loadLocationData();
    }
    return locationDataPromise;
}

// Load location data from API (supports both Nepali keys and English shape). Uses fallback if API fails.
async function loadLocationData() {
    try {
        var response = await fetch(API_BASE + '/locations');
        if (!response.ok) {
            console.warn('Locations API returned', response.status, '- using built-in list');
            locationData = NEPAL_LOCATIONS_FALLBACK;
            return;
        }
        var data = await response.json();
        if (data && data['देश'] && data['देश']['प्रदेशहरू']) {
            var raw = data['देश'];
            locationData = {
                country: {
                    provinces: (raw['प्रदेशहरू'] || []).map(function (p) {
                        return {
                            province_id: p['प्रदेश_आईडी'],
                            province_name: p['प्रदेश_नाम'],
                            districts: (p['जिल्लाहरू'] || []).map(function (d) {
                                // Parse municipalities from स्थानीय_तहहरू
                                var municipalities = (d['स्थानीय_तहहरू'] || []).map(function (m) {
                                    return {
                                        name: m.name || m['नाम'],
                                        type: m.type || m['प्रकार'],
                                        wards: m.wards || m['वडा']
                                    };
                                });
                                return { 
                                    district_name: d['जिल्ला_नाम'],
                                    municipalities: municipalities
                                };
                            })
                        };
                    })
                }
            };
        } else if (data && data.country && data.country.provinces) {
            locationData = data;
        } else {
            locationData = NEPAL_LOCATIONS_FALLBACK;
        }
        if (!locationData.country || !locationData.country.provinces || locationData.country.provinces.length === 0) {
            locationData = NEPAL_LOCATIONS_FALLBACK;
        }
        console.log('Location data loaded, provinces:', locationData.country.provinces.length);
    } catch (error) {
        console.error('Error loading location data:', error, '- using built-in list');
        locationData = NEPAL_LOCATIONS_FALLBACK;
    }
}

// Generate form fields dynamically
function generateFormFields(fields) {
    var formFieldsContainer = document.getElementById('formFields');
    if (!formFieldsContainer) return;
    formFieldsContainer.innerHTML = '';
    if (!Array.isArray(fields) || fields.length === 0) return;

    try {
        generateFormFieldsInner(fields, formFieldsContainer);
    } catch (err) {
        console.error('Error generating form fields:', err);
        formFieldsContainer.innerHTML = '<p class="text-red-600">फारम लोड गर्दा त्रुटि। कृपया पृष्ठ रिफ्रेस गर्नुहोस्।</p>';
    }
}

function generateFormFieldsInner(fields, formFieldsContainer) {
    // Check if we have address fields to group
    const addressFields = fields.filter(f => f.id.includes('address') || f.id.includes('province') || f.id.includes('district') || f.id.includes('municipality') || f.id.includes('ward'));
    const otherFields = fields.filter(f => !addressFields.includes(f));

    // Render other fields first
    otherFields.forEach(function (field) { createFieldElement(field, formFieldsContainer); });

    // Render address fields
    if (addressFields.length > 0) {
        addressFields.forEach(function (field) { createFieldElement(field, formFieldsContainer); });

        var hasPermanent = addressFields.some(function (f) { return f.id.indexOf('permanent') !== -1 || f.id.indexOf('old') !== -1; });
        var hasTemporary = addressFields.some(function (f) { return f.id.indexOf('temporary') !== -1 || f.id.indexOf('new') !== -1; });

        if (hasPermanent && hasTemporary) {
            var copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'mt-2 mb-4 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition text-sm';
            copyBtn.innerHTML = '<i class="fas fa-copy mr-2"></i>स्थायी ठेगाना नै राख्नुहोस्';
            copyBtn.onclick = copyPermanentToTemporary;
            if (formFieldsContainer.lastElementChild) {
                formFieldsContainer.insertBefore(copyBtn, formFieldsContainer.lastElementChild);
            } else {
                formFieldsContainer.appendChild(copyBtn);
            }
        }
    }
}

function copyPermanentToTemporary() {
    // Mapping strategy: replace 'permanent' with 'temporary' or 'old' with 'new'
    const inputs = document.querySelectorAll('#documentForm input, #documentForm select, #documentForm textarea');

    inputs.forEach(input => {
        if (input.id.includes('permanent') || input.id.includes('old')) {
            const targetId = input.id.replace('permanent', 'temporary').replace('old', 'new');
            const targetInput = document.getElementById(targetId);

            if (targetInput) {
                targetInput.value = input.value;
                // Trigger change event for selects to update dependents
                if (targetInput.tagName === 'SELECT') {
                    targetInput.dispatchEvent(new Event('change'));
                }
            }
        }
    });
}

function createFieldElement(field, container) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'mb-4';

    const label = document.createElement('label');
    label.className = `block text-gray-700 font-semibold mb-2 ${field.required ? 'required-field' : ''}`;
    label.textContent = field.label;
    label.setAttribute('for', field.id);

    let input;
    if (field.type === 'select') {
        input = document.createElement('select');
        input.className = 'w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500';
        input.id = field.id;
        input.name = field.id;
        input.required = field.required;

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'छनोट गर्नुहोस्';
        input.appendChild(defaultOption);

        // Special handling for Province (प्रदेश)
        if (field.id.indexOf('province') !== -1) {
            if (locationData && locationData.country && locationData.country.provinces && locationData.country.provinces.length > 0) {
                locationData.country.provinces.forEach(function (p) {
                    var option = document.createElement('option');
                    option.value = p.province_name;
                    option.textContent = p.province_name;
                    if (p.province_id != null) option.dataset.id = p.province_id;
                    input.appendChild(option);
                });
            } else {
                var emptyOpt = document.createElement('option');
                emptyOpt.value = '';
                emptyOpt.textContent = '— प्रदेश लोड भएन (सर्भर जाँच गर्नुहोस्) —';
                input.appendChild(emptyOpt);
            }
            input.addEventListener('change', function (e) { handleProvinceChange(e, field.id); });
        }
        // Special handling for District (जिल्ला) — populated when province is selected
        else if (field.id.indexOf('district') !== -1) {
            if (field.options && field.options.length > 0) {
                field.options.forEach(function (opt) {
                    var optionElement = document.createElement('option');
                    optionElement.value = opt;
                    optionElement.textContent = opt;
                    input.appendChild(optionElement);
                });
            }
            // Add change listener to populate municipalities
            input.addEventListener('change', function (e) { handleDistrictChange(e, field.id); });
        }
        // Special handling for Municipality (स्थानीय तह / नगरपालिका) — populated when district is selected
        else if (field.id.indexOf('municipality') !== -1 || field.id.indexOf('local_body') !== -1) {
            // Will be populated by handleDistrictChange when user selects district
            var infoOpt = document.createElement('option');
            infoOpt.value = '';
            infoOpt.textContent = 'पहिले जिल्ला छनोट गर्नुहोस्';
            input.appendChild(infoOpt);
        }
        else if (field.options) {
            field.options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                input.appendChild(optionElement);
            });
        }
    } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.className = 'w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500';
        input.rows = 4;
        input.id = field.id;
        input.name = field.id;
        input.required = field.required;
    } else {
        input = document.createElement('input');
        input.className = 'w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500';
        input.type = field.type;
        input.id = field.id;
        input.name = field.id;
        input.required = field.required;
    }

    // Add event listener for transliteration
    if (field.id.includes('_en')) {
        input.addEventListener('blur', handleTransliteration);
    }

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    container.appendChild(fieldDiv);
}

function handleProvinceChange(e, provinceFieldId) {
    var selectedProvinceName = e.target.value;
    var districtFieldId = provinceFieldId.replace('province', 'district');
    var districtSelect = document.getElementById(districtFieldId);

    if (!districtSelect) return;

    // Clear district dropdown and show default
    districtSelect.innerHTML = '<option value="">छनोट गर्नुहोस्</option>';
    districtSelect.value = '';

    if (!selectedProvinceName || !locationData || !locationData.country || !locationData.country.provinces) {
        return;
    }

    var province = null;
    for (var i = 0; i < locationData.country.provinces.length; i++) {
        if (locationData.country.provinces[i].province_name === selectedProvinceName) {
            province = locationData.country.provinces[i];
            break;
        }
    }

    if (province && province.districts && province.districts.length > 0) {
        province.districts.forEach(function (d) {
            var option = document.createElement('option');
            option.value = d.district_name;
            option.textContent = d.district_name;
            districtSelect.appendChild(option);
        });
    }

    // Also clear municipality dropdown if exists
    var municipalityFieldId = provinceFieldId.replace('province', 'municipality');
    var municipalitySelect = document.getElementById(municipalityFieldId);
    if (municipalitySelect) {
        municipalitySelect.innerHTML = '<option value="">पहिले जिल्ला छनोट गर्नुहोस्</option>';
    }
}

// Handle district change to populate municipalities
function handleDistrictChange(e, districtFieldId) {
    var selectedDistrictName = e.target.value;
    var municipalityFieldId = districtFieldId.replace('district', 'municipality');
    var municipalitySelect = document.getElementById(municipalityFieldId);
    
    // Find province field id
    var provinceFieldId = districtFieldId.replace('district', 'province');
    var provinceSelect = document.getElementById(provinceFieldId);
    var selectedProvinceName = provinceSelect ? provinceSelect.value : '';

    if (!municipalitySelect) return;

    // Clear municipality dropdown
    municipalitySelect.innerHTML = '<option value="">छनोट गर्नुहोस्</option>';
    municipalitySelect.value = '';

    if (!selectedDistrictName || !selectedProvinceName || !locationData || !locationData.country || !locationData.country.provinces) {
        return;
    }

    // Find the district data
    var province = null;
    for (var i = 0; i < locationData.country.provinces.length; i++) {
        if (locationData.country.provinces[i].province_name === selectedProvinceName) {
            province = locationData.country.provinces[i];
            break;
        }
    }

    if (!province || !province.districts) return;

    var district = null;
    for (var i = 0; i < province.districts.length; i++) {
        if (province.districts[i].district_name === selectedDistrictName) {
            district = province.districts[i];
            break;
        }
    }

    if (district && district.municipalities && district.municipalities.length > 0) {
        district.municipalities.forEach(function (m) {
            var option = document.createElement('option');
            option.value = m.name;
            option.textContent = m.name + (m.type ? ' (' + m.type + ')' : '');
            if (m.wards) option.dataset.wards = m.wards;
            municipalitySelect.appendChild(option);
        });
    }
}

// Input method selection
function selectInputMethod(method) {
    selectedInputMethod = method;

    var voiceEl = document.getElementById('voiceInterface');
    var freehandEl = document.getElementById('freehandInterface');
    var textFormEl = document.getElementById('textForm');
    if (voiceEl) voiceEl.classList.add('hidden');
    if (freehandEl) freehandEl.classList.add('hidden');
    if (textFormEl) textFormEl.classList.add('hidden');

    if (method === 'voice' && voiceEl) {
        voiceEl.classList.remove('hidden');
    } else if (method === 'freehand' && freehandEl) {
        freehandEl.classList.remove('hidden');
    } else if (textFormEl) {
        textFormEl.classList.remove('hidden');
    }

    goToStep(3);
}

// Voice recording functions
async function toggleRecording() {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
}

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Pick best supported audio format for the browser
        const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4'];
        let selectedMime = '';
        for (const mime of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mime)) {
                selectedMime = mime;
                break;
            }
        }
        console.log('Using audio MIME type:', selectedMime || 'browser default');
        
        const recorderOptions = selectedMime ? { mimeType: selectedMime } : {};
        mediaRecorder = new MediaRecorder(stream, recorderOptions);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = handleRecordingStop;

        mediaRecorder.start();
        isRecording = true;

        var recordBtn = document.getElementById('recordBtn');
        var statusEl = document.getElementById('recordingStatus');
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-stop mr-2"></i>रेकर्डिङ बन्द गर्नुहोस्';
            recordBtn.classList.add('voice-recording');
        }
        if (statusEl) statusEl.textContent = 'रेकर्डिङ भइरहेको छ...';

    } catch (error) {
        console.error('Error starting recording:', error);
        showError('माइक्रोफोन पहुँच गर्न सकेन।');
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        isRecording = false;

        var recordBtn = document.getElementById('recordBtn');
        var statusEl = document.getElementById('recordingStatus');
        if (recordBtn) {
            recordBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>रेकर्डिङ सुरु गर्नुहोस्';
            recordBtn.classList.remove('voice-recording');
        }
        if (statusEl) statusEl.textContent = 'रेकर्डिङ पूरा भयो। प्रक्रिया गरिँदैछ...';
    }
}

async function handleRecordingStop() {
    const actualMime = mediaRecorder.mimeType || 'audio/webm';
    const ext = actualMime.includes('ogg') ? 'ogg' : actualMime.includes('mp4') ? 'mp4' : 'webm';
    const audioBlob = new Blob(audioChunks, { type: actualMime });
    const audioFile = new File([audioBlob], `recording.${ext}`, { type: actualMime });
    console.log('Sending audio:', audioFile.name, 'type:', actualMime, 'size:', audioBlob.size);

    try {
        const formData = new FormData();
        formData.append('audio', audioFile);

        const response = await fetch(`${API_BASE}/transcribe-audio`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            displayTranscription(result.transcription);
            fillFormFromTranscription(result.transcription);
        } else {
            throw new Error(result.detail || 'Transcription failed');
        }
    } catch (error) {
        console.error('Error transcribing audio:', error);
        showError('ट्रान्स्क्रिप्सन गर्न सकेन।');
    }
}

function displayTranscription(text) {
    var resultDiv = document.getElementById('transcriptionResult');
    var statusEl = document.getElementById('recordingStatus');
    if (resultDiv) {
        resultDiv.textContent = 'पहिचानिएको पाठ: ' + text;
        resultDiv.classList.remove('hidden');
    }
    if (statusEl) statusEl.textContent = 'ट्रान्स्क्रिप्सन सफल!';
}

// Freehand writing functions
function setupCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // Touch events for mobile
    canvas.addEventListener('touchstart', handleTouch);
    canvas.addEventListener('touchmove', handleTouch);
    canvas.addEventListener('touchend', stopDrawing);

    function startDrawing(e) {
        isDrawing = true;
        [lastX, lastY] = getMousePos(canvas, e);
    }

    function draw(e) {
        if (!isDrawing) return;

        const [currentX, currentY] = getMousePos(canvas, e);

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(currentX, currentY);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();

        [lastX, lastY] = [currentX, currentY];
    }

    function stopDrawing() {
        isDrawing = false;
    }

    function handleTouch(e) {
        e.preventDefault();
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent(e.type === 'touchstart' ? 'mousedown' :
            e.type === 'touchmove' ? 'mousemove' : 'mouseup', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        canvas.dispatchEvent(mouseEvent);
    }

    function getMousePos(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        return [
            (e.clientX - rect.left) * (canvas.width / rect.width),
            (e.clientY - rect.top) * (canvas.height / rect.height)
        ];
    }
}

function clearCanvas() {
    const canvas = document.getElementById('drawingCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

async function recognizeHandwriting() {
    const canvas = document.getElementById('drawingCanvas');
    if (!canvas) {
        showError('क्यानभास फेला परेन।');
        return;
    }
    
    // Check if canvas has content
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasContent = imageData.data.some((pixel, i) => i % 4 !== 3 && pixel !== 0);
    
    if (!hasContent) {
        showError('कृपया पहिले केही लेख्नुहोस्।');
        return;
    }

    showLoading();
    
    try {
        // Convert canvas to base64 image
        const imageData64 = canvas.toDataURL('image/png');
        
        // Send to backend for recognition
        const response = await fetch(`${API_BASE}/recognize-handwriting`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: imageData64 })
        });

        const result = await response.json();

        if (response.ok && result.text) {
            displayRecognizedText(result.text);
            fillFormFromTranscription(result.text);
        } else {
            throw new Error(result.detail || 'Recognition failed');
        }
    } catch (error) {
        console.error('Error recognizing handwriting:', error);
        // Fallback: show form for manual entry
        showError('हस्तलेख पहिचान गर्न सकेन। कृपया म्यानुअल रूपमा टाइप गर्नुहोस्।');
        
        var freehandEl = document.getElementById('freehandInterface');
        var textFormEl = document.getElementById('textForm');
        if (freehandEl) freehandEl.classList.add('hidden');
        if (textFormEl) textFormEl.classList.remove('hidden');
    } finally {
        hideLoading();
    }
}

function displayRecognizedText(text) {
    // Show the recognized text and switch to form view
    var freehandEl = document.getElementById('freehandInterface');
    var textFormEl = document.getElementById('textForm');
    
    if (freehandEl) freehandEl.classList.add('hidden');
    if (textFormEl) textFormEl.classList.remove('hidden');
    
    showSuccess('पहिचानिएको पाठ: ' + text);
}

// Form handling
function handleFormSubmit(e) {
    e.preventDefault();

    // Collect form data
    const form = e.target;
    const formData = new FormData(form);
    const data = {};

    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }

    // Validate required fields
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            field.classList.add('border-red-500');
            isValid = false;
        } else {
            field.classList.remove('border-red-500');
        }
    });

    if (!isValid) {
        showError('कृपया सबै आवश्यक फिल्डहरू भर्नुहोस्।');
        return;
    }

    // Store form data
    window.formData = data;

    // Show preview
    showDocumentPreview(data);
    goToStep(4);
}

// Transliteration
async function handleTransliteration(e) {
    const text = e.target.value;
    if (!text || !document.getElementById('languageToggle').checked) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/transliterate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: text,
                from_lang: 'en',
                to_lang: 'ne'
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Find corresponding Nepali field and fill it
            const nepaliFieldId = e.target.id.replace('_en', '');
            const nepaliField = document.getElementById(nepaliFieldId);
            if (nepaliField && !nepaliField.value) {
                nepaliField.value = result.transliterated_text;
            }
        }
    } catch (error) {
        console.error('Transliteration error:', error);
    }
}

// Document generation
async function generatePDF() {
    showLoading();

    try {
        const response = await fetch(`${API_BASE}/generate-document`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                document_type: selectedDocument,
                user_data: window.formData,
                language: 'ne'
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Show download button
            document.getElementById('downloadBtn').classList.remove('hidden');
            document.getElementById('downloadBtn').onclick = () => downloadPDF(result.pdf_path);

            // Show preview
            showDocumentPreview(result.content);

            showSuccess('PDF सफलतापूर्वक उत्पन्न भयो!');
        } else {
            throw new Error(result.detail || 'PDF generation failed');
        }
    } catch (error) {
        console.error('Error generating PDF:', error);
        showError('PDF उत्पन्न गर्न सकेन।');
    } finally {
        hideLoading();
    }
}

function downloadPDF(pdfPath) {
    // Get filename from path (handles both / and \)
    const filename = pdfPath.replace(/^.*[/\\]/, '');
    const link = document.createElement('a');
    link.href = `${API_BASE}/download-document/${filename}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showDocumentPreview(content) {
    const previewDiv = document.getElementById('documentPreview');
    
    // If content is an object (form data before generation), format it nicely
    if (typeof content === 'object' && content !== null) {
        let html = '<div class="bg-gray-50 p-6 rounded-lg"><h3 class="text-lg font-semibold mb-4">\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c \u092a\u0942\u0930\u094d\u0935\u093e\u0935\u0932\u094b\u0915\u0928</h3><div class="bg-white p-4 rounded border">';
        html += '<table class="w-full text-sm">';
        for (const [key, value] of Object.entries(content)) {
            if (value) {
                html += `<tr class="border-b"><td class="py-2 pr-4 font-medium text-gray-600">${key}</td><td class="py-2">${value}</td></tr>`;
            }
        }
        html += '</table></div></div>';
        previewDiv.innerHTML = html;
    } else {
        // Content is text (from server response)
        const sanitized = String(content || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        previewDiv.innerHTML = `
            <div class="bg-gray-50 p-6 rounded-lg">
                <h3 class="text-lg font-semibold mb-4">\u0926\u0938\u094d\u0924\u093e\u0935\u0947\u091c \u092a\u0942\u0930\u094d\u0935\u093e\u0935\u0932\u094b\u0915\u0928</h3>
                <div class="bg-white p-4 rounded border" style="font-family: 'Poppins', sans-serif; line-height: 1.8;">
                    <pre class="whitespace-pre-wrap text-sm">${sanitized}</pre>
                </div>
            </div>
        `;
    }
}

// Utility functions
function showLoading() {
    var el = document.getElementById('loadingOverlay');
    if (el) el.classList.remove('hidden');
}

function hideLoading() {
    var el = document.getElementById('loadingOverlay');
    if (el) el.classList.add('hidden');
}

function showError(message) {
    alert(message); // In production, use a better notification system
}

function showSuccess(message) {
    alert(message); // In production, use a better notification system
}

// Feedback system
function rateService(rating) {
    const stars = document.querySelectorAll('.fa-star');
    stars.forEach((star, index) => {
        if (index < rating) {
            star.classList.remove('text-gray-300');
            star.classList.add('text-yellow-400');
        } else {
            star.classList.remove('text-yellow-400');
            star.classList.add('text-gray-300');
        }
    });
}

function submitFeedback() {
    const feedbackText = document.getElementById('feedbackText').value;
    const rating = document.querySelectorAll('.fa-star.text-yellow-400').length;

    // In production, send this to your backend
    console.log('Feedback submitted:', { rating, feedback: feedbackText });

    showSuccess('तपाईंको प्रतिक्रियाको लागि धन्यवाद!');

    // Clear feedback form
    document.getElementById('feedbackText').value = '';
    rateService(0);
}

// Start new document
function startNew() {
    selectedDocument = null;
    selectedInputMethod = null;
    formData = {};

    var form = document.getElementById('documentForm');
    if (form) form.reset();

    var downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) downloadBtn.classList.add('hidden');

    goToStep(1);
}

// Fill form from transcription (basic implementation)
function fillFormFromTranscription(text) {
    // This is a very basic implementation
    // In production, you would use NLP to extract specific information

    var voiceEl = document.getElementById('voiceInterface');
    var textFormEl = document.getElementById('textForm');
    if (voiceEl) voiceEl.classList.add('hidden');
    if (textFormEl) textFormEl.classList.remove('hidden');

    // Try to auto-fill some fields based on keywords
    const lowerText = text.toLowerCase();

    // Example: Look for names (very basic pattern matching)
    const namePattern = /नाम[:\s]+([^\n]+)/i;
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
        const nameField = document.querySelector('[id*="name"]');
        if (nameField) {
            nameField.value = nameMatch[1].trim();
        }
    }

    var transcriptionResult = document.getElementById('transcriptionResult');
    if (!transcriptionResult) return;
    transcriptionResult.innerHTML = `
        <div class="mb-4">
            <strong>पहिचानिएको पाठ:</strong>
            <p class="mt-2">${text}</p>
        </div>
        <div class="text-sm text-gray-600">
            कृपया माथिको जानकारीअनुसार फारम भर्नुहोस् वा सच्याउनुहोस्।
        </div>
    `;
    transcriptionResult.classList.remove('hidden');
}

// Language toggle handler
function handleLanguageToggle(e) {
    const isChecked = e.target.checked;
    if (isChecked) {
        console.log('English to Nepali translation enabled');
    } else {
        console.log('English to Nepali translation disabled');
    }
}

// Expose all handlers used by HTML onclick so they work in every environment
window.selectDocument = selectDocument;
window.selectInputMethod = selectInputMethod;
window.toggleRecording = toggleRecording;
window.clearCanvas = clearCanvas;
window.recognizeHandwriting = recognizeHandwriting;
window.generatePDF = generatePDF;
window.downloadPDF = downloadPDF;
window.startNew = startNew;
window.rateService = rateService;
window.submitFeedback = submitFeedback;
