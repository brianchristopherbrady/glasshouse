-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "providerRepoId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WorkflowDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frontmatter" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "triggers" TEXT NOT NULL,
    "engine" TEXT,
    "permissions" TEXT,
    "safeOutputs" TEXT,
    "compiledWorkflowId" TEXT,
    CONSTRAINT "WorkflowDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompiledWorkflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workflowDefinitionId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "rawYaml" TEXT NOT NULL,
    CONSTRAINT "CompiledWorkflow_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frontmatter" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tools" TEXT,
    "mcpServers" TEXT,
    "configuredSkills" TEXT,
    CONSTRAINT "AgentDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frontmatter" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "scripts" TEXT,
    "resources" TEXT,
    CONSTRAINT "SkillDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstructionDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "applyTo" TEXT,
    "body" TEXT NOT NULL,
    CONSTRAINT "InstructionDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromptDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frontmatter" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    CONSTRAINT "PromptDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HookDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "rawJson" TEXT NOT NULL,
    CONSTRAINT "HookDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "McpServerDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "command" TEXT,
    "args" TEXT,
    "rawConfig" TEXT NOT NULL,
    CONSTRAINT "McpServerDefinition_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DefinitionRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceDefinitionId" TEXT NOT NULL,
    "sourceKind" TEXT NOT NULL,
    "targetDefinitionId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "evidenceConfidence" TEXT NOT NULL,
    "evidenceNote" TEXT
);

