// Global variables
let currentStep = 1;
let selectedDocument = null;
let selectedInputMethod = null;
let formData = {};
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// API base URL: use same origin when served by backend; fallback for file:// or when origin is invalid
function getApiBase() {
    const o = window.location.origin;
    if (o && (o.startsWith('http://') || o.startsWith('https://'))) return o;
    return 'http://localhost:8000';
}
const API_BASE = getApiBase();

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
    loadInitialData();
    setupEventListeners();
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

        const template = await response.json();
        console.log('Template loaded:', template);

        if (template.form_fields && Array.isArray(template.form_fields)) {
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
let locationData = null;

// Load document types and location data
async function loadInitialData() {
    await Promise.all([loadDocumentTypes(), loadLocationData()]);
}

// Load location data from API
async function loadLocationData() {
    try {
        const response = await fetch(`${API_BASE}/locations`);
        const data = await response.json();
        locationData = data;
        console.log('Location data loaded:', data);
    } catch (error) {
        console.error('Error loading location data:', error);
    }
}

// Generate form fields dynamically
function generateFormFields(fields) {
    const formFieldsContainer = document.getElementById('formFields');
    formFieldsContainer.innerHTML = '';

    // Check if we have address fields to group
    const addressFields = fields.filter(f => f.id.includes('address') || f.id.includes('province') || f.id.includes('district') || f.id.includes('municipality') || f.id.includes('ward'));
    const otherFields = fields.filter(f => !addressFields.includes(f));

    // Render other fields first
    otherFields.forEach(field => createFieldElement(field, formFieldsContainer));

    // Render address fields (custom logic for permanent/temporary)
    // Render address fields (custom logic for permanent/temporary)
    if (addressFields.length > 0) {
        // Group by type if possible, or just render
        addressFields.forEach(field => createFieldElement(field, formFieldsContainer));

        // Add "Same as Permanent" button if we have both sets of addresses
        const hasPermanent = addressFields.some(f => f.id.includes('permanent') || f.id.includes('old'));
        const hasTemporary = addressFields.some(f => f.id.includes('temporary') || f.id.includes('new'));

        if (hasPermanent && hasTemporary) {
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'mt-2 mb-4 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition text-sm';
            copyBtn.innerHTML = '<i class="fas fa-copy mr-2"></i>स्थायी ठेगाना नै राख्नुहोस्';
            copyBtn.onclick = copyPermanentToTemporary;
            formFieldsContainer.insertBefore(copyBtn, formFieldsContainer.lastElementChild); // Insert before last field or appropriately
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

        // Special handling for Province
        if (field.id.includes('province') && locationData && locationData.country && locationData.country.provinces) {
            locationData.country.provinces.forEach(p => {
                const option = document.createElement('option');
                option.value = p.province_name;
                option.textContent = p.province_name;
                option.dataset.id = p.province_id;
                input.appendChild(option);
            });

            // Add change listener to populate district
            input.addEventListener('change', (e) => handleProvinceChange(e, field.id));
        }
        // Special handling for District (initially empty or static options if provided)
        else if (field.id.includes('district')) {
            // Districts will be populated by province change
            if (field.options) {
                field.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option;
                    input.appendChild(optionElement);
                });
            }
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
    console.log('handleProvinceChange called for:', provinceFieldId);
    const selectedProvinceName = e.target.value;
    console.log('Selected Province:', selectedProvinceName);

    const districtFieldId = provinceFieldId.replace('province', 'district');
    console.log('Derived District Field ID:', districtFieldId);

    const districtSelect = document.getElementById(districtFieldId);
    console.log('District Select Element found:', !!districtSelect);

    if (!districtSelect) {
        console.error('District select element not found with ID:', districtFieldId);
        return;
    }

    if (!locationData) {
        console.error('Location data is missing!');
        return;
    }

    // Clear current options
    districtSelect.innerHTML = '<option value="">छनोट गर्नुहोस्</option>';

    const province = locationData.country.provinces.find(p => p.province_name === selectedProvinceName);
    console.log('Found Province Data:', province);

    if (province && province.districts) {
        province.districts.forEach(d => {
            const option = document.createElement('option');
            option.value = d.district_name;
            option.textContent = d.district_name;
            districtSelect.appendChild(option);
        });
        console.log(`Populated ${province.districts.length} districts.`);
    } else {
        console.warn('Province not found or has no districts in locationData');
    }
}

// Input method selection
function selectInputMethod(method) {
    selectedInputMethod = method;

    // Hide all interfaces
    document.getElementById('voiceInterface').classList.add('hidden');
    document.getElementById('freehandInterface').classList.add('hidden');
    document.getElementById('textForm').classList.add('hidden');

    // Show selected interface
    if (method === 'voice') {
        document.getElementById('voiceInterface').classList.remove('hidden');
    } else if (method === 'freehand') {
        document.getElementById('freehandInterface').classList.remove('hidden');
    } else {
        document.getElementById('textForm').classList.remove('hidden');
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
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = handleRecordingStop;

        mediaRecorder.start();
        isRecording = true;

        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        recordBtn.innerHTML = '<i class="fas fa-stop mr-2"></i>रेकर्डिङ बन्द गर्नुहोस्';
        recordBtn.classList.add('voice-recording');

        document.getElementById('recordingStatus').textContent = 'रेकर्डिङ भइरहेको छ...';

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

        // Update UI
        const recordBtn = document.getElementById('recordBtn');
        recordBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>रेकर्डिङ सुरु गर्नुहोस्';
        recordBtn.classList.remove('voice-recording');

        document.getElementById('recordingStatus').textContent = 'रेकर्डिङ पूरा भयो। प्रक्रिया गरिँदैछ...';
    }
}

async function handleRecordingStop() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });

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
    const resultDiv = document.getElementById('transcriptionResult');
    resultDiv.textContent = `पहिचानिएको पाठ: ${text}`;
    resultDiv.classList.remove('hidden');

    document.getElementById('recordingStatus').textContent = 'ट्रान्स्क्रिप्सन सफल!';
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

function recognizeHandwriting() {
    // This is a placeholder for handwriting recognition
    // In production, you would integrate with a handwriting recognition API
    const recognizedText = "हस्ताक्षर पहिचान गरिएको पाठ (डेमो)";
    fillFormFromTranscription(recognizedText);
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
    previewDiv.innerHTML = `
        <div class="bg-gray-50 p-6 rounded-lg">
            <h3 class="text-lg font-semibold mb-4">दस्तावेज पूर्वावलोकन</h3>
            <div class="bg-white p-4 rounded border">
                <pre class="whitespace-pre-wrap text-sm">${content}</pre>
            </div>
        </div>
    `;
}

// Utility functions
function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
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
    // Reset all variables
    selectedDocument = null;
    selectedInputMethod = null;
    formData = {};

    // Reset form
    document.getElementById('documentForm').reset();

    // Hide download button
    document.getElementById('downloadBtn').classList.add('hidden');

    // Go to first step
    goToStep(1);
}

// Fill form from transcription (basic implementation)
function fillFormFromTranscription(text) {
    // This is a very basic implementation
    // In production, you would use NLP to extract specific information

    // Show text form for manual editing
    document.getElementById('voiceInterface').classList.add('hidden');
    document.getElementById('textForm').classList.remove('hidden');

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

    // Show the transcribed text for reference
    const transcriptionResult = document.getElementById('transcriptionResult');
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
