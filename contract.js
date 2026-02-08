// --- SCHOOL SETTINGS ---
const SCHOOL_WHATSAPP = '966590000000';
const SCHOOL_STAMP_IMG = 'assets/stamp.png';
const SCHOOL_LOGO = 'assets/logo.png';
// -----------------------
const urlParams = new URLSearchParams(window.location.search);
const compressedData = urlParams.get('c');
const studentIdFromUrl = urlParams.get('id');

// Global State
let uploadedFile = null;
let signatureData = null;
let hasDrawn = false;
let studentIdToSave = null;
let currentStudent = null;
let isZoomed = false;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Global cache for fonts to speed up generation
let cachedCairoFont = null;

// Pre-fetch font immediately
// Pre-fetch font immediately with hyper-resilience
(async function prefetchFont() {
    if (cachedCairoFont && cachedCairoFont.byteLength > 500000) return;

    // STRATEGY A: Try CloudDB (Firebase) first - Most reliable for parents
    if (typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
        try {
            const cloudBase64 = await CloudDB.getFont('Cairo-Regular');
            if (cloudBase64) {
                const binary = atob(cloudBase64);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                if (bytes.byteLength > 500000) {
                    cachedCairoFont = bytes.buffer;
                    console.log("✅ Arabic Font Pre-fetched (Cloud)");
                    return;
                }
            }
        } catch (e) { }
    }

    // STRATEGY B: Try Local and External sources
    const sources = [
        'Cairo-Regular.ttf',
        'https://github.com/googlefonts/cairo/raw/master/fonts/ttf/Cairo-Regular.ttf',
        'https://fonts.gstatic.com/s/cairo/v28/SLXGc1nY6HkvangtZmpcMw.ttf',
        'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo-Regular.ttf'
    ];
    for (const url of sources) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const buf = await res.arrayBuffer();
                if (buf.byteLength > 500000) {
                    cachedCairoFont = buf;
                    console.log("✅ Arabic Font Pre-fetched (" + url + ")");
                    break;
                }
            }
        } catch (e) { }
    }

    // STRATEGY C: Try Embedded Font (font-data.js) - Ultimate Backup
    if (!cachedCairoFont && typeof GLOBAL_CAIRO_FONT !== 'undefined') {
        try {
            console.log("💎 Pre-fetching Font from Embedded Backup...");
            const binary = atob(GLOBAL_CAIRO_FONT);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            if (bytes.byteLength > 100000) {
                cachedCairoFont = bytes.buffer;
                console.log("✅ Arabic Font Pre-fetched (Embedded)");
                return;
            }
        } catch (e) { }
    }
})();

// Dependency Check
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

(async function checkDependencies() {
    if (typeof LZString === 'undefined') {
        try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/lz-string/1.4.4/lz-string.min.js'); } catch (e) { }
    }
    if (typeof html2pdf === 'undefined') {
        try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'); } catch (e) { }
    }
    if (typeof ArabicReshaper === 'undefined') {
        try { await loadScript('https://cdn.jsdelivr.net/npm/arabic-reshaper@2.1.0/dist/arabic-reshaper.min.js'); } catch (e) { }
    }
})();

// THEME
const themeToggle = document.getElementById('themeToggle');
let isDarkMode = localStorage.getItem('darkMode') === 'true';

function updateTheme() {
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        document.body.style.setProperty('--text-dark', '#f1f5f9');
        document.body.style.setProperty('--bg-light', '#1e293b');
        document.body.style.setProperty('--white', '#0f172a');
        document.body.style.setProperty('--border-color', '#334155');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        document.body.style.setProperty('--text-dark', '#1e293b');
        document.body.style.setProperty('--bg-light', '#f8fafc');
        document.body.style.setProperty('--white', '#ffffff');
        document.body.style.setProperty('--border-color', '#e2e8f0');
        if (themeToggle) themeToggle.textContent = '🌙';
    }
}
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        localStorage.setItem('darkMode', isDarkMode);
        updateTheme();
    });
}
updateTheme();

function updateProgress() {
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const stepLineProgress = document.getElementById('stepLineProgress');
    if (!step1) return;

    [step1, step2, step3].forEach(step => step.classList.remove('active', 'completed'));

    let completedSteps = 1;
    step1.classList.add('completed');

    if (uploadedFile) {
        step2.classList.add('completed');
        completedSteps++;
    } else {
        step2.classList.add('active');
    }

    if (uploadedFile && hasDrawn && (document.getElementById('agreeTerms')?.checked)) {
        step3.classList.add('completed');
        completedSteps++;
    } else if (uploadedFile) {
        step3.classList.add('active');
    }

    if (stepLineProgress) stepLineProgress.style.width = `${(completedSteps / 3) * 100}%`;
}

