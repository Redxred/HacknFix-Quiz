(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const when = value => value ? new Date(value).toLocaleString() : 'No save yet';
  const student = a => a.exam_students || {};
  const score = a => {
    const total = (a.mcq_total || 0) + (a.written_total || 0) + (a.practical_total || 0);
    const got = (a.mcq_score || 0) + (a.written_score || 0) + (a.practical_score || 0);
    return { total, got, percent: total ? Math.round(got / total * 100) : null };
  };
  const paperFields = 'id,status,started_at,submitted_at,deadline,violation_count,auto_submitted,mcq_score,written_score,practical_score,mcq_total,written_total,practical_total,exam_students(name,student_id,batch)';
  window.HNFExamDashboard = {
    create({ sb, toast, openTab, openPaper, downloadPaper, deleteResult, openResults }) {
      let active = false, live = true, poll = null, clock = null, request = null, generation = 0;
      let settings = null, monitored = [], trendRows = [], changingOpen = false, settingsVersion = 0;
      const set = (id, value) => { $(id).textContent = value; };
      const savedAnswers = a => (a.exam_answers || []).filter(x => x.answered_at);
      const lastSave = a => savedAnswers(a).reduce((latest, x) => x.answered_at > latest ? x.answered_at : latest, '');
      const progress = a => (a.exam_answers || []).length ? savedAnswers(a).length / a.exam_answers.length : 0;
      function stopTimers() { clearInterval(poll); clearInterval(clock); poll = clock = null; }
      function schedule() {
        stopTimers();
        if (!active || !live || document.hidden) return;
        poll = setInterval(refresh, 20000);
        clock = setInterval(paintClocks, 1000);
      }
      function leave() {
        active = false; generation++; request = null; stopTimers();
      }
      function paperButton(a, label = 'View paper') {
        const b = el('button', label, 'btn btn-ghost btn-sm');
        b.type = 'button';
        b.addEventListener('click', () => openPaper(a));
        return b;
      }
      function paintClocks() {
        $('edMonitorRows').querySelectorAll('[data-deadline]').forEach(node => {
          const seconds = Math.floor((new Date(node.dataset.deadline) - Date.now()) / 1000);
          node.textContent = seconds <= 0 ? 'Expired · awaiting submission' : Math.floor(seconds / 60) + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
          node.classList.toggle('exam-urgent', seconds <= 300);
        });
      }
      function renderMonitor() {
        const term = $('edSearch').value.trim().toLowerCase();
        const flagged = $('edOnlyFlagged').checked;
        const activity = $('edActivity').value, now = Date.now();
        const rows = monitored.filter(a => {
          const s = student(a), last = lastSave(a), deadline = new Date(a.deadline).getTime();
          const matchesActivity = activity === 'all' ||
            (activity === 'no-saves' && !last) ||
            (activity === 'quiet' && now - new Date(last || a.started_at).getTime() >= 600000) ||
            (activity === 'urgent' && deadline - now <= 300000);
          return (!flagged || a.violation_count > 0) &&
            matchesActivity &&
            (!term || [s.name, s.student_id, s.batch].some(v => String(v || '').toLowerCase().includes(term)));
        });
        const sort = $('edSort').value;
        rows.sort((a,b) => sort === 'last-save' ? (lastSave(b) || b.started_at || '').localeCompare(lastSave(a) || a.started_at || '') :
          sort === 'progress' ? progress(b) - progress(a) || new Date(a.deadline) - new Date(b.deadline) :
          sort === 'flags' ? (b.violation_count || 0) - (a.violation_count || 0) || new Date(a.deadline) - new Date(b.deadline) :
          new Date(a.deadline) - new Date(b.deadline));
        const host = $('edMonitorRows'); host.replaceChildren();
        rows.forEach(a => {
          const tr = el('tr');
          tr.dataset.attempt = a.id;
          const s = student(a), name = el('td');
          name.dataset.label = 'Student';
          name.append(el('strong', s.name || 'Unknown student'), el('small', [s.student_id, s.batch].filter(Boolean).join(' · '), 'exam-row-detail'));
          const answers = a.exam_answers || [], saved = savedAnswers(a);
          const progress = el('td');
          progress.dataset.label = 'Saved questions';
          progress.append(el('span', saved.length + ' / ' + answers.length));
          const bar = el('progress'); bar.max = Math.max(1, answers.length); bar.value = saved.length;
          bar.setAttribute('aria-label', 'Questions with saved drafts'); progress.append(bar);
          const last = lastSave(a);
          const lastCell = el('td', when(last)); lastCell.dataset.label = 'Last save';
          if (!last && a.started_at) lastCell.append(el('small', 'Started ' + when(a.started_at), 'exam-row-detail'));
          const remaining = el('td'); remaining.dataset.deadline = a.deadline; remaining.dataset.label = 'Time left';
          const flags = el('td', a.violation_count || 0); flags.dataset.label = 'Flags';
          const actions = el('td'); actions.dataset.label = 'Actions'; actions.append(paperButton(a));
          tr.append(name, progress, lastCell, remaining, flags, actions);
          host.append(tr);
        });
        set('edMonitorNote', rows.length + ' shown from ' + monitored.length + ' loaded attempts.' + (monitored.length === 100 ? ' Limit reached; use Exam results for additional papers.' : '') + (!rows.length ? ' No matching attempts.' : ''));
        paintClocks();
      }
      function renderUpdates() {
        const host = $('edUpdates'); host.replaceChildren();
        const rows = monitored.map(a => ({a, at:lastSave(a) || a.started_at, saved:!!lastSave(a)}))
          .filter(x => x.at).sort((a,b) => b.at.localeCompare(a.at)).slice(0,8);
        if (!rows.length) host.append(el('p', 'No student activity in this monitor view.', 'sub'));
        rows.forEach(({a,at,saved}) => {
          const row = el('div', null, 'exam-feed-item'), details = el('div'), s = student(a);
          details.append(el('strong', s.name || s.student_id || 'Student'),
            el('small', (saved ? 'Draft saved' : 'Attempt started') + ' · ' + when(at)),
            el('small', [s.student_id,s.batch].filter(Boolean).join(' · ')));
          row.append(details,paperButton(a,'View paper')); host.append(row);
        });
        set('edUpdatesNote', 'Latest 8 from ' + monitored.length + ' loaded attempts in the selected monitor view.');
      }
      function renderBatches() {
        const batches = new Map();
        trendRows.forEach(a => {
          const name = student(a).batch || 'Unassigned';
          if (!batches.has(name)) batches.set(name,{name,submitted:0,marked:0,points:0,flagged:0});
          const item = batches.get(name); item.submitted++;
          if (a.violation_count > 0) item.flagged++;
          if (a.status === 'graded' && score(a).percent != null) { item.marked++; item.points += score(a).percent; }
        });
        const rows = [...batches.values()], sort = $('edBatchSort').value;
        rows.sort((a,b) => sort === 'average' ? (b.marked ? b.points / b.marked : -1) - (a.marked ? a.points / a.marked : -1) || b.submitted - a.submitted :
          sort === 'name' ? a.name.localeCompare(b.name) : b.submitted - a.submitted || a.name.localeCompare(b.name));
        const host = $('edBatches'); host.replaceChildren();
        if (!rows.length) {
          const cell = el('td','No submissions in this period.'); cell.colSpan = 5;
          const tr = el('tr'); tr.append(cell); host.append(tr);
        }
        rows.forEach(b => {
          const tr = el('tr');
          [b.name,b.submitted,b.marked,b.marked ? Math.round(b.points / b.marked) + '%' : '—',b.flagged].forEach(value => tr.append(el('td',String(value))));
          host.append(tr);
        });
        set('edBatchNote', rows.length + ' batches · ' + trendRows.length + ' submitted papers' + (trendRows.length === 1000 ? ' (latest 1,000 only)' : '') + '.');
      }
      function renderStats(data, expired) {
        const total = data.in_progress + data.submitted + data.graded;
        set('edStudents', data.students);
        set('edActive', expired == null ? '—' : Math.max(0, data.in_progress - expired));
        set('edExpired', expired == null ? '—' : expired);
        set('edWaiting', data.submitted); set('edGraded', data.graded);
        set('edFlagged', data.flagged); set('edAuto', data.auto);
        set('edAverage', data.graded ? data.avg_percent + '%' : '—');
        const completed = data.submitted + data.graded;
        set('edCompletion', `${completed} of ${total} attempts submitted${total ? ' · ' + Math.round(completed / total * 100) + '% completion' : ''}. All-time totals. Flags need human review.`);
        set('exBadge', data.submitted);
        $('exBadge').classList.toggle('hidden', !data.submitted);
      }
      function renderSettings() {
        if (!settings) return;
        set('edTitle', settings.exam_title || 'Final Exam');
        set('edOpenState', settings.exam_open ? 'Open for new attempts' : 'Closed to new attempts');
        $('edOpenState').className = 'pill ' + (settings.exam_open ? 'on' : 'off');
        set('edToggleOpen', settings.exam_open ? 'Close exam' : 'Open exam');
        $('edToggleOpen').disabled = changingOpen;
      }
      function renderReadiness(bank) {
        const host = $('edReadiness'); host.replaceChildren();
        if (!settings) { host.append(el('p', 'Settings unavailable. Refresh to retry.', 'sub')); return; }
        const activeBank = bank.filter(q => q.is_active);
        let short = false;
        for (const [type, label] of [['mcq', 'MCQ'], ['written', 'Written / CQ'], ['practical', 'Practical']]) {
          const have = activeBank.filter(q => q.qtype === type).length;
          const want = settings[type + '_count'] || 0;
          const row = el('div', null, 'exam-readiness-row');
          row.append(el('span', label), el('strong', have + ' active / ' + want + ' requested'));
          if (have < want) { row.classList.add('exam-urgent'); short = true; }
          host.append(row);
        }
        host.append(el('p', short ? 'Some sections have fewer active questions than requested.' : 'Question availability meets the configured paper.', 'exam-scope'));
        if (bank.length >= 1000) host.append(el('p', 'Readiness checks use the first 1,000 question records.', 'exam-scope'));
        if (!activeBank.length) host.append(el('p', 'No active questions. Add questions before opening the exam.', 'exam-urgent'));
        const minutes = Math.max(1, Math.ceil(((settings.mcq_count || 0) * (settings.mcq_seconds || 30)) / 60 + (settings.written_minutes || 0) + (settings.practical_minutes || 0)));
        host.append(el('p', `Configured time: ${minutes} minutes · Pass mark: ${settings.pass_percent ?? 40}% · Violation limit: ${settings.max_violations ?? 3}`, 'exam-scope'));
        const rules = $('edRules'); rules.replaceChildren();
        [['require_fullscreen', 'Fullscreen'], ['block_copy', 'Copy / paste blocking'], ['detect_tab_switch', 'Tab monitoring'], ['end_on_exit', 'Submit on exit'], ['one_attempt_per_student', 'One attempt per student']].forEach(([key, label]) => rules.append(el('span', label + ': ' + (settings[key] ? 'on' : 'off'))));
      }
      function renderFeed(id, rows, marking) {
        const host = $(id); host.replaceChildren();
        if (!rows.length) { host.append(el('p', marking ? 'No papers waiting for marking.' : 'No submitted papers yet.', 'sub')); return; }
        rows.forEach(a => {
          const row = el('div', null, 'exam-feed-item'), details = el('div');
          row.dataset.attempt = a.id;
          const s = student(a), result = score(a);
          details.append(el('strong', s.name || 'Unknown student'), el('small', [s.student_id, s.batch, when(a.submitted_at)].filter(Boolean).join(' · ')));
          details.append(el('small', a.status === 'graded' ? `Marked · ${result.got}/${result.total}` : 'Awaiting marking · MCQ ' + a.mcq_score + '/' + a.mcq_total));
          const actions = el('div', null, 'exam-feed-actions');
          actions.append(paperButton(a, marking ? 'Mark paper' : 'Review'));
          if (!marking) {
            const excel = el('button', 'Excel', 'btn btn-ghost btn-sm');
            excel.type = 'button';
            excel.title = 'Download full exam paper with student details, questions and answers';
            excel.setAttribute('aria-label', 'Download full paper Excel for ' + (s.name || s.student_id || 'student'));
            excel.addEventListener('click', () => downloadPaper(a, excel));
            actions.append(excel);
            const remove = el('button', 'Delete', 'btn btn-danger btn-sm');
            remove.type = 'button';
            remove.setAttribute('aria-label','Delete result for '+(s.name || s.student_id || 'student'));
            remove.addEventListener('click',()=>deleteResult(a,remove));
            actions.append(remove);
          }
          row.append(details, actions); host.append(row);
        });
      }
      function renderViolations(rows) {
        const host = $('edViolations'); host.replaceChildren();
        if (!rows.length) { host.append(el('p', 'No violation events recorded.', 'sub')); return; }
        rows.forEach(v => {
          const s = v.exam_attempts?.exam_students || {};
          const item = el('div', null, 'exam-feed-item'), details = el('div');
          item.dataset.attempt = v.attempt;
          details.append(el('strong', String(v.kind || 'Event').replaceAll('-', ' ') + ' · ' + (s.name || s.student_id || 'Student')));
          details.append(el('small', when(v.at)), el('small', v.detail || 'No additional detail'));
          item.append(details, paperButton({ id: v.attempt }, 'Review')); host.append(item);
        });
      }
      function renderTrends(rows, days) {
        const dayKey = d => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
        const counts = new Map();
        const dates = Array.from({ length: days }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - days + i + 1); d.setHours(0, 0, 0, 0); counts.set(dayKey(d), 0); return d; });
        rows.forEach(a => { const k = dayKey(new Date(a.submitted_at)); if (counts.has(k)) counts.set(k, counts.get(k) + 1); });
        const max = Math.max(1, ...counts.values()), host = $('edTrend'); host.replaceChildren();
        dates.forEach((date, index) => {
          const n = counts.get(dayKey(date)), label = date.toLocaleDateString(undefined, {month:'short', day:'numeric'});
          const column = el('div', null, 'exam-trend-column'); column.tabIndex = 0;
          column.setAttribute('aria-label', label + ': ' + n + ' submissions'); column.title = label + ': ' + n;
          const bar = el('i'); bar.style.height = (n / max * 100) + '%'; column.append(bar);
          column.append(el('small', index === 0 || index === days - 1 || index === Math.floor(days / 2) ? label : ''));
          host.append(column);
        });
        set('edTrendTotal', rows.length + ' submissions');
        set('edTrendScope', (rows.length === 1000 ? 'Limit reached: latest 1,000 submissions' : rows.length + ' submissions') + ' in the last ' + days + ' days, in your local timezone.');
        const graded = rows.filter(a => a.status === 'graded' && score(a).percent != null);
        const bins = [0, 0, 0, 0];
        graded.forEach(a => { const p = score(a).percent; bins[p < 40 ? 0 : p < 60 ? 1 : p < 80 ? 2 : 3]++; });
        const chart = $('edScores'); chart.replaceChildren();
        ['0–39%', '40–59%', '60–79%', '80–100%'].forEach((label, i) => {
          const row = el('div', null, 'exam-score-row'), bar = el('progress');
          bar.max = Math.max(1, graded.length); bar.value = bins[i]; bar.setAttribute('aria-label', label + ': ' + bins[i] + ' papers');
          row.append(el('span', label), bar, el('strong', bins[i])); chart.append(row);
        });
        set('edScoreNote', graded.length ? graded.length + ' marked papers in this sample.' : 'No marked papers in this period.');
      }
      async function refresh() {
        if (!active || !sb || request) return request;
        const version = ++generation, days = Number($('edDays').value), now = new Date();
        const readSettingsVersion = settingsVersion;
        const since = new Date(now); since.setDate(since.getDate() - days + 1); since.setHours(0, 0, 0, 0);
        let monitorQuery = sb.from('exam_attempts').select(paperFields + ',exam_answers(id,answered_at)').eq('status', 'in_progress');
        monitorQuery = $('edMonitorMode').value === 'expired' ? monitorQuery.lte('deadline', now.toISOString()) : monitorQuery.gt('deadline', now.toISOString());
        const queries = {
          totals: sb.rpc('exam_stats'),
          settings: sb.from('exam_settings').select('*').eq('id', 1).single(),
          expired: sb.from('exam_attempts').select('id', {count:'exact', head:true}).eq('status','in_progress').lte('deadline',now.toISOString()),
          monitor: monitorQuery.order('deadline',{ascending:true}).limit(100),
          queue: sb.from('exam_attempts').select(paperFields).eq('status','submitted').order('submitted_at',{ascending:true}).limit(10),
          recent: sb.from('exam_attempts').select(paperFields).neq('status','in_progress').order('submitted_at',{ascending:false}).limit(10),
          violations: sb.from('exam_violations').select('attempt,kind,detail,at,exam_attempts(exam_students(name,student_id))').order('at',{ascending:false}).limit(30),
          bank: sb.from('exam_questions').select('qtype,is_active').limit(1000),
          trend: sb.from('exam_attempts').select('status,submitted_at,violation_count,mcq_score,written_score,practical_score,mcq_total,written_total,practical_total,exam_students(batch)').gte('submitted_at',since.toISOString()).order('submitted_at',{ascending:false}).limit(1000)
        };
        $('edRefresh').disabled = true;
        $('tab-exam-dashboard').setAttribute('aria-busy','true');
        request = (async () => {
          const results = Object.fromEntries(await Promise.all(Object.entries(queries).map(async ([name, query]) => {
            try { return [name, await query]; } catch (error) { return [name, {error}]; }
          })));
          if (!active || version !== generation) return;
          const failed = Object.entries(results).filter(([,r]) => r.error).map(([name]) => name);
          const ok = name => !results[name].error;
          if (readSettingsVersion === settingsVersion && !changingOpen) {
            if (ok('settings') && results.settings.data) { settings = results.settings.data; renderSettings(); }
            else { settings = null; $('edToggleOpen').disabled = true; set('edOpenState','Status unavailable'); }
          }
          if (ok('totals') && results.totals.data) renderStats(results.totals.data, ok('expired') ? results.expired.count : null);
          if (ok('monitor')) { monitored = results.monitor.data || []; renderMonitor(); renderUpdates(); }
          else { monitored = []; $('edMonitorRows').replaceChildren(); $('edUpdates').replaceChildren(); set('edMonitorNote','Attempts unavailable. Refresh to retry.'); set('edUpdatesNote','Activity unavailable. Refresh to retry.'); }
          if (ok('queue')) renderFeed('edQueue',results.queue.data || [],true);
          if (ok('recent')) renderFeed('edRecent',results.recent.data || [],false);
          if (ok('violations')) renderViolations(results.violations.data || []);
          if (ok('bank')) renderReadiness(results.bank.data || []);
          if (ok('trend')) { trendRows = results.trend.data || []; renderTrends(trendRows,days); renderBatches(); }
          else { trendRows = []; $('edBatches').replaceChildren(); set('edBatchNote','Batch data unavailable. Refresh to retry.'); }
          $('edError').classList.toggle('hidden',!failed.length);
          set('edError',failed.length ? 'Could not refresh: ' + failed.join(', ') + '. Previously displayed values may be stale. Check the connection and retry.' : '');
          set('edUpdated',(failed.length ? 'Partial update · ' : 'Updated · ') + new Date().toLocaleTimeString());
        })().finally(() => {
          if (version === generation) { request = null; $('edRefresh').disabled = false; $('tab-exam-dashboard').setAttribute('aria-busy','false'); }
        });
        return request;
      }
      $('edToggleOpen').addEventListener('click',async () => {
        if (!settings || changingOpen) return;
        settingsVersion++;
        changingOpen = true; $('edToggleOpen').disabled = true;
        const next = !settings.exam_open;
        try {
          const {data,error} = await sb.from('exam_settings').update({exam_open:next,updated_at:new Date().toISOString()}).eq('id',1).select('*').single();
          if (error) throw error;
          if (!data) throw new Error('The setting was not saved.');
          settings = data; renderSettings(); toast(next ? 'Exam opened for new attempts.' : 'Exam closed to new attempts.');
        } catch(e) { toast('Could not change exam status: ' + e.message,true); }
        finally { changingOpen = false; $('edToggleOpen').disabled = !settings; }
      });
      $('edLive').addEventListener('click',() => {
        live = !live; set('edLive',live ? '● Live · 20s' : 'Ⅱ Paused');
        $('edLive').setAttribute('aria-pressed',String(live)); schedule(); if (live) refresh();
      });
      $('edRefresh').addEventListener('click',refresh);
      $('edSearch').addEventListener('input',renderMonitor);
      $('edOnlyFlagged').addEventListener('change',renderMonitor);
      ['edActivity','edSort'].forEach(id => $(id).addEventListener('change',renderMonitor));
      $('edBatchSort').addEventListener('change',renderBatches);
      ['edMonitorMode','edDays'].forEach(id => $(id).addEventListener('change',async () => { if (request) await request; if (active) refresh(); }));
      ['edAllMarking','edMarkQueue'].forEach(id => $(id).addEventListener('click',() => openResults('submitted')));
      $('edFlagQueue').addEventListener('click',() => openResults('flagged'));
      document.querySelectorAll('[data-exam-page]').forEach(b => b.addEventListener('click',() => openTab(b.dataset.examPage)));
      document.addEventListener('visibilitychange',() => { schedule(); if (active && live && !document.hidden) refresh(); });
      return { enter() { active = true; schedule(); return refresh(); }, leave, refresh,
        async resultDeleted(id) {
          // Let an older read finish before fetching the post-delete state.
          if (request) await request;
          monitored = monitored.filter(a=>a.id!==id);
          document.querySelectorAll('#tab-exam-dashboard [data-attempt]').forEach(node=>{
            if(node.dataset.attempt===id) node.remove();
          });
          return refresh();
        }
      };
    }
  };
})();