-- CreateTable
CREATE TABLE "WorkflowRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "workflowDefinitionId" TEXT,
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
    CONSTRAINT "WorkflowRun_workflowDefinitionId_fkey" FOREIGN KEY ("workflowDefinitionId") REFERENCES "WorkflowDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Span" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "parentSpanId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actorId" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationMs" INTEGER,
    "status" TEXT NOT NULL,
    "attributes" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    CONSTRAINT "Span_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "spanId" TEXT,
    "parentSpanId" TEXT,
    "timestamp" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "data" TEXT NOT NULL,
    "evidenceSource" TEXT NOT NULL,
    "evidenceConfidence" TEXT NOT NULL,
    "evidenceNote" TEXT,
    CONSTRAINT "Event_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_spanId_fkey" FOREIGN KEY ("spanId") REFERENCES "Span" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "agentDefinitionId" TEXT,
    "name" TEXT NOT NULL,
    "parentAgentRunId" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "status" TEXT NOT NULL,
    CONSTRAINT "AgentRun_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentRun_agentDefinitionId_fkey" FOREIGN KEY ("agentDefinitionId") REFERENCES "AgentDefinition" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentHandoff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromAgentRunId" TEXT NOT NULL,
    "toAgentRunId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "reason" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "evidenceSource" TEXT NOT NULL,
    "evidenceConfidence" TEXT NOT NULL,
    CONSTRAINT "AgentHandoff_fromAgentRunId_fkey" FOREIGN KEY ("fromAgentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgentHandoff_toAgentRunId_fkey" FOREIGN KEY ("toAgentRunId") REFERENCES "AgentRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SkillUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "skillDefinitionId" TEXT NOT NULL,
    "agentRunId" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL,
    "configured" BOOLEAN NOT NULL,
    "loaded" TEXT NOT NULL,
    "referenced" TEXT NOT NULL,
    "executionEvidence" TEXT NOT NULL,
    "evidence" TEXT NOT NULL,
    CONSTRAINT "SkillUsage_skillDefinitionId_fkey" FOREIGN KEY ("skillDefinitionId") REFERENCES "SkillDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ToolInvocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "category" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "argumentsPreview" TEXT,
    "resultPreview" TEXT,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER,
    CONSTRAINT "ToolInvocation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FileOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "spanId" TEXT,
    "path" TEXT NOT NULL,
    "previousPath" TEXT,
    "operation" TEXT NOT NULL,
    "additions" INTEGER,
    "deletions" INTEGER,
    "beforeSha" TEXT,
    "afterSha" TEXT,
    "diff" TEXT,
    "actorId" TEXT,
    "evidenceSource" TEXT NOT NULL,
    "evidenceConfidence" TEXT NOT NULL,
    CONSTRAINT "FileOperation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Commit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authoredAt" DATETIME NOT NULL,
    CONSTRAINT "Commit_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PullRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "PullRequest_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IssueOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    CONSTRAINT "IssueOperation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckOperation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detailsUrl" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    CONSTRAINT "CheckOperation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelInvocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensInput" INTEGER,
    "tokensOutput" INTEGER,
    "costUsd" REAL,
    "durationMs" INTEGER,
    CONSTRAINT "ModelInvocation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "url" TEXT,
    CONSTRAINT "Artifact_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LogRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "spanId" TEXT,
    "source" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    CONSTRAINT "LogRecord_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DriftFinding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "expected" TEXT,
    "observed" TEXT,
    CONSTRAINT "DriftFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_compiledWorkflowId_key" ON "WorkflowDefinition"("compiledWorkflowId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowDefinition_repositoryId_path_key" ON "WorkflowDefinition"("repositoryId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "CompiledWorkflow_workflowDefinitionId_key" ON "CompiledWorkflow"("workflowDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentDefinition_repositoryId_path_key" ON "AgentDefinition"("repositoryId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "SkillDefinition_repositoryId_path_key" ON "SkillDefinition"("repositoryId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "InstructionDefinition_repositoryId_path_key" ON "InstructionDefinition"("repositoryId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "PromptDefinition_repositoryId_path_key" ON "PromptDefinition"("repositoryId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "HookDefinition_repositoryId_path_key" ON "HookDefinition"("repositoryId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "McpServerDefinition_repositoryId_path_key" ON "McpServerDefinition"("repositoryId", "path");

-- CreateIndex
CREATE INDEX "DefinitionRelationship_sourceDefinitionId_idx" ON "DefinitionRelationship"("sourceDefinitionId");

-- CreateIndex
CREATE INDEX "DefinitionRelationship_targetDefinitionId_idx" ON "DefinitionRelationship"("targetDefinitionId");

-- CreateIndex
CREATE INDEX "WorkflowRun_repositoryId_idx" ON "WorkflowRun"("repositoryId");

-- CreateIndex
CREATE INDEX "Span_runId_idx" ON "Span"("runId");

-- CreateIndex
CREATE INDEX "Span_parentSpanId_idx" ON "Span"("parentSpanId");

-- CreateIndex
CREATE INDEX "Event_runId_idx" ON "Event"("runId");

-- CreateIndex
CREATE INDEX "Event_spanId_idx" ON "Event"("spanId");

-- CreateIndex
CREATE INDEX "AgentRun_runId_idx" ON "AgentRun"("runId");

-- CreateIndex
CREATE INDEX "SkillUsage_agentRunId_idx" ON "SkillUsage"("agentRunId");

-- CreateIndex
CREATE INDEX "ToolInvocation_runId_idx" ON "ToolInvocation"("runId");

-- CreateIndex
CREATE INDEX "FileOperation_runId_idx" ON "FileOperation"("runId");

-- CreateIndex
CREATE INDEX "FileOperation_path_idx" ON "FileOperation"("path");

-- CreateIndex
CREATE INDEX "Commit_runId_idx" ON "Commit"("runId");

-- CreateIndex
CREATE INDEX "PullRequest_runId_idx" ON "PullRequest"("runId");

-- CreateIndex
CREATE INDEX "IssueOperation_runId_idx" ON "IssueOperation"("runId");

-- CreateIndex
CREATE INDEX "CheckOperation_runId_idx" ON "CheckOperation"("runId");

-- CreateIndex
CREATE INDEX "ModelInvocation_runId_idx" ON "ModelInvocation"("runId");

-- CreateIndex
CREATE INDEX "Artifact_runId_idx" ON "Artifact"("runId");

-- CreateIndex
CREATE INDEX "LogRecord_runId_idx" ON "LogRecord"("runId");

-- CreateIndex
CREATE INDEX "DriftFinding_runId_idx" ON "DriftFinding"("runId");
