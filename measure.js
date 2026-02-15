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
const ORG_SCOPED_PATTERN = /\/orgs\/:orgId\//;

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

  console.log('\n' + '='.repeat(70));

  // Write results to JSON
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
