const MONTHS_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro"
];

// Helper to convert "YYYY-MM-DD" to local Date object (safely adjusting timezone offset)
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Convert Date object to "YYYY-MM-DD" in local time
export function formatLocalDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function getTodayStr(): string {
  const now = new Date();
  return formatLocalDate(now);
}

// Format "YYYY-MM-DD" to friendly format "DD/MM/YYYY"
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Format "YYYY-MM-DD" to "DD/MM"
export function formatDayMonth(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

// Add days to "YYYY-MM-DD" string
export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

export function isSunday(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = parseLocalDate(dateStr);
  return date.getDay() === 0;
}

export function isSaturday(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = parseLocalDate(dateStr);
  return date.getDay() === 6;
}

export function getElapsedDaysExcludingSundays(startDateStr: string, endDateStr: string, excludeSundays: boolean = true): number {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) return 0;
  let count = 0;
  let current = startDateStr;
  while (current <= endDateStr) {
    if (!excludeSundays || !isSunday(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

export function getRetroactiveStartDate(endDateStr: string, paidCount: number, excludeSundays: boolean = true): string {
  if (paidCount <= 0) return endDateStr;
  let currentRef = endDateStr;
  let count = 0;
  let tempDate = endDateStr;
  while (count < paidCount) {
    if (!excludeSundays || !isSunday(tempDate)) {
      count++;
      if (count === paidCount) {
        return tempDate;
      }
    }
    tempDate = addDays(tempDate, -1);
  }
  return tempDate;
}

// Calculate days difference between dateStr1 and dateStr2 (dateStr1 - dateStr2)
export function differenceInDays(dateStr1: string, dateStr2: string): number {
  const d1 = parseLocalDate(dateStr1);
  const d2 = parseLocalDate(dateStr2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns the start and end of the financial month cycle for a given date.
 * REGRA CRÍTICA: O mês vira todo dia 02.
 * Significa:
 * - O ciclo "Junho/2026" começa em 2026-06-02 e termina em 2026-07-01.
 * - Qualquer data de 2026-06-02 até 2026-07-01 pertence ao ciclo "Junho/2026".
 * - Se a data for 2026-07-01, o dia é 1, então o ciclo pertence a Junho/2026.
 * - Se a data for 2026-07-02, o dia é 2, então o ciclo pertence a Julho/2026.
 */
export function getFinancialCycle(dateStr: string): {
  start: string;
  end: string;
  label: string;
} {
  const date = parseLocalDate(dateStr);
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  let cycleStartYear = year;
  let cycleStartMonth = month;

  if (day < 2) {
    // If it's day 1, it belongs to the cycle starting on the 2nd of the previous month
    cycleStartMonth = month - 1;
    if (cycleStartMonth < 0) {
      cycleStartMonth = 11;
      cycleStartYear = year - 1;
    }
  }

  // Cycle starts on the 2nd of the target cycleStartMonth
  const startDate = new Date(cycleStartYear, cycleStartMonth, 2);
  
  // Cycle ends on the 1st of the next month
  const endDate = new Date(cycleStartYear, cycleStartMonth + 1, 1);

  const label = `${MONTHS_PT[cycleStartMonth]} de ${cycleStartYear}`;

  return {
    start: formatLocalDate(startDate),
    end: formatLocalDate(endDate),
    label
  };
}

// Check if checkDateStr falls in the same financial cycle as targetBaseDateStr
export function isInSameFinancialCycle(checkDateStr: string, targetBaseDateStr: string): boolean {
  const baseCycle = getFinancialCycle(targetBaseDateStr);
  return checkDateStr >= baseCycle.start && checkDateStr <= baseCycle.end;
}

// Generate the last N financial cycles to draw statistics
export function getLastNFinancialCycles(baseDateStr: string, count: number): {
  start: string;
  end: string;
  label: string;
}[] {
  const result: { start: string; end: string; label: string }[] = [];
  const baseCycle = getFinancialCycle(baseDateStr);
  
  // Parse start of base cycle
  const currentStart = parseLocalDate(baseCycle.start);
  
  for (let i = count - 1; i >= 0; i--) {
    // Shift current cycle start back by months
    const cycleStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - i, 2);
    const cycleEnd = new Date(currentStart.getFullYear(), currentStart.getMonth() - i + 1, 1);
    const label = `${MONTHS_PT[cycleStart.getMonth()]} de ${cycleStart.getFullYear()}`;
    
    result.push({
      start: formatLocalDate(cycleStart),
      end: formatLocalDate(cycleEnd),
      label
    });
  }
  
  return result;
}
