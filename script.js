// Language Manager
const Lang = {
    current: localStorage.getItem('app_lang') || 'ar',
    toggle: function () {
        this.current = this.current === 'ar' ? 'en' : 'ar';
        localStorage.setItem('app_lang', this.current);
        location.reload();
    },
    t: function (key) {
        return (this.dict[this.current] && this.dict[this.current][key]) || key;
    },
    dict: {
        ar: {
            status_pending: 'قيد الانتظار',
            status_sent: 'تم الإرسال',
            status_signed: 'تم التوقيع',
            status_verified: 'موثق',
            action_send: 'إرسال',
            action_remind: 'تذكير',
            action_verify: 'توثيق',
            action_download: 'تحميل',
            action_edit: 'تعديل',
            action_copy_link: 'نسخ الرابط',
            action_preview: 'معاينة',
            action_unsign: 'إلغاء التوقيع',
            action_delete: 'حذف',
            no_contracts: 'لا توجد عقود موثقة حالياً',
            no_results: 'لا توجد نتائج للبحث',
            verify_now: 'توثيق الآن',
            confirm_verify: 'تأكيد استلام وتوثيق العقد؟',
            verified_success: '✅ تم توثيق العقد بنجاح',
            unknown: 'غير معروف',
            // Navigation
            nav_dashboard: 'لوحة التحكم',
            nav_students: 'الطلاب',
            nav_contracts: 'العقود',
            nav_settings: 'الإعدادات',
            // Buttons & UI
            btn_new_student: 'تسجيل طالب جديد',
            btn_delete_selected: 'حذف المحدد',
            btn_save: 'حفظ',
            btn_cancel: 'إلغاء',
            btn_close: 'إغلاق',
            search_placeholder: 'بحث...',
            // Dropdowns
            select_level: 'اختر المرحلة',
            select_grade: 'اختر الصف',
            filter_level_all: 'المرحلة: الكل',
            filter_grade_all: 'الصف: الكل',
            // Messages
            msg_no_pending: '✨ ممتاز! لا توجد عقود معلقة حالياً',
            msg_no_students: 'لا يوجد طلاب مسجلين',
            msg_confirm_delete: 'هل أنت متأكد من حذف هذا الطالب نهائياً؟',
            msg_select_students: '⚠️ يرجى اختيار طلاب للحذف'
        },
        en: {
            status_pending: 'Pending',
            status_sent: 'Sent',
            status_signed: 'Signed',
            status_verified: 'Verified',
            action_send: 'Send',
            action_remind: 'Remind',
            action_verify: 'Verify',
            action_download: 'Download',
            action_edit: 'Edit',
            action_copy_link: 'Copy Link',
            action_preview: 'Preview',
            action_unsign: 'Unsign',
            action_delete: 'Delete',
            no_contracts: 'No verified contracts currently',
            no_results: 'No search results',
            verify_now: 'Verify Now',
            confirm_verify: 'Confirm contract verification?',
            verified_success: '✅ Contract verified successfully',
            unknown: 'Unknown',
            // Navigation
            nav_dashboard: 'Dashboard',
            nav_students: 'Students',
            nav_contracts: 'Contracts',
            nav_settings: 'Settings',
            // Buttons & UI
            btn_new_student: 'New Student',
            btn_delete_selected: 'Delete Selected',
            btn_save: 'Save',
            btn_cancel: 'Cancel',
            btn_close: 'Close',
            search_placeholder: 'Search...',
            // Dropdowns
            select_level: 'Select Level',
            select_grade: 'Select Grade',
            filter_level_all: 'Level: All',
            filter_grade_all: 'Grade: All',
            // Messages
            msg_no_pending: '✨ Great! No pending contracts.',
            msg_no_students: 'No students registered.',
            msg_confirm_delete: 'Are you sure you want to permanently delete this student?',
            msg_select_students: '⚠️ Please select students to delete.'
        }
    }
};

// Database Management using LocalStorage
class DatabaseManager {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem('students')) {
            localStorage.setItem('students', JSON.stringify([]));
        }
        if (!localStorage.getItem('contracts')) {
            localStorage.setItem('contracts', JSON.stringify([]));
        }
        if (!localStorage.getItem('appSettings')) {
            localStorage.setItem('appSettings', JSON.stringify({
                schoolStampText: 'مدارس دانة العلوم - الإدارة',
                levels: ['الطفولة المبكرة', 'رياض أطفال', 'الابتدائية', 'المتوسطة', 'الثانوية'],
                grades: ['مستوى أول', 'مستوى ثاني', 'مستوى ثالث', 'الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع', 'الصف الخامس', 'الصف السادس', 'الأول متوسط', 'الثاني متوسط', 'الثالث متوسط', 'الأول ثانوي', 'الثاني ثانوي', 'الثالث ثانوي'],
                adminUsername: 'admin',
                adminPassword: 'admin',
                schoolLogo: '', // Base64 string
                schoolPhone: '966590000000' // Default contact
            }));
        }

        // Initialize Cloud Sync if available
        if (typeof CloudDB !== 'undefined' && typeof isFirebaseConfigured !== 'undefined' && isFirebaseConfigured) {
            console.log('☁️ Connecting to Firebase...');
            this.updateCloudStatus('connecting');

            // Monitor actual connection state
            CloudDB.monitorConnection((isConnected) => {
                if (!isConnected) {
                    // Only show connecting if we are not already in error state
                    console.log('🔥 Disconnected from Firebase');
                }
            });

            CloudDB.listenForUpdates(remoteStudents => {
                this.updateCloudStatus('online');
                this.mergeRemoteData(remoteStudents);
            }, (error) => {
                console.error("Sync Error:", error);
                this.updateCloudStatus('offline');
                if (typeof UI !== 'undefined' && UI.showNotification) {
                    let msg = error.code === 'PERMISSION_DENIED' ? 'خطأ: لا تملك صلاحية الوصول (تحقق من Rules)' : 'خطأ في المزامنة';
                    UI.showNotification('⚠️ ' + msg);
                }
            });

            // NEW: Run a health check to verify permissions
            CloudDB.runHealthCheck().then(result => {
                if (result.success) {
                    console.log('✅ Firebase Health Check Passed. Permissions are OK.');
                    // The listenForUpdates will handle the 'online' status
                }
            }).catch(error => {
                console.error('🔥 Firebase Health Check FAILED:', error);
                this.updateCloudStatus('offline');
                if (error.code === 'PERMISSION_DENIED') {
                    UI.showPermanentError(
                        'فشل الاتصال بالسحابة: صلاحيات الوصول مرفوضة',
                        'يبدو أن قواعد الأمان (Security Rules) في Firebase قد انتهت صلاحيتها. هذا يمنع المزامنة وعمل فورم جوجل. يرجى الذهاب إلى لوحة تحكم Firebase وتحديث القواعد.'
                    );
                }
            });

            // Check connectivity
            setTimeout(() => {
                if (!CloudDB.isReady()) {
                    this.updateCloudStatus('offline');
                }
            }, 5000);

            if (!sessionStorage.getItem('initialSyncDone')) {
                const localStudents = this.getStudents();
                const localTemplates = JSON.parse(localStorage.getItem('contractTemplates') || '[]');

                CloudDB.getStudents().then(cloudStudents => {
                    if (cloudStudents.length === 0 && localStudents.length > 0) {
                        console.log('☁️ Syncing students to new cloud...');
                        CloudDB.syncLocalToCloud();
                    }
                });

                CloudDB.getContractTemplates().then(cloudTemplates => {
                    if (cloudTemplates.length === 0 && localTemplates.length > 0) {
                        console.log('☁️ Syncing templates to new cloud...');
                        localTemplates.forEach(t => CloudDB.saveContractTemplate(t));
                    }
                });

                sessionStorage.setItem('initialSyncDone', 'true');
            }

            CloudDB.getSettings().then(cloudSettings => {
                const localSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                if (!cloudSettings && Object.keys(localSettings).length > 5) {
                    console.log('☁️ Syncing settings to new cloud...');
                    CloudDB.saveSettings(localSettings);
                } else if (cloudSettings) {
                    console.log('☁️ Settings synced from cloud');
                    localStorage.setItem('appSettings', JSON.stringify(cloudSettings));
                    if (typeof UI !== 'undefined' && UI.applyBranding) UI.applyBranding();
                }
            });

        }
    }

    updateCloudStatus(status) {
        const dot = document.getElementById('cloudStatusDot');
        const text = document.getElementById('cloudStatusText');
        const settingsBadge = document.getElementById('cloudStatusSettings');

        let color = '#94a3b8';
        let label = 'غير معروف';
        let badgeClass = 'status-badge';

        switch (status) {
            case 'online':
                color = '#10b981';
                label = 'متصل سحابياً';
                badgeClass += ' status-verified'; // Green style
                break;
            case 'connecting':
                color = '#f59e0b';
                label = 'جاري المزامنة...';
                badgeClass += ' status-pending'; // Orange style
                break;
            case 'offline':
                color = '#ef4444';
                label = 'غير متصل (محلي)';
                badgeClass += ' status-sent'; // Red/Gray style (using sent for now or custom)
                break;
            case 'disabled':
                color = '#94a3b8';
                label = 'السحابة معطلة';
                break;
        }

        // Update Navbar
        if (dot) dot.style.background = color;
        if (text) text.textContent = label;

        // Update Settings Page Badge
        if (settingsBadge) {
            settingsBadge.textContent = label;
            settingsBadge.className = badgeClass;
            // Manual override for offline/disabled colors if needed
            if (status === 'offline') settingsBadge.style.backgroundColor = '#fee2e2';
            if (status === 'offline') settingsBadge.style.color = '#991b1b';
        }
    }

    mergeRemoteData(remoteStudents) {
        if (!remoteStudents || !Array.isArray(remoteStudents)) return;
        const localStudents = this.getStudents();
        let hasChanges = false;
        remoteStudents.forEach(remote => {
            const localIdx = localStudents.findIndex(l => String(l.id) === String(remote.id));
            if (localIdx === -1) {
                localStudents.push(remote);
                hasChanges = true;
            } else {
                const local = localStudents[localIdx];
                if (JSON.stringify(local) !== JSON.stringify(remote)) {
                    // Check if status changed to 'signed' remotely
                    if (local.contractStatus !== 'signed' && remote.contractStatus === 'signed') {
                        if (typeof UI !== 'undefined' && UI.showNotification) {
                            UI.showNotification(`🔔 تم توقيع عقد جديد: ${remote.studentName}`);
                        }
                    }
                    localStudents[localIdx] = remote;
                    hasChanges = true;
                }
            }
        });
        if (hasChanges) {
            localStorage.setItem('students', JSON.stringify(localStudents));
            if (typeof UI !== 'undefined' && UI.refreshData) UI.refreshData();
        }
    }

    getSettings() {
        const defaults = {
            schoolStampText: 'مدارس دانة العلوم - الإدارة',
            levels: ['الطفولة المبكرة', 'رياض أطفال', 'الابتدائية', 'المتوسطة', 'الثانوية'],
            grades: ['مستوى أول', 'مستوى ثاني', 'مستوى ثالث', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
            adminUsername: 'admin',
            adminPassword: 'admin',
            schoolLogo: '',
            schoolPhone: '966590000000',
            serverAddress: '',
            customFields: [ // Default custom fields
                { id: 'nationalId', label: 'رقم الهوية', type: 'number' }
            ],
            nationalContractId: null, // ID for the national track contract
            diplomaContractId: null,   // ID for the diploma track contract
            smsConfig: { url: '', enabled: false, messageTemplate: 'عقد الطالب {student}: {link}' }
        };
        try {
            const savedRaw = localStorage.getItem('appSettings');
            if (!savedRaw) return defaults;
            const saved = JSON.parse(savedRaw);

            // Deduplicate Levels and Grades
            if (saved.levels) saved.levels = [...new Set(saved.levels)];
            if (saved.grades) saved.grades = [...new Set(saved.grades)];

            // Ensure National ID exists in customFields if not present
            const currentFields = saved.customFields || [];
            const hasNationalId = currentFields.some(f => f.label.includes('الهوية') || f.id === 'nationalId');

            if (!hasNationalId) {
                // If it's a legacy save, we might want to merge defaults or just leave it. 
                // But user explicitly asked for valid ID, so let's ensure the pattern exists.
                // We won't force-push it if the user deleted it, but for now let's make it available if customFields is empty.
                if (currentFields.length === 0) {
                    saved.customFields = defaults.customFields;
                }
            }

            return { ...defaults, ...saved };
        } catch (e) {
            return defaults;
        }
    }

    saveSettings(settings) {
        localStorage.setItem('appSettings', JSON.stringify(settings));
        // ADDED: Sync settings to the cloud so Google Forms can read them
        if (typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
            CloudDB.saveSettings(settings);
            console.log('☁️ Attempting to sync settings to the cloud...');
        }
    }

    getStudents() {
        return JSON.parse(localStorage.getItem('students') || '[]');
    }

    saveStudent(student) {
        const students = this.getStudents();
        const existingIndex = students.findIndex(s => s.id === student.id);
        if (student.id && existingIndex !== -1) {
            students[existingIndex] = { ...students[existingIndex], ...student };
        } else {
            if (!student.id) student.id = Date.now().toString();
            if (!student.contractStatus) student.contractStatus = 'pending';
            if (!student.createdAt) student.createdAt = new Date().toISOString();
            students.push(student);
        }
        localStorage.setItem('students', JSON.stringify(students));
        if (typeof CloudDB !== 'undefined') CloudDB.saveStudent(student);
        return student;
    }

    deleteStudent(id) {
        console.log('🗑️ Attempting to delete student with ID:', id);
        try {
            const students = this.getStudents();
            const initialCount = students.length;
            // Use String() to avoid type mismatch (e.g., number vs string)
            const filtered = students.filter(s => String(s.id) !== String(id));

            if (filtered.length === initialCount) {
                console.warn('⚠️ No student found with ID:', id);
            }

            localStorage.setItem('students', JSON.stringify(filtered));
            if (typeof CloudDB !== 'undefined') CloudDB.deleteStudent(id);
            return true;
        } catch (error) {
            console.error('❌ Error deleting student:', error);
            return false;
        }
    }

    updateStudentStatus(id, status) {
        const students = this.getStudents();
        const idx = students.findIndex(s => s.id === id);
        if (idx !== -1) {
            students[idx].contractStatus = status;
            localStorage.setItem('students', JSON.stringify(students));
            if (typeof CloudDB !== 'undefined') {
                CloudDB.updateContract(id, { contractStatus: status });
            }
            return true;
        }
        return false;
    }

    getStats() {
        const students = this.getStudents();
        return {
            total: students.length,
            signed: students.filter(s => s.contractStatus === 'signed' || s.contractStatus === 'verified').length,
            pending: students.filter(s => s.contractStatus === 'pending').length,
            sent: students.filter(s => s.contractStatus === 'sent').length
        };
    }
}

