export class DataRetentionService {
  constructor({ jobRepository, rawRecordRepository, logger, clock, jobRetentionMs, rawRecordRetentionMs }) {
    this.jobRepository = jobRepository;
    this.rawRecordRepository = rawRecordRepository;
    this.logger = logger;
    this.clock = clock;
    this.jobRetentionMs = jobRetentionMs;
    this.rawRecordRetentionMs = rawRecordRetentionMs;
  }

  async purgeExpired() {
    const now = this.clock().getTime();
    const jobCutoff = new Date(now - this.jobRetentionMs).toISOString();
    const rawCutoff = new Date(now - this.rawRecordRetentionMs).toISOString();

    const jobsRemoved = await this.jobRepository.deleteOlderThan(jobCutoff);
    const rawRemoved = await this.rawRecordRepository.deleteOlderThan(rawCutoff);

    if (jobsRemoved > 0 || rawRemoved > 0) {
      this.logger.info("Data retention purge completed", {
        jobsRemoved,
        rawRecordsRemoved: rawRemoved,
        jobCutoff,
        rawRecordCutoff: rawCutoff,
      });
    }

    return { jobsRemoved, rawRecordsRemoved: rawRemoved };
  }
}