// ===================================================
// LOAD STUDENT DATA
// ===================================================
async function loadStudentData() {
    let student = null;
    let contract = null;

    try {
        const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        if (settings.schoolPhone) window.SCHOOL_WHATSAPP = settings.schoolPhone;
        if (settings.schoolStampText) window.SCHOOL_STAMP_TEXT = settings.schoolStampText;
    } catch (e) { }

    if (compressedData) {
        try {
            let json = LZString.decompressFromEncodedURIComponent(compressedData);
            if (!json) json = decodeURIComponent(compressedData);
            if (json) {
                const data = JSON.parse(json);
                student = {
                    id: data.i, studentName: data.s, studentLevel: data.l, studentGrade: data.g,
                    parentName: data.p, parentEmail: data.e, parentWhatsapp: data.w, contractYear: data.y,
                    contractTemplateId: data.tid || '',
                    contractStatus: 'pending' // Default to pending for URL loaded students
                };
                studentIdToSave = data.i;
                if (data.t && data.c) contract = { title: data.t, content: data.c };
            }
        } catch (e) { }
    }

    const finalId = studentIdFromUrl || (student ? student.id : null);

    // CRITICAL: Always check Firebase FIRST to see if contract was already signed
    // This prevents re-signing even if someone shares the original link
    let firebaseStudent = null;
    if (finalId && finalId !== 'null' && finalId !== 'undefined' && typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
        firebaseStudent = await CloudDB.getStudent(String(finalId));

        if (firebaseStudent) {
            // Check if already signed in Firebase (THE AUTHORITATIVE SOURCE)
            const isAlreadySigned = (firebaseStudent.contractStatus === 'signed' || firebaseStudent.contractStatus === 'verified');
            const hasRealSignature = (firebaseStudent.signature && firebaseStudent.signature.length > 500);

            if (isAlreadySigned && hasRealSignature) {
                console.log('🔒 Contract already signed (Firebase check) - blocking re-signature');
                // Use Firebase data for display
                student = { ...student, ...firebaseStudent };
                currentStudent = student;
                studentIdToSave = firebaseStudent.id;
                showAlreadySignedSimplified(student);
                return student;
            }

            // If not signed, merge non-critical data but keep URL contract content
            if (student) {
                student = {
                    ...student,
                    // Keep critical data from Firebase
                    contractStatus: firebaseStudent.contractStatus || student.contractStatus,
                    contractNo: firebaseStudent.contractNo || student.contractNo,
                    customFields: { ...(student.customFields || {}), ...(firebaseStudent.customFields || {}) },
                    idImage: firebaseStudent.idImage || student.idImage,
                    signature: firebaseStudent.signature || student.signature
                };
            } else {
                student = firebaseStudent;
            }
            studentIdToSave = finalId;
        }
    }

    if (student) {
        currentStudent = student;
        document.getElementById('contractStudentName').textContent = student.studentName;
        document.getElementById('contractGrade').textContent = `الصف ${student.studentGrade}`;
        document.getElementById('contractYear').textContent = student.contractYear;
        document.getElementById('contractParentName').textContent = student.parentName;

        // Populate Contract Text BEFORE checking status (Critical for PDF generation)
        if (!contract) {
            if (student.contractTitle && student.contractContent) {
                contract = {
                    title: student.contractTitle,
                    content: student.contractContent,
                    type: student.contractType || 'text'
                };
            } else {
                // Try Local Storage First
                const templates = JSON.parse(localStorage.getItem('contractTemplates') || '[]');
                // FIX: Prioritize exact ID match, then default
                contract = templates.find(c => c.id === student.contractTemplateId);
                if (!contract) contract = templates.find(c => c.isDefault);

                // If not found locally, try Cloud (Essential for Parents)
                if (!contract && student.contractTemplateId && typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
                    try {
                        console.log('☁️ Fetching contract template from cloud:', student.contractTemplateId);
                        contract = await CloudDB.getContractTemplate(student.contractTemplateId);

                        // Update cache with the latest version from cloud
                        if (contract) {
                            const localTemplates = JSON.parse(localStorage.getItem('contractTemplates') || '[]');
                            const idx = localTemplates.findIndex(t => t.id === contract.id);
                            if (idx !== -1) {
                                localTemplates[idx] = contract;
                            } else {
                                localTemplates.push(contract);
                            }
                            localStorage.setItem('contractTemplates', JSON.stringify(localTemplates));
                        }
                    } catch (err) {
                        console.error("Cloud Fetch Error:", err);
                    }
                }

                // Fallback to default local if still null
                if (!contract) {
                    contract = templates.find(c => c.isDefault) || templates[0];
                    if (contract) console.log('🏠 Using local fallback template:', contract.title);
                }
            }
        }

        // Final sanity check for template
        if (!contract && typeof CloudDB !== 'undefined' && CloudDB.isReady() && student.contractTemplateId) {
            console.log('🔄 Retrying template fetch...');
            contract = await CloudDB.getContractTemplate(student.contractTemplateId);
        }
        if (contract) {
            const contractTextDiv = document.querySelector('.contract-text');
            if (contractTextDiv) {
                // Determine if it's a PDF Template
                const isPdf = (contract.type === 'pdf_template') ||
                    (contract.content && contract.content.startsWith('قالب PDF:'));

                if (isPdf && !contract.pdfData) {
                    console.warn("⚠️ PDF template detected but pdfData is missing. Attempting deep fetch...");
                    if (typeof CloudDB !== 'undefined' && CloudDB.isReady() && contract.id) {
                        const full = await CloudDB.getContractTemplate(contract.id);
                        if (full && full.pdfData) contract = full;
                    }
                }

                if (isPdf && contract.pdfData) {
                    // PDF Template Mode
                    contractTextDiv.innerHTML = `
                        <div style="text-align:center; padding: 20px;">
                            <h3 style="color: var(--primary-color);">${contract.title}</h3>
                            <p style="margin-bottom: 20px; font-size: 0.9rem; color: var(--text-muted);">هذا العقد محفوظ بتنسيقه الرسمي (PDF). يتم الآن تجهيز نسختك الخاصة ببياناتك:</p>
                            <div id="pdf-loading-state" style="padding: 40px; background: #f1f5f9; border-radius: 12px; margin-bottom: 20px;">
                                <div class="loading"></div>
                                <p style="margin-top: 15px; color: #4a5568; font-weight: bold;">جاري تحضير العقد ببياناتك... يرجى الانتظار</p>
                            </div>
                            <div id="pdf-preview-container" style="display:none; border: 2px solid var(--border-color); border-radius: 12px; background: #525659; overflow: auto; max-height: 500px; padding: 10px;">
                                <canvas id="pdf-preview-canvas" style="max-width: 100%; height: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.2);"></canvas>
                            </div>
                            <div id="pdf-controls" style="display:none;">
                                <div id="pdf-page-info" style="margin-top: 10px; font-size: 0.8rem; font-weight: bold;"></div>
                                <div style="display: flex; gap: 10px; justify-content: center; margin-top: 10px;">
                                    <button type="button" class="btn btn-secondary btn-sm" onclick="renderPdfPage(currentPdfPage - 1)" id="prevPdfBtn">الصفحة السابقة</button>
                                    <button type="button" class="btn btn-secondary btn-sm" onclick="renderPdfPage(currentPdfPage + 1)" id="nextPdfBtn">الصفحة التالية</button>
                                </div>
                            </div>
                        </div>
                    `;

                    // Store contract for later
                    currentStudent.contract = contract;
                    currentStudent.contractType = 'pdf_template';

                    // Start Loading PDF (Personalized with student data)
                    setTimeout(async () => {
                        try {
                            console.log("Generating personalized PDF preview...");
                            const pdfBytes = await generatePdfFromTemplate(contract, student);
                            if (pdfBytes) {
                                initPdfPreview(pdfBytes);
                            } else {
                                throw new Error("Generated PDF is empty");
                            }
                        } catch (err) {
                            console.error("PDF Preview Generation Error:", err);
                            // Hide loading and show error message
                            const loadingEl = document.getElementById('pdf-loading-state');
                            if (loadingEl) {
                                loadingEl.innerHTML = `
                                    <p style="color: #e53e3e; font-weight: bold;">⚠️ عذراً، حدث خطأ أثناء تحضير العقد.</p>
                                    <p style="font-size: 0.8rem; margin-top: 10px; color: #718096;">التفاصيل: ${err.message || 'خطأ غير معروف'}</p>
                                    <p style="font-size: 0.8rem; border-top: 1px solid #ddd; margin-top: 10px; padding-top: 10px;">يرجى تصوير الشاشة وإرسالها للإدارة.</p>
                                    <button class="btn btn-secondary btn-sm" onclick="location.reload()" style="margin-top:20px;">تحديث الصفحة</button>
                                `;
                            }
                        }
                    }, 100);
                } else {
                    // Normal Text Mode
                    let content = contract.content;
                    // Dynamic Placeholder Replacement
                    const replacements = {
                        '{اسم_الطالب}': student.studentName || '',
                        '{اسم_ولي_الامر}': student.parentName || '',
                        '{المسار}': student.customFields?.studentTrack || student.studentTrack || '',
                        '{الصف}': student.studentGrade ? `الصف ${student.studentGrade}` : '',
                        '{المرحلة_الدراسية}': student.studentLevel || '',
                        '{السنة_الدراسية}': student.contractYear || '',
                        '{البريد_الالكتروني}': student.parentEmail || '',
                        '{رقم_الواتساب}': student.parentWhatsapp || '',
                        '{التاريخ}': new Date().toLocaleString('ar-SA')
                    };

                    // Add Custom Fields
                    if (student.customFields) {
                        try {
                            const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                            (settings.customFields || []).forEach(def => {
                                replacements[`{${def.label}}`] = student.customFields[def.id] || '';
                            });
                        } catch (e) { }
                    }

                    Object.entries(replacements).forEach(([key, val]) => {
                        content = content.replace(new RegExp(key, 'g'), val);
                    });

                    const stampText = window.SCHOOL_STAMP_TEXT || 'الإدارة';
                    const stampHtml = `<div class="school-stamp" style="width:100px; height:100px; border:4px double #2563eb; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; color:#2563eb; font-weight:900; transform:rotate(-15deg); background:rgba(37,99,235,0.03); margin:20px auto;"><div style="position:absolute; width:90%; height:90%; border:1px solid #2563eb; border-radius:50%;"></div><div style="font-size:11px; text-align:center; max-width:80%; line-height:1.2;">${stampText}</div></div>`;

                    currentStudent.cachedContractContent = content;
                    currentStudent.cachedContractTitle = contract.title;
                    currentStudent.contractType = 'text';

                    contractTextDiv.innerHTML = `<h3 style="font-size: 1.15rem; margin-bottom: 0.5rem;">${contract.title}</h3><div style="font-size: 0.92rem; line-height: 1.6;">${content.replace(/\n/g, '<br>')}</div><br>${stampHtml}`;
                }
            }
        } else {
            // Error Handling: If no contract could be loaded
            const textDiv = document.querySelector('.contract-text');
            if (textDiv) {
                textDiv.innerHTML = `
                    <div style="padding:40px; text-align:center;">
                        <div style="font-size:3rem; margin-bottom:15px;">⚠️</div>
                        <h3 style="color:#e53e3e;">عذراً، لم نتمكن من العثور على محتوى العقد</h3>
                        <p style="color:#718096; margin-top:10px;">يبدو أن هناك مشكلة في رابط العقد أو أن القالب قد تم حذفه من النظام.</p>
                        <button class="btn btn-secondary btn-sm" onclick="location.reload()" style="margin-top:20px;">تحديث الصفحة</button>
                    </div>
                `;
            }
        }

        // If status is pending/sent, definitely let them sign
        if (student.contractStatus === 'pending' || student.contractStatus === 'sent') {
            console.log('✅ Status is pending/sent, allowing signature');
        }
        return student;
    }
    showLoadError();
    return null;
}

