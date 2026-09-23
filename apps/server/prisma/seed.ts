/**
 * Seeds realistic demo data for the acme/payments repository so the app is
 * useful without any GitHub token. Everything here goes through the same
 * Prisma models the live GitHub-backed ingestion path would populate —
 * there is no separate "demo mode" domain model.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function minutesAgo(base: Date, minutes: number): Date {
  return new Date(base.getTime() - minutes * 60_000);
}

function plusMs(date: Date, ms: number): Date {
  return new Date(date.getTime() + ms);
}

/** SQLite has no native Json column type; store JSON-serialized text instead. */
function j(value: unknown): string {
  return JSON.stringify(value);
}

async function main(): Promise<void> {
  console.log('Clearing existing data...');
  await prisma.driftFinding.deleteMany();
  await prisma.logRecord.deleteMany();
  await prisma.artifact.deleteMany();
  await prisma.modelInvocation.deleteMany();
  await prisma.checkOperation.deleteMany();
  await prisma.issueOperation.deleteMany();
  await prisma.pullRequest.deleteMany();
  await prisma.commit.deleteMany();
  await prisma.fileOperation.deleteMany();
  await prisma.toolInvocation.deleteMany();
  await prisma.skillUsage.deleteMany();
  await prisma.agentHandoff.deleteMany();
  await prisma.agentRun.deleteMany();
  await prisma.event.deleteMany();
  await prisma.span.deleteMany();
  await prisma.workflowRun.deleteMany();
  await prisma.definitionRelationship.deleteMany();
  await prisma.mcpServerDefinition.deleteMany();
  await prisma.hookDefinition.deleteMany();
  await prisma.promptDefinition.deleteMany();
  await prisma.instructionDefinition.deleteMany();
  await prisma.skillDefinition.deleteMany();
  await prisma.agentDefinition.deleteMany();
  await prisma.compiledWorkflow.deleteMany();
  await prisma.workflowDefinition.deleteMany();
  await prisma.repository.deleteMany();

  console.log('Creating repository...');
  const repo = await prisma.repository.create({
    data: {
      owner: 'acme',
      name: 'payments',
      fullName: 'acme/payments',
      defaultBranch: 'main',
      provider: 'github',
      providerRepoId: '918273645',
    },
  });

  // ---------------------------------------------------------------------
  // Static definitions
  // ---------------------------------------------------------------------
  console.log('Creating workflow/agent/skill definitions...');

  const triageWorkflow = await prisma.workflowDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/workflows/issue-triage.md',
      name: 'Issue Triage',
      frontmatter: j({ on: 'issues', engine: 'copilot', permissions: { issues: 'write' } }),
      body: 'Triage newly opened issues, classify severity, and route security-relevant ones to the security reviewer.',
      triggers: j(['issues.opened']),
      engine: 'copilot',
      permissions: j({ issues: 'write', contents: 'read' }),
      safeOutputs: j(['add-comment', 'add-labels']),
    },
  });
  await prisma.compiledWorkflow.create({
    data: {
      workflowDefinitionId: triageWorkflow.id,
      path: '.github/workflows/issue-triage.lock.yml',
      rawYaml: 'name: Issue Triage\non:\n  issues:\n    types: [opened]\njobs:\n  triage:\n    runs-on: ubuntu-latest\n',
    },
  });

  const dependencyWorkflow = await prisma.workflowDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/workflows/dependency-audit.md',
      name: 'Dependency Audit',
      frontmatter: j({ on: 'schedule', engine: 'claude', permissions: { contents: 'write' } }),
      body: 'Run a scheduled dependency audit, flag vulnerable packages, and open a PR with safe upgrades.',
      triggers: j(['schedule.weekly']),
      engine: 'claude',
      permissions: j({ contents: 'write', 'pull-requests': 'write' }),
      safeOutputs: j(['create-pull-request']),
    },
  });
  await prisma.compiledWorkflow.create({
    data: {
      workflowDefinitionId: dependencyWorkflow.id,
      path: '.github/workflows/dependency-audit.lock.yml',
      rawYaml: 'name: Dependency Audit\non:\n  schedule:\n    - cron: "0 6 * * 1"\njobs:\n  audit:\n    runs-on: ubuntu-latest\n',
    },
  });

  const docsWorkflow = await prisma.workflowDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/workflows/documentation-sync.md',
      name: 'Documentation Sync',
      frontmatter: j({ on: 'push', engine: 'codex', permissions: { contents: 'write' } }),
      body: 'Keep README and API docs in sync with source changes on push to main.',
      triggers: j(['push.main']),
      engine: 'codex',
      permissions: j({ contents: 'write', 'pull-requests': 'write' }),
      safeOutputs: j(['create-pull-request']),
    },
  });
  await prisma.compiledWorkflow.create({
    data: {
      workflowDefinitionId: docsWorkflow.id,
      path: '.github/workflows/documentation-sync.lock.yml',
      rawYaml: 'name: Documentation Sync\non:\n  push:\n    branches: [main]\njobs:\n  sync:\n    runs-on: ubuntu-latest\n',
    },
  });

  const triageAgent = await prisma.agentDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/agents/triage-agent.md',
      name: 'triage-agent',
      frontmatter: j({ tools: ['github', 'search'], skills: ['issue-analysis'] }),
      body: 'Classifies incoming issues by severity and area, and hands off security-relevant issues.',
      tools: j(['github', 'search']),
      mcpServers: j([]),
      configuredSkills: j(['issue-analysis']),
    },
  });
  const securityAgent = await prisma.agentDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/agents/security-reviewer.md',
      name: 'security-reviewer',
      frontmatter: j({ tools: ['shell', 'github'], skills: ['security-scan'] }),
      body: 'Runs security scans against the affected area and reports findings.',
      tools: j(['shell', 'github']),
      mcpServers: j([]),
      configuredSkills: j(['security-scan']),
    },
  });
  const dependencyAgent = await prisma.agentDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/agents/dependency-agent.md',
      name: 'dependency-agent',
      frontmatter: j({ tools: ['shell', 'github'], skills: ['dependency-check'] }),
      body: 'Audits package manifests for vulnerable or outdated dependencies.',
      tools: j(['shell', 'github']),
      mcpServers: j([]),
      configuredSkills: j(['dependency-check']),
    },
  });
  const docsAgent = await prisma.agentDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/agents/docs-writer.md',
      name: 'docs-writer',
      frontmatter: j({ tools: ['filesystem', 'github'], skills: ['documentation'] }),
      body: 'Updates documentation files to reflect recent source changes.',
      tools: j(['filesystem', 'github']),
      mcpServers: j([]),
      configuredSkills: j(['documentation']),
    },
  });

  const skillDefs = await Promise.all(
    [
      {
        path: '.github/skills/issue-analysis/SKILL.md',
        name: 'issue-analysis',
        description: 'Classifies issue severity and routes to the correct owning agent.',
      },
      {
        path: '.github/skills/security-scan/SKILL.md',
        name: 'security-scan',
        description: 'Runs static and dependency security scans.',
      },
      {
        path: '.github/skills/dependency-check/SKILL.md',
        name: 'dependency-check',
        description: 'Checks package manifests against known vulnerability databases.',
      },
      {
        path: '.github/skills/documentation/SKILL.md',
        name: 'documentation',
        description: 'Guides documentation updates to match source-of-truth code.',
      },
    ].map((s) =>
      prisma.skillDefinition.create({
        data: {
          repositoryId: repo.id,
          path: s.path,
          name: s.name,
          description: s.description,
          frontmatter: j({}),
          body: `# ${s.name}\n\n${s.description}`,
        },
      }),
    ),
  );
  const [issueAnalysisSkill, securityScanSkill, dependencyCheckSkill, documentationSkill] = skillDefs;
  if (!issueAnalysisSkill || !securityScanSkill || !dependencyCheckSkill || !documentationSkill) {
    throw new Error('skill definitions failed to seed');
  }

  await prisma.instructionDefinition.create({
    data: {
      repositoryId: repo.id,
      path: '.github/copilot-instructions.md',
      kind: 'copilot-instructions',
      body: 'This is a payments service. Never log full card numbers. Prefer small, reviewable diffs.',
    },
  });

  // ---------------------------------------------------------------------
  // Helper to build one run with its span tree + related records.
  // ---------------------------------------------------------------------
  type SpanSeed = {
    id?: string;
    parentId: string | null;
    type: string;
    name: string;
    actorId?: string | null;
    startOffsetMs: number;
    durationMs: number;
    status: 'success' | 'failure' | 'running';
    attributes?: Record<string, unknown>;
    source?: string;
    confidence?: string;
  };

  async function createRunWithSpans(opts: {
    workflowDefinitionId: string;
    workflowName: string;
    trigger: string;
    branch: string;
    commitSha: string;
    status: 'success' | 'failure';
    startedMinutesAgo: number;
    totalDurationMs: number;
    engine: string;
    spans: SpanSeed[];
  }): Promise<{ runId: string; spanIdByKey: Map<string, string> }> {
    const startTime = minutesAgo(new Date(), opts.startedMinutesAgo);
    const endTime = plusMs(startTime, opts.totalDurationMs);
    const run = await prisma.workflowRun.create({
      data: {
        repositoryId: repo.id,
        workflowDefinitionId: opts.workflowDefinitionId,
        workflowName: opts.workflowName,
        trigger: opts.trigger,
        branch: opts.branch,
        commitSha: opts.commitSha,
        status: opts.status,
        startTime,
        endTime,
        durationMs: opts.totalDurationMs,
        engine: opts.engine,
      },
    });

    // s.parentId is an alias key (e.g. "root"), resolved here to the real
    // DB id of the already-created parent span — spans must be listed
    // parent-before-child in the seed data for this lookup to succeed.
    const spanIdByKey = new Map<string, string>();
    for (const s of opts.spans) {
      const spanStart = plusMs(startTime, s.startOffsetMs);
      const spanEnd = plusMs(spanStart, s.durationMs);
      const resolvedParentId = s.parentId ? (spanIdByKey.get(s.parentId) ?? null) : null;
      const created = await prisma.span.create({
        data: {
          runId: run.id,
          parentSpanId: resolvedParentId,
          type: s.type,
          name: s.name,
          actorId: s.actorId ?? null,
          startTime: spanStart,
          endTime: spanEnd,
          durationMs: s.durationMs,
          status: s.status,
          attributes: j(s.attributes ?? {}),
          source: s.source ?? 'runtime',
          confidence: s.confidence ?? 'observed',
        },
      });
      if (s.id) spanIdByKey.set(s.id, created.id);
    }

    return { runId: run.id, spanIdByKey };
  }

  console.log('Seeding runs...');

  // 1. Issue Triage — successful, single agent.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: triageWorkflow.id,
      workflowName: 'Issue Triage',
      trigger: 'issue',
      branch: 'main',
      commitSha: 'a1b2c3d',
      status: 'success',
      startedMinutesAgo: 60,
      totalDurationMs: 12_400,
      engine: 'copilot',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Issue Triage', startOffsetMs: 0, durationMs: 12_400, status: 'success' },
        { id: 'job', parentId: 'root', type: 'job', name: 'triage', startOffsetMs: 100, durationMs: 12_000, status: 'success' },
        { id: 'agent', parentId: 'job', type: 'agent', name: 'triage-agent', actorId: triageAgent.id, startOffsetMs: 300, durationMs: 11_000, status: 'success' },
        { id: 'skill', parentId: 'agent', type: 'skill', name: 'issue-analysis', startOffsetMs: 500, durationMs: 900, status: 'success' },
        { id: 'model', parentId: 'agent', type: 'model', name: 'gpt-4.1', startOffsetMs: 1500, durationMs: 3200, status: 'success' },
        { id: 'gh', parentId: 'agent', type: 'github', name: 'add-labels', startOffsetMs: 5000, durationMs: 600, status: 'success' },
      ],
    }).then((r) => r);

    const spanIdByKeyResolved = spanIdByKey;
    const agentRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKeyResolved.get('agent')!,
        agentDefinitionId: triageAgent.id,
        name: 'triage-agent',
        startTime: minutesAgo(new Date(), 60),
        endTime: minutesAgo(new Date(), 60 - 11000 / 60000),
        status: 'success',
      },
    });
    await prisma.skillUsage.create({
      data: {
        skillDefinitionId: issueAnalysisSkill.id,
        agentRunId: agentRun.id,
        available: true,
        configured: true,
        loaded: 'true',
        referenced: 'true',
        executionEvidence: 'true',
        evidence: j([{ source: 'runtime', confidence: 'observed' }]),

      },
    });
    await prisma.toolInvocation.create({
      data: {
        runId,
        spanId: spanIdByKeyResolved.get('gh')!,
        agentRunId: agentRun.id,
        category: 'github',
        toolName: 'add-labels',
        argumentsPreview: '{"labels":["bug","priority-2"]}',
        resultPreview: '{"ok":true}',
        status: 'success',
        durationMs: 600,
      },
    });
    await prisma.modelInvocation.create({
      data: {
        runId,
        spanId: spanIdByKeyResolved.get('model')!,
        model: 'gpt-4.1',
        tokensInput: 1820,
        tokensOutput: 340,
        costUsd: 0.021,
        durationMs: 3200,
      },
    });
    await prisma.issueOperation.create({
      data: {
        runId,
        action: 'updated',
        number: 482,
        title: 'Refund webhook occasionally double-fires',
        url: 'https://github.com/acme/payments/issues/482',
        timestamp: minutesAgo(new Date(), 59),
      },
    });
  }

  // 2. Issue Triage — failed run (tool failure, no retry).
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: triageWorkflow.id,
      workflowName: 'Issue Triage',
      trigger: 'issue',
      branch: 'main',
      commitSha: 'b2c3d4e',
      status: 'failure',
      startedMinutesAgo: 340,
      totalDurationMs: 8_100,
      engine: 'copilot',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Issue Triage', startOffsetMs: 0, durationMs: 8_100, status: 'failure' },
        { id: 'job', parentId: 'root', type: 'job', name: 'triage', startOffsetMs: 100, durationMs: 7_900, status: 'failure' },
        { id: 'agent', parentId: 'job', type: 'agent', name: 'triage-agent', actorId: triageAgent.id, startOffsetMs: 300, durationMs: 7_500, status: 'failure' },
        { id: 'gh', parentId: 'agent', type: 'github', name: 'add-labels', startOffsetMs: 6_000, durationMs: 1_200, status: 'failure' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('agent')!,
        agentDefinitionId: triageAgent.id,
        name: 'triage-agent',
        startTime: minutesAgo(new Date(), 340),
        endTime: minutesAgo(new Date(), 340 - 7500 / 60000),
        status: 'failure',
      },
    });
    await prisma.toolInvocation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('gh')!,
        category: 'github',
        toolName: 'add-labels',
        argumentsPreview: '{"labels":["needs-triage"]}',
        resultPreview: '{"error":"403 Resource not accessible by integration"}',
        status: 'failure',
        durationMs: 1200,
      },
    });
    await prisma.logRecord.create({
      data: {
        runId,
        spanId: spanIdByKey.get('gh')!,
        source: 'actions',
        timestamp: minutesAgo(new Date(), 340 - 6100 / 60000),
        level: 'error',
        message: 'HttpError: 403 Resource not accessible by integration',
      },
    });
  }

  // 3. Issue Triage — multi-agent handoff to security-reviewer.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: triageWorkflow.id,
      workflowName: 'Issue Triage',
      trigger: 'issue',
      branch: 'main',
      commitSha: 'c3d4e5f',
      status: 'success',
      startedMinutesAgo: 500,
      totalDurationMs: 48_200,
      engine: 'copilot',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Issue Triage', startOffsetMs: 0, durationMs: 48_200, status: 'success' },
        { id: 'job', parentId: 'root', type: 'job', name: 'triage', startOffsetMs: 100, durationMs: 45_100, status: 'success' },
        { id: 'triage', parentId: 'job', type: 'agent', name: 'triage-agent', actorId: triageAgent.id, startOffsetMs: 300, durationMs: 41_300, status: 'success' },
        { id: 'model1', parentId: 'triage', type: 'model', name: 'gpt-4.1', startOffsetMs: 500, durationMs: 4200, status: 'success' },
        { id: 'skill1', parentId: 'triage', type: 'skill', name: 'issue-analysis', startOffsetMs: 4800, durationMs: 1100, status: 'success' },
        { id: 'ghread', parentId: 'triage', type: 'github', name: 'read-issue', startOffsetMs: 6000, durationMs: 800, status: 'success' },
        { id: 'security', parentId: 'triage', type: 'subagent', name: 'security-reviewer', actorId: securityAgent.id, startOffsetMs: 12_000, durationMs: 17_900, status: 'success' },
        { id: 'shell', parentId: 'security', type: 'shell', name: 'npm audit', startOffsetMs: 12_500, durationMs: 9200, status: 'success' },
        { id: 'skill2', parentId: 'security', type: 'skill', name: 'security-scan', startOffsetMs: 12_600, durationMs: 1100, status: 'success' },
        { id: 'fileedit', parentId: 'security', type: 'file', name: 'src/auth/token.ts', startOffsetMs: 22_000, durationMs: 2400, status: 'success' },
        { id: 'test', parentId: 'triage', type: 'test', name: 'npm test', startOffsetMs: 32_000, durationMs: 5300, status: 'success' },
        { id: 'pr', parentId: 'root', type: 'github', name: 'open-pr', startOffsetMs: 45_100, durationMs: 3100, status: 'success' },
      ],
    });

    const triageRunAgent = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('triage')!,
        agentDefinitionId: triageAgent.id,
        name: 'triage-agent',
        startTime: minutesAgo(new Date(), 500),
        endTime: minutesAgo(new Date(), 500 - 41300 / 60000),
        status: 'success',
      },
    });
    const securityRunAgent = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('security')!,
        agentDefinitionId: securityAgent.id,
        name: 'security-reviewer',
        parentAgentRunId: triageRunAgent.id,
        startTime: minutesAgo(new Date(), 500 - 12000 / 60000),
        endTime: minutesAgo(new Date(), 500 - 29900 / 60000),
        status: 'success',
      },
    });
    await prisma.agentHandoff.create({
      data: {
        fromAgentRunId: triageRunAgent.id,
        toAgentRunId: securityRunAgent.id,
        timestamp: minutesAgo(new Date(), 500 - 12000 / 60000),
        reason: 'Issue mentions authentication token handling; routing to security review.',
        inputSummary: 'Issue #501: token refresh sometimes returns a stale JWT after rotation.',
        outputSummary: 'Confirmed a real staleness window in token cache; patched src/auth/token.ts.',
        evidenceSource: 'runtime',
        evidenceConfidence: 'observed',
      },
    });
    await prisma.skillUsage.createMany({
      data: [
        {
          skillDefinitionId: issueAnalysisSkill.id,
          agentRunId: triageRunAgent.id,
          available: true,
          configured: true,
          loaded: 'true',
          referenced: 'true',
          executionEvidence: 'true',
          evidence: j([{ source: 'runtime', confidence: 'observed' }]),

        },
        {
          skillDefinitionId: securityScanSkill.id,
          agentRunId: securityRunAgent.id,
          available: true,
          configured: true,
          loaded: 'true',
          referenced: 'true',
          executionEvidence: 'true',
          evidence: j([{ source: 'runtime', confidence: 'observed' }]),

        },
      ],
    });
    await prisma.toolInvocation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('shell')!,
        agentRunId: securityRunAgent.id,
        category: 'shell',
        toolName: 'npm audit',
        argumentsPreview: '{"cwd":"."}',
        resultPreview: '3 moderate severity vulnerabilities found in transitive deps',
        status: 'success',
        durationMs: 9200,
      },
    });
    await prisma.modelInvocation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('model1')!,
        model: 'gpt-4.1',
        tokensInput: 2200,
        tokensOutput: 410,
        costUsd: 0.025,
        durationMs: 4200,
      },
    });
    await prisma.fileOperation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('fileedit')!,
        path: 'src/auth/token.ts',
        operation: 'modified',
        additions: 12,
        deletions: 3,
        beforeSha: 'a1b2c3d',
        afterSha: 'c3d4e5f',
        diff: '@@ -40,7 +40,16 @@\n-  return cache.get(userId);\n+  const cached = cache.get(userId);\n+  if (cached && !isExpired(cached)) return cached;\n+  return refreshToken(userId);',
        actorId: securityAgent.id,
        evidenceSource: 'git',
        evidenceConfidence: 'observed',
      },
    });
    await prisma.commit.create({
      data: {
        runId,
        sha: 'c3d4e5f',
        message: 'fix(auth): refresh stale cached token instead of returning it',
        authorName: 'security-reviewer[bot]',
        authoredAt: minutesAgo(new Date(), 500 - 24000 / 60000),
      },
    });
    await prisma.pullRequest.create({
      data: {
        runId,
        action: 'created',
        number: 933,
        title: 'fix(auth): refresh stale cached token instead of returning it',
        url: 'https://github.com/acme/payments/pull/933',
        timestamp: minutesAgo(new Date(), 500 - 45100 / 60000),
      },
    });
    await prisma.checkOperation.create({
      data: {
        runId,
        name: 'npm test',
        status: 'success',
        startTime: minutesAgo(new Date(), 500 - 32000 / 60000),
        endTime: minutesAgo(new Date(), 500 - 37300 / 60000),
      },
    });
  }

  // 4. Dependency Audit — parallel agents (dependency-agent + docs-writer overlap).
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: dependencyWorkflow.id,
      workflowName: 'Dependency Audit',
      trigger: 'schedule',
      branch: 'main',
      commitSha: 'd4e5f6a',
      status: 'success',
      startedMinutesAgo: 1000,
      totalDurationMs: 33_000,
      engine: 'claude',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Dependency Audit', startOffsetMs: 0, durationMs: 33_000, status: 'success' },
        { id: 'job', parentId: 'root', type: 'job', name: 'audit', startOffsetMs: 100, durationMs: 32_500, status: 'success' },
        { id: 'dep', parentId: 'job', type: 'agent', name: 'dependency-agent', actorId: dependencyAgent.id, startOffsetMs: 300, durationMs: 20_000, status: 'success' },
        { id: 'shell', parentId: 'dep', type: 'shell', name: 'npm outdated', startOffsetMs: 500, durationMs: 6000, status: 'success' },
        { id: 'skill', parentId: 'dep', type: 'skill', name: 'dependency-check', startOffsetMs: 6600, durationMs: 1400, status: 'success' },
        { id: 'docs', parentId: 'job', type: 'agent', name: 'docs-writer', actorId: docsAgent.id, startOffsetMs: 4000, durationMs: 22_000, status: 'success' },
        { id: 'docedit', parentId: 'docs', type: 'file', name: 'CHANGELOG.md', startOffsetMs: 20_000, durationMs: 1800, status: 'success' },
        { id: 'pr', parentId: 'root', type: 'github', name: 'open-pr', startOffsetMs: 30_000, durationMs: 2500, status: 'success' },
      ],
    });
    const depAgentRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('dep')!,
        agentDefinitionId: dependencyAgent.id,
        name: 'dependency-agent',
        startTime: minutesAgo(new Date(), 1000),
        endTime: minutesAgo(new Date(), 1000 - 20000 / 60000),
        status: 'success',
      },
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docs')!,
        agentDefinitionId: docsAgent.id,
        name: 'docs-writer',
        startTime: minutesAgo(new Date(), 1000 - 4000 / 60000),
        endTime: minutesAgo(new Date(), 1000 - 26000 / 60000),
        status: 'success',
      },
    });
    await prisma.skillUsage.create({
      data: {
        skillDefinitionId: dependencyCheckSkill.id,
        agentRunId: depAgentRun.id,
        available: true,
        configured: true,
        loaded: 'true',
        referenced: 'true',
        executionEvidence: 'true',
        evidence: j([{ source: 'runtime', confidence: 'observed' }]),

      },
    });
    await prisma.fileOperation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docedit')!,
        path: 'CHANGELOG.md',
        operation: 'modified',
        additions: 4,
        deletions: 0,
        actorId: docsAgent.id,
        evidenceSource: 'git',
        evidenceConfidence: 'observed',
      },
    });
    await prisma.pullRequest.create({
      data: {
        runId,
        action: 'created',
        number: 940,
        title: 'chore(deps): bump 3 transitive packages with known advisories',
        url: 'https://github.com/acme/payments/pull/940',
        timestamp: minutesAgo(new Date(), 1000 - 30000 / 60000),
      },
    });
  }

  // 5. Dependency Audit — unexpected file modification (drift finding).
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: dependencyWorkflow.id,
      workflowName: 'Dependency Audit',
      trigger: 'schedule',
      branch: 'main',
      commitSha: 'e5f6a7b',
      status: 'success',
      startedMinutesAgo: 1600,
      totalDurationMs: 26_000,
      engine: 'claude',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Dependency Audit', startOffsetMs: 0, durationMs: 26_000, status: 'success' },
        { id: 'dep', parentId: 'root', type: 'agent', name: 'dependency-agent', actorId: dependencyAgent.id, startOffsetMs: 200, durationMs: 24_000, status: 'success' },
        { id: 'shell', parentId: 'dep', type: 'shell', name: 'npm audit fix', startOffsetMs: 500, durationMs: 8000, status: 'success' },
        { id: 'lockedit', parentId: 'dep', type: 'file', name: 'package-lock.json', startOffsetMs: 9000, durationMs: 400, status: 'success' },
        { id: 'unexpected', parentId: 'dep', type: 'file', name: 'src/config/featureFlags.ts', startOffsetMs: 12_000, durationMs: 600, status: 'success' },
      ],
    });
    const depAgentRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('dep')!,
        agentDefinitionId: dependencyAgent.id,
        name: 'dependency-agent',
        startTime: minutesAgo(new Date(), 1600),
        endTime: minutesAgo(new Date(), 1600 - 24000 / 60000),
        status: 'success',
      },
    });
    await prisma.fileOperation.createMany({
      data: [
        {
          runId,
          spanId: spanIdByKey.get('lockedit')!,
          path: 'package-lock.json',
          operation: 'modified',
          additions: 18,
          deletions: 18,
          actorId: dependencyAgent.id,
          evidenceSource: 'git',
          evidenceConfidence: 'observed',
        },
        {
          runId,
          spanId: spanIdByKey.get('unexpected')!,
          path: 'src/config/featureFlags.ts',
          operation: 'modified',
          additions: 1,
          deletions: 1,
          actorId: dependencyAgent.id,
          evidenceSource: 'git',
          evidenceConfidence: 'observed',
        },
      ],
    });
    await prisma.driftFinding.create({
      data: {
        runId,
        kind: 'unexpected_file',
        description:
          'dependency-agent modified src/config/featureFlags.ts, which is outside the dependency-manifest scope declared for this workflow.',
        expected: 'package.json, package-lock.json',
        observed: 'package-lock.json, src/config/featureFlags.ts',
      },
    });
    void depAgentRun;
  }

  // 6. Dependency Audit — skill configured but no runtime evidence.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: dependencyWorkflow.id,
      workflowName: 'Dependency Audit',
      trigger: 'schedule',
      branch: 'main',
      commitSha: 'f6a7b8c',
      status: 'success',
      startedMinutesAgo: 2200,
      totalDurationMs: 14_000,
      engine: 'claude',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Dependency Audit', startOffsetMs: 0, durationMs: 14_000, status: 'success' },
        { id: 'dep', parentId: 'root', type: 'agent', name: 'dependency-agent', actorId: dependencyAgent.id, startOffsetMs: 200, durationMs: 12_000, status: 'success' },
        { id: 'shell', parentId: 'dep', type: 'shell', name: 'npm outdated', startOffsetMs: 500, durationMs: 5000, status: 'success' },
      ],
    });
    const depAgentRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('dep')!,
        agentDefinitionId: dependencyAgent.id,
        name: 'dependency-agent',
        startTime: minutesAgo(new Date(), 2200),
        endTime: minutesAgo(new Date(), 2200 - 12000 / 60000),
        status: 'success',
      },
    });
    await prisma.skillUsage.create({
      data: {
        skillDefinitionId: dependencyCheckSkill.id,
        agentRunId: depAgentRun.id,
        available: true,
        configured: true,
        loaded: 'unknown',
        referenced: 'unknown',
        executionEvidence: 'unknown',
        evidence: j([
          { source: 'parser', confidence: 'observed', note: 'Configured in agent frontmatter.' },
        ]),
      },
    });
  }

  // 7. Documentation Sync — tool failure followed by retry (success).
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: docsWorkflow.id,
      workflowName: 'Documentation Sync',
      trigger: 'push',
      branch: 'main',
      commitSha: 'a7b8c9d',
      status: 'success',
      startedMinutesAgo: 2800,
      totalDurationMs: 19_500,
      engine: 'codex',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Documentation Sync', startOffsetMs: 0, durationMs: 19_500, status: 'success' },
        { id: 'docs', parentId: 'root', type: 'agent', name: 'docs-writer', actorId: docsAgent.id, startOffsetMs: 200, durationMs: 18_000, status: 'success' },
        { id: 'toolfail', parentId: 'docs', type: 'tool', name: 'read-file', startOffsetMs: 500, durationMs: 900, status: 'failure' },
        { id: 'retry', parentId: 'docs', type: 'tool', name: 'read-file', startOffsetMs: 1600, durationMs: 700, status: 'success' },
        { id: 'edit', parentId: 'docs', type: 'file', name: 'README.md', startOffsetMs: 3000, durationMs: 1200, status: 'success' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docs')!,
        agentDefinitionId: docsAgent.id,
        name: 'docs-writer',
        startTime: minutesAgo(new Date(), 2800),
        endTime: minutesAgo(new Date(), 2800 - 18000 / 60000),
        status: 'success',
      },
    });
    await prisma.toolInvocation.createMany({
      data: [
        {
          runId,
          spanId: spanIdByKey.get('toolfail')!,
          category: 'filesystem',
          toolName: 'read-file',
          argumentsPreview: '{"path":"docs/API.md"}',
          resultPreview: '{"error":"ENOENT: file locked by concurrent job"}',
          status: 'failure',
          durationMs: 900,
        },
        {
          runId,
          spanId: spanIdByKey.get('retry')!,
          category: 'filesystem',
          toolName: 'read-file',
          argumentsPreview: '{"path":"docs/API.md"}',
          resultPreview: '{"ok":true}',
          status: 'success',
          durationMs: 700,
        },
      ],
    });
    await prisma.event.create({
      data: {
        runId,
        spanId: spanIdByKey.get('retry')!,
        timestamp: minutesAgo(new Date(), 2800 - 1600 / 60000),
        kind: 'retry',
        actorType: 'agent',
        actorId: docsAgent.id,
        actorName: 'docs-writer',
        data: j({ attempt: 2, previousError: 'ENOENT: file locked by concurrent job' }),
        evidenceSource: 'runtime',
        evidenceConfidence: 'observed',
      },
    });
    await prisma.fileOperation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('edit')!,
        path: 'README.md',
        operation: 'modified',
        additions: 6,
        deletions: 2,
        actorId: docsAgent.id,
        evidenceSource: 'git',
        evidenceConfidence: 'observed',
      },
    });
  }

  // 8. Documentation Sync — successful PR creation run.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: docsWorkflow.id,
      workflowName: 'Documentation Sync',
      trigger: 'push',
      branch: 'main',
      commitSha: 'b8c9d0e',
      status: 'success',
      startedMinutesAgo: 3400,
      totalDurationMs: 15_800,
      engine: 'codex',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Documentation Sync', startOffsetMs: 0, durationMs: 15_800, status: 'success' },
        { id: 'docs', parentId: 'root', type: 'agent', name: 'docs-writer', actorId: docsAgent.id, startOffsetMs: 200, durationMs: 12_000, status: 'success' },
        { id: 'edit', parentId: 'docs', type: 'file', name: 'docs/API.md', startOffsetMs: 2000, durationMs: 2200, status: 'success' },
        { id: 'pr', parentId: 'root', type: 'github', name: 'open-pr', startOffsetMs: 13_000, durationMs: 2200, status: 'success' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docs')!,
        agentDefinitionId: docsAgent.id,
        name: 'docs-writer',
        startTime: minutesAgo(new Date(), 3400),
        endTime: minutesAgo(new Date(), 3400 - 12000 / 60000),
        status: 'success',
      },
    });
    await prisma.fileOperation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('edit')!,
        path: 'docs/API.md',
        operation: 'modified',
        additions: 22,
        deletions: 4,
        actorId: docsAgent.id,
        evidenceSource: 'git',
        evidenceConfidence: 'observed',
      },
    });
    await prisma.pullRequest.create({
      data: {
        runId,
        action: 'created',
        number: 951,
        title: 'docs: sync API.md with new refund endpoint',
        url: 'https://github.com/acme/payments/pull/951',
        timestamp: minutesAgo(new Date(), 3400 - 13000 / 60000),
      },
    });
  }

  // 9. Documentation Sync — test failure run.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: docsWorkflow.id,
      workflowName: 'Documentation Sync',
      trigger: 'push',
      branch: 'main',
      commitSha: 'c9d0e1f',
      status: 'failure',
      startedMinutesAgo: 4000,
      totalDurationMs: 21_000,
      engine: 'codex',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Documentation Sync', startOffsetMs: 0, durationMs: 21_000, status: 'failure' },
        { id: 'docs', parentId: 'root', type: 'agent', name: 'docs-writer', actorId: docsAgent.id, startOffsetMs: 200, durationMs: 15_000, status: 'success' },
        { id: 'edit', parentId: 'docs', type: 'file', name: 'docs/examples.md', startOffsetMs: 2000, durationMs: 1800, status: 'success' },
        { id: 'test', parentId: 'root', type: 'test', name: 'npm test', startOffsetMs: 16_000, durationMs: 5000, status: 'failure' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docs')!,
        agentDefinitionId: docsAgent.id,
        name: 'docs-writer',
        startTime: minutesAgo(new Date(), 4000),
        endTime: minutesAgo(new Date(), 4000 - 15000 / 60000),
        status: 'success',
      },
    });
    await prisma.fileOperation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('edit')!,
        path: 'docs/examples.md',
        operation: 'modified',
        additions: 30,
        deletions: 1,
        actorId: docsAgent.id,
        evidenceSource: 'git',
        evidenceConfidence: 'observed',
      },
    });
    await prisma.checkOperation.create({
      data: {
        runId,
        name: 'npm test',
        status: 'failure',
        startTime: minutesAgo(new Date(), 4000 - 16000 / 60000),
        endTime: minutesAgo(new Date(), 4000 - 21000 / 60000),
      },
    });
    await prisma.logRecord.create({
      data: {
        runId,
        spanId: spanIdByKey.get('test')!,
        source: 'actions',
        timestamp: minutesAgo(new Date(), 4000 - 20000 / 60000),
        level: 'error',
        message: 'FAIL docs/examples.test.ts — snippet in examples.md no longer matches exported type signature',
      },
    });
  }

  // 10. Documentation Sync — successful retry of the run above.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: docsWorkflow.id,
      workflowName: 'Documentation Sync',
      trigger: 'push',
      branch: 'main',
      commitSha: 'c9d0e1f',
      status: 'success',
      startedMinutesAgo: 3980,
      totalDurationMs: 18_000,
      engine: 'codex',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Documentation Sync', startOffsetMs: 0, durationMs: 18_000, status: 'success' },
        { id: 'docs', parentId: 'root', type: 'agent', name: 'docs-writer', actorId: docsAgent.id, startOffsetMs: 200, durationMs: 12_000, status: 'success' },
        { id: 'edit', parentId: 'docs', type: 'file', name: 'docs/examples.md', startOffsetMs: 2000, durationMs: 1800, status: 'success' },
        { id: 'test', parentId: 'root', type: 'test', name: 'npm test', startOffsetMs: 13_000, durationMs: 5000, status: 'success' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docs')!,
        agentDefinitionId: docsAgent.id,
        name: 'docs-writer',
        startTime: minutesAgo(new Date(), 3980),
        endTime: minutesAgo(new Date(), 3980 - 12000 / 60000),
        status: 'success',
      },
    });
    await prisma.checkOperation.create({
      data: {
        runId,
        name: 'npm test',
        status: 'success',
        startTime: minutesAgo(new Date(), 3980 - 13000 / 60000),
        endTime: minutesAgo(new Date(), 3980 - 18000 / 60000),
      },
    });
  }

  // 11. Issue Triage — another successful run.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: triageWorkflow.id,
      workflowName: 'Issue Triage',
      trigger: 'issue',
      branch: 'main',
      commitSha: 'd0e1f2a',
      status: 'success',
      startedMinutesAgo: 4500,
      totalDurationMs: 9_800,
      engine: 'copilot',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Issue Triage', startOffsetMs: 0, durationMs: 9_800, status: 'success' },
        { id: 'agent', parentId: 'root', type: 'agent', name: 'triage-agent', actorId: triageAgent.id, startOffsetMs: 200, durationMs: 9_000, status: 'success' },
        { id: 'skill', parentId: 'agent', type: 'skill', name: 'issue-analysis', startOffsetMs: 400, durationMs: 800, status: 'success' },
        { id: 'gh', parentId: 'agent', type: 'github', name: 'add-comment', startOffsetMs: 4000, durationMs: 500, status: 'success' },
      ],
    });
    const agentRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('agent')!,
        agentDefinitionId: triageAgent.id,
        name: 'triage-agent',
        startTime: minutesAgo(new Date(), 4500),
        endTime: minutesAgo(new Date(), 4500 - 9000 / 60000),
        status: 'success',
      },
    });
    await prisma.skillUsage.create({
      data: {
        skillDefinitionId: issueAnalysisSkill.id,
        agentRunId: agentRun.id,
        available: true,
        configured: true,
        loaded: 'true',
        referenced: 'true',
        executionEvidence: 'true',
        evidence: j([{ source: 'runtime', confidence: 'observed' }]),

      },
    });
    await prisma.issueOperation.create({
      data: {
        runId,
        action: 'commented',
        number: 510,
        title: 'Feature request: export transaction history as CSV',
        url: 'https://github.com/acme/payments/issues/510',
        timestamp: minutesAgo(new Date(), 4500 - 4500 / 60000),
      },
    });
  }

  // 12. Dependency Audit — another straightforward successful run.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: dependencyWorkflow.id,
      workflowName: 'Dependency Audit',
      trigger: 'schedule',
      branch: 'main',
      commitSha: 'e1f2a3b',
      status: 'success',
      startedMinutesAgo: 5200,
      totalDurationMs: 17_200,
      engine: 'claude',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Dependency Audit', startOffsetMs: 0, durationMs: 17_200, status: 'success' },
        { id: 'dep', parentId: 'root', type: 'agent', name: 'dependency-agent', actorId: dependencyAgent.id, startOffsetMs: 200, durationMs: 15_000, status: 'success' },
        { id: 'shell', parentId: 'dep', type: 'shell', name: 'npm audit', startOffsetMs: 500, durationMs: 6000, status: 'success' },
        { id: 'skill', parentId: 'dep', type: 'skill', name: 'dependency-check', startOffsetMs: 6600, durationMs: 900, status: 'success' },
      ],
    });
    const agentRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('dep')!,
        agentDefinitionId: dependencyAgent.id,
        name: 'dependency-agent',
        startTime: minutesAgo(new Date(), 5200),
        endTime: minutesAgo(new Date(), 5200 - 15000 / 60000),
        status: 'success',
      },
    });
    await prisma.skillUsage.create({
      data: {
        skillDefinitionId: dependencyCheckSkill.id,
        agentRunId: agentRun.id,
        available: true,
        configured: true,
        loaded: 'true',
        referenced: 'true',
        executionEvidence: 'true',
        evidence: j([{ source: 'runtime', confidence: 'observed' }]),

      },
    });
  }

  // 13. Documentation Sync — plain successful run.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: docsWorkflow.id,
      workflowName: 'Documentation Sync',
      trigger: 'push',
      branch: 'main',
      commitSha: 'f2a3b4c',
      status: 'success',
      startedMinutesAgo: 5800,
      totalDurationMs: 10_500,
      engine: 'codex',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Documentation Sync', startOffsetMs: 0, durationMs: 10_500, status: 'success' },
        { id: 'docs', parentId: 'root', type: 'agent', name: 'docs-writer', actorId: docsAgent.id, startOffsetMs: 200, durationMs: 9000, status: 'success' },
        { id: 'edit', parentId: 'docs', type: 'file', name: 'docs/SETUP.md', startOffsetMs: 1000, durationMs: 1500, status: 'success' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('docs')!,
        agentDefinitionId: docsAgent.id,
        name: 'docs-writer',
        startTime: minutesAgo(new Date(), 5800),
        endTime: minutesAgo(new Date(), 5800 - 9000 / 60000),
        status: 'success',
      },
    });
    await prisma.fileOperation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('edit')!,
        path: 'docs/SETUP.md',
        operation: 'modified',
        additions: 5,
        deletions: 0,
        actorId: docsAgent.id,
        evidenceSource: 'git',
        evidenceConfidence: 'observed',
      },
    });
  }

  // 14. Issue Triage — deep handoff chain triage -> security -> dependency.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: triageWorkflow.id,
      workflowName: 'Issue Triage',
      trigger: 'issue',
      branch: 'main',
      commitSha: 'a3b4c5d',
      status: 'success',
      startedMinutesAgo: 6500,
      totalDurationMs: 52_000,
      engine: 'copilot',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Issue Triage', startOffsetMs: 0, durationMs: 52_000, status: 'success' },
        { id: 'triage', parentId: 'root', type: 'agent', name: 'triage-agent', actorId: triageAgent.id, startOffsetMs: 200, durationMs: 49_000, status: 'success' },
        { id: 'security', parentId: 'triage', type: 'subagent', name: 'security-reviewer', actorId: securityAgent.id, startOffsetMs: 8000, durationMs: 30_000, status: 'success' },
        { id: 'dependency', parentId: 'security', type: 'subagent', name: 'dependency-agent', actorId: dependencyAgent.id, startOffsetMs: 12_000, durationMs: 20_000, status: 'success' },
        { id: 'shell', parentId: 'dependency', type: 'shell', name: 'npm audit', startOffsetMs: 12_500, durationMs: 9000, status: 'success' },
      ],
    });
    const triageRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('triage')!,
        agentDefinitionId: triageAgent.id,
        name: 'triage-agent',
        startTime: minutesAgo(new Date(), 6500),
        endTime: minutesAgo(new Date(), 6500 - 49000 / 60000),
        status: 'success',
      },
    });
    const securityRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('security')!,
        agentDefinitionId: securityAgent.id,
        name: 'security-reviewer',
        parentAgentRunId: triageRun.id,
        startTime: minutesAgo(new Date(), 6500 - 8000 / 60000),
        endTime: minutesAgo(new Date(), 6500 - 38000 / 60000),
        status: 'success',
      },
    });
    const dependencyRun = await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('dependency')!,
        agentDefinitionId: dependencyAgent.id,
        name: 'dependency-agent',
        parentAgentRunId: securityRun.id,
        startTime: minutesAgo(new Date(), 6500 - 12000 / 60000),
        endTime: minutesAgo(new Date(), 6500 - 32000 / 60000),
        status: 'success',
      },
    });
    await prisma.agentHandoff.createMany({
      data: [
        {
          fromAgentRunId: triageRun.id,
          toAgentRunId: securityRun.id,
          timestamp: minutesAgo(new Date(), 6500 - 8000 / 60000),
          reason: 'Issue references a CVE in a transitive dependency.',
          evidenceSource: 'runtime',
          evidenceConfidence: 'observed',
        },
        {
          fromAgentRunId: securityRun.id,
          toAgentRunId: dependencyRun.id,
          timestamp: minutesAgo(new Date(), 6500 - 12000 / 60000),
          reason: 'Confirmed CVE affects an installed version; routing to dependency-agent for a fix.',
          evidenceSource: 'runtime',
          evidenceConfidence: 'observed',
        },
      ],
    });
    void dependencyRun;
  }

  // 15. Dependency Audit — failed run overall.
  {
    const { runId, spanIdByKey } = await createRunWithSpans({
      workflowDefinitionId: dependencyWorkflow.id,
      workflowName: 'Dependency Audit',
      trigger: 'schedule',
      branch: 'main',
      commitSha: 'b4c5d6e',
      status: 'failure',
      startedMinutesAgo: 7200,
      totalDurationMs: 6_500,
      engine: 'claude',
      spans: [
        { id: 'root', parentId: null, type: 'workflow', name: 'Dependency Audit', startOffsetMs: 0, durationMs: 6_500, status: 'failure' },
        { id: 'dep', parentId: 'root', type: 'agent', name: 'dependency-agent', actorId: dependencyAgent.id, startOffsetMs: 200, durationMs: 6_000, status: 'failure' },
        { id: 'shell', parentId: 'dep', type: 'shell', name: 'npm audit', startOffsetMs: 500, durationMs: 5000, status: 'failure' },
      ],
    });
    await prisma.agentRun.create({
      data: {
        runId,
        spanId: spanIdByKey.get('dep')!,
        agentDefinitionId: dependencyAgent.id,
        name: 'dependency-agent',
        startTime: minutesAgo(new Date(), 7200),
        endTime: minutesAgo(new Date(), 7200 - 6000 / 60000),
        status: 'failure',
      },
    });
    await prisma.toolInvocation.create({
      data: {
        runId,
        spanId: spanIdByKey.get('shell')!,
        category: 'shell',
        toolName: 'npm audit',
        resultPreview: '{"error":"network timeout reaching registry.npmjs.org"}',
        status: 'failure',
        durationMs: 5000,
      },
    });
    await prisma.logRecord.create({
      data: {
        runId,
        spanId: spanIdByKey.get('shell')!,
        source: 'shell',
        timestamp: minutesAgo(new Date(), 7200 - 5500 / 60000),
        level: 'error',
        message: 'ETIMEDOUT: network timeout reaching registry.npmjs.org',
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
