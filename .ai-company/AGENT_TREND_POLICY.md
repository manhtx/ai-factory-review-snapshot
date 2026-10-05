# Agent Trend Policy

CEO decisions use recent evaluation history, not a single run. The default
window is the latest 10 evaluations per agent. Average score below 0.5 or
failure rate at/above 50% quarantines an agent; scores from 0.5 to 0.79 require
coaching; scores at/above 0.8 retain the agent. Project filtering must happen
before trend calculation.
