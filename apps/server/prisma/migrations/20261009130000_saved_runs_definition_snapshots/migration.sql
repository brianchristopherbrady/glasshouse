-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN "definitionsCapturedAt" DATETIME;
ALTER TABLE "WorkflowRun" ADD COLUMN "savedAt" DATETIME;
ALTER TABLE "WorkflowRun" ADD COLUMN "savedLabel" TEXT;

-- CreateTable
CREATE TABLE "DefinitionBlob" (
    "sha256" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "RunDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    CONSTRAINT "RunDefinition_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RunDefinition_sha256_fkey" FOREIGN KEY ("sha256") REFERENCES "DefinitionBlob" ("sha256") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RunDefinition_runId_path_key" ON "RunDefinition"("runId", "path");