function showAlreadySignedSimplified(student) {
    document.getElementById('mainContainer').style.display = 'none';
    const successContainer = document.getElementById('successContainer');
    successContainer.style.display = 'block';

    const card = successContainer.querySelector('.success-card');
    if (card) {
        card.innerHTML = `
            <div class="success-icon" style="background: var(--success-gradient);">📝</div>
            <h2 class="success-title">تم توقيع العقد مسبقاً</h2>
            <p class="success-subtitle" style="margin-bottom: 2rem;">تم توقيع هذا العقد وإرساله بنجاح مسبقاً.</p>
            
            <div style="background: var(--bg-light); border: 2px solid var(--border-color); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; text-align: right;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span style="color:var(--text-muted); font-weight:600;">رقم العقد:</span><span style="font-weight:800; color:var(--text-dark);">${student.contractNo || '---'}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted); font-weight:600;">تاريخ التوقيع:</span><span style="font-weight:800; color:var(--text-dark); direction:ltr;">${student.signedAt ? new Date(student.signedAt).toLocaleString('ar-SA') : '---'}</span></div>
            </div>

            <div class="success-actions">
                <button id="downloadPdfBtn" class="btn btn-primary btn-large" style="width:100%">📥 تحميل العقد المكتمل (PDF)</button>
                <button class="btn btn-secondary" onclick="printContract()" style="width:100%; margin-top:1rem;">🖨️ طباعة العقد</button>
            </div>
        `;
    }

    if (student.signature) signatureData = student.signature;
    if (student.idImage) uploadedFile = student.idImage;
    currentStudent = student;

    setupPdfDownload(student.studentName, student.contractNo || 'CON-DONE');
}

