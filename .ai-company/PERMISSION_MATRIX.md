# Permission Matrix v1

| Capability | Worker | PM | CEO | Auditor | Chairman |
|---|---:|---:|---:|---:|---:|
| Read project artifacts | scoped | yes | yes | yes | summary |
| Create proposal | yes | yes | yes | no | yes |
| Modify backlog | no | yes | priority only | no | strategic directive |
| Modify implementation | scoped sandbox | no | no | no | no |
| Approve implementation | no | no | no | recommend | high-risk only |
| Release production | no | no | delegated gate | certify | high-risk approve |
| Change Product Goal | no | propose | propose | review | yes |
| Change permissions | no | no | propose | review | strategic approve |
| Read secrets | never | never | never | never | never |
| Execute arbitrary shell | never | never | never | never | never |

The policy engine must deny by default when a role, project, action, or risk
class is missing.
