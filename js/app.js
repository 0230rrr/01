        (function() {
            let areas = [];
            let activeAreaId = null;
            let currentPage = 'overview';
            let filterContext = { areaId: 'all', status: 'all' };
            let insightsAreaId = 'all';

            let tlView = 'week';
            let tlWeekCount = 1;
            let tlMonthCount = 1;
            let tlQuarterCount = 1;
            let tlHalfYearCount = 1;
            let tlYearCount = 1;
            let tlAnchor = new Date();
            let tlAreaId = 'all';
            let tlShowTasks = false;

            // 學期設定
            let semesterStartInput = new Date(2026, 8, 1);
            let semesterEndMode = 'date';
            let semesterEndInputDate = new Date(2027, 0, 12);
            let semesterEndInputWeek = 18;
            let bindSemester = false;

            let calView = 'day';
            let calAnchor = new Date();
            let calAreaId = 'all';

            let currentTrackId = null;
            let addTaskPanelOpen = false;

            const TRACK_COLORS = [
                '#b9822e', '#8fa882', '#c99b5e', '#7a96a8', '#c9886e',
                '#a8b89a', '#c9a6b8', '#8b9dc3', '#d4a5a5', '#9cb4a8'
            ];

            const STORAGE_KEY = 'luneAppData';

            function generateId() {
                return Date.now() + Math.random().toString(36).substring(2, 9);
            }

            function getSampleAreas() { return []; }

            function migrateData() {
                areas.forEach(area => {
                    const migrateTask = (t) => {
                        if (t.milestoneId !== undefined && t.milestoneIds === undefined) {
                            t.milestoneIds = t.milestoneId ? [t.milestoneId] : [];
                            delete t.milestoneId;
                        } else if (t.milestoneIds === undefined) t.milestoneIds = [];
                        if (!t.schedule) t.schedule = [];
                        if (!t.tags) t.tags = [];
                        if (!t.subtasks) t.subtasks = [];
                    };
                    area.tracks.forEach((track, i) => {
                        if (!track.color) track.color = TRACK_COLORS[i % TRACK_COLORS.length];
                        (track.tasks || []).forEach(migrateTask);
                        (track.milestones || []).forEach(ms => {
                            (ms.tasks || []).forEach(migrateTask);
                            if (!ms.tasks) ms.tasks = [];
                            if (ms.startDate === undefined) ms.startDate = '';
                        });
                    });
                    (area.unassignedTasks || []).forEach(migrateTask);
                });
            }

            function cleanupMilestoneTasks() {
                areas.forEach(area => {
                    area.tracks.forEach(track => {
                        (track.milestones || []).forEach(ms => {
                            ms.tasks = [];
                        });
                    });
                });
            }

            function init() {
                let saved = localStorage.getItem(STORAGE_KEY);
                if (!saved) {
                    const oldKeys = ['luneAppV13', 'luneAppV12', 'luneAppV11', 'luneAppV10'];
                    for (const k of oldKeys) {
                        const old = localStorage.getItem(k);
                        if (old) {
                            saved = old;
                            localStorage.setItem(STORAGE_KEY, old);
                            break;
                        }
                    }
                }
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        areas = parsed.areas || getSampleAreas();
                        activeAreaId = parsed.activeAreaId !== undefined ? parsed.activeAreaId : (areas[0] ? areas[0].id : null);
                        // 學期設定
                        if (parsed.semester) {
                            if (parsed.semester.start) semesterStartInput = new Date(parsed.semester.start);
                            if (parsed.semester.endMode) semesterEndMode = parsed.semester.endMode;
                            if (parsed.semester.endDate) semesterEndInputDate = new Date(parsed.semester.endDate);
                            if (parsed.semester.endWeek) semesterEndInputWeek = parsed.semester.endWeek;
                            if (parsed.semester.bind !== undefined) bindSemester = parsed.semester.bind;
                        }
                    } catch (e) {
                        areas = getSampleAreas();
                        activeAreaId = null;
                    }
                } else {
                    areas = getSampleAreas();
                    activeAreaId = null;
                }
                migrateData();
                cleanupMilestoneTasks();
                if (activeAreaId !== null && !areas.find(a => a.id === activeAreaId)) {
                    activeAreaId = areas[0] ? areas[0].id : null;
                }
                renderTopbarDate();
                // 學期 UI 同步
                document.getElementById('bindSemester').checked = bindSemester;
                document.getElementById('semesterStart').value = dateKey(semesterStartInput);
                document.getElementById('semesterEndMode').value = semesterEndMode;
                document.getElementById('semesterEndDate').value = dateKey(semesterEndInputDate);
                document.getElementById('semesterEndWeek').value = semesterEndInputWeek;
                updateSemesterSettingsVisibility();
                renderAll();
            }

            function save() {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    areas,
                    activeAreaId,
                    semester: {
                        start: dateKey(semesterStartInput),
                        endMode: semesterEndMode,
                        endDate: dateKey(semesterEndInputDate),
                        endWeek: semesterEndInputWeek,
                        bind: bindSemester
                    }
                }));
            }

            function renderTopbarDate() {
                const now = new Date();
                const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
                document.getElementById('topbarDate').textContent = now.toLocaleDateString('zh-TW', options);
                const hour = now.getHours();
                let greeting = '早安';
                if (hour >= 12 && hour < 18) greeting = '午安';
                else if (hour >= 18) greeting = '晚安';
                document.getElementById('topbarWelcome').textContent = greeting;
            }

            function escapeHtml(text) {
                const div = document.createElement('div');
                div.textContent = text == null ? '' : text;
                return div.innerHTML;
            }

            function dateKey(d) {
                const dt = new Date(d);
                return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            }
            function parseDate(str) {
                if (!str) return null;
                const d = new Date(str);
                if (isNaN(d.getTime())) return null;
                return d;
            }
            function addDays(date, n) {
                const d = new Date(date);
                d.setDate(d.getDate() + n);
                return d;
            }
            function addMonths(date, n) {
                const d = new Date(date);
                d.setMonth(d.getMonth() + n);
                return d;
            }
            function startOfWeek(date) {
                const d = new Date(date);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                d.setDate(diff);
                d.setHours(0, 0, 0, 0);
                return d;
            }
            function startOfMonth(date) {
                return new Date(date.getFullYear(), date.getMonth(), 1);
            }

            // 半月工具
            function getHalfStart(date) {
                const d = new Date(date);
                if (d.getDate() <= 15) d.setDate(1);
                else d.setDate(16);
                d.setHours(0, 0, 0, 0);
                return d;
            }
            function prevHalf(date) {
                const d = getHalfStart(date);
                if (d.getDate() === 1) {
                    d.setMonth(d.getMonth() - 1);
                    d.setDate(16);
                } else {
                    d.setDate(1);
                }
                return d;
            }
            function nextHalf(date) {
                const d = getHalfStart(date);
                if (d.getDate() === 1) {
                    d.setDate(16);
                } else {
                    d.setMonth(d.getMonth() + 1);
                    d.setDate(1);
                }
                return d;
            }

            // 學期輔助
            function getSemesterMonday() { return startOfWeek(semesterStartInput); }
            function getSemesterSunday() {
                if (semesterEndMode === 'date') {
                    const d = new Date(semesterEndInputDate);
                    const day = d.getDay();
                    const diff = d.getDate() - day + (day === 0 ? 0 : 7);
                    d.setDate(diff);
                    d.setHours(0, 0, 0, 0);
                    return d;
                }
                return addDays(getSemesterMonday(), semesterEndInputWeek * 7 - 1);
            }
            function getWeekNumber(date) {
                const semesterMon = getSemesterMonday();
                const targetMon = startOfWeek(date);
                const diffDays = Math.round((targetMon - semesterMon) / 86400000);
                return Math.floor(diffDays / 7) + 1;
            }
            function isWithinSemester(cellStart) {
                if (!bindSemester) return false;
                const semesterSun = getSemesterSunday();
                const lastMonday = startOfWeek(semesterSun);
                const cellMon = startOfWeek(cellStart);
                return cellMon <= lastMonday;
            }

            function startInlineEdit(element, currentValue, onSave) {
                if (element.querySelector('.inline-edit-input')) return;
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'inline-edit-input';
                input.value = currentValue;
                const original = element.textContent;
                element.textContent = '';
                element.appendChild(input);
                input.focus();
                input.select();
                let finished = false;
                function finish(saveIt) {
                    if (finished) return;
                    finished = true;
                    const newValue = input.value.trim();
                    if (saveIt && newValue && newValue !== currentValue) onSave(newValue);
                    else element.textContent = original;
                }
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
                    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
                });
                input.addEventListener('blur', function() { finish(true); });
            }

            function getTaskProgress(task) {
                if (!task.subtasks || task.subtasks.length === 0) return task.completed ? 100 : 0;
                const done = task.subtasks.filter(st => st.completed).length;
                return Math.round((done / task.subtasks.length) * 100);
            }

            function getMilestoneProgress(ms) {
                if (ms.type === 'numeric') {
                    if (ms.status === 'achieved') return 100;
                    if (ms.start !== undefined && ms.current !== undefined && ms.target !== undefined) {
                        const total = Math.abs(ms.start - ms.target);
                        if (total === 0) return 100;
                        const done = Math.abs(ms.start - ms.current);
                        const auto = Math.round((done / total) * 100);
                        if (ms.manualProgress !== undefined && ms.manualProgress !== null) {
                            return Math.max(0, Math.min(100, ms.manualProgress));
                        }
                        return Math.max(0, Math.min(100, auto));
                    }
                    return Math.min(100, Math.round(ms.progress || 0));
                }
                if (ms.type === 'binary') return ms.status === 'achieved' ? 100 : 0;
                return ms.progress || 0;
            }

            function getTrackProgress(track) {
                if (track.milestones && track.milestones.length > 0) {
                    const sum = track.milestones.reduce((acc, m) => acc + getMilestoneProgress(m), 0);
                    return Math.round(sum / track.milestones.length);
                }
                if (track.tasks && track.tasks.length > 0) {
                    const sum = track.tasks.reduce((acc, t) => acc + getTaskProgress(t), 0);
                    return Math.round(sum / track.tasks.length);
                }
                return 0;
            }

            function getAllTasksOfTrack(track) {
                const all = [];
                (track.tasks || []).forEach(t => all.push({ task: t, milestone: null }));
                all.forEach(item => {
                    const t = item.task;
                    if (t.milestoneIds && t.milestoneIds.length > 0) {
                        for (const msId of t.milestoneIds) {
                            const ms = (track.milestones || []).find(m => m.id === msId);
                            if (ms) {
                                item.milestone = ms;
                                break;
                            }
                        }
                    }
                });
                return all;
            }

            function findTrackById(trackId) {
                for (const area of areas) for (const track of area.tracks) if (track.id === trackId) return { track, area };
                return null;
            }

            function findTaskById(taskId) {
                for (const area of areas) {
                    for (const track of area.tracks) {
                        for (const task of (track.tasks || [])) if (task.id === taskId) return { task, track, milestone: null, area };
                    }
                    for (const task of (area.unassignedTasks || [])) if (task.id === taskId) return { task, track: null, milestone: null, area };
                }
                return null;
            }

            function findMilestoneById(msId) {
                for (const area of areas) for (const track of area.tracks) for (const ms of (track.milestones || [])) if (ms.id === msId) return { milestone: ms, track, area };
                return null;
            }

            function getAllMilestonesInArea(areaId) {
                const result = [];
                areas.forEach(area => {
                    if (areaId !== 'all' && area.id !== areaId) return;
                    area.tracks.forEach(track => (track.milestones || []).forEach(ms => result.push({ milestone: ms, track, area })));
                });
                return result;
            }

            function renderSidebar() {
                const el = document.getElementById('areasSublist');
                let html = `<div class="areas-sublabel">Areas</div>`;
                const allActive = activeAreaId === null ? 'active' : '';
                html += `<div class="area-item all-areas ${allActive}" onclick="window.switchArea(null)"><span class="area-name">全部領域</span></div>`;
                areas.forEach(area => {
                    const activeClass = area.id === activeAreaId ? 'active' : '';
                    html += `
                        <div class="area-item ${activeClass}" draggable="true" data-area-id="${area.id}" onclick="window.switchArea('${area.id}')">
                            <span class="area-name">${escapeHtml(area.name)}</span>
                            <span class="area-edit-icon" onclick="event.stopPropagation();window.startEditAreaName('${area.id}')" title="重新命名">✎</span>
                        </div>
                    `;
                });
                html += `<div class="area-add-inline" onclick="window.showAreaAddInline()">＋ 新增領域</div>`;
                el.innerHTML = html;
                bindAreaDrag();
            }

            function renderOverview() {
                const el = document.getElementById('overviewContent');
                let areaName, isAll;
                if (activeAreaId === null) { areaName = '全部領域'; isAll = true; }
                else {
                    const area = areas.find(a => a.id === activeAreaId);
                    if (!area) { el.innerHTML = ''; return; }
                    areaName = area.name; isAll = false;
                }

                if (areas.length === 0) {
                    el.innerHTML = `
                        <div class="welcome-panel">
                            <div class="wp-moon">☽</div>
                            <h2>歡迎使用月庭</h2>
                            <p>從建立第一個領域開始。<br>例如：個人、學業、工作、健康。</p>
                            <button class="empty-add-btn" onclick="window.showAreaAddInline()">＋ 新增領域</button>
                        </div>
                    `;
                    return;
                }

                const tracks = [];
                areas.forEach(area => {
                    if (activeAreaId !== null && area.id !== activeAreaId) return;
                    area.tracks.forEach(track => tracks.push({ track, area }));
                });

                const allTasks = [];
                areas.forEach(area => {
                    if (activeAreaId !== null && area.id !== activeAreaId) return;
                    (area.unassignedTasks || []).forEach(t => allTasks.push({ task: t, track: null, area }));
                    area.tracks.forEach(track => {
                        (track.tasks || []).forEach(t => allTasks.push({ task: t, track, area }));
                    });
                });

                const activeTasks = allTasks.filter(t => !t.task.completed && t.task.status !== 'cancelled');
                const milestones = getAllMilestonesInArea(activeAreaId);
                const upcomingMilestones = milestones.filter(m => m.milestone.status !== 'achieved' && m.milestone.status !== 'cancelled');

                let html = `
                    <div class="area-header">
                        <span class="deco-moon">☽</span>
                        <div class="kicker">${isAll ? 'All Areas' : 'Area'}</div>
                        <h1><span class="area-title-text">${escapeHtml(areaName)}</span></h1>
                        <div class="area-stats">
                            <div class="area-stat"><span class="stat-value">${tracks.length}</span><span class="stat-label">Tracks</span></div>
                            <div class="area-stat"><span class="stat-value">${activeTasks.length}</span><span class="stat-label">Active Tasks</span></div>
                            <div class="area-stat"><span class="stat-value">${upcomingMilestones.length}</span><span class="stat-label">Upcoming</span></div>
                        </div>
                    </div>
                `;

                if (!isAll) {
                    html += `<div style="margin-bottom:1.5rem;">
                        <button class="section-action" style="border:1px solid var(--line);padding:0.5rem 1.2rem;border-radius:1.5rem;font-size:0.72rem;" onclick="window.addTrackInline()">＋ 新增軌道到「${escapeHtml(areaName)}」</button>
                    </div>`;
                }

                const attention = getAttentionItems();
                html += `<div class="section"><div class="section-header"><div class="section-title">Attention</div></div>`;
                if (attention.length === 0) {
                    html += `<div class="empty-section"><span class="empty-text">目前沒有需要注意的事情。</span></div>`;
                } else {
                    attention.forEach(item => {
                        if (item.type === 'task') {
                            const { task, track, area } = item;
                            const today = new Date(new Date().toDateString());
                            let dueText = '', dueClass = '';
                            if (task.dueDate) {
                                const dueDate = new Date(task.dueDate);
                                const diff = Math.round((dueDate - today) / 86400000);
                                if (diff < 0) { dueText = `逾期 ${Math.abs(diff)} 天`; dueClass = 'overdue'; }
                                else if (diff === 0) { dueText = '今天到期'; dueClass = 'today'; }
                                else if (diff === 1) { dueText = '明天到期'; }
                                else dueText = `${dueDate.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} 到期`;
                            }
                            let icon = '○', cls = 'progress';
                            if (task.status === 'in-progress') icon = '◐';
                            else if (dueClass === 'overdue' || dueClass === 'today' || task.status === 'blocked') { icon = '⚠'; cls = 'warning'; }
                            html += `
                                <div class="attention-item">
                                    <div class="at-icon ${cls}">${icon}</div>
                                    <div class="at-body">
                                        <div class="at-title" onclick="window.openTaskDrawer('${task.id}')">${escapeHtml(task.title)}</div>
                                        <div class="at-meta">
                                            ${isAll ? `<span>${escapeHtml(area.name)}</span><span class="sep">·</span>` : ''}
                                            ${track ? `<span>${escapeHtml(track.name)}</span>` : '<span>未分類</span>'}
                                            ${item.reason ? `<span class="sep">·</span><span>${item.reason}</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="at-due ${dueClass}">${dueText}</div>
                                </div>
                            `;
                        } else {
                            const { milestone, track, area } = item;
                            let dateText = '';
                            if (milestone.due) { const d = new Date(milestone.due); dateText = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }); }
                            html += `
                                <div class="attention-item">
                                    <div class="at-icon progress">●</div>
                                    <div class="at-body">
                                        <div class="at-title" onclick="window.openMilestoneDrawer('${milestone.id}')">${escapeHtml(milestone.title)}</div>
                                        <div class="at-meta">
                                            ${isAll ? `<span>${escapeHtml(area.name)}</span><span class="sep">·</span>` : ''}
                                            <span>${escapeHtml(track.name)}</span>
                                            ${item.reason ? `<span class="sep">·</span><span>${item.reason}</span>` : ''}
                                        </div>
                                    </div>
                                    <div class="at-due">${dateText}</div>
                                </div>
                            `;
                        }
                    });
                }
                html += `</div>`;

                html += `<div class="section"><div class="section-header"><div class="section-title">Tracks</div>${!isAll ? `<button class="section-action" onclick="window.addTrackInline()">＋ 新增軌道</button>` : ''}</div>`;
                if (tracks.length === 0) {
                    html += `<div class="empty-section"><span class="empty-text">目前沒有軌道。</span></div>`;
                } else {
                    html += `<div class="track-cards">`;
                    tracks.forEach(({ track, area }) => {
                        const progress = getTrackProgress(track);
                        const msList = track.milestones || [];
                        const allTasks = getAllTasksOfTrack(track);
                        const doneTasks = allTasks.filter(t => t.task.completed).length;
                        const nextMs = msList.find(m => m.status !== 'achieved' && m.status !== 'cancelled');
                        const color = track.color || TRACK_COLORS[0];
                        html += `
                            <div class="track-card" onclick="window.openTrackDetail('${track.id}')">
                                <div class="tc-name"><span class="dot" style="background:${color};"></span>${escapeHtml(track.name)}</div>
                                <div class="tc-progress-label">Progress</div>
                                <div class="tc-bar-bg"><div class="tc-bar-fill" style="width:${progress}%;background:${color};"></div></div>
                                <div class="tc-progress-num" style="color:${color};">${progress}%</div>
                                ${nextMs ? `<div class="tc-next"><span class="label">Next</span>${escapeHtml(nextMs.title)}</div>` : `<div class="tc-next"><span class="label">Status</span>沒有未完成的里程碑</div>`}
                                <div class="tc-stats">
                                    ${isAll ? `<span>${escapeHtml(area.name)}</span>` : ''}
                                    <span>${doneTasks} / ${allTasks.length} 任務</span>
                                    <span>${msList.length} 個里程碑</span>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                html += `</div>`;

                html += `<div class="roadmap-container"><div class="roadmap-header"><div class="roadmap-title">Roadmap</div><div class="roadmap-legend"><span><span class="lg-dot"></span> 未開始</span><span><span class="lg-dot in-progress"></span> 進行中</span><span><span class="lg-dot achieved"></span> 已達成</span></div></div>`;
                if (tracks.length === 0) {
                    html += `<div class="roadmap-empty-track">沒有軌道可以顯示。</div>`;
                } else {
                    tracks.forEach(({ track, area }) => {
                        const msList = track.milestones || [];
                        const color = track.color || TRACK_COLORS[0];
                        html += `<div class="roadmap-track"><div class="roadmap-track-name"><span class="dot" style="background:${color};"></span>${escapeHtml(track.name)}${isAll ? `<span class="area-tag">${escapeHtml(area.name)}</span>` : ''}</div>`;
                        if (msList.length === 0) {
                            html += `<div class="roadmap-empty-track">沒有里程碑 — 這是一條持續進行的軌道。</div>`;
                        } else {
                            html += `<div class="roadmap-line-wrap"><div class="roadmap-line">`;
                            msList.forEach((ms, index) => {
                                const achieved = ms.status === 'achieved';
                                const inProgress = ms.status === 'in-progress';
                                const nodeClass = achieved ? 'achieved' : (inProgress ? 'in-progress' : '');
                                let metaStr = '';
                                if (ms.type === 'numeric' && ms.start !== undefined && ms.current !== undefined && ms.target !== undefined) metaStr = `${ms.start} → ${ms.current} → ${ms.target}`;
                                else if (ms.type === 'numeric' && ms.current !== undefined && ms.target !== undefined) metaStr = `${ms.current} → ${ms.target}`;
                                else if (ms.type === 'progress') metaStr = `${ms.progress || 0}%`;
                                else if (ms.due) { const d = new Date(ms.due); metaStr = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }); }
                                html += `
                                    <div class="roadmap-node ${nodeClass}" data-ms-id="${ms.id}" data-track-id="${track.id}" draggable="true"
                                        onclick="if(!this.classList.contains('dragging'))window.openMilestoneDrawer('${ms.id}')">
                                        <div class="roadmap-circle" style="${achieved || inProgress ? `background:${color};border-color:${color};` : `border-color:${color};`}">${achieved ? '✓' : (inProgress ? '●' : '○')}</div>
                                        <div class="roadmap-label">${escapeHtml(ms.title)}</div>
                                        ${metaStr ? `<div class="roadmap-meta">${metaStr}</div>` : ''}
                                    </div>
                                `;
                                if (index < msList.length - 1) {
                                    const nextAchieved = msList[index + 1].status === 'achieved';
                                    let cc = '';
                                    if (achieved && nextAchieved) cc = 'done';
                                    else if (achieved && !nextAchieved) cc = 'current';
                                    else if (!achieved && inProgress) cc = 'current';
                                    html += `<div class="roadmap-connector ${cc}" style="${cc === 'done' ? `background:${color};` : ''}"></div>`;
                                }
                            });
                            html += `</div></div>`;
                        }
                        html += `</div>`;
                    });
                }
                html += `</div>`;

                el.innerHTML = html;
                bindMilestoneDrag();
            }

            function getAttentionItems() {
                const items = [];
                const today = new Date(new Date().toDateString());
                areas.forEach(area => {
                    if (activeAreaId !== null && area.id !== activeAreaId) return;
                    const allTasks = [];
                    (area.unassignedTasks || []).forEach(t => allTasks.push({ task: t, track: null, area }));
                    area.tracks.forEach(track => {
                        (track.tasks || []).forEach(t => allTasks.push({ task: t, track, area }));
                    });
                    allTasks.forEach(({ task, track, milestone, area }) => {
                        if (task.completed || task.status === 'cancelled') return;
                        let priority = 999, reason = '';
                        if (task.dueDate) {
                            const dueDate = new Date(task.dueDate);
                            if (dueDate < today) { priority = 0; reason = '逾期'; }
                            else if (dueDate.getTime() === today.getTime()) { priority = 1; reason = '今天到期'; }
                            else {
                                const diff = Math.round((dueDate - today) / 86400000);
                                if (diff <= 3) { priority = 2; reason = `${diff} 天後到期`; }
                            }
                        }
                        if (task.status === 'blocked' && priority > 3) { priority = 3; reason = '阻塞'; }
                        if (task.status === 'in-progress' && priority > 4) { priority = 4; reason = '進行中'; }
                        if (priority < 999) items.push({ type: 'task', priority, reason, task, track, milestone, area });
                    });
                    (area.tracks || []).forEach(track => {
                        (track.milestones || []).forEach(ms => {
                            if (ms.status === 'achieved' || ms.status === 'cancelled') return;
                            let priority = 999, reason = '';
                            if (ms.due) {
                                const dueDate = new Date(ms.due);
                                if (dueDate < today) { priority = 0; reason = '逾期'; }
                                else {
                                    const diff = Math.round((dueDate - today) / 86400000);
                                    if (diff <= 14) { priority = 5; reason = `${diff} 天後`; }
                                }
                            }
                            if (ms.status === 'in-progress' && priority > 6) { priority = 6; reason = '進行中'; }
                            if (priority < 999) items.push({ type: 'milestone', priority, reason, milestone: ms, track, area });
                        });
                    });
                });
                items.sort((a, b) => a.priority - b.priority);
                return items.slice(0, 5);
            }

            function renderMyTasks() {
                const el = document.getElementById('mytasksContent');
                const filterArea = filterContext.areaId;
                const filterStatus = filterContext.status;
                const today = new Date(new Date().toDateString());

                let allTasks = [];
                areas.forEach(area => {
                    if (filterArea !== 'all' && area.id !== filterArea) return;
                    (area.unassignedTasks || []).forEach(t => allTasks.push({ task: t, track: null, area }));
                    area.tracks.forEach(track => {
                        (track.tasks || []).forEach(t => allTasks.push({ task: t, track, area }));
                    });
                });

                if (filterStatus === 'active') allTasks = allTasks.filter(x => !x.task.completed && x.task.status !== 'cancelled');
                else if (filterStatus === 'completed') allTasks = allTasks.filter(x => x.task.completed);
                else if (filterStatus === 'overdue') allTasks = allTasks.filter(x => !x.task.completed && x.task.dueDate && new Date(x.task.dueDate) < today);
                else if (filterStatus === 'today') allTasks = allTasks.filter(x => !x.task.completed && x.task.dueDate && new Date(x.task.dueDate).getTime() === today.getTime());
                else if (filterStatus === 'unscheduled') allTasks = allTasks.filter(x => !x.task.startDate && !x.task.dueDate && (!x.task.schedule || x.task.schedule.length === 0));

                allTasks.sort((a, b) => {
                    const aOverdue = a.task.dueDate && new Date(a.task.dueDate) < today && !a.task.completed;
                    const bOverdue = b.task.dueDate && new Date(b.task.dueDate) < today && !b.task.completed;
                    if (aOverdue && !bOverdue) return -1;
                    if (!aOverdue && bOverdue) return 1;
                    const pa = { high: 0, medium: 1, low: 2 }[a.task.priority] ?? 3;
                    const pb = { high: 0, medium: 1, low: 2 }[b.task.priority] ?? 3;
                    if (pa !== pb) return pa - pb;
                    if (a.task.dueDate && b.task.dueDate) return new Date(a.task.dueDate) - new Date(b.task.dueDate);
                    return 0;
                });

                let html = `<div class="task-list-flat">`;
                if (allTasks.length === 0) {
                    html += `<div class="empty-section"><span class="empty-text">沒有符合條件的任務。</span></div>`;
                } else {
                    allTasks.forEach(({ task, track, area }) => {
                        let dueText = '', dueClass = '';
                        if (task.dueDate) {
                            const dueDate = new Date(task.dueDate);
                            const diff = Math.round((dueDate - today) / 86400000);
                            if (diff < 0) { dueText = `逾期 ${Math.abs(diff)} 天`; dueClass = 'overdue'; }
                            else if (diff === 0) { dueText = '今天到期'; dueClass = 'today'; }
                            else if (diff === 1) { dueText = '明天到期'; }
                            else dueText = `${dueDate.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} 到期`;
                        }
                        const priorityLabel = { high: '高', medium: '中', low: '低' }[task.priority] || '';
                        const trackColor = track ? (track.color || TRACK_COLORS[0]) : '#c9b89c';
                        let msNames = '';
                        if (track && task.milestoneIds && task.milestoneIds.length > 0) {
                            msNames = task.milestoneIds.map(id => {
                                const ms = (track.milestones || []).find(m => m.id === id);
                                return ms ? ms.title : '';
                            }).filter(s => s).join(' · ');
                        }
                        html += `
                            <div class="flat-task ${task.completed ? 'completed' : ''}" style="border-left:3px solid ${trackColor};">
                                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="window.toggleTaskFromList('${task.id}')">
                                <div style="flex:1;min-width:200px;">
                                    <div class="breadcrumb">
                                        ${filterArea === 'all' ? `<span>${escapeHtml(area.name)}</span><span class="sep">·</span>` : ''}
                                        ${track ? `<span style="color:${trackColor};">${escapeHtml(track.name)}</span>` : `<span>未分類</span>`}
                                        ${msNames ? `<span class="sep">·</span><span>${escapeHtml(msNames)}</span>` : ''}
                                    </div>
                                    <div class="task-name" onclick="window.openTaskDrawer('${task.id}')" style="cursor:pointer;">${escapeHtml(task.title)}</div>
                                </div>
                                <div class="task-right">
                                    ${priorityLabel ? `<span>${priorityLabel}</span>` : ''}
                                    ${dueText ? `<span style="${dueClass === 'overdue' || dueClass === 'today' ? 'color:var(--red);font-weight:600;' : ''}">${dueText}</span>` : ''}
                                </div>
                            </div>
                        `;
                    });
                }
                html += `</div>`;
                el.innerHTML = html;
            }

            function renderProjects() {
                const el = document.getElementById('projectsContent');
                const filterArea = filterContext.areaId;
                let tracks = [];
                areas.forEach(area => {
                    if (filterArea !== 'all' && area.id !== filterArea) return;
                    area.tracks.forEach(track => tracks.push({ track, area }));
                });

                let html = `<div class="projects-grid">`;
                if (tracks.length === 0) {
                    html += `<div class="empty-section"><span class="empty-text">目前沒有軌道。</span></div>`;
                } else {
                    tracks.forEach(({ track, area }) => {
                        const progress = getTrackProgress(track);
                        const msCount = (track.milestones || []).length;
                        const allTasks = getAllTasksOfTrack(track);
                        const doneTasks = allTasks.filter(t => t.task.completed).length;
                        const color = track.color || TRACK_COLORS[0];
                        html += `
                            <div class="project-card" style="border-left:3px solid ${color};" onclick="window.openTrackDetail('${track.id}')">
                                <div class="pc-area">${escapeHtml(area.name)}</div>
                                <div class="pc-name"><span class="dot" style="background:${color};"></span>${escapeHtml(track.name)}</div>
                                <div class="pc-bar-bg"><div class="pc-bar-fill" style="width:${progress}%;background:${color};"></div></div>
                                <div class="pc-stats">
                                    <span>${progress}%</span>
                                    <span>${doneTasks} / ${allTasks.length} 任務</span>
                                    <span>${msCount} 個里程碑</span>
                                </div>
                            </div>
                        `;
                    });
                }
                html += `</div>`;
                el.innerHTML = html;
            }

            function renderTrackDetail() {
                const el = document.getElementById('trackDetailContent');
                if (!currentTrackId) {
                    el.innerHTML = `<div class="empty-section"><span class="empty-text">請從專案選擇一條軌道。</span></div>`;
                    return;
                }
                const found = findTrackById(currentTrackId);
                if (!found) { el.innerHTML = `<div class="empty-section"><span class="empty-text">找不到這條軌道。</span></div>`; return; }
                const { track, area } = found;
                const progress = getTrackProgress(track);
                const msList = track.milestones || [];
                const allTasks = getAllTasksOfTrack(track);
                const doneTasks = allTasks.filter(t => t.task.completed).length;
                const color = track.color || TRACK_COLORS[0];

                const colorSwatches = TRACK_COLORS.map(c => `
                    <div class="color-swatch ${c === color ? 'selected' : ''}" style="background:${c};"
                        onclick="window.setTrackColor('${track.id}', '${c}')"></div>
                `).join('');

                let html = `
                    <div class="track-detail-header">
                        <div class="track-detail-back" onclick="window.switchPage('projects')">← 返回專案</div>
                        <h1>
                            <span class="color-dot" style="background:${color};"></span>
                            <span id="tdTrackName">${escapeHtml(track.name)}</span>
                            <span style="cursor:pointer;opacity:0.4;font-size:0.9rem;" onclick="window.startEditTrackName('${track.id}')" title="重新命名">✎</span>
                        </h1>
                        <div class="track-detail-meta">${escapeHtml(area.name)} · ${msList.length} 個里程碑 · ${doneTasks} / ${allTasks.length} 任務完成</div>
                        <div style="margin-top:0.8rem;">
                            <div style="font-size:0.55rem;letter-spacing:0.2em;color:var(--muted);margin-bottom:0.3rem;text-transform:uppercase;font-family:Georgia,serif;">Track Color</div>
                            <div class="color-picker-row">${colorSwatches}</div>
                        </div>
                        <div class="track-detail-actions">
                            <button class="track-detail-btn" onclick="window.toggleAddTaskPanelTrack('${track.id}')">＋ 新增任務</button>
                            <button class="track-detail-btn" onclick="window.showAddMilestoneInline('${track.id}')">＋ 新增里程碑</button>
                            <button class="track-detail-btn" onclick="window.sortMilestonesByDue('${track.id}')">一鍵排序（依截止日）</button>
                            <button class="track-detail-btn danger" onclick="window.deleteTrackConfirm('${track.id}')">刪除軌道</button>
                        </div>
                    </div>
                `;

                if (addTaskPanelOpen && addTaskPanelOpen === 'track:' + currentTrackId) {
                    html += renderAddTaskPanelTrack(currentTrackId);
                }

                html += `
                    <div class="section">
                        <div class="section-header"><div class="section-title">Progress</div></div>
                        <div class="tc-bar-bg" style="height:8px;"><div class="tc-bar-fill" style="width:${progress}%;background:${color};"></div></div>
                        <div style="font-size:1.5rem;font-weight:600;color:${color};margin-top:0.5rem;font-family:Georgia,serif;">${progress}%</div>
                    </div>
                `;

                html += `<div class="roadmap-container"><div class="roadmap-header"><div class="roadmap-title">Track Roadmap</div><div class="roadmap-legend"><span><span class="lg-dot"></span> 未開始</span><span><span class="lg-dot in-progress"></span> 進行中</span><span><span class="lg-dot achieved"></span> 已達成</span></div></div>`;
                if (msList.length === 0) {
                    html += `<div class="roadmap-empty-track">沒有里程碑 — 這是一條持續進行的軌道。</div>`;
                } else {
                    html += `<div class="roadmap-line-wrap"><div class="roadmap-line">`;
                    msList.forEach((ms, index) => {
                        const achieved = ms.status === 'achieved';
                        const inProgress = ms.status === 'in-progress';
                        const nodeClass = achieved ? 'achieved' : (inProgress ? 'in-progress' : '');
                        let metaStr = '';
                        if (ms.type === 'numeric' && ms.start !== undefined && ms.current !== undefined && ms.target !== undefined) metaStr = `${ms.start} → ${ms.current} → ${ms.target}`;
                        else if (ms.type === 'numeric' && ms.current !== undefined && ms.target !== undefined) metaStr = `${ms.current} → ${ms.target}`;
                        else if (ms.type === 'progress') metaStr = `${ms.progress || 0}%`;
                        else if (ms.due) { const d = new Date(ms.due); metaStr = d.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }); }
                        html += `
                            <div class="roadmap-node ${nodeClass}" data-ms-id="${ms.id}" data-track-id="${track.id}" draggable="true"
                                onclick="if(!this.classList.contains('dragging'))window.openMilestoneDrawer('${ms.id}')">
                                <div class="roadmap-circle" style="${achieved || inProgress ? `background:${color};border-color:${color};` : `border-color:${color};`}">${achieved ? '✓' : (inProgress ? '●' : '○')}</div>
                                <div class="roadmap-label">${escapeHtml(ms.title)}</div>
                                ${metaStr ? `<div class="roadmap-meta">${metaStr}</div>` : ''}
                            </div>
                        `;
                        if (index < msList.length - 1) {
                            const nextAchieved = msList[index + 1].status === 'achieved';
                            let cc = '';
                            if (achieved && nextAchieved) cc = 'done';
                            else if (achieved && !nextAchieved) cc = 'current';
                            else if (!achieved && inProgress) cc = 'current';
                            html += `<div class="roadmap-connector ${cc}" style="${cc === 'done' ? `background:${color};` : ''}"></div>`;
                        }
                    });
                    html += `</div></div>`;
                }
                html += `</div>`;

                html += `<div class="section"><div class="section-header"><div class="section-title">Tasks</div></div>`;
                if (allTasks.length === 0) {
                    html += `<div class="empty-section"><span class="empty-text">目前沒有任務。</span></div>`;
                } else {
                    html += `<div class="task-list-flat">`;
                    allTasks.forEach(({ task, milestone }) => {
                        html += `
                            <div class="flat-task ${task.completed ? 'completed' : ''}" style="border-left:3px solid ${color};">
                                <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} onchange="window.toggleTaskFromList('${task.id}')">
                                <div style="flex:1;min-width:200px;">
                                    <div class="breadcrumb">
                                        ${milestone ? `<span>${escapeHtml(milestone.title)}</span>` : `<span>未關聯里程碑</span>`}
                                    </div>
                                    <div class="task-name" onclick="window.openTaskDrawer('${task.id}')" style="cursor:pointer;">${escapeHtml(task.title)}</div>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                html += `</div>`;

                el.innerHTML = html;
                bindMilestoneDrag();
            }

            function renderAddTaskPanelTrack(trackId) {
                const found = findTrackById(trackId);
                if (!found) return '';
                const { track } = found;
                const msOptions = (track.milestones || []).map(ms => `<option value="${ms.id}">${escapeHtml(ms.title)}</option>`).join('');
                return `
                    <div class="add-task-panel">
                        <div class="atp-title">新增任務到「${escapeHtml(track.name)}」</div>
                        <div class="atp-row">
                            <div class="atp-field" style="flex:2;"><label>任務名稱</label><input type="text" id="atpTTitle" placeholder="任務名稱..." autocomplete="off"></div>
                        </div>
                        <div class="atp-row">
                            <div class="atp-field"><label>關聯里程碑（可選）</label><select id="atpTMs"><option value="">不關聯</option>${msOptions}</select></div>
                            <div class="atp-field"><label>截止日（可選，任務在時間軸上是一個點）</label><input type="date" id="atpTDue"></div>
                        </div>
                        <div class="atp-row">
                            <div class="atp-field"><label>排程開始（可選）</label><input type="time" id="atpTSchStart"></div>
                            <div class="atp-field"><label>排程結束（可選）</label><input type="time" id="atpTSchEnd"></div>
                            <div class="atp-field"><label>預估時間（分鐘）</label><input type="number" id="atpTEstimate" value="0" min="0"></div>
                            <div class="atp-field"><label>優先級</label>
                                <select id="atpTPriority">
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                    <option value="low">低</option>
                                </select>
                            </div>
                        </div>
                        <div class="atp-actions">
                            <button class="primary" onclick="window.submitAddTaskPanelTrack()">新增</button>
                            <button onclick="window.toggleAddTaskPanelTrack('${trackId}')">取消</button>
                        </div>
                    </div>
                `;
            }

            function getTrackMinutesOnDay(track, dayKey) {
                let minutes = 0;
                (track.tasks || []).forEach(t => {
                    if (t.completed) return;
                    if (t.schedule && t.schedule.length > 0) {
                        t.schedule.forEach(sch => {
                            const start = new Date(sch.start);
                            const end = new Date(sch.end);
                            if (dateKey(start) === dayKey) {
                                minutes += (end - start) / 60000;
                            }
                        });
                        return;
                    }
                    if (t.dueDate && !t.startDate) {
                        if (dateKey(new Date(t.dueDate)) === dayKey) {
                            minutes += t.estimatedTime || 0;
                        }
                        return;
                    }
                    const start = parseDate(t.startDate) || parseDate(t.dueDate);
                    const end = parseDate(t.dueDate) || parseDate(t.startDate);
                    if (!start || !end) return;
                    if (dayKey < dateKey(start) || dayKey > dateKey(end)) return;
                    const totalDays = Math.round((end - start) / 86400000) + 1;
                    if (totalDays <= 0) return;
                    minutes += (t.estimatedTime || 0) / totalDays;
                });
                return minutes;
            }

            function renderTimeline() {
                const el = document.getElementById('timelineContent');

                if (tlView === 'week' || tlView === 'month') {
                    renderTimelineDayBased(el);
                    return;
                }
                renderTimelineBlockBased(el);
            }

            // ===== 日為單位的檢視（週、月）=====
            function renderTimelineDayBased(el) {
                let allDays = [];
                let rangeLabel = '';

                if (tlView === 'week') {
                    const start = startOfWeek(tlAnchor);
                    const totalDays = 7 * tlWeekCount;
                    for (let i = 0; i < totalDays; i++) allDays.push(addDays(start, i));
                    const end = allDays[allDays.length - 1];
                    rangeLabel = `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
                } else {
                    const start = new Date(tlAnchor.getFullYear(), tlAnchor.getMonth(), 1);
                    const end = new Date(tlAnchor.getFullYear(), tlAnchor.getMonth() + tlMonthCount, 0);
                    for (let d = new Date(start); d <= end; d = addDays(d, 1)) allDays.push(new Date(d));
                    rangeLabel = `${start.getFullYear()}年${start.getMonth() + 1}月 – ${end.getFullYear()}年${end.getMonth() + 1}月`;
                }
                document.getElementById('tlDateRange').textContent = rangeLabel;

                const todayKey = dateKey(new Date());
                const tracks = [];
                areas.forEach(area => {
                    if (tlAreaId !== 'all' && area.id !== tlAreaId) return;
                    area.tracks.forEach(track => tracks.push({ track, area }));
                });

                // 分組：週以「每週」為一組；月以「每月」為一組
                let groups = [];
                if (tlView === 'week') {
                    for (let w = 0; w < tlWeekCount; w++) {
                        const weekDays = allDays.slice(w * 7, (w + 1) * 7);
                        groups.push({ days: weekDays, label: null });
                    }
                } else {
                    let currentMonth = null;
                    let currentGroup = null;
                    allDays.forEach(d => {
                        const monthKey = d.getFullYear() + '-' + d.getMonth();
                        if (monthKey !== currentMonth) {
                            currentMonth = monthKey;
                            currentGroup = { days: [], label: `${d.getFullYear()}年${d.getMonth() + 1}月` };
                            groups.push(currentGroup);
                        }
                        currentGroup.days.push(d);
                    });
                }

                let html = `<div class="timeline-wrapper"><div class="timeline-scroll">`;
                if (tracks.length === 0) {
                    html += `<div class="empty-state" style="text-align:center;padding:2rem;color:var(--muted);font-style:italic;">沒有軌道可以顯示。</div>`;
                } else {
                    groups.forEach((group, groupIdx) => {
                        const days = group.days;
                        const groupStartKey = dateKey(days[0]);
                        const groupEndKey = dateKey(days[days.length - 1]);

                        if (group.label) {
                            html += `<div class="timeline-block-label">${group.label}</div>`;
                        }

                        // 把 days 按週分組，產生週次分組表頭
                        const weekGroups = [];
                        let currentWeek = null;
                        days.forEach(d => {
                            const monday = startOfWeek(d);
                            const mondayKey = dateKey(monday);
                            if (!currentWeek || currentWeek.key !== mondayKey) {
                                currentWeek = { key: mondayKey, monday: monday, days: [] };
                                weekGroups.push(currentWeek);
                            }
                            currentWeek.days.push(d);
                        });

                        html += `<div class="timeline-grid" style="margin-bottom:${groupIdx < groups.length - 1 ? '2rem' : '0'};">`;

                        // 上層：週次分組
                        html += `<div class="week-group-row" style="grid-template-columns: repeat(${days.length}, 1fr);">`;
                        weekGroups.forEach(g => {
                            const span = g.days.length;
                            const mondayKey = dateKey(g.monday);
                            const sunday = addDays(g.monday, 6);
                            const isCurrentWeek = todayKey >= mondayKey && todayKey <= dateKey(sunday);
                            const within = isWithinSemester(g.monday);
                            let label, cls;
                            if (bindSemester && within) {
                                const weekNum = getWeekNumber(g.monday);
                                label = `第 ${weekNum} 週`;
                                cls = '';
                            } else if (bindSemester && !within) {
                                label = `${g.monday.getMonth() + 1}/${g.monday.getDate()} – ${sunday.getMonth() + 1}/${sunday.getDate()}`;
                                cls = 'off-semester';
                            } else {
                                label = `${g.monday.getMonth() + 1}/${g.monday.getDate()} – ${sunday.getMonth() + 1}/${sunday.getDate()}`;
                                cls = '';
                            }
                            html += `<div class="week-group-cell ${isCurrentWeek ? 'today' : ''} ${cls}" style="grid-column: span ${span};">${label}</div>`;
                        });
                        html += `</div>`;

                        // 下層：每日
                        html += `<div class="day-header-row"><div></div><div class="timeline-header-days" style="grid-template-columns: repeat(${days.length}, 1fr);">`;
                        days.forEach(d => {
                            const isToday = dateKey(d) === todayKey;
                            const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                            html += `<div class="timeline-day-header ${isToday ? 'today' : ''}">`;
                            html += `<span class="day-name">${dayNames[d.getDay()]}</span>`;
                            html += `<span class="day-num">${d.getDate()}</span>`;
                            html += `</div>`;
                        });
                        html += `</div></div>`;

                        tracks.forEach(({ track, area }) => {
                            html += renderDayTrackRow(track, area, days, groupStartKey, groupEndKey, todayKey);
                        });
                        html += `</div>`;
                    });
                }

                html += renderUnscheduled();
                html += renderCapacity(allDays, tracks);
                html += `</div></div>`;
                el.innerHTML = html;
            }

            function renderDayTrackRow(track, area, days, groupStartKey, groupEndKey, todayKey) {
                const color = track.color || TRACK_COLORS[0];
                const msList = track.milestones || [];
                const tasks = track.tasks || [];

                let html = `<div class="timeline-track-row">`;
                html += `<div class="timeline-track-name"><span class="dot" style="background:${color};"></span>${escapeHtml(track.name)}${tlAreaId === 'all' ? `<span class="area-tag">${escapeHtml(area.name)}</span>` : ''}</div>`;
                html += `<div class="timeline-track-bars" style="grid-template-columns: repeat(${days.length}, 1fr);">`;
                html += `<div class="timeline-day-grid" style="grid-template-columns: repeat(${days.length}, 1fr); grid-column: 1 / -1;">`;
                days.forEach(d => html += `<div class="${dateKey(d) === todayKey ? 'today' : ''}"></div>`);
                html += `</div>`;
                const todayIndex = days.findIndex(d => dateKey(d) === todayKey);
                if (todayIndex >= 0) html += `<div class="timeline-today-line" style="left: ${((todayIndex + 0.5) / days.length) * 100}%;"></div>`;

                msList.forEach(ms => {
                    const msStart = parseDate(ms.startDate) || parseDate(ms.due);
                    const msEnd = parseDate(ms.due) || parseDate(ms.startDate);
                    if (!msStart || !msEnd) return;
                    const msStartKey = dateKey(msStart);
                    const msEndKey = dateKey(msEnd);
                    if (msEndKey < groupStartKey || msStartKey > groupEndKey) return;

                    const visibleStartKey = msStartKey < groupStartKey ? groupStartKey : msStartKey;
                    const visibleEndKey = msEndKey > groupEndKey ? groupEndKey : msEndKey;

                    let startIdx = days.findIndex(d => dateKey(d) === visibleStartKey);
                    let endIdx = days.findIndex(d => dateKey(d) === visibleEndKey);
                    if (startIdx === -1) startIdx = days.findIndex(d => dateKey(d) >= visibleStartKey);
                    if (endIdx === -1) endIdx = days.findIndex(d => dateKey(d) >= visibleEndKey);
                    if (startIdx === -1) startIdx = 0;
                    if (endIdx === -1) endIdx = days.length - 1;
                    if (endIdx < startIdx) return;

                    const span = endIdx - startIdx + 1;
                    const isContinuedLeft = msStartKey < groupStartKey;
                    const isContinuedRight = msEndKey > groupEndKey;
                    let extraClass = '';
                    if (isContinuedLeft) extraClass += ' continued-left';
                    if (isContinuedRight) extraClass += ' continued-right';
                    const achievedClass = ms.status === 'achieved' ? ' achieved' : '';
                    let typeTag = '';
                    if (ms.type === 'numeric') typeTag = '<span class="ms-type-tag">數值</span>';
                    else if (ms.type === 'progress') typeTag = '<span class="ms-type-tag">進度</span>';
                    else typeTag = '<span class="ms-type-tag">二元</span>';

                    html += `<div class="timeline-ms-bar${achievedClass}${extraClass}" style="grid-column: ${startIdx + 1} / span ${span};background:${color};" onclick="window.openMilestoneDrawer('${ms.id}')">${typeTag}${escapeHtml(ms.title)}</div>`;
                });

                if (tlShowTasks) {
                    tasks.forEach(task => {
                        const due = parseDate(task.dueDate);
                        if (!due) return;
                        const dueKey = dateKey(due);
                        if (dueKey < groupStartKey || dueKey > groupEndKey) return;
                        const idx = days.findIndex(d => dateKey(d) === dueKey);
                        if (idx === -1) return;
                        const leftPct = ((idx + 0.5) / days.length) * 100;
                        const completedClass = task.completed ? ' completed' : '';
                        html += `<div class="timeline-task-dot${completedClass}" style="left:${leftPct}%;background:${color};" title="${escapeHtml(task.title)}" onclick="event.stopPropagation();window.openTaskDrawer('${task.id}')"></div>`;
                    });
                }

                html += `</div></div>`;
                return html;
            }

            // ===== 區塊為單位的檢視（三個月、半年、一年）=====
            function renderTimelineBlockBased(el) {
                let cells = [];
                let rangeLabel = '';
                let cellsPerGroup;

                if (tlView === 'quarter') {
                    // 三個月：13 週 × 數量
                    const start = startOfWeek(tlAnchor);
                    const totalWeeks = 13 * tlQuarterCount;
                    for (let i = 0; i < totalWeeks; i++) {
                        const weekStart = addDays(start, i * 7);
                        const weekEnd = addDays(weekStart, 6);
                        cells.push({ start: weekStart, end: weekEnd });
                    }
                    rangeLabel = `${cells[0].start.getFullYear()}年${cells[0].start.getMonth() + 1}月 – ${cells[cells.length - 1].end.getFullYear()}年${cells[cells.length - 1].end.getMonth() + 1}月`;
                    cellsPerGroup = 13;
                } else if (tlView === 'halfyear') {
                    // 半年：半個月 × 數量
                    const start = getHalfStart(tlAnchor);
                    const totalHalves = 12 * tlHalfYearCount;
                    let cursor = new Date(start);
                    for (let i = 0; i < totalHalves; i++) {
                        const halfStart = new Date(cursor);
                        let halfEnd, label;
                        if (halfStart.getDate() === 1) {
                            halfEnd = new Date(halfStart.getFullYear(), halfStart.getMonth(), 15);
                            label = `${halfStart.getMonth() + 1}月上`;
                        } else {
                            halfEnd = new Date(halfStart.getFullYear(), halfStart.getMonth() + 1, 0);
                            label = `${halfStart.getMonth() + 1}月下`;
                        }
                        cells.push({ start: halfStart, end: halfEnd, label: label });
                        cursor = nextHalf(cursor);
                    }
                    rangeLabel = `${cells[0].start.getFullYear()}年${cells[0].start.getMonth() + 1}月 – ${cells[cells.length - 1].end.getFullYear()}年${cells[cells.length - 1].end.getMonth() + 1}月`;
                    cellsPerGroup = 12;
                } else {
                    // 一年：一個月 × 數量
                    const start = new Date(tlAnchor.getFullYear(), tlAnchor.getMonth(), 1);
                    const totalMonths = 12 * tlYearCount;
                    for (let i = 0; i < totalMonths; i++) {
                        const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1);
                        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
                        cells.push({ start: monthStart, end: monthEnd });
                    }
                    rangeLabel = `${cells[0].start.getFullYear()}年 – ${cells[cells.length - 1].end.getFullYear()}年`;
                    cellsPerGroup = 12;
                }

                document.getElementById('tlDateRange').textContent = rangeLabel;

                const todayKey = dateKey(new Date());
                const tracks = [];
                areas.forEach(area => {
                    if (tlAreaId !== 'all' && area.id !== tlAreaId) return;
                    area.tracks.forEach(track => tracks.push({ track, area }));
                });

                // 每 cellsPerGroup 格分成一組
                let groups = [];
                for (let g = 0; g < cells.length; g += cellsPerGroup) {
                    const groupCells = cells.slice(g, g + cellsPerGroup);
                    let label = '';
                    if (tlView === 'quarter') label = `第 ${g / cellsPerGroup + 1} 個三個月`;
                    else if (tlView === 'halfyear') label = `第 ${g / cellsPerGroup + 1} 個半年`;
                    else label = `${groupCells[0].start.getFullYear()}年`;
                    groups.push({ cells: groupCells, label });
                }

                let html = `<div class="timeline-wrapper"><div class="timeline-scroll">`;
                if (tracks.length === 0) {
                    html += `<div class="empty-state" style="text-align:center;padding:2rem;color:var(--muted);font-style:italic;">沒有軌道可以顯示。</div>`;
                } else {
                    groups.forEach((group, groupIdx) => {
                        const groupCells = group.cells;
                        const groupStartKey = dateKey(groupCells[0].start);
                        const groupEndKey = dateKey(groupCells[groupCells.length - 1].end);

                        html += `<div class="timeline-block-label">${group.label}</div>`;
                        html += `<div class="timeline-grid" style="margin-bottom:${groupIdx < groups.length - 1 ? '2rem' : '0'};">`;

                        // 半年和一年：兩層表頭（年份 + 標籤）
                        if (tlView === 'halfyear' || tlView === 'year') {
                            // 年份分組
                            const yearGroups = [];
                            let curYear = null;
                            groupCells.forEach((c, i) => {
                                const y = c.start.getFullYear();
                                if (!curYear || curYear.year !== y) {
                                    curYear = { year: y, span: 0, today: false };
                                    yearGroups.push(curYear);
                                }
                                curYear.span++;
                                if (todayKey >= dateKey(c.start) && todayKey <= dateKey(c.end)) curYear.today = true;
                            });
                            html += `<div class="year-group-row" style="grid-template-columns: repeat(${groupCells.length}, 1fr);">`;
                            yearGroups.forEach(yg => {
                                html += `<div class="year-group-cell ${yg.today ? 'today' : ''}" style="grid-column: span ${yg.span};">${yg.year}年</div>`;
                            });
                            html += `</div>`;

                            html += `<div class="day-header-row"><div></div><div class="timeline-header-days" style="grid-template-columns: repeat(${groupCells.length}, 1fr);">`;
                            groupCells.forEach(c => {
                                const isToday = todayKey >= dateKey(c.start) && todayKey <= dateKey(c.end);
                                const within = isWithinSemester(c.start);
                                html += `<div class="timeline-day-header ${isToday ? 'today' : ''} ${bindSemester && !within ? 'off-semester' : ''}">`;
                                if (tlView === 'halfyear') {
                                    if (bindSemester && within) {
                                        const weekNum = getWeekNumber(c.start);
                                        html += `<div class="week-sub">第 ${weekNum} 週</div>`;
                                    }
                                    html += `<div class="week-label">${c.label}</div>`;
                                } else {
                                    html += `<div class="week-label">${c.start.getMonth() + 1}月</div>`;
                                }
                                html += `</div>`;
                            });
                            html += `</div></div>`;
                        } else {
                            // 三個月：單層
                            html += `<div class="timeline-header-row"><div></div><div class="timeline-header-days" style="grid-template-columns: repeat(${groupCells.length}, 1fr);">`;
                            groupCells.forEach(c => {
                                const isToday = todayKey >= dateKey(c.start) && todayKey <= dateKey(c.end);
                                const within = isWithinSemester(c.start);
                                html += `<div class="timeline-day-header ${isToday ? 'today' : ''} ${bindSemester && !within ? 'off-semester' : ''}">`;
                                if (bindSemester && within) {
                                    const weekNum = getWeekNumber(c.start);
                                    html += `<div class="week-label">第 ${weekNum} 週</div>`;
                                    html += `<div class="week-range">${c.start.getMonth() + 1}/${c.start.getDate()} – ${c.end.getMonth() + 1}/${c.end.getDate()}</div>`;
                                } else {
                                    html += `<div class="week-label">${c.start.getMonth() + 1}/${c.start.getDate()} – ${c.end.getMonth() + 1}/${c.end.getDate()}</div>`;
                                }
                                html += `</div>`;
                            });
                            html += `</div></div>`;
                        }

                        tracks.forEach(({ track, area }) => {
                            html += renderBlockTrackRow(track, area, groupCells, groupStartKey, groupEndKey, todayKey);
                        });
                        html += `</div>`;
                    });
                }

                html += renderUnscheduled();
                html += `</div></div>`;
                el.innerHTML = html;
            }

            function renderBlockTrackRow(track, area, cells, groupStartKey, groupEndKey, todayKey) {
                const color = track.color || TRACK_COLORS[0];
                const msList = track.milestones || [];
                const tasks = track.tasks || [];

                let html = `<div class="timeline-track-row">`;
                html += `<div class="timeline-track-name"><span class="dot" style="background:${color};"></span>${escapeHtml(track.name)}${tlAreaId === 'all' ? `<span class="area-tag">${escapeHtml(area.name)}</span>` : ''}</div>`;
                html += `<div class="timeline-track-bars" style="grid-template-columns: repeat(${cells.length}, 1fr);">`;
                html += `<div class="timeline-day-grid" style="grid-template-columns: repeat(${cells.length}, 1fr); grid-column: 1 / -1;">`;
                cells.forEach(cell => {
                    const isToday = todayKey >= dateKey(cell.start) && todayKey <= dateKey(cell.end);
                    html += `<div class="${isToday ? 'today' : ''}"></div>`;
                });
                html += `</div>`;
                const todayIdx = cells.findIndex(cell => todayKey >= dateKey(cell.start) && todayKey <= dateKey(cell.end));
                if (todayIdx >= 0) html += `<div class="timeline-today-line" style="left: ${((todayIdx + 0.5) / cells.length) * 100}%;"></div>`;

                msList.forEach(ms => {
                    const msStart = parseDate(ms.startDate) || parseDate(ms.due);
                    const msEnd = parseDate(ms.due) || parseDate(ms.startDate);
                    if (!msStart || !msEnd) return;
                    const msStartKey = dateKey(msStart);
                    const msEndKey = dateKey(msEnd);
                    if (msEndKey < groupStartKey || msStartKey > groupEndKey) return;

                    let startIdx = -1;
                    let endIdx = -1;
                    for (let i = 0; i < cells.length; i++) {
                        const cellStartKey = dateKey(cells[i].start);
                        const cellEndKey = dateKey(cells[i].end);
                        if (startIdx === -1 && msStartKey <= cellEndKey && msEndKey >= cellStartKey) {
                            startIdx = i;
                        }
                        if (msEndKey >= cellStartKey && msStartKey <= cellEndKey) {
                            endIdx = i;
                        }
                    }
                    if (startIdx === -1 || endIdx === -1) return;
                    if (endIdx < startIdx) return;

                    const span = endIdx - startIdx + 1;
                    const isContinuedLeft = msStartKey < groupStartKey;
                    const isContinuedRight = msEndKey > groupEndKey;
                    let extraClass = '';
                    if (isContinuedLeft) extraClass += ' continued-left';
                    if (isContinuedRight) extraClass += ' continued-right';
                    const achievedClass = ms.status === 'achieved' ? ' achieved' : '';
                    let typeTag = '';
                    if (ms.type === 'numeric') typeTag = '<span class="ms-type-tag">數值</span>';
                    else if (ms.type === 'progress') typeTag = '<span class="ms-type-tag">進度</span>';
                    else typeTag = '<span class="ms-type-tag">二元</span>';

                    html += `<div class="timeline-ms-bar${achievedClass}${extraClass}" style="grid-column: ${startIdx + 1} / span ${span};background:${color};" onclick="window.openMilestoneDrawer('${ms.id}')">${typeTag}${escapeHtml(ms.title)}</div>`;
                });

                if (tlShowTasks) {
                    tasks.forEach(task => {
                        const due = parseDate(task.dueDate);
                        if (!due) return;
                        const dueKey = dateKey(due);
                        if (dueKey < groupStartKey || dueKey > groupEndKey) return;
                        const idx = cells.findIndex(cell => dueKey >= dateKey(cell.start) && dueKey <= dateKey(cell.end));
                        if (idx === -1) return;
                        const leftPct = ((idx + 0.5) / cells.length) * 100;
                        const completedClass = task.completed ? ' completed' : '';
                        html += `<div class="timeline-task-dot${completedClass}" style="left:${leftPct}%;background:${color};" title="${escapeHtml(task.title)}" onclick="event.stopPropagation();window.openTaskDrawer('${task.id}')"></div>`;
                    });
                }

                html += `</div></div>`;
                return html;
            }

            function renderUnscheduled() {
                const unscheduled = [];
                areas.forEach(area => {
                    if (tlAreaId !== 'all' && area.id !== tlAreaId) return;
                    (area.unassignedTasks || []).forEach(t => { if (!t.completed && !t.startDate && !t.dueDate && (!t.schedule || t.schedule.length === 0)) unscheduled.push({ task: t }); });
                    area.tracks.forEach(track => {
                        (track.tasks || []).forEach(t => { if (!t.completed && !t.startDate && !t.dueDate && (!t.schedule || t.schedule.length === 0)) unscheduled.push({ task: t }); });
                    });
                });
                let html = `<div class="unscheduled-area"><div class="unscheduled-title">Unscheduled</div>`;
                if (unscheduled.length === 0) html += `<div style="font-size:0.72rem;color:var(--muted);font-style:italic;">沒有未排程的任務。</div>`;
                else {
                    html += `<div class="unscheduled-list">`;
                    unscheduled.forEach(({ task }) => html += `<div class="unscheduled-item" onclick="window.openTaskDrawer('${task.id}')">○ ${escapeHtml(task.title)}</div>`);
                    html += `</div>`;
                }
                html += `</div>`;
                return html;
            }

            function renderCapacity(allDays, tracks) {
                let html = `<div class="capacity-section"><div class="capacity-title">Time Load</div><div class="capacity-note">任務時數分攤到它跨越的每一天（若無排程則用預估時間分攤）</div><div class="capacity-rows">`;
                allDays.forEach(d => {
                    const key = dateKey(d);
                    let totalMinutes = 0;
                    tracks.forEach(({ track }) => {
                        totalMinutes += getTrackMinutesOnDay(track, key);
                    });
                    const pct = Math.min(150, Math.round((totalMinutes / 480) * 100));
                    const over = pct > 100;
                    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                    const hoursText = (totalMinutes / 60).toFixed(1) + 'h';
                    html += `<div class="capacity-row"><span>${d.getMonth() + 1}/${d.getDate()} (${dayNames[d.getDay()]})</span><div class="capacity-bar-bg"><div class="capacity-bar-fill ${over ? 'over' : ''}" style="width: ${Math.min(100, pct)}%;"></div></div><span class="capacity-label ${over ? 'over' : ''}">${hoursText} · ${pct}%</span></div>`;
                });
                html += `</div></div>`;
                return html;
            }

            function renderCalendar() {
                const el = document.getElementById('calendarContent');
                const todayKey = dateKey(new Date());
                const tracks = [];
                areas.forEach(area => {
                    if (calAreaId !== 'all' && area.id !== calAreaId) return;
                    area.tracks.forEach(track => tracks.push({ track, area }));
                });

                let html = '';
                let unscheduled = [];
                areas.forEach(area => {
                    if (calAreaId !== 'all' && area.id !== calAreaId) return;
                    (area.unassignedTasks || []).forEach(t => { if (!t.completed && !t.startDate && !t.dueDate && (!t.schedule || t.schedule.length === 0)) unscheduled.push({ task: t }); });
                    area.tracks.forEach(track => {
                        (track.tasks || []).forEach(t => { if (!t.completed && !t.startDate && !t.dueDate && (!t.schedule || t.schedule.length === 0)) unscheduled.push({ task: t }); });
                    });
                });

                if (calView === 'day') {
                    const d = calAnchor;
                    document.getElementById('calDateRange').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
                    let blocks = [];
                    tracks.forEach(({ track }) => {
                        const color = track.color || TRACK_COLORS[0];
                        (track.tasks || []).forEach(task => {
                            (task.schedule || []).forEach(sch => {
                                const start = new Date(sch.start);
                                if (dateKey(start) === dateKey(d)) blocks.push({ task, start: new Date(sch.start), end: new Date(sch.end), color });
                            });
                        });
                    });
                    html += `<div class="calendar-wrapper"><div class="cal-day-grid">`;
                    for (let h = 0; h < 24; h++) {
                        html += `<div class="cal-hour-label">${String(h).padStart(2, '0')}:00</div>`;
                        html += `<div class="cal-hour-cell" data-hour="${h}">`;
                        blocks.forEach(b => {
                            if (b.start.getHours() === h) {
                                const topPct = (b.start.getMinutes() / 60) * 100;
                                const durationMin = (b.end - b.start) / 60000;
                                const heightPx = (durationMin / 60) * 48;
                                html += `<div class="cal-time-block ${b.task.completed ? 'completed' : ''}" style="top: ${topPct}%; height: ${heightPx}px;background:${b.color};" onclick="event.stopPropagation();window.openTaskDrawer('${b.task.id}')">${escapeHtml(b.task.title)}</div>`;
                            }
                        });
                        html += `</div>`;
                    }
                    const now = new Date();
                    if (dateKey(now) === dateKey(d)) {
                        const totalMin = now.getHours() * 60 + now.getMinutes();
                        html += `<div class="cal-now-line" style="top: ${(totalMin / 60) * 48}px;"></div>`;
                    }
                    html += `</div>`;
                    html += `<div class="unscheduled-area"><div class="unscheduled-title">Unscheduled</div>`;
                    if (unscheduled.length === 0) html += `<div style="font-size:0.72rem;color:var(--muted);font-style:italic;">沒有未排程的任務。</div>`;
                    else {
                        html += `<div class="unscheduled-list">`;
                        unscheduled.forEach(({ task }) => html += `<div class="unscheduled-item" onclick="window.openTaskDrawer('${task.id}')">○ ${escapeHtml(task.title)}</div>`);
                        html += `</div>`;
                    }
                    html += `</div></div>`;
                } else if (calView === 'week') {
                    const start = startOfWeek(calAnchor);
                    const days = [];
                    for (let i = 0; i < 7; i++) days.push(addDays(start, i));
                    document.getElementById('calDateRange').textContent = `${start.getMonth() + 1}/${start.getDate()} – ${days[6].getMonth() + 1}/${days[6].getDate()}`;
                    let allBlocks = [];
                    tracks.forEach(({ track }) => {
                        const color = track.color || TRACK_COLORS[0];
                        (track.tasks || []).forEach(task => {
                            (task.schedule || []).forEach(sch => allBlocks.push({ task, start: new Date(sch.start), end: new Date(sch.end), color }));
                        });
                    });
                    html += `<div class="calendar-wrapper"><div class="cal-week-grid">`;
                    html += `<div></div>`;
                    days.forEach(d => {
                        const isToday = dateKey(d) === todayKey;
                        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                        html += `<div class="cal-week-header ${isToday ? 'today' : ''}"><span class="day-name">${dayNames[d.getDay()]}</span><span class="day-num">${d.getDate()}</span></div>`;
                    });
                    for (let h = 8; h < 22; h++) {
                        html += `<div class="cal-hour-label">${String(h).padStart(2, '0')}:00</div>`;
                        days.forEach(d => {
                            html += `<div class="cal-week-cell">`;
                            allBlocks.forEach(b => {
                                if (dateKey(b.start) === dateKey(d) && b.start.getHours() === h) {
                                    const durationMin = (b.end - b.start) / 60000;
                                    const heightPx = Math.max(14, (durationMin / 60) * 40);
                                    html += `<div class="cal-week-block" style="height:${heightPx}px;background:${b.color};" onclick="event.stopPropagation();window.openTaskDrawer('${b.task.id}')">${escapeHtml(b.task.title)}</div>`;
                                }
                            });
                            html += `</div>`;
                        });
                    }
                    html += `</div>`;
                    html += `<div class="unscheduled-area"><div class="unscheduled-title">Unscheduled</div>`;
                    if (unscheduled.length === 0) html += `<div style="font-size:0.72rem;color:var(--muted);font-style:italic;">沒有未排程的任務。</div>`;
                    else {
                        html += `<div class="unscheduled-list">`;
                        unscheduled.forEach(({ task }) => html += `<div class="unscheduled-item" onclick="window.openTaskDrawer('${task.id}')">○ ${escapeHtml(task.title)}</div>`);
                        html += `</div>`;
                    }
                    html += `</div></div>`;
                } else {
                    const year = calAnchor.getFullYear();
                    const month = calAnchor.getMonth();
                    document.getElementById('calDateRange').textContent = `${year}年${month + 1}月`;
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startDay = firstDay.getDay();
                    let taskDates = {};
                    let msDates = {};
                    tracks.forEach(({ track }) => {
                        const color = track.color || TRACK_COLORS[0];
                        (track.tasks || []).forEach(t => {
                            const start = parseDate(t.startDate) || parseDate(t.dueDate);
                            const end = parseDate(t.dueDate) || parseDate(t.startDate);
                            if (!start || !end) return;
                            for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
                                const k = dateKey(d);
                                if (!taskDates[k]) taskDates[k] = [];
                                taskDates[k].push({ task: t, color });
                            }
                        });
                        (track.milestones || []).forEach(ms => {
                            if (!ms.due) return;
                            const k = dateKey(parseDate(ms.due));
                            if (!msDates[k]) msDates[k] = [];
                            msDates[k].push({ milestone: ms, color });
                        });
                    });
                    html += `<div class="calendar-wrapper"><div class="cal-month-grid">`;
                    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
                    dayNames.forEach(n => html += `<div class="cal-month-header">${n}</div>`);
                    for (let i = 0; i < startDay; i++) html += `<div></div>`;
                    for (let d = 1; d <= lastDay.getDate(); d++) {
                        const dt = new Date(year, month, d);
                        const k = dateKey(dt);
                        const isToday = k === todayKey;
                        const dayTasks = taskDates[k] || [];
                        const dayMs = msDates[k] || [];
                        html += `<div class="cal-month-day ${isToday ? 'today' : ''}"><div class="day-num">${d}</div>`;
                        dayMs.slice(0, 2).forEach(item => {
                            html += `<div class="cal-month-ms">◆ ${escapeHtml(item.milestone.title)}</div>`;
                        });
                        dayTasks.slice(0, 3).forEach(item => {
                            html += `<div class="cal-month-task" style="border-left:3px solid ${item.color};padding-left:3px;">${escapeHtml(item.task.title)}</div>`;
                        });
                        if (dayTasks.length > 3) {
                            html += `<div class="cal-month-task" style="color:var(--muted);">+ ${dayTasks.length - 3} 更多</div>`;
                        }
                        html += `</div>`;
                    }
                    html += `</div></div>`;
                }
                el.innerHTML = html;
            }

            function renderInsights() {
                const el = document.getElementById('insightsContent');
                let totalTasks = 0, completedTasks = 0, overdueTasks = 0;
                let totalMilestones = 0, achievedMilestones = 0;
                let totalEstimated = 0, totalActual = 0;
                let statusDist = { 'not-started': 0, 'in-progress': 0, 'paused': 0, 'blocked': 0, 'completed': 0, 'cancelled': 0 };

                areas.forEach(area => {
                    if (insightsAreaId !== 'all' && area.id !== insightsAreaId) return;
                    const allTasks = [];
                    (area.unassignedTasks || []).forEach(t => allTasks.push(t));
                    area.tracks.forEach(track => {
                        (track.tasks || []).forEach(t => allTasks.push(t));
                        (track.milestones || []).forEach(ms => {
                            totalMilestones++;
                            if (ms.status === 'achieved') achievedMilestones++;
                        });
                    });
                    const today = new Date(new Date().toDateString());
                    allTasks.forEach(t => {
                        totalTasks++;
                        if (t.completed) completedTasks++;
                        if (!t.completed && t.dueDate && new Date(t.dueDate) < today) overdueTasks++;
                        totalEstimated += t.estimatedTime || 0;
                        totalActual += t.actualTime || 0;
                        statusDist[t.status] = (statusDist[t.status] || 0) + 1;
                    });
                });

                const completionRate = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);
                const milestoneRate = totalMilestones === 0 ? 0 : Math.round((achievedMilestones / totalMilestones) * 100);

                let html = `
                    <div class="insight-grid">
                        <div class="insight-card"><div class="ic-value">${completionRate}%</div><div class="ic-label">Task Rate</div></div>
                        <div class="insight-card"><div class="ic-value">${completedTasks} / ${totalTasks}</div><div class="ic-label">Completed</div></div>
                        <div class="insight-card"><div class="ic-value">${overdueTasks}</div><div class="ic-label">Overdue</div></div>
                        <div class="insight-card"><div class="ic-value">${milestoneRate}%</div><div class="ic-label">Milestone Rate</div></div>
                        <div class="insight-card"><div class="ic-value">${achievedMilestones} / ${totalMilestones}</div><div class="ic-label">Achieved</div></div>
                        <div class="insight-card"><div class="ic-value">${Math.round(totalEstimated / 60)}h</div><div class="ic-label">Estimated</div></div>
                        <div class="insight-card"><div class="ic-value">${Math.round(totalActual / 60)}h</div><div class="ic-label">Actual</div></div>
                    </div>
                `;

                const statusLabels = { 'not-started': '未開始', 'in-progress': '進行中', 'paused': '暫停', 'blocked': '阻塞', 'completed': '已完成', 'cancelled': '取消' };
                html += `<div class="chart-container"><div class="chart-title">Task Status</div><div class="bar-chart">`;
                Object.keys(statusDist).forEach(key => {
                    const count = statusDist[key];
                    const pct = totalTasks === 0 ? 0 : (count / totalTasks) * 100;
                    html += `<div class="bar-chart-item"><div class="bar-chart-value">${count}</div><div class="bar-chart-bar" style="height: ${Math.max(2, pct)}%;"></div><div class="bar-chart-label">${statusLabels[key]}</div></div>`;
                });
                html += `</div></div>`;

                html += `<div class="chart-container"><div class="chart-title">Tasks by Area</div><div class="bar-chart">`;
                const filteredAreas = areas.filter(a => insightsAreaId === 'all' || a.id === insightsAreaId);
                const maxAreaTasks = Math.max(1, ...filteredAreas.map(a => {
                    let count = (a.unassignedTasks || []).length;
                    a.tracks.forEach(t => { count += (t.tasks || []).length; });
                    return count;
                }));
                filteredAreas.forEach(area => {
                    let count = (area.unassignedTasks || []).length;
                    area.tracks.forEach(t => { count += (t.tasks || []).length; });
                    const pct = (count / maxAreaTasks) * 100;
                    html += `<div class="bar-chart-item"><div class="bar-chart-value">${count}</div><div class="bar-chart-bar" style="height: ${Math.max(2, pct)}%;"></div><div class="bar-chart-label">${escapeHtml(area.name)}</div></div>`;
                });
                html += `</div></div>`;

                el.innerHTML = html;
            }

            window.openTaskDrawer = function(taskId) {
                const found = findTaskById(taskId);
                if (!found) return;
                const { task, track, area } = found;
                document.getElementById('drawerTitle').textContent = '任務詳情';

                const statusOptions = [
                    { value: 'not-started', label: '未開始' },
                    { value: 'in-progress', label: '進行中' },
                    { value: 'paused', label: '暫停' },
                    { value: 'blocked', label: '阻塞' },
                    { value: 'completed', label: '已完成' },
                    { value: 'cancelled', label: '取消' }
                ];
                const priorityOptions = [
                    { value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }
                ];

                let subtasksHtml = '';
                (task.subtasks || []).forEach(st => {
                    subtasksHtml += `
                        <div class="subtask-row ${st.completed ? 'completed' : ''}">
                            <input type="checkbox" class="task-checkbox" ${st.completed ? 'checked' : ''} onchange="window.toggleSubtaskInDrawer('${task.id}', '${st.id}')" style="width:14px;height:14px;">
                            <span class="st-title">${escapeHtml(st.title)}</span>
                            <button class="st-del" onclick="window.deleteSubtaskInDrawer('${task.id}', '${st.id}')">✕</button>
                        </div>
                    `;
                });

                let msOptions = '';
                if (track) {
                    (track.milestones || []).forEach(ms => {
                        const checked = (task.milestoneIds || []).includes(ms.id);
                        msOptions += `
                            <label class="milestone-checkbox-row">
                                <input type="checkbox" ${checked ? 'checked' : ''} onchange="window.toggleMilestoneForTask('${task.id}', '${ms.id}')">
                                <span>${escapeHtml(ms.title)}</span>
                            </label>
                        `;
                    });
                }

                const schStart = (task.schedule && task.schedule[0]) ? task.schedule[0].start : '';
                const schEnd = (task.schedule && task.schedule[0]) ? task.schedule[0].end : '';

                document.getElementById('drawerBody').innerHTML = `
                    <div class="autosave-note">修改會自動儲存</div>
                    <div class="drawer-field"><div class="drawer-label">Title</div><input class="drawer-input" id="dTaskTitle" value="${escapeHtml(task.title)}" onchange="window.autoSaveTaskField('${task.id}', 'title', this.value)"></div>
                    <div class="drawer-field"><div class="drawer-label">Description</div><textarea class="drawer-textarea" id="dTaskDesc" onchange="window.autoSaveTaskField('${task.id}', 'description', this.value)">${escapeHtml(task.description || '')}</textarea></div>
                    <div class="drawer-field"><div class="drawer-label">Status</div><select class="drawer-select" id="dTaskStatus" onchange="window.autoSaveTaskField('${task.id}', 'status', this.value)">${statusOptions.map(o => `<option value="${o.value}" ${task.status === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
                    <div class="drawer-field"><div class="drawer-label">Priority</div><select class="drawer-select" id="dTaskPriority" onchange="window.autoSaveTaskField('${task.id}', 'priority', this.value)">${priorityOptions.map(o => `<option value="${o.value}" ${task.priority === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
                    <div class="drawer-field"><div class="drawer-label">所屬</div><div style="font-size:0.8rem;color:#6d5437;">${escapeHtml(area.name)}${track ? ` · ${escapeHtml(track.name)}` : ' · 未分類'}</div></div>
                    <div class="drawer-field"><div class="drawer-label">開始日（清空即為未排程）</div><input class="drawer-input" type="date" id="dTaskStart" value="${task.startDate || ''}" onchange="window.autoSaveTaskField('${task.id}', 'startDate', this.value)"></div>
                    <div class="drawer-field"><div class="drawer-label">截止日（任務在時間軸上是一個點）</div><input class="drawer-input" type="date" id="dTaskDue" value="${task.dueDate || ''}" onchange="window.autoSaveTaskField('${task.id}', 'dueDate', this.value)"></div>
                    <div class="drawer-field"><div class="drawer-label">排程（可選，會顯示在日曆）</div>
                        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                            <input class="drawer-input" type="datetime-local" id="dTaskSchStart" style="flex:1;min-width:150px;" value="${schStart}" onchange="window.autoSaveTaskSchedule('${task.id}')">
                            <input class="drawer-input" type="datetime-local" id="dTaskSchEnd" style="flex:1;min-width:150px;" value="${schEnd}" onchange="window.autoSaveTaskSchedule('${task.id}')">
                        </div>
                    </div>
                    <div class="drawer-field"><div class="drawer-label">預估時間（分鐘）</div><input class="drawer-input" type="number" id="dTaskEstimate" value="${task.estimatedTime || 0}" onchange="window.autoSaveTaskField('${task.id}', 'estimatedTime', parseInt(this.value)||0)"></div>
                    <div class="drawer-field"><div class="drawer-label">實際時間（分鐘）</div><input class="drawer-input" type="number" id="dTaskActual" value="${task.actualTime || 0}" onchange="window.autoSaveTaskField('${task.id}', 'actualTime', parseInt(this.value)||0)"></div>
                    <div class="drawer-field"><div class="drawer-label">標籤（以逗號分隔）</div><input class="drawer-input" id="dTaskTags" value="${(task.tags || []).join(', ')}" onchange="window.autoSaveTaskField('${task.id}', 'tags', this.value.split(',').map(s=>s.trim()).filter(s=>s))"></div>
                    ${track ? `<div class="drawer-field"><div class="drawer-label">關聯里程碑</div><div>${msOptions || '<div style="font-size:0.72rem;color:var(--muted);font-style:italic;">這條軌道沒有里程碑</div>'}</div></div>` : ''}
                    <div class="drawer-field"><div class="drawer-label">子任務</div><div id="dSubtasks">${subtasksHtml || '<div style="font-size:0.72rem;color:var(--muted);font-style:italic;">沒有子任務</div>'}</div><button class="empty-add-btn" style="margin-top:0.5rem;" onclick="window.addSubtaskInDrawer('${task.id}')">＋ 新增子任務</button></div>
                    <div class="drawer-actions">
                        <button class="drawer-btn" onclick="window.duplicateTask('${task.id}')">複製</button>
                        <button class="drawer-btn" onclick="window.toggleTaskComplete('${task.id}')">${task.completed ? '標記未完成' : '標記完成'}</button>
                        <button class="drawer-btn danger" onclick="window.deleteTaskFromDrawer('${task.id}')">刪除</button>
                    </div>
                `;
                showDrawer();
            };

            window.autoSaveTaskField = function(taskId, field, value) {
                const found = findTaskById(taskId);
                if (!found) return;
                const { task } = found;
                if (field === 'title') task.title = value.trim() || task.title;
                else if (field === 'description') task.description = value;
                else if (field === 'status') { task.status = value; task.completed = value === 'completed'; }
                else if (field === 'priority') task.priority = value;
                else if (field === 'startDate') task.startDate = value;
                else if (field === 'dueDate') task.dueDate = value;
                else if (field === 'estimatedTime') task.estimatedTime = value;
                else if (field === 'actualTime') task.actualTime = value;
                else if (field === 'tags') task.tags = value;
                save(); renderAll();
            };

            window.autoSaveTaskSchedule = function(taskId) {
                const found = findTaskById(taskId);
                if (!found) return;
                const { task } = found;
                const schStart = document.getElementById('dTaskSchStart').value;
                const schEnd = document.getElementById('dTaskSchEnd').value;
                if (schStart && schEnd) task.schedule = [{ id: generateId(), start: schStart, end: schEnd }];
                else task.schedule = [];
                save(); renderAll();
            };

            window.openMilestoneDrawer = function(msId) {
                const found = findMilestoneById(msId);
                if (!found) return;
                const { milestone, track, area } = found;
                document.getElementById('drawerTitle').textContent = '里程碑詳情';

                const statusOptions = [
                    { value: 'upcoming', label: '即將到來' },
                    { value: 'in-progress', label: '進行中' },
                    { value: 'achieved', label: '已達成' },
                    { value: 'overdue', label: '逾期' },
                    { value: 'cancelled', label: '取消' }
                ];
                const typeOptions = [
                    { value: 'binary', label: '二元（達成 / 未達成）' },
                    { value: 'numeric', label: '數值（起始 → 當前 → 目標）' },
                    { value: 'progress', label: '進度（0-100%）' }
                ];

                let typeSpecificHtml = '';
                if (milestone.type === 'numeric') {
                    let autoProgress = 0;
                    if (milestone.start !== undefined && milestone.current !== undefined && milestone.target !== undefined) {
                        const total = Math.abs(milestone.start - milestone.target);
                        if (total > 0) {
                            const done = Math.abs(milestone.start - milestone.current);
                            autoProgress = Math.max(0, Math.min(100, Math.round((done / total) * 100)));
                        }
                    }
                    const displayProgress = (milestone.manualProgress !== undefined && milestone.manualProgress !== null) ? milestone.manualProgress : autoProgress;

                    typeSpecificHtml = `
                        <div class="drawer-field">
                            <div class="drawer-label">起始值 → 當前值 → 目標值</div>
                            <div style="display:flex;gap:0.4rem;align-items:center;">
                                <input class="drawer-input" type="number" id="dMsStart" value="${milestone.start ?? ''}" placeholder="起始" style="flex:1;" onchange="window.autoSaveMsNumeric('${msId}')">
                                <span style="color:var(--muted);">→</span>
                                <input class="drawer-input" type="number" id="dMsCurrent" value="${milestone.current ?? ''}" placeholder="當前" style="flex:1;" onchange="window.autoSaveMsNumeric('${msId}')">
                                <span style="color:var(--muted);">→</span>
                                <input class="drawer-input" type="number" id="dMsTarget" value="${milestone.target ?? ''}" placeholder="目標" style="flex:1;" onchange="window.autoSaveMsNumeric('${msId}')">
                            </div>
                            <div class="calc-note">自動進度：${autoProgress}%（公式：|起始 - 當前| / |起始 - 目標|）</div>
                        </div>
                        <div class="drawer-field">
                            <div class="drawer-label">手動微調進度（留空則用自動計算）</div>
                            <input type="range" min="0" max="100" value="${displayProgress}" class="progress-slider" id="dMsProgress" oninput="document.getElementById('dMsProgressVal').textContent=this.value+'%';window.autoSaveMsProgress('${msId}', this.value)">
                            <div class="progress-value" id="dMsProgressVal">${displayProgress}%</div>
                            <button class="empty-add-btn" style="margin-top:0.5rem;font-size:0.6rem;" onclick="window.clearMsManualProgress('${msId}')">清除手動微調（回歸自動計算）</button>
                        </div>
                    `;
                } else if (milestone.type === 'progress') {
                    typeSpecificHtml = `
                        <div class="drawer-field">
                            <div class="drawer-label">進度</div>
                            <input type="range" min="0" max="100" value="${milestone.progress || 0}" class="progress-slider" id="dMsProgress" oninput="document.getElementById('dMsProgressVal').textContent=this.value+'%';window.autoSaveMsProgress('${msId}', this.value)">
                            <div class="progress-value" id="dMsProgressVal">${milestone.progress || 0}%</div>
                        </div>
                    `;
                } else {
                    typeSpecificHtml = `
                        <div class="drawer-field">
                            <div class="drawer-label">達成狀態</div>
                            <div style="font-size:0.8rem;color:#6d5437;">${milestone.status === 'achieved' ? '已達成' : '未達成'}</div>
                        </div>
                    `;
                }

                document.getElementById('drawerBody').innerHTML = `
                    <div class="autosave-note">修改會自動儲存</div>
                    <div class="drawer-field"><div class="drawer-label">Name</div><input class="drawer-input" id="dMsTitle" value="${escapeHtml(milestone.title)}" onchange="window.autoSaveMsField('${msId}', 'title', this.value)"></div>
                    <div class="drawer-field"><div class="drawer-label">Type</div><select class="drawer-select" id="dMsType" onchange="window.autoSaveMsType('${msId}', this.value)">${typeOptions.map(o => `<option value="${o.value}" ${milestone.type === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
                    ${typeSpecificHtml}
                    <div class="drawer-field"><div class="drawer-label">Status</div><select class="drawer-select" id="dMsStatus" onchange="window.autoSaveMsField('${msId}', 'status', this.value)">${statusOptions.map(o => `<option value="${o.value}" ${milestone.status === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}</select></div>
                    <div class="drawer-field"><div class="drawer-label">所屬</div><div style="font-size:0.8rem;color:#6d5437;">${escapeHtml(area.name)} · ${escapeHtml(track.name)}</div></div>
                    <div class="drawer-field"><div class="drawer-label">開始日（時間軸橫條起點）</div><input class="drawer-input" type="date" id="dMsStartDate" value="${milestone.startDate || ''}" onchange="window.autoSaveMsField('${msId}', 'startDate', this.value)"></div>
                    <div class="drawer-field"><div class="drawer-label">結束日（時間軸橫條終點）</div><input class="drawer-input" type="date" id="dMsDue" value="${milestone.due || ''}" onchange="window.autoSaveMsField('${msId}', 'due', this.value)"></div>
                    <div class="drawer-actions">
                        <button class="drawer-btn" onclick="window.toggleMilestoneAchieved('${msId}')">${milestone.status === 'achieved' ? '標記未達成' : '標記達成'}</button>
                        <button class="drawer-btn danger" onclick="window.deleteMilestoneFromDrawer('${msId}')">刪除</button>
                    </div>
                `;
                showDrawer();
            };

            window.autoSaveMsField = function(msId, field, value) {
                const found = findMilestoneById(msId);
                if (!found) return;
                const ms = found.milestone;
                if (field === 'title') ms.title = value.trim() || ms.title;
                else if (field === 'status') ms.status = value;
                else if (field === 'due') ms.due = value;
                else if (field === 'startDate') ms.startDate = value;
                save(); renderAll();
            };

            window.autoSaveMsType = function(msId, type) {
                const found = findMilestoneById(msId);
                if (!found) return;
                found.milestone.type = type;
                save(); renderAll(); window.openMilestoneDrawer(msId);
            };

            window.autoSaveMsNumeric = function(msId) {
                const found = findMilestoneById(msId);
                if (!found) return;
                const ms = found.milestone;
                const startVal = document.getElementById('dMsStart').value;
                const curVal = document.getElementById('dMsCurrent').value;
                const tgtVal = document.getElementById('dMsTarget').value;
                ms.start = startVal === '' ? undefined : parseFloat(startVal);
                ms.current = curVal === '' ? undefined : parseFloat(curVal);
                ms.target = tgtVal === '' ? undefined : parseFloat(tgtVal);
                if (ms.start !== undefined && ms.current !== undefined && ms.target !== undefined) {
                    const total = Math.abs(ms.start - ms.target);
                    if (total > 0) {
                        const done = Math.abs(ms.start - ms.current);
                        const auto = Math.round((done / total) * 100);
                        if (auto >= 100) ms.status = 'achieved';
                        else if (auto > 0) ms.status = 'in-progress';
                    }
                }
                save(); renderAll(); window.openMilestoneDrawer(msId);
            };

            window.autoSaveMsProgress = function(msId, value) {
                const found = findMilestoneById(msId);
                if (!found) return;
                const ms = found.milestone;
                ms.manualProgress = parseInt(value) || 0;
                ms.progress = ms.manualProgress;
                if (ms.manualProgress === 100) ms.status = 'achieved';
                else if (ms.status === 'achieved') ms.status = 'in-progress';
                save(); renderAll();
            };

            window.clearMsManualProgress = function(msId) {
                const found = findMilestoneById(msId);
                if (!found) return;
                found.milestone.manualProgress = null;
                save(); renderAll(); window.openMilestoneDrawer(msId);
            };

            function showDrawer() {
                document.getElementById('drawerOverlay').classList.add('show');
                document.getElementById('drawer').classList.add('show');
            }
            function hideDrawer() {
                document.getElementById('drawerOverlay').classList.remove('show');
                document.getElementById('drawer').classList.remove('show');
            }
            document.getElementById('drawerClose').addEventListener('click', hideDrawer);
            document.getElementById('drawerOverlay').addEventListener('click', hideDrawer);

            window.duplicateTask = function(taskId) {
                const found = findTaskById(taskId);
                if (!found) return;
                const { task, track, area } = found;
                const newTask = JSON.parse(JSON.stringify(task));
                newTask.id = generateId();
                newTask.completed = false;
                newTask.status = 'not-started';
                (newTask.subtasks || []).forEach(st => { st.id = generateId(); st.completed = false; });
                (newTask.schedule || []).forEach(s => s.id = generateId());
                if (track) {
                    if (!track.tasks) track.tasks = [];
                    track.tasks.push(newTask);
                } else {
                    if (!area.unassignedTasks) area.unassignedTasks = [];
                    area.unassignedTasks.push(newTask);
                }
                save(); renderAll(); hideDrawer();
            };

            window.toggleTaskComplete = function(taskId) {
                const found = findTaskById(taskId);
                if (!found) return;
                found.task.completed = !found.task.completed;
                found.task.status = found.task.completed ? 'completed' : 'not-started';
                save(); renderAll(); window.openTaskDrawer(taskId);
            };

            window.deleteTaskFromDrawer = function(taskId) {
                if (!confirm('刪除這個任務？')) return;
                for (const area of areas) {
                    for (const track of area.tracks) {
                        track.tasks = (track.tasks || []).filter(t => t.id !== taskId);
                    }
                    area.unassignedTasks = (area.unassignedTasks || []).filter(t => t.id !== taskId);
                }
                save(); renderAll(); hideDrawer();
            };

            window.toggleSubtaskInDrawer = function(taskId, stId) {
                const found = findTaskById(taskId);
                if (!found) return;
                const st = (found.task.subtasks || []).find(s => s.id === stId);
                if (!st) return;
                st.completed = !st.completed;
                save(); renderAll(); window.openTaskDrawer(taskId);
            };

            window.deleteSubtaskInDrawer = function(taskId, stId) {
                const found = findTaskById(taskId);
                if (!found) return;
                found.task.subtasks = (found.task.subtasks || []).filter(s => s.id !== stId);
                save(); renderAll(); window.openTaskDrawer(taskId);
            };

            window.addSubtaskInDrawer = function(taskId) {
                const found = findTaskById(taskId);
                if (!found) return;
                const container = document.getElementById('dSubtasks');
                if (container.querySelector('.inline-add-row')) {
                    container.querySelector('.inline-add-row input').focus();
                    return;
                }
                const row = document.createElement('div');
                row.className = 'inline-add-row';
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = '子任務名稱...';
                const btn = document.createElement('button');
                btn.textContent = '新增';
                const cancelBtn = document.createElement('button');
                cancelBtn.textContent = '取消';
                cancelBtn.className = 'row-cancel';
                row.appendChild(input);
                row.appendChild(btn);
                row.appendChild(cancelBtn);
                container.appendChild(row);
                input.focus();
                let finished = false;
                function finish(saveIt) {
                    if (finished) return;
                    finished = true;
                    const val = input.value.trim();
                    if (saveIt && val) {
                        if (!found.task.subtasks) found.task.subtasks = [];
                        found.task.subtasks.push({ id: generateId(), title: val, completed: false });
                        save(); renderAll(); window.openTaskDrawer(taskId);
                    } else {
                        if (row.parentNode) row.parentNode.removeChild(row);
                    }
                }
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
                    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
                });
                btn.addEventListener('click', function() { finish(true); });
                cancelBtn.addEventListener('click', function() { finish(false); });
            };

            window.toggleMilestoneForTask = function(taskId, msId) {
                const found = findTaskById(taskId);
                if (!found) return;
                const { task } = found;
                if (!task.milestoneIds) task.milestoneIds = [];
                const idx = task.milestoneIds.indexOf(msId);
                if (idx >= 0) task.milestoneIds.splice(idx, 1);
                else task.milestoneIds.push(msId);
                save(); renderAll(); window.openTaskDrawer(taskId);
            };

            window.toggleMilestoneAchieved = function(msId) {
                const found = findMilestoneById(msId);
                if (!found) return;
                found.milestone.status = found.milestone.status === 'achieved' ? 'in-progress' : 'achieved';
                save(); renderAll(); window.openMilestoneDrawer(msId);
            };

            window.deleteMilestoneFromDrawer = function(msId) {
                if (!confirm('刪除這個里程碑？底下任務的關聯也會清除。')) return;
                for (const area of areas) {
                    for (const track of area.tracks) {
                        (track.tasks || []).forEach(t => {
                            if (t.milestoneIds) {
                                t.milestoneIds = t.milestoneIds.filter(id => id !== msId);
                            }
                        });
                        track.milestones = (track.milestones || []).filter(m => m.id !== msId);
                    }
                }
                save(); renderAll(); hideDrawer();
            };

            window.toggleTaskFromList = function(taskId) {
                const found = findTaskById(taskId);
                if (!found) return;
                found.task.completed = !found.task.completed;
                found.task.status = found.task.completed ? 'completed' : 'not-started';
                save(); renderAll();
            };

            window.openTrackDetail = function(trackId) {
                currentTrackId = trackId;
                switchPage('trackdetail');
            };

            window.switchPage = function(page) {
                currentPage = page;
                addTaskPanelOpen = false;
                document.querySelectorAll('.nav-item[data-page]').forEach(n => {
                    n.classList.toggle('active', n.dataset.page === page);
                });
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                const target = document.getElementById('page-' + page);
                if (target) target.classList.add('active');
                renderAll();
            };

            window.startEditTrackName = function(trackId) {
                const found = findTrackById(trackId);
                if (!found) return;
                const el = document.getElementById('tdTrackName');
                if (!el) return;
                startInlineEdit(el, found.track.name, function(newName) {
                    found.track.name = newName; save(); renderAll();
                });
            };

            window.startEditAreaName = function(areaId) {
                const area = areas.find(a => a.id === areaId);
                if (!area) return;
                const el = document.querySelector(`.area-item[data-area-id="${areaId}"] .area-name`);
                if (!el) return;
                startInlineEdit(el, area.name, function(newName) {
                    area.name = newName; save(); renderAll();
                });
            };

            window.setTrackColor = function(trackId, color) {
                const found = findTrackById(trackId);
                if (!found) return;
                found.track.color = color;
                save(); renderAll();
            };

            window.sortMilestonesByDue = function(trackId) {
                const found = findTrackById(trackId);
                if (!found) return;
                found.track.milestones.sort((a, b) => {
                    if (!a.due && !b.due) return 0;
                    if (!a.due) return 1;
                    if (!b.due) return -1;
                    return new Date(a.due) - new Date(b.due);
                });
                save(); renderAll();
            };

            window.showAddMilestoneInline = function(trackId) {
                const found = findTrackById(trackId);
                if (!found) return;
                const container = document.getElementById('trackDetailContent');
                if (container.querySelector('.add-ms-panel')) {
                    container.querySelector('.add-ms-panel input').focus();
                    return;
                }
                const panel = document.createElement('div');
                panel.className = 'add-task-panel add-ms-panel';
                panel.innerHTML = `
                    <div class="atp-title">新增里程碑</div>
                    <div class="atp-row">
                        <div class="atp-field" style="flex:2;"><label>名稱</label><input type="text" id="amsTitle" placeholder="里程碑名稱..." autocomplete="off"></div>
                        <div class="atp-field"><label>類型</label>
                            <select id="amsType">
                                <option value="binary">二元（達成 / 未達成）</option>
                                <option value="numeric">數值（起始 → 當前 → 目標）</option>
                                <option value="progress">進度（0-100%）</option>
                            </select>
                        </div>
                    </div>
                    <div class="atp-row">
                        <div class="atp-field"><label>開始日（時間軸橫條起點）</label><input type="date" id="amsStartDate"></div>
                        <div class="atp-field"><label>結束日（時間軸橫條終點）</label><input type="date" id="amsDue"></div>
                    </div>
                    <div class="atp-actions">
                        <button class="primary" onclick="window.submitAddMilestone('${trackId}')">新增</button>
                        <button onclick="window.cancelAddMilestone()">取消</button>
                    </div>
                `;
                container.insertBefore(panel, container.firstChild);
                document.getElementById('amsTitle').focus();
            };

            window.submitAddMilestone = function(trackId) {
                const found = findTrackById(trackId);
                if (!found) return;
                const title = document.getElementById('amsTitle').value.trim();
                const type = document.getElementById('amsType').value;
                const startDate = document.getElementById('amsStartDate').value;
                const due = document.getElementById('amsDue').value;
                if (!title) return;
                found.track.milestones.push({
                    id: generateId(), title: title, type: type,
                    status: 'upcoming', progress: 0, due: due, startDate: startDate,
                    start: undefined, current: undefined, target: undefined,
                    manualProgress: null
                });
                save(); renderAll();
            };

            window.cancelAddMilestone = function() {
                const panel = document.querySelector('.add-ms-panel');
                if (panel) panel.remove();
            };

            window.toggleAddTaskPanelTrack = function(trackId) {
                const key = 'track:' + trackId;
                addTaskPanelOpen = addTaskPanelOpen === key ? false : key;
                renderAll();
            };

            window.submitAddTaskPanelTrack = function() {
                if (!currentTrackId) return;
                const found = findTrackById(currentTrackId);
                if (!found) return;
                const { track } = found;
                const title = document.getElementById('atpTTitle').value.trim();
                if (!title) return;
                const msId = document.getElementById('atpTMs').value;
                const dueDate = document.getElementById('atpTDue').value;
                const schStart = document.getElementById('atpTSchStart').value;
                const schEnd = document.getElementById('atpTSchEnd').value;
                const estimate = parseInt(document.getElementById('atpTEstimate').value) || 0;
                const priority = document.getElementById('atpTPriority').value;

                const newTask = {
                    id: generateId(), title: title, description: '', completed: false,
                    status: 'not-started', priority: priority, tags: [],
                    startDate: '', dueDate: dueDate, estimatedTime: estimate, actualTime: 0,
                    schedule: [], milestoneIds: msId ? [msId] : [], subtasks: []
                };

                if (schStart && schEnd) {
                    const dateStr = dueDate || dateKey(new Date());
                    newTask.schedule.push({ id: generateId(), start: dateStr + 'T' + schStart, end: dateStr + 'T' + schEnd });
                }

                if (!track.tasks) track.tasks = [];
                track.tasks.push(newTask);

                addTaskPanelOpen = false;
                save(); renderAll();
            };

            window.deleteTrackConfirm = function(trackId) {
                if (!confirm('刪除這條軌道？所有里程碑和任務都會消失。')) return;
                for (const area of areas) {
                    area.tracks = area.tracks.filter(t => t.id !== trackId);
                }
                save();
                currentTrackId = null;
                switchPage('projects');
            };

            window.switchArea = function(areaId) {
                activeAreaId = areaId;
                addTaskPanelOpen = false;
                save(); renderAll();
            };

            function addArea(name) {
                if (!name.trim()) return;
                const newArea = { id: generateId(), name: name.trim(), tracks: [], unassignedTasks: [] };
                areas.push(newArea);
                activeAreaId = newArea.id;
                save(); renderAll();
            }

            window.showAreaAddInline = function() {
                const container = document.getElementById('areasSublist');
                if (container.querySelector('.area-add-inline-input')) {
                    container.querySelector('.area-add-inline-input input').focus();
                    return;
                }
                const wrapper = document.createElement('div');
                wrapper.className = 'area-add-inline-input';
                wrapper.style.cssText = 'margin-top:0.3rem;';
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = '領域名稱...';
                input.style.cssText = 'width:100%;padding:0.4rem 0.6rem;border:1px solid var(--gold);border-radius:4px;background:rgba(255,249,237,0.9);font-family:inherit;font-size:0.65rem;color:var(--ink);outline:none;box-shadow:0 0 0 2px rgba(185,130,46,0.15);';
                wrapper.appendChild(input);
                container.appendChild(wrapper);
                input.focus();
                let finished = false;
                function finish(saveIt) {
                    if (finished) return;
                    finished = true;
                    const val = input.value.trim();
                    if (saveIt && val) addArea(val);
                    else if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                }
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') { e.preventDefault(); finish(true); }
                    else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
                });
                input.addEventListener('blur', function() { finish(true); });
            };

            window.addTrackInline = function() {
                if (activeAreaId === null) { alert('請先選擇一個特定領域。'); return; }
                const area = areas.find(a => a.id === activeAreaId);
                if (!area) return;
                const container = document.getElementById('overviewContent');
                if (container.querySelector('.add-track-panel')) {
                    container.querySelector('.add-track-panel input').focus();
                    return;
                }
                const panel = document.createElement('div');
                panel.className = 'add-task-panel add-track-panel';
                panel.innerHTML = `
                    <div class="atp-title">新增軌道到「${escapeHtml(area.name)}」</div>
                    <div class="atp-row">
                        <div class="atp-field" style="flex:2;"><label>軌道名稱</label><input type="text" id="atkName" placeholder="軌道名稱..." autocomplete="off"></div>
                        <div class="atp-field"><label>顏色</label>
                            <select id="atkColor">${TRACK_COLORS.map((c, i) => `<option value="${c}" ${i===0?'selected':''}>顏色 ${i+1}</option>`).join('')}</select>
                        </div>
                    </div>
                    <div class="atp-actions">
                        <button class="primary" onclick="window.submitAddTrack('${area.id}')">新增</button>
                        <button onclick="window.cancelAddTrack()">取消</button>
                    </div>
                `;
                container.insertBefore(panel, container.firstChild);
                document.getElementById('atkName').focus();
            };

            window.submitAddTrack = function(areaId) {
                const area = areas.find(a => a.id === areaId);
                if (!area) return;
                const name = document.getElementById('atkName').value.trim();
                const color = document.getElementById('atkColor').value;
                if (!name) return;
                area.tracks.push({ id: generateId(), name: name, color: color, milestones: [], tasks: [] });
                save(); renderAll();
            };

            window.cancelAddTrack = function() {
                const panel = document.querySelector('.add-track-panel');
                if (panel) panel.remove();
            };

            function bindMilestoneDrag() {
                const nodes = document.querySelectorAll('.roadmap-node[draggable="true"]');
                let draggedId = null;
                let draggedTrackId = null;
                nodes.forEach(node => {
                    node.addEventListener('dragstart', function(e) {
                        draggedId = this.dataset.msId;
                        draggedTrackId = this.dataset.trackId;
                        this.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', draggedId);
                        e.stopPropagation();
                    });
                    node.addEventListener('dragend', function(e) {
                        this.classList.remove('dragging');
                        document.querySelectorAll('.roadmap-node').forEach(n => n.classList.remove('drag-over'));
                        e.stopPropagation();
                    });
                    node.addEventListener('dragover', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.dataset.msId !== draggedId && this.dataset.trackId === draggedTrackId) this.classList.add('drag-over');
                    });
                    node.addEventListener('dragleave', function(e) { this.classList.remove('drag-over'); });
                    node.addEventListener('drop', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.classList.remove('drag-over');
                        const targetId = this.dataset.msId;
                        if (!draggedId || draggedId === targetId || this.dataset.trackId !== draggedTrackId) return;
                        const found = findTrackById(draggedTrackId);
                        if (!found) return;
                        const { track } = found;
                        const fromIdx = track.milestones.findIndex(m => m.id === draggedId);
                        const toIdx = track.milestones.findIndex(m => m.id === targetId);
                        if (fromIdx === -1 || toIdx === -1) return;
                        const [moved] = track.milestones.splice(fromIdx, 1);
                        track.milestones.splice(toIdx, 0, moved);
                        save(); renderAll();
                    });
                });
            }

            function bindAreaDrag() {
                const items = document.querySelectorAll('.area-item[draggable="true"]');
                let draggedId = null;
                items.forEach(item => {
                    item.addEventListener('dragstart', function(e) {
                        draggedId = this.dataset.areaId;
                        this.classList.add('dragging');
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', draggedId);
                    });
                    item.addEventListener('dragend', function() {
                        this.classList.remove('dragging');
                        document.querySelectorAll('.area-item').forEach(t => t.classList.remove('drag-over'));
                    });
                    item.addEventListener('dragover', function(e) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (this.dataset.areaId !== draggedId) this.classList.add('drag-over');
                    });
                    item.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
                    item.addEventListener('drop', function(e) {
                        e.preventDefault();
                        this.classList.remove('drag-over');
                        const targetId = this.dataset.areaId;
                        if (!draggedId || draggedId === targetId) return;
                        const fromIndex = areas.findIndex(a => a.id === draggedId);
                        const toIndex = areas.findIndex(a => a.id === targetId);
                        if (fromIndex === -1 || toIndex === -1) return;
                        const [moved] = areas.splice(fromIndex, 1);
                        areas.splice(toIndex, 0, moved);
                        save(); renderAll();
                    });
                });
            }

            document.querySelectorAll('.nav-item[data-page]').forEach(item => {
                item.addEventListener('click', function() { switchPage(this.dataset.page); });
            });

            document.querySelectorAll('.filter-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    filterContext.status = this.dataset.filter;
                    renderAll();
                });
            });

            document.getElementById('mytasksAreaFilter').addEventListener('change', function() { filterContext.areaId = this.value; renderAll(); });
            document.getElementById('projectsAreaFilter').addEventListener('change', function() { filterContext.areaId = this.value; renderAll(); });
            document.getElementById('insightsAreaFilter').addEventListener('change', function() { insightsAreaId = this.value; renderAll(); });

            document.querySelectorAll('[data-tl-view]').forEach(tab => {
                tab.addEventListener('click', function() {
                    document.querySelectorAll('[data-tl-view]').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    tlView = this.dataset.tlView;
                    updateTlCountSelect();
                    renderTimeline();
                });
            });

            document.getElementById('tlShowTasks').addEventListener('click', function() {
                tlShowTasks = !tlShowTasks;
                this.classList.toggle('active', tlShowTasks);
                renderTimeline();
            });

            document.getElementById('tlCountSelect').addEventListener('change', function() {
                const val = parseInt(this.value) || 1;
                if (tlView === 'week') tlWeekCount = val;
                else if (tlView === 'month') tlMonthCount = val;
                else if (tlView === 'quarter') tlQuarterCount = val;
                else if (tlView === 'halfyear') tlHalfYearCount = val;
                else if (tlView === 'year') tlYearCount = val;
                renderTimeline();
            });

            // 翻頁單位：全部挪一格
            document.getElementById('tlPrev').addEventListener('click', function() {
                if (tlView === 'week') tlAnchor = addDays(tlAnchor, -7);
                else if (tlView === 'month') tlAnchor = new Date(tlAnchor.getFullYear(), tlAnchor.getMonth() - 1, 1);
                else if (tlView === 'quarter') tlAnchor = addDays(tlAnchor, -7);
                else if (tlView === 'halfyear') tlAnchor = prevHalf(tlAnchor);
                else if (tlView === 'year') tlAnchor = addMonths(tlAnchor, -1);
                renderTimeline();
            });
            document.getElementById('tlNext').addEventListener('click', function() {
                if (tlView === 'week') tlAnchor = addDays(tlAnchor, 7);
                else if (tlView === 'month') tlAnchor = new Date(tlAnchor.getFullYear(), tlAnchor.getMonth() + 1, 1);
                else if (tlView === 'quarter') tlAnchor = addDays(tlAnchor, 7);
                else if (tlView === 'halfyear') tlAnchor = nextHalf(tlAnchor);
                else if (tlView === 'year') tlAnchor = addMonths(tlAnchor, 1);
                renderTimeline();
            });
            document.getElementById('tlToday').addEventListener('click', function() { tlAnchor = new Date(); renderTimeline(); });
            document.getElementById('timelineAreaFilter').addEventListener('change', function() { tlAreaId = this.value; renderTimeline(); });

            // 學期設定事件
            document.getElementById('bindSemester').addEventListener('change', function() {
                bindSemester = this.checked;
                updateSemesterSettingsVisibility();
                save();
                renderTimeline();
            });
            document.getElementById('semesterStart').addEventListener('change', function() {
                const d = parseDate(this.value);
                if (d) { semesterStartInput = d; save(); renderTimeline(); }
            });
            document.getElementById('semesterEndMode').addEventListener('change', function() {
                semesterEndMode = this.value;
                updateSemesterSettingsVisibility();
                save();
                renderTimeline();
            });
            document.getElementById('semesterEndDate').addEventListener('change', function() {
                const d = parseDate(this.value);
                if (d) { semesterEndInputDate = d; save(); renderTimeline(); }
            });
            document.getElementById('semesterEndWeek').addEventListener('change', function() {
                const v = parseInt(this.value, 10);
                if (!isNaN(v) && v >= 1) { semesterEndInputWeek = v; save(); renderTimeline(); }
            });

            function updateSemesterSettingsVisibility() {
                const show = bindSemester;
                document.getElementById('semesterStartLabel').style.display = show ? 'flex' : 'none';
                document.getElementById('semesterEndModeLabel').style.display = show ? 'flex' : 'none';
                const isDate = semesterEndMode === 'date';
                document.getElementById('semesterEndDateLabel').style.display = (show && isDate) ? 'flex' : 'none';
                document.getElementById('semesterEndWeekLabel').style.display = (show && !isDate) ? 'flex' : 'none';
                document.getElementById('semesterHint').textContent = show ? '已綁定 · 顯示週次' : '未綁定學期 · 自由翻動';
            }

            function updateTlCountSelect() {
                const label = document.getElementById('tlCountLabel');
                const sel = document.getElementById('tlCountSelect');
                if (tlView === 'week') {
                    label.style.display = '';
                    sel.style.display = '';
                    label.textContent = '週數';
                    sel.innerHTML = `<option value="1">1 週</option><option value="2">2 週</option><option value="3">3 週</option><option value="4">4 週</option><option value="5">5 週</option><option value="6">6 週</option>`;
                    sel.value = tlWeekCount;
                } else if (tlView === 'month') {
                    label.style.display = '';
                    sel.style.display = '';
                    label.textContent = '月數';
                    sel.innerHTML = `<option value="1">1 個月</option><option value="2">2 個月</option><option value="3">3 個月</option><option value="4">4 個月</option><option value="5">5 個月</option><option value="6">6 個月</option>`;
                    sel.value = tlMonthCount;
                } else if (tlView === 'quarter') {
                    label.style.display = '';
                    sel.style.display = '';
                    label.textContent = '三個月';
                    sel.innerHTML = `<option value="1">1 個三個月</option><option value="2">2 個三個月</option><option value="3">3 個三個月</option><option value="4">4 個三個月</option><option value="5">5 個三個月</option><option value="6">6 個三個月</option>`;
                    sel.value = tlQuarterCount;
                } else if (tlView === 'halfyear') {
                    label.style.display = '';
                    sel.style.display = '';
                    label.textContent = '半年';
                    sel.innerHTML = `<option value="1">1 個半年</option><option value="2">2 個半年</option><option value="3">3 個半年</option><option value="4">4 個半年</option><option value="5">5 個半年</option><option value="6">6 個半年</option>`;
                    sel.value = tlHalfYearCount;
                } else if (tlView === 'year') {
                    label.style.display = '';
                    sel.style.display = '';
                    label.textContent = '年';
                    sel.innerHTML = `<option value="1">1 年</option><option value="2">2 年</option><option value="3">3 年</option><option value="4">4 年</option><option value="5">5 年</option><option value="6">6 年</option>`;
                    sel.value = tlYearCount;
                }
            }

            document.querySelectorAll('[data-cal-view]').forEach(tab => {
                tab.addEventListener('click', function() {
                    document.querySelectorAll('[data-cal-view]').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    calView = this.dataset.calView;
                    renderCalendar();
                });
            });
            document.getElementById('calPrev').addEventListener('click', function() {
                if (calView === 'day') calAnchor = addDays(calAnchor, -1);
                else if (calView === 'week') calAnchor = addDays(calAnchor, -7);
                else calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() - 1, 1);
                renderCalendar();
            });
            document.getElementById('calNext').addEventListener('click', function() {
                if (calView === 'day') calAnchor = addDays(calAnchor, 1);
                else if (calView === 'week') calAnchor = addDays(calAnchor, 7);
                else calAnchor = new Date(calAnchor.getFullYear(), calAnchor.getMonth() + 1, 1);
                renderCalendar();
            });
            document.getElementById('calToday').addEventListener('click', function() { calAnchor = new Date(); renderCalendar(); });
            document.getElementById('calendarAreaFilter').addEventListener('change', function() { calAreaId = this.value; renderCalendar(); });

            function renderAll() {
                renderSidebar();
                renderOverview();
                renderMyTasks();
                renderProjects();
                renderTrackDetail();
                renderTimeline();
                renderCalendar();
                renderInsights();
                populateAreaFilters();
            }

            function populateAreaFilters() {
                ['mytasksAreaFilter', 'projectsAreaFilter', 'timelineAreaFilter', 'calendarAreaFilter', 'insightsAreaFilter'].forEach(id => {
                    const sel = document.getElementById(id);
                    if (!sel) return;
                    const current = sel.value;
                    let html = `<option value="all">全部領域</option>`;
                    areas.forEach(a => { html += `<option value="${a.id}">${escapeHtml(a.name)}</option>`; });
                    sel.innerHTML = html;
                    sel.value = current || 'all';
                });
            }

            init();
            updateTlCountSelect();
        })();
    
