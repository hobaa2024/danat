// Firebase Configuration for Dana Al-Oloom Schools
// ================================================
// 
// لتفعيل Firebase، اتبع الخطوات التالية:
// 
// 1. اذهب إلى https://console.firebase.google.com
// 2. أنشئ مشروع جديد (Create Project)
// 3. من القائمة الجانبية اختر "Build" ثم "Realtime Database"
// 4. اضغط "Create Database" واختر "Start in test mode"
// 5. من إعدادات المشروع (Project Settings) > General > Your apps
// 6. اضغط على أيقونة الويب </> لإضافة تطبيق ويب
// 7. انسخ قيم الـ config وضعها هنا بدلاً من القيم الفارغة أدناه
//
// ================================================

const firebaseConfig = {
    apiKey: "AIzaSyAMuB5wgf8NyAOKs3n9ooQHQZ-Z-UJGvt4",
    authDomain: "danataluloom-schools.firebaseapp.com",
    databaseURL: "https://danataluloom-schools-default-rtdb.firebaseio.com",
    projectId: "danataluloom-schools",
    storageBucket: "danataluloom-schools.firebasestorage.app",
    messagingSenderId: "1019874658158",
    appId: "1:1019874658158:web:48beaacade0578f4f7a37f"
};

// Check if Firebase is configured
const isFirebaseConfigured = firebaseConfig.apiKey && firebaseConfig.databaseURL;

let firebaseDb = null;

// Initialize Firebase if configured
if (isFirebaseConfigured && typeof firebase !== 'undefined') {
    try {
        firebase.initializeApp(firebaseConfig);
        firebaseDb = firebase.database();
        console.log('✅ Firebase initialized successfully');
    } catch (e) {
        console.error('Firebase initialization error:', e);
    }
} else if (!isFirebaseConfigured) {
    console.warn('⚠️ Firebase not configured. Using localStorage only.');
}

// Cloud Database Manager
const CloudDB = {
    // Save student data to Firebase
    saveStudent(student) {
        if (!firebaseDb) return Promise.resolve(false);

        return firebaseDb.ref('students/' + student.id).set(student)
            .then(() => {
                console.log('☁️ Student saved to cloud:', student.studentName);
                return true;
            })
            .catch(err => {
                console.error('Cloud save error:', err);
                return false;
            });
    },

    // Update student status and contract data
    updateContract(studentId, data) {
        if (!firebaseDb) return Promise.resolve(false);

        return firebaseDb.ref('students/' + studentId).update(data)
            .then(() => {
                console.log('☁️ Contract updated in cloud for:', studentId);
                return true;
            })
            .catch(err => {
                console.error('Cloud update error:', err);
                return false;
            });
    },

    // Get student by ID from Firebase
    getStudent(id) {
        if (!firebaseDb) return Promise.resolve(null);

        return firebaseDb.ref('students/' + id).once('value')
            .then(snapshot => snapshot.val())
            .catch(err => {
                console.error('Cloud fetch student error:', err);
                return null;
            });
    },

    // Get all students from Firebase
    getStudents() {
        if (!firebaseDb) return Promise.resolve([]);

        return firebaseDb.ref('students').once('value')
            .then(snapshot => {
                const data = snapshot.val();
                if (!data) return [];
                return Object.values(data);
            })
            .catch(err => {
                console.error('Cloud fetch error:', err);
                return [];
            });
    },

    // Listen for real-time updates
    listenForUpdates(callback, errorCallback) {
        if (!firebaseDb) return;

        firebaseDb.ref('students').on('value', snapshot => {
            const data = snapshot.val();
            const students = data ? Object.values(data) : [];
            console.log('☁️ Real-time update received:', students.length, 'students');
            callback(students);
        }, (error) => {
            console.error('Cloud listen error:', error);
            if (errorCallback) errorCallback(error);
        });
    },

    // Monitor connection state
    monitorConnection(callback) {
        if (!firebaseDb) return;
        firebaseDb.ref(".info/connected").on("value", (snap) => {
            callback(!!snap.val());
        });
    },

    // Sync local data to cloud (admin use)
    syncLocalToCloud() {
        if (!firebaseDb) {
            console.warn('Firebase not configured');
            return Promise.resolve(false);
        }

        const localStudents = JSON.parse(localStorage.getItem('students') || '[]');
        const updates = {};

        localStudents.forEach(student => {
            updates['students/' + student.id] = student;
        });

        return firebaseDb.ref().update(updates)
            .then(() => {
                console.log('☁️ Local data synced to cloud:', localStudents.length, 'students');
                return true;
            })
            .catch(err => {
                console.error('Sync error:', err);
                return false;
            });
    },

    // Sync cloud data to local (admin use)
    syncCloudToLocal() {
        return this.getStudents().then(students => {
            if (students.length > 0) {
                localStorage.setItem('students', JSON.stringify(students));
                console.log('☁️ Cloud data synced to local:', students.length, 'students');
                return true;
            }
            return false;
        });
    },

    // Check if Firebase is ready
    isReady() {
        return !!firebaseDb;
    },

    // Delete student from Cloud
    deleteStudent(id) {
        if (!firebaseDb) return Promise.resolve(false);
        return firebaseDb.ref('students/' + id).remove()
            .then(() => {
                console.log('☁️ Student deleted from cloud:', id);
                return true;
            })
            .catch(err => {
                console.error('Cloud delete error:', err);
                return false;
            });
    },

    // --- CONTRACT TEMPLATES CLOUD SYNC ---

    getSettings() {
        if (!firebaseDb) return Promise.resolve(null);
        return firebaseDb.ref('settings/appSettings').once('value')
            .then(snapshot => snapshot.val())
            .catch(err => {
                console.error('Cloud fetch settings error:', err);
                return null;
            });
    },

    saveSettings(settings) {
        if (!firebaseDb) return Promise.resolve(false);

        // Save the entire settings object to a known path
        return firebaseDb.ref('settings/appSettings').set(settings)
            .then(() => {
                console.log('☁️ Settings saved to cloud.');
                return true;
            })
            .catch(err => {
                console.error('Cloud settings save error:', err);
                return false;
            });
    },
    saveContractTemplate(template) {
        if (!firebaseDb) return Promise.resolve(false);
        // We only save the essential template info. 
        // Note: Full PDF data might be large, but RTDB handles up to 10MB per leaf. 
        // Base64 PDFs are usually 1-3MB, so it should be fine.
        return firebaseDb.ref('templates/' + template.id).set(template)
            .then(() => {
                console.log('☁️ Template saved to cloud:', template.title);
                return true;
            })
            .catch(err => {
                console.error('Template cloud save error:', err);
                return false;
            });
    },

    getContractTemplate(id) {
        if (!firebaseDb) return Promise.resolve(null);
        return firebaseDb.ref('templates/' + id).once('value')
            .then(snapshot => snapshot.val())
            .catch(err => {
                console.error('Cloud fetch template error:', err);
                return null;
            });
    },

    getContractTemplates() {
        if (!firebaseDb) return Promise.resolve([]);
        return firebaseDb.ref('templates').once('value')
            .then(snapshot => {
                const data = snapshot.val();
                if (!data) return [];
                return Object.values(data);
            })
            .catch(err => {
                console.error('Cloud fetch templates error:', err);
                return [];
            });
    }
};

// Make available globally
window.CloudDB = CloudDB;
window.isFirebaseConfigured = isFirebaseConfigured;
