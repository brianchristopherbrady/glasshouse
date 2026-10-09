-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "promptDefinitionId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_promptDefinitionId_fkey" FOREIGN KEY ("promptDefinitionId") REFERENCES "PromptDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
