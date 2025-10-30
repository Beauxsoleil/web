(() => {
    const { DateTime } = luxon;
    const STORAGE_KEY = 'ApplicationSupport/RecruiterWorkspace/store';
    const CURRENT_SCHEMA = 3;

    const STAGE_OPTIONS = [
        'Prospect',
        'Application Received',
        'Screening',
        'Interview',
        'Background Check',
        'Medical',
        'Training',
        'Enlisted'
    ];

    const EVENT_TYPES = ['Engagement', 'Screening', 'Shipping', 'Drill', 'Sustainment'];

    const EVENT_TEMPLATES = [
        {
            id: 'screening-day',
            label: 'Medical Screening',
            needs: 'Bring medical documents, hydration plan, and travel vouchers.',
            message: 'Reminder: medical screening tomorrow. Ensure applicant arrives 30 mins early with hydration and paperwork.'
        },
        {
            id: 'ship-week',
            label: 'Ship Week Touch',
            needs: 'Confirm travel bag, hotel reservations, and command sponsor hand-off.',
            message: 'Ship week touch completed. Coordinate final travel details and confirm family contact tree.'
        },
        {
            id: 'drill-check',
            label: 'Drill Check-in',
            needs: 'Update drill attendance roster and transportation plan.',
            message: 'Weekly drill check complete. Share SAS tracker with 1SG for accountability.'
        }
    ];

    const DEFAULT_SNIPPETS = [
        {
            id: crypto.randomUUID(),
            title: 'Welcome Text',
            body: 'Hey {name}, welcome to the team! Let me know if you have any questions about next steps.'
        },
        {
            id: crypto.randomUUID(),
            title: 'Medical Reminder',
            body: "Reminder: bring hydration, meal voucher, and paperwork to tomorrow's medical screening."
        }
    ];

    const ACCENT_THEMES = {
        indigo: '#4f46e5',
        emerald: '#059669',
        amber: '#f59e0b',
        rose: '#e11d48'
    };
    const BodyCompService = (() => {
        const screeningWeights = {
            male: { 60: 141, 61: 145, 62: 150, 63: 155, 64: 160, 65: 165, 66: 170, 67: 175, 68: 180, 69: 186, 70: 192 },
            female: { 60: 128, 61: 132, 62: 136, 63: 141, 64: 146, 65: 150, 66: 155, 67: 160, 68: 165, 69: 170, 70: 175 }
        };

        const allowableBodyFat = {
            male: { 17: 20, 20: 22, 25: 24, 30: 26, 35: 27, 40: 28 },
            female: { 17: 30, 20: 32, 25: 34, 30: 36, 35: 38, 40: 39 }
        };

        const tapeChart = {
            male: [
                { neck: 16, waist: 34, bodyFat: 18 },
                { neck: 15, waist: 36, bodyFat: 22 },
                { neck: 14, waist: 38, bodyFat: 26 }
            ],
            female: [
                { neck: 13, waist: 32, hip: 38, bodyFat: 28 },
                { neck: 12, waist: 34, hip: 40, bodyFat: 32 },
                { neck: 11, waist: 36, hip: 42, bodyFat: 36 }
            ]
        };

        function screeningWeightFor(height, gender) {
            const table = screeningWeights[gender] ?? screeningWeights.male;
            if (!height) return null;
            const rounded = Math.round(height);
            return table[rounded] ?? null;
        }

        function allowableBodyFatFor(age, gender) {
            const table = allowableBodyFat[gender] ?? allowableBodyFat.male;
            const keys = Object.keys(table)
                .map(Number)
                .sort((a, b) => a - b);
            let value = table[keys[0]];
            keys.forEach((key) => {
                if (age >= key) value = table[key];
            });
            return value;
        }

        function lookupTapeEstimate({ gender = 'male', neck, waist, hip }) {
            const table = tapeChart[gender] ?? tapeChart.male;
            const match = table.find((entry) => {
                const neckMatch = !entry.neck || !neck || Math.abs(entry.neck - neck) <= 0.75;
                const waistMatch = !entry.waist || !waist || Math.abs(entry.waist - waist) <= 1.5;
                const hipMatch = !entry.hip || !hip || Math.abs(entry.hip - hip) <= 1.5;
                return neckMatch && waistMatch && hipMatch;
            });
            return match?.bodyFat ?? null;
        }

        function evaluateBodyComp(applicant) {
            const height = Number(applicant.height);
            const weight = Number(applicant.weight);
            const age = Number(applicant.age) || 18;
            const gender = applicant.gender || 'male';
            const neck = Number(applicant.neck);
            const waist = Number(applicant.waist);
            const hip = Number(applicant.hip);

            if (!height || !weight) {
                return { status: 'incomplete', message: 'Provide height and weight to evaluate screening standards.' };
            }

            const maxWeight = screeningWeightFor(height, gender);
            if (maxWeight && weight <= maxWeight) {
                return { status: 'within', message: `Meets screening weight. Max ${maxWeight} lb for ${height} in ${gender} applicant.` };
            }

            const allowable = allowableBodyFatFor(age, gender);
            const tapeEstimate = lookupTapeEstimate({ gender, neck, waist, hip });
            if (tapeEstimate && tapeEstimate <= allowable) {
                return { status: 'tape', message: `Requires body fat calculation. Estimated ${tapeEstimate}% (max ${allowable}%).` };
            }

            return { status: 'over', message: `Exceeds screening and estimated body fat (${tapeEstimate ?? 'N/A'}%). Start nutrition and fitness coaching.` };
        }

        return { evaluateBodyComp, screeningWeightFor, allowableBodyFatFor };
    })();
    function createStore() {
        const listeners = new Set();
        let state = migrate(load() ?? seed());

        function load() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                return raw ? JSON.parse(raw) : null;
            } catch (error) {
                console.warn('Unable to load store', error);
                return null;
            }
        }

        function seed() {
            const now = DateTime.now().toISO();
            return {
                schemaVersion: CURRENT_SCHEMA,
                applicants: [
                    {
                        id: crypto.randomUUID(),
                        name: 'Jordan Lee',
                        stage: 'Screening',
                        createdAt: now,
                        touchedAt: now,
                        age: 22,
                        phone: '555-0102',
                        email: 'jordan.lee@example.com',
                        height: 68,
                        weight: 175,
                        gender: 'male',
                        notes: 'Completed packet review. Awaiting medical clearance.',
                        tattoos: 'None noted',
                        health: 'Excellent',
                        demographics: { city: 'Orlando, FL', guardian: 'N/A' },
                        contact: { preferred: 'Phone', address: '123 Main St' },
                        stageHistory: [{ stage: 'Screening', changedAt: now }],
                        bodyComp: BodyCompService.evaluateBodyComp({ height: 68, weight: 175, age: 22, gender: 'male' }),
                        checklist: ['DD Form 4', 'Medical Pre-screen'],
                        lastEnlistedUpdate: null
                    },
                    {
                        id: crypto.randomUUID(),
                        name: 'Avery Kim',
                        stage: 'Enlisted',
                        createdAt: now,
                        touchedAt: now,
                        age: 19,
                        phone: '555-0145',
                        email: 'avery.kim@example.com',
                        height: 65,
                        weight: 150,
                        gender: 'female',
                        notes: 'Shipped last drill weekend. First drill in two weeks.',
                        tattoos: 'Wrist tattoo documented',
                        health: 'Good',
                        demographics: { city: 'Jacksonville, FL', guardian: 'Sergeant Kim' },
                        contact: { preferred: 'Text', address: '456 River Rd' },
                        stageHistory: [
                            { stage: 'Training', changedAt: DateTime.now().minus({ weeks: 3 }).toISO() },
                            { stage: 'Enlisted', changedAt: now }
                        ],
                        bodyComp: BodyCompService.evaluateBodyComp({ height: 65, weight: 150, age: 19, gender: 'female' }),
                        checklist: ['Ship Documents'],
                        lastEnlistedUpdate: now
                    }
                ],
                events: [
                    {
                        id: crypto.randomUUID(),
                        title: 'Medical Screening',
                        date: DateTime.now().plus({ days: 2 }).toISODate(),
                        time: '08:00',
                        type: 'Screening',
                        applicantId: null,
                        templateId: 'screening-day',
                        notes: 'Coordinate travel vouchers.'
                    },
                    {
                        id: crypto.randomUUID(),
                        title: 'Ship Week Touch',
                        date: DateTime.now().plus({ days: 6 }).toISODate(),
                        time: '13:30',
                        type: 'Shipping',
                        applicantId: null,
                        templateId: 'ship-week',
                        notes: 'Call 1SG and confirm lodging.'
                    }
                ],
                checklist: [],
                logo: null,
                settings: {
                    recruiterName: 'Staff Sgt. Casey',
                    accentTheme: 'indigo',
                    annualGoal: 30,
                    agingWarn: 5,
                    agingDanger: 9,
                    sasReminderLead: 3,
                    calendar: 'default'
                },
                sas: {
                    reminderDay: 'Monday',
                    reminderTime: '08:30',
                    nextReminderAt: null
                },
                workstation: {
                    drills: [],
                    snippets: DEFAULT_SNIPPETS,
                    packItems: []
                }
            };
        }

        function migrate(data) {
            if (!data) return seed();
            let migrated = { ...data };
            if (!migrated.schemaVersion) migrated.schemaVersion = 1;

            if (migrated.schemaVersion < 2) {
                migrated.settings = {
                    recruiterName: '',
                    accentTheme: 'indigo',
                    annualGoal: 25,
                    agingWarn: 5,
                    agingDanger: 9,
                    sasReminderLead: 3,
                    calendar: 'default',
                    ...migrated.settings
                };
                migrated.schemaVersion = 2;
            }

            if (migrated.schemaVersion < CURRENT_SCHEMA) {
                migrated.workstation = migrated.workstation ?? { drills: [], snippets: DEFAULT_SNIPPETS, packItems: [] };
                migrated.checklist = migrated.checklist ?? [];
                migrated.schemaVersion = CURRENT_SCHEMA;
            }

            return migrated;
        }

        function persist() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            } catch (error) {
                console.warn('Unable to persist store', error);
            }
        }

        function setState(producer) {
            const draft = structuredClonePolyfill(state);
            producer(draft);
            draft.schemaVersion = CURRENT_SCHEMA;
            state = draft;
            persist();
            listeners.forEach((listener) => listener(getState()));
        }

        function getState() {
            return structuredClonePolyfill(state);
        }

        function subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }

        return { getState, setState, subscribe };
    }

    function structuredClonePolyfill(value) {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
        return JSON.parse(JSON.stringify(value));
    }
    const store = createStore();

    const elements = {
        tabButtons: document.querySelectorAll('.tab-btn'),
        panels: document.querySelectorAll('.tab-panel'),
        applicantStageSelect: document.getElementById('applicant-stage'),
        stageFilter: document.getElementById('stage-filter'),
        applicantSearch: document.getElementById('applicant-search'),
        applicantList: document.getElementById('applicant-list'),
        applicantForm: document.getElementById('applicant-form'),
        evaluateBodyComp: document.getElementById('evaluate-body-comp'),
        goalProgress: document.getElementById('goal-progress'),
        dashboardGoal: document.getElementById('dashboard-goal'),
        goalEnlisted: document.getElementById('goal-enlisted'),
        goalRemaining: document.getElementById('goal-remaining'),
        touchedMetric: document.getElementById('touched-this-week'),
        touchedList: document.getElementById('touched-list'),
        dashboardEvents: document.getElementById('dashboard-events'),
        upcomingCount: document.getElementById('upcoming-count'),
        testAging: document.getElementById('test-aging'),
        eventForm: document.getElementById('event-form'),
        eventList: document.getElementById('event-list'),
        eventType: document.getElementById('event-type'),
        eventFilter: document.getElementById('event-filter'),
        eventApplicant: document.getElementById('event-applicant'),
        eventTemplate: document.getElementById('event-template'),
        calendarPreview: document.getElementById('calendar-preview'),
        insertCalendar: document.getElementById('insert-calendar'),
        handoffText: document.getElementById('handoff-text'),
        resetEvent: document.getElementById('reset-event'),
        checklistForm: document.getElementById('checklist-form'),
        checklistItems: document.getElementById('checklist-items'),
        scanDocument: document.getElementById('scan-document'),
        scanModal: document.getElementById('scan-modal'),
        closeModal: document.getElementById('close-modal'),
        scanInput: document.getElementById('scan-input'),
        scanPreview: document.getElementById('scan-preview'),
        ocrSuggestions: document.getElementById('ocr-suggestions'),
        sasList: document.getElementById('sas-list'),
        sasDay: document.getElementById('sas-day'),
        sasTime: document.getElementById('sas-time'),
        sasSettingsForm: document.getElementById('sas-settings'),
        testSas: document.getElementById('test-sas'),
        generateSas: document.getElementById('generate-sas'),
        generateReport: document.getElementById('generate-report'),
        exportWeek: document.getElementById('export-week'),
        shareWeek: document.getElementById('share-week'),
        importFile: document.getElementById('import-file'),
        exportStore: document.getElementById('export-store'),
        importStore: document.getElementById('import-store'),
        shareStore: document.getElementById('share-store'),
        clearStore: document.getElementById('clear-store'),
        drillForm: document.getElementById('drill-form'),
        drillMonth: document.getElementById('drill-month'),
        drillFocus: document.getElementById('drill-focus'),
        drillList: document.getElementById('drill-list'),
        snippetForm: document.getElementById('snippet-form'),
        snippetTitle: document.getElementById('snippet-title'),
        snippetBody: document.getElementById('snippet-body'),
        snippetList: document.getElementById('snippet-list'),
        packForm: document.getElementById('pack-form'),
        packItem: document.getElementById('pack-item'),
        tripNotes: document.getElementById('trip-notes'),
        packList: document.getElementById('pack-list'),
        settingsForm: document.getElementById('settings-form'),
        profileName: document.getElementById('profile-name'),
        accentTheme: document.getElementById('accent-theme'),
        annualGoal: document.getElementById('annual-goal'),
        agingWarn: document.getElementById('aging-warn'),
        agingDanger: document.getElementById('aging-danger'),
        sasLead: document.getElementById('sas-lead'),
        calendarSelect: document.getElementById('calendar-select'),
        gatorGame: document.getElementById('gator-game'),
        gatorScore: document.getElementById('gator-score'),
        logoTrigger: document.getElementById('logo-trigger'),
        logoDisplay: document.getElementById('logo-display'),
        logoInput: document.getElementById('logo-input')
    };

    const NotificationService = (() => {
        let permission = 'default';
        let timers = new Map();

        function init() {
            if (!('Notification' in window)) {
                permission = 'denied';
                return;
            }
            Notification.requestPermission().then((status) => {
                permission = status;
            });
        }

        function send(title, options = {}) {
            if (permission !== 'granted') {
                console.info('Notification:', title, options.body ?? '');
                return;
            }
            new Notification(title, options);
        }

        function clearTimer(id) {
            const existing = timers.get(id);
            if (existing) {
                if (existing.timeout) clearTimeout(existing.timeout);
                if (existing.interval) clearInterval(existing.interval);
                timers.delete(id);
            }
        }

        function scheduleDaily(id, hour, minute, callback) {
            clearTimer(id);
            const now = DateTime.now();
            let next = now.set({ hour, minute, second: 0, millisecond: 0 });
            if (next <= now) next = next.plus({ days: 1 });
            const wait = next.diff(now).as('milliseconds');
            const timeout = setTimeout(() => {
                callback();
                const interval = setInterval(callback, 24 * 60 * 60 * 1000);
                timers.set(id, { timeout: null, interval });
            }, wait);
            timers.set(id, { timeout, interval: null });
        }

        return { init, send, scheduleDaily, clearTimer };
    })();
    function init() {
        NotificationService.init();
        bindTabs();
        populateSelects();
        registerEventHandlers();
        elements.gatorScore.dataset.score = elements.gatorScore.dataset.score || '0';
        applyAccentTheme(store.getState().settings.accentTheme);
        store.subscribe(render);
        render(store.getState());
        scheduleNotifications();
    }

    function bindTabs() {
        elements.tabButtons.forEach((button) => {
            button.addEventListener('click', () => switchTab(button.dataset.tab));
        });
    }

    function switchTab(tabId) {
        elements.tabButtons.forEach((button) => {
            const isActive = button.dataset.tab === tabId;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-selected', String(isActive));
        });
        elements.panels.forEach((panel) => {
            panel.hidden = panel.id !== tabId;
        });
    }

    function populateSelects() {
        STAGE_OPTIONS.forEach((stage) => {
            addOption(elements.applicantStageSelect, stage, stage);
            addOption(elements.stageFilter, stage, stage);
        });
        addOption(elements.stageFilter, 'All', 'All', true);
        elements.stageFilter.value = 'All';

        EVENT_TYPES.forEach((type) => {
            addOption(elements.eventType, type, type);
            addOption(elements.eventFilter, type, type);
        });
        addOption(elements.eventFilter, 'All', 'All', true);
        elements.eventFilter.value = 'All';

        EVENT_TEMPLATES.forEach((template) => addOption(elements.eventTemplate, template.id, template.label));

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach((day) => addOption(elements.sasDay, day, day));

        for (let month = 1; month <= 12; month += 1) {
            const label = DateTime.local(2024, month).toFormat('LLLL');
            addOption(elements.drillMonth, month.toString(), label);
        }

        Object.entries(ACCENT_THEMES).forEach(([key, value]) => {
            addOption(elements.accentTheme, key, `${key.charAt(0).toUpperCase()}${key.slice(1)}`);
        });

        ['default', 'Unit Calendar', 'SAS Calendar'].forEach((calendar) => addOption(elements.calendarSelect, calendar, calendar));
    }

    function addOption(select, value, label, prepend = false) {
        if (!select) return;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        if (prepend && select.firstChild) {
            select.insertBefore(option, select.firstChild);
        } else {
            select.appendChild(option);
        }
    }
    function registerEventHandlers() {
        elements.applicantForm.addEventListener('submit', handleApplicantSubmit);
        elements.evaluateBodyComp.addEventListener('click', handleQuickBodyComp);
        elements.applicantSearch.addEventListener('input', () => renderApplicants(store.getState()));
        elements.stageFilter.addEventListener('change', () => renderApplicants(store.getState()));

        elements.eventForm.addEventListener('submit', handleEventSubmit);
        elements.eventFilter.addEventListener('change', () => renderEvents(store.getState()));
        elements.eventTemplate.addEventListener('change', handleTemplateSelect);
        elements.resetEvent.addEventListener('click', resetEventForm);
        elements.insertCalendar.addEventListener('click', downloadSelectedEventIcs);
        elements.handoffText.addEventListener('click', copyHandoffText);

        elements.checklistForm.addEventListener('submit', handleChecklistSubmit);
        elements.scanDocument.addEventListener('click', openScanModal);
        elements.closeModal.addEventListener('click', closeScanModal);
        elements.scanInput.addEventListener('change', handleScanInput);

        elements.sasSettingsForm.addEventListener('submit', handleSasSettingsSubmit);
        elements.testSas.addEventListener('click', () => sendSasReminder(true));
        elements.generateSas.addEventListener('click', generateSasPdf);

        elements.generateReport.addEventListener('click', generatePipelineReport);
        elements.exportWeek.addEventListener('click', exportWeeklySnapshot);
        elements.shareWeek.addEventListener('click', shareWeeklySnapshot);
        elements.importFile.addEventListener('change', handleImportSnapshot);

        elements.exportStore.addEventListener('click', exportStore);
        elements.importStore.addEventListener('click', triggerImportStore);
        elements.shareStore.addEventListener('click', shareStore);
        elements.clearStore.addEventListener('click', clearStore);

        elements.drillForm.addEventListener('submit', handleDrillSubmit);
        elements.snippetForm.addEventListener('submit', handleSnippetSubmit);
        elements.packForm.addEventListener('submit', handlePackSubmit);

        elements.settingsForm.addEventListener('submit', handleSettingsSubmit);

        elements.gatorGame.addEventListener('click', playGatorGame);
        elements.gatorGame.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                playGatorGame();
            }
        });

        elements.logoTrigger.addEventListener('click', () => elements.logoInput.click());
        elements.logoInput.addEventListener('change', handleLogoUpload);
    }

    function render(state) {
        renderDashboard(state);
        updateApplicantOptions(state);
        renderApplicants(state);
        renderChecklist(state);
        renderEvents(state);
        renderSas(state);
        renderWorkstation(state);
        renderSettings(state);
        renderLogo(state);
        updateCalendarPreview(null);
    }
    function renderDashboard(state) {
        const goal = state.settings.annualGoal ?? 0;
        const enlistedCount = state.applicants.filter((applicant) => applicant.stage === 'Enlisted').length;
        elements.dashboardGoal.textContent = `${goal} goal`;
        elements.goalEnlisted.textContent = enlistedCount.toString();
        elements.goalRemaining.textContent = Math.max(goal - enlistedCount, 0).toString();
        const percent = goal > 0 ? Math.min(100, Math.round((enlistedCount / goal) * 100)) : 0;
        elements.goalProgress.style.width = `${percent}%`;
        elements.goalProgress.setAttribute('aria-valuenow', percent.toString());

        const weekAgo = DateTime.now().minus({ days: 7 });
        const touched = state.applicants
            .filter((applicant) => DateTime.fromISO(applicant.touchedAt) >= weekAgo)
            .sort((a, b) => b.touchedAt.localeCompare(a.touchedAt));
        elements.touchedMetric.textContent = touched.length.toString();
        elements.touchedList.innerHTML = '';
        if (!touched.length) {
            elements.touchedList.appendChild(emptyListItem('No applicants touched in the last 7 days.'));
        } else {
            touched.forEach((applicant) => {
                const li = document.createElement('li');
                li.innerHTML = `<div><strong>${applicant.name}</strong><div class="fine-print">Stage: ${applicant.stage}</div></div><span>${DateTime.fromISO(applicant.touchedAt).toRelative()}</span>`;
                elements.touchedList.appendChild(li);
            });
        }

        const upcoming = state.events
            .map((event) => ({ ...event, dateTime: DateTime.fromISO(`${event.date}T${event.time || '00:00'}`) }))
            .filter((event) => event.dateTime >= DateTime.now())
            .sort((a, b) => a.dateTime.toMillis() - b.dateTime.toMillis())
            .slice(0, 4);
        elements.upcomingCount.textContent = upcoming.length.toString();
        elements.dashboardEvents.innerHTML = '';
        if (!upcoming.length) {
            elements.dashboardEvents.appendChild(emptyListItem('No upcoming events.'));
        } else {
            upcoming.forEach((event) => {
                const li = document.createElement('li');
                li.innerHTML = `<div><strong>${event.title}</strong><div class="fine-print">${event.dateTime.toFormat('DDD t')}</div></div><span class="badge">${event.type}</span>`;
                elements.dashboardEvents.appendChild(li);
            });
        }

        elements.testAging.onclick = () => sendAgingSummary(state, true);
    }

    function emptyListItem(message) {
        const li = document.createElement('li');
        li.textContent = message;
        return li;
    }

    function updateApplicantOptions(state) {
        const options = state.applicants
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((applicant) => ({ value: applicant.id, label: applicant.name }));
        const select = elements.eventApplicant;
        const current = select.value;
        select.innerHTML = '<option value="">-- General Event --</option>';
        options.forEach(({ value, label }) => addOption(select, value, label));
        if (options.some((option) => option.value === current)) {
            select.value = current;
        }
    }
    function renderApplicants(state) {
        const search = elements.applicantSearch.value.trim().toLowerCase();
        const stageFilter = elements.stageFilter.value;
        const list = elements.applicantList;
        list.innerHTML = '';

        const applicants = state.applicants
            .filter((applicant) => {
                const matchesStage = stageFilter === 'All' || applicant.stage === stageFilter;
                const matchesSearch =
                    !search ||
                    applicant.name.toLowerCase().includes(search) ||
                    (applicant.notes ?? '').toLowerCase().includes(search);
                return matchesStage && matchesSearch;
            })
            .sort((a, b) => b.touchedAt.localeCompare(a.touchedAt));

        if (!applicants.length) {
            list.appendChild(emptyListItem('No applicants match the filters.'));
            return;
        }

        applicants.forEach((applicant) => list.appendChild(buildApplicantCard(applicant)));
    }

    function buildApplicantCard(applicant) {
        const card = document.createElement('article');
        card.className = 'card applicant-card';

        const header = document.createElement('header');
        header.className = 'filter-header';
        const titleWrap = document.createElement('div');
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = applicant.name;
        nameInput.addEventListener('change', () => updateApplicant(applicant.id, (draft) => (draft.name = nameInput.value.trim() || 'Unnamed Applicant')));
        const stageSelect = document.createElement('select');
        STAGE_OPTIONS.forEach((stage) => addOption(stageSelect, stage, stage));
        stageSelect.value = applicant.stage;
        stageSelect.addEventListener('change', () => confirmStageChange(applicant, stageSelect.value));
        const touched = document.createElement('div');
        touched.className = 'fine-print';
        touched.textContent = `Touched ${DateTime.fromISO(applicant.touchedAt).toRelative()}`;
        titleWrap.appendChild(nameInput);
        titleWrap.appendChild(touched);

        const headerActions = document.createElement('div');
        headerActions.className = 'card-actions';
        headerActions.append(stageSelect, buildButton('ghost-btn', 'Checklist', () => focusChecklist(applicant)));
        header.append(titleWrap, headerActions);

        const grid = document.createElement('div');
        grid.className = 'stacked';

        const contactRow = document.createElement('div');
        contactRow.className = 'form-row';
        contactRow.append(
            buildLabeledInput('Phone', applicant.phone, (value) => updateApplicant(applicant.id, (draft) => (draft.phone = value))),
            buildLabeledInput('Email', applicant.email, (value) => updateApplicant(applicant.id, (draft) => (draft.email = value))),
            buildLabeledInput('City', applicant.demographics?.city ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.demographics.city = value)))
        );
        grid.appendChild(contactRow);

        const healthRow = document.createElement('div');
        healthRow.className = 'form-row';
        healthRow.append(
            buildLabeledInput('Age', applicant.age ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.age = Number(value) || null)), 'number'),
            buildLabeledInput('Height (in)', applicant.height ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.height = Number(value) || null)), 'number'),
            buildLabeledInput('Weight (lb)', applicant.weight ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.weight = Number(value) || null)), 'number')
        );
        grid.appendChild(healthRow);

        const tapeRow = document.createElement('div');
        tapeRow.className = 'form-row';
        tapeRow.append(
            buildLabeledInput('Neck', applicant.neck ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.neck = Number(value) || null)), 'number'),
            buildLabeledInput('Waist', applicant.waist ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.waist = Number(value) || null)), 'number'),
            buildLabeledInput('Hip', applicant.hip ?? '', (value) => updateApplicant(applicant.id, (draft) => (draft.hip = Number(value) || null)), 'number')
        );
        grid.appendChild(tapeRow);

        const bodyComp = document.createElement('div');
        bodyComp.className = 'fine-print';
        bodyComp.textContent = applicant.bodyComp?.message ?? 'Body composition pending evaluation.';
        grid.appendChild(bodyComp);

        const notes = document.createElement('textarea');
        notes.value = applicant.notes ?? '';
        notes.rows = 3;
        notes.addEventListener('change', () => updateApplicant(applicant.id, (draft) => (draft.notes = notes.value)));
        grid.appendChild(notes);

        const stageHistory = document.createElement('div');
        stageHistory.className = 'fine-print';
        stageHistory.innerHTML = `<strong>Stage History:</strong> ${applicant.stageHistory
            .map((entry) => `${entry.stage} (${DateTime.fromISO(entry.changedAt).toFormat('DD')})`)
            .join(' → ')}`;
        grid.appendChild(stageHistory);

        const checklist = document.createElement('div');
        checklist.className = 'fine-print';
        checklist.innerHTML = `<strong>Checklist:</strong> ${(applicant.checklist ?? []).join(', ') || 'No items yet.'}`;
        grid.appendChild(checklist);

        const footer = document.createElement('div');
        footer.className = 'card-actions';
        footer.append(
            buildButton('ghost-btn', 'Evaluate Body Comp', () => evaluateApplicantBodyComp(applicant)),
            buildButton('danger-btn', 'Remove', () => removeApplicant(applicant.id))
        );

        card.append(header, grid, footer);
        return card;
    }
    function buildLabeledInput(label, value, onChange, type = 'text') {
        const wrapper = document.createElement('label');
        wrapper.textContent = label;
        const input = document.createElement('input');
        input.type = type;
        input.value = value ?? '';
        input.addEventListener('change', () => onChange(type === 'number' ? Number(input.value) || null : input.value));
        wrapper.appendChild(input);
        return wrapper;
    }

    function buildButton(className, label, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
    }

    function updateApplicant(id, updater) {
        store.setState((draft) => {
            const applicant = draft.applicants.find((item) => item.id === id);
            if (!applicant) return;
            updater(applicant);
            applicant.touchedAt = DateTime.now().toISO();
        });
    }

    function confirmStageChange(applicant, newStage) {
        if (newStage === applicant.stage) return;
        const confirmed = confirm(`Mark ${applicant.name} as ${newStage}? This updates history and activity timestamps.`);
        if (!confirmed) {
            renderApplicants(store.getState());
            return;
        }
        store.setState((draft) => {
            const record = draft.applicants.find((item) => item.id === applicant.id);
            if (!record) return;
            record.stage = newStage;
            record.stageHistory = record.stageHistory || [];
            record.stageHistory.push({ stage: newStage, changedAt: DateTime.now().toISO() });
            record.touchedAt = DateTime.now().toISO();
            if (newStage === 'Enlisted') {
                record.lastEnlistedUpdate = DateTime.now().toISO();
            }
        });
    }

    function focusChecklist(applicant) {
        switchTab('inbox');
        document.getElementById('checklist-name').value = `${applicant.name} - `;
    }

    function evaluateApplicantBodyComp(applicant) {
        store.setState((draft) => {
            const target = draft.applicants.find((item) => item.id === applicant.id);
            if (!target) return;
            const result = BodyCompService.evaluateBodyComp(target);
            target.bodyComp = result;
            target.touchedAt = DateTime.now().toISO();
            if (result.status === 'within') {
                target.checklist = Array.from(new Set([...(target.checklist ?? []), 'Body Comp Cleared']));
            } else if (result.status === 'tape') {
                target.checklist = Array.from(new Set([...(target.checklist ?? []), 'Tape Log Required']));
            } else if (result.status === 'over') {
                target.checklist = Array.from(new Set([...(target.checklist ?? []), 'Nutrition Coaching']));
            }
        });
    }
    function handleApplicantSubmit(event) {
        event.preventDefault();
        const applicant = {
            id: crypto.randomUUID(),
            name: document.getElementById('applicant-name').value || 'New Applicant',
            stage: elements.applicantStageSelect.value,
            createdAt: DateTime.now().toISO(),
            touchedAt: DateTime.now().toISO(),
            age: Number(document.getElementById('applicant-age').value) || null,
            phone: document.getElementById('applicant-phone').value,
            email: document.getElementById('applicant-email').value,
            height: Number(document.getElementById('applicant-height').value) || null,
            weight: Number(document.getElementById('applicant-weight').value) || null,
            gender: 'male',
            notes: document.getElementById('applicant-notes').value,
            tattoos: '',
            health: '',
            demographics: { city: '', guardian: '' },
            contact: { preferred: 'Phone', address: '' },
            stageHistory: [{ stage: elements.applicantStageSelect.value, changedAt: DateTime.now().toISO() }],
            bodyComp: null,
            checklist: []
        };
        applicant.bodyComp = BodyCompService.evaluateBodyComp(applicant);
        if (applicant.bodyComp.status === 'within') {
            applicant.checklist.push('Body Comp Cleared');
        }
        store.setState((draft) => {
            draft.applicants.push(applicant);
        });
        event.target.reset();
    }

    function handleQuickBodyComp() {
        const height = Number(document.getElementById('applicant-height').value);
        const weight = Number(document.getElementById('applicant-weight').value);
        const age = Number(document.getElementById('applicant-age').value);
        const result = BodyCompService.evaluateBodyComp({ height, weight, age });
        alert(result.message);
    }

    function removeApplicant(id) {
        if (!confirm('Remove this applicant? Their data will be removed from Application Support.')) return;
        store.setState((draft) => {
            draft.applicants = draft.applicants.filter((item) => item.id !== id);
        });
    }
    function handleEventSubmit(event) {
        event.preventDefault();
        const id = document.getElementById('event-id').value;
        const payload = {
            id: id || crypto.randomUUID(),
            title: document.getElementById('event-title').value,
            date: document.getElementById('event-date').value,
            time: document.getElementById('event-time').value,
            type: elements.eventType.value,
            applicantId: elements.eventApplicant.value || null,
            templateId: elements.eventTemplate.value || null,
            notes: document.getElementById('event-notes').value
        };
        store.setState((draft) => {
            const index = draft.events.findIndex((item) => item.id === payload.id);
            if (index >= 0) {
                draft.events[index] = payload;
            } else {
                draft.events.push(payload);
            }
        });
        event.target.reset();
        elements.eventApplicant.value = '';
        elements.eventType.value = EVENT_TYPES[0];
        elements.eventTemplate.value = '';
        updateCalendarPreview(null);
    }

    function handleTemplateSelect() {
        const template = EVENT_TEMPLATES.find((item) => item.id === elements.eventTemplate.value);
        if (!template) return;
        const notes = document.getElementById('event-notes');
        if (!notes.value) {
            notes.value = `${template.needs}\n\nMessage: ${template.message}`;
        }
    }

    function renderEvents(state) {
        const filter = elements.eventFilter.value;
        const list = elements.eventList;
        list.innerHTML = '';
        const events = state.events
            .filter((item) => filter === 'All' || item.type === filter)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
        if (!events.length) {
            list.appendChild(emptyListItem('No events scheduled.'));
            return;
        }
        events.forEach((event) => {
            const li = document.createElement('li');
            const applicantName = state.applicants.find((applicant) => applicant.id === event.applicantId)?.name;
            const title = document.createElement('div');
            title.innerHTML = `<strong>${event.title}</strong><div class="fine-print">${DateTime.fromISO(event.date).toFormat('DDD')} ${event.time ? `at ${event.time}` : ''}</div>`;
            const meta = document.createElement('div');
            meta.className = 'fine-print';
            meta.textContent = `${event.type}${applicantName ? ` • ${applicantName}` : ''}`;
            const actions = document.createElement('div');
            actions.className = 'card-actions';
            actions.append(
                buildButton('ghost-btn', 'Edit', () => populateEventForm(event)),
                buildButton('danger-btn', 'Delete', () => deleteEvent(event.id)),
                buildButton('ghost-btn', 'Preview', () => updateCalendarPreview(event))
            );
            li.append(title, meta, actions);
            list.appendChild(li);
        });
    }

    function populateEventForm(event) {
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time || '';
        elements.eventType.value = event.type;
        elements.eventApplicant.value = event.applicantId || '';
        elements.eventTemplate.value = event.templateId || '';
        document.getElementById('event-notes').value = event.notes || '';
        updateCalendarPreview(event);
    }

    function deleteEvent(id) {
        store.setState((draft) => {
            draft.events = draft.events.filter((event) => event.id !== id);
        });
    }

    function updateCalendarPreview(event) {
        if (!event) {
            elements.calendarPreview.textContent = 'Select or create an event to preview calendar details.';
            delete elements.calendarPreview.dataset.selectedEvent;
            return;
        }
        const template = EVENT_TEMPLATES.find((item) => item.id === event.templateId);
        const applicant = store.getState().applicants.find((item) => item.id === event.applicantId);
        elements.calendarPreview.innerHTML = `
            <h3>${event.title}</h3>
            <p>${DateTime.fromISO(event.date).toFormat('DDD')} ${event.time ? `at ${event.time}` : ''}</p>
            <p>${event.type}</p>
            <p>${applicant ? `Applicant: ${applicant.name}` : 'General event'}</p>
            <p>${event.notes || template?.needs || 'No notes yet.'}</p>
        `;
        elements.calendarPreview.dataset.selectedEvent = event.id;
    }

    function downloadSelectedEventIcs() {
        const eventId = elements.calendarPreview.dataset.selectedEvent;
        if (!eventId) return;
        const state = store.getState();
        const event = state.events.find((item) => item.id === eventId);
        if (!event) return;
        const start = DateTime.fromISO(`${event.date}T${event.time || '00:00'}`);
        const end = start.plus({ hours: 1 });
        const description = event.notes || EVENT_TEMPLATES.find((template) => template.id === event.templateId)?.needs || '';
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Recruiter Workspace//EN',
            'BEGIN:VEVENT',
            `UID:${event.id}`,
            `DTSTAMP:${DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
            `DTSTART:${start.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
            `DTEND:${end.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`,
            `SUMMARY:${event.title}`,
            `DESCRIPTION:${description}`,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\n');
        downloadBlob(new Blob([lines], { type: 'text/calendar' }), `${event.title.replace(/\s+/g, '-')}.ics`);
    }

    function copyHandoffText() {
        const eventId = elements.calendarPreview.dataset.selectedEvent;
        if (!eventId) return;
        const state = store.getState();
        const event = state.events.find((item) => item.id === eventId);
        if (!event) return;
        const template = EVENT_TEMPLATES.find((item) => item.id === event.templateId);
        const applicant = state.applicants.find((item) => item.id === event.applicantId);
        const text = `1SG, ${applicant ? applicant.name : 'applicant'} scheduled ${event.title} on ${DateTime.fromISO(event.date).toFormat('DDD')} ${
            event.time ? `at ${event.time}` : ''
        }. ${template?.message ?? event.notes ?? ''}`;
        navigator.clipboard?.writeText(text);
        NotificationService.send('1SG Hand-off copied', { body: 'Ready to paste into your preferred messaging app.' });
    }
    function handleChecklistSubmit(event) {
        event.preventDefault();
        const name = document.getElementById('checklist-name').value.trim();
        if (!name) return;
        const synonyms = document
            .getElementById('checklist-synonyms')
            .value.split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        const notes = document.getElementById('checklist-notes').value.trim();
        const file = document.getElementById('checklist-file').files?.[0];

        const entry = {
            id: crypto.randomUUID(),
            name,
            synonyms,
            notes,
            createdAt: DateTime.now().toISO(),
            previewUrl: null
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                entry.previewUrl = reader.result;
                commitChecklist(entry);
            };
            reader.readAsDataURL(file);
        } else {
            commitChecklist(entry);
        }
        event.target.reset();
    }

    function commitChecklist(entry) {
        store.setState((draft) => {
            draft.checklist.push(entry);
        });
    }

    function renderChecklist(state) {
        elements.checklistItems.innerHTML = '';
        if (!state.checklist.length) {
            elements.checklistItems.appendChild(emptyListItem('No documents stored yet.'));
            return;
        }
        state.checklist
            .slice()
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .forEach((item) => {
                const li = document.createElement('li');
                const details = document.createElement('div');
                const title = document.createElement('strong');
                title.textContent = item.name;
                const meta = document.createElement('div');
                meta.className = 'fine-print';
                meta.textContent = `${item.synonyms.join(', ')}${item.notes ? ` • ${item.notes}` : ''}`;
                details.append(title, meta);
                if (item.previewUrl?.startsWith('data:image')) {
                    const img = document.createElement('img');
                    img.src = item.previewUrl;
                    li.appendChild(img);
                }
                const actions = document.createElement('div');
                actions.className = 'card-actions';
                if (item.previewUrl) {
                    const link = document.createElement('a');
                    link.href = item.previewUrl;
                    link.target = '_blank';
                    link.className = 'ghost-btn button-like';
                    link.textContent = 'Open';
                    actions.appendChild(link);
                }
                actions.appendChild(buildButton('danger-btn', 'Delete', () => deleteChecklistItem(item.id)));
                li.append(details, actions);
                elements.checklistItems.appendChild(li);
            });
    }

    function deleteChecklistItem(id) {
        store.setState((draft) => {
            draft.checklist = draft.checklist.filter((item) => item.id !== id);
        });
    }

    function openScanModal() {
        elements.scanModal.hidden = false;
        elements.scanPreview.innerHTML = '';
        elements.ocrSuggestions.innerHTML = '';
    }

    function closeScanModal() {
        elements.scanModal.hidden = true;
        elements.scanInput.value = '';
        elements.scanPreview.innerHTML = '';
        elements.ocrSuggestions.innerHTML = '';
    }

    function handleScanInput(event) {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        elements.scanPreview.innerHTML = '';
        elements.ocrSuggestions.innerHTML = '<p class="fine-print">Running OCR…</p>';
        const suggestions = new Set();
        files.forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                const url = reader.result;
                const img = document.createElement('img');
                img.src = url;
                elements.scanPreview.appendChild(img);
            };
            reader.readAsDataURL(file);
            Tesseract.recognize(file, 'eng').then(({ data }) => {
                data.words
                    .map((word) => word.text)
                    .filter((text) => text.length > 3)
                    .forEach((text) => {
                        const normalized = text.replace(/[^a-z0-9]/gi, '').toLowerCase();
                        if (['ddform4', 'ddform'].some((needle) => normalized.includes(needle))) suggestions.add('DD Form 4');
                        if (normalized.includes('tattoo')) suggestions.add('Tattoo Worksheet');
                        if (normalized.includes('medical')) suggestions.add('Medical Documents');
                        if (normalized.includes('consent')) suggestions.add('Parental Consent');
                    });
                renderSuggestions(Array.from(suggestions));
            });
        });
    }

    function renderSuggestions(suggestions) {
        elements.ocrSuggestions.innerHTML = '';
        if (!suggestions.length) {
            elements.ocrSuggestions.textContent = 'No obvious matches found. Add manually.';
            return;
        }
        suggestions.forEach((suggestion) => {
            const tag = document.createElement('button');
            tag.type = 'button';
            tag.className = 'ocr-tag';
            tag.textContent = suggestion;
            tag.addEventListener('click', () => {
                document.getElementById('checklist-name').value = suggestion;
                closeScanModal();
            });
            elements.ocrSuggestions.appendChild(tag);
        });
    }
    function renderSas(state) {
        const list = elements.sasList;
        list.innerHTML = '';
        const enlisted = state.applicants.filter((applicant) => applicant.stage === 'Enlisted');
        if (!enlisted.length) {
            list.appendChild(emptyListItem('No enlisted applicants tracked yet.'));
        } else {
            enlisted.forEach((applicant) => {
                const li = document.createElement('li');
                const stage = applicant.stageHistory[applicant.stageHistory.length - 1];
                const drillDate = stage ? DateTime.fromISO(stage.changedAt).plus({ weeks: 2 }) : DateTime.now();
                const notes = applicant.notes || 'No notes logged yet.';
                li.innerHTML = `<div><strong>${applicant.name}</strong><div class="fine-print">Drill: ${drillDate.toFormat('DDD')} • ${notes}</div></div>`;
                const actions = document.createElement('div');
                actions.className = 'card-actions';
                actions.append(
                    buildButton('ghost-btn', 'Mark Contacted', () => markSasContact(applicant.id)),
                    buildButton('ghost-btn', 'Submit SAS', () => sendSasSubmit(applicant))
                );
                li.appendChild(actions);
                list.appendChild(li);
            });
        }
        elements.sasDay.value = state.sas.reminderDay;
        elements.sasTime.value = state.sas.reminderTime;
    }

    function markSasContact(applicantId) {
        store.setState((draft) => {
            const applicant = draft.applicants.find((item) => item.id === applicantId);
            if (!applicant) return;
            applicant.lastEnlistedUpdate = DateTime.now().toISO();
            applicant.touchedAt = DateTime.now().toISO();
        });
    }

    function sendSasSubmit(applicant) {
        NotificationService.send('Submit SAS Packet', {
            body: `${applicant.name} due for SAS submission. Align with drill timeline.`
        });
    }

    function handleSasSettingsSubmit(event) {
        event.preventDefault();
        store.setState((draft) => {
            draft.sas.reminderDay = elements.sasDay.value;
            draft.sas.reminderTime = elements.sasTime.value || '08:00';
        });
        scheduleNotifications();
    }

    function sendSasReminder(isTest = false) {
        const state = store.getState();
        const upcoming = state.applicants.filter((applicant) => applicant.stage === 'Enlisted');
        const body = upcoming.length
            ? `${upcoming.length} enlisted applicants require weekly follow-up.`
            : 'No enlisted applicants at this time.';
        NotificationService.send(isTest ? 'Test SAS Reminder' : 'SAS Weekly Reminder', { body });
    }

    async function generateSasPdf() {
        const state = store.getState();
        const enlisted = state.applicants.filter((applicant) => applicant.stage === 'Enlisted');
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Service After Sale Tracker', 14, 20);
        doc.setFontSize(12);
        enlisted.forEach((applicant, index) => {
            const y = 40 + index * 24;
            doc.text(`${applicant.name}`, 14, y);
            doc.text(`Contact: ${applicant.phone || 'N/A'} • ${applicant.email || ''}`, 14, y + 8);
            doc.text(`Notes: ${applicant.notes || 'None'}`, 14, y + 16);
        });
        doc.save('service-after-sale.pdf');
    }
    async function generatePipelineReport() {
        const state = store.getState();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Applicant Pipeline Report', 14, 20);
        let y = 32;
        STAGE_OPTIONS.forEach((stage) => {
            const group = state.applicants.filter((applicant) => applicant.stage === stage);
            if (!group.length) return;
            doc.setFontSize(14);
            doc.text(stage, 14, y);
            y += 6;
            doc.setFontSize(11);
            group.forEach((applicant) => {
                doc.text(`• ${applicant.name} (last touch ${DateTime.fromISO(applicant.touchedAt).toRelative()})`, 18, y);
                y += 6;
            });
            y += 4;
        });
        doc.addPage();
        doc.text('Weekly Event Rollup', 14, 20);
        state.events
            .filter((event) => DateTime.fromISO(event.date) <= DateTime.now().plus({ weeks: 1 }))
            .forEach((event, index) => {
                const offset = 32 + index * 10;
                doc.text(`${DateTime.fromISO(event.date).toFormat('DDD')}: ${event.title} (${event.type})`, 14, offset);
            });
        doc.save('applicant-pipeline-report.pdf');
    }

    function exportWeeklySnapshot() {
        const state = store.getState();
        const week = {
            exportedAt: DateTime.now().toISO(),
            applicants: state.applicants,
            events: state.events,
            checklist: state.checklist
        };
        downloadBlob(new Blob([JSON.stringify(week, null, 2)], { type: 'application/json' }), 'weekly-snapshot.json');
    }

    async function shareWeeklySnapshot() {
        const state = store.getState();
        const text = `Pipeline Snapshot\nApplicants: ${state.applicants.length}\nEvents: ${state.events.length}`;
        if (navigator.share) {
            await navigator.share({ title: 'Recruiter Snapshot', text });
        } else {
            NotificationService.send('Share unavailable', { body: text });
        }
    }

    function handleImportSnapshot(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const snapshot = JSON.parse(reader.result);
                store.setState((draft) => {
                    draft.applicants = mergeById(draft.applicants, snapshot.applicants || []);
                    draft.events = mergeById(draft.events, snapshot.events || []);
                    draft.checklist = mergeById(draft.checklist, snapshot.checklist || []);
                });
            } catch (error) {
                alert('Unable to import snapshot.');
            }
        };
        reader.readAsText(file);
    }

    function mergeById(existing, incoming) {
        const map = new Map(existing.map((item) => [item.id, item]));
        incoming.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }));
        return Array.from(map.values());
    }
    function exportStore() {
        const state = store.getState();
        downloadBlob(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'recruiter-workspace.json');
    }

    function triggerImportStore() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    store.setState((draft) => Object.assign(draft, data));
                } catch (error) {
                    alert('Unable to import data.');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    async function shareStore() {
        const state = store.getState();
        const text = `Applicants: ${state.applicants.length}\nEvents: ${state.events.length}\nGoal: ${state.settings.annualGoal}`;
        if (navigator.share) {
            await navigator.share({ title: 'Recruiter Workspace Snapshot', text });
        } else {
            NotificationService.send('Share unavailable', { body: text });
        }
    }

    function clearStore() {
        if (!confirm('Reset all Application Support data? This cannot be undone.')) return;
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    function handleDrillSubmit(event) {
        event.preventDefault();
        const month = elements.drillMonth.value;
        const focus = elements.drillFocus.value.trim();
        if (!focus) return;
        store.setState((draft) => {
            draft.workstation.drills.push({ id: crypto.randomUUID(), month, focus, createdAt: DateTime.now().toISO() });
        });
        event.target.reset();
    }

    function handleSnippetSubmit(event) {
        event.preventDefault();
        const title = elements.snippetTitle.value.trim();
        const body = elements.snippetBody.value.trim();
        if (!title || !body) return;
        store.setState((draft) => {
            draft.workstation.snippets.push({ id: crypto.randomUUID(), title, body, createdAt: DateTime.now().toISO() });
        });
        event.target.reset();
    }

    function handlePackSubmit(event) {
        event.preventDefault();
        const item = elements.packItem.value.trim();
        const notes = elements.tripNotes.value.trim();
        if (!item) return;
        store.setState((draft) => {
            draft.workstation.packItems.push({ id: crypto.randomUUID(), item, notes, createdAt: DateTime.now().toISO(), packed: false });
        });
        event.target.reset();
    }

    function renderWorkstation(state) {
        elements.drillList.innerHTML = '';
        if (!state.workstation.drills.length) {
            elements.drillList.appendChild(emptyListItem('No drill plans logged.'));
        } else {
            state.workstation.drills
                .slice()
                .sort((a, b) => a.month.localeCompare(b.month))
                .forEach((drill) => {
                    const li = document.createElement('li');
                    li.innerHTML = `<div><strong>${DateTime.local(2024, Number(drill.month)).toFormat('LLLL')}</strong><div class="fine-print">${drill.focus}</div></div>`;
                    li.appendChild(buildButton('danger-btn', 'Delete', () => removeDrill(drill.id)));
                    elements.drillList.appendChild(li);
                });
        }

        elements.snippetList.innerHTML = '';
        if (!state.workstation.snippets.length) {
            elements.snippetList.appendChild(emptyListItem('No snippets stored yet.'));
        } else {
            state.workstation.snippets.forEach((snippet) => {
                const li = document.createElement('li');
                li.innerHTML = `<div><strong>${snippet.title}</strong><div class="fine-print">${snippet.body}</div></div>`;
                const actions = document.createElement('div');
                actions.className = 'card-actions';
                actions.append(
                    buildButton('ghost-btn', 'Copy', () => navigator.clipboard?.writeText(snippet.body)),
                    buildButton('danger-btn', 'Delete', () => removeSnippet(snippet.id))
                );
                li.appendChild(actions);
                elements.snippetList.appendChild(li);
            });
        }

        elements.packList.innerHTML = '';
        if (!state.workstation.packItems.length) {
            elements.packList.appendChild(emptyListItem('No pack items yet.'));
        } else {
            state.workstation.packItems.forEach((item) => {
                const li = document.createElement('li');
                li.innerHTML = `<div><strong>${item.item}</strong><div class="fine-print">${item.notes || 'No notes'}</div></div>`;
                const toggle = buildButton('ghost-btn', item.packed ? 'Unpack' : 'Pack', () => togglePack(item.id));
                const remove = buildButton('danger-btn', 'Remove', () => removePack(item.id));
                li.append(toggle, remove);
                elements.packList.appendChild(li);
            });
        }
    }

    function removeDrill(id) {
        store.setState((draft) => {
            draft.workstation.drills = draft.workstation.drills.filter((item) => item.id !== id);
        });
    }

    function removeSnippet(id) {
        store.setState((draft) => {
            draft.workstation.snippets = draft.workstation.snippets.filter((item) => item.id !== id);
        });
    }

    function togglePack(id) {
        store.setState((draft) => {
            const pack = draft.workstation.packItems.find((item) => item.id === id);
            if (pack) pack.packed = !pack.packed;
        });
    }

    function removePack(id) {
        store.setState((draft) => {
            draft.workstation.packItems = draft.workstation.packItems.filter((item) => item.id !== id);
        });
    }
    function renderSettings(state) {
        elements.profileName.value = state.settings.recruiterName;
        elements.accentTheme.value = state.settings.accentTheme;
        elements.annualGoal.value = state.settings.annualGoal;
        elements.agingWarn.value = state.settings.agingWarn;
        elements.agingDanger.value = state.settings.agingDanger;
        elements.sasLead.value = state.settings.sasReminderLead;
        elements.calendarSelect.value = state.settings.calendar;
    }

    function handleSettingsSubmit(event) {
        event.preventDefault();
        store.setState((draft) => {
            draft.settings.recruiterName = elements.profileName.value;
            draft.settings.accentTheme = elements.accentTheme.value;
            draft.settings.annualGoal = Number(elements.annualGoal.value) || 0;
            draft.settings.agingWarn = Number(elements.agingWarn.value) || 5;
            draft.settings.agingDanger = Number(elements.agingDanger.value) || 9;
            draft.settings.sasReminderLead = Number(elements.sasLead.value) || 3;
            draft.settings.calendar = elements.calendarSelect.value;
        });
        applyAccentTheme(elements.accentTheme.value);
        scheduleNotifications();
    }

    function applyAccentTheme(themeKey) {
        const color = ACCENT_THEMES[themeKey] ?? ACCENT_THEMES.indigo;
        document.documentElement.style.setProperty('--accent', color);
        document.documentElement.style.setProperty('--accent-muted', `${color}20`);
    }

    function playGatorGame() {
        const score = Number(elements.gatorScore.dataset.score || '0') + 1;
        elements.gatorScore.dataset.score = score.toString();
        elements.gatorScore.textContent = `Score: ${score}`;
        elements.gatorGame.classList.add('feeding');
        setTimeout(() => elements.gatorGame.classList.remove('feeding'), 200);
        if (score % 5 === 0) {
            NotificationService.send('Gator Snack Time', { body: 'Nice! Take a breather and hydrate.' });
        }
    }

    function handleLogoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            store.setState((draft) => {
                draft.logo = reader.result;
            });
        };
        reader.readAsDataURL(file);
    }

    function resetEventForm() {
        elements.eventForm.reset();
        elements.eventApplicant.value = '';
        elements.eventType.value = EVENT_TYPES[0];
        elements.eventTemplate.value = '';
        updateCalendarPreview(null);
    }
    function scheduleNotifications() {
        const state = store.getState();
        const [hour, minute] = (state.sas.reminderTime || '08:00').split(':').map(Number);
        NotificationService.scheduleDaily('sas-weekly', hour, minute, () => sendSasReminder(false));
        NotificationService.scheduleDaily('aging-summary', 17, 0, () => sendAgingSummary(store.getState(), false));
    }

    function sendAgingSummary(state, isTest) {
        const warnDays = state.settings.agingWarn || 5;
        const dangerDays = state.settings.agingDanger || 9;
        const now = DateTime.now();
        const warn = [];
        const danger = [];
        state.applicants.forEach((applicant) => {
            const lastTouch = DateTime.fromISO(applicant.touchedAt);
            const days = Math.round(now.diff(lastTouch, 'days').days);
            if (days >= dangerDays) {
                danger.push(`${applicant.name} (${days} days)`);
            } else if (days >= warnDays) {
                warn.push(`${applicant.name} (${days} days)`);
            }
        });
        const body = danger.length || warn.length
            ? `Danger: ${danger.join(', ') || 'None'}\nWarn: ${warn.join(', ') || 'None'}`
            : 'All applicants touched within thresholds.';
        NotificationService.send(isTest ? 'Test Aging Summary' : 'Daily Aging Summary', { body });
    }

    function renderLogo(state) {
        if (state.logo) {
            elements.logoTrigger.classList.add('has-logo');
            elements.logoDisplay.src = state.logo;
        } else {
            elements.logoTrigger.classList.remove('has-logo');
            elements.logoDisplay.removeAttribute('src');
        }
    }

    init();
)();
