import './styles.css';

interface ReportData {
    metadata: {
        page_title: string | null;
        url: string;
        branch_name: string | null;
    };
    segments: {
        total: number;
        chill_mode: number;
        experimental_mode: number;
    };
    sections?: {
        engagement_time?: {
            title: string;
            overall: number;
            overall_detail?: string;
            chill_mode: number;
            chill_mode_detail?: string;
            experimental_mode: number;
            experimental_mode_detail?: string;
        };
        engagement_distance?: {
            title: string;
            overall: number;
            overall_detail?: string;
            chill_mode: number;
            chill_mode_detail?: string;
            experimental_mode: number;
            experimental_mode_detail?: string;
        };
    };
    tables: Record<string, {
        title: string;
        headers: string[];
        rows: any[];
    }>;
}

interface FullData {
    timestamp: string;
    data: {
        master: ReportData;
        wmi: ReportData;
    };
}

async function init() {
    try {
        const res = await fetch('./data.json');
        if (!res.ok) throw new Error("Failed to load data");
        const json: FullData = await res.json();

        renderPageHeader(json);
        renderEngagementRateAnalysis(json.data.master, json.data.wmi);
        renderAllComparisonTables(json.data.master, json.data.wmi);

    } catch (e) {
        console.error(e);
        document.body.innerHTML = `<div class="p-8 text-red-500">Error loading data: ${e}</div>`;
    }
}

// ===== HELPER FUNCTIONS =====

function formatNumbersInString(str: string): string {
    return str.replace(/\d+(\.\d+)?/g, (match) => {
        const [integerPart, decimalPart] = match.split('.');
        const formatted = parseInt(integerPart).toLocaleString();
        return decimalPart ? `${formatted}.${decimalPart}` : formatted;
    });
}

function formatDecimalTrimZeros(num: number, maxDecimals: number): string {
    return num.toFixed(maxDecimals).replace(/\.?0+$/, '');
}

function convertToNum(str: string): number | null {
    if (!str || str === 'undefined' || str === 'null') return null;
    
    const num = parseFloat(str);
    return (Number.isNaN(num) || !Number.isFinite(num)) ? null : num;
}

interface DiffResult {
    diff: number;
    diffPrefix: string;
    masterClass: string;
    wmiClass: string;
}

function calculateDiff(masterVal: number, wmiVal: number): DiffResult {
    const diff = wmiVal - masterVal;
    const diffPrefix = diff > 0 ? '+' : '';
    const masterClass = masterVal > wmiVal ? 'opacity-80' : 'opacity-60';
    const wmiClass = wmiVal > masterVal ? 'opacity-90' : 'opacity-60';
    
    return { diff, diffPrefix, masterClass, wmiClass };
}

function formatDetailText(detail: string): string {
    const parts = detail.split(' ');
    if (parts.length >= 2) {
        return formatNumbersInString(parts[0]) + '<br/>' + parts[1];
    }
    return formatNumbersInString(detail);
}

function formatValueCell(val: string, cssClass: string): string {
    const percentMatch = val.match(/([\d\.]+)%\s*(\([^)]+\))?/);
    if (percentMatch) {
        const percent = percentMatch[1];
        const detail = percentMatch[2] || '';
        if (detail) {
            const detailContent = detail.slice(1, -1); // Remove parentheses
            return `
                <div class="font-bold ${cssClass}">${percent}%</div>
                <div class="text-[8px] opacity-50 mt-0.5 leading-tight">${formatDetailText(detailContent)}</div>
            `;
        }
        return `<div class="font-bold ${cssClass}">${percent}%</div>`;
    }
    return `<span class="font-bold ${cssClass}">${formatNumbersInString(val)}</span>`;
}

function generateStringExample(masterOverall: number, wmiOverall: number, contextType: 'time' | 'distance'): string {
    const scale = contextType === 'time' ? 60 : 100;
    const unit = contextType === 'time' ? 'min' : 'miles';
    const tripDesc = contextType === 'time' ? '1-hour drive' : '100-mile drive';
    
    const masterEngaged = Math.round(scale * (masterOverall / 100));
    const wmiEngaged = Math.round(scale * (wmiOverall / 100));
    
    return `<strong>Example:</strong> On a ${tripDesc}, Master keeps OpenPilot engaged for about ${masterEngaged} ${unit}, WMI keeps it engaged for about ${wmiEngaged} ${unit}.`;
}

