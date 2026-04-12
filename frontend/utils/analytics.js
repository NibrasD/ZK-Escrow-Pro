/**
 * Analytics utility for ZK-Escrow Pro.
 * Calculates TVL, success rates, and status distribution from job records.
 */
export const calculateStats = (jobs) => {
  if (!jobs || jobs.length === 0) {
    return {
      tvl: 0,
      successRate: 0,
      totalJobs: 0,
      pendingCount: 0,
      activeCount: 0,
      releasedCount: 0,
      disputedCount: 0,
      refundedCount: 0,
    };
  }

  const totalJobs = jobs.length;
  const lockedJobs = jobs.filter(j => j.status === 'locked' || j.status === 0 || j.status === 4);
  const releasedJobs = jobs.filter(j => j.status === 'released' || j.status === 2);
  const pendingJobs = jobs.filter(j => j.status === 'pending');
  const disputedJobs = jobs.filter(j => j.status === 'disputed' || j.status === 1);
  const refundedJobs = jobs.filter(j => j.status === 'refunded' || j.status === 3);

  // TVL: sum of budgets for all locked/active escrows (budget is in microcredits)
  const tvl = lockedJobs.reduce((acc, job) => {
    const budget = typeof job.budget === 'number' ? job.budget : parseInt(job.budget) || 0;
    return acc + budget;
  }, 0);

  const completedCount = releasedJobs.length + refundedJobs.length;
  const successRate = completedCount > 0
    ? Math.round((releasedJobs.length / completedCount) * 100)
    : 0;

  return {
    tvl,
    tvlFormatted: (tvl / 1_000_000).toFixed(6),
    successRate,
    totalJobs,
    pendingCount: pendingJobs.length,
    activeCount: lockedJobs.length,
    releasedCount: releasedJobs.length,
    disputedCount: disputedJobs.length,
    refundedCount: refundedJobs.length,
  };
};
