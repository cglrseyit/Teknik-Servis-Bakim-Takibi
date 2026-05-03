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

// Returns calendar-month count for month-based frequencies, null for day-based
function getFrequencyMonths(plan) {
  switch (plan.frequency_type) {
    case 'monthly':   return 1;
    case 'quarterly': return 3;
    case 'yearly':    return 12;
    default:          return null;
  }
}

function getIntervalDays(plan) {
  switch (plan.frequency_type) {
    case 'daily':     return 1;
    case 'weekly':    return 7;
    case 'monthly':   return 30;
    case 'quarterly': return 90;
    case 'yearly':    return 365;
    case 'custom':    return plan.frequency_days || 30;
    default:          return 30;
  }
}

async function generateTasksForPlan(plan, daysAhead) {
  const freqMonths = getFrequencyMonths(plan);
  const intervalDays = getIntervalDays(plan);
  const window = daysAhead !== undefined ? daysAhead : 365;

  const client = await pool.connect();
  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = addDays(today, window);

    const { rows: existing } = await client.query(
      `SELECT MAX(scheduled_date) AS last_date FROM maintenance_tasks WHERE plan_id = $1`,
      [plan.id]
    );

    const lastDate = toDateStr(existing[0].last_date);
    const useTargetMonth = plan.target_month && freqMonths === 12;

    // Advance function: move to next occurrence
    function advanceNext(date) {
      if (useTargetMonth) {
        const yr = new Date(date).getFullYear();
        return getMonthEndDate(yr + 1, plan.target_month);
      }
      return freqMonths ? addMonthsEnd(date, freqMonths) : addDays(date, intervalDays);
    }

    let nextDate;

    if (useTargetMonth) {
      // Yearly plan locked to a specific month (e.g. always April)
      if (lastDate) {
        const lastYear = new Date(lastDate).getFullYear();
        nextDate = getMonthEndDate(lastYear + 1, plan.target_month);
      } else {
        const sd = toDateStr(plan.start_date) || today;
        const sdYear = new Date(sd).getFullYear();
        const candidateThisYear = getMonthEndDate(sdYear, plan.target_month);
        nextDate = candidateThisYear >= today
          ? candidateThisYear
          : getMonthEndDate(sdYear + 1, plan.target_month);
      }
      while (nextDate < today) {
        nextDate = advanceNext(nextDate);
      }
    } else if (lastDate) {
      nextDate = freqMonths ? addMonthsEnd(lastDate, freqMonths) : addDays(lastDate, intervalDays);
      while (nextDate < today) {
        nextDate = advanceNext(nextDate);
      }
    } else {
      const sd = toDateStr(plan.start_date) || today;
      if (freqMonths) {
        const monthEnd = toMonthEnd(sd);
        nextDate = monthEnd < today ? addMonthsEnd(monthEnd, freqMonths) : monthEnd;
        while (nextDate < today) {
          nextDate = addMonthsEnd(nextDate, freqMonths);
        }
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
