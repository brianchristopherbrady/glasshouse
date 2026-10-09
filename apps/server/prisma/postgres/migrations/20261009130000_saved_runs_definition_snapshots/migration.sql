-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "definitionsCapturedAt" TIMESTAMP(3),
ADD COLUMN     "savedAt" TIMESTAMP(3),
ADD COLUMN     "savedLabel" TEXT;

-- CreateTable
CREATE TABLE "DefinitionBlob" (
    "sha256" TEXT NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "DefinitionBlob_pkey" PRIMARY KEY ("sha256")
);

-- CreateTable
CREATE TABLE "RunDefinition" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,

    CONSTRAINT "RunDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RunDefinition_runId_path_key" ON "RunDefinition"("runId", "path");

-- AddForeignKey
ALTER TABLE "RunDefinition" ADD CONSTRAINT "RunDefinition_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunDefinition" ADD CONSTRAINT "RunDefinition_sha256_fkey" FOREIGN KEY ("sha256") REFERENCES "DefinitionBlob"("sha256") ON DELETE RESTRICT ON UPDATE CASCADE;