// NEW: Success message for FRESH signatures (first-time signing)
function showSuccessAfterSigning(student) {
    document.getElementById('mainContainer').style.display = 'none';
    const successContainer = document.getElementById('successContainer');
    successContainer.style.display = 'block';

    const card = successContainer.querySelector('.success-card');
    if (card) {
        card.innerHTML = `
            <div class="success-icon" style="background: var(--success-gradient);">✓</div>
            <h2 class="success-title">تم التوقيع بنجاح! 🎉</h2>
            <p class="success-subtitle" style="margin-bottom: 2rem;">شكراً لك! تم توقيع العقد وإرساله بنجاح.</p>
            
            <div style="background: var(--bg-light); border: 2px solid var(--border-color); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; text-align: right;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><span style="color:var(--text-muted); font-weight:600;">رقم العقد:</span><span style="font-weight:800; color:var(--text-dark);">${student.contractNo || '---'}</span></div>
                <div style="display:flex; justify-content:space-between;"><span style="color:var(--text-muted); font-weight:600;">تاريخ التوقيع:</span><span style="font-weight:800; color:var(--text-dark); direction:ltr;">${student.signedAt ? new Date(student.signedAt).toLocaleString('ar-SA') : '---'}</span></div>
            </div>

            <div class="success-actions">
                <button id="downloadPdfBtn" class="btn btn-primary btn-large" style="width:100%">📥 تحميل العقد المكتمل (PDF)</button>
                <button class="btn btn-secondary" onclick="printContract()" style="width:100%; margin-top:1rem;">🖨️ طباعة العقد</button>
            </div>
        `;
    }

    if (student.signature) signatureData = student.signature;
    if (student.idImage) uploadedFile = student.idImage;
    currentStudent = student;

    setupPdfDownload(student.studentName, student.contractNo || 'CON-DONE');
}

// Helper to get professional PDF/Print HTML
function getContractPdfHtml(studentName, contractNo) {
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const stampText = window.SCHOOL_STAMP_TEXT || settings.schoolStampText || 'الإدارة';
    const schoolLogo = settings.schoolLogo || 'assets/logo.png';
    const schoolPhone = settings.schoolPhone || '---';
    const contractTitle = currentStudent?.contractTitle || 'عقد تسجيل طالب';

    const stampHtml = `<div style="width:100px; height:100px; border:3px solid #2563eb; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; color:#2563eb; font-weight:900; transform:rotate(-15deg); background:rgba(37,99,235,0.03); margin:0 auto;"><div style="position:absolute; width:90%; height:90%; border:1px solid #2563eb; border-radius:50%;"></div><div style="font-size:11px; text-align:center; max-width:80%; line-height:1.2;">${stampText}</div></div>`;

    let safeContractText = currentStudent?.cachedContractContent || document.querySelector('.contract-text')?.innerHTML || 'نص العقد غير متوفر حالياً';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = safeContractText;
    tempDiv.querySelectorAll('.school-stamp').forEach(el => el.remove());
    tempDiv.querySelectorAll('h3').forEach(el => el.remove());
    safeContractText = tempDiv.innerHTML.replace(/\n/g, '<br>');

    const idCardSection = uploadedFile ? `
        <div style="margin-top:25px; border-top:1px dashed #ccc; padding-top:20px; text-align:center; page-break-inside:avoid;">
            <p style="margin:0 0 10px; font-weight:bold;">صورة هوية ولي الأمر</p>
            <img src="${uploadedFile}" style="max-height:250px; max-width:90%; border:1px solid #ddd; padding:5px; border-radius:4px;">
        </div>` : '';

    return `
        <div style="direction:rtl; font-family:'Cairo', sans-serif; background:white; padding:5mm 10mm; width:100%; box-sizing:border-box; color:#1a202c;">
            <div style="background:white; position:relative;">
                <table style="width:100%; border-bottom:2px solid #1e3a8a; margin-bottom:30px; padding-bottom:15px;">
                        <tr>
                        <td style="text-align:right; width:33%;">
                            <p style="font-weight:bold; margin:0; font-size:16px;">${settings.schoolName || 'مدارس دانة العلوم'}</p>
                            <p style="font-size:12px; margin:5px 0 0;">جوال: ${schoolPhone}</p>
                        </td>
                        <td style="text-align:center; width:34%;"><img src="${schoolLogo}" style="height:80px; width:auto;"></td>
                        <td style="text-align:left; width:33%;">
                            <p style="font-weight:bold; color:#1e3a8a; font-size:20px; margin:0;">${contractTitle}</p>
                            <p style="font-family:monospace; font-size:14px; margin:5px 0 0; color:#718096;">${contractNo}</p>
                        </td>
                    </tr>
                </table>
                <div style="font-size:14px; line-height:1.8; margin-bottom:30px; text-align:justify;">${safeContractText}</div>
                
                <div style="page-break-inside: avoid; border: 1px solid #edf2f7; border-radius: 12px; padding: 15px; background: #fff;">
                    <table style="width:100%;">
                        <tr>
                            <td style="text-align:center; width:50%; vertical-align:bottom;">
                                <p style="font-weight:bold; margin-bottom:10px; color:#2d3748; font-size:13px;">الختم والاعتماد</p>
                                ${stampHtml}
                            </td>
                            <td style="text-align:center; width:50%; vertical-align:bottom;">
                                <p style="font-weight:bold; margin-bottom:10px; color:#2d3748; font-size:13px;">توقيع ولي الأمر</p>
                                ${signatureData ? `<img src="${signatureData}" style="max-height:80px; max-width:200px;">` : '<div style="height:80px; display:flex; align-items:center; justify-content:center; color:#cbd5e0;">................</div>'}
                            </td>
                        </tr>
                    </table>
                    ${uploadedFile ? `
                    <div style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px; text-align:center;">
                        <p style="margin:0 0 5px; font-weight:bold; font-size:12px;">صورة هوية ولي الأمر</p>
                        <img src="${uploadedFile}" style="max-height:180px; max-width:80%; border:1px solid #edf2f7; border-radius:8px;">
                    </div>` : ''}
                </div>
            </div>
        </div>`;
}

