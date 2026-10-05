# Multi-Project Registry

Each project receives an immutable `project_id`, Product Goal, target-user list,
budget and isolated state directory. Runtime stores, evidence, usage and
delivery artifacts must be scoped by this definition. A missing project ID is a
hard error; cross-project memory access is not a supported fallback.
