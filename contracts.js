// Contract Management System with Dynamic Variables Support
class ContractManager {
    constructor() {
        this.init();
        this.variables = [
            { key: '{اسم_الطالب}', label: 'اسم الطالب' },
            { key: '{اسم_ولي_الامر}', label: 'اسم ولي الأمر' },
            { key: '{الصف}', label: 'الصف الدراسي' },
            { key: '{السنة_الدراسية}', label: 'السنة الدراسية' },
            { key: '{البريد_الالكتروني}', label: 'البريد الإلكتروني' },
            { key: '{الرقم_القومي}', label: 'السجل المدني/الإقامة' },
            { key: '{رقم_الواتساب}', label: 'رقم الواتساب' },
            { key: '{التاريخ}', label: 'التاريخ الحالي' },
            { key: '{التوقيع}', label: 'توقيع ولي الأمر' },
            { key: '{الختم}', label: 'ختم المدرسة' },
            { key: '{الهوية}', label: 'صورة الهوية' }
        ];
    }

    init() {
        if (!localStorage.getItem('contractTemplates')) {
            const defaultContract = {
                id: 'default-' + Date.now(),
                title: 'عقد تسجيل الطلاب الافتراضي',
                content: `عقد تسجيل طالب

اسم الطالب: {اسم_الطالب}
الصف الدراسي: {الصف}
السنة الدراسية: {السنة_الدراسية}
ولي الأمر: {اسم_ولي_الامر}

بموجب هذا العقد يتم الاتفاق بين المدرسة وولي أمر الطالب على ما يلي:

المادة الأولى: التعريف بالأطراف
الطرف الأول: المدرسة (ممثلة بإدارتها)
الطرف الثاني: {اسم_ولي_الامر} (ولي أمر الطالب)

المادة الثانية: موضوع العقد
يقر ولي الأمر بتسجيل نجله/ابنته ({اسم_الطالب}) في المدرسة للعام الدراسي {السنة_الدراسية}، ويلتزم بدفع الرسوم الدراسية المتفق عليها.

المادة الثالثة: الرسوم الدراسية
- رسوم التسجيل: 2,000 ريال
- الرسوم الفصلية: 10,000 ريال
- رسوم الأنشطة: 1,500 ريال

المادة الرابعة: التزامات ولي الأمر
- الالتزام بسداد الرسوم في المواعيد المحددة
- متابعة المستوى الدراسي للطالب
- الالتزام بلوائح وأنظمة المدرسة

تم التوقيع بتاريخ: {التاريخ}`,
                isDefault: true,
                createdAt: new Date().toISOString()
            };
            localStorage.setItem('contractTemplates', JSON.stringify([defaultContract]));
        }
    }

    replaceVariables(content, studentData) {
        let result = content;
        result = result.replace(/{اسم_الطالب}/g, studentData.studentName || '');
        result = result.replace(/{اسم_ولي_الامر}/g, studentData.parentName || '');
        result = result.replace(/{الصف}/g, studentData.studentGrade || '');
        result = result.replace(/{السنة_الدراسية}/g, studentData.contractYear || '');
        result = result.replace(/{البريد_الالكتروني}/g, studentData.parentEmail || '');
        result = result.replace(/{رقم_الواتساب}/g, studentData.parentWhatsapp || '');
        result = result.replace(/{التاريخ}/g, new Date().toLocaleDateString('ar-SA'));
        return result;
    }

    getContracts() {
        return JSON.parse(localStorage.getItem('contractTemplates') || '[]');
    }

    getContract(id) {
        return this.getContracts().find(c => c.id === id);
    }

    getDefaultContract() {
        const contracts = this.getContracts();
        return contracts.find(c => c.isDefault) || contracts[0];
    }

    saveContract(contract) {
        const contracts = this.getContracts();

        if (!contract.id) {
            contract.id = 'contract-' + Date.now();
            contract.createdAt = new Date().toISOString();
        }

        if (contract.isDefault) {
            contracts.forEach(c => c.isDefault = false);
        }

        const index = contracts.findIndex(c => c.id === contract.id);
        if (index >= 0) {
            contracts[index] = contract;
        } else {
            contracts.push(contract);
        }

        // If it's a PDF template, we might want to store the large base64 data separately or be careful about quota.
        // For localStorage, 5MB is the limit. A PDF might exceed this.
        // Ideally we should use IndexedDB, but for now let's try localStorage and catch errors.
        try {
            localStorage.setItem('contractTemplates', JSON.stringify(contracts));

            // SYNC TO CLOUD for parent visibility
            if (typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
                CloudDB.saveContractTemplate(contract);
            }
        } catch (e) {
            alert('عذراً، مساحة التخزين ممتلئة. حاول استخدام ملف PDF أصغر حجماً.');
            return null;
        }

        return contract;
    }

    deleteContract(id) {
        const contracts = this.getContracts();
        const filtered = contracts.filter(c => c.id !== id);

        if (filtered.length > 0 && !filtered.some(c => c.isDefault)) {
            filtered[0].isDefault = true;
        }

        localStorage.setItem('contractTemplates', JSON.stringify(filtered));
    }

