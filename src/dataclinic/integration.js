'use strict';

const codeHeader = '건강검진검사항목코드';
const codeNames = [codeHeader, '건강검진검사항목코드명', '검사항목도메인구분코드', '도메인구분'];
const codeIndex = new Map(nhisRows.map(row => [row[0], row]));
const exampleRecords = [
    ['V-001', 'A1101001'], ['V-001', 'A1101002'], ['V-002', 'A1101003'],
    ['V-003', 'M2107002'], ['V-004', 'DEMO-UNKNOWN'], ['V-005', ''],
];
const exampleHeaders = ['가상검진번호', codeHeader];
let activePanel = 'general';
let records, mergedRows, mergedHeaders, mergeCounts;
let mergeTicket = 0, explanationTicket = 0, configured = false;

function showPanel(panel) {
    activePanel = panel;
    for (const name of ['general', 'merge', 'medical']) {
        $(name).hidden = panel !== name;
        $(name + 'Tab').setAttribute('aria-pressed', String(panel === name));
    }
    refreshExplanation();
}

function showRecords(parsed, label) {
    records = parsed;
    options('codeColumn', parsed.headers.map((h, i) => [i, h]));
    const standard = parsed.headers.indexOf(codeHeader);
    $('codeColumn').value = standard === -1 ? '' : String(standard);
    $('mergeSource').textContent = label;
    $('mergeError').textContent = '';
    joinRecords();
}

function joinRecords() {
    const column = $('codeColumn').value;
    $('mergeDownload').disabled = column === '';
    if (column === '') {
        mergeCounts = null;
        $('mergeLimit').textContent = '';
        $('mergeMetrics').replaceChildren();
        $('joinPreview').textContent = '검진 기록에서 코드가 들어 있는 열을 선택하세요.';
        refreshExplanation();
        return;
    }
    const counts = {rows: records.rows.length, matched: 0, unknown: 0, blank: 0};
    mergedHeaders = [...records.headers];
    for (const label of ['공단 검사항목명', '공단 도메인', '병합 상태']) {
        let unique = label;
        while (mergedHeaders.includes(unique)) unique += ' (병합)';
        mergedHeaders.push(unique);
    }
    mergedRows = records.rows.map(row => {
        const key = row[column].trim(), item = codeIndex.get(key);
        const status = !key ? 'blank' : item ? 'matched' : 'unknown';
        counts[status]++;
        return [...row, item?.[1] || '', item?.[3] || '',
            {matched: '연결', unknown: '미등록 · 검토', blank: '빈 코드 · 검토'}[status]];
    });
    mergeCounts = counts;
    $('mergeMetrics').replaceChildren(metric('검진 기록', format(counts.rows)+'행'),
        metric('연결된 행', format(counts.matched)+'행'), metric('검토할 행', format(counts.blank + counts.unknown)+'행'));
    table('joinPreview', mergedHeaders, mergedRows.slice(0, 100));
    $('mergeLimit').textContent = '미등록 '+counts.unknown+'행 · 빈 코드 '+counts.blank+'행. 처음 100행까지 표시하며 저장 파일에는 전체 행이 포함됩니다.';
    refreshExplanation();
}

function currentSummary() {
    if (activePanel === 'merge') return mergeCounts && {kind:'merge', metrics:mergeCounts};
    if (activePanel === 'medical') {
        const [peopleWithReport, oneDate, conflicts] = review(newer ? [...events.rows, added] : events.rows);
        return {kind:'medical', metrics:{peopleWithReport, oneDate, conflicts}};
    }
    if (!setupConfirmed || currentExperiment !== 'clean' || $('lab').hidden) return null;
    const finite = value => Number.isFinite(value) ? value : null;
    return {kind:'cleaning', metrics:{rows:base.count, missing:base.missing,
        originalSd:finite(base.sd), meanSd:finite(stats.mean.sd), medianSd:finite(stats.median.sd)}};
}

