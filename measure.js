#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, 'backend');
const FRONTEND_DIR = path.join(__dirname, 'frontend', 'src');

const EXPECTED_MODELS = {
  Organization: ['_id', 'name', 'slug', 'plan', 'settings', 'createdAt', 'updatedAt'],
  User: ['_id', 'orgId', 'name', 'email', 'passwordHash', 'role', 'notificationPrefs', 'lastLoginAt', 'createdAt', 'updatedAt'],
  Task: ['_id', 'orgId', 'title', 'description', 'status', 'priority', 'assigneeId', 'createdBy', 'tags', 'dueDate', 'completedAt', 'createdAt', 'updatedAt'],
  AuditLog: ['_id', 'orgId', 'userId', 'action', 'resource', 'resourceId', 'changes', 'ipAddress', 'timestamp'],
};

const EXPECTED_ROUTES_PATTERN = /\/api\/v1\//;

function getAllFiles(dir, ext, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
      getAllFiles(fullPath, ext, files);
    } else if (entry.isFile() && (!ext || entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// ─── METRIC 1: API Route Consistency ───
function checkRouteConsistency() {
  const results = { total: 0, compliant: 0, violations: [] };
  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');
  const serverFile = readFile(path.join(BACKEND_DIR, 'server.js'));

  const routeRegistrations = serverFile.match(/app\.use\(['"`](.*?)['"`]/g) || [];
  for (const reg of routeRegistrations) {
    const route = reg.match(/['"`](.*?)['"`]/)?.[1];
    if (!route) continue;
    results.total++;
    if (route === '/api/v1/health' || EXPECTED_ROUTES_PATTERN.test(route)) {
      results.compliant++;
    } else {
      results.violations.push(`Route '${route}' does not follow /api/v1/ pattern`);
    }
  }

  for (const file of routeFiles) {
    const content = readFile(file);
    const routeDefs = content.match(/router\.(get|post|put|delete|patch)\(['"`](.*?)['"`]/g) || [];
    for (const def of routeDefs) {
      const routePath = def.match(/['"`](.*?)['"`]/)?.[1];
      if (routePath && routePath.startsWith('/api/') && !EXPECTED_ROUTES_PATTERN.test(routePath)) {
        results.violations.push(`${path.basename(file)}: inline route '${routePath}' breaks /api/v1/ convention`);
      }
    }
  }

  results.score = results.total > 0 ? (results.compliant / results.total * 100).toFixed(1) : 'N/A';
  return results;
}

// ─── METRIC 2: Multi-tenancy Compliance ───
function checkMultiTenancy() {
  const results = { total: 0, compliant: 0, violations: [] };
  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');

  for (const file of routeFiles) {
    const fileName = path.basename(file);
    if (fileName === 'auth.js') continue;

    const content = readFile(file);
    const dbOps = content.match(/\.(find|findOne|findById|countDocuments|aggregate|create|updateOne|deleteOne|deleteMany)\(/g) || [];

    for (const op of dbOps) {
      results.total++;
    }

    const orgIdRefs = (content.match(/orgId/g) || []).length;
    const hasOrgScoping = orgIdRefs > 0;

    if (dbOps.length > 0 && !hasOrgScoping) {
      results.violations.push(`${fileName}: has ${dbOps.length} DB operations but NO orgId filtering`);
    } else if (hasOrgScoping) {
      results.compliant += dbOps.length;
    }
  }

  results.score = results.total > 0 ? (results.compliant / results.total * 100).toFixed(1) : 'N/A';
  return results;
}

// ─── METRIC 3: RBAC Compliance ───
function checkRBACCompliance() {
  const results = { total: 0, protected: 0, violations: [] };
  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');

  for (const file of routeFiles) {
    const fileName = path.basename(file);
    if (fileName === 'auth.js') continue;

    const content = readFile(file);
    const hasAuthMiddleware = content.includes('authMiddleware') || content.includes('auth');
    const hasCheckPermission = content.includes('checkPermission');

    const routeHandlers = content.match(/router\.(get|post|put|delete|patch)\(/g) || [];
    results.total += routeHandlers.length;

    if (hasAuthMiddleware) {
      results.protected += routeHandlers.length;
    } else {
      results.violations.push(`${fileName}: ${routeHandlers.length} routes without auth middleware`);
    }

    const sensitiveRoutes = ['delete', 'audit', 'user', 'report', 'export'];
    const hasSensitiveOps = sensitiveRoutes.some(s => fileName.toLowerCase().includes(s) || content.toLowerCase().includes(s));
    if (hasSensitiveOps && !hasCheckPermission) {
      results.violations.push(`${fileName}: has sensitive operations but no RBAC checkPermission`);
    }
  }

  results.score = results.total > 0 ? (results.protected / results.total * 100).toFixed(1) : 'N/A';
  return results;
}

// ─── METRIC 4: Audit Trail Coverage ───
function checkAuditCoverage() {
  const results = { total: 0, audited: 0, violations: [] };
  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');

  const writeOps = ['post', 'put', 'delete', 'patch'];

  for (const file of routeFiles) {
    const fileName = path.basename(file);
    const content = readFile(file);

    for (const op of writeOps) {
      const regex = new RegExp(`router\\.${op}\\(`, 'g');
      const matches = content.match(regex) || [];
      results.total += matches.length;
    }

    const auditCalls = (content.match(/logAudit|AuditLog\.create/g) || []).length;
    if (auditCalls > 0) {
      const writeCount = writeOps.reduce((sum, op) => {
        return sum + (content.match(new RegExp(`router\\.${op}\\(`, 'g')) || []).length;
      }, 0);
      results.audited += Math.min(auditCalls, writeCount);
    } else {
      const writeCount = writeOps.reduce((sum, op) => {
        return sum + (content.match(new RegExp(`router\\.${op}\\(`, 'g')) || []).length;
      }, 0);
      if (writeCount > 0 && fileName !== 'auth.js') {
        results.violations.push(`${fileName}: ${writeCount} write operations with NO audit logging`);
      }
    }
  }

  results.score = results.total > 0 ? (results.audited / results.total * 100).toFixed(1) : 'N/A';
  return results;
}

// ─── METRIC 5: Schema Consistency ───
function checkSchemaConsistency() {
  const results = { issues: [], score: 100 };
  const modelFiles = getAllFiles(path.join(BACKEND_DIR, 'models'), '.js');

  const definedModels = {};
  for (const file of modelFiles) {
    const content = readFile(file);
    const modelName = path.basename(file, '.js');
    const fieldMatches = content.match(/(\w+)\s*:\s*\{/g) || [];
    const fields = fieldMatches.map(m => m.match(/(\w+)\s*:/)?.[1]).filter(Boolean);
    definedModels[modelName] = fields;
  }

  const allJsFiles = [...getAllFiles(BACKEND_DIR, '.js'), ...getAllFiles(FRONTEND_DIR, '.js'), ...getAllFiles(FRONTEND_DIR, '.jsx')];

  const knownFieldNames = new Set();
  Object.values(definedModels).forEach(fields => fields.forEach(f => knownFieldNames.add(f)));

  const snakeCaseFields = [];
  for (const file of allJsFiles) {
    const content = readFile(file);
    const snakeMatches = content.match(/[a-z]+_[a-z]+(?:Id|id|At|at|By|by)?/g) || [];
    for (const match of snakeMatches) {
      if (!match.includes('__') && !match.startsWith('_') && match !== 'max_length') {
        const camelVersion = match.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        if (knownFieldNames.has(camelVersion)) {
          snakeCaseFields.push({ file: path.relative(__dirname, file), field: match, expected: camelVersion });
        }
      }
    }
  }

  if (snakeCaseFields.length > 0) {
    results.issues.push(...snakeCaseFields.map(f => `${f.file}: uses '${f.field}' instead of '${f.expected}'`));
    results.score -= snakeCaseFields.length * 5;
  }

  results.score = Math.max(0, results.score);
  return results;
}

// ─── METRIC 6: Response Format Consistency ───
function checkResponseFormat() {
  const results = { total: 0, compliant: 0, violations: [] };
  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');

  for (const file of routeFiles) {
    const content = readFile(file);
    const fileName = path.basename(file);
    const resJsonCalls = content.match(/res\.(json|status)\(/g) || [];
    results.total += resJsonCalls.length;

    const hasSuccessField = content.includes('success:') || content.includes('success :');
    const hasDataField = content.includes('data:') || content.includes('data :');
    const hasErrorField = content.includes('error:') || content.includes('error :');

    if (hasSuccessField && hasDataField && hasErrorField) {
      results.compliant += resJsonCalls.length;
    } else {
      const missing = [];
      if (!hasSuccessField) missing.push('success');
      if (!hasDataField) missing.push('data');
      if (!hasErrorField) missing.push('error');
      results.violations.push(`${fileName}: missing response fields: ${missing.join(', ')}`);
    }
  }

  results.score = results.total > 0 ? (results.compliant / results.total * 100).toFixed(1) : 'N/A';
  return results;
}

// ─── METRIC 7: Dependency Compatibility ───
function checkDependencyCompatibility() {
  const results = { total: 0, resolved: 0, broken: [] };
  const allJsFiles = getAllFiles(BACKEND_DIR, '.js');

  for (const file of allJsFiles) {
    const content = readFile(file);
    const requires = content.match(/require\(['"`](\..*?)['"`]\)/g) || [];

    for (const req of requires) {
      results.total++;
      const reqPath = req.match(/['"`](\..*?)['"`]/)?.[1];
      if (!reqPath) continue;

      const baseDir = path.dirname(file);
      let resolved = path.resolve(baseDir, reqPath);
      if (!path.extname(resolved)) resolved += '.js';

      if (fs.existsSync(resolved)) {
        results.resolved++;
      } else {
        results.broken.push({ file: path.relative(__dirname, file), requires: reqPath });
      }
    }
  }

  results.score = results.total > 0 ? (results.resolved / results.total * 100).toFixed(1) : 'N/A';
  return results;
}

// ─── METRIC 8: Security Compliance ───
function checkSecurityCompliance() {
  const results = { issues: [], score: 100 };

  const authFile = readFile(path.join(BACKEND_DIR, 'routes', 'auth.js')) ||
                   readFile(path.join(BACKEND_DIR, 'middleware', 'auth.js'));
  const bcryptMatch = authFile.match(/bcrypt\.hash\(.*?,\s*(\d+)/);
  if (bcryptMatch) {
    const rounds = parseInt(bcryptMatch[1]);
    results.bcryptRounds = rounds;
    if (rounds < 10) {
      results.issues.push(`bcrypt rounds = ${rounds} (recommended >= 10)`);
      results.score -= 20;
    }
  }

  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');
  for (const file of routeFiles) {
    const content = readFile(file);
    const fileName = path.basename(file);
    if (fileName === 'auth.js') continue;

    if (!content.includes('authMiddleware') && !content.includes("require('../middleware/auth')")) {
      const routeCount = (content.match(/router\.(get|post|put|delete|patch)\(/g) || []).length;
      if (routeCount > 0) {
        results.issues.push(`${fileName}: ${routeCount} routes without auth middleware import`);
        results.score -= 15;
      }
    }
  }

  const serverContent = readFile(path.join(BACKEND_DIR, 'server.js'));
  if (serverContent.includes('JWT_SECRET') && serverContent.includes("'secret'")) {
    results.issues.push('Hardcoded JWT secret detected');
    results.score -= 25;
  }

  results.score = Math.max(0, results.score);
  return results;
}

// ─── METRIC 9: Code Convention Adherence ───
function checkCodeConventions() {
  const results = { violations: [], score: 100 };
  const modelFiles = getAllFiles(path.join(BACKEND_DIR, 'models'), '.js');
  const routeFiles = getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js');
  const componentFiles = getAllFiles(FRONTEND_DIR, '.jsx');

  for (const file of modelFiles) {
    const name = path.basename(file, '.js');
    if (name !== name.charAt(0).toUpperCase() + name.slice(1)) {
      results.violations.push(`Model file '${name}.js' not PascalCase`);
      results.score -= 5;
    }
  }

  for (const file of routeFiles) {
    const name = path.basename(file, '.js');
    if (/[A-Z]/.test(name) && !name.includes('Log')) {
      results.violations.push(`Route file '${name}.js' should be kebab-case or camelCase`);
      results.score -= 3;
    }
  }

  for (const file of componentFiles) {
    const name = path.basename(file, '.jsx');
    if (name[0] !== name[0].toUpperCase()) {
      results.violations.push(`Component '${name}.jsx' not PascalCase`);
      results.score -= 5;
    }
  }

  results.score = Math.max(0, results.score);
  return results;
}

// ─── METRIC 10: Duplicate/Dead Code ───
function checkDuplicateCode() {
  const results = { duplicateModels: [], orphanedFiles: [], score: 100 };
  const modelFiles = getAllFiles(path.join(BACKEND_DIR, 'models'), '.js');

  const modelNames = {};
  for (const file of modelFiles) {
    const content = readFile(file);
    const modelMatch = content.match(/mongoose\.model\(['"`](\w+)['"`]/);
    if (modelMatch) {
      const name = modelMatch[1];
      if (modelNames[name]) {
        results.duplicateModels.push(`Model '${name}' defined in both ${modelNames[name]} and ${path.basename(file)}`);
        results.score -= 15;
      }
      modelNames[name] = path.basename(file);
    }
  }

  const allBackendFiles = getAllFiles(BACKEND_DIR, '.js');
  for (const file of allBackendFiles) {
    if (file.includes('node_modules')) continue;
    const content = readFile(file);
    const isImported = allBackendFiles.some(other => {
      if (other === file) return false;
      const otherContent = readFile(other);
      return otherContent.includes(path.basename(file, '.js'));
    });
    const isEntryPoint = path.basename(file) === 'server.js';
    if (!isImported && !isEntryPoint && path.basename(file) !== '.env.example') {
      results.orphanedFiles.push(path.relative(__dirname, file));
    }
  }

  results.score = Math.max(0, results.score);
  return results;
}

// ─── METRIC 11: Structural Integrity ───
function checkStructuralIntegrity() {
  const results = { misplacedFiles: [], duplicateConfigs: [], platformArtifacts: [], score: 100 };
  const ROOT_DIR = __dirname;

  const allowedRootFiles = new Set([
    'measure.js', 'README.md', 'LICENSE', '.gitignore', '.env', '.env.example',
  ]);
  const allowedRootDirs = new Set([
    'backend', 'frontend', 'measurement-results', '.git', 'node_modules',
  ]);

  const rootEntries = fs.readdirSync(ROOT_DIR, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore' && entry.name !== '.env' && entry.name !== '.env.example') {
      if (entry.name === '.git') continue;
      results.platformArtifacts.push(entry.name);
      results.score -= 5;
      continue;
    }
    if (entry.isFile() && !allowedRootFiles.has(entry.name)) {
      results.misplacedFiles.push(entry.name);
      results.score -= 10;
    }
    if (entry.isDirectory() && !allowedRootDirs.has(entry.name) && !entry.name.startsWith('.')) {
      results.misplacedFiles.push(entry.name + '/');
      results.score -= 10;
    }
  }

  const rootPkg = path.join(ROOT_DIR, 'package.json');
  const backendPkg = path.join(ROOT_DIR, 'backend', 'package.json');
  const frontendPkg = path.join(ROOT_DIR, 'frontend', 'package.json');
  if (fs.existsSync(rootPkg) && fs.existsSync(backendPkg)) {
    results.duplicateConfigs.push('Root package.json conflicts with backend/package.json');
    results.score -= 15;
  }
  if (fs.existsSync(rootPkg) && fs.existsSync(frontendPkg)) {
    results.duplicateConfigs.push('Root package.json conflicts with frontend/package.json');
    results.score -= 10;
  }

  const rootServerFiles = ['index.js', 'server.js', 'app.js'].filter(f =>
    fs.existsSync(path.join(ROOT_DIR, f))
  );
  const backendServer = fs.existsSync(path.join(ROOT_DIR, 'backend', 'server.js'));
  if (rootServerFiles.length > 0 && backendServer) {
    for (const f of rootServerFiles) {
      results.duplicateConfigs.push(`Root ${f} conflicts with backend/server.js — duplicate entry point`);
      results.score -= 15;
    }
  }

  const platformFiles = ['.replit', 'replit.md', '.bolt', 'vercel.json', 'netlify.toml', '.cursorrules', '.windsurf'];
  for (const pf of platformFiles) {
    if (fs.existsSync(path.join(ROOT_DIR, pf))) {
      results.platformArtifacts.push(pf);
      results.score -= 3;
    }
  }

  results.score = Math.max(0, results.score);
  return results;
}

// ─── METRIC 12: Feature Integration Check ───
// Only evaluates features that show evidence of being ATTEMPTED (files exist
// anywhere in repo). Features not yet built by future devs are skipped.
function checkFeatureIntegration() {
  const results = { expectedFeatures: [], missingFeatures: [], score: 100 };
  const serverFile = readFile(path.join(BACKEND_DIR, 'server.js'));
  const ROOT_DIR = __dirname;
  const excludeFromDetect = new Set(['measure.js', 'package.json', 'package-lock.json', 'replit.md', '.replit', '.windsurf']);
  const featureFiles = getAllFiles(ROOT_DIR, null).filter(f => {
    const base = path.basename(f);
    return !f.includes('node_modules') && !f.includes('.git') && !f.includes('measurement-results') && !excludeFromDetect.has(base);
  });
  const featureFileNames = featureFiles.map(f => path.basename(f).toLowerCase());
  const featureContents = featureFiles.map(f => readFile(f).toLowerCase());

  const featureChecks = [
    {
      name: 'Notifications',
      detect: () => {
        const hasNotifFile = featureFileNames.some(f => f.includes('notif') && !f.includes('user'));
        const hasNotifRoute = featureContents.some(c => c.includes('notification') && (c.includes('router.get') || c.includes('router.post')));
        const hasNotifComponent = featureContents.some(c => c.includes('notification') && (c.includes('bell') || c.includes('usestate')) && !c.includes('notificationprefs'));
        return hasNotifFile || hasNotifRoute || hasNotifComponent;
      },
      checks: [
        { desc: 'Notification model in backend/models', test: () => fs.existsSync(path.join(BACKEND_DIR, 'models', 'Notification.js')) || getAllFiles(path.join(BACKEND_DIR, 'models'), '.js').some(f => { const c = readFile(f); return c.includes('notification') && c.includes('Schema'); }) },
        { desc: 'Notification routes in backend/routes', test: () => getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js').some(f => readFile(f).toLowerCase().includes('notification')) },
        { desc: 'Notification routes registered in server.js', test: () => serverFile.toLowerCase().includes('notification') },
      ],
    },
    {
      name: 'Reporting',
      detect: () => {
        const hasReportFile = featureFileNames.some(f => f.includes('report') && !f.includes('measure'));
        const hasChartLib = featureContents.some(c => c.includes('recharts') || c.includes('chart.js') || c.includes('chartjs'));
        const hasReportComponent = featureContents.some(c => (c.includes('report') && c.includes('csv')) || (c.includes('report') && c.includes('chart')));
        return hasReportFile || hasChartLib || hasReportComponent;
      },
      checks: [
        { desc: 'Report routes in backend/routes', test: () => getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js').some(f => readFile(f).toLowerCase().includes('report')) },
        { desc: 'Report routes registered in server.js', test: () => serverFile.toLowerCase().includes('report') },
      ],
    },
    {
      name: 'Search',
      detect: () => {
        const hasSearchFile = featureFileNames.some(f => f.includes('search'));
        const hasSearchFeature = featureContents.some(c => (c.includes('$text') || c.includes('$regex') || c.includes('text index')) && c.includes('search'));
        const hasDebounceSearch = featureContents.some(c => c.includes('debounce') && c.includes('search'));
        return hasSearchFile || hasSearchFeature || hasDebounceSearch;
      },
      checks: [
        { desc: 'Search/filter in task routes', test: () => {
          const taskRoutes = readFile(path.join(BACKEND_DIR, 'routes', 'tasks.js'));
          return taskRoutes.includes('search') || taskRoutes.includes('$text') || taskRoutes.includes('$regex');
        }},
      ],
    },
    {
      name: 'Comments',
      detect: () => {
        const hasCommentFile = featureFileNames.some(f => f.includes('comment') || f.includes('activity'));
        const hasCommentRoute = featureContents.some(c => c.includes('comment') && (c.includes('router.get') || c.includes('router.post')) && !c.includes('// comment'));
        const hasCommentModel = featureContents.some(c => c.includes('comment') && c.includes('schema') && c.includes('mongoose'));
        return hasCommentFile || hasCommentRoute || hasCommentModel;
      },
      checks: [
        { desc: 'Comment model in backend/models', test: () => getAllFiles(path.join(BACKEND_DIR, 'models'), '.js').some(f => { const c = readFile(f).toLowerCase(); return c.includes('comment') && c.includes('schema'); }) },
        { desc: 'Comment routes in backend/routes', test: () => getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js').some(f => { const c = readFile(f).toLowerCase(); return c.includes('comment') && (c.includes('router.get') || c.includes('router.post')); }) },
        { desc: 'Comment routes registered in server.js', test: () => serverFile.toLowerCase().includes('comment') },
      ],
    },
    {
      name: 'Templates',
      detect: () => {
        const hasTemplateFile = featureFileNames.some(f => f.includes('template') || f.includes('recurring'));
        const hasTemplateRoute = featureContents.some(c => (c.includes('template') || c.includes('recurring')) && (c.includes('router.get') || c.includes('router.post')));
        const hasTemplateModel = featureContents.some(c => (c.includes('template') || c.includes('recurring')) && c.includes('schema') && c.includes('mongoose'));
        return hasTemplateFile || hasTemplateRoute || hasTemplateModel;
      },
      checks: [
        { desc: 'Template/Recurring model in backend/models', test: () => getAllFiles(path.join(BACKEND_DIR, 'models'), '.js').some(f => { const c = readFile(f).toLowerCase(); return (c.includes('template') || c.includes('recurring')) && c.includes('schema'); }) },
        { desc: 'Template/Recurring routes in backend/routes', test: () => getAllFiles(path.join(BACKEND_DIR, 'routes'), '.js').some(f => { const c = readFile(f).toLowerCase(); return (c.includes('template') || c.includes('recurring')) && (c.includes('router.get') || c.includes('router.post')); }) },
        { desc: 'Template/Recurring routes registered in server.js', test: () => serverFile.toLowerCase().includes('template') || serverFile.toLowerCase().includes('recurring') },
      ],
    },
  ];

  const featureScores = [];
  for (const feature of featureChecks) {
    let attempted = false;
    try { attempted = feature.detect(); } catch { attempted = false; }

    if (!attempted) {
      results.expectedFeatures.push({ name: feature.name, status: 'not_attempted', detail: 'no evidence in repo yet (future dev)' });
      continue;
    }

    const passedChecks = feature.checks.filter(c => {
      try { return c.test(); } catch { return false; }
    });
    const passRate = passedChecks.length / feature.checks.length;
    featureScores.push(passRate);

    if (passRate === 1) {
      results.expectedFeatures.push({ name: feature.name, status: 'integrated', detail: `${passedChecks.length}/${feature.checks.length} checks passed` });
    } else if (passRate > 0) {
      results.expectedFeatures.push({ name: feature.name, status: 'partial', detail: `${passedChecks.length}/${feature.checks.length} checks passed` });
      const missing = feature.checks.filter(c => { try { return !c.test(); } catch { return true; } });
      missing.forEach(m => results.missingFeatures.push(`${feature.name}: ${m.desc}`));
    } else {
      results.expectedFeatures.push({ name: feature.name, status: 'not_integrated', detail: 'attempted but 0 checks passed' });
      results.missingFeatures.push(`${feature.name}: code exists but not properly integrated`);
    }
  }

  if (featureScores.length > 0) {
    const avgPassRate = featureScores.reduce((a, b) => a + b, 0) / featureScores.length;
    results.score = Math.round(avgPassRate * 100);
  }

  return results;
}

// ─── MAIN REPORT ───
function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('  BASELINE QUALITY MEASUREMENT REPORT');
  console.log('  Run at:', new Date().toISOString());
  console.log('='.repeat(70) + '\n');

  const metrics = {};

  console.log('─── 1. API Route Consistency ───');
  const routes = checkRouteConsistency();
  metrics.routeConsistency = routes.score;
  console.log(`  Score: ${routes.score}% (${routes.compliant}/${routes.total} routes compliant)`);
  routes.violations.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 2. Multi-tenancy Compliance ───');
  const mt = checkMultiTenancy();
  metrics.multiTenancy = mt.score;
  console.log(`  Score: ${mt.score}% (${mt.compliant}/${mt.total} DB ops with orgId)`);
  mt.violations.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 3. RBAC Compliance ───');
  const rbac = checkRBACCompliance();
  metrics.rbac = rbac.score;
  console.log(`  Score: ${rbac.score}% (${rbac.protected}/${rbac.total} routes protected)`);
  rbac.violations.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 4. Audit Trail Coverage ───');
  const audit = checkAuditCoverage();
  metrics.auditTrail = audit.score;
  console.log(`  Score: ${audit.score}% (${audit.audited}/${audit.total} write ops audited)`);
  audit.violations.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 5. Schema Consistency ───');
  const schema = checkSchemaConsistency();
  metrics.schemaConsistency = schema.score;
  console.log(`  Score: ${schema.score}/100`);
  schema.issues.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 6. Response Format Consistency ───');
  const respFmt = checkResponseFormat();
  metrics.responseFormat = respFmt.score;
  console.log(`  Score: ${respFmt.score}% (${respFmt.compliant}/${respFmt.total} responses compliant)`);
  respFmt.violations.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 7. Dependency Compatibility ───');
  const deps = checkDependencyCompatibility();
  metrics.dependencyCompat = deps.score;
  console.log(`  Score: ${deps.score}% (${deps.resolved}/${deps.total} imports resolved)`);
  deps.broken.forEach(b => console.log(`  ✗ ${b.file} → ${b.requires} (NOT FOUND)`));

  console.log('\n─── 8. Security Compliance ───');
  const sec = checkSecurityCompliance();
  metrics.security = sec.score;
  console.log(`  Score: ${sec.score}/100`);
  if (sec.bcryptRounds) console.log(`  bcrypt rounds: ${sec.bcryptRounds}`);
  sec.issues.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 9. Code Convention Adherence ───');
  const conv = checkCodeConventions();
  metrics.codeConventions = conv.score;
  console.log(`  Score: ${conv.score}/100`);
  conv.violations.forEach(v => console.log(`  ✗ ${v}`));

  console.log('\n─── 10. Duplicate/Dead Code ───');
  const dup = checkDuplicateCode();
  metrics.duplicateCode = dup.score;
  console.log(`  Score: ${dup.score}/100`);
  dup.duplicateModels.forEach(v => console.log(`  ✗ ${v}`));
  if (dup.orphanedFiles.length > 0) {
    console.log(`  Potentially orphaned files: ${dup.orphanedFiles.length}`);
    dup.orphanedFiles.forEach(f => console.log(`    ? ${f}`));
  }

  console.log('\n─── 11. Structural Integrity ───');
  const struct = checkStructuralIntegrity();
  metrics.structuralIntegrity = struct.score;
  console.log(`  Score: ${struct.score}/100`);
  if (struct.misplacedFiles.length > 0) {
    console.log(`  Misplaced files (outside backend/ or frontend/):`);
    struct.misplacedFiles.forEach(f => console.log(`  ✗ ${f}`));
  }
  if (struct.duplicateConfigs.length > 0) {
    console.log(`  Duplicate/conflicting configs:`);
    struct.duplicateConfigs.forEach(f => console.log(`  ✗ ${f}`));
  }
  if (struct.platformArtifacts.length > 0) {
    console.log(`  Platform-specific artifacts:`);
    struct.platformArtifacts.forEach(f => console.log(`  ✗ ${f}`));
  }

  console.log('\n─── 12. Feature Integration ───');
  const feat = checkFeatureIntegration();
  metrics.featureIntegration = feat.score;
  console.log(`  Score: ${feat.score}/100`);
  for (const f of feat.expectedFeatures) {
    const icon = f.status === 'integrated' ? '✓' : f.status === 'partial' ? '◐' : f.status === 'not_integrated' ? '✗' : '○';
    console.log(`  ${icon} ${f.name}: ${f.status} (${f.detail})`);
  }
  feat.missingFeatures.forEach(m => console.log(`  ✗ ${m}`));

  // ─── COMPOSITE SCORE ───
  const numericScores = Object.values(metrics).map(v => parseFloat(v) || 0);
  const compositeScore = (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1);

  console.log('\n' + '='.repeat(70));
  console.log('  COMPOSITE QUALITY SCORE: ' + compositeScore + ' / 100');
  console.log('='.repeat(70));

  console.log('\n  Individual Scores:');
  console.log(`    Route Consistency:      ${metrics.routeConsistency}%`);
  console.log(`    Multi-tenancy:          ${metrics.multiTenancy}%`);
  console.log(`    RBAC Compliance:        ${metrics.rbac}%`);
  console.log(`    Audit Trail:            ${metrics.auditTrail}%`);
  console.log(`    Schema Consistency:     ${metrics.schemaConsistency}/100`);
  console.log(`    Response Format:        ${metrics.responseFormat}%`);
  console.log(`    Dependency Compat:      ${metrics.dependencyCompat}%`);
  console.log(`    Security:               ${metrics.security}/100`);
  console.log(`    Code Conventions:       ${metrics.codeConventions}/100`);
  console.log(`    Duplicate/Dead Code:    ${metrics.duplicateCode}/100`);
  console.log(`    Structural Integrity:   ${metrics.structuralIntegrity}/100`);
  console.log(`    Feature Integration:    ${metrics.featureIntegration}/100`);

  console.log('\n' + '='.repeat(70));

  const output = {
    timestamp: new Date().toISOString(),
    compositeScore: parseFloat(compositeScore),
    metrics,
    details: {
      routeConsistency: routes,
      multiTenancy: mt,
      rbac,
      auditTrail: audit,
      schemaConsistency: schema,
      responseFormat: respFmt,
      dependencyCompat: deps,
      security: sec,
      codeConventions: conv,
      duplicateCode: dup,
      structuralIntegrity: struct,
      featureIntegration: feat,
    },
  };

  const resultsDir = path.join(__dirname, 'measurement-results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
  const resultsFile = path.join(resultsDir, `measure-${Date.now()}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(output, null, 2));
  console.log(`\n  Results saved to: ${resultsFile}\n`);

  return output;
}

generateReport();