    // Generate Final PDF from Template
    async generatePdfFromTemplate(contractTemplate, studentData) {
        if (!contractTemplate.pdfData || !contractTemplate.pdfFields) {
            throw new Error("بيانات قالب PDF غير صالحة");
        }

        const { PDFDocument, rgb } = PDFLib;
        const fontkit = window.fontkit;

        // 2. Load the template
        let pdfBytes;
        if (typeof contractTemplate.pdfData === 'string' && contractTemplate.pdfData.startsWith('data:application/pdf;base64,')) {
            const base64 = contractTemplate.pdfData.split(',')[1];
            pdfBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        } else {
            pdfBytes = contractTemplate.pdfData;
        }

        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        pdfDoc.registerFontkit(fontkit);

        // Load Arabic Font (Cairo) with caching
        if (!this.cachedFont) {
            try {
                this.cachedFont = await fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/cairo/Cairo-Regular.ttf').then(res => res.arrayBuffer());
            } catch (e) {
                console.warn("Falling back to woff2 font", e);
                this.cachedFont = await fetch('https://fonts.gstatic.com/s/cairo/v20/SLXGc1nY6HkvangtZmpcMw.woff2').then(res => res.arrayBuffer());
            }
        }
        const customFont = await pdfDoc.embedFont(this.cachedFont);

        const pages = pdfDoc.getPages();

        // Simple Arabic Reshaper/Reverser for pdf-lib
        const fixArabic = (text) => {
            if (!text) return "";
            let processedText = String(text);

            // Use ArabicReshaper if available (Loaded in index.html)
            if (typeof ArabicReshaper !== 'undefined' && ArabicReshaper.convertArabic) {
                // Reshape (connect letters)
                processedText = ArabicReshaper.convertArabic(processedText);
                // Reverse for RTL rendering in LTR context
                return processedText.split('').reverse().join('');
            }
            return processedText.split('').reverse().join('');
        };

        // Process Fields
        for (const field of contractTemplate.pdfFields) {
            let text = field.variable;
            let isImage = false;

            // Replace variables
            if (text === '{اسم_الطالب}') text = studentData.studentName || '';
            else if (text === '{اسم_ولي_الامر}') text = studentData.parentName || '';
            else if (text === '{الصف}') text = studentData.studentGrade || '';
            else if (text === '{المرحلة_الدراسية}') text = studentData.studentLevel || '';
            else if (text === '{السنة_الدراسية}') text = studentData.contractYear || '';
            else if (text === '{البريد_الالكتروني}') text = studentData.parentEmail || '';
            else if (text === '{الرقم_القومي}') text = studentData.nationalId || '';
            else if (text === '{رقم_الواتساب}') text = studentData.parentWhatsapp || '';
            else if (text === '{التاريخ}') text = new Date().toLocaleDateString('ar-SA');
            else if (text === '{التوقيع}') { text = studentData.signature; isImage = true; }
            else if (text === '{الهوية}') { text = studentData.idImage || studentData.idCardImage || null; isImage = true; }
            else if (text === '{الختم}') {
                // If previewing in admin, show stamp if student is signed or if specialized for preview
                const settings = (typeof db !== 'undefined') ? db.getSettings() : JSON.parse(localStorage.getItem('appSettings') || '{}');
                text = settings.stampImage || null;
                isImage = true;
            } else {
                // Check Custom Fields
                if (studentData.customFields) {
                    try {
                        const settings = (typeof db !== 'undefined') ? db.getSettings() : JSON.parse(localStorage.getItem('appSettings') || '{}');
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

            // Calculate scaling between the viewport used in editor and the actual PDF page size
            // Viewport size was saved in 'field.viewportWidth' and 'field.viewportHeight'
            const scaleX = pWidth / field.viewportWidth;
            const scaleY = pHeight / field.viewportHeight;

            const pdfX = field.x * scaleX;
            // PDF coordinates start from bottom-left
            const pdfY = pHeight - (field.y * scaleY);

            if (isImage) {
                try {
                    let image;
                    if (text.startsWith('data:image/png')) {
                        image = await pdfDoc.embedPng(text);
                    } else if (text.startsWith('data:image/jpeg') || text.startsWith('data:image/jpg')) {
                        image = await pdfDoc.embedJpg(text);
                    }

                    if (image) {
                        const imgDims = image.scaleToFit(120, 60);
                        page.drawImage(image, {
                            x: pdfX,
                            y: pdfY - imgDims.height, // Adjust for bottom-left anchor
                            width: imgDims.width,
                            height: imgDims.height,
                        });
                    }
                } catch (err) {
                    console.error("Error embedding image:", err);
                }
            } else {
                // Draw Text with fixed Arabic
                page.drawText(fixArabic(text), {
                    x: pdfX,
                    y: pdfY - 14, // Roughly adjust for font height
                    size: 11,
                    font: customFont,
                    color: rgb(0, 0, 0)
                });
            }
        }

        return await pdfDoc.save();
    }
}

const contractMgr = new ContractManager();

// Update DatabaseManager
if (typeof db !== 'undefined') {
    const originalDbSave = db.saveStudent.bind(db);
    db.saveStudent = function (student) {
        if (!student.contractTemplateId) {
            const defaultContract = contractMgr.getDefaultContract();
            student.contractTemplateId = defaultContract ? defaultContract.id : null;
        }
        return originalDbSave(student);
    };
}

// Navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        const targetPage = document.getElementById(`${page}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
        }

        if (page === 'contracts') {
            ContractUI.renderContracts();
            if (typeof UI !== 'undefined' && UI.renderSignedContracts) UI.renderSignedContracts();
        }
    });
});

