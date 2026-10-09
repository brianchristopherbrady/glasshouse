-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WorkflowRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT,
    "promptDefinitionId" TEXT,
    "workflowName" TEXT NOT NULL,
    "providerRunId" TEXT,
    "runAttempt" INTEGER NOT NULL DEFAULT 1,
    "trigger" TEXT NOT NULL,
    "branch" TEXT,
    "commitSha" TEXT,
    "pullRequestNumber" INTEGER,
    "status" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMs" INTEGER,
    "engine" TEXT,
    CONSTRAINT "WorkflowRun_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkflowRun_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "WorkflowRun_promptDefinitionId_fkey" FOREIGN KEY ("promptDefinitionId") REFERENCES "PromptDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WorkflowRun" ("branch", "commitSha", "durationMs", "endTime", "engine", "id", "providerRunId", "pullRequestNumber", "repositoryId", "runAttempt", "startTime", "status", "trigger", "workflowDefinitionId", "workflowName") SELECT "branch", "commitSha", "durationMs", "endTime", "engine", "id", "providerRunId", "pullRequestNumber", "repositoryId", "runAttempt", "startTime", "status", "trigger", "workflowDefinitionId", "workflowName" FROM "WorkflowRun";
DROP TABLE "WorkflowRun";
ALTER TABLE "new_WorkflowRun" RENAME TO "WorkflowRun";
CREATE INDEX "WorkflowRun_repositoryId_idx" ON "WorkflowRun"("repositoryId");
CREATE UNIQUE INDEX "WorkflowRun_repositoryId_providerRunId_key" ON "WorkflowRun"("repositoryId", "providerRunId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
