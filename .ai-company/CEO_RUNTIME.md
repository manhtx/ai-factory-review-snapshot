# CEO Brief Runtime

`startCeoBriefRuntime` is the lifecycle composition helper. It is disabled by
default, starts only with explicit Telegram configuration, ticks at a bounded
interval, and exposes `stop()` for graceful shutdown. The timer is unref'd so
it cannot keep a process alive during tests or shutdown.