// Contract UI
const ContractUI = {
    modal: null,
    form: null,
    contractsGrid: null,
    currentEditingId: null,
    currentInputMethod: 'write',
    currentTab: 'signed',
    currentFilter: 'all',
    inited: false,

    pdfManager: {
        pdfDoc: null,
        pageNum: 1,
        numPages: 0,
        scale: 1.5,
        canvas: null,
        ctx: null,
        renderTask: null,
        addedFields: [],
        selectedVariable: null,
        file: null,
        draggingFieldId: null,
        dragOffsetX: 0,
        dragOffsetY: 0
    },

    init() {
        if (this.inited) return;
        console.log("ContractUI Initializing...");
        this.inited = true;

        this.modal = document.getElementById('contractEditorModal');
        this.form = document.getElementById('contractForm');
        this.contractsGrid = document.getElementById('contractsGrid');

        // Tab events are handled via onclick in HTML

        // Bind File Upload Events
        const browseBtn = document.getElementById('browseContractFile');
        const fileInput = document.getElementById('contractFileInput');
        const uploadArea = document.getElementById('contractUploadArea');
        const removeFileBtn = document.getElementById('removeContractFile');

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', () => fileInput.click());
        }

        if (uploadArea && fileInput) {
            uploadArea.addEventListener('click', (e) => {
                if (e.target !== browseBtn) fileInput.click();
            });

            // Drag and Drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = 'var(--primary)';
                uploadArea.style.backgroundColor = 'var(--bg-secondary)';
            });

            uploadArea.addEventListener('dragleave', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#e2e8f0';
                uploadArea.style.backgroundColor = 'transparent';
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.style.borderColor = '#e2e8f0';
                uploadArea.style.backgroundColor = 'transparent';

                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    fileInput.files = e.dataTransfer.files;
                    this.handleFileUpload(fileInput);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', () => this.handleFileUpload(fileInput));
        }

        this.updateStats();
        this.renderVariablesList();

        // Initialize PDF Template Logic Context (Canvas)
        this.initPdfTemplateLogic();
    },

    resetUpload() {
        const input = document.getElementById('contractFileInput');
        if (input) input.value = '';
        document.getElementById('uploadedContractPreview').style.display = 'none';
        const uploadArea = document.getElementById('contractUploadArea');
        if (uploadArea) {
            uploadArea.style.display = 'block';
            uploadArea.style.opacity = '1';
        }
    },

    useUploadedText() {
        const extracted = document.getElementById('extractedText');
        if (extracted) {
            const text = extracted.value;
            const mainEditor = document.getElementById('contractText');
            if (mainEditor) mainEditor.value = text;
            this.switchInputMethod('write');
        }
    },

    async handlePdfTemplateUpload(input) {
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];
        console.log("PDF Template Selected:", file.name);
        this.pdfManager.file = file;

        // Ensure canvas setup is ready if not already
        if (!this.pdfManager.canvas) {
            this.initPdfTemplateLogic();
        }

        try {
            await this.loadPdfFile(file);
            // Show Editor
            document.getElementById('pdfTemplateUploadArea').style.display = 'none';
            document.getElementById('pdfTemplateEditor').style.display = 'block';
        } catch (err) {
            console.error(err);
            alert("فشل تحميل ملف PDF: " + err.message);
            // Reset
            input.value = '';
        }
    },

    initPdfTemplateLogic() {
        if (this.pdfLogicInited) return;

        console.log("Initializing PDF Template Logic...");
        if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        }

        const canvas = document.getElementById('the-canvas');
        if (!canvas) {
            console.error("PDF Canvas missing");
            return;
        }

        this.pdfManager.canvas = canvas;
        this.pdfManager.ctx = canvas.getContext('2d');

        // Note: Event Listeners for var-btn are now handled via delegation in script.js calls handleVariableClick

        // Canvas Click Listener (Place Variable)
        canvas.addEventListener('mousedown', (e) => {
            if (this.pdfManager.selectedVariable) {
                this.handleCanvasClick(e);
            }
        });

        // Global Drag Listeners for the fields
        const container = document.getElementById('pdfCanvasContainer');
        if (container) {
            container.addEventListener('mousemove', (e) => this.handleDragMove(e));
            window.addEventListener('mouseup', () => this.handleDragEnd());
        }

        // Pagination
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn) prevBtn.addEventListener('click', () => this.changePdfPage(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.changePdfPage(1));

        this.pdfLogicInited = true;
    },

    renderVariablesList() {
        const list = document.getElementById('pdfVariablesList');
        if (!list) return;

        // Standard placeholders
        const standard = [
            { key: '{اسم_الطالب}', label: 'اسم الطالب' },
            { key: '{اسم_ولي_الامر}', label: 'اسم ولي الأمر' },
            { key: '{الصف}', label: 'الصف' },
            { key: '{المرحلة_الدراسية}', label: 'المرحلة' },
            { key: '{السنة_الدراسية}', label: 'السنة' },
            { key: '{التاريخ}', label: 'التاريخ' },
            { key: '{التوقيع}', label: 'مكان التوقيع' },
            { key: '{الختم}', label: 'مكان الختم' }
        ];

        let html = standard.map(v => `
            <button type="button" class="var-btn" data-var="${v.key}" onclick="ContractUI.handleVariableClick('${v.key}')">
                ${v.label}
            </button>
        `).join('');

        // Add Custom Fields from Settings
        try {
            const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
            if (settings.customFields && settings.customFields.length > 0) {
                html += '<div style="font-size: 10px; color: #64748b; margin-top: 10px; padding: 0 5px;">حقول مخصصة:</div>';
                settings.customFields.forEach(f => {
                    const key = `{${f.label}}`;
                    html += `
                        <button type="button" class="var-btn" data-var="${key}" onclick="ContractUI.handleVariableClick('${key}')">
                            ${f.label}
                        </button>`;
                });
            }
        } catch (e) { }

        list.innerHTML = html;
    },

    handleVariableClick(variable) {
        // Deselect others
        document.querySelectorAll('#pdfVariablesList .var-btn').forEach(b => b.classList.remove('active'));

        // Highlight active
        const btn = document.querySelector(`.var-btn[data-var="${variable}"]`);
        if (btn) btn.classList.add('active');

        this.pdfManager.selectedVariable = variable;

        // Change cursor to indicate placement mode
        if (this.pdfManager.canvas) {
            this.pdfManager.canvas.style.cursor = 'crosshair';
            if (typeof UI !== 'undefined') UI.showNotification(`موضع: ${variable} - انقر على القالب للموقع`);
        }
    },

    async loadPdfFile(fileOrData) {
        if (typeof pdfjsLib === 'undefined') {
            alert("مكتبة PDF غير محملة. الرجاء تحديث الصفحة.");
            return;
        }

        try {
            let arrayBuffer;
            if (fileOrData instanceof File || fileOrData instanceof Blob) {
                arrayBuffer = await fileOrData.arrayBuffer();
                this.pdfManager.file = fileOrData;
            } else if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
                // Base64 Data URL - Manual conversion to avoid potential fetch issues with long URLs
                const base64 = fileOrData.split(',')[1];
                const binary = atob(base64);
                arrayBuffer = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    arrayBuffer[i] = binary.charCodeAt(i);
                }
            } else {
                arrayBuffer = fileOrData;
            }

            // Load using PDF.js for rendering
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfManager.pdfDoc = await loadingTask.promise;
            this.pdfManager.numPages = this.pdfManager.pdfDoc.numPages;
            this.pdfManager.pageNum = 1;

            // Important: Ensure canvas is initialized before rendering
            if (!this.pdfManager.canvas) {
                this.initPdfTemplateLogic();
            }

            if (this.pdfManager.canvas) {
                await this.renderPdfPage(1);
            } else {
                console.error("Canvas not ready for rendering PDF");
            }
        } catch (e) {
            console.error("PDF Load Error:", e);
            throw new Error("تعذر قراءة ملف PDF. تأكد من أن الملف صالح.");
        }
    },

    async renderPdfPage(num) {
        const manager = this.pdfManager;
        manager.pageNum = num;

        const page = await manager.pdfDoc.getPage(num);

        const viewport = page.getViewport({ scale: manager.scale });
        manager.canvas.height = viewport.height;
        manager.canvas.width = viewport.width;

        // Update info
        document.getElementById('pageInfo').textContent = `صفحة ${num} / ${manager.numPages}`;

        const renderContext = {
            canvasContext: manager.ctx,
            viewport: viewport
        };

        if (manager.renderTask) {
            manager.renderTask.cancel();
        }

        manager.renderTask = page.render(renderContext);

        try {
            await manager.renderTask.promise;
            this.renderOverlays(); // Re-draw fields on top
        } catch (e) {
            // Cancelled
        }
    },

    changePdfPage(delta) {
        const manager = this.pdfManager;
        const newPage = manager.pageNum + delta;
        if (newPage >= 1 && newPage <= manager.numPages) {
            this.renderPdfPage(newPage);
        }
    },

    handleCanvasClick(e) {
        const manager = this.pdfManager;
        if (!manager.selectedVariable) return;

        const rect = manager.canvas.getBoundingClientRect();

        // Calculate X, Y relative to the canvas size (and thus the PDF page size at this scale)
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);

        // Save normalized coordinates (unscaled) if we want resolution independence, 
        // but for simplicity we will store scaled coordinates and re-calculate during generation based on viewport.
        // Actually, to serve the 'pdf-lib' later, we need PDF points (72 DPI usually).
        // PDF.js default viewport scale 1.0 is 72 DPI.

        // Let's store the raw coordinates relative to the CURRENT viewport size. 
        // When generating, we must know the viewport size used during design.

        const field = {
            id: Date.now().toString(),
            page: manager.pageNum,
            x: x,
            y: y,
            variable: manager.selectedVariable,
            viewportWidth: manager.canvas.width,
            viewportHeight: manager.canvas.height
        };

        manager.addedFields.push(field);

        this.renderOverlays();
        this.renderAddedFieldsList();

        // Reset Selection
        manager.selectedVariable = null;
        manager.canvas.style.cursor = 'default';
        document.querySelectorAll('#pdfVariablesList .var-btn').forEach(b => b.classList.remove('active'));
    },

    renderOverlays() {
        const manager = this.pdfManager;
        const overlay = document.getElementById('pdfFieldsOverlay');
        if (!overlay) return;

        // Clear existing overlays
        overlay.innerHTML = '';

        manager.addedFields.forEach(field => {
            if (field.page === manager.pageNum) {
                const isImage = field.variable === '{التوقيع}' || field.variable === '{الختم}';
                const width = isImage ? 120 : 160;
                const height = isImage ? 60 : 28;

                const div = document.createElement('div');
                div.className = 'pdf-field-box';
                div.id = `field-${field.id}`;
                div.style.cssText = `
                    position: absolute;
                    left: ${field.x}px;
                    top: ${field.y}px;
                    width: ${width}px;
                    height: ${height}px;
                    background: ${isImage ? "rgba(16, 185, 129, 0.2)" : "rgba(102, 126, 234, 0.15)"};
                    border: 2px solid ${isImage ? "#10b981" : "#667eea"};
                    color: ${isImage ? "#047857" : "#4338ca"};
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: bold;
                    cursor: move;
                    pointer-events: auto;
                    user-select: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                `;
                div.textContent = field.variable;

                // Drag Start
                div.addEventListener('mousedown', (e) => {
                    e.stopPropagation();
                    const rect = div.getBoundingClientRect();
                    this.pdfManager.draggingFieldId = field.id;
                    this.pdfManager.dragOffsetX = e.clientX - rect.left;
                    this.pdfManager.dragOffsetY = e.clientY - rect.top;
                    div.style.zIndex = '1000';
                    div.style.opacity = '0.8';
                });

                overlay.appendChild(div);
            }
        });
    },

    handleDragMove(e) {
        const mgr = this.pdfManager;
        if (!mgr.draggingFieldId) return;

        const container = document.getElementById('pdfCanvasContainer');
        const rect = container.getBoundingClientRect();

        let x = e.clientX - rect.left - mgr.dragOffsetX;
        let y = e.clientY - rect.top - mgr.dragOffsetY;

        // Constraint within container
        x = Math.max(0, Math.min(x, container.clientWidth - 120));
        y = Math.max(0, Math.min(y, container.clientHeight - 24));

        const field = mgr.addedFields.find(f => f.id === mgr.draggingFieldId);
        if (field) {
            field.x = x;
            field.y = y;

            const div = document.getElementById(`field-${field.id}`);
            if (div) {
                div.style.left = `${x}px`;
                div.style.top = `${y}px`;
            }
        }
    },

    handleDragEnd() {
        if (this.pdfManager.draggingFieldId) {
            const div = document.getElementById(`field-${this.pdfManager.draggingFieldId}`);
            if (div) {
                div.style.opacity = '1';
                div.style.zIndex = 'auto';
            }
            this.pdfManager.draggingFieldId = null;
            this.renderAddedFieldsList(); // Update labels if needed
        }
    },

    renderAddedFieldsList() {
        const list = document.getElementById('addedFieldsList');
        if (!list) return;

        list.innerHTML = this.pdfManager.addedFields.map(field => `
            <li style="display: flex; justify-content: space-between; align-items: center; background: white; padding: 6px; margin-bottom: 4px; border-radius: 4px; border: 1px solid #e2e8f0;">
                <span>${field.variable} <small style="color:#718096">(ص ${field.page})</small></span>
                <button onclick="ContractUI.removePdfField('${field.id}')" style="color: red; border: none; background: none; cursor: pointer;">&times;</button>
            </li>
        `).join('');
    },

    removePdfField(id) {
        this.pdfManager.addedFields = this.pdfManager.addedFields.filter(f => f.id !== id);
        this.renderOverlays();
        this.renderAddedFieldsList();
        // Force re-render to clear deleted items from canvas
        this.renderPdfPage(this.pdfManager.pageNum);
    },

    resetUpload() {
        const uploadArea = document.getElementById('contractUploadArea');
        const previewSection = document.getElementById('uploadedContractPreview');
        const fileInput = document.getElementById('contractFileInput');

        if (uploadArea) uploadArea.style.display = 'block';
        if (previewSection) previewSection.style.display = 'none';
        if (fileInput) fileInput.value = '';
    },

    async handleFileUpload(input) {
        if (!input.files || !input.files[0]) return;

        const file = input.files[0];
        const fileNameEl = document.getElementById('uploadedContractName');
        const uploadArea = document.getElementById('contractUploadArea');
        const previewSection = document.getElementById('uploadedContractPreview');
        const textarea = document.getElementById('extractedText');
        const mainEditor = document.getElementById('contractText');

        // Show loading state
        if (uploadArea) uploadArea.style.opacity = '0.5';

        const processText = (text) => {
            if (uploadArea) {
                uploadArea.style.opacity = '1';
                uploadArea.style.display = 'none';
            }

            if (previewSection) previewSection.style.display = 'block';
            if (fileNameEl) fileNameEl.textContent = file.name;
            if (textarea) textarea.value = text;
            if (mainEditor) mainEditor.value = text;
        };

        try {
            if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                processText(result.value);
            } else if (file.type === 'text/plain') {
                const text = await file.text();
                processText(text);
            } else if (file.type === 'application/pdf') {
                const text = await this.extractTextFromPdf(file);
                processText(text);
            } else {
                alert('نوع الملف غير مدعوم. يرجى استخدام .docx أو .txt أو .pdf');
                if (uploadArea) uploadArea.style.opacity = '1';
            }
        } catch (err) {
            console.error("Extraction error:", err);
            alert('حدث خطأ أثناء معالجة الملف: ' + err.message);
            if (uploadArea) uploadArea.style.opacity = '1';
        }
    },

    async extractTextFromPdf(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error("مكتبة PDF.js غير محملة.");
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument(arrayBuffer);
        const pdf = await loadingTask.promise;
        let fullText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(" ");
            fullText += pageText + "\n\n";
        }

        return fullText.trim();
    },

    // Update Statistics
    updateStats() {
        const students = typeof db !== 'undefined' ? db.getStudents() : [];
        const templates = contractMgr.getContracts();

        const allCount = students.length;
        const signedCount = students.filter(s => s.contractStatus === 'signed' || s.contractStatus === 'verified').length;
        const pendingCount = students.filter(s => s.contractStatus === 'pending' || !s.contractStatus).length;
        const templatesCount = templates.length;

        document.getElementById('allContractsCount').textContent = allCount;
        document.getElementById('signedContractsCount').textContent = signedCount;
        document.getElementById('pendingContractsCount').textContent = pendingCount;
        document.getElementById('templatesCount').textContent = templatesCount;
    },

    // Switch Tabs
    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.contract-tab').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
                btn.style.borderBottomColor = 'var(--primary-solid)';
                btn.style.color = 'var(--primary-solid)';
            } else {
                btn.classList.remove('active');
                btn.style.borderBottomColor = 'transparent';
                btn.style.color = 'var(--text-muted)';
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.style.display = 'none';
            content.classList.remove('active');
        });

        const targetContent = document.getElementById(tabName + 'Tab');
        if (targetContent) {
            targetContent.style.display = 'block';
            targetContent.classList.add('active');
        }

        // Load appropriate content
        if (tabName === 'signed') {
            if (typeof UI !== 'undefined' && UI.renderSignedContracts) {
                UI.renderSignedContracts();
            }
        } else if (tabName === 'templates') {
            this.renderContracts();
        }
    },

    // Filter by Status - Navigate to Students Tab with Filter
    filterByStatus(status) {
        // Navigate to students page
        const studentsLink = document.querySelector('.nav-link[data-page="students"]');
        if (studentsLink) {
            studentsLink.click();
        }

        // Apply filter after a short delay to ensure page is rendered
        setTimeout(() => {
            if (typeof UI !== 'undefined' && typeof db !== 'undefined') {
                let students = db.getStudents();

                // Filter based on status
                if (status === 'signed') {
                    // Show only signed and verified contracts
                    students = students.filter(s =>
                        s.contractStatus === 'signed' || s.contractStatus === 'verified'
                    );
                } else if (status === 'pending') {
                    // Show only pending and sent contracts
                    students = students.filter(s =>
                        s.contractStatus === 'pending' ||
                        s.contractStatus === 'sent' ||
                        !s.contractStatus
                    );
                }
                // 'all' = no filter, show all students

                // Render the filtered students
                if (typeof UI.renderStudents === 'function') {
                    UI.renderStudents(students);
                }

                // Show notification
                const statusText = status === 'signed' ? 'الموقعة' :
                    status === 'pending' ? 'قيد الانتظار' : 'جميع';
                if (typeof UI.showNotification === 'function') {
                    UI.showNotification(`تم عرض العقود ${statusText} (${students.length} طالب)`);
                }
            }
        }, 150);
    },

    // Apply Filter (for internal use)
    applyFilter(status) {
        if (typeof UI !== 'undefined' && UI.renderSignedContracts) {
            UI.renderSignedContracts(status);
        }
    },

    // Show Templates - Stay in contracts tab
    showTemplates() {
        this.switchTab('templates');
    },

    // Switch Input Method (Write vs Upload vs PDF Template)
    switchInputMethod(method) {
        console.log("Switching Input Method to:", method);
        this.currentInputMethod = method;

        // Update tabs
        document.querySelectorAll('.input-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.method === method);
        });

        // Show/Hide sections
        const writeSection = document.getElementById('writeMethod');
        const uploadSection = document.getElementById('uploadMethod');
        const pdfTemplateSection = document.getElementById('pdfTemplateMethod');

        if (writeSection) writeSection.style.display = (method === 'write') ? 'block' : 'none';
        if (uploadSection) uploadSection.style.display = (method === 'upload') ? 'block' : 'none';
        if (pdfTemplateSection) pdfTemplateSection.style.display = (method === 'pdf_template') ? 'block' : 'none';

        if (method === 'pdf_template') {
            // Tiny delay to ensure DOM is ready for canvas if just shown
            setTimeout(() => {
                this.initPdfTemplateLogic();
                this.renderVariablesList();
            }, 50);
        }
    },


    openModal(contractId = null) {
        if (!this.modal) this.init();

        this.currentEditingId = contractId;

        if (contractId) {
            const contract = contractMgr.getContract(contractId);
            if (contract) {
                document.getElementById('contractModalTitle').textContent = 'تعديل العقد';
                document.getElementById('contractTitle').value = contract.title || '';
                document.getElementById('setAsDefault').checked = !!contract.isDefault;

                if (contract.type === 'pdf_template') {
                    this.switchInputMethod('pdf_template');
                    // Important: Copy fields so we don't mutate original until save
                    this.pdfManager.addedFields = contract.pdfFields ? JSON.parse(JSON.stringify(contract.pdfFields)) : [];

                    if (contract.pdfData) {
                        // Using timeout to ensure switchInputMethod's logic (initPdfTemplateLogic) has started
                        setTimeout(() => {
                            this.loadPdfFile(contract.pdfData).then(() => {
                                document.getElementById('pdfTemplateUploadArea').style.display = 'none';
                                document.getElementById('pdfTemplateEditor').style.display = 'block';
                                this.renderOverlays();
                                this.renderAddedFieldsList();
                            }).catch(err => {
                                console.error("Failed to load existing PDF:", err);
                                alert("عذراً، فشل تحميل معاينة القالب. جرب إعادة رفع الملف يدوياً.");
                            });
                        }, 100);
                    }
                } else {
                    this.switchInputMethod('write');
                    document.getElementById('contractText').value = contract.content || '';
                }
            }
        } else {
            document.getElementById('contractModalTitle').textContent = 'إنشاء عقد جديد';
            // Clear existing data
            if (this.form) this.form.reset();
            this.pdfManager.addedFields = [];
            this.pdfManager.file = null;
            this.pdfManager.pdfDoc = null;
            this.switchInputMethod('write');
        }

        if (this.modal) this.modal.classList.add('active');
    },

    closeModal() {
        if (this.modal) this.modal.classList.remove('active');
        if (this.form) this.form.reset();
        this.currentEditingId = null;

        // Reset Text/Upload sections
        const preview = document.getElementById('uploadedContractPreview');
        const uploadArea = document.getElementById('contractUploadArea');
        if (preview) preview.style.display = 'none';
        if (uploadArea) uploadArea.style.display = 'block';

        // Reset PDF Template sections
        const pdfUploadArea = document.getElementById('pdfTemplateUploadArea');
        const pdfEditor = document.getElementById('pdfTemplateEditor');
        if (pdfUploadArea) pdfUploadArea.style.display = 'block';
        if (pdfEditor) pdfEditor.style.display = 'none';

        // Clear PDF Manager
        this.pdfManager.addedFields = [];
        this.pdfManager.selectedVariable = null;
        this.pdfManager.file = null;
        if (this.pdfManager.canvas) {
            this.pdfManager.ctx.clearRect(0, 0, this.pdfManager.canvas.width, this.pdfManager.canvas.height);
        }

        this.switchInputMethod('write');
    },

    renderContracts() {
        if (!this.contractsGrid) this.init();
        if (!this.contractsGrid) return;

        const contracts = contractMgr.getContracts();

        if (contracts.length === 0) {
            this.contractsGrid.innerHTML = `
                <div class="empty-state">
                    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                        <path d="M40 10V70M10 40H70" stroke="#ccc" stroke-width="4" stroke-linecap="round"/>
                    </svg>
                    <h3>لا توجد عقود محفوظة</h3>
                    <p>قم بإنشاء عقد جديد للبدء</p>
                </div>
            `;
            return;
        }

        this.contractsGrid.innerHTML = contracts.map(contract => `
            <div class="contract-card">
                <div class="contract-card-header">
                    <h3>${contract.title}</h3>
                    ${contract.isDefault ? '<span class="default-badge">افتراضي</span>' : ''}
                </div>
                <div class="contract-card-body">
                    <p>${contract.content.substring(0, 150)}...</p>
                </div>
                <div class="contract-card-footer">
                    <small>تم الإنشاء: ${new Date(contract.createdAt).toLocaleDateString('ar-SA')}</small>
                    <div class="contract-actions">
                        <button class="btn-icon" onclick="ContractUI.viewContractTemplate('${contract.id}')" title="عرض">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M9 3C4 3 1 9 1 9s3 6 8 6 8-6 8-6-3-6-8-6z" stroke="currentColor" stroke-width="2"/>
                                <circle cx="9" cy="9" r="2" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="btn-icon" onclick="ContractUI.editContract('${contract.id}')" title="تعديل">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M13 2L16 5L6 15H3V12L13 2Z" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                        <button class="btn-icon" onclick="ContractUI.deleteContract('${contract.id}')" title="حذف">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M3 5h12M7 2h4M7 5v10M11 5v10" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    },

    viewContractTemplate(id) {
        const contract = contractMgr.getContract(id);
        if (!contract) return;

        // Simple preview of the template
        const w = window.open('', '_blank');
        w.document.write(`
            <html>
                <head>
                    <title>معاينة نموذج العقد - ${contract.title}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { margin: 0; padding: 40px; background: #f7fafc; font-family: 'Cairo', sans-serif; direction: rtl; }
                        .preview-container { background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); max-width: 800px; margin: 0 auto; }
                        h1 { color: #2d3748; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 30px; }
                        .content { white-space: pre-wrap; line-height: 1.8; color: #4a5568; }
                    </style>
                </head>
                <body>
                    <div class="preview-container">
                        <h1>${contract.title}</h1>
                        <div class="content">${contract.content}</div>
                    </div>
                </body>
            </html>
        `);
    },

    viewContract(id) {
        const student = (typeof db !== 'undefined') ? db.getStudents().find(s => String(s.id) === String(id)) : null;
        if (!student) {
            console.error('Student not found for viewing:', id);
            return;
        }

        const html = this.generateContractFullHTML(student);
        const w = window.open('', '_blank');
        w.document.write(`
            <html>
                <head>
                    <title>معاينة العقد - ${student.studentName}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { margin: 0; padding: 20px; background: #cbd5e0; }
                        @media print {
                            body { background: white; padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom: 20px; text-align: center;">
                        <button onclick="window.print()" style="padding: 10px 20px; cursor: pointer; background: #667eea; color: white; border: none; border-radius: 5px; font-family: 'Cairo'; font-weight: bold;">طباعة / حفظ كـ PDF</button>
                    </div>
                    ${html}
                </body>
            </html>
        `);
    },

    generateContractFullHTML(student) {
        if (!student) return '<p>بيانات الطالب غير متوفرة</p>';

        const settings = (typeof db !== 'undefined') ? db.getSettings() : {};
        const schoolLogo = settings.schoolLogo || 'assets/logo.png';
        const stampText = settings.schoolStampText || 'مدارس دانة العلوم';

        // Use the student's assigned template or default
        const templateId = student.contractTemplateId;
        const template = templateId ? contractMgr.getContract(templateId) : contractMgr.getDefaultContract();
        const rawContent = template ? template.content : 'نص العقد غير متوفر';
        const contractTitle = template ? template.title : 'عقد تسجيل إلكتروني';

        // Process variables
        const filledContent = contractMgr.replaceVariables(rawContent, student);

        // Professional PDF Style Wrapper
        return `
            <div dir="rtl" style="font-family: 'Cairo', sans-serif; background: white; padding: 40px; color: #1a202c; line-height: 1.6; border: 1px solid #e2e8f0; max-width: 800px; margin: 0 auto; min-height: 1000px; position: relative;">
                
                <!-- 1. School Header/Logo -->
                <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 20px;">
                    <img src="${schoolLogo}" style="max-height: 100px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">
                    <h1 style="margin: 0; font-size: 24px; color: #2d3748;">${contractTitle}</h1>
                </div>

                <!-- 2. Contract Description/Content -->
                <div style="margin-bottom: 40px; text-align: justify; white-space: pre-wrap; font-size: 16px;">
${filledContent}
                </div>

                <!-- 3. National ID Image -->
                ${student.idImage ? `
                <div style="margin-top: 40px; margin-bottom: 40px; page-break-inside: avoid;">
                    <h3 style="font-size: 18px; color: #2d3748; margin-bottom: 15px; border-right: 4px solid #667eea; padding-right: 12px;">صورة الهوية الوطنية / الإقامة</h3>
                    <div style="text-align: center; border: 1px dashed #cbd5e0; padding: 10px; border-radius: 8px;">
                        <img src="${student.idImage}" style="max-width: 100%; max-height: 350px; border-radius: 4px;">
                    </div>
                </div>
                ` : ''}

                <!-- 4. Signatures and Stamp -->
                <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; page-break-inside: avoid;">
                    
                    <!-- Parent Signature -->
                    <div style="width: 45%; text-align: center;">
                        <p style="font-weight: bold; margin-bottom: 10px; color: #2d3748;">توقيع ولي الأمر</p>
                        <div style="min-height: 80px; display: flex; align-items: center; justify-content: center;">
                            ${student.signature ? `<img src="${student.signature}" style="max-width: 180px; max-height: 80px; border-bottom: 1px solid #2d3748;">` : '<p style="color: #a0aec0; border-bottom: 1px dashed #cbd5e0; padding: 10px 30px;">لم يتم التوقيع بعد</p>'}
                        </div>
                        <p style="margin-top: 5px; font-size: 14px;">${student.parentName || '..........................'}</p>
                    </div>

                    <!-- School Stamp -->
                    <div style="width: 45%; text-align: center;">
                        <p style="font-weight: bold; margin-bottom: 10px; color: #2d3748;">ختم وإعتماد المدرسة</p>
                        <div style="min-height: 120px; display: flex; align-items: center; justify-content: center;">
                            ${(student.contractStatus === 'signed' || student.contractStatus === 'verified') ? `
                            <div style="width: 130px; height: 130px; border: 4px double #004d99; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-10deg); color: #004d99; font-weight: bold; padding: 5px; box-shadow: 0 0 5px rgba(0,77,153,0.1);">
                                <span style="font-size: 10px; margin-bottom: 2px;">مدارس دانة العلوم</span>
                                <span style="font-size: 18px; border-top: 1px solid #1a202c; border-bottom: 1px solid #1a202c; padding: 2px 0; margin: 2px 0;">مـعـتـمـد</span>
                                <span style="font-size: 9px;">${student.signedAt ? new Date(student.signedAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}</span>
                            </div>
                            ` : `
                            <div style="width: 110px; height: 110px; border: 2px dashed #cbd5e0; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #cbd5e0; font-size: 12px; text-align: center;">
                                بانتظار التوثيق
                            </div>
                            `}
                        </div>
                    </div>
                </div>

                <!-- Footer Audit Info -->
                <div style="margin-top: 80px; border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 11px; color: #718096; text-align: center;">
                    تم إصدار وتوقيع هذا العقد إلكترونياً من خلال منصة تسجيل مدارس دانة العلوم.<br>
                    رقم تتبع العقد: ${student.contractNo || 'Pending'} | تاريخ التوقيع: ${student.signedAt ? new Date(student.signedAt).toLocaleString('ar-SA') : '---'}
                </div>

            </div>
        `;
    },

    editContract(id) {
        this.openModal(id);
    },

    deleteContract(id) {
        const contract = contractMgr.getContract(id);
        if (contract && confirm(`هل أنت متأكد من حذف العقد "${contract.title}"؟`)) {
            contractMgr.deleteContract(id);
            this.renderContracts();
            if (typeof UI !== 'undefined') UI.showNotification('تم حذف العقد بنجاح!');
            loadContractTemplates();
        }
    },


    insertVariable(variable) {
        const textarea = document.getElementById('contractText');
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            textarea.value = text.substring(0, start) + variable + text.substring(end);
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        }
    },

    async downloadSelectedContracts() {
        const checks = document.querySelectorAll('.contract-checkbox:checked');
        const ids = Array.from(checks).map(cb => cb.value);

        if (ids.length === 0) {
            if (typeof UI !== 'undefined') UI.showNotification('⚠️ يرجى اختيار عقد واحد على الأقل');
            return;
        }

        // Single contract: download directly
        if (ids.length === 1) {
            if (typeof UI !== 'undefined' && UI.downloadContractPdf) {
                UI.downloadContractPdf(ids[0]);
            }
            return;
        }

        // Multiple contracts: create ZIP
        if (!window.JSZip) {
            alert('مكتبة الضغط غير محملة. يرجى تحديث الصفحة.');
            return;
        }

        if (typeof UI !== 'undefined' && UI.showNotification) {
            UI.showNotification(`⌛ جاري تحضير ${ids.length} عقود وضغطها في ملف واحد...`);
        }

        try {
            const zip = new JSZip();

            // Generate all PDFs and add to ZIP
            for (let i = 0; i < ids.length; i++) {
                const id = ids[i];
                // Use db.getStudents() for consistency and handle string/number ID comparison
                const students = (typeof db !== 'undefined') ? db.getStudents() : JSON.parse(localStorage.getItem('students') || '[]');
                const student = students.find(s => String(s.id) === String(id));

                if (!student) {
                    console.warn(`Student not found for ID: ${id}`);
                    continue;
                }

                try {
                    // Show progress
                    if (typeof UI !== 'undefined' && UI.showNotification) {
                        UI.showNotification(`📄 جاري معالجة ${i + 1} من ${ids.length}: ${student.studentName}`);
                    }

                    const blob = await UI.generateContractPdfBlob(student);

                    // Verify blob is not empty
                    if (!blob || blob.size < 1000) {
                        console.warn(`Generated PDF for ${student.studentName} is too small (${blob?.size} bytes), may be empty`);
                    }

                    const filename = `عقد_${student.studentName}_${student.contractNo || id}.pdf`;
                    zip.file(filename, blob);
                } catch (err) {
                    console.error(`Error generating PDF for ${student.studentName}:`, err);
                }
            }

            // Generate ZIP and download
            if (typeof UI !== 'undefined' && UI.showNotification) {
                UI.showNotification('🗜️ جاري ضغط الملفات...');
            }

            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });

            // Download ZIP
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(zipBlob);
            const timestamp = new Date().toISOString().split('T')[0];
            link.download = `العقود_الموقعة_${timestamp}.zip`;
            link.click();

            if (typeof UI !== 'undefined' && UI.showNotification) {
                UI.showNotification(`✅ تم تحميل ${ids.length} عقود بنجاح`);
            }

        } catch (err) {
            console.error('Bulk download error:', err);
            if (typeof UI !== 'undefined' && UI.showNotification) {
                UI.showNotification('❌ حدث خطأ أثناء تحضير الملفات');
            }
            alert('حدث خطأ أثناء تحضير ملف ZIP. يرجى المحاولة مرة أخرى.');
        }
    }
};

// Event Listeners
function initContractEvents() {
    const newBtn = document.getElementById('newContractBtn');
    if (newBtn) {
        newBtn.addEventListener('click', () => ContractUI.openModal());
    }

    const closeBtn = document.getElementById('closeContractModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => ContractUI.closeModal());
    }

    const cancelBtn = document.getElementById('cancelContractBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => ContractUI.closeModal());
    }

    const form = document.getElementById('contractForm');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const titleInput = document.getElementById('contractTitle');
            const defaultCheck = document.getElementById('setAsDefault');

            let contract = {
                id: ContractUI.currentEditingId,
                title: titleInput ? titleInput.value : '',
                isDefault: defaultCheck ? defaultCheck.checked : false,
                type: 'text' // Default
            };

            if (ContractUI.currentInputMethod === 'pdf_template') {
                const manager = ContractUI.pdfManager;

                const finalSave = (pdfData) => {
                    contract.type = 'pdf_template';
                    contract.pdfData = pdfData;
                    contract.pdfFields = manager.addedFields;

                    // Fallback content for list view
                    if (!contract.content || contract.content.includes('قالب PDF')) {
                        contract.content = 'قالب PDF: ' + (manager.file ? manager.file.name : 'نسخة محفوظة');
                    }

                    contractMgr.saveContract(contract);
                    ContractUI.closeModal();
                    ContractUI.renderContracts();
                    if (typeof loadContractTemplates === 'function') loadContractTemplates();
                    if (typeof UI !== 'undefined') UI.showNotification('تم حفظ قالب PDF بنجاح!');
                };

                if (manager.file) {
                    const reader = new FileReader();
                    reader.onload = (evt) => finalSave(evt.target.result);
                    reader.readAsDataURL(manager.file);
                } else {
                    // Maybe it's an edit and we already have the data
                    const existing = contractMgr.getContract(contract.id);
                    if (existing && existing.pdfData) {
                        finalSave(existing.pdfData);
                    } else {
                        alert('يرجى اختيار ملف PDF أولاً');
                    }
                }
                return;
            } else {
                let content = '';
                if (ContractUI.currentInputMethod === 'write') {
                    const textArea = document.getElementById('contractText');
                    content = textArea ? textArea.value : '';
                } else if (ContractUI.currentInputMethod === 'upload') {
                    const extracted = document.getElementById('extractedText');
                    content = extracted ? extracted.value : '';
                }
                contract.content = content;
                contract.type = 'text';
            }

            contractMgr.saveContract(contract);
            ContractUI.closeModal();
            ContractUI.renderContracts();
            if (typeof loadContractTemplates === 'function') loadContractTemplates();
            if (typeof UI !== 'undefined') UI.showNotification('تم حفظ العقد بنجاح!');
        });
    }
}

function loadContractTemplates() {
    const select = document.getElementById('contractTemplate');
    if (select) {
        const contracts = contractMgr.getContracts();
        select.innerHTML = '<option value="">اختر نموذج العقد</option>' +
            contracts.map(c => `<option value="${c.id}" ${c.isDefault ? 'selected' : ''}>${c.title}</option>`).join('');
    }
}

// Initialize when DOM is ready
// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        loadContractTemplates();
        initContractEvents();
        ContractUI.init(); // Force Init
        injectDebugConsole(); // Debugging
    });
} else {
    loadContractTemplates();
    initContractEvents();
    ContractUI.init(); // Force Init
    injectDebugConsole(); // Debugging
}

// Visual Debug Console Helper
function injectDebugConsole() {
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debugConsole';
    debugDiv.style.cssText = 'position:fixed; bottom:0; left:0; width:100%; height:150px; background:rgba(0,0,0,0.8); color:#0f0; font-family:monospace; font-size:12px; overflow-y:auto; z-index:99999; padding:10px; pointer-events:none; display:none;';
    // Hidden by default, toggle with Ctrl+Shift+D if needed, but for now let's make it show errors only? 
    // The user said "failed", so let's log major events.
    // Actually, let's keep it hidden unless an error occurs? 
    // Let's just log to standard console primarily, but add a visible alert for "Init Success" to confirm to user.
    // console.log("System Initialized");

    // Check libraries
    setTimeout(() => {
        const missing = [];
        if (typeof mammoth === 'undefined') missing.push("Mammoth (Word)");
        if (typeof pdfjsLib === 'undefined') missing.push("PDF.js");

        if (missing.length > 0) {
            const warning = document.createElement('div');
            warning.style.cssText = 'position:fixed; top:10px; left:50%; transform:translateX(-50%); background:red; color:white; padding:10px 20px; z-index:100000; border-radius:5px; font-weight:bold;';
            warning.innerHTML = `⚠️ تنبيه: بعض المكتبات لم تتحمل: ${missing.join(', ')} <br> يرجى التحقق من الاتصال بالإنترنت وتحديث الصفحة.`;
            document.body.appendChild(warning);
        } else {
            console.log("All libraries loaded.");
        }
    }, 2000);
}
