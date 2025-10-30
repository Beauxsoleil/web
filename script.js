(() => {
    // Luxon utilities for friendly date handling
    const { DateTime } = luxon;

    // Local storage keys
    const APPLICANTS_KEY = 'recruitment-applicants-v1';
    const EVENTS_KEY = 'recruitment-events-v1';
    const GOALS_KEY = 'recruitment-goals-v1';

    // Stage presets used across the UI
    const STAGE_OPTIONS = [
        'Application Received',
        'Screening',
        'Interview',
        'Background Check',
        'Medical',
        'Training',
        'Enlisted'
    ];

    // DOM hooks
    const applicantsListEl = document.getElementById('applicants-list');
    const addApplicantBtn = document.getElementById('add-applicant');
    const enlistedCountEl = document.getElementById('enlisted-count');
    const upcomingCountEl = document.getElementById('upcoming-count');
    const goalCountEl = document.getElementById('goal-count');
    const eventForm = document.getElementById('event-form');
    const eventListEl = document.getElementById('events-list');
    const todayEventsEl = document.getElementById('today-events');
    const eventApplicantSelect = document.getElementById('event-applicant');
    const rssBtn = document.getElementById('rss-feed');
    const addGoalBtn = document.getElementById('add-goal');
    const goalsListEl = document.getElementById('goals-list');
    const exportBtn = document.getElementById('export-data');
    const importBtn = document.getElementById('import-data');
    const clearBtn = document.getElementById('clear-data');
    const calendarGridEl = document.getElementById('calendar-grid');
    const currentMonthEl = document.getElementById('current-month');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');

    // Attempt to load persisted data, otherwise seed realistic demo content
    let applicants = loadFromStorage(APPLICANTS_KEY, getSeedApplicants());
    let events = loadFromStorage(EVENTS_KEY, getSeedEvents());
    let goals = loadFromStorage(GOALS_KEY, getSeedGoals());

    // Track the calendar month being displayed
    let activeMonth = DateTime.now().startOf('month');

    // ---- Rendering helpers ----

    function loadFromStorage(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (error) {
            console.warn(`Unable to parse data for ${key}`, error);
            return fallback;
        }
    }

    function persist(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    function renderApplicants() {
        applicantsListEl.innerHTML = '';

        if (!applicants.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'No applicants yet. Add your first candidate to begin tracking.';
            applicantsListEl.appendChild(empty);
            return;
        }

        applicants.forEach((applicant) => {
            const card = document.createElement('article');
            card.className = 'applicant-card';
            card.dataset.id = applicant.id;

            card.appendChild(buildApplicantHeader(applicant));
            card.appendChild(buildApplicantGrid(applicant));
            card.appendChild(buildApplicantNotes(applicant));

            applicantsListEl.appendChild(card);
        });
    }

    function buildApplicantHeader(applicant) {
        const header = document.createElement('div');
        header.className = 'applicant-header';

        const title = document.createElement('h3');
        title.textContent = applicant.name || 'New Applicant';
        title.contentEditable = true;
        title.className = 'editable-name';
        title.addEventListener('blur', () => {
            applicant.name = title.textContent.trim() || 'Unnamed Applicant';
            title.textContent = applicant.name;
            persist(APPLICANTS_KEY, applicants);
            updateApplicantOptions();
        });

        const stageWrap = document.createElement('div');
        stageWrap.className = 'applicant-actions';

        const stageSelect = document.createElement('select');
        stageSelect.className = 'field-select';
        STAGE_OPTIONS.forEach((stage) => {
            const option = document.createElement('option');
            option.value = stage;
            option.textContent = stage;
            if (stage === applicant.stage) option.selected = true;
            stageSelect.appendChild(option);
        });
        stageSelect.addEventListener('change', () => {
            applicant.stage = stageSelect.value;
            persist(APPLICANTS_KEY, applicants);
            updateSummaryStats();
        });

        const shareBtn = document.createElement('button');
        shareBtn.className = 'primary-btn';
        shareBtn.type = 'button';
        shareBtn.textContent = 'Share PDF';
        shareBtn.addEventListener('click', () => generateApplicantPDF(applicant));

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'danger-btn';
        deleteBtn.type = 'button';
        deleteBtn.textContent = 'Remove';
        deleteBtn.addEventListener('click', () => removeApplicant(applicant.id));

        stageWrap.append(stageSelect, shareBtn, deleteBtn);
        header.append(title, stageWrap);
        return header;
    }

    function buildApplicantGrid(applicant) {
        const grid = document.createElement('div');
        grid.className = 'applicant-grid';

        const fields = [
            { label: 'Stage in Process', key: 'stage', type: 'select', options: STAGE_OPTIONS },
            { label: 'Age', key: 'age', type: 'number', placeholder: '23' },
            { label: 'Physical Health (1-10)', key: 'health', type: 'number', placeholder: '8' },
            { label: 'Prior Service', key: 'priorService', placeholder: 'Army Reserve' },
            { label: 'Legal Issues', key: 'legalIssues', placeholder: 'None' },
            { label: 'Education Level', key: 'education', placeholder: 'Bachelor of Science' },
            { label: 'Marital Status', key: 'maritalStatus', placeholder: 'Single' },
            { label: 'Dependents', key: 'dependents', type: 'number', placeholder: '0' },
            { label: 'Tattoos / Brandings / Piercings', key: 'tattoos', placeholder: 'None noted' }
        ];

        fields.forEach(({ label, key, type = 'text', placeholder = '', options = [] }) => {
            const field = document.createElement('div');
            field.className = 'field';
            const fieldLabel = document.createElement('label');

            const labelSpan = document.createElement('span');
            labelSpan.textContent = label;
            fieldLabel.appendChild(labelSpan);

            let control;
            if (type === 'select') {
                control = document.createElement('select');
                options.forEach((option) => {
                    const opt = document.createElement('option');
                    opt.value = option;
                    opt.textContent = option;
                    if (option === applicant[key]) opt.selected = true;
                    control.appendChild(opt);
                });
                control.addEventListener('change', () => {
                    applicant[key] = control.value;
                    persist(APPLICANTS_KEY, applicants);
                    updateSummaryStats();
                });
            } else {
                control = document.createElement('input');
                control.type = type;
                control.value = applicant[key] || '';
                control.placeholder = placeholder;
                control.addEventListener('input', () => {
                    applicant[key] = control.value;
                    persist(APPLICANTS_KEY, applicants);
                    if (key === 'age' || key === 'health') {
                        updateSummaryStats();
                    }
                });
            }

            control.autocomplete = 'off';
            fieldLabel.appendChild(control);
            field.appendChild(fieldLabel);
            grid.appendChild(field);
        });

        return grid;
    }

    function buildApplicantNotes(applicant) {
        const wrapper = document.createElement('div');
        wrapper.className = 'field';
        const label = document.createElement('label');
        const span = document.createElement('span');
        span.textContent = 'Notes';
        label.appendChild(span);

        const notes = document.createElement('textarea');
        notes.value = applicant.notes || '';
        notes.placeholder = 'Observations, follow-ups, and action items.';
        notes.addEventListener('input', () => {
            applicant.notes = notes.value;
            persist(APPLICANTS_KEY, applicants);
        });

        label.appendChild(notes);
        wrapper.appendChild(label);
        return wrapper;
    }

    function removeApplicant(id) {
        if (!confirm('Remove this applicant? Their associated events will remain.')) return;
        applicants = applicants.filter((item) => item.id !== id);
        persist(APPLICANTS_KEY, applicants);
        renderApplicants();
        updateApplicantOptions();
        updateSummaryStats();
    }

    function renderEvents() {
        eventListEl.innerHTML = '';
        todayEventsEl.innerHTML = '';

        if (!events.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'No events scheduled. Add an event to populate the calendar.';
            eventListEl.appendChild(empty);
        }

        const today = DateTime.now().toISODate();
        const upcomingThreshold = DateTime.now().plus({ days: 30 });
        let upcomingCounter = 0;

        events
            .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''))
            .forEach((event) => {
                const eventDate = DateTime.fromISO(event.date);
                const applicantName = resolveApplicantName(event.applicantId);

                // Build list item for the main schedule
                const item = document.createElement('li');
                item.className = 'event-item';

                const title = document.createElement('strong');
                title.textContent = event.title;
                item.appendChild(title);

                const meta = document.createElement('div');
                meta.className = 'event-meta';
                const stageInfo = event.stage ? ` • Stage Focus: ${event.stage}` : '';
                const applicantInfo = applicantName ? ` • ${applicantName}` : '';
                meta.textContent = `${eventDate.toFormat('DDD')} ${event.time ? `at ${event.time}` : ''}${applicantInfo}${stageInfo}`;
                item.appendChild(meta);

                if (event.notes) {
                    const notes = document.createElement('p');
                    notes.className = 'event-notes';
                    notes.textContent = event.notes;
                    item.appendChild(notes);
                }

                const actions = document.createElement('div');
                actions.className = 'event-actions';

                const editBtn = document.createElement('button');
                editBtn.textContent = 'Edit';
                editBtn.type = 'button';
                editBtn.addEventListener('click', () => populateEventForm(event.id));

                const removeBtn = document.createElement('button');
                removeBtn.textContent = 'Delete';
                removeBtn.className = 'danger-btn';
                removeBtn.type = 'button';
                removeBtn.addEventListener('click', () => deleteEvent(event.id));

                actions.append(editBtn, removeBtn);
                item.appendChild(actions);
                eventListEl.appendChild(item);

                // Today section
                if (event.date === today) {
                    const todayItem = item.cloneNode(true);
                    todayEventsEl.appendChild(todayItem);
                }

                if (eventDate >= DateTime.now() && eventDate <= upcomingThreshold) {
                    upcomingCounter += 1;
                }
            });

        if (!todayEventsEl.children.length) {
            const empty = document.createElement('li');
            empty.className = 'empty-state';
            empty.textContent = 'No events for today.';
            todayEventsEl.appendChild(empty);
        }

        upcomingCountEl.textContent = upcomingCounter;
        renderCalendar();
    }

    function populateEventForm(id) {
        const event = events.find((item) => item.id === id);
        if (!event) return;
        document.getElementById('event-id').value = event.id;
        document.getElementById('event-title').value = event.title;
        document.getElementById('event-date').value = event.date;
        document.getElementById('event-time').value = event.time || '';
        document.getElementById('event-notes').value = event.notes || '';
        document.getElementById('event-stage').value = event.stage || '';
        document.getElementById('event-applicant').value = event.applicantId || '';
        document.getElementById('save-event').textContent = 'Update Event';
    }

    function deleteEvent(id) {
        events = events.filter((item) => item.id !== id);
        persist(EVENTS_KEY, events);
        renderEvents();
        updateSummaryStats();
    }

    function renderGoals() {
        goalsListEl.innerHTML = '';

        if (!goals.length) {
            const empty = document.createElement('p');
            empty.className = 'empty-state';
            empty.textContent = 'Set enlistment goals to monitor progress against targets.';
            goalsListEl.appendChild(empty);
            goalCountEl.textContent = '0';
            return;
        }

        goals.forEach((goal) => {
            const card = document.createElement('article');
            card.className = 'goal-card';
            card.dataset.id = goal.id;

            const header = document.createElement('div');
            header.className = 'goal-header';

            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.value = goal.title || 'Untitled Goal';
            titleInput.placeholder = 'Goal name';
            titleInput.addEventListener('input', () => {
                goal.title = titleInput.value;
                persist(GOALS_KEY, goals);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'danger-btn';
            deleteBtn.textContent = 'Remove';
            deleteBtn.addEventListener('click', () => removeGoal(goal.id));

            header.append(titleInput, deleteBtn);

            const grid = document.createElement('div');
            grid.className = 'goal-grid';

            const targetField = buildGoalNumberField('Target', goal.target || 0, (value) => {
                goal.target = value;
                persist(GOALS_KEY, goals);
                updateGoalProgress(goal, card);
            });
            const currentField = buildGoalNumberField('Current', goal.current || 0, (value) => {
                goal.current = value;
                persist(GOALS_KEY, goals);
                updateGoalProgress(goal, card);
                updateSummaryStats();
            });
            const dueField = buildGoalTextField('Target Date', goal.dueDate || '', (value) => {
                goal.dueDate = value;
                persist(GOALS_KEY, goals);
            });

            grid.append(targetField, currentField, dueField);

            const notesField = document.createElement('textarea');
            notesField.placeholder = 'Notes, milestones, or blockers';
            notesField.value = goal.notes || '';
            notesField.addEventListener('input', () => {
                goal.notes = notesField.value;
                persist(GOALS_KEY, goals);
            });

            const notesWrapper = document.createElement('label');
            notesWrapper.className = 'field';
            notesWrapper.appendChild(document.createElement('span')).textContent = 'Notes';
            notesWrapper.appendChild(notesField);

            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            progressBar.appendChild(progressFill);

            card.append(header, grid, notesWrapper, progressBar);
            goalsListEl.appendChild(card);
            updateGoalProgress(goal, card);
        });

        goalCountEl.textContent = goals.length.toString();
    }

    function buildGoalNumberField(label, value, onChange) {
        const wrapper = document.createElement('label');
        wrapper.className = 'field';
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = value;
        input.addEventListener('input', () => {
            onChange(parseInt(input.value, 10) || 0);
        });
        wrapper.append(span, input);
        return wrapper;
    }

    function buildGoalTextField(label, value, onChange) {
        const wrapper = document.createElement('label');
        wrapper.className = 'field';
        const span = document.createElement('span');
        span.textContent = label;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = value;
        input.placeholder = 'e.g. FY Q4';
        input.addEventListener('input', () => onChange(input.value));
        wrapper.append(span, input);
        return wrapper;
    }

    function updateGoalProgress(goal, card) {
        const fill = card.querySelector('.progress-fill');
        const percent = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
        fill.style.width = `${percent}%`;
        fill.title = `${percent}% complete`;
    }

    function removeGoal(id) {
        if (!confirm('Remove this goal?')) return;
        goals = goals.filter((goal) => goal.id !== id);
        persist(GOALS_KEY, goals);
        renderGoals();
        updateSummaryStats();
    }

    function updateSummaryStats() {
        const enlisted = applicants.filter((applicant) => applicant.stage === 'Enlisted').length;
        enlistedCountEl.textContent = enlisted.toString();
        goalCountEl.textContent = goals.length.toString();

        // Update progress bars to reflect enlistment totals if they use applicants as metric
        document.querySelectorAll('.goal-card').forEach((card) => {
            const goal = goals.find((item) => item.id === card.dataset.id);
            if (goal) updateGoalProgress(goal, card);
        });
    }

    function updateApplicantOptions() {
        const currentValue = eventApplicantSelect.value;
        eventApplicantSelect.innerHTML = '<option value="">General Event</option>';
        applicants.forEach((applicant) => {
            const option = document.createElement('option');
            option.value = applicant.id;
            option.textContent = applicant.name;
            eventApplicantSelect.appendChild(option);
        });
        if (currentValue) {
            eventApplicantSelect.value = currentValue;
        }
    }

    function resolveApplicantName(id) {
        if (!id) return '';
        const match = applicants.find((applicant) => applicant.id === id);
        return match ? match.name : 'Former Applicant';
    }

    function renderCalendar() {
        calendarGridEl.innerHTML = '';
        currentMonthEl.textContent = activeMonth.toFormat('LLLL yyyy');

        const weekdays = DateTime.weekdays('short');
        weekdays.forEach((day) => {
            const heading = document.createElement('div');
            heading.className = 'calendar-cell heading';
            heading.textContent = day;
            calendarGridEl.appendChild(heading);
        });

        const firstDayOfMonth = activeMonth.startOf('month');
        const daysInMonth = activeMonth.daysInMonth;
        const offset = firstDayOfMonth.weekday % 7; // 0 indexed for Sunday

        // pad beginning with previous month blanks
        for (let i = 0; i < offset; i += 1) {
            const blank = document.createElement('div');
            blank.className = 'calendar-cell muted';
            calendarGridEl.appendChild(blank);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = activeMonth.set({ day });
            const cell = document.createElement('div');
            cell.className = 'calendar-cell';
            if (date.hasSame(DateTime.now(), 'day')) {
                cell.classList.add('today');
            }

            const dateLabel = document.createElement('div');
            dateLabel.className = 'date';
            dateLabel.textContent = day.toString();
            cell.appendChild(dateLabel);

            const cellEvents = document.createElement('div');
            cellEvents.className = 'cell-events';
            events
                .filter((event) => DateTime.fromISO(event.date).hasSame(date, 'day'))
                .forEach((event) => {
                    const marker = document.createElement('span');
                    marker.textContent = event.title;
                    cellEvents.appendChild(marker);
                });

            if (!cellEvents.childElementCount) {
                const placeholder = document.createElement('span');
                placeholder.textContent = '—';
                placeholder.className = 'muted';
                cellEvents.appendChild(placeholder);
            }

            cell.appendChild(cellEvents);
            calendarGridEl.appendChild(cell);
        }
    }

    function resetEventForm() {
        eventForm.reset();
        document.getElementById('event-id').value = '';
        document.getElementById('save-event').textContent = 'Save Event';
    }

    function generateApplicantPDF(applicant) {
        const doc = new jspdf.jsPDF({
            unit: 'pt',
            format: 'a4'
        });

        const lineHeight = 18;
        let y = 60;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('Applicant Report', 60, y);

        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        y += 30;

        const details = [
            `Name: ${applicant.name}`,
            `Stage: ${applicant.stage}`,
            `Age: ${applicant.age || 'N/A'}`,
            `Physical Health: ${applicant.health || 'N/A'}`,
            `Prior Service: ${applicant.priorService || 'N/A'}`,
            `Legal Issues: ${applicant.legalIssues || 'N/A'}`,
            `Education Level: ${applicant.education || 'N/A'}`,
            `Marital Status: ${applicant.maritalStatus || 'N/A'}`,
            `Dependents: ${applicant.dependents || 'N/A'}`,
            `Tattoos/Brandings/Piercings: ${applicant.tattoos || 'N/A'}`
        ];

        details.forEach((detail) => {
            doc.text(detail, 60, y);
            y += lineHeight;
        });

        doc.setFont('helvetica', 'bold');
        doc.text('Notes', 60, y + 10);
        doc.setFont('helvetica', 'normal');
        const splitNotes = doc.splitTextToSize(applicant.notes || 'None provided', 480);
        doc.text(splitNotes, 60, y + 30);
        y += 30 + splitNotes.length * lineHeight;

        doc.setFont('helvetica', 'bold');
        doc.text('Associated Events', 60, y + 20);
        doc.setFont('helvetica', 'normal');
        const relatedEvents = events.filter((event) => event.applicantId === applicant.id);
        if (!relatedEvents.length) {
            doc.text('No linked events.', 60, y + 40);
        } else {
            let eventY = y + 40;
            relatedEvents.forEach((event) => {
                const when = DateTime.fromISO(event.date).toFormat('DDD');
                const titleLine = `${when} ${event.time ? `at ${event.time}` : ''} — ${event.title}`;
                doc.text(titleLine, 60, eventY);
                eventY += lineHeight;
                if (event.stage) {
                    doc.text(`Stage: ${event.stage}`, 80, eventY);
                    eventY += lineHeight;
                }
                if (event.notes) {
                    const wrapped = doc.splitTextToSize(`Notes: ${event.notes}`, 440);
                    doc.text(wrapped, 80, eventY);
                    eventY += wrapped.length * lineHeight;
                }
                eventY += 6;
            });
        }

        doc.save(`${applicant.name.replace(/\s+/g, '_')}_report.pdf`);
    }

    function generateRSSFeed() {
        if (!events.length) {
            alert('Add at least one event to generate an RSS feed.');
            return;
        }

        const feedItems = events
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((event) => {
                const date = DateTime.fromISO(event.date).toRFC2822();
                const applicantName = resolveApplicantName(event.applicantId);
                const summary = [event.title, event.stage, applicantName].filter(Boolean).join(' • ');
                const description = [
                    event.notes || 'No additional notes provided.',
                    applicantName ? `Applicant: ${applicantName}` : null,
                    event.stage ? `Stage: ${event.stage}` : null
                ]
                    .filter(Boolean)
                    .join('\n');

                return `\n      <item>\n        <title><![CDATA[${summary}]]></title>\n        <link>https://example.com/recruitment</link>\n        <guid isPermaLink="false">${event.id}</guid>\n        <pubDate>${date}</pubDate>\n        <description><![CDATA[${description}]]></description>\n      </item>`;
            })
            .join('');

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>Recruitment Operations RSS</title>\n    <link>https://example.com/recruitment</link>\n    <description>Subscribe to stay informed about applicant events and enlistment milestones.</description>${feedItems}\n  </channel>\n</rss>`;

        const blob = new Blob([xml], { type: 'application/rss+xml' });
        const url = URL.createObjectURL(blob);

        const tempLink = document.createElement('a');
        tempLink.href = url;
        tempLink.download = 'recruitment-events.xml';
        tempLink.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function exportData() {
        const payload = {
            applicants,
            events,
            goals
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'recruitment-data.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                try {
                    const data = JSON.parse(loadEvent.target.result);
                    applicants = data.applicants || [];
                    events = data.events || [];
                    goals = data.goals || [];
                    persist(APPLICANTS_KEY, applicants);
                    persist(EVENTS_KEY, events);
                    persist(GOALS_KEY, goals);
                    refreshUI();
                    alert('Import complete.');
                } catch (error) {
                    alert('Unable to import file. Please verify the format.');
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    function clearData() {
        if (!confirm('This will erase all stored data. Continue?')) return;
        localStorage.removeItem(APPLICANTS_KEY);
        localStorage.removeItem(EVENTS_KEY);
        localStorage.removeItem(GOALS_KEY);
        applicants = getSeedApplicants();
        events = getSeedEvents();
        goals = getSeedGoals();
        refreshUI();
    }

    function refreshUI() {
        renderApplicants();
        updateApplicantOptions();
        renderEvents();
        renderGoals();
        updateSummaryStats();
    }

    function getSeedApplicants() {
        return [
            {
                id: crypto.randomUUID(),
                name: 'Jordan Hayes',
                stage: 'Interview',
                age: '27',
                health: '8',
                priorService: 'Air National Guard',
                legalIssues: 'None',
                education: 'B.S. Mechanical Engineering',
                maritalStatus: 'Married',
                dependents: '1',
                tattoos: 'Left forearm insignia',
                notes: 'Strong leadership background. Awaiting background check clearance.'
            },
            {
                id: crypto.randomUUID(),
                name: 'Casey Ramirez',
                stage: 'Background Check',
                age: '24',
                health: '9',
                priorService: 'ROTC Cadet',
                legalIssues: 'None',
                education: 'B.A. Political Science',
                maritalStatus: 'Single',
                dependents: '0',
                tattoos: 'None',
                notes: 'Needs follow-up on medical paperwork by next week.'
            }
        ];
    }

    function getSeedEvents() {
        const applicantOne = applicants?.[0]?.id || crypto.randomUUID();
        return [
            {
                id: crypto.randomUUID(),
                title: 'Panel Interview',
                date: DateTime.now().plus({ days: 2 }).toISODate(),
                time: '14:00',
                notes: 'Panel of three. Prep leadership competency questions.',
                stage: 'Interview',
                applicantId: applicantOne
            },
            {
                id: crypto.randomUUID(),
                title: 'Medical Screening',
                date: DateTime.now().plus({ days: 10 }).toISODate(),
                time: '09:30',
                notes: 'Bring previous medical records and ID.',
                stage: 'Medical',
                applicantId: ''
            }
        ];
    }

    function getSeedGoals() {
        return [
            {
                id: crypto.randomUUID(),
                title: 'Quarterly Enlistments',
                target: 12,
                current: 4,
                dueDate: 'End of Q2',
                notes: 'Focus on technical specialties pipeline.'
            }
        ];
    }

    // ---- Event listeners ----

    addApplicantBtn.addEventListener('click', () => {
        applicants.push({
            id: crypto.randomUUID(),
            name: 'New Applicant',
            stage: STAGE_OPTIONS[0],
            age: '',
            health: '',
            priorService: '',
            legalIssues: '',
            education: '',
            maritalStatus: '',
            dependents: '',
            tattoos: '',
            notes: ''
        });
        persist(APPLICANTS_KEY, applicants);
        renderApplicants();
        updateApplicantOptions();
        updateSummaryStats();
    });

    eventForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const id = document.getElementById('event-id').value;
        const title = document.getElementById('event-title').value.trim();
        const date = document.getElementById('event-date').value;
        const time = document.getElementById('event-time').value;
        const notes = document.getElementById('event-notes').value.trim();
        const stage = document.getElementById('event-stage').value.trim();
        const applicantId = document.getElementById('event-applicant').value;

        if (!title || !date) {
            alert('Please provide both a title and date.');
            return;
        }

        const payload = {
            title,
            date,
            time,
            notes,
            stage,
            applicantId
        };

        if (id) {
            const index = events.findIndex((item) => item.id === id);
            if (index !== -1) {
                events[index] = { ...events[index], ...payload };
            }
        } else {
            events.push({ id: crypto.randomUUID(), ...payload });
        }

        persist(EVENTS_KEY, events);
        renderEvents();
        resetEventForm();
    });

    document.getElementById('reset-event').addEventListener('click', (event) => {
        event.preventDefault();
        resetEventForm();
    });

    rssBtn.addEventListener('click', generateRSSFeed);
    addGoalBtn.addEventListener('click', () => {
        goals.push({
            id: crypto.randomUUID(),
            title: 'New Goal',
            target: 1,
            current: 0,
            dueDate: '',
            notes: ''
        });
        persist(GOALS_KEY, goals);
        renderGoals();
        updateSummaryStats();
    });

    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', importData);
    clearBtn.addEventListener('click', clearData);

    prevMonthBtn.addEventListener('click', () => {
        activeMonth = activeMonth.minus({ months: 1 });
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        activeMonth = activeMonth.plus({ months: 1 });
        renderCalendar();
    });

    // ---- Initial render ----

    refreshUI();
})();