function setupPdfDownload(studentName, contractNo) {
    const btn = document.getElementById('downloadPdfBtn');
    if (!btn) return;

    btn.addEventListener('click', async function () {
        this.disabled = true;
        this.innerHTML = '<span class="loading"></span> جاري التحميل...';

        try {
            const isPdf = currentStudent && (
                currentStudent.contractType === 'pdf_template' ||
                (currentStudent.cachedContractContent && currentStudent.cachedContractContent.startsWith('قالب PDF:'))
            );

            if (isPdf) {
                // Generate PDF from Template using pdf-lib
                const pdfBytes = await generatePdfFromTemplate(currentStudent.contract, currentStudent);
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = `عقد_${studentName}.pdf`;
                link.click();
                this.innerHTML = '✓ تم التحميل';
                setTimeout(() => { this.disabled = false; this.innerHTML = '📥 تحميل العقد المكتمل (PDF)'; }, 3000);
            } else {
                // Use html2pdf for normal text contracts
                const pdfHtml = getContractPdfHtml(studentName, contractNo);
                const element = document.createElement('div');
                element.style.position = 'fixed';
                element.style.top = '0';
                element.style.left = '0';
                element.style.width = '100vw';
                element.style.height = '100vh';
                element.style.background = 'white';
                element.style.zIndex = '100000';
                element.style.display = 'block'; // FIX: Changed from flex to block to prevent empty PDF
                element.style.textAlign = 'center';
                element.style.overflowY = 'auto';
                element.style.padding = '40px 0';
                element.style.direction = 'rtl';
                element.innerHTML = `
                    <div style="background:white; border-radius:20px; padding:40px; box-shadow:0 10px 30px rgba(0,0,0,0.1); display:inline-block; max-width:90%; margin: 0 auto;">
                        <div class="loading" style="width:50px; height:50px; border-width:5px; margin-bottom:20px;"></div>
                        <div style="margin-bottom:20px; font-weight:bold; color:#1e3a8a; font-family:Cairo, sans-serif; font-size:16px; text-align:center;">جاري استخراج نسخة العقد (PDF)...<br><span style="font-size:12px; font-weight:normal; color:#718096;">يرجى الانتظار ثانية واحدة</span></div>
                        <div id="pdf-render-target" style="background:white; pointer-events:none; padding: 20px; border:1px solid #eee;">
                            ${pdfHtml}
                        </div>
                    </div>
                `;
                document.body.appendChild(element);
                // ... (existing html2pdf logic)

                const container = element.querySelector('#pdf-render-target');
                const cleanup = () => { if (element.parentNode) element.parentNode.removeChild(element); };

                // Required Delay for Rendering (Increased for bulletproof capture)
                setTimeout(() => {
                    if (!window.html2pdf) {
                        console.error("html2pdf not loaded");
                        this.innerHTML = '❌ خطأ تقني';
                        this.disabled = false;
                        return;
                    }

                    const opt = {
                        margin: [5, 10, 5, 10], // Adjusted margins
                        filename: `عقد_${studentName}.pdf`,
                        image: { type: 'jpeg', quality: 0.98 },
                        html2canvas: {
                            scale: 2,
                            useCORS: true,
                            logging: true,
                            scrollY: 0,
                            width: 794,
                            backgroundColor: '#ffffff'
                        },
                        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
                    };

                    // Inject CSS for PDF rendering
                    const style = document.createElement('style');
                    style.innerHTML = `
                .contract-content p { margin-bottom: 10px; line-height: 1.6; }
                .contract-content h1, .contract-content h2, .contract-content h3 { margin-top: 15px; margin-bottom: 10px; page-break-after: avoid; }
                table { page-break-inside: avoid; }
                img { max-width: 100%; page-break-inside: avoid; }
            `;
                    container.appendChild(style);

                    html2pdf().from(container).set(opt).toPdf().get('pdf').then((pdf) => {
                        const totalPages = pdf.internal.getNumberOfPages();
                        for (let i = 1; i <= totalPages; i++) {
                            pdf.setPage(i);
                            pdf.setDrawColor(30, 58, 138); // #1e3a8a

                            // Outer border
                            pdf.setLineWidth(0.5);
                            pdf.rect(5, 5, 200, 287);

                            // Inner border
                            pdf.setLineWidth(1.5);
                            pdf.rect(7, 7, 196, 283);
                        }
                    }).save().then(() => {
                        this.innerHTML = '✓ تم التحميل';
                        setTimeout(cleanup, 1000);
                        setTimeout(() => { this.disabled = false; this.innerHTML = '📥 تحميل العقد المكتمل (PDF)'; }, 3000);
                    });
                }, 3500); // 3.5 seconds delay for absolute certainty
            }
        } catch (err) {
            console.error("PDF Download Error:", err);
            this.disabled = false;
            this.innerHTML = '❌ خطأ في التحميل';
        }
    });
}

