# Brief Scheduler State Persistence

The scheduler's last-sent markers are stored as CompanyStateStore checkpoints
under `scheduler:brief:daily` and `scheduler:brief:weekly`. The Chief of Staff
actor owns these operational checkpoints. A marker is written only after the
send callback succeeds, so a failed delivery remains retryable.
