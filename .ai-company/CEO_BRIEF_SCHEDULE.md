# CEO Brief Schedule

The default schedule is daily and weekly at 08:00 UTC. The scheduler is
idempotent per UTC day/week and never sends raw logs. A failed send must not
mark the period as sent; the caller may retry on the next tick and must record
the outcome in the delivery ledger.
