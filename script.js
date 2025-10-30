(() => {
    // Luxon for date handling
    const { DateTime } = luxon;

    // --- State and Constants ---

    const STAGE_OPTIONS = [
        'Application Received', 'Screening', 'Interview', 'Background Check',
        'Medical', 'Training', 'Enlisted'
    ];
    const STORAGE_KEYS = {
        APPLICANTS: 'recruitment-applicants-v1',
        EVENTS: 'recruitment-events-v1',
        GOAL: 'recruitment-annual-goal-v1'
    };

    let applicants = loadData(STORAGE_KEYS.APPLICANTS, getSeedApplicants);
    let events = loadData(STORAGE_KEYS.EVENTS, getSeedEvents);
    let enlistmentGoal = loadData(STORAGE_KEYS.GOAL, getDefaultGoal);
    let activeMonth = DateTime.now().startOf('month');

    // --- DOM Elements ---

    const dom = {
        applicantsList: document.getElementById('applicants-list'),
        addApplicantBtn: document.getElementById('add-applicant'),
        enlistedCount: document.getElementById('enlisted-count'),
        upcomingCount: document.getElementById('upcoming-count'),
        goalTarget: document.getElementById('goal-target'),
        goalTargetChip: document.getElementById('goal-target-chip'),
        goalProgressCount: document.getElementById('goal-progress-count'),
        goalRemainingText: document.getElementById('goal-remaining-text'),
        annualGoalFill: document.getElementById('annual-goal-fill'),
        eventForm: document.getElementById('event-form'),
        eventList: document.getElementById('events-list'),
        todayEvents: document.getElementById('today-events'),
        eventApplicantSelect: document.getElementById('event-applicant'),
        rssBtn: document.getElementById('rss-feed'),
        menuToggleBtn: document.getElementById('menu-toggle'),
        menuDropdown: document.getElementById('menu-dropdown'),
        settingsToggleBtn: document.getElementById('settings-toggle'),
        settingsPanel: document.getElementById('settings-panel'),
        annualGoalInput: document.getElementById('annual-goal-input'),
        exportBtn: document.getElementById('export-data'),
        importBtn: document.getElementById('import-data'),
        clearBtn: document.getElementById('clear-data'),
        calendarGrid: document.getElementById('calendar-grid'),
        currentMonth: document.getElementById('current-month'),
        prevMonthBtn: document.getElementById('prev-month'),
        nextMonthBtn: document.getElementById('next-month')
    };

    // --- Data Persistence ---

    function loadData(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback();
        } catch (e) {
            console.error(`Error loading data for ${key}:`, e);
            return fallback();
        }
    }

    function saveData(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    // --- Applicant Management ---

    function renderApplicants() {
        dom.applicantsList.innerHTML = '';
        if (applicants.length === 0) {
            dom.applicantsList.innerHTML = `<p class="empty-state">No applicants yet. Add one to get started.</p>`;
            return;
        }
        applicants.forEach(applicant => {
            const card = document.createElement('article');
            card.className = 'applicant-card';
            card.dataset.id = applicant.id;
            card.innerHTML = `
                <div class="applicant-header">
                    <h3 class="editable-name" contenteditable="true">${applicant.name}</h3>
                    <div class="applicant-actions">
                        <select class="field-select stage-select">${STAGE_OPTIONS.map(s => `<option value="${s}" ${s === applicant.stage ? 'selected' : ''}>${s}</option>`).join('')}</select>
                        <button class="primary-btn share-btn">Share PDF</button>
                        <button class="danger-btn remove-btn">Remove</button>
                    </div>
                </div>
                <div class="applicant-grid">${renderApplicantFields(applicant)}</div>
                <div class="field">
                    <label><span>Notes</span>
                        <textarea class="notes-input" placeholder="Observations...">${applicant.notes || ''}</textarea>
                    </label>
                </div>
            `;
            dom.applicantsList.appendChild(card);
        });
    }

    function renderApplicantFields(applicant) {
        const fields = [
            { label: 'Age', key: 'age', type: 'number' },
            { label: 'Health (1-10)', key: 'health', type: 'number' },
            { label: 'Prior Service', key: 'priorService' },
            { label: 'Legal Issues', key: 'legalIssues' },
            { label: 'Education', key: 'education' },
            { label: 'Marital Status', key: 'maritalStatus' },
            { label: 'Dependents', key: 'dependents', type: 'number' },
            { label: 'Tattoos', key: 'tattoos' }
        ];
        return fields.map(field => `
            <div class="field">
                <label><span>${field.label}</span>
                    <input type="${field.type || 'text'}" class="field-input" data-key="${field.key}" value="${applicant[field.key] || ''}" placeholder="...">
                </label>
            </div>
        `).join('');
    }

    function handleApplicantUpdate(id, key, value) {
        const applicant = applicants.find(a => a.id === id);
        if (applicant) {
            applicant[key] = value;
            saveData(STORAGE_KEYS.APPLICANTS, applicants);
            if (key === 'stage') updateSummaryStats();
            if (key === 'name') updateApplicantOptions();
        }
    }

    // --- Event Management ---

    function renderEvents() {
        const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
        dom.eventList.innerHTML = '';
        dom.todayEvents.innerHTML = '';

        if (events.length === 0) {
            dom.eventList.innerHTML = `<p class="empty-state">No events scheduled.</p>`;
        } else {
            sortedEvents.forEach(event => dom.eventList.appendChild(createEventElement(event)));
        }

        const todayStr = DateTime.now().toISODate();
        const todaysEvents = sortedEvents.filter(e => e.date === todayStr);
        if (todaysEvents.length > 0) {
            todaysEvents.forEach(event => dom.todayEvents.appendChild(createEventElement(event, true)));
        } else {
            dom.todayEvents.innerHTML = `<li class="empty-state">No events for today.</li>`;
        }
        updateUpcomingEventsCount();
        renderCalendar();
    }

    function createEventElement(event, isClone = false) {
        const item = document.createElement('li');
        item.className = 'event-item';
        item.dataset.id = event.id;
        const applicantName = applicants.find(a => a.id === event.applicantId)?.name;
        item.innerHTML = `
            <strong>${event.title}</strong>
            <div class="event-meta">${formatEventMeta(event, applicantName)}</div>
            ${event.notes ? `<p class="event-notes">${event.notes}</p>` : ''}
            <div class="event-actions">
                <button class="edit-event-btn">Edit</button>
                <button class="danger-btn delete-event-btn">Delete</button>
            </div>
        `;
        return item;
    }

    // --- UI Updates & Rendering ---

    function updateSummaryStats() {
        const enlistedCount = applicants.filter(a => a.stage === 'Enlisted').length;
        dom.enlistedCount.textContent = enlistedCount;
        updateAnnualGoalUI(enlistedCount);
    }

    function updateUpcomingEventsCount() {
        const upcomingThreshold = DateTime.now().plus({ days: 30 });
        const upcomingCount = events.filter(e => {
            const eventDate = DateTime.fromISO(e.date);
            return eventDate >= DateTime.now() && eventDate <= upcomingThreshold;
        }).length;
        dom.upcomingCount.textContent = upcomingCount;
    }

    function updateAnnualGoalUI(enlisted) {
        dom.goalTarget.textContent = enlistmentGoal;
        dom.goalTargetChip.textContent = enlistmentGoal;
        dom.goalProgressCount.textContent = enlisted;
        dom.annualGoalInput.value = enlistmentGoal;
        const remaining = Math.max(0, enlistmentGoal - enlisted);
        dom.goalRemainingText.textContent = remaining > 0 ? `${remaining} remaining` : 'Goal reached!';
        const percent = enlistmentGoal > 0 ? Math.min(100, (enlisted / enlistmentGoal) * 100) : 0;
        dom.annualGoalFill.style.width = `${percent}%`;
    }

    function renderCalendar() {
        dom.calendarGrid.innerHTML = '';
        dom.currentMonth.textContent = activeMonth.toFormat('LLLL yyyy');

        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        weekdays.forEach(day => {
            dom.calendarGrid.innerHTML += `<div class="calendar-cell heading">${day}</div>`;
        });

        const startOfMonth = activeMonth.startOf('month');
        let dayIterator = startOfMonth.startOf('week');

        for (let i = 0; i < 35; i++) {
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            if (dayIterator.month !== activeMonth.month) cell.classList.add('muted');
            if (dayIterator.hasSame(DateTime.now(), 'day')) cell.classList.add('today');

            cell.innerHTML = `<div class="date">${dayIterator.day}</div>`;
            const dailyEvents = events.filter(e => DateTime.fromISO(e.date).hasSame(dayIterator, 'day'));
            if (dailyEvents.length > 0) {
                const eventsContainer = document.createElement('div');
                eventsContainer.className = 'cell-events';
                dailyEvents.forEach(event => {
                    const eventMarker = document.createElement('span');
                    eventMarker.textContent = event.title;
                    eventsContainer.appendChild(eventMarker);
                });
                cell.appendChild(eventsContainer);
            }
            dom.calendarGrid.appendChild(cell);
            dayIterator = dayIterator.plus({ days: 1 });
        }
    }

    // --- Event Handlers & Initializers ---

    function attachEventListeners() {
        dom.addApplicantBtn.addEventListener('click', () => {
            const newApplicant = { id: crypto.randomUUID(), name: 'New Applicant', stage: STAGE_OPTIONS[0] };
            applicants.push(newApplicant);
            saveData(STORAGE_KEYS.APPLICANTS, applicants);
            renderApplicants();
            updateApplicantOptions();
        });

        dom.applicantsList.addEventListener('input', e => {
            const target = e.target;
            const card = target.closest('.applicant-card');
            const id = card.dataset.id;
            if (target.classList.contains('field-input')) {
                handleApplicantUpdate(id, target.dataset.key, target.value);
            } else if (target.classList.contains('notes-input')) {
                handleApplicantUpdate(id, 'notes', target.value);
            }
        });

        dom.applicantsList.addEventListener('change', e => {
            if (e.target.classList.contains('stage-select')) {
                handleApplicantUpdate(e.target.closest('.applicant-card').dataset.id, 'stage', e.target.value);
            }
        });

        dom.applicantsList.addEventListener('focusout', e => {
            if (e.target.classList.contains('editable-name')) {
                handleApplicantUpdate(e.target.closest('.applicant-card').dataset.id, 'name', e.target.textContent);
            }
        });

        dom.applicantsList.addEventListener('click', e => {
            const target = e.target;
            const card = target.closest('.applicant-card');
            if (!card) return;
            const id = card.dataset.id;
            if (target.classList.contains('remove-btn')) {
                if (confirm('Are you sure you want to remove this applicant?')) {
                    applicants = applicants.filter(a => a.id !== id);
                    saveData(STORAGE_KEYS.APPLICANTS, applicants);
                    renderApplicants();
                    updateApplicantOptions();
                    updateSummaryStats();
                }
            } else if (target.classList.contains('share-btn')) {
                generatePDF(applicants.find(a => a.id === id));
            }
        });

        dom.eventForm.addEventListener('submit', handleEventFormSubmit);
        dom.eventList.addEventListener('click', handleEventActions);
        dom.todayEvents.addEventListener('click', handleEventActions);
        dom.prevMonthBtn.addEventListener('click', () => changeMonth(-1));
        dom.nextMonthBtn.addEventListener('click', () => changeMonth(1));
    }

    function handleEventFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const eventData = Object.fromEntries(formData.entries());
        const id = eventData['event-id'];

        if (id) {
            const index = events.findIndex(event => event.id === id);
            events[index] = { ...events[index], ...eventData };
        } else {
            eventData.id = crypto.randomUUID();
            events.push(eventData);
        }
        saveData(STORAGE_KEYS.EVENTS, events);
        renderEvents();
        e.target.reset();
        document.getElementById('event-id').value = '';
    }

    function handleEventActions(e) {
        const button = e.target.closest('button');
        if (!button) return;
        const item = e.target.closest('.event-item');
        const id = item.dataset.id;

        if (button.classList.contains('delete-event-btn')) {
            events = events.filter(event => event.id !== id);
            saveData(STORAGE_KEYS.EVENTS, events);
            renderEvents();
        } else if (button.classList.contains('edit-event-btn')) {
            const event = events.find(event => event.id === id);
            for (const key in event) {
                const input = dom.eventForm.querySelector(`[name="${key}"]`);
                if (input) input.value = event[key];
            }
            dom.eventForm.querySelector('#event-id').value = id;
        }
    }

    function changeMonth(direction) {
        activeMonth = activeMonth.plus({ months: direction });
        renderCalendar();
    }

    // --- Utility Functions ---

    function formatEventMeta(event, applicantName) {
        let meta = `${DateTime.fromISO(event.date).toFormat('DDD')}`;
        if (event.time) meta += ` at ${event.time}`;
        if (applicantName) meta += ` • ${applicantName}`;
        if (event.stage) meta += ` • Stage: ${event.stage}`;
        return meta;
    }

    function updateApplicantOptions() {
        const options = applicants.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
        dom.eventApplicantSelect.innerHTML = `<option value="">General Event</option>${options}`;
    }

    function generatePDF(applicant) {
        if (typeof jspdf === 'undefined') {
            console.error('jsPDF library is not loaded.');
            alert('Could not generate PDF. The required library is missing.');
            return;
        }
        const { jsPDF } = jspdf;
        const doc = new jsPDF();
        doc.text(`Applicant Report: ${applicant.name}`, 10, 10);
        let y = 20;
        for (const [key, value] of Object.entries(applicant)) {
            if (key !== 'id') {
                doc.text(`${key}: ${value}`, 10, y);
                y += 10;
            }
        }
        doc.save(`${applicant.name}_report.pdf`);
    }

    // --- Seed & Default Data ---

    function getDefaultGoal() { return 40; }

    function getSeedApplicants() {
        return [
            { id: crypto.randomUUID(), name: 'Alex Johnson', stage: 'Interview', notes: 'Strong candidate.' },
            { id: crypto.randomUUID(), name: 'Maria Garcia', stage: 'Screening', notes: 'Follow up on references.' }
        ];
    }

    function getSeedEvents() {
        const applicantId = applicants.length > 0 ? applicants[0].id : '';
        return [{ id: crypto.randomUUID(), title: 'Initial Screening Call', date: DateTime.now().toISODate(), applicantId }];
    }

    // --- App Initialization ---

    function init() {
        renderApplicants();
        renderEvents();
        updateApplicantOptions();
        updateSummaryStats();
        attachEventListeners();
    }

    init();
})();