// Select All Contracts Checkbox (Signed Contracts Tab)
const selectAllContractsCheckbox = document.getElementById('selectAllContracts');
if (selectAllContractsCheckbox) {
    selectAllContractsCheckbox.addEventListener('change', function () {
        const checkboxes = document.querySelectorAll('.contract-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = this.checked;
        });
    });
}

// UI Management
const UI = {
    modal: document.getElementById('newStudentModal'),
    studentForm: document.getElementById('studentForm'),
    tableBody: document.getElementById('studentsTableBody'),
    currentSort: { field: 'createdAt', order: 'desc' },

    handleSelectionChange() {
        const dashboardChecks = document.querySelectorAll('#studentsTableBody .student-checkbox:checked');
        const mainChecks = document.querySelectorAll('#allStudentsTableBody .student-checkbox:checked');

        const dashBtn = document.getElementById('deleteSelectedBtn');
        const dashCount = document.getElementById('selectedCount');
        const mainBtn = document.getElementById('deleteSelectedBtnMain');
        const mainCount = document.getElementById('selectedCountMain');

        if (dashBtn && dashCount) {
            dashCount.textContent = dashboardChecks.length;
            dashBtn.style.display = dashboardChecks.length > 0 ? 'inline-flex' : 'none';
        }

        const bulkActions = document.getElementById('bulkActions');
        if (mainBtn && mainCount && bulkActions) {
            const count = mainChecks.length;
            mainCount.textContent = count;
            bulkActions.style.display = count > 0 ? 'flex' : 'none';
        }
    },

    bulkUpdateStatus(status) {
        const checks = document.querySelectorAll('.student-checkbox:checked');
        const ids = Array.from(checks).map(cb => cb.value);
        if (ids.length === 0) return;

        const statusText = status === 'sent' ? 'مرسل' : 'موثق';
        if (confirm(`هل تريد تغيير حالة ${ids.length} طلاب إلى (${statusText})؟`)) {
            ids.forEach(id => db.updateStudentStatus(id, status));
            this.renderStudents();
            this.updateStats();
            this.showNotification(`✅ تم تحديث حالة ${ids.length} طلاب`);
        }
    },

    deleteStudent(id) {
        if (confirm('هل أنت متأكد من حذف هذا الطالب نهائياً؟')) {
            db.deleteStudent(id);
            this.renderStudents();
            this.updateStats();
            this.showNotification('✅ تم حذف الطالب بنجاح');
        }
    },

    deleteSelectedStudents() {
        // Collect all checked IDs from both possible tables
        const checks = document.querySelectorAll('.student-checkbox:checked');
        const ids = Array.from(checks).map(cb => cb.value);

        if (ids.length === 0) {
            this.showNotification(Lang.t('msg_select_students'));
            return;
        }

        if (confirm(`هل أنت متأكد من حذف ${ids.length} طلاب؟`)) {
            console.log('🗑️ Bulk deleting IDs:', ids);
            ids.forEach(id => db.deleteStudent(id));
            this.renderStudents();
            this.updateStats();
            this.showNotification(`✅ تم حذف ${ids.length} طلاب بنجاح`);

            // Uncheck header checkboxes
            const headers = document.querySelectorAll('input[type="checkbox"][id^="selectAll"]');
            headers.forEach(h => h.checked = false);
        }
    },

    openModal() {
        const title = document.getElementById('modalTitle');
        if (title) title.textContent = Lang.current === 'en' ? 'Register New Student' : 'تسجيل طالب جديد';

        const form = document.getElementById('studentForm');
        if (form) {
            form.reset();
            form.removeAttribute('data-editing-id');
        }

        const sendMethod = document.getElementById('sendMethod');
        if (sendMethod) sendMethod.value = 'whatsapp';

        this.renderStudentFormFields(); // Render empty fields for new student
        this.showModal();
    },

    autoSelectContract() {
        const trackSelect = document.getElementById('studentTrack');
        const contractSelect = document.getElementById('contractTemplate');
        if (!trackSelect || !contractSelect) return;

        const selectedTrack = trackSelect.value;
        if (!selectedTrack) return;

        // Ensure contracts are populated in the dropdown before selecting
        if (contractSelect.options.length <= 1) {
            this.populateDynamicSelects();
        }

        const settings = db.getSettings();
        let contractToSelect = '';

        // Resilient matching logic
        const isDiploma = selectedTrack.includes('دبلوما') || selectedTrack.includes('دبلوم') || /diploma/i.test(selectedTrack);
        const isNational = selectedTrack.includes('أهلي') || selectedTrack.includes('ثنائي') || selectedTrack.includes('عام') || /national|bilingual/i.test(selectedTrack);

        if (isDiploma) {
            contractToSelect = settings.diplomaContractId;
        } else if (isNational) {
            contractToSelect = settings.nationalContractId;
        }

        if (!contractToSelect) {
            console.warn('No contract ID mapped in settings for:', selectedTrack);
            // Don't show an annoying alert every time, just a small notice or log
            return;
        }

        // Try to select
        const option = contractSelect.querySelector(`option[value="${contractToSelect}"]`);
        if (option) {
            contractSelect.value = contractToSelect;
            this.showNotification(`✅ تم ربط العقد تلقائياً: ${option.text}`);
        } else {
            // Fallback: Re-populate and try once more if not found
            this.populateContractTemplates();
            const retryOption = contractSelect.querySelector(`option[value="${contractToSelect}"]`);
            if (retryOption) {
                contractSelect.value = contractToSelect;
            } else {
                UI.showNotification(`⚠️ تنبيه: العقد المربوط بالمسار غير متوفر حالياً.`);
            }
        }
    },

    showModal() {
        if (this.modal) {
            this.modal.classList.add('active');
            this.modal.style.display = 'flex';
        }
    },

    openImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.classList.add('active');
            modal.style.display = 'flex';
        }
    },

    closeImportModal() {
        const modal = document.getElementById('importModal');
        if (modal) {
            modal.classList.remove('active');
            modal.style.display = 'none';
        }
    },

    closeModal() {
        if (this.modal) {
            this.modal.classList.remove('active');
            this.modal.style.display = 'none';
        }
    },

    updateStats() {
        if (!document.getElementById('totalStudents')) return;
        const stats = db.getStats();
        // Animate numbers
        const animateValue = (id, start, end, duration) => {
            const obj = document.getElementById(id);
            if (!obj) return;
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                obj.innerHTML = Math.floor(progress * (end - start) + start);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        };

        animateValue("totalStudents", 0, stats.total, 1000);
        animateValue("signedContracts", 0, stats.signed, 1000);
        animateValue("pendingContracts", 0, stats.pending, 1000);
        animateValue("sentContracts", 0, stats.sent, 1000);

        if (this.initCharts) this.initCharts();
    },

    charts: { stats: null, dist: null },

    initCharts() {
        const canvas1 = document.getElementById('statsChart');
        const canvas2 = document.getElementById('distributionChart');
        if (!canvas1 || !canvas2 || typeof Chart === 'undefined') return;

        const stats = db.getStats();
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? '#334155' : '#e2e8f0';

        // Cleanup existing charts
        if (this.charts.stats) this.charts.stats.destroy();
        if (this.charts.dist) this.charts.dist.destroy();

        const ctx1 = canvas1.getContext('2d');
        this.charts.stats = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: ['إجمالي الطلاب', 'موقعة', 'انتظار', 'مرسلة'],
                datasets: [{
                    label: 'العدد',
                    data: [stats.total, stats.signed, stats.pending, stats.sent],
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { grid: { color: gridColor }, ticks: { color: textColor, precision: 0 } },
                    x: { grid: { display: false }, ticks: { color: textColor } }
                }
            }
        });

        const ctx2 = canvas2.getContext('2d');
        this.charts.dist = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['موقعة', 'أخرى'],
                datasets: [{
                    data: [stats.signed, Math.max(0, stats.total - stats.signed)],
                    backgroundColor: ['#10b981', '#e2e8f0'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor, font: { family: 'Cairo', size: 12 }, padding: 20 }
                    }
                }
            }
        });
    },

    renderStudents(filteredStudents = null) {
        const students = filteredStudents || db.getStudents();

        // 1. Dashboard Table (Action Needed - Pending Contracts)
        if (this.tableBody) {
            this.tableBody.innerHTML = '';
            // Filter for pending/sent contracts ONLY
            const pendingStudents = students.filter(s => s.contractStatus === 'pending' || s.contractStatus === 'sent' || !s.contractStatus);

            const displayStudents = [...pendingStudents]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5);

            if (displayStudents.length === 0) {
                this.tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #10b981; font-weight:bold;">${Lang.t('msg_no_pending')}</td></tr>`;
            } else {
                displayStudents.forEach(student => {
                    const row = document.createElement('tr');
                    row.innerHTML = this.renderRow(student, false, 'dash'); // Prefix 'dash' prevents ID collision
                    this.tableBody.appendChild(row);
                });
            }
        }

        // 2. All Students Table
        const allTableBody = document.getElementById('allStudentsTableBody');
        if (allTableBody) {
            allTableBody.innerHTML = '';
            if (students.length === 0) {
                allTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">${Lang.t('msg_no_students')}</td></tr>`;
            } else {
                students.forEach(student => {
                    const row = document.createElement('tr');
                    row.innerHTML = this.renderRow(student, true, 'all'); // Prefix 'all' prevents ID collision
                    allTableBody.appendChild(row);
                });
            }
        }

        // Update counts
        const filteredCountEl = document.getElementById('filteredCount');
        if (filteredCountEl) filteredCountEl.textContent = students.length;

        // Update selection buttons status
        this.handleSelectionChange();

        // 3. Contracts Page Table
        this.renderSignedContracts();
    },

    renderSignedContracts(searchTerm = '') {
        const contractsTableBody = document.getElementById('signedContractsTableBody');
        if (!contractsTableBody) return;

        let students = db.getStudents().filter(s => s.contractStatus === 'signed' || s.contractStatus === 'verified');

        // Apply search filter
        if (searchTerm) {
            students = students.filter(s =>
                s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.parentName?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        contractsTableBody.innerHTML = '';

        if (students.length === 0) {
            const message = searchTerm ? Lang.t('no_results') : Lang.t('no_contracts');
            contractsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px;">${message}</td></tr>`;
            return;
        }

        students.sort((a, b) => new Date(b.signedAt || 0) - new Date(a.signedAt || 0)).forEach(student => {
            const row = document.createElement('tr');
            const statusBadge = this.getStatusBadge(student.contractStatus);
            const date = student.signedAt ? new Date(student.signedAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : '-';

            row.innerHTML = `
                <td><input type="checkbox" class="contract-checkbox" value="${student.id}"></td>
                <td><div style="font-weight: bold;">${student.studentName}</div></td>
                <td>${student.parentName || '-'}</td>
                <td>${date}</td>
                <td>${statusBadge}</td>
                <td>
                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                        ${student.contractStatus === 'signed' ? `
                            <button class="btn-icon" onclick="markAsSigned('${student.id}')" title="${Lang.t('verify_now')}" style="color: #38b2ac;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </button>` : ''}
                        <button class="btn-icon" onclick="UI.previewContract('${student.id}')" title="${Lang.t('action_preview')}" style="color: #3b82f6;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="btn-icon" onclick="UI.downloadContractPdf('${student.id}')" title="${Lang.t('action_download')}" style="color: #f59e0b;">
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </button>
                    </div>
                </td>
            `;
            contractsTableBody.appendChild(row);
        });
    },

    renderRow(student, withCheckbox, prefix = 'all') {
        const statusBadge = this.getStatusBadge(student.contractStatus);

        // Fix for Checkbox column
        const checkboxHtml = withCheckbox ?
            `<td><input type="checkbox" class="student-checkbox" value="${student.id}" onchange="UI.handleSelectionChange()"></td>` :
            `<td>-</td>`;

        // Verification Button (Green) - only for 'signed' status
        const verifyBtn = student.contractStatus === 'signed' ? `
            <button class="btn-icon" onclick="markAsSigned('${student.id}')" title="${Lang.t('action_verify')}" style="color: #38b2ac;">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            </button>
        ` : '';

        // Determine visibility of icons based on status
        const isNotSigned = student.contractStatus === 'pending' || student.contractStatus === 'sent';
        const isSigned = student.contractStatus === 'signed' || student.contractStatus === 'verified';

        // Column Logic:
        // Dashboard (withCheckbox=false): Name & Level combined | 7 Columns Total
        // All Students (withCheckbox=true): Name separate, Level separate | 8 Columns Total

        const nameCell = withCheckbox ?
            `<td><div style="font-weight: bold;">${student.studentName}</div></td>` :
            `<td>
                <div style="font-weight: bold;">${student.studentName}</div>
                <div style="font-size: 0.75rem; color: #718096;">${student.studentLevel || '-'} (${student.studentGrade || '-'})</div>
            </td>`;

        const levelCell = withCheckbox ?
            `<td>${student.studentLevel || '-'} (${student.studentGrade || '-'})</td>` :
            '';

        const menuId = `action-menu-${prefix}-${student.id}`;
        return `
            ${checkboxHtml}
            <td><div style="font-weight: bold;">${student.studentName}</div></td>
            <td>${student.customFields?.studentTrack || student.studentTrack || '-'}</td>
            <td>${student.studentLevel || '-'}</td>
            <td>${student.studentGrade || '-'}</td>
            <td>${student.customFields?.nationalId || '-'}</td>
            <td>${student.parentName || '-'}</td>
            <td style="font-size: 0.85rem;">${student.parentEmail || '-'}</td>
            <td>${student.customFields?.parentNationalId || student.customFields?.motherNationalId || '-'}</td>
            <td dir="ltr" style="font-size: 0.85rem;">${student.parentWhatsapp || '-'}</td>
            <td>${statusBadge}</td>
            <td>
                <div class="action-group">
                    ${(() => {
                // Determine Primary Action
                if (student.contractStatus === 'pending') {
                    return `<button class="action-btn-main send" onclick="UI.sendContract('${student.id}')" title="${Lang.t('action_send')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                ${Lang.t('action_send')}
                            </button>`;
                } else if (student.contractStatus === 'sent') {
                    return `<button class="action-btn-main remind" onclick="UI.remindParent('${student.id}')" title="${Lang.t('action_remind')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                ${Lang.t('action_remind')}
                            </button>`;
                } else if (student.contractStatus === 'signed') {
                    return `<button class="action-btn-main verify" onclick="markAsSigned('${student.id}')" title="${Lang.t('action_verify')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                ${Lang.t('action_verify')}
                            </button>`;
                } else {
                    // Verified
                    return `<button class="action-btn-main verify" onclick="UI.downloadContractPdf('${student.id}')" title="${Lang.t('action_download')}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                ${Lang.t('action_download')}
                            </button>`;
                }
            })()}
                    
                    <div style="position: relative;">
                        <button class="action-dropdown-toggle" onclick="UI.toggleActionMenu(event, '${student.id}', '${prefix}')">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                        <div id="${menuId}" class="action-dropdown-menu">
                            <button class="action-dropdown-item" onclick="UI.editStudent('${student.id}')">
                                <span style="width:20px">✏️</span> ${Lang.t('action_edit')}
                            </button>
                            
                            ${student.contractStatus !== 'signed' && student.contractStatus !== 'verified' ? `
                            <button class="action-dropdown-item" onclick="UI.copyContractLink('${student.id}')">
                                <span style="width:20px">🔗</span> ${Lang.t('action_copy_link')}
                            </button>
                            ` : ''}

                            ${student.contractStatus === 'signed' || student.contractStatus === 'verified' ? `
                            <button class="action-dropdown-item" onclick="UI.previewContract('${student.id}')">
                                <span style="width:20px">👁️</span> ${Lang.t('action_preview')}
                            </button>
                            <button class="action-dropdown-item" onclick="UI.deleteSignedContent('${student.id}')" style="color:#d97706">
                                <span style="width:20px">↩️</span> ${Lang.t('action_unsign')}
                            </button>
                            ` : ''}

                            <div style="border-top:1px solid #f1f5f9; margin:4px 0;"></div>
                            
                            <button class="action-dropdown-item delete" onclick="UI.deleteStudent('${student.id}')">
                                <span style="width:20px">🗑️</span> ${Lang.t('action_delete')}
                            </button>
                        </div>
                    </div>
                </div>
            </td>
        `;
    },

    toggleActionMenu(event, id, prefix) {
        event.stopPropagation();
        const menuId = `action-menu-${prefix}-${id}`;
        const menu = document.getElementById(menuId);
        if (!menu) return;

        const wasActive = menu.classList.contains('active');

        // Close all first
        document.querySelectorAll('.action-dropdown-menu').forEach(m => {
            m.classList.remove('active');
            m.style.display = 'none';
        });

        if (!wasActive) {
            const btn = event.currentTarget;
            const rect = btn.getBoundingClientRect();
            const viewportWidth = document.documentElement.clientWidth;

            // 1. Show momentarily to calculate dimensions
            menu.style.display = 'flex';
            menu.style.visibility = 'hidden';
            menu.style.position = 'fixed';

            // 2. Calculate vertical position (Smart Direction)
            const menuHeight = menu.offsetHeight || 200;
            const spaceBelow = window.innerHeight - rect.bottom;

            // Check if we should open UPWARDS
            if (spaceBelow < menuHeight && rect.top > menuHeight) {
                menu.style.top = (rect.top - menuHeight - 5) + 'px';
                menu.style.transformOrigin = 'bottom right';
            } else {
                // Open Downwards (Default)
                menu.style.top = (rect.bottom + 5) + 'px';
                menu.style.transformOrigin = 'top right';
            }

            // 3. Calculate horizontal position
            if (rect.left < 250) {
                // Too close to left edge? Open towards right
                menu.style.left = rect.left + 'px';
                menu.style.right = 'auto';
            } else {
                // Default: Open towards left (align right edge)
                const rightDist = viewportWidth - rect.right;
                menu.style.left = 'auto';
                menu.style.right = rightDist + 'px';
            }

            // 4. Finalize display
            menu.style.zIndex = '99999999';
            menu.style.visibility = 'visible';
            menu.classList.add('active');
        }
    },

    deleteSignedContent(id) {
        if (confirm('هل أنت متأكد من إلغاء توقيع هذا الطالب؟ سيتم مسح بيانات التوقيع وإعادة الحالة إلى "قيد الانتظار".')) {
            const student = db.getStudents().find(s => s.id === id);
            if (student) {
                student.contractStatus = 'pending';
                student.signature = null;
                student.signedAt = null;
                student.contractNo = null;
                student.idImage = null;
                db.saveStudent(student);
                this.renderStudents();
                this.updateStats();
                this.showNotification('✅ تم إلغاء التوقيع بنجاح');
            }
        }
    },

    getStatusBadge(status) {
        const badges = {
            'pending': `<span class="status-badge status-pending">${Lang.t('status_pending')}</span>`,
            'sent': `<span class="status-badge status-sent">${Lang.t('status_sent')}</span>`,
            'signed': `<span class="status-badge status-signed">${Lang.t('status_signed')}</span>`,
            'verified': `<span class="status-badge status-verified">${Lang.t('status_verified')}</span>`
        };
        return badges[status] || `<span class="status-badge">${Lang.t('unknown')}</span>`;
    },
    generateContractLink(student) {
        const settings = db.getSettings();
        let basePath = settings.serverAddress || window.location.href.split('?')[0].replace('index.html', '').replace(/\/$/, '');

        // Ensure protocol exists (defaults to https for production security)
        if (basePath && !basePath.includes('://')) {
            basePath = 'https://' + basePath;
        }

        // Remove trailing slash if present
        basePath = basePath.replace(/\/$/, '');

        // Hostname check for warning (only if not using a custom server address)
        const isLocal = !settings.serverAddress && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:');

        // Get contract template content
        const templateId = student.contractTemplateId;
        let template = null;
        if (typeof contractMgr !== 'undefined') {
            template = contractMgr.getContract(templateId) || contractMgr.getDefaultContract();
        } else {
            const tmpls = JSON.parse(localStorage.getItem('contractTemplates') || '[]');
            template = tmpls.find(c => c.id === templateId) || tmpls.find(c => c.isDefault);
        }

        // Ensure contract data is in the cloud as a fallback
        if (template && typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
            CloudDB.updateContract(student.id, {
                contractTitle: template.title,
                contractContent: template.content,
                contractType: template.type || 'text'
            });
        }

        const dataToCompress = {
            i: student.id,
            s: student.studentName,
            l: student.studentLevel,
            g: student.studentGrade,
            p: student.parentName,
            e: student.parentEmail,
            w: student.parentWhatsapp,
            y: student.contractYear || new Date().getFullYear().toString(),
            tid: student.contractTemplateId || '',
            // Added new fields
            nid: student.customFields?.nationalId || student.nationalId || '',
            pnid: student.customFields?.parentNationalId || '',
            adr: student.address || student.customFields?.address || '',
            nat: student.nationality || student.customFields?.nationality || ''
        };

        // If it's a text contract, include content
        if (template && template.type !== 'pdf_template') {
            dataToCompress.t = template.title;
            dataToCompress.c = template.content;
        }

        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(dataToCompress));
        const link = `${basePath}/contract.html?id=${student.id}&c=${compressed}`;

        return { link, isLocal, isTooLong: link.length > 4000 };
    },

    copyContractLink(id) {
        const student = db.getStudents().find(s => s.id === id);
        if (!student) return;

        const { link, isLocal, isTooLong } = this.generateContractLink(student);

        if (isLocal) {
            this.showNotification('⚠️ تنبيه: أنت تستخدم رابطاً محلياً، لن يفتح على أجهزة أخرى.');
        }

        if (isTooLong) {
            alert('⚠️ تنبيه: نص العقد طويل جداً وقد لا يعمل الرابط بشكل سليم على بعض الهواتف.');
        }

        navigator.clipboard.writeText(link).then(() => {
            this.showNotification('✅ تم نسخ رابط العقد!');
        }).catch(() => {
            const el = document.createElement('textarea');
            el.value = link;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
            this.showNotification('✅ تم نسخ الرابط!');
        });
    },

    // sendContract is defined later in the file with more features

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    },

    showPermanentError(title, message) {
        let errorBanner = document.getElementById('permanentErrorBanner');
        if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.id = 'permanentErrorBanner';
            errorBanner.style.cssText = `
                background: #fef2f2;
                color: #991b1b;
                padding: 1rem;
                border-bottom: 4px solid #ef4444;
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                z-index: 100000;
                text-align: center;
                font-family: 'Cairo', sans-serif;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            `;
            document.body.prepend(errorBanner);
        }
        errorBanner.innerHTML = `
            <div style="position: relative; max-width: 800px; margin: 0 auto; padding-right: 30px;">
                <button onclick="this.parentElement.parentElement.style.display='none'" style="position: absolute; right: -10px; top: -5px; background: none; border: none; font-size: 24px; cursor: pointer; color: #991b1b;">&times;</button>
                <h3 style="margin: 0 0 0.2rem 0; font-size: 1.1rem; font-weight: bold;">${title}</h3>
                <p style="margin: 0; font-size: 0.85rem; opacity: 0.9;">${message}</p>
            </div>
        `;
        errorBanner.style.display = 'block';
    },
    async downloadContractPdf(id) {
        const student = db.getStudents().find(s => s.id === id);
        if (!student) return;

        // Determine Contract Type
        const templateId = student.contractTemplateId;
        let template = templateId ? contractMgr.getContract(templateId) : null;
        if (!template) template = contractMgr.getDefaultContract();

        if (!template) {
            this.showNotification('⚠️ عذراً، لم يتم العثور على قالب العقد لهذا الطالب');
            return;
        }

        if (template && template.type === 'pdf_template') {
            this.showNotification('جاري إنشاء ملف PDF...');
            try {
                const pdfBytes = await contractMgr.generatePdfFromTemplate(template, student);
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = `عقد_${student.studentName}.pdf`;
                link.click();
            } catch (err) {
                console.error("PDF Generation Error:", err);
                alert("حدث خطأ أثناء إنشاء ملف PDF: " + err.message);
            }
            return;
        }

        // Use professional HTML to PDF layout (Harmonized with contract.js)
        // High-Visibility Flash Capture (ENSURES RENDERING)
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'white';
        overlay.style.zIndex = '100000';
        overlay.style.display = 'block'; // FIX: Changed from flex to block
        overlay.style.textAlign = 'center';
        overlay.style.overflowY = 'auto';
        overlay.style.padding = '40px 0';
        overlay.style.direction = 'rtl';
        overlay.innerHTML = `
            <div style="margin-bottom:20px; font-weight:bold; color:#1e3a8a; font-family:Cairo, sans-serif; font-size:18px;">جاري استخراج ملف PDF...</div>
            <div id="capture-render-area" style="background:white; pointer-events:none; direction:rtl; text-align:right;">
                ${this.getContractSummaryHTML(student)}
            </div>
        `;
        document.body.appendChild(overlay);

        const captureArea = overlay.querySelector('#capture-render-area');
        const opt = {
            margin: [15, 15, 15, 15],  // Equal margins on all sides
            filename: `عقد_${student.studentName}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: true,
                scrollY: 0,
                scrollX: 0,
                width: 794,
                windowWidth: 794,
                backgroundColor: '#ffffff',
                letterRendering: true  // Better text rendering
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: {
                mode: ['avoid-all', 'css', 'legacy'],
                before: '.page-break-before'
            }
        };

        if (window.html2pdf) {
            // Delay to ensure all fonts and graphics are PAINTED
            setTimeout(() => {
                html2pdf().from(captureArea).set(opt).toPdf().get('pdf').then((pdf) => {
                    const totalPages = pdf.internal.getNumberOfPages();
                    for (let i = 1; i <= totalPages; i++) {
                        pdf.setPage(i);
                        pdf.setDrawColor(30, 58, 138); // #1e3a8a
                        pdf.setLineWidth(0.5);
                        pdf.rect(5, 5, 200, 287);
                        pdf.setLineWidth(1.5);
                        pdf.rect(7, 7, 196, 283);
                    }
                }).save().then(() => {
                    document.body.removeChild(overlay);
                    this.showNotification('✅ تم تحميل العقد بنجاح');
                }).catch(err => {
                    console.error("PDF Error:", err);
                    document.body.removeChild(overlay);
                    this.showNotification('❌ حدث خطأ أثناء التحميل');
                    alert("نعتذر، فشل التحميل التلقائي. يرجى تجربة خيار الطباعة.");
                });
            }, 3000);
        } else {
            alert('مكتبة PDF غير محملة. الرجاء تحديث الصفحة.');
            document.body.removeChild(overlay);
        }
    },

    async generateContractPdfBlob(student) {
        // Similar to downloadContractPdf but returns Blob for ZIP bundling
        const templateId = student.contractTemplateId;
        const template = templateId ? contractMgr.getContract(templateId) : contractMgr.getDefaultContract();

        if (template && template.type === 'pdf_template') {
            const pdfBytes = await contractMgr.generatePdfFromTemplate(template, student);
            return new Blob([pdfBytes], { type: 'application/pdf' });
        }

        // Create temporary container (visible but transparent for proper rendering)
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '0';
        container.style.top = '0';
        container.style.width = '794px';
        container.style.direction = 'rtl';
        container.style.zIndex = '-9999';
        container.style.opacity = '0';
        container.style.pointerEvents = 'none';
        container.style.background = 'white';
        container.innerHTML = this.getContractSummaryHTML(student);
        document.body.appendChild(container);

        const opt = {
            margin: [15, 15, 15, 15],
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                scrollY: 0,
                scrollX: 0,
                width: 794,
                windowWidth: 794,
                backgroundColor: '#ffffff',
                letterRendering: true,
                onclone: function (clonedDoc) {
                    // Ensure cloned content is visible
                    clonedDoc.body.style.visibility = 'visible';
                }
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait',
                compress: true
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        return new Promise((resolve, reject) => {
            // Wait for images to load then generate PDF
            const images = container.querySelectorAll('img');
            const imagePromises = Array.from(images).map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(r => {
                    img.onload = r;
                    img.onerror = r;
                });
            });

            Promise.all(imagePromises).then(() => {
                // Additional wait for fonts and rendering
                setTimeout(async () => {
                    try {
                        const pdf = await html2pdf().from(container).set(opt).toPdf().get('pdf');

                        // Add decorative borders
                        const totalPages = pdf.internal.getNumberOfPages();
                        for (let i = 1; i <= totalPages; i++) {
                            pdf.setPage(i);
                            pdf.setDrawColor(30, 58, 138);
                            pdf.setLineWidth(0.5);
                            pdf.rect(5, 5, 200, 287);
                            pdf.setLineWidth(1.5);
                            pdf.rect(7, 7, 196, 283);
                        }

                        const blob = pdf.output('blob');
                        document.body.removeChild(container);
                        resolve(blob);
                    } catch (err) {
                        document.body.removeChild(container);
                        reject(err);
                    }
                }, 500);
            });
        });
    },

    getContractSummaryHTML(student) {
        const settings = db.getSettings();
        const stampText = settings.schoolStampText || 'الإدارة';
        const schoolLogo = settings.schoolLogo || 'assets/logo.png';
        const schoolPhone = settings.schoolPhone || '---';
        const hasSignature = !!student.signature;
        const hasIdImage = !!student.idImage;
        const contractNo = student.contractNo || 'CON-ADMIN';

        // Fetch Template Content
        const templateId = student.contractTemplateId;
        let template = null;
        if (typeof contractMgr !== 'undefined') {
            template = contractMgr.getContract(templateId) || contractMgr.getDefaultContract();
        } else {
            const tmpls = JSON.parse(localStorage.getItem('contractTemplates') || '[]');
            template = tmpls.find(c => c.id === templateId) || tmpls.find(c => c.isDefault);
        }

        let contractContent = 'نص العقد غير متوفر حالياً';
        let contractTitle = 'عقد تسجيل إلكتروني';

        if (template) {
            contractTitle = template.title;
            contractContent = (typeof contractMgr !== 'undefined')
                ? contractMgr.replaceVariables(template.content, student)
                : template.content;
        }

        const stampImage = settings.stampImage || window.SCHOOL_STAMP_IMAGE;

        const stampHtml = stampImage
            ? `<div style="text-align:center; position:relative; z-index:5;"><img src="${stampImage}" style="height:110px; width:auto; max-width:150px; opacity:0.85; transform:rotate(-2deg);"></div>`
            : `<div style="width:100px; height:100px; border:3px solid #2563eb; border-radius:50%; display:flex; align-items:center; justify-content:center; position:relative; color:#2563eb; font-weight:900; transform:rotate(-15deg); background:rgba(37,99,235,0.03); margin:0 auto;"><div style="position:absolute; width:90%; height:90%; border:1px solid #2563eb; border-radius:50%;"></div><div style="font-size:11px; text-align:center; max-width:80%; line-height:1.2;">${stampText}</div></div>`;

        const idCardSection = hasIdImage ? `<img src="${student.idImage}" style="max-height:180px; max-width:90%; border:1px solid #ddd; padding:2px; border-radius:4px;">` : '';

        return `
            <div style="direction:rtl; font-family:'Cairo', sans-serif; background:white; padding:5mm 10mm; width:100%; box-sizing:border-box; color:#1a202c;">
                <div id="dynamicCustomFieldsContainer" class="form-row" style="flex-wrap: wrap; gap: 1rem;">
                    <!-- Dynamic fields will be inserted here -->
                </div>    <table style="width:100%; border-bottom:2px solid #1e3a8a; margin-bottom:40px; padding-bottom:20px;">
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

                        <!-- Contract Content -->
                        <div style="font-size:14px; line-height:1.8; margin-bottom:30px; text-align:justify; white-space:pre-wrap;">${contractContent}</div>

                        <!-- Signatures & ID Card (Integrated) -->
                        <div style="page-break-inside: avoid; border: 1px solid #edf2f7; border-radius: 12px; padding: 15px; background: #fff; margin-top: 20px;">
                            <table style="width:100%;">
                                <tr>
                                    <td style="text-align:center; width:50%; vertical-align:bottom;">
                                        <p style="font-weight:bold; margin-bottom:10px; color:#2d3748; font-size:13px;">الختم والاعتماد</p>
                                        ${stampHtml}
                                    </td>
                                    <td style="text-align:center; width:50%; vertical-align:bottom;">
                                        <p style="font-weight:bold; margin-bottom:10px; color:#2d3748; font-size:13px;">توقيع ولي الأمر</p>
                                        ${hasSignature ? `<img src="${student.signature}" style="max-height:80px; max-width:200px;">` : '<div style="height:80px; display:flex; align-items:center; justify-content:center; color:#cbd5e0;">................</div>'}
                                    </td>
                                </tr>
                            </table>

                            ${idCardSection ? `
                            <div style="margin-top:15px; border-top:1px dashed #e2e8f0; padding-top:10px; text-align:center;">
                                <p style="margin:0 0 5px; font-weight:bold; font-size:12px;">صورة هوية ولي الأمر</p>
                                ${idCardSection}
                            </div>` : ''}
                        </div>
                    </div>
                </div>`;
    },

    async previewContract(id) {
        try {
            const students = db.getStudents();
            const student = students.find(s => s.id === id);
            if (!student) throw new Error("الطالب غير موجود");

            const templateId = student.contractTemplateId;
            let template = (typeof contractMgr !== 'undefined')
                ? contractMgr.getContract(templateId) || contractMgr.getDefaultContract()
                : null;

            if (!template) {
                const tmpls = JSON.parse(localStorage.getItem('contractTemplates') || '[]');
                template = tmpls.find(c => c.id === templateId) || tmpls.find(c => c.isDefault) || tmpls[0];
            }

            if (!template) throw new Error("قالب العقد غير موجود");

            // Check for PDF Template (More robust check)
            const isPdfTemplate = (template && template.type === 'pdf_template') ||
                (template && template.content && template.content.startsWith('قالب PDF:')) ||
                (student.contractType === 'pdf_template');

            if (isPdfTemplate) {
                if (typeof UI !== 'undefined' && UI.showNotification) UI.showNotification('جاري تحضير المعاينة...');
                try {
                    const pdfBytes = await contractMgr.generatePdfFromTemplate(template, student);
                    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                    const blobUrl = window.URL.createObjectURL(blob);
                    window.open(blobUrl, '_blank');
                } catch (err) {
                    console.error("Preview Error:", err);
                    alert("حدث خطأ أثناء معاينة PDF: " + err.message);
                }
                return;
            }

            // Standard HTML Preview
            const html = this.getContractSummaryHTML(student);
            const w = window.open('', '_blank');
            if (w) {
                w.document.write(`
                    <html><head><title>معاينة العقد - ${student.studentName}</title>
                    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { background: #cbd5e0; display: flex; justify-content: center; padding: 2cm 0; margin: 0; direction: rtl; }
                        .preview-wrap { background: white; box-shadow: 0 0 20px rgba(0,0,0,0.2); width: 210mm; min-height: 297mm; }
                        @media print {
                            body { background: white; padding: 0; }
                            .preview-wrap { box-shadow: none; width: 100%; }
                        }
                    </style>
                    </head>
                    <body>
                        <div class="preview-wrap">${html}</div>
                    </body>
                    </html>
                `);
                w.document.close();
            } else {
                alert('يرجى السماح بالنوافذ المنبثقة لمعاينة العقد.');
            }
        } catch (err) {
            console.error("Preview Error:", err);
            alert("حدث خطأ أثناء معاينة العقد: " + err.message);
        }
    },

    async downloadContractPdf(id) {
        try {
            const students = db.getStudents();
            const student = students.find(s => s.id === id);
            if (!student) throw new Error("الطالب غير موجود");

            if (typeof UI.showNotification === 'function') UI.showNotification('جاري تحميل العقد...');

            const templateId = student.contractTemplateId;
            let template = (typeof contractMgr !== 'undefined')
                ? contractMgr.getContract(templateId) || contractMgr.getDefaultContract()
                : null;

            if (!template) {
                const tmpls = JSON.parse(localStorage.getItem('contractTemplates') || '[]');
                template = tmpls.find(c => c.id === templateId) || tmpls.find(c => c.isDefault) || tmpls[0];
            }

            if (!template) throw new Error("قالب العقد غير موجود");

            // Check for PDF Template
            const isPdfTemplate = (template && template.type === 'pdf_template') ||
                (template && template.content && template.content.startsWith('قالب PDF:')) ||
                (student.contractType === 'pdf_template');

            if (isPdfTemplate) {
                const pdfBytes = await contractMgr.generatePdfFromTemplate(template, student);
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });

                // Create link and download
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                const dateStr = new Date().toISOString().split('T')[0];
                link.download = `عقد-${student.studentName}-${dateStr}.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                // HTML Contract Download (Using html2pdf)
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                container.style.width = '210mm'; // A4 width
                container.style.background = 'white';
                container.innerHTML = this.getContractSummaryHTML(student);
                document.body.appendChild(container);

                // Use html2pdf
                if (typeof html2pdf === 'undefined') {
                    // Fallback to print
                    document.body.removeChild(container);
                    this.previewContract(id);
                    return;
                }

                const opt = {
                    margin: 10,
                    filename: `عقد-${student.studentName}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true }
                };

                await html2pdf().from(container).set(opt).save();
                document.body.removeChild(container);
            }

            if (typeof UI.showNotification === 'function') UI.showNotification('✅ تم تحميل العقد بنجاح');

        } catch (err) {
            console.error("Download Error:", err);
            alert("حدث خطأ أثناء تحميل العقد: " + err.message);
        }
    },

    sendContract(id) {
        // Simple WhatsApp Link
        const students = db.getStudents();
        const student = students.find(s => String(s.id) === String(id));
        if (!student) {
            console.warn('Student not found for ID:', id);
            return;
        }

        const settings = db.getSettings();
        let basePath = settings.serverAddress || window.location.href.split('?')[0].replace('index.html', '').replace(/\/$/, '');

        // Get contract template content
        const templateId = student.contractTemplateId;
        const template = (typeof contractMgr !== 'undefined')
            ? contractMgr.getContract(templateId) || contractMgr.getDefaultContract()
            : JSON.parse(localStorage.getItem('contractTemplates') || '[]').find(c => c.id === templateId || c.isDefault);

        // PDF Template links now work via CloudDB sync

        const { link, isLocal, isTooLong } = this.generateContractLink(student);

        if (isLocal) {
            alert('⚠️ تنبيه: أنت تقوم بإرسال رابط محلي (localhost). هذا الرابط لن يفتح لدى ولي الأمر إلا إذا كان في نفس شبكة الواي فاي أو كان الموقع مرفوعاً على الإنترنت.');
        }

        if (isTooLong) {
            alert('⚠️ تنبيه: نص العقد طويل جداً، قد يتم حظر الرابط من قبل واتساب. يفضل استخدام نص أقصر أو تحميله كـ PDF.');
        }

        const msg = `* عقد تسجيل إلكتروني - مدارس دانة العلوم * 📝

                    مرحباً ${student.parentName || ''},
                    يرجى الاطلاع على عقد التسجيل الخاص بالطالب / ة: * ${student.studentName} *

                للتعميد والتوقيع، يرجى الضغط على الرابط التالي:
🔗 اضغط هنا للتوقيع 🔗
${link}

مع تحيات،
* مدارس دانة العلوم * `;

        const url = `https://wa.me/${student.parentWhatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank');

        // Send SMS if enabled
        this.sendSMS(student, link);

        // PRESERVE SIGNATURE: Only update to 'sent' if it's currently 'pending'
        // If it was already 'signed' or 'verified', don't set it back to 'sent'
        if (student.contractStatus === 'pending') {
            db.updateStudentStatus(id, 'sent');
            this.updateStats();
            this.renderStudents();
        }
    },

    async sendSMS(student, contractLink) {
        const settings = db.getSettings();
        const config = settings.smsConfig;

        if (!config || !config.enabled || !config.url) return;

        const phone = student.parentWhatsapp.replace(/[^\d]/g, '');
        if (!phone) return;

        let msg = config.messageTemplate || 'عقد الطالب {student}: {link}';
        msg = msg.replace('{student}', student.studentName).replace('{link}', contractLink);

        // Replace placeholders in URL
        const finalUrl = config.url
            .replace('{phone}', phone)
            .replace('{message}', encodeURIComponent(msg));

        try {
            // Attempt to send
            fetch(finalUrl, { mode: 'no-cors' }).then(() => {
                console.log('SMS Request Sent');
                this.showNotification(Lang.t('sms_sent'));
            }).catch(e => console.warn('SMS Error', e));
        } catch (e) {
            console.error('SMS Exception', e);
        }
    },

    editStudent(id) {
        console.log('📝 Editing student:', id);
        // Populate modal
        const students = db.getStudents();
        const student = students.find(s => String(s.id) === String(id));
        if (!student) {
            console.error('❌ Student not found for editing:', id);
            return;
        }

        const title = document.getElementById('modalTitle');
        if (title) title.textContent = 'تعديل بيانات الطالب';

        document.getElementById('studentName').value = student.studentName || '';
        document.getElementById('parentName').value = student.parentName || '';
        document.getElementById('studentGrade').value = student.studentGrade || '';
        document.getElementById('studentLevel').value = student.studentLevel || '';
        document.getElementById('parentWhatsapp').value = student.parentWhatsapp || '';
        document.getElementById('parentEmail').value = student.parentEmail || '';
        if (document.getElementById('explicitNationalId')) {
            document.getElementById('explicitNationalId').value = student.customFields?.nationalId || '';
        }
        if (document.getElementById('parentNationalId')) {
            document.getElementById('parentNationalId').value = student.customFields?.parentNationalId || '';
        }
        if (document.getElementById('studentTrack')) {
            document.getElementById('studentTrack').value = student.customFields?.studentTrack || student.studentTrack || '';
        }
        if (document.getElementById('contractTemplate')) {
            document.getElementById('contractTemplate').value = student.contractTemplateId || '';
        }

        // Render Custom Fields
        this.renderStudentFormFields(student);

        // Mark as editing
        document.getElementById('studentForm').dataset.editingId = id;
        this.showModal();
    },

    // printContract unused, but maps to download
    printContract(id) { this.downloadContractPdf(id); },

    initTheme() {
        const themeBtn = document.getElementById('themeToggle');
        if (!themeBtn) return;

        const applyTheme = (isDark) => {
            if (isDark) {
                document.body.classList.add('dark-mode');
                themeBtn.querySelector('.sun').style.display = 'none';
                themeBtn.querySelector('.moon').style.display = 'block';
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-mode');
                themeBtn.querySelector('.sun').style.display = 'block';
                themeBtn.querySelector('.moon').style.display = 'none';
                localStorage.setItem('theme', 'light');
            }
        };

        // Initial Load
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            applyTheme(true);
        }

        // Toggle Event
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-mode');
            applyTheme(!isDark);
        });
    },

    applyBranding() {
        const settings = db.getSettings();
        const logo = settings.schoolLogo || 'assets/logo.png';
        if (document.getElementById('navLogo')) document.getElementById('navLogo').src = logo;
        if (document.getElementById('settingsLogoPreview')) document.getElementById('settingsLogoPreview').src = logo;
        if (document.getElementById('loginLogo')) document.getElementById('loginLogo').src = logo;
    },

    saveSettings() {
        const stampText = document.getElementById('schoolStampInput')?.value || '';
        const schoolName = document.getElementById('schoolName')?.value || '';
        const schoolPhone = document.getElementById('schoolPhone')?.value || '';
        const serverAddr = document.getElementById('serverAddress')?.value || '';

        // Chip Inputs (synced to hidden textareas by renderChips)
        const levels = (document.getElementById('schoolLevelsInput')?.value || '').split(',').map(s => s.trim()).filter(s => s);
        const grades = (document.getElementById('schoolGradesInput')?.value || '').split(',').map(s => s.trim()).filter(s => s);

        // Custom Fields
        const customFieldsRaw = document.getElementById('customFieldsSetting')?.value || '[]';
        let customFields = [];
        try { customFields = JSON.parse(customFieldsRaw); } catch (e) { customFields = []; }

        const logo = document.getElementById('settingsLogoPreview')?.src || '';

        // Stamp Image
        const stampPreviewImg = document.querySelector('.school-stamp img');
        const stampImage = stampPreviewImg ? stampPreviewImg.src : '';

        // Security
        const adminUser = document.getElementById('adminUsernameSetting')?.value;
        const adminPass = document.getElementById('adminPassSetting')?.value;

        // SMS Settings
        const smsConfig = {
            url: document.getElementById('smsUrlInput')?.value || '',
            messageTemplate: document.getElementById('smsTemplateInput')?.value || '',
            enabled: document.getElementById('smsEnableCheck')?.checked || false
        };

        const currentSettings = db.getSettings();

        // Safe capture of contract IDs (don't overwrite with null if element is missing)
        const nationalEl = document.getElementById('nationalContractSetting');
        const diplomaEl = document.getElementById('diplomaContractSetting');

        const settings = {
            ...currentSettings,
            schoolName,
            schoolStampText: stampText,
            schoolPhone,
            serverAddress: serverAddr,
            levels,
            grades,
            customFields,
            schoolLogo: logo.startsWith('data:') ? logo : (currentSettings.schoolLogo || ''),
            stampImage: stampImage.startsWith('data:') ? stampImage : (currentSettings.stampImage || ''),
            nationalContractId: (nationalEl && nationalEl.value) ? nationalEl.value : currentSettings.nationalContractId,
            diplomaContractId: (diplomaEl && diplomaEl.value) ? diplomaEl.value : currentSettings.diplomaContractId,
            smsConfig: smsConfig
        };

        if (adminUser) settings.adminUsername = adminUser;
        if (adminPass) settings.adminPassword = adminPass;

        db.saveSettings(settings);
        this.applyBranding();
        this.populateDynamicSelects();

        // Sync to cloud if possible
        if (typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
            CloudDB.saveSettings(settings);
        }

        this.showNotification('✅ تم حفظ جميع الإعدادات بنجاح');

        // Clear password field for security
        if (document.getElementById('adminPassSetting')) document.getElementById('adminPassSetting').value = '';
    },

    handleLogoUpload(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = document.getElementById('settingsLogoPreview');
                if (img) img.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    handleStampUpload(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                const previewContainer = document.querySelector('.school-stamp');
                if (previewContainer) {
                    previewContainer.innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:contain; border-radius:50%; position:absolute; top:0; left:0; z-index:10;">`;
                }
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    updateStampPreview() {
        const text = document.getElementById('schoolStampInput').value;
        const previewContainer = document.querySelector('.school-stamp');

        // If image exists, don't revert to text unless user clears image (which needs a reload or clear button)
        // For now, simpler is better: if there is an IMG tag, keep it. If not, update text.
        if (previewContainer && !previewContainer.querySelector('img')) {
            const previewText = document.getElementById('stampPreviewText'); // This ID existed in original HTML
            if (previewText) previewText.textContent = text || 'الإدارة';
            else {
                // Re-create text structure if lost
                previewContainer.innerHTML = `
                    <div style="position: absolute; width: 90%; height: 90%; border: 1px solid var(--primary-main); border-radius: 50%;"></div>
                    <div id="stampPreviewText" style="font-size: 1rem; text-align: center; max-width: 80%; line-height: 1.2;">${text || 'الإدارة'}</div>
                 `;
            }
        }
    },

    // --- New Settings UI Functions ---
    switchSettingsTab(tabId) {
        // Update Buttons
        const buttons = document.querySelectorAll('.tab-btn');
        buttons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = Array.from(buttons).find(btn => btn.getAttribute('onclick')?.includes(tabId));
        if (activeBtn) activeBtn.classList.add('active');

        // Hide all contents
        const contents = document.querySelectorAll('.tab-content');
        contents.forEach(content => {
            content.classList.remove('active');
            content.style.setProperty('display', 'none', 'important');
        });

        // Resolve Content ID
        let content = document.getElementById(`tab-${tabId}`) || document.getElementById(tabId);

        // Fallback: Try mapping common names 
        if (!content) {
            const map = {
                'security': 'tab-account', 'account': 'tab-security',
                'backup': 'tab-system', 'system': 'tab-backup'
            };
            if (map[tabId]) content = document.getElementById(map[tabId]);
        }

        if (content) {
            content.classList.add('active');
            content.style.setProperty('display', 'block', 'important');
        } else {
            console.warn(`Tab content not found for ID: ${tabId}`);
        }
    },

    // Chip Management
    addChip(storageId, inputId) {
        const input = document.getElementById(inputId);
        const val = input.value.trim();
        if (!val) return;

        const currentVal = document.getElementById(storageId).value;
        const items = currentVal ? currentVal.split(',') : [];
        if (!items.includes(val)) {
            items.push(val);
            this.renderChips(storageId, items);
            input.value = '';
        }
    },

    removeChip(storageId, value) {
        const currentVal = document.getElementById(storageId).value;
        let items = currentVal ? currentVal.split(',') : [];
        items = items.filter(i => i !== value);
        this.renderChips(storageId, items);
    },

    renderChips(storageId, items) {
        // Sync to hidden input
        document.getElementById(storageId).value = items.join(',');

        // Render UI
        const containerId = storageId === 'schoolLevelsInput' ? 'levelsChips' : 'gradesChips';
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = items.length ? items.map(item => `
            <div class="chip">
                ${item}
                <button onclick="UI.removeChip('${storageId}', '${item}')">&times;</button>
            </div>
        `).join('') : '<div class="chip-empty">لا توجد عناصر مضافة</div>';
    },

    // Custom Fields Management
    addCustomField() {
        const label = document.getElementById('newFieldLabel')?.value.trim();
        const type = document.getElementById('newFieldType')?.value;
        if (!label) return;

        const hiddenInput = document.getElementById('customFieldsSetting');
        let fields = [];
        try { fields = JSON.parse(hiddenInput.value || '[]'); } catch (e) { }

        fields.push({ id: Date.now(), label, type });
        this.renderCustomFields(fields);

        document.getElementById('newFieldLabel').value = '';
    },

    deleteCustomField(id) {
        const hiddenInput = document.getElementById('customFieldsSetting');
        let fields = [];
        try { fields = JSON.parse(hiddenInput.value || '[]'); } catch (e) { }

        fields = fields.filter(f => f.id !== id);
        this.renderCustomFields(fields);
    },

    renderCustomFields(fields) {
        const hiddenInput = document.getElementById('customFieldsSetting');
        hiddenInput.value = JSON.stringify(fields);

        const container = document.getElementById('customFieldsList');
        if (!container) return;

        container.innerHTML = fields.length ? fields.map(f => `
            <div class="custom-field-item">
                <div class="custom-field-info">
                    <span class="custom-field-label">${f.label}</span>
                    <span class="custom-field-type">النوع: ${f.type === 'text' ? 'نص' : f.type === 'number' ? 'رقم' : 'تاريخ'}</span>
                </div>
                <button class="btn btn-icon btn-danger" onclick="UI.deleteCustomField(${f.id})" style="width:30px; height:30px; min-width:30px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `).join('') : '<div class="chip-empty">لا توجد حقول إضافية</div>';

        // Also update the form in the modal dynamically if open? 
        // Better to handle that in openModal
    },

    renderStudentFormFields(student = null) {
        const container = document.getElementById('dynamicCustomFieldsContainer');
        if (!container) return;

        const settings = db.getSettings();
        // Filter out 'nationalId' because it is now hardcoded in the form
        const fields = (settings.customFields || []).filter(f => f.id !== 'nationalId' && f.id !== 'parentNationalId');

        container.innerHTML = fields.map(f => {
            const val = student?.customFields?.[f.id] || '';
            let inputHtml = '';

            if (f.type === 'text') {
                inputHtml = `<input type="text" id="custom_${f.id}" value="${val}" placeholder="${f.label}" style="width: 100%; padding: 0.8rem; border: 1px solid #e2e8f0; border-radius: 8px;">`;
            } else if (f.type === 'number') {
                inputHtml = `<input type="number" id="custom_${f.id}" value="${val}" placeholder="${f.label}" style="width: 100%; padding: 0.8rem; border: 1px solid #e2e8f0; border-radius: 8px;">`;
            } else if (f.type === 'date') {
                inputHtml = `<input type="date" id="custom_${f.id}" value="${val}" style="width: 100%; padding: 0.8rem; border: 1px solid #e2e8f0; border-radius: 8px;">`;
            }

            return `
                <div class="form-group" style="flex: 1 1 45%; min-width: 250px;">
                    <label for="custom_${f.id}" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: #4a5568;">${f.label}</label>
                    ${inputHtml}
                </div>
            `;
        }).join('');
    },

    handleLogoUpload(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('settingsLogoPreview');
                if (preview) preview.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    updateStampPreview() {
        const input = document.getElementById('schoolStampInput');
        const preview = document.getElementById('stampPreviewText');
        if (input && preview) {
            preview.textContent = input.value || 'الإدارة';
        }
    },

    populateDynamicSelects() {
        const settings = db.getSettings();

        const levelOptions = (settings.levels || []).map(l => `<option value="${l}">${l}</option>`).join('');
        const gradeOptions = (settings.grades || []).map(g => `<option value="${g}">${g}</option>`).join('');

        // Populate form and filter dropdowns
        const levelSelects = [document.getElementById('studentLevel'), document.getElementById('filterLevel')];
        const gradeSelects = [document.getElementById('studentGrade'), document.getElementById('filterGrade')];

        levelSelects.forEach(sel => {
            if (sel) sel.innerHTML = `<option value="">${sel.id.includes('filter') ? Lang.t('filter_level_all') : Lang.t('select_level')}</option>` + levelOptions;
        });
        gradeSelects.forEach(sel => {
            if (sel) sel.innerHTML = `<option value="">${sel.id.includes('filter') ? Lang.t('filter_grade_all') : Lang.t('select_grade')}</option>` + gradeOptions;
        });

        // Populate Contract Templates
        const contractSelects = [
            document.getElementById('contractTemplate'),
            document.getElementById('nationalContractSetting'),
            document.getElementById('diplomaContractSetting')
        ];
        if (typeof contractMgr !== 'undefined') {
            const templates = contractMgr.getContracts();
            const contractOptions = templates.map(t => `<option value="${t.id}">${t.title}</option>`).join('');
            contractSelects.forEach(sel => {
                if (sel) sel.innerHTML = '<option value="">-- اختر العقد --</option>' + contractOptions;
            });
        }
    },

    injectSmsSettingsUI() {
        if (document.getElementById('smsUrlInput')) return;

        const phoneInput = document.getElementById('schoolPhone');
        if (!phoneInput) return;

        // Find a good place to insert (after the phone number field)
        const container = phoneInput.closest('.form-row') || phoneInput.parentElement.parentElement;

        const section = document.createElement('div');
        section.className = 'settings-section';
        section.style.cssText = 'margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 20px;';

        section.innerHTML = `
            <h3 style="font-size:1.1rem; margin-bottom:15px; color:var(--primary-color);">${Lang.t('lbl_sms_settings')}</h3>
            <div class="form-row" style="display:flex; gap:15px; flex-wrap:wrap;">
                <div class="form-group" style="flex:1; min-width:300px;">
                    <label>${Lang.t('lbl_sms_url')}</label>
                    <input type="text" id="smsUrlInput" placeholder="https://api.sms.com/send?user=...&mobile={phone}&msg={message}" style="direction:ltr; text-align:left;">
                    <small style="color:#718096; font-size:0.8rem;">${Lang.t('sms_url_hint')}</small>
                </div>
            </div>
            <div class="form-row" style="display:flex; gap:15px; flex-wrap:wrap; margin-top:10px;">
                <div class="form-group" style="flex:1;">
                    <label>${Lang.t('lbl_sms_template')}</label>
                    <input type="text" id="smsTemplateInput" placeholder="عقد الطالب {student}: {link}">
                </div>
                <div class="form-group" style="width:auto; display:flex; align-items:center; padding-top:25px;">
                    <label style="display:flex; align-items:center; cursor:pointer;">
                        <input type="checkbox" id="smsEnableCheck" style="width:18px; height:18px; margin-left:8px;">
                        ${Lang.t('lbl_sms_enable')}
                    </label>
                </div>
            </div>
        `;

        container.parentNode.insertBefore(section, container.nextSibling);
    },

    loadSettingsPage() {
        try {
            this.injectSmsSettingsUI(); // Inject SMS UI first
            this.populateDynamicSelects(); // Ensure dropdowns are populated first!
            const settings = db.getSettings();

            // Text Inputs
            if (document.getElementById('schoolName')) document.getElementById('schoolName').value = settings.schoolName || '';
            if (document.getElementById('schoolStampInput')) document.getElementById('schoolStampInput').value = settings.schoolStampText || '';
            if (document.getElementById('serverAddress')) document.getElementById('serverAddress').value = settings.serverAddress || '';
            if (document.getElementById('schoolPhone')) document.getElementById('schoolPhone').value = settings.schoolPhone || '';
            if (document.getElementById('adminUsernameSetting')) document.getElementById('adminUsernameSetting').value = settings.adminUsername || 'admin';

            // Load contract assignment settings
            if (document.getElementById('nationalContractSetting')) document.getElementById('nationalContractSetting').value = settings.nationalContractId || '';
            if (document.getElementById('diplomaContractSetting')) document.getElementById('diplomaContractSetting').value = settings.diplomaContractId || '';

            // Load SMS Settings
            if (document.getElementById('smsUrlInput')) {
                document.getElementById('smsUrlInput').value = settings.smsConfig?.url || '';
                document.getElementById('smsTemplateInput').value = settings.smsConfig?.messageTemplate || 'عقد الطالب {student}: {link}';
                document.getElementById('smsEnableCheck').checked = settings.smsConfig?.enabled || false;
            }

            // Logo
            if (document.getElementById('settingsLogoPreview') && settings.schoolLogo) {
                document.getElementById('settingsLogoPreview').src = settings.schoolLogo;
            }

            // Stamp Image
            if (settings.stampImage) {
                const previewContainer = document.querySelector('.school-stamp');
                if (previewContainer) {
                    previewContainer.innerHTML = `<img src="${settings.stampImage}" style="width:100%; height:100%; object-fit:contain; border-radius:50%; position:absolute; top:0; left:0; z-index:10;">`;
                }
            }

            // Chips & Lists
            this.renderChips('schoolLevelsInput', settings.levels || []);
            this.renderChips('schoolGradesInput', settings.grades || []);
            this.renderCustomFields(settings.customFields || []);

            this.updateStampPreview();

            // Switch to General tab by default if no active tab
            if (!document.querySelector('.tab-content.active')) {
                this.switchSettingsTab('general');
            }
        } catch (e) {
            console.error('Error loading settings page:', e);
        }
    },

    remindParent(id) {
        const student = db.getStudents().find(s => s.id === id);
        if (!student) return;

        const phone = student.parentWhatsapp.replace(/[^0-9]/g, '');
        if (!phone) {
            this.showNotification('❌ لا يوجد رقم واتساب مسجل');
            return;
        }

        const settings = db.getSettings();
        const baseUrl = settings.serverAddress || window.location.origin;
        // Construct Link
        const link = `${baseUrl}/contract.html?d=${this.generateContractLink(student)}`;

        const message = `تذكير: مرحباً ${student.parentName}،%0a%0aنرجو التكرم بتوقيع عقد الطالب *${student.studentName}* لاستكمال إجراءات التسجيل.%0a%0aرابط العقد:%0a${encodeURIComponent(link)}`;

        window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        db.updateStudentStatus(id, 'sent'); // Update last sent time effectively
        this.showNotification('✅ تم فتح واتساب لإرسال التذكير');
    },

    applyFilters() {
        const searchDash = document.getElementById('studentSearch')?.value.toLowerCase() || '';
        const searchAll = document.getElementById('studentSearchAll')?.value.toLowerCase() || '';
        const searchTerm = searchDash || searchAll;

        const levelTerm = document.getElementById('filterLevel')?.value || '';
        const gradeTerm = document.getElementById('filterGrade')?.value || '';

        const students = db.getStudents().filter(s => {
            const matchesSearch = !searchTerm ||
                (s.studentName || '').toLowerCase().includes(searchTerm) ||
                (s.parentWhatsapp || '').includes(searchTerm) ||
                (s.parentEmail || '').toLowerCase().includes(searchTerm) ||
                (s.parentName || '').toLowerCase().includes(searchTerm);

            const matchesLevel = !levelTerm || s.studentLevel === levelTerm;
            const matchesGrade = !gradeTerm || s.studentGrade === gradeTerm;

            return matchesSearch && matchesLevel && matchesGrade;
        });

        // Apply Current Sort
        this.sortAndRender(students);
    },

    sortStudents(field) {
        if (this.currentSort.field === field) {
            this.currentSort.order = this.currentSort.order === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.order = 'asc';
        }
        this.applyFilters();
    },

    sortAndRender(students) {
        const field = this.currentSort.field;
        const order = this.currentSort.order === 'asc' ? 1 : -1;

        students.sort((a, b) => {
            let valA = a[field] || '';
            let valB = b[field] || '';

            if (field === 'createdAt') {
                return (new Date(valA) - new Date(valB)) * order;
            }

            return String(valA).localeCompare(String(valB), 'ar') * order;
        });

        this.renderStudents(students);
    },

    // --- Bulk Actions Queue System ---
    bulkQueue: [],
    bulkQueueIndex: 0,
    bulkActionType: '', // 'send' or 'remind'

    startBulkAction(type) {
        const checks = document.querySelectorAll('#allStudentsTableBody .student-checkbox:checked');
        if (checks.length === 0) {
            this.showNotification('⚠️ الرجاء اختيار طلاب أولاً');
            return;
        }

        const ids = Array.from(checks).map(c => c.value);
        this.bulkQueue = ids;
        this.bulkQueueIndex = 0;
        this.bulkActionType = type;

        // Reset UI
        document.getElementById('bulkQueueModal').style.display = 'block';
        document.getElementById('bulkQueueActions').style.display = 'block';
        document.getElementById('bulkQueueComplete').style.display = 'none';

        const title = type === 'send' ? 'إرسال العقود الجماعي' : 'إرسال التذكيرات الجماعي';
        document.getElementById('bulkQueueTitle').textContent = title;

        this.updateBulkUI();
    },

    updateBulkUI() {
        const total = this.bulkQueue.length;
        const current = this.bulkQueueIndex + 1;

        if (this.bulkQueueIndex >= total) {
            // Finished
            document.getElementById('bulkQueueActions').style.display = 'none';
            document.getElementById('bulkQueueComplete').style.display = 'block';
            document.getElementById('bulkQueueProgress').textContent = `${total}/${total}`;
            return;
        }

        document.getElementById('bulkQueueProgress').textContent = `${current}/${total}`;

        const studentId = this.bulkQueue[this.bulkQueueIndex];
        const student = db.getStudents().find(s => s.id === studentId);

        if (student) {
            document.getElementById('bulkStudentName').textContent = student.studentName;
        } else {
            // Skip invalid ID
            this.bulkQueueIndex++;
            this.updateBulkUI();
        }
    },

    processNextInQueue() {
        const studentId = this.bulkQueue[this.bulkQueueIndex];

        if (this.bulkActionType === 'send') {
            this.sendContract(studentId); // Reuses existing logic
        } else {
            this.remindParent(studentId); // Reuses existing logic
        }

        // Advance
        this.bulkQueueIndex++;

        // Slight delay to allow UI update after window open
        setTimeout(() => {
            this.updateBulkUI();
        }, 1000);
    },

    closeBulkModal() {
        document.getElementById('bulkQueueModal').style.display = 'none';
        this.bulkQueue = [];
        this.renderStudents(); // Refresh to uncheck
    },

    exportToExcel() {
        console.log('📊 Exporting to Excel...');
        if (typeof XLSX === 'undefined') {
            this.showNotification('⚠️ مكتبة الإكسل غير محملة');
            return;
        }

        // Use filters from the "All Students" page for consistency
        const searchTerm = document.getElementById('studentSearchAll')?.value.toLowerCase() || '';
        const levelTerm = document.getElementById('filterLevel')?.value || '';
        const gradeTerm = document.getElementById('filterGrade')?.value || '';

        const students = db.getStudents().filter(s => {
            const matchesSearch = !searchTerm ||
                (s.studentName || '').toLowerCase().includes(searchTerm) ||
                (s.parentWhatsapp || '').includes(searchTerm) ||
                (s.parentEmail || '').toLowerCase().includes(searchTerm) ||
                (s.parentName || '').toLowerCase().includes(searchTerm);

            const matchesLevel = !levelTerm || s.studentLevel === levelTerm;
            const matchesGrade = !gradeTerm || s.studentGrade === gradeTerm;
            return matchesSearch && matchesLevel && matchesGrade;
        });

        if (students.length === 0) {
            this.showNotification('⚠️ لا توجد بيانات لتصديرها');
            return;
        }

        try {
            const settings = db.getSettings();
            const exportData = students.map(s => {
                const row = {
                    'اسم الطالب': s.studentName,
                    'المسار': s.customFields?.studentTrack || s.studentTrack || '-',
                    'المرحلة': s.studentLevel,
                    'الصف': s.studentGrade,
                    'اسم ولي الأمر': s.parentName,
                    'البريد الإلكتروني': s.parentEmail,
                    'رقم الواتساب': s.parentWhatsapp,
                    'حالة العقد': this.getStatusText(s.contractStatus),
                    'السنة الدراسية': s.contractYear || ''
                };

                // Dynamically add custom fields to the export
                if (settings.customFields && s.customFields) {
                    settings.customFields.forEach(fieldDef => {
                        if (fieldDef.id !== 'studentTrack') { // Avoid duplicating track
                            row[fieldDef.label] = s.customFields[fieldDef.id] || '-';
                        }
                    });
                }
                return row;
            });

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

            worksheet['!dir'] = 'rtl';

            // Dynamically set column widths based on the final headers
            const headers = Object.keys(exportData[0] || {});
            worksheet['!cols'] = headers.map(header => {
                if (header.includes('اسم') || header.includes('البريد')) return { wch: 25 };
                if (header.includes('المسار')) return { wch: 20 };
                return { wch: 15 };
            });

            const fileName = `قائمة_الطلاب_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`;

            XLSX.writeFile(workbook, fileName);
            this.showNotification('✅ تم تصدير القائمة بنجاح');
        } catch (error) {
            console.error('Export Error:', error);
            this.showNotification('❌ فشل تصدير الملف');
        }
    },

    backupAllData() {
        console.log('💾 Starting Full Backup...');
        if (typeof XLSX === 'undefined') {
            this.showNotification('⚠️ مكتبة الإكسل غير محملة');
            return;
        }

        const students = db.getStudents(); // Get ALL students unfiltered
        if (students.length === 0) {
            this.showNotification('⚠️ لا توجد بيانات لحفظها');
            return;
        }

        try {
            const exportData = students.map(s => ({
                'الرقم التسلسلي (ID)': s.id,
                'اسم الطالب': s.studentName,
                'المرحلة': s.studentLevel,
                'الصف': s.studentGrade,
                'اسم ولي الأمر': s.parentName,
                'البريد الإلكتروني': s.parentEmail,
                'رقم الواتساب': s.parentWhatsapp,
                'حالة العقد': this.getStatusText(s.contractStatus),
                'وقت التوقيع': s.signedAt ? new Date(s.signedAt).toLocaleString('ar-SA') : '-',
                'تاريخ الإضافة': s.createdAt ? new Date(s.createdAt).toLocaleDateString('ar-SA') : '-',
                'رابط العقد (احتياطي)': this.generateContractLink(s).link
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Full_Backup');

            worksheet['!dir'] = 'rtl';
            worksheet['!cols'] = [
                { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 50 }
            ];

            const fileName = `نسخة_كاملة_دانات_${new Date().toISOString().slice(0, 10)}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            this.showNotification('✅ تم حفظ النسخة الاحتياطية الشاملة');
        } catch (error) {
            console.error('Backup Error:', error);
            this.showNotification('❌ فشل العملية');
        }
    },

    getStatusText(status) {
        const texts = {
            'pending': 'قيد الانتظار',
            'sent': 'تم الإرسال',
            'signed': 'تم التوقيع',
            'verified': 'موثق'
        };
        return texts[status] || status;
    },

    refreshData() {
        this.updateStats();
        this.renderStudents();
    },


    handleLogin() {
        const usernameInput = document.getElementById('adminUserInput');
        const passwordInput = document.getElementById('adminPassInput');
        const errorMsg = document.getElementById('loginError');
        const loginOverlay = document.getElementById('loginOverlay');

        if (!usernameInput || !passwordInput) {
            console.error('Login inputs not found');
            return;
        }

        const settings = db.getSettings();
        const storedUser = settings.adminUsername || 'admin';
        const storedPass = settings.adminPassword || 'admin';

        // Allow admin/admin bypass for local testing (localhost or file://)
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';

        if ((usernameInput.value === storedUser && passwordInput.value === storedPass) ||
            (isLocal && usernameInput.value === 'admin' && passwordInput.value === 'admin')) {
            // Security Check for Production
            if (storedUser === 'admin' && storedPass === 'admin') {
                alert('⚠️ تحذير أمني: لا تزال تستخدم بيانات الدخول الافتراضية (admin/admin).\n\nيرجى تغيير كلمة المرور من الإعدادات فوراً لضمان حماية بيانات الطلاب عند النشر.');
            }

            sessionStorage.setItem('isLoggedIn', 'true');
            if (loginOverlay) loginOverlay.style.display = 'none';
            // document.getElementById('app-container').style.display = 'block'; // Not present in HTML
            this.updateStats();
            this.renderStudents();
            this.populateDynamicSelects();
        } else {
            if (errorMsg) errorMsg.style.display = 'block';
        }
    },

    handleLogout() {
        sessionStorage.removeItem('isLoggedIn');
        window.location.reload();
    },

    checkLogin() {
        const loginOverlay = document.getElementById('loginOverlay');
        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            if (loginOverlay) loginOverlay.style.display = 'none';
            this.applyBranding();
            this.updateStats();
            this.renderStudents();
            this.populateDynamicSelects();
        } else {
            if (loginOverlay) loginOverlay.style.display = 'flex';
        }
    },

    markAsSigned(id) {
        if (confirm(Lang.t('confirm_verify'))) {
            db.updateStudentStatus(id, 'verified');
            this.updateStats();
            this.renderStudents();
            this.showNotification(Lang.t('verified_success'));
        }
    },

    importFromExcel(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    this.showNotification('⚠️ الملف فارغ');
                    return;
                }

                const settings = db.getSettings();
                const nationalContractId = settings.nationalContractId;
                const diplomaContractId = settings.diplomaContractId;
                let errors = [];
                let importedCount = 0;

                jsonData.forEach((row, index) => {
                    // Auto-assign contract based on track
                    const track = (row['المسار'] || row['Track'] || '').trim().toLowerCase();
                    let assignedContractId = null;

                    if (track.includes('دبلوم') || track.includes('diploma')) {
                        if (!diplomaContractId) {
                            errors.push(`- الصف ${index + 2}: تم تحديد مسار "الدبلومة" ولكن لم يتم ربط عقد له في الإعدادات.`);
                        } else if (typeof contractMgr !== 'undefined' && !contractMgr.getContract(diplomaContractId)) {
                            errors.push(`- الصف ${index + 2}: عقد الدبلومة المحدد في الإعدادات (ID: ${diplomaContractId}) غير موجود في النظام.`);
                        }
                        assignedContractId = diplomaContractId;
                    } else if (track.includes('أهلي') || track.includes('ثنائي') || track.includes('national') || track.includes('bilingual')) {
                        if (!nationalContractId) {
                            errors.push(`- الصف ${index + 2}: تم تحديد مسار "الأهلي" ولكن لم يتم ربط عقد له في الإعدادات.`);
                        } else if (typeof contractMgr !== 'undefined' && !contractMgr.getContract(nationalContractId)) {
                            errors.push(`- الصف ${index + 2}: عقد الأهلي المحدد في الإعدادات (ID: ${nationalContractId}) غير موجود في النظام.`);
                        }
                        assignedContractId = nationalContractId;
                    }

                    if (track && !assignedContractId) {
                        errors.push(`- الصف ${index + 2}: المسار "${row['المسار']}" غير معروف أو لم يتم تعيين عقد له في الإعدادات.`);
                    }

                    // Collect all custom fields from Excel
                    const customFields = {};
                    (settings.customFields || []).forEach(fieldDef => {
                        const excelHeader = fieldDef.label;
                        if (row[excelHeader]) {
                            customFields[fieldDef.id] = row[excelHeader];
                        }
                    });
                    customFields.studentTrack = row['المسار'] || row['Track'] || '';

                    const student = {
                        studentName: row['اسم الطالب'] || row['Name'] || '',
                        parentName: row['اسم ولي الأمر'] || row['ولي الأمر'] || row['Parent'] || '',
                        parentEmail: row['البريد الإلكتروني'] || row['البريد'] || row['Email'] || '',
                        parentWhatsapp: String(row['رقم الواتساب'] || row['الجوال'] || row['WhatsApp'] || ''),
                        studentLevel: row['المرحلة'] || row['Level'] || '',
                        studentGrade: row['الصف'] || row['Grade'] || '',
                        contractYear: row['السنة الدراسية'] || row['السنة'] || row['Year'] || new Date().getFullYear().toString(),
                        sendMethod: row['طريقة الإرسال'] || row['SendMethod'] || 'whatsapp',
                        contractTemplateId: assignedContractId,
                        customFields: customFields
                    };

                    if (student.studentName) {
                        db.saveStudent(student);
                        importedCount++;
                    }
                });

                if (errors.length > 0 && importedCount > 0) {
                    alert(`تم استيراد ${importedCount} طالب مع وجود الملاحظات التالية:\n\n${errors.join('\n')}\n\nسيتم استخدام العقد الافتراضي لهذه الحالات.`);
                } else {
                    this.showNotification(`✅ تم استيراد ${importedCount} طالب بنجاح`);
                }
                this.renderStudents();
                this.updateStats();
                this.closeImportModal();
                input.value = ''; // Reset input
            } catch (err) {
                console.error('Excel Import Error:', err);
                this.showNotification('❌ فشل في قراءة ملف الإكسل');
            }
        };
        reader.readAsArrayBuffer(file);
    },

    exportSystemJSON() {
        console.log('💾 Starting System Snapshot...');
        const students = db.getStudents();
        const settings = db.getSettings();

        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'Danat_System',
            students: students,
            settings: settings
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `نسخة_نظام_كاملة_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        this.showNotification('✅ تم تحميل ملف الاستعادة الكامل بنجاح');
    },

    importSystemJSON(input) {
        const file = input.files[0];
        if (!file) return;

        console.log('📂 Attempting to restore system from file:', file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let backup;
                const result = e.target.result;

                // Handle potential Data URL prefix if present (though readAsText shouldn't have it)
                const jsonStr = result.startsWith('data:') ? decodeURIComponent(result.split(',')[1]) : result;

                try {
                    backup = JSON.parse(jsonStr);
                } catch (parseError) {
                    console.error('JSON Parse Error:', parseError);
                    alert('خطأ: الملف المختار ليس ملف نظام صالح (JSON Error).');
                    return;
                }

                // Validate Structure
                if (!backup || typeof backup !== 'object') {
                    throw new Error('Invalid backup structure');
                }

                // If it's a legacy or simple array
                let studentsToRestore = [];
                let settingsToRestore = null;

                if (Array.isArray(backup)) {
                    // Assume it's just a list of students (old format)
                    studentsToRestore = backup;
                } else if (backup.students && Array.isArray(backup.students)) {
                    // Standard new format
                    studentsToRestore = backup.students;
                    settingsToRestore = backup.settings;
                } else {
                    throw new Error('Backup file must contain students array');
                }

                if (confirm(`هل أنت متأكد من استعادة النسخة الاحتياطية؟\n\nعدد الطلاب: ${studentsToRestore.length}\nتاريخ النسخة: ${backup.timestamp ? new Date(backup.timestamp).toLocaleDateString('ar-SA') : 'غير محدد'}\n\n⚠️ تحذير: سيتم استبدال البيانات الحالية بالكامل.`)) {

                    // 1. Restore Settings
                    if (settingsToRestore) {
                        db.saveSettings(settingsToRestore);
                    }

                    // 2. Restore Students
                    localStorage.setItem('students', JSON.stringify(studentsToRestore));

                    // 3. Sync to Cloud (Force Overwrite Cloud with Backup)
                    if (typeof CloudDB !== 'undefined' && CloudDB.isReady()) {
                        console.log('☁️ Syncing restored data to cloud...');
                        // First clear cloud to avoid merging with old deleted data
                        // Actually, syncLocalToCloud does an update, let's be safer and set.
                        // For now, standard sync is fine as it updates by ID.
                        CloudDB.syncLocalToCloud().then(() => {
                            console.log('✅ Cloud synced successfully');
                        });
                    }

                    this.showNotification('✅ تم استعادة النظام بالكامل بنجاح!');
                    setTimeout(() => window.location.reload(), 1500);
                }
            } catch (err) {
                console.error('Restore Logic Error:', err);
                this.showNotification('❌ ملف النسخة الاحتياطية غير صالح أو تالف');
                alert('تفاصيل الخطأ: ' + err.message);
            }
        };
        reader.readAsText(file);
        input.value = ''; // Reset
    },

    downloadExcelTemplate() {
        console.log('📊 Generating Excel Template...');
        try {
            if (typeof XLSX === 'undefined') {
                this.showNotification('⚠️ مكتبة الإكسل غير محملة، يرجى التأكد من الاتصال بالإنترنت');
                return;
            }

            // بناء نموذج الإكسل بشكل ديناميكي ليتطابق مع حقول المنصة
            const settings = db.getSettings();
            const rowData = {
                'اسم الطالب': 'محمد أحمد علي',
                'المسار': 'مسار ثنائي اللغة', // عمود المسار أصبح أساسياً
                'المرحلة': 'الابتدائية',
                'الصف': 'الصف الأول',
                'اسم ولي الأمر': 'أحمد علي',
                'البريد الإلكتروني': 'parent@example.com',
                'رقم الواتساب': '966500000000',
                'طريقة الإرسال': 'whatsapp',
                'السنة الدراسية': '2024-2025'
            };

            // إضافة الحقول المخصصة (مثل رقم الهوية) تلقائياً إلى النموذج
            const customHeaders = [];
            if (settings.customFields && Array.isArray(settings.customFields)) {
                settings.customFields.forEach(field => {
                    rowData[field.label] = `(مثال: ${field.label})`;
                    customHeaders.push({ wch: 20 });
                });
            }

            const templateData = [rowData];

            const worksheet = XLSX.utils.json_to_sheet(templateData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

            worksheet['!dir'] = 'rtl';
            const standardCols = [
                { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
            ];
            worksheet['!cols'] = [...standardCols, ...customHeaders];

            try {
                XLSX.writeFile(workbook, 'نموذج_استيراد_الطلاب.xlsx');
                this.showNotification('✅ تم تحميل نموذج الإكسل');
            } catch (err) {
                console.warn('XLSX.writeFile failed, trying fallback blobing...', err);
                const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
                const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = 'نموذج_استيراد_الطلاب.xlsx';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                }, 100);
                this.showNotification('✅ تم تحميل نموذج الإكسل (fallback)');
            }
        } catch (error) {
            console.error('Download Error:', error);
            this.showNotification('❌ فشل تحميل الملف، حاول مرة أخرى');
        }
    },

    applyTranslations() {
        // 1. Translate Sidebar Tabs
        document.querySelectorAll('.nav-link').forEach(link => {
            const page = link.dataset.page;
            const key = 'nav_' + page;
            if (page && Lang.t(key) !== key) {
                // Replace text node only, keep icon
                link.childNodes.forEach(node => {
                    if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                        node.textContent = ' ' + Lang.t(key) + ' ';
                    }
                });
            }
        });

        // 2. Translate Static Buttons & Elements by ID
        const elementMap = {
            'newStudentBtn': 'btn_new_student',
            'deleteSelectedBtn': 'btn_delete_selected',
            'deleteSelectedBtnMain': 'btn_delete_selected',
            'cancelBtn': 'btn_cancel',
            'closeModalBtn': 'btn_close'
        };

        for (const [id, key] of Object.entries(elementMap)) {
            const el = document.getElementById(id);
            if (el) {
                // If element has children (icons), replace text node only
                if (el.children.length > 0) {
                    el.childNodes.forEach(node => {
                        if (node.nodeType === 3 && node.textContent.trim().length > 0) {
                            node.textContent = ' ' + Lang.t(key) + ' ';
                        }
                    });
                } else {
                    el.textContent = Lang.t(key);
                }
            }
        }

        // 3. Translate Placeholders
        const searchInputs = ['studentSearch', 'studentSearchAll', 'signedContractSearch'];
        searchInputs.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.placeholder = Lang.t('search_placeholder');
        });
    }
};