function formatRelativeTime(timestamp: string): string {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
        ['year', 31536000], ['month', 2592000], ['day', 86400], 
        ['hour', 3600], ['minute', 60], ['second', 1]
    ];
    
    for (const [unit, secondsInUnit] of units) {
        if (seconds >= secondsInUnit || unit === 'second') {
            return rtf.format(-Math.floor(seconds / secondsInUnit), unit);
        }
    }
    return rtf.format(-seconds, 'second');
}

function renderPageHeader(json: FullData) {
    document.getElementById('timestamp')!.textContent = `Last Update: ${formatRelativeTime(json.timestamp)}`;
}

function renderEngagementRateAnalysis(master: ReportData, wmi: ReportData) {
    const masterLink = document.getElementById('master-link') as HTMLAnchorElement;
    const wmiLink = document.getElementById('wmi-link') as HTMLAnchorElement;

    masterLink.href = master.metadata.url;
    wmiLink.href = wmi.metadata.url;

    const summarySection = document.getElementById('summary-section')!;

    const renderEngagementBreakdown = (title: string, contextType: 'time' | 'distance', masterData: any, wmiData: any) => {
        const masterOverall = masterData?.overall || 0;
        const masterOverallDetail = masterData?.overall_detail || '';
        const masterChill = masterData?.chill_mode || 0;
        const masterChillDetail = masterData?.chill_mode_detail || '';
        const masterExp = masterData?.experimental_mode || 0;
        const masterExpDetail = masterData?.experimental_mode_detail || '';
        const wmiOverall = wmiData?.overall || 0;
        const wmiOverallDetail = wmiData?.overall_detail || '';
        const wmiChill = wmiData?.chill_mode || 0;
        const wmiChillDetail = wmiData?.chill_mode_detail || '';
        const wmiExp = wmiData?.experimental_mode || 0;
        const wmiExpDetail = wmiData?.experimental_mode_detail || '';
        
        const overallDiff = calculateDiff(masterOverall, wmiOverall);
        const exampleText = generateStringExample(masterOverall, wmiOverall, contextType);
        const metricType = contextType === 'time' ? 'TIME' : 'DISTANCE';
        
        return `
            <div class="ascii-box-inner p-4 space-y-4">
                <div class="mb-6 bg-black/40 p-3">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] opacity-50 tracking-widest uppercase">Overall Engagement Rate</span>
                        <span class="text-[10px] opacity-50">·</span>
                        <span class="text-sm font-bold glow-text tracking-wider">BY ${metricType}</span>
                    </div>
                </div>
                
                <!-- Overall Comparison -->
                <div class="pb-3 border-b border-dashed border-phosphor-dim">
                    <!-- Diff Badge at Top -->
                    <div class="flex justify-center mb-3">
                        <div class="inline-flex items-center px-3 py-1 border border-dashed border-neutral-500 bg-black/40">
                            <span class="text-base font-bold text-neutral-500 tabular-nums">
                                ${overallDiff.diffPrefix}${overallDiff.diff.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    
                    <!-- Values Grid -->
                    <div class="grid grid-cols-2">
                        <!-- Master -->
                        <div class="space-y-1 text-center pb-2 pr-6 border-r border-dashed border-phosphor-dim">
                            <div class="text-lg md:text-xl opacity-70 font-bold mb-3 tracking-widest glow-text">MASTER</div>
                            <div class="text-4xl font-bold tabular-nums ${masterOverall > wmiOverall ? 'glow-text' : 'opacity-60'}">${masterOverall.toFixed(1)}<span class="text-xl opacity-50">%</span></div>
                            <div class="text-xs opacity-60 mt-2 font-medium leading-tight">${formatDetailText(masterOverallDetail)}</div>
                        </div>
                        
                        <!-- WMI -->
                        <div class="space-y-1 text-center pb-2 pl-6">
                            <div class="text-lg md:text-xl opacity-90 font-bold mb-3 tracking-widest glow-text">WMI</div>
                            <div class="text-4xl font-bold tabular-nums ${wmiOverall > masterOverall ? 'glow-text' : 'opacity-60'}">${wmiOverall.toFixed(1)}<span class="text-xl opacity-60">%</span></div>
                            <div class="text-xs opacity-60 mt-2 font-medium leading-tight">${formatDetailText(wmiOverallDetail)}</div>
                        </div>
                    </div>
                </div>

                <!-- Context Explanation -->
                <div class="text-[9px] opacity-50 italic leading-relaxed bg-black/20 p-2 border-l-2 border-phosphor-dim">
                    ${exampleText}
                </div>

                <!-- Mode Breakdown Table -->
                <div class="text-[10px]">
                    <div class="text-[10px] opacity-50 uppercase tracking-widest mb-4 mt-6">Engagement rate by driving mode</div>
                    <table class="terminal-table text-[10px] w-full">
                        <thead>
                            <tr>
                                <th class="text-left py-1 px-2 opacity-50 text-[8px] uppercase tracking-wider">Mode</th>
                                <th class="text-center py-1 px-2 opacity-50 w-24 text-[8px] uppercase">Master</th>
                                <th class="text-center py-1 px-2 opacity-50 w-16 text-[8px] uppercase">Δ</th>
                                <th class="text-center py-1 px-2 opacity-50 w-24 text-[8px] uppercase">WMI</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${renderComparisonRow('Chill', masterChill, wmiChill, masterChillDetail, wmiChillDetail)}
                            ${renderComparisonRow('Experimental', masterExp, wmiExp, masterExpDetail, wmiExpDetail)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    };

    summarySection.innerHTML = `
        <div class="pb-4 mb-10 border-b border-dashed border-phosphor-amber">
            <h2 class="glow-text text-lg md:text-xl font-bold tracking-wider">ENGAGEMENT RATE ANALYSIS</h2>
        </div>
        <div class="space-y-8">
            <!-- Primary Engagement Metrics -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                ${renderEngagementBreakdown(
                    'Engagement Rate (Time)',
                    'time',
                    master.sections?.engagement_time,
                    wmi.sections?.engagement_time
                )}
                ${renderEngagementBreakdown(
                    'Engagement Rate (Distance)',
                    'distance',
                    master.sections?.engagement_distance,
                    wmi.sections?.engagement_distance
                )}
            </div>

        </div>
    `;
}

function renderComparisonRow(label: string, masterVal: number, wmiVal: number, masterDetail?: string, wmiDetail?: string) {
    const diff = calculateDiff(masterVal, wmiVal);
    const isPercentage = masterDetail !== undefined; // In data structure, percentage values always have detail strings
    
    const masterDisplay = isPercentage ? `${masterVal.toFixed(1)}%` : masterVal.toLocaleString();
    const wmiDisplay = isPercentage ? `${wmiVal.toFixed(1)}%` : wmiVal.toLocaleString();
    const diffDisplay = isPercentage ? `${diff.diffPrefix}${diff.diff.toFixed(1)}%` : `${diff.diffPrefix}${diff.diff.toLocaleString()}`;
    
    return `
        <tr class="hover:bg-phosphor-amber/5 transition-colors">
            <td class="py-2 px-2 font-bold opacity-75">${label}</td>
            <td class="text-center tabular-nums">
                ${masterDetail 
                    ? `<div class="font-bold ${diff.masterClass}">${masterDisplay}</div><div class="text-[8px] opacity-50 mt-0.5 leading-tight">${formatDetailText(masterDetail)}</div>`
                    : `<span class="font-bold ${diff.masterClass}">${masterDisplay}</span>`}
            </td>
            <td class="text-center text-neutral-500 font-bold tabular-nums text-[10px]">
                ${diff.diff !== 0 ? diffDisplay : '—'}
            </td>
            <td class="text-center tabular-nums">
                ${wmiDetail 
                    ? `<div class="font-bold ${diff.wmiClass}">${wmiDisplay}</div><div class="text-[8px] opacity-50 mt-0.5 leading-tight">${formatDetailText(wmiDetail)}</div>`
                    : `<span class="font-bold ${diff.wmiClass}">${wmiDisplay}</span>`}
            </td>
        </tr>
    `;
}

function renderSegmentAnalysis(section: HTMLElement, master: ReportData, wmi: ReportData) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ascii-box bg-black/40 p-4 md:p-6 space-y-6';

    wrapper.innerHTML = `
        <div class="pb-4 mb-10 border-b border-dashed border-phosphor-amber">
            <h2 class="glow-text text-lg md:text-xl font-bold tracking-wider">SEGMENT ANALYSIS</h2>
        </div>
    `;

    const totalDiff = calculateDiff(master.segments.total, wmi.segments.total);

    const tableEl = document.createElement('table');
    tableEl.className = 'terminal-table text-[11px] w-full';
    tableEl.innerHTML = `
        <thead>
            <tr>
                <th class="text-left py-2 opacity-50 text-[9px] uppercase tracking-wider">Mode</th>
                <th class="text-center py-2 opacity-50 uppercase text-[9px] w-24">Master</th>
                <th class="text-center py-2 opacity-50 uppercase text-[9px] w-16">Δ</th>
                <th class="text-center py-2 opacity-50 uppercase text-[9px] w-24">WMI</th>
            </tr>
        </thead>
        <tbody>
            ${renderComparisonRow('Chill', master.segments.chill_mode, wmi.segments.chill_mode)}
            ${renderComparisonRow('Experimental', master.segments.experimental_mode, wmi.segments.experimental_mode)}
        </tbody>
        <tfoot>
            <tr class="border-t-2 border-phosphor-amber/40">
                <td class="py-2 font-bold opacity-75 uppercase text-[10px]">Total Segments</td>
                <td class="text-center tabular-nums"><span class="font-bold ${totalDiff.masterClass}">${master.segments.total.toLocaleString()}</span></td>
                <td class="text-center text-neutral-500 font-bold tabular-nums text-[10px]">${totalDiff.diff !== 0 ? totalDiff.diffPrefix + totalDiff.diff.toLocaleString() : '—'}</td>
                <td class="text-center tabular-nums"><span class="font-bold ${totalDiff.wmiClass}">${wmi.segments.total.toLocaleString()}</span></td>
            </tr>
        </tfoot>
    `;

    wrapper.appendChild(tableEl);
    section.appendChild(wrapper);
}

function renderErrorRow(rowId: string, masterVal: string): string {
    const formattedRowId = rowId.replace(/\s*(\([^)]+\))/, '<br/><span class="opacity-60 text-[9px]">$1</span>');
    
    return `
        <tr class="hover:bg-phosphor-amber/5 transition-colors bg-red-500/10">
            <td class="py-2 font-bold opacity-75 text-[10px] leading-tight">${formattedRowId.toUpperCase()}</td>
            <td class="text-center tabular-nums">${formatValueCell(masterVal, 'opacity-60')}</td>
            <td class="text-center text-[10px]"><span class="opacity-50"></span></td>
            <td class="text-center text-red-500 text-[8px] bg-red-900/30">NO MATCH</td>
        </tr>
    `;
}

function renderAllComparisonTables(master: ReportData, wmi: ReportData) {
    const section = document.getElementById('comparison-section')!;

    // Segment Analysis has known field names
    // Other tables have unknown structure (discovered at runtime from master.tables)
    renderSegmentAnalysis(section, master, wmi);

    const tableKeys = Object.keys(master.tables);

    tableKeys.forEach(key => {
        if (!wmi.tables[key]) return;

        const masterTable = master.tables[key];
        const wmiTable = wmi.tables[key];

        const headers = masterTable.headers;
        if (headers.length === 0) return;

        const idKey = headers[0];
        const metricKeys = headers.slice(1);

        const wrapper = document.createElement('div');
        wrapper.className = 'ascii-box bg-black/40 p-4 md:p-6 space-y-6';

        const headerHTML = `
            <div class="pb-4 mb-10 border-b border-dashed border-phosphor-amber">
                <h2 class="glow-text text-lg md:text-xl font-bold tracking-wider">${masterTable.title.toUpperCase()}</h2>
            </div>
        `;

        const tablesContainer = document.createElement('div');
        tablesContainer.innerHTML = headerHTML;
        
        const tablesGrid = document.createElement('div');
        tablesGrid.className = 'grid grid-cols-1 xl:grid-cols-2 gap-10';

        // Render each metric as a separate table
        metricKeys.forEach(metricName => {
            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'space-y-3';

            const modeHeader = document.createElement('div');
            modeHeader.className = 'flex items-center gap-2 pb-2 border-b border-dashed border-phosphor-dim';
            modeHeader.innerHTML = `
                <span class="text-[10px] opacity-50 uppercase tracking-wider">Mode:</span>
                <span class="text-sm font-bold glow-text">${metricName.toUpperCase()}</span>
            `;
            tableWrapper.appendChild(modeHeader);

            const tableEl = document.createElement('table');
            tableEl.className = 'terminal-table text-[11px] w-full';

            let theadHTML = `
                <thead>
                    <tr>
                        <th class="text-left py-2 opacity-50 text-[9px] uppercase tracking-wider">${masterTable.headers[0]}</th>
                        <th class="text-center py-2 opacity-50 uppercase text-[9px] w-24">Master</th>
                        <th class="text-center py-2 opacity-50 uppercase text-[9px] w-16">Δ</th>
                        <th class="text-center py-2 opacity-50 uppercase text-[9px] w-24">WMI</th>
                    </tr>
                </thead>
            `;

            let tbodyHTML = `<tbody>`;

            masterTable.rows.forEach((masterRow, i) => {
                const rowId = masterRow[idKey];
                const wmiRow = wmiTable.rows.find(r => r[idKey] === rowId);

                if (!wmiRow) {
                    const masterVal = masterRow[metricName] ? String(masterRow[metricName]) : '';
                    tbodyHTML += renderErrorRow(rowId, masterVal);
                    return;
                }

                const masterVal = masterRow[metricName] ? String(masterRow[metricName]) : '';
                const wmiVal = wmiRow[metricName] ? String(wmiRow[metricName]) : '';
                const masterNumVal = convertToNum(masterVal);
                const wmiNumVal = convertToNum(wmiVal);

                let deltaHTML = '<span class="text-neutral-500">—</span>';
                let masterClass = "opacity-60";
                let wmiClass = "opacity-60";

                if (masterNumVal !== null && wmiNumVal !== null) {
                    const diffResult = calculateDiff(masterNumVal, wmiNumVal);
                    masterClass = diffResult.masterClass;
                    wmiClass = diffResult.wmiClass;

                    // Only show number if diff is significant
                    if (Math.abs(diffResult.diff) > 0.0001) {
                        const isPercentage = masterVal.includes('%') || wmiVal.includes('%');
                        const formattedDiff = formatDecimalTrimZeros(diffResult.diff, 4);
                        const percentSign = isPercentage ? '%' : '';
                        deltaHTML = `<span class="text-neutral-500 font-bold tabular-nums">${diffResult.diffPrefix}${formattedDiff}${percentSign}</span>`;
                    }
                }

                // Format the row ID to break at parenthesis
                const formattedRowId = rowId.replace(/\s*(\([^)]+\))/, '<br/><span class="opacity-60 text-[9px]">$1</span>');
                
                tbodyHTML += `
                    <tr class="hover:bg-phosphor-amber/5 transition-colors">
                        <td class="py-2 font-bold opacity-75 text-[10px] leading-tight">${formattedRowId.toUpperCase()}</td>
                        <td class="text-center tabular-nums">${formatValueCell(masterVal, masterClass)}</td>
                        <td class="text-center text-[10px]">${deltaHTML}</td>
                        <td class="text-center tabular-nums">${formatValueCell(wmiVal, wmiClass)}</td>
                    </tr>
                `;
            });

            tbodyHTML += `</tbody>`;
            tableEl.innerHTML = theadHTML + tbodyHTML;

            tableWrapper.appendChild(tableEl);
            tablesGrid.appendChild(tableWrapper);
        });

        tablesContainer.appendChild(tablesGrid);
        wrapper.appendChild(tablesContainer);
        section.appendChild(wrapper);
    });
}

init();