function printContract() {
    const studentName = currentStudent?.studentName || 'Contract';
    const contractNo = currentStudent?.contractNo || 'CON-DONE';
    const printHtml = getContractPdfHtml(studentName, contractNo);

    const win = window.open('', '_blank');
    win.document.write(`
        <html>
            <head>
                <title>طباعة العقد - ${studentName}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { margin: 0; padding: 0; }
                    @media print {
                        body { background: white; }
                    }
                </style>
            </head>
            <body onload="setTimeout(() => { window.print(); window.close(); }, 500);">
                ${printHtml}
            </body>
        </html>
    `);
    win.document.close();
}

function showLoadError() {
    const main = document.getElementById('mainContainer');
    if (main) main.innerHTML = '<div style="text-align:center; padding:5rem 2rem;"><h2>⚠️ الرابط غير صالح أو منتهي</h2></div>';
}

// CANVAS DRAWING (With persistence on resize)
const canvas = document.getElementById('signatureCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

function resizeCanvas() {
    if (!canvas || !ctx) return;
    const temp = document.createElement('canvas'); const tctx = temp.getContext('2d');
    temp.width = canvas.width; temp.height = canvas.height; tctx.drawImage(canvas, 0, 0);
    canvas.width = canvas.parentElement.offsetWidth; canvas.height = 220;
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.drawImage(temp, 0, 0, temp.width, temp.height, 0, 0, canvas.width, canvas.height);
}

function getPos(e) {
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX || (e.touches && e.touches[0].clientX);
    const cy = e.clientY || (e.touches && e.touches[0].clientY);
    return { x: cx - r.left, y: cy - r.top };
}

if (canvas && ctx) {
    canvas.addEventListener('mousedown', (e) => { isDrawing = true; const p = getPos(e);[lastX, lastY] = [p.x, p.y]; });
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return; if (e.touches) e.preventDefault();
        const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();[lastX, lastY] = [p.x, p.y];
        if (!hasDrawn) { hasDrawn = true; canvas.classList.add('has-signature'); updateProgress(); validateForm(); }
    });
    window.addEventListener('mouseup', () => { if (isDrawing) { isDrawing = false; validateForm(); } });
    canvas.addEventListener('touchstart', (e) => { isDrawing = true; const p = getPos(e);[lastX, lastY] = [p.x, p.y]; }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { if (!isDrawing) return; e.preventDefault(); const p = getPos(e); ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(p.x, p.y); ctx.stroke();[lastX, lastY] = [p.x, p.y]; if (!hasDrawn) { hasDrawn = true; canvas.classList.add('has-signature'); updateProgress(); validateForm(); } }, { passive: false });
    canvas.addEventListener('touchend', () => { if (isDrawing) { isDrawing = false; validateForm(); } });
}

document.getElementById('clearSignature')?.addEventListener('click', () => { ctx.clearRect(0, 0, canvas.width, canvas.height); hasDrawn = false; canvas.classList.remove('has-signature'); updateProgress(); validateForm(); });

// ID UPLOAD & CAMERA
const handleIdFile = (e) => {
    const f = e.target.files[0];
    if (f) {
        const r = new FileReader();
        r.onload = (re) => {
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas'); const max = 1200; let w = img.width, h = img.height; if (w > max) { h = h * (max / w); w = max; } c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                uploadedFile = c.toDataURL('image/jpeg', 0.85);
                document.getElementById('previewImage').src = uploadedFile;
                document.getElementById('uploadArea').style.display = 'none'; document.getElementById('uploadedPreview').style.display = 'block';
                updateProgress(); validateForm();
            };
            img.src = re.target.result;
        };
        r.readAsDataURL(f);
    }
};

document.getElementById('idUpload')?.addEventListener('change', handleIdFile);
document.getElementById('idCapture')?.addEventListener('change', handleIdFile);
document.getElementById('captureBtn')?.addEventListener('click', () => document.getElementById('idCapture').click());

document.getElementById('removeFile')?.addEventListener('click', () => { uploadedFile = null; document.getElementById('uploadArea').style.display = 'block'; document.getElementById('uploadedPreview').style.display = 'none'; updateProgress(); validateForm(); });

function validateForm() {
    const btn = document.getElementById('submitContract'); if (!btn) return;
    const agreed = document.getElementById('agreeTerms')?.checked || false;
    btn.disabled = !(uploadedFile && hasDrawn && agreed);
}

document.getElementById('agreeTerms')?.addEventListener('change', validateForm);

document.getElementById('submitContract')?.addEventListener('click', async () => {
    const btn = document.getElementById('submitContract'); if (btn.disabled) return;
    btn.disabled = true;
    document.getElementById('submitText').innerHTML = 'جاري الإرسال المأمون...';
    signatureData = canvas.toDataURL('image/png');
    const contractNo = 'CON-' + Date.now().toString().slice(-6);
    const now = new Date();
    if (studentIdToSave) {
        const data = { contractStatus: 'signed', signedAt: now.toISOString(), signature: signatureData, idImage: uploadedFile, contractNo };
        if (typeof CloudDB !== 'undefined') await CloudDB.updateContract(String(studentIdToSave), data);
        const students = JSON.parse(localStorage.getItem('students') || '[]');
        const idx = students.findIndex(s => String(s.id) === String(studentIdToSave));
        if (idx !== -1) { Object.assign(students[idx], data); localStorage.setItem('students', JSON.stringify(students)); }
    }
    showSuccessAfterSigning({
        studentName: document.getElementById('contractStudentName')?.textContent,
        contractNo, signedAt: now.toISOString(), signature: signatureData, idImage: uploadedFile
    });
});

document.getElementById('zoomContract')?.addEventListener('click', function () {
    const v = document.getElementById('contractViewer');
    if (!isZoomed) {
        v.style.maxHeight = 'none';
        v.style.fontSize = '1.1rem';
        this.innerHTML = '🔍 تصغير النص';
        isZoomed = true;
    } else {
        v.style.maxHeight = '400px';
        v.style.fontSize = '0.95rem';
        this.innerHTML = '🔍 تكبير النص';
        isZoomed = false;
    }
});