window.UI = UI;
const db = new DatabaseManager();
window.db = db;

// Global DB Actions
window.DB = {
    clearAllData: () => {
        if (confirm('⛔ تحذير أمني هام ⛔\n\nأنت على وشك حذف جميع البيانات من هذا المتصفح.\n\nهل قمت بأخذ نسخة احتياطية (System Snapshot)؟\n\nاضغط "موافق" فقط إذا كنت متأكداً من رغبتك في تصفير النظام بالكامل.')) {
            if (confirm('تأكيد نهائي: سيتم مسح بيانات الطلاب، العقود، والإعدادات.\n\nهل أنت متأكد 100%؟')) {
                console.log('🧨 Performing Factory Reset...');
                localStorage.clear();

                // Optional: Clear Cloud if needed, but usually we just unlink local.
                // Let's keep cloud safe, just clear local.

                UI.showNotification('✅ تم مسح كافة البيانات بنجاح');
                setTimeout(() => window.location.reload(), 1000);
            }
        }
    }
};

// Global Helper
window.markAsSigned = (id) => UI.markAsSigned(id);

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log('App Initializing...');

    // 1. Initial Render
    UI.checkLogin(); // Check if already logged in
    UI.initTheme();  // Initialize Dark Mode
    UI.applyBranding(); // Apply school identity
    UI.applyTranslations(); // Apply translations to static elements

    // Inject Language Toggle
    const nav = document.querySelector('.navbar-end') || document.querySelector('.navbar') || document.body;
    const langBtn = document.createElement('button');
    langBtn.className = 'btn-icon';
    langBtn.style.marginLeft = '10px';
    langBtn.style.fontSize = '1.2rem';
    langBtn.innerHTML = Lang.current === 'ar' ? '🇺🇸 EN' : '🇸🇦 AR';
    langBtn.title = 'Switch Language';
    langBtn.onclick = () => Lang.toggle();

    if (nav.classList.contains('navbar-end')) nav.prepend(langBtn);
    else if (nav.classList.contains('navbar')) nav.appendChild(langBtn);
    else { langBtn.style.position = 'fixed'; langBtn.style.bottom = '10px'; langBtn.style.left = '10px'; langBtn.style.zIndex = '9999'; document.body.appendChild(langBtn); }

    // 2. Tab Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            try {
                e.preventDefault();
                const pageId = link.dataset.page;
                // ... same logic as before ...
                if (!pageId) return;

                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                pages.forEach(p => p.classList.remove('active'));
                const targetPage = document.getElementById(`${pageId}-page`);
                if (targetPage) targetPage.classList.add('active');

                if (pageId === 'dashboard' || pageId === 'students') {
                    UI.renderStudents();
                    UI.updateStats();
                } else if (pageId === 'settings') {
                    UI.loadSettingsPage();
                }

            } catch (e) { console.error(e); }
        });
    });

    // 3. Modal Events
    const newStudentBtn = document.getElementById('newStudentBtn');
    if (newStudentBtn) {
        newStudentBtn.addEventListener('click', () => UI.openModal());
    }

    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => UI.closeModal());
    }

    const closeModalBtn = document.querySelector('.close-modal'); // Might be ID
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => UI.closeModal());
    const closeBtn2 = document.getElementById('closeModalBtn');
    if (closeBtn2) closeBtn2.addEventListener('click', () => UI.closeModal());

    // 4. Select All Logic
    const setupSelectAll = (headerId, bodyId) => {
        const header = document.getElementById(headerId);
        if (!header) return;
        header.addEventListener('change', () => {
            const checks = document.querySelectorAll(`#${bodyId} .student-checkbox`);
            checks.forEach(c => c.checked = header.checked);
            UI.handleSelectionChange();
        });
    };
    setupSelectAll('selectAllAllStudents', 'allStudentsTableBody');

    // 6. Auto-select contract on track change
    const studentTrackSelect = document.getElementById('studentTrack');
    if (studentTrackSelect) {
        studentTrackSelect.addEventListener('change', () => UI.autoSelectContract());
    }

    // 5. Search & Filter Logic (Standardized)
    const searchInputs = ['studentSearch', 'studentSearchAll'];
    searchInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', () => UI.applyFilters());
    });

    // Search for Signed Contracts
    const signedContractSearch = document.getElementById('signedContractSearch');
    if (signedContractSearch) {
        signedContractSearch.addEventListener('input', (e) => {
            UI.renderSignedContracts(e.target.value);
        });
    }

    const studentForm = document.getElementById('studentForm');
    if (studentForm) {
        studentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const editingId = studentForm.dataset.editingId;
            const existingStudent = editingId ? db.getStudents().find(s => String(s.id) === String(editingId)) : null;

            // Start with existing custom fields if editing, or an empty object
            const customFields = existingStudent?.customFields ? { ...existingStudent.customFields } : {};

            // Get values from all custom fields defined in settings
            const settings = db.getSettings();
            (settings.customFields || []).forEach(f => {
                const el = document.getElementById(`custom_${f.id}`);
                if (el) customFields[f.id] = el.value;
            });

            // Explicitly get values from hardcoded form fields and add/overwrite them in customFields
            const explicitIdEl = document.getElementById('explicitNationalId');
            if (explicitIdEl) customFields['nationalId'] = explicitIdEl.value;

            // Capture Parent National ID
            const parentIdEl = document.getElementById('parentNationalId');
            if (parentIdEl) customFields['parentNationalId'] = parentIdEl.value;

            const trackEl = document.getElementById('studentTrack');
            if (trackEl) customFields['studentTrack'] = trackEl.value;

            // Now build the final student object
            const studentData = {
                // Start with existing data to preserve signature, etc.
                ...(existingStudent || {}),

                // Overwrite with fresh data from the form
                id: editingId || Date.now().toString(),
                studentName: document.getElementById('studentName').value,
                studentLevel: document.getElementById('studentLevel').value,
                studentGrade: document.getElementById('studentGrade').value,
                parentName: document.getElementById('parentName').value,
                parentEmail: document.getElementById('parentEmail').value,
                parentWhatsapp: document.getElementById('parentWhatsapp').value,
                contractYear: document.getElementById('contractYear')?.value || new Date().getFullYear().toString(),
                contractTemplateId: document.getElementById('contractTemplate')?.value || '',
                sendMethod: document.getElementById('sendMethod')?.value || 'whatsapp',

                // Add the collected custom fields object
                customFields: customFields,

                // Set default status/date if it's a new student, otherwise keep existing
                contractStatus: existingStudent?.contractStatus || 'pending',
                createdAt: existingStudent?.createdAt || new Date().toISOString()
            };

            db.saveStudent(studentData);
            UI.closeModal();
            UI.renderStudents();
            UI.updateStats();
            UI.showNotification(editingId ? '✅ تم تحديث بيانات الطالب' : '✅ تم تسجيل الطالب بنجاح');
        });
    }

    // Initialize PDF Template Editor Resources
    const initPdfEditorVars = () => {
        const list = document.getElementById('pdfVariablesList');
        if (!list) return;

        // Clear only custom/dynamic buttons if we had a marker, but here we just append if not exists
        // Actually, let's just ensure we append custom fields
        const settings = db.getSettings();
        const customFields = settings.customFields || [];

        // Remove existing custom vars to prevent dupes
        list.querySelectorAll('.var-btn-custom').forEach(b => b.remove());

        // Add Custom Fields
        customFields.forEach(field => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'var-btn var-btn-custom';
            btn.dataset.var = `{${field.label}}`;
            btn.textContent = field.label;
            // Insert before the special image fields or at end
            list.insertBefore(btn, list.querySelector('[data-var="{التوقيع}"]') || null);
        });

        // Re-attach listeners for new buttons if needed (event delegation is better but sticking to current pattern)
        // If current pattern is delegation on parent, we are good.
        // Let's check how clicks are handled. 
        // Logic seems to be in ContractManager or inline? 
        // There was no evident inline click handler in HTML view.
        // Let's add delegation here to be safe.
    };

    // Call this when opening the editor
    const pdfUploadInput = document.getElementById('pdfTemplateInput');
    if (pdfUploadInput) {
        pdfUploadInput.addEventListener('change', () => setTimeout(initPdfEditorVars, 500));
    }
    // Expose for manual refresh if needed
    window.refreshPdfVariables = initPdfEditorVars;

    // Also on page load just in case
    initPdfEditorVars();


    // Event Delegation for Variable Buttons (to fix potential non-working buttons)
    document.getElementById('pdfVariablesList')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('var-btn')) {
            const variable = e.target.dataset.var;
            if (typeof ContractUI !== 'undefined' && ContractUI.handleVariableClick) {
                ContractUI.handleVariableClick(variable);
            } else {
                console.warn('ContractUI not ready');
            }
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.action-group')) {
            document.querySelectorAll('.action-dropdown-menu').forEach(m => m.classList.remove('active'));
        }
    });

    console.log('App Started Successfully');
});
