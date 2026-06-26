const pool = require('../config/db');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function toDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  return String(val).split('T')[0];
}

// Last day of the month containing dateStr
function toMonthEnd(dateStr) {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}

// Last day of the month that is `months` calendar months after dateStr
function addMonthsEnd(dateStr, months) {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth() + months + 1, 0).toISOString().split('T')[0];
}

// Last day of a specific year+month (month is 1-12)
function getMonthEndDate(year, month) {
  return new Date(year, month, 0).toISOString().split('T')[0];
}

// Specific day of a year+month — clamps to last day if month is shorter
function getTargetDayDate(year, month, targetDay) {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(targetDay, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Advance dateStr by `months` calendar months, land on targetDay
function addMonthsDay(dateStr, months, targetDay) {
  const d = new Date(dateStr);
  const totalMonths = d.getMonth() + months;
  const year = d.getFullYear() + Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return getTargetDayDate(year, month, targetDay);
}

// Returns calendar-month count for month-based frequencies, null for day-based
function getFrequencyMonths(plan) {
  switch (plan.frequency_type) {
    case 'monthly':    return 1;
    case 'quarterly':  return 3;
    case 'semiannual': return 6;
    case 'yearly':     return 12;
    default:           return null;
  }
}

function getIntervalDays(plan) {
  switch (plan.frequency_type) {
    case 'daily':      return 1;
    case 'weekly':     return 7;
    case 'monthly':    return 30;
    case 'quarterly':  return 90;
    case 'semiannual': return 180;
    case 'yearly':     return 365;
    case 'custom':     return plan.frequency_days || 30;
    default:           return 30;
  }
}

async function generateTasksForPlan(plan, daysAhead) {
  const freqMonths = getFrequencyMonths(plan);
  const intervalDays = getIntervalDays(plan);
  const window = daysAhead !== undefined ? daysAhead : 365;
  const targetDay = plan.target_day || null;

  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = addDays(today, window);

    const { rows: existing } = await client.query(
      `SELECT MAX(scheduled_date) AS last_date FROM maintenance_tasks WHERE plan_id = $1`,
      [plan.id]
    );

    const lastDate = toDateStr(existing[0].last_date);
    const useTargetMonth = !!plan.target_month && !!freqMonths;

    function advanceNext(date) {
      if (freqMonths) {
        return targetDay
          ? addMonthsDay(date, freqMonths, targetDay)
          : addMonthsEnd(date, freqMonths);
      }
      return addDays(date, intervalDays);
    }

    function getDateForYearMonth(year, month) {
      return targetDay
        ? getTargetDayDate(year, month, targetDay)
        : getMonthEndDate(year, month);
    }

    let nextDate;

    if (lastDate) {
      nextDate = advanceNext(lastDate);
      while (nextDate < today) nextDate = advanceNext(nextDate);
    } else if (useTargetMonth) {
      const sdYear = new Date(toDateStr(plan.start_date) || today).getFullYear();
      let candidate = getDateForYearMonth(sdYear, plan.target_month);
      while (candidate < today) candidate = advanceNext(candidate);
      nextDate = candidate;
    } else {
      const sd = toDateStr(plan.start_date) || today;
      if (freqMonths) {
        const firstDate = targetDay
          ? (() => {
              const d = new Date(sd);
              return getTargetDayDate(d.getFullYear(), d.getMonth() + 1, targetDay);
            })()
          : toMonthEnd(sd);
        nextDate = firstDate < today ? advanceNext(firstDate) : firstDate;
        while (nextDate < today) nextDate = advanceNext(nextDate);
      } else {
        nextDate = sd < today ? today : sd;
      }
    }

    const { rows: futurePending } = await client.query(
      `SELECT COUNT(*)::int AS cnt FROM maintenance_tasks
       WHERE plan_id = $1 AND status IN ('pending','in_progress') AND scheduled_date >= $2`,
      [plan.id, today]
    );
    const hasFutureTask = futurePending[0].cnt > 0;

    let created = 0;

    async function insertIfNew(date) {
      const { rows: dup } = await client.query(
        `SELECT id FROM maintenance_tasks WHERE plan_id = $1 AND scheduled_date = $2 LIMIT 1`,
        [plan.id, date]
      );
      if (!dup[0]) {
        await client.query(
          `INSERT INTO maintenance_tasks
             (plan_id, equipment_id, title, description, scheduled_date, status)
           VALUES ($1,$2,$3,$4,$5,'pending')`,
          [plan.id, plan.equipment_id, plan.title, plan.description, date]
        );
        created++;
      }
    }

    if (nextDate <= endDate) {
      while (nextDate <= endDate) {
        await insertIfNew(nextDate);
        nextDate = advanceNext(nextDate);
      }
    } else if (!hasFutureTask) {
      await insertIfNew(nextDate);
    }

    return created;
  } finally {
    client.release();
  }
}

async function generateAllActivePlans() {
  try {
    const { rows: plans } = await pool.query(
      'SELECT * FROM maintenance_plans WHERE is_active = true AND is_one_time = false'
    );
    let total = 0;
    for (const plan of plans) {
      total += await generateTasksForPlan(plan);
    }
    if (total > 0) console.log(`Task generator: ${total} yeni gorev olusturuldu`);
  } catch (err) {
    console.error('Task generation error:', err.message);
  }
}

module.exports = { generateTasksForPlan, generateAllActivePlans, getIntervalDays };