// ===================================================
// PDF TEMPLATE PREVIEW & GENERATION (Parent View)
// ===================================================
let currentPdfDoc = null;
let currentPdfPage = 1;

async function initPdfPreview(pdfData) {
    if (typeof pdfjsLib === 'undefined') return;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

    try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfData, cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/', cMapPacked: true });
        currentPdfDoc = await loadingTask.promise;
        renderPdfPage(1);
    } catch (e) {
        console.error("PDF Preview Error (pdfjs):", e);
        throw e; // Rethrow to be caught by the outer handler
    }
}

async function renderPdfPage(num) {
    if (!currentPdfDoc || num < 1 || num > currentPdfDoc.numPages) return;
    currentPdfPage = num;

    const page = await currentPdfDoc.getPage(num);
    const canvas = document.getElementById('pdf-preview-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderTask = page.render({ canvasContext: ctx, viewport: viewport });
    await renderTask.promise;

    // Show container and hide loading
    document.getElementById('pdf-loading-state').style.display = 'none';
    document.getElementById('pdf-preview-container').style.display = 'block';
    document.getElementById('pdf-controls').style.display = 'block';

    const info = document.getElementById('pdf-page-info');
    if (info) info.textContent = `صفحة ${num} من ${currentPdfDoc.numPages}`;
}

async function generatePdfFromTemplate(template, studentData) {
    const PDFLib_ref = window.PDFLib || (typeof PDFLib !== 'undefined' ? PDFLib : null);

    // Ensure critical dependencies are loaded (Hyper-Resiliency)
    if (!PDFLib_ref) {
        try { await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js'); } catch (e) { }
    }
    if (typeof ArabicReshaper === 'undefined') {
        try { await loadScript('https://cdn.jsdelivr.net/npm/arabic-reshaper@2.1.0/dist/arabic-reshaper.min.js'); } catch (e) {
            try { await loadScript('https://unpkg.com/arabic-reshaper@2.1.0/dist/arabic-reshaper.js'); } catch (e2) { }
        }
    }

    const PDFLib_final = window.PDFLib || (typeof PDFLib !== 'undefined' ? PDFLib : null);
    if (!PDFLib_final) {
        throw new Error("مكتبة PDF-Lib الحيوية غير متوفرة. يرجى تحديث الصفحة.");
    }
    const { PDFDocument, rgb } = PDFLib_final;

    if (!template || !template.pdfData) {
        throw new Error("بيانات القالب غير متوفرة");
    }

    // 1. Get Font (Cached) - Hyper-Resilient logic
    if (!cachedCairoFont || cachedCairoFont.byteLength < 500000) {
        cachedCairoFont = null;
        let log = [];

        // STRATEGY A: Try CloudDB (Firebase) first - Most reliable for parents
        if (typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
            try {
                console.log("☁️ Attempting to load font from CloudDB...");
                const cloudBase64 = await CloudDB.getFont('Cairo-Regular');
                if (cloudBase64) {
                    const binary = atob(cloudBase64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    if (bytes.byteLength > 500000) {
                        cachedCairoFont = bytes.buffer;
                        console.log("✅ Font loaded from CloudDB");
                    } else {
                        log.push("Cloud: Invalid size");
                    }
                } else {
                    log.push("Cloud: Not found");
                }
            } catch (e) { log.push(`Cloud: Error (${e.message})`); }
        }

        // STRATEGY B: Fallback to External CDNs if cloud failed
        if (!cachedCairoFont) {
            const fontSources = [
                { id: 'Local', url: 'Cairo-Regular.ttf' },
                { id: 'GitHub', url: 'https://github.com/googlefonts/cairo/raw/master/fonts/ttf/Cairo-Regular.ttf' },
                { id: 'GStatic', url: 'https://fonts.gstatic.com/s/cairo/v28/SLXGc1nY6HkvangtZmpcMw.ttf' },
                { id: 'CDN1', url: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo-Regular.ttf' }
            ];

            for (const src of fontSources) {
                try {
                    const resp = await fetch(src.url, { mode: 'cors' });
                    if (resp.ok) {
                        const buf = await resp.arrayBuffer();
                        if (buf.byteLength > 500000) {
                            cachedCairoFont = buf;
                            console.log(`✅ Font loaded from ${src.id}`);
                            break;
                        } else {
                            log.push(`${src.id}: Size missing (${buf.byteLength})`);
                        }
                    } else {
                        log.push(`${src.id}: HTTP ${resp.status}`);
                    }
                } catch (e) {
                    log.push(`${src.id}: Error (${e.message})`);
                }
            }
        }

        // STRATEGY C: Try Embedded Font (font-data.js) - Ultimate Backup
        if (!cachedCairoFont && typeof GLOBAL_CAIRO_FONT !== 'undefined') {
            try {
                console.log("💎 Loading Font from Embedded Backup...");
                const binary = atob(GLOBAL_CAIRO_FONT);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                if (bytes.byteLength > 100000) {
                    cachedCairoFont = bytes.buffer;
                    console.log("✅ Font loaded from Embedded Backup");
                } else {
                    log.push("Embedded: Invalid size");
                }
            } catch (e) { log.push(`Embedded: Error (${e.message})`); }
        }

        if (!cachedCairoFont) {
            const errorDetails = log.join(' | ');
            throw new Error(`تعذر تحميل خطوط العقد بسبب قيود في الشبكة أو ضعف الاتصال. (التشخيص: ${errorDetails})`);
        }
    }

    // 2. Load the template
    let pdfBytes;
    try {
        if (typeof template.pdfData === 'string' && template.pdfData.startsWith('data:application/pdf;base64,')) {
            const base64 = template.pdfData.split(',')[1];
            pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else if (typeof template.pdfData === 'string') {
            // Assume it might be just base64 or a binary string
            try {
                pdfBytes = Uint8Array.from(atob(template.pdfData), c => c.charCodeAt(0));
            } catch (e) {
                pdfBytes = template.pdfData;
            }
        } else {
            pdfBytes = template.pdfData;
        }
    } catch (e) {
        throw new Error("فشل معالجة بيانات ملف PDF للقالب: " + e.message);
    }

    if (!template.pdfFields || !Array.isArray(template.pdfFields)) {
        throw new Error("لا توجد حقول معرفة في قالب الـ PDF");
    }

    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    // Register Fontkit (Required for custom Arabic fonts)
    const fk = window.fontkit || (typeof fontkit !== 'undefined' ? fontkit : null);
    if (!fk) {
        console.error("Fontkit not found!");
        throw new Error("مكتبة Fontkit غير متوفرة. يرجى التأكد من تشغيل الصفحة في متصفح حديث.");
    }

    try {
        pdfDoc.registerFontkit(fk);
    } catch (e) {
        console.warn("Fontkit already registered or failed:", e);
    }

    let customFont;
    try {
        customFont = await pdfDoc.embedFont(cachedCairoFont);
    } catch (e) {
        console.error("Critical: Font embedding failed", e);
        let reason = e.message || "سبب غير معروف";
        if (reason.includes("fontkit")) reason = "لم يتم تسجيل محرك الخطوط (fontkit)";
        const fontStatus = cachedCairoFont ? `Buffer(${cachedCairoFont.byteLength})` : "Missing";
        throw new Error(`فشل دمج الخط العربي (الحالة: ${fontStatus}, التفاصيل: ${reason}). [V2] يرجى التأكد من استقرار الإنترنت وتحديث الصفحة.`);
    }

    const pages = pdfDoc.getPages();
    // High-Precision Arabic Reshaper Detection
    // Intelligent Arabic Handling
    const fixArabic = (text) => {
        if (!text) return "";
        const str = String(text);

        // Check if text contains Arabic characters (Extended)
        const hasArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(str);
        if (!hasArabic) return str; // return as-is for English/Numbers

        // Find Reshaper
        let reshaper = (typeof ArabicReshaper !== 'undefined') ? ArabicReshaper : (window.ArabicReshaper || null);

        // Robustly find the convert function
        let convertFunc = null;
        if (reshaper) {
            if (typeof reshaper.convertArabic === 'function') convertFunc = reshaper.convertArabic;
            else if (reshaper.ArabicReshaper && typeof reshaper.ArabicReshaper.convertArabic === 'function') convertFunc = reshaper.ArabicReshaper.convertArabic;
            else if (reshaper.default && typeof reshaper.default.convertArabic === 'function') convertFunc = reshaper.default.convertArabic;
        }

        let processed = str;
        if (convertFunc) {
            processed = convertFunc(processed);
        }

        // Reverse for RTL rendering in pdf-lib
        return processed.split('').reverse().join('');
    };

    for (const field of template.pdfFields) {
        let text = field.variable;
        let isImage = false;

        // Basic Replacements
        if (text === '{اسم_الطالب}') text = studentData.studentName || '';
        else if (text === '{اسم_ولي_الامر}') text = studentData.parentName || '';
        else if (text === '{المسار}') text = studentData.customFields?.studentTrack || studentData.studentTrack || '';
        else if (text === '{الصف}') text = studentData.studentGrade || '';
        else if (text === '{المرحلة_الدراسية}') text = studentData.studentLevel || '';
        else if (text === '{السنة_الدراسية}') text = studentData.contractYear || '';
        else if (text === '{البريد_الالكتروني}') text = studentData.parentEmail || '';
        else if (text === '{الرقم_القومي}') text = studentData.nationalId || studentData.customFields?.nationalId || '';
        else if (text === '{رقم_الواتساب}') text = studentData.parentWhatsapp || '';
        else if (text === '{التاريخ}') text = new Date().toLocaleDateString('en-US'); // Use Western numerals for safety
        else if (text === '{التوقيع}') { text = studentData.signature; isImage = true; }
        else if (text === '{الهوية}') { text = studentData.idImage || null; isImage = true; }
        else if (text === '{الختم}') {
            const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            text = settings.stampImage || null;
            isImage = true;
        } else {
            // Custom Fields
            if (studentData.customFields) {
                try {
                    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                    const fieldDef = (settings.customFields || []).find(f => `{${f.label}}` === text);
                    if (fieldDef) {
                        text = studentData.customFields[fieldDef.id] || '';
                    }
                } catch (e) { }
            }
        }

        if (!text) continue;
        const page = pages[field.page - 1];
        if (!page) continue;

        const { width: pWidth, height: pHeight } = page.getSize();
        const scaleX = pWidth / field.viewportWidth;
        const scaleY = pHeight / field.viewportHeight;

        const pdfX = field.x * scaleX;
        const pdfY = pHeight - (field.y * scaleY);

        if (isImage) {
            try {
                let img;
                if (text.startsWith('data:image/png')) {
                    img = await pdfDoc.embedPng(text);
                } else if (text.startsWith('data:image/jpeg') || text.startsWith('data:image/jpg')) {
                    img = await pdfDoc.embedJpg(text);
                } else {
                    // Fallback attempt
                    try { img = await pdfDoc.embedPng(text); } catch (e) { img = await pdfDoc.embedJpg(text); }
                }

                if (img) {
                    const dims = img.scaleToFit(120, 60);
                    page.drawImage(img, { x: pdfX, y: pdfY - dims.height, width: dims.width, height: dims.height });
                }
            } catch (e) {
                console.warn("Failed to embed image field:", field.variable, e);
            }
        } else {
            try {
                page.drawText(fixArabic(text), { x: pdfX, y: pdfY - 12, size: 10, font: customFont });
            } catch (encodingError) {
                console.error("Encoding error for text:", text, encodingError);
                // Don't try to draw with standard font, just skip or log
            }
        }
    }
    return await pdfDoc.save();
}

window.addEventListener('load', async () => { const std = await loadStudentData(); if (std) { resizeCanvas(); updateProgress(); } });
window.addEventListener('resize', resizeCanvas);
