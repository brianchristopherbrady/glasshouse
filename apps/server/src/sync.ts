import { discoverRepository } from '@agentic-flows/parser';
import type { PrismaClient } from '@prisma/client';

function j(value: unknown): string {
  return JSON.stringify(value);
}

/**
 * Discovers static agentic-workflow artifacts from a repository checkout on
 * disk and persists them into the given repository's rows. Idempotent:
 * upserts by (repositoryId, path) so re-running against an unchanged repo
 * produces no duplicate rows, and relationships are fully replaced each run
 * (they're cheap to regenerate and have no independent identity worth
 * preserving across syncs).
 */
export async function syncRepositoryFromDisk(
  prisma: PrismaClient,
  repositoryId: string,
  checkoutDir: string,
): Promise<{
  workflows: number;
  agents: number;
  skills: number;
  instructions: number;
  prompts: number;
  hooks: number;
  mcpServers: number;
  relationships: number;
}> {
  const discovered = discoverRepository(checkoutDir);

  // Definition-id lookup by path, populated as each kind is upserted, so
  // relationships (which only know paths) can be translated to real ids.
  const idByPath = new Map<string, string>();

  for (const workflow of discovered.workflows) {
    const record = await prisma.workflowDefinition.upsert({
      where: { repositoryId_path: { repositoryId, path: workflow.path } },
      create: {
        repositoryId,
        path: workflow.path,
        name: workflow.name,
        frontmatter: j(workflow.frontmatter),
        body: workflow.body,
        triggers: j(workflow.triggers),
        engine: workflow.engine,
        permissions: workflow.permissions ? j(workflow.permissions) : null,
        safeOutputs: workflow.safeOutputs ? j(workflow.safeOutputs) : null,
      },
      update: {
        name: workflow.name,
        frontmatter: j(workflow.frontmatter),
        body: workflow.body,
        triggers: j(workflow.triggers),
        engine: workflow.engine,
        permissions: workflow.permissions ? j(workflow.permissions) : null,
        safeOutputs: workflow.safeOutputs ? j(workflow.safeOutputs) : null,
      },
    });
    idByPath.set(workflow.path, record.id);

    if (workflow.compiled) {
      const compiledRecord = await prisma.compiledWorkflow.upsert({
        where: { workflowDefinitionId: record.id },
        create: {
          workflowDefinitionId: record.id,
          path: workflow.compiled.path,
          rawYaml: workflow.compiled.rawYaml,
        },
        update: { path: workflow.compiled.path, rawYaml: workflow.compiled.rawYaml },
      });
      idByPath.set(workflow.compiled.path, compiledRecord.id);
    }
  }

  for (const agent of discovered.agents) {
    const record = await prisma.agentDefinition.upsert({
      where: { repositoryId_path: { repositoryId, path: agent.path } },
      create: {
        repositoryId,
        path: agent.path,
        name: agent.name,
        frontmatter: j(agent.frontmatter),
        body: agent.body,
        tools: agent.tools ? j(agent.tools) : null,
        mcpServers: agent.mcpServers ? j(agent.mcpServers) : null,
        configuredSkills: agent.configuredSkills ? j(agent.configuredSkills) : null,
      },
      update: {
        name: agent.name,
        frontmatter: j(agent.frontmatter),
        body: agent.body,
        tools: agent.tools ? j(agent.tools) : null,
        mcpServers: agent.mcpServers ? j(agent.mcpServers) : null,
        configuredSkills: agent.configuredSkills ? j(agent.configuredSkills) : null,
      },
    });
    idByPath.set(agent.path, record.id);
  }

  for (const skill of discovered.skills) {
    const record = await prisma.skillDefinition.upsert({
      where: { repositoryId_path: { repositoryId, path: skill.path } },
      create: {
        repositoryId,
        path: skill.path,
        name: skill.name,
        description: skill.description,
        frontmatter: j(skill.frontmatter),
        body: skill.body,
        scripts: skill.scripts ? j(skill.scripts) : null,
        resources: skill.resources ? j(skill.resources) : null,
      },
      update: {
        name: skill.name,
        description: skill.description,
        frontmatter: j(skill.frontmatter),
        body: skill.body,
        scripts: skill.scripts ? j(skill.scripts) : null,
        resources: skill.resources ? j(skill.resources) : null,
      },
    });
    idByPath.set(skill.path, record.id);
  }

  for (const instruction of discovered.instructions) {
    const record = await prisma.instructionDefinition.upsert({
      where: { repositoryId_path: { repositoryId, path: instruction.path } },
      create: {
        repositoryId,
        path: instruction.path,
        kind: instruction.kind,
        applyTo: instruction.applyTo,
        body: instruction.body,
      },
      update: {
        kind: instruction.kind,
        applyTo: instruction.applyTo,
        body: instruction.body,
      },
    });
    idByPath.set(instruction.path, record.id);
  }

  for (const prompt of discovered.prompts) {
    const record = await prisma.promptDefinition.upsert({
      where: { repositoryId_path: { repositoryId, path: prompt.path } },
      create: {
        repositoryId,
        path: prompt.path,
        name: prompt.name,
        frontmatter: j(prompt.frontmatter),
        body: prompt.body,
      },
      update: { name: prompt.name, frontmatter: j(prompt.frontmatter), body: prompt.body },
    });
    idByPath.set(prompt.path, record.id);
  }

  for (const hook of discovered.hooks) {
    const record = await prisma.hookDefinition.upsert({
      where: { repositoryId_path: { repositoryId, path: hook.path } },
      create: { repositoryId, path: hook.path, rawJson: j(hook.rawJson) },
      update: { rawJson: j(hook.rawJson) },
    });
    idByPath.set(hook.path, record.id);
  }

  for (const server of discovered.mcpServers) {
    const record = await prisma.mcpServerDefinition.upsert({
      where: {
        repositoryId_path_name: { repositoryId, path: server.path, name: server.name },
      },
      create: {
        repositoryId,
        path: server.path,
        name: server.name,
        command: server.command,
        args: server.args ? j(server.args) : null,
        rawConfig: j(server.rawConfig),
      },
      update: {
        command: server.command,
        args: server.args ? j(server.args) : null,
        rawConfig: j(server.rawConfig),
      },
    });
    // Multiple servers can share one config file path; key relationships by
    // "path::name" so distinct servers at the same path don't collide.
    idByPath.set(`${server.path}::${server.name}`, record.id);
  }

  await prisma.definitionRelationship.deleteMany({ where: { repositoryId } });
  let relationshipCount = 0;
  for (const rel of discovered.relationships) {
    const sourceId = idByPath.get(rel.sourcePath);
    const targetId = idByPath.get(rel.targetPath);
    if (!sourceId || !targetId) continue; // unresolved reference; never fabricate an id

    await prisma.definitionRelationship.create({
      data: {
        repositoryId,
        sourceDefinitionId: sourceId,
        sourceKind: rel.sourceKind,
        targetDefinitionId: targetId,
        targetKind: rel.targetKind,
        relationshipType: rel.relationshipType,
        evidenceSource: rel.evidence.source,
        evidenceConfidence: rel.evidence.confidence,
        evidenceNote: rel.evidence.note,
      },
    });
    relationshipCount += 1;
  }

  return {
    workflows: discovered.workflows.length,
    agents: discovered.agents.length,
    skills: discovered.skills.length,
    instructions: discovered.instructions.length,
    prompts: discovered.prompts.length,
    hooks: discovered.hooks.length,
    mcpServers: discovered.mcpServers.length,
    relationships: relationshipCount,
  };
}