function refreshExplanation() {
    explanationTicket++;
    const summary = currentSummary();
    $('aiPanel').hidden = !summary;
    $('askGemini').disabled = !configured || !summary;
    $('aiMessage').textContent = '';
    $('aiText').replaceChildren();
    if (!summary) return;
    const m = summary.metrics;
    let rule;
    if (summary.kind === 'cleaning') rule = $('risk').textContent;
    else if (summary.kind === 'medical') rule = $('medRisk').textContent;
    else rule = '코드가 일치한 '+m.matched+'행에 공단 명칭을 붙였습니다. 미등록 '+m.unknown+'행과 빈 코드 '+m.blank+'행은 원래 값과 함께 보존합니다.';
    $('ruleExplanation').textContent = rule;
    $('sharing').textContent = JSON.stringify(summary, null, 2);
}

async function getExplanation() {
    const ticket = ++explanationTicket;
    const summary = currentSummary();
    if (!configured || !summary) return;
    $('askGemini').disabled = true;
    $('aiMessage').textContent = 'Gemini가 집계 지표를 읽고 있습니다…';
    $('aiText').replaceChildren();
    try {
        const response = await fetch('/api/explain', {method:'POST',
            headers:{'Content-Type':'application/json'}, body:JSON.stringify(summary)});
        const body = await response.json();
        if (ticket !== explanationTicket) return;
        if (!response.ok) {
            const reasons = {no_key:'서버에 API 키가 없습니다.', quota:'Gemini 호출 한도에 도달했습니다.',
                model_or_key:'API 키 권한과 모델 설정을 확인하세요.'};
            throw Error(reasons[body.error] || '응답을 확인할 수 없습니다.');
        }
        const parts = body.explanation;
        for (const [key, title] of [['meaning','결과 해석'], ['limit','해석의 한계'], ['check','확인할 사항']]) {
            const block = el('div');block.append(el('h3',title),el('p',parts[key]));$('aiText').append(block);
        }
        $('aiMessage').textContent = 'Gemini 설명';
    } catch (err) {
        if (ticket === explanationTicket) $('aiMessage').textContent = err.message + ' 위의 계산 기반 설명을 사용하세요.';
    } finally {
        if (ticket === explanationTicket) $('askGemini').disabled = !configured;
    }
}

async function checkConnection() {
    if (location.protocol === 'http:' && ['127.0.0.1','localhost'].includes(location.hostname)) {
        try {
            const res = await fetch('/api/status');
            configured = res.ok && (await res.json()).configured === true;
        } catch { configured = false; }
    }
    $('connection').textContent = configured ? 'Gemini 연결 설정됨 · 버튼을 누르면 표시된 집계값을 전송합니다.'
        : 'Gemini를 사용하려면 폴더의 start.cmd를 실행하고 API 키를 설정하세요.';
    $('askGemini').disabled = !configured || !currentSummary();
}

$('askGemini').onclick = getExplanation;
for (const name of ['general','merge','medical']) $(name+'Tab').onclick = () => showPanel(name);
$('codeColumn').onchange = joinRecords;
$('mergeSample').onclick = () => {
    mergeTicket++;
    showRecords({headers:exampleHeaders, rows:exampleRecords}, '가상 검진 기록 · 공단 코드표 2024-07-31');
};
$('mergeFile').onchange = async event => {
    const file = event.target.files[0];
    if (!file) return;
    const ticket = ++mergeTicket;
    try {
        const bytes = await file.arrayBuffer();
        let text;
        try { text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
        catch { text = new TextDecoder('euc-kr',{fatal:true}).decode(bytes); }
        const parsed = parseCSV(text);
        if (ticket === mergeTicket) showRecords(parsed, file.name);
    } catch (err) {
        if (ticket === mergeTicket) $('mergeError').textContent = '기존 기록을 유지합니다. '+err.message;
    } finally { if (ticket === mergeTicket) event.target.value = ''; }
};
$('mergeDownload').onclick = () => save('검진코드_병합.csv','\uFEFF'+csv(mergedHeaders,mergedRows),'text/csv;charset=utf-8');
$('dictionaryDownload').onclick = () => save('공단_검진코드표.csv','\uFEFF'+csv(codeNames,nhisRows),'text/csv;charset=utf-8');
$('dictionaryCount').textContent = format(codeIndex.size);
$('mergeSample').click();
document.addEventListener('summarychange', refreshExplanation);
showPanel('general');
checkConnection();

