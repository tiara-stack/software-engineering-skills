# Share review quota pools across coordinator runs

The coordinator tracks local and hosted reviewer quotas in separate pools keyed by reviewer service and account. Local capacity is reserved only during local review passes; hosted capacity is reserved from the project's hosted-review trigger, usually undraft, through merge-label admission, including local repair passes during that hosted cycle. Reservation and cooldown state is shared across resumed or concurrent coordinator runs so they do not independently spend the same rolling-window quota.
