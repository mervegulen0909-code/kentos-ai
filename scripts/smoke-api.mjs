import { createRequire } from 'node:module';

const databaseRequire = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = databaseRequire('@prisma/client');

const baseUrl = process.env.KENTOS_API_BASE_URL ?? 'http://127.0.0.1:3110/api/v1';
const internalApiKey = process.env.INTERNAL_API_KEY ?? 'change-me-internal';
const internalEventsKey = process.env.INTERNAL_EVENTS_KEY ?? 'kentos-internal-dev';
const prisma = new PrismaClient();

function section(name) {
  console.log(`\n[${name}]`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseBody(text, path) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${path}, got: ${text.slice(0, 300)}`);
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const body = parseBody(text, path);
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path} -> ${response.status}: ${text}`);
  return { status: response.status, body };
}

async function expectStatus(path, expectedStatus, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const body = parseBody(text, path);
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path} expected ${expectedStatus}, got ${response.status}: ${text}`);
  }
  return { status: response.status, body };
}

async function expectStatusIn(path, expectedStatuses, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const text = await response.text();
  const body = parseBody(text, path);
  if (!expectedStatuses.includes(response.status)) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} expected one of ${expectedStatuses.join(', ')}, got ${response.status}: ${text}`,
    );
  }
  return { status: response.status, body };
}

const unique = Date.now();

section('auth');
const health = await request('/health');
console.log('health', health.status);

const ready = await request('/health/ready');
console.log('ready', ready.status);

const login = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'admin@demo.local', password: 'ChangeMe123!' }),
});
console.log('tenant_admin_login', login.status, Boolean(login.body.accessToken), Boolean(login.body.refreshToken));

const readOnlyLogin = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'readonly@demo.local', password: 'ChangeMe123!' }),
});
console.log('readonly_login', readOnlyLogin.status, readOnlyLogin.body.user.role);

const departmentStaffLogin = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'fen.staff@demo.local', password: 'ChangeMe123!' }),
});
console.log('department_staff_login', departmentStaffLogin.status, departmentStaffLogin.body.user.role);

section('internal event stream ingress');
const internalEvent = await request('/events/internal/emit', {
  method: 'POST',
  body: JSON.stringify({
    key: internalEventsKey,
    event: { type: 'ticket.updated', tenantId: login.body.user.tenantId, payload: { source: 'smoke-api' } },
  }),
});
assert(internalEvent.body.ok === true, 'Internal event emission should accept the configured shared key without JWT.');
await expectStatus('/events/internal/emit', 403, {
  method: 'POST',
  body: JSON.stringify({
    key: `${internalEventsKey}-invalid`,
    event: { type: 'ticket.updated', tenantId: login.body.user.tenantId, payload: { source: 'smoke-api' } },
  }),
});
console.log('internal_events_key_contract', internalEvent.status, true);

const managerLogin = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'manager@demo.local', password: 'ChangeMe123!' }),
});
console.log('manager_login', managerLogin.status, managerLogin.body.user.role);

const operatorLogin = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'operator@demo.local', password: 'ChangeMe123!' }),
});
console.log('operator_login', operatorLogin.status, operatorLogin.body.user.role);

const token = login.body.accessToken;
const readOnlyToken = readOnlyLogin.body.accessToken;
const departmentStaffToken = departmentStaffLogin.body.accessToken;
const managerToken = managerLogin.body.accessToken;
const operatorToken = operatorLogin.body.accessToken;
const departmentStaffUserId = departmentStaffLogin.body.user.id;

await expectStatus('/auth/refresh', 401, {
  method: 'POST',
  body: JSON.stringify({ refreshToken: login.body.accessToken }),
});

await prisma.user.update({ where: { id: operatorLogin.body.user.id }, data: { isActive: false } });
try {
  await expectStatus('/auth/refresh', 401, {
    method: 'POST',
    body: JSON.stringify({ refreshToken: operatorLogin.body.refreshToken }),
  });
  await expectStatusIn('/departments', [401, 403], { token: operatorLogin.body.accessToken });
  console.log('inactive_user_auth_revalidation', true);
} finally {
  await prisma.user.update({ where: { id: operatorLogin.body.user.id }, data: { isActive: true } });
}

await prisma.user.update({ where: { id: readOnlyLogin.body.user.id }, data: { role: 'OPERATOR' } });
try {
  const refreshedReadOnlyLogin = await request('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken: readOnlyLogin.body.refreshToken }),
  });
  const refreshedPayload = JSON.parse(
    Buffer.from(refreshedReadOnlyLogin.body.accessToken.split('.')[1], 'base64url').toString('utf8'),
  );
  assert(refreshedPayload.role === 'OPERATOR', 'Refresh did not derive current user role from the database.');
  console.log('refresh_db_role_revalidation', true);
} finally {
  await prisma.user.update({ where: { id: readOnlyLogin.body.user.id }, data: { role: readOnlyLogin.body.user.role } });
}

section('user management');
const userList = await request('/users', { token });
assert(Array.isArray(userList.body), 'GET /users should return an array.');
assert(userList.body.length > 0, 'GET /users should return at least the seeded admin user.');
assert(userList.body.every((u) => u.id && u.email && u.fullName && u.role), 'User list items missing required fields.');
console.log('user_list', userList.status, `${userList.body.length} kullanici`);

const createdUser = await request('/users', {
  method: 'POST',
  token,
  body: JSON.stringify({
    email: `smoke-${unique}@demo.local`,
    fullName: `Smoke Personel ${unique}`,
    password: 'SmokePassword1!',
    role: 'OPERATOR',
  }),
});
assert(createdUser.body.id, 'Created user should have an id.');
assert(createdUser.body.role === 'OPERATOR', 'Created user should have OPERATOR role.');
console.log('user_create', createdUser.status, createdUser.body.email);

const updatedUser = await request(`/users/${createdUser.body.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ fullName: `Smoke Personel Guncellendi ${unique}`, isActive: false }),
});
assert(updatedUser.body.isActive === false, 'Updated user should be inactive.');
console.log('user_update', updatedUser.status, updatedUser.body.isActive);

// READ_ONLY must not create users
await expectStatus('/users', 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ email: `readonly-${unique}@demo.local`, fullName: 'RO', password: 'SomePass1!' }),
});
console.log('user_rbac_readonly_create_denied', true);

section('settings RBAC');
const departments = await request('/departments', { token });
console.log('departments', departments.body.length);

const fenDepartment = departments.body.find((department) => department.code === 'FEN_ISLERI');
assert(fenDepartment, 'Seeded FEN_ISLERI department not found for smoke.');
const temizlikDepartment = departments.body.find((department) => department.code === 'TEMIZLIK');
assert(temizlikDepartment, 'Seeded TEMIZLIK department not found for smoke.');

const createdDepartment = await request('/departments', {
  method: 'POST',
  token,
  body: JSON.stringify({ code: `SMOKE_${unique}`, name: `Smoke Birimi ${unique}` }),
});
console.log('department_create', createdDepartment.status, createdDepartment.body.code);

const updatedDepartment = await request(`/departments/${createdDepartment.body.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ name: `Smoke Birimi Güncel ${unique}` }),
});
console.log('department_update', updatedDepartment.status, updatedDepartment.body.name.includes('Güncel'));

const createdCategory = await request('/categories', {
  method: 'POST',
  token,
  body: JSON.stringify({
    code: `SMOKE_CAT_${unique}`,
    name: `Smoke Kategorisi ${unique}`,
    departmentId: createdDepartment.body.id,
    defaultPriority: 'NORMAL',
  }),
});
console.log('category_create', createdCategory.status, createdCategory.body.code);

const updatedCategory = await request(`/categories/${createdCategory.body.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({
    name: `Smoke Kategorisi Guncel ${unique}`,
    departmentId: createdDepartment.body.id,
    defaultPriority: 'HIGH',
  }),
});
console.log('category_update', updatedCategory.status, updatedCategory.body.defaultPriority === 'HIGH');

const createdSlaPolicy = await request('/sla-policies', {
  method: 'POST',
  token,
  body: JSON.stringify({
    priority: 'LOW',
    responseMinutes: 120,
    resolutionMinutes: 360,
    departmentId: createdDepartment.body.id,
    categoryId: createdCategory.body.id,
  }),
});
console.log('sla_policy_create', createdSlaPolicy.status, createdSlaPolicy.body.priority);

const updatedSlaPolicy = await request(`/sla-policies/${createdSlaPolicy.body.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ responseMinutes: 180 }),
});
console.log('sla_policy_update', updatedSlaPolicy.status, updatedSlaPolicy.body.responseMinutes === 180);

const messageTemplates = await request('/message-templates', { token });
const firstTemplate = messageTemplates.body[0];
assert(firstTemplate, 'No seeded message template found for smoke.');
const updatedTemplate = await request(`/message-templates/${firstTemplate.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ body: firstTemplate.body }),
});
console.log('message_template_update', updatedTemplate.status, Boolean(updatedTemplate.body.id));
const widgetSettings = await request('/widget-settings', { token });
assert(widgetSettings.body.widgetTitle, 'Widget settings missing title.');
const updatedWidgetSettings = await request('/widget-settings', {
  method: 'PATCH',
  token,
  body: JSON.stringify({
    widgetEnabled: true,
    widgetTitle: `Smoke Widget ${unique}`,
    widgetWelcome: 'Smoke widget karsilama metni.',
    widgetAllowedOrigins: ['http://localhost:3112', 'http://127.0.0.1:3112'],
  }),
});
assert(updatedWidgetSettings.body.widgetAllowedOrigins.includes('http://127.0.0.1:3112'), 'Widget origin allowlist was not persisted.');
assert(updatedWidgetSettings.body.widgetAllowedOrigins.includes('http://localhost:3112'), 'Widget origin allowlist missed localhost QA origin.');
const widgetStatus = await request('/public/demo-belediye/widget-status', {
  headers: { 'x-probe-origin': 'http://127.0.0.1:3112' },
});
assert(widgetStatus.body.widgetReady === true, 'Widget status did not report widgetReady=true for seeded tenant.');
assert(widgetStatus.body.originAllowed === true, 'Widget status did not mark QA origin as allowed.');
assert(typeof widgetStatus.body.allowedOriginCount === 'number', 'Widget status missing allowedOriginCount.');
console.log('widget_status', widgetStatus.status, widgetStatus.body.widgetReady, widgetStatus.body.originAllowed);
await request('/widget-settings', {
  method: 'PATCH',
  token,
  body: JSON.stringify({
    widgetEnabled: true,
    widgetTitle: widgetSettings.body.widgetTitle,
    widgetWelcome: widgetSettings.body.widgetWelcome,
    widgetAllowedOrigins: widgetSettings.body.widgetAllowedOrigins,
  }),
});
await expectStatus('/widget-settings', 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ widgetTitle: 'Read only widget update' }),
});
console.log('widget_settings_update', updatedWidgetSettings.status, updatedWidgetSettings.body.widgetTitle);

const retentionSettings = await request('/retention-settings', { token });
assert(retentionSettings.body.defaults && retentionSettings.body.overrides, 'Retention settings GET missing defaults or overrides.');
const retentionUpdate = await request('/retention-settings', {
  method: 'PATCH',
  token,
  body: JSON.stringify({ 'attachments': 30, 'audit-logs': 720 }),
});
assert(retentionUpdate.body.overrides.attachments === 30, 'Retention attachments override not persisted.');
assert(retentionUpdate.body.overrides['audit-logs'] === 720, 'Retention audit-logs override not persisted.');
await expectStatus('/retention-settings', 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ 'attachments': 999 }),
});
// Reset overrides to keep smoke output stable across reruns.
await request('/retention-settings', {
  method: 'PATCH',
  token,
  body: JSON.stringify({}),
});
console.log('retention_settings_rw', retentionUpdate.status);

const aiBudget = await request('/ai-budget-settings', { token });
assert(aiBudget.body.overrides !== undefined, 'AI budget settings GET missing overrides.');
const aiBudgetUpdate = await request('/ai-budget-settings', {
  method: 'PATCH',
  token,
  body: JSON.stringify({ dailyTokenBudget: 50000, perRequestTokenLimit: 800 }),
});
assert(aiBudgetUpdate.body.overrides.dailyTokenBudget === 50000, 'AI budget dailyTokenBudget not persisted.');
assert(aiBudgetUpdate.body.overrides.perRequestTokenLimit === 800, 'AI budget perRequestTokenLimit not persisted.');
await expectStatus('/ai-budget-settings', 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ dailyTokenBudget: 9999 }),
});
await request('/ai-budget-settings', {
  method: 'PATCH',
  token,
  body: JSON.stringify({}),
});
console.log('ai_budget_settings_rw', aiBudgetUpdate.status);
const disabledTemplate = await request(`/message-templates/${firstTemplate.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ body: firstTemplate.body, isActive: false }),
});
assert(disabledTemplate.body.isActive === false, 'Message template was not disabled.');
const templatesAfterDisable = await request('/message-templates', { token });
const disabledTemplateEntry = templatesAfterDisable.body.find((template) => template.id === firstTemplate.id);
assert(disabledTemplateEntry?.isActive === false, 'Disabled message template disappeared from settings list.');
await request(`/message-templates/${firstTemplate.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ body: firstTemplate.body, isActive: true }),
});
const existingCitizenWebReceivedTemplate = await prisma.messageTemplate.findFirst({
  where: {
    tenantId: login.body.user.tenantId,
    key: 'TICKET_RECEIVED',
    locale: 'tr-TR',
    channel: 'CITIZEN_WEB',
  },
});
const citizenWebReceivedTemplateBody = 'Kanal özel takip kodu: {{trackingToken}}.';
if (existingCitizenWebReceivedTemplate) {
  await prisma.messageTemplate.update({
    where: { id: existingCitizenWebReceivedTemplate.id },
    data: { body: citizenWebReceivedTemplateBody, isActive: true },
  });
} else {
  await prisma.messageTemplate.create({
    data: {
      tenantId: login.body.user.tenantId,
      key: 'TICKET_RECEIVED',
      locale: 'tr-TR',
      channel: 'CITIZEN_WEB',
      body: citizenWebReceivedTemplateBody,
    },
  });
}

await expectStatus('/departments', 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ code: `RO_DEPT_${unique}`, name: `Read Only Birim ${unique}` }),
});
await expectStatus(`/departments/${createdDepartment.body.id}`, 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ name: `Read Only Birim Güncel ${unique}` }),
});
await expectStatus('/categories', 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ code: `RO_CAT_${unique}`, name: `Read Only Kategori ${unique}` }),
});
await expectStatus(`/categories/${createdCategory.body.id}`, 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ name: `Read Only Kategori Güncel ${unique}` }),
});
await expectStatus('/sla-policies', 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ priority: 'NORMAL', responseMinutes: 60, resolutionMinutes: 240 }),
});
await expectStatus(`/sla-policies/${createdSlaPolicy.body.id}`, 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ responseMinutes: 240 }),
});
await expectStatus(`/message-templates/${firstTemplate.id}`, 403, {
  method: 'PATCH',
  token: readOnlyToken,
  body: JSON.stringify({ body: 'Read only kullanıcı bu şablonu değiştirememeli.' }),
});
console.log('settings_rbac_negative', true);

section('analytics');
const analyticsOverview = await request('/analytics/overview', { token });
assert(typeof analyticsOverview.body.totalOpen === 'number', 'Admin analytics overview missing totalOpen.');
const analyticsDepartments = await request('/analytics/departments', { token });
assert(Array.isArray(analyticsDepartments.body), 'Admin analytics departments response is not an array.');
const analyticsCategories = await request('/analytics/categories', { token });
assert(Array.isArray(analyticsCategories.body), 'Admin analytics categories response is not an array.');
const analyticsNeighborhoods = await request('/analytics/neighborhoods', { token });
assert(Array.isArray(analyticsNeighborhoods.body), 'Admin analytics neighborhoods response is not an array.');
const analyticsChannels = await request('/analytics/channels', { token });
assert(Array.isArray(analyticsChannels.body), 'Admin analytics channels response is not an array.');
const analyticsConversationSegments = await request('/analytics/conversation-segments', { token });
for (const key of ['aiCompleted', 'operatorHandoff', 'awaitingInfo', 'automationRate']) {
  assert(
    typeof analyticsConversationSegments.body[key] === 'number',
    `Analytics conversation segments missing numeric ${key}.`,
  );
}
const analyticsOutboundDeliveries = await request('/analytics/outbound-deliveries', { token });
for (const key of ['total', 'pending', 'dispatched', 'delivered', 'failed', 'skipped']) {
  assert(
    typeof analyticsOutboundDeliveries.body[key] === 'number',
    `Analytics outbound deliveries missing numeric ${key}.`,
  );
}
assert(Array.isArray(analyticsOutboundDeliveries.body.byChannel), 'Analytics outbound deliveries byChannel is not an array.');
assert(Array.isArray(analyticsOutboundDeliveries.body.recentFailures), 'Analytics outbound deliveries recentFailures is not an array.');
for (const channel of ['WEB_CHAT', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'SMS']) {
  assert(
    analyticsChannels.body.some((row) => row.channel === channel),
    `Analytics channels missing seeded ${channel} row.`,
  );
}
const managerAnalyticsOverview = await request('/analytics/overview', { token: managerToken });
assert(typeof managerAnalyticsOverview.body.totalOpen === 'number', 'Manager analytics overview missing totalOpen.');
const managerAnalyticsDepartments = await request('/analytics/departments', { token: managerToken });
assert(Array.isArray(managerAnalyticsDepartments.body), 'Manager analytics departments response is not an array.');
const managerAnalyticsChannels = await request('/analytics/channels', { token: managerToken });
assert(Array.isArray(managerAnalyticsChannels.body), 'Manager analytics channels response is not an array.');
await expectStatus('/analytics/overview', 403, { token: operatorToken });
await expectStatus('/analytics/departments', 403, { token: operatorToken });
await expectStatus('/analytics/channels', 403, { token: operatorToken });
await expectStatus('/analytics/conversation-segments', 403, { token: operatorToken });
await expectStatus('/analytics/outbound-deliveries', 403, { token: operatorToken });
await expectStatus('/analytics/overview', 403, { token: departmentStaffToken });
await expectStatus('/analytics/channels', 403, { token: departmentStaffToken });
await expectStatus('/analytics/overview', 403, { token: readOnlyToken });
await expectStatus('/analytics/conversation-segments', 403, { token: readOnlyToken });
await expectStatus('/analytics/outbound-deliveries', 403, { token: readOnlyToken });

const aiUsage = await request('/analytics/ai-usage', { token });
for (const window of ['last24h', 'last7d', 'last30d']) {
  assert(aiUsage.body.windows[window], `Analytics ai-usage missing ${window} window.`);
  assert(typeof aiUsage.body.windows[window].runs === 'number', `Analytics ai-usage ${window}.runs not numeric.`);
  assert(typeof aiUsage.body.windows[window].costMicros === 'number', `Analytics ai-usage ${window}.costMicros not numeric.`);
}
assert(Array.isArray(aiUsage.body.byProvider), 'Analytics ai-usage byProvider not an array.');
await expectStatus('/analytics/ai-usage', 403, { token: operatorToken });
await expectStatus('/analytics/ai-usage', 403, { token: readOnlyToken });
console.log('ai_usage_read', true);

const forbiddenAnalyticsKeys = ['citizen', 'citizens', 'citizenId', 'phone', 'email', 'auditLogs', 'messages', 'internalNotes', 'aiRuns', 'aiClassification'];
const analyticsPayload = JSON.stringify([analyticsOverview.body, analyticsDepartments.body, analyticsCategories.body, analyticsNeighborhoods.body, analyticsChannels.body, analyticsConversationSegments.body, analyticsOutboundDeliveries.body, managerAnalyticsOverview.body, managerAnalyticsDepartments.body, managerAnalyticsChannels.body]);
for (const key of forbiddenAnalyticsKeys) {
  assert(!analyticsPayload.includes(`"${key}"`), `Analytics response leaked ${key}.`);
}
console.log('analytics_read', true);

section('ticket workflow');
const operatorTicket = await request('/tickets', {
  method: 'POST',
  token,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Smoke operasyon talebi ${unique}`,
    description: 'Smoke testi için operatör tarafından oluşturulan talep.',
    priority: 'NORMAL',
    departmentId: createdDepartment.body.id,
    categoryId: createdCategory.body.id,
    addressText: 'Smoke Mahallesi',
  }),
});
console.log('ticket_create', operatorTicket.status, operatorTicket.body.ticketNo);

const note = await request(`/tickets/${operatorTicket.body.id}/notes`, {
  method: 'POST',
  token,
  body: JSON.stringify({ body: 'Smoke iç notu.' }),
});
console.log('ticket_note', note.status, Boolean(note.body.id));

const publicMessage = await request(`/tickets/${operatorTicket.body.id}/public-messages`, {
  method: 'POST',
  token,
  body: JSON.stringify({ body: 'Smoke public mesajı.' }),
});
console.log('ticket_public_message', publicMessage.status, Boolean(publicMessage.body.id));

const adminAttachmentUpload = await request('/attachments/uploads', {
  method: 'POST',
  token,
  body: JSON.stringify({
    ticketId: operatorTicket.body.id,
    fileName: `smoke-admin-${unique}.txt`,
    mimeType: 'text/plain',
    sizeBytes: 24,
  }),
});
assert(adminAttachmentUpload.body.uploadUrl, 'Admin attachment upload did not return a presigned URL.');
assert(!Object.hasOwn(adminAttachmentUpload.body, 'storageKey'), 'Admin attachment init leaked internal storage key.');
await request(`/attachments/${adminAttachmentUpload.body.attachmentId}/confirm`, {
  method: 'POST',
  token,
  body: JSON.stringify({ checksumSha256: 'b'.repeat(64) }),
});
const adminAttachmentDownload = await request(`/attachments/${adminAttachmentUpload.body.attachmentId}/download`, { token });
assert(adminAttachmentDownload.body.downloadUrl, 'Admin attachment download did not return a signed URL.');

const quarantinedList = await request('/attachments/quarantined', { token });
assert(Array.isArray(quarantinedList.body.data), 'Attachments quarantined data is not an array.');
assert(typeof quarantinedList.body.meta?.total === 'number', 'Attachments quarantined pagination metadata is missing.');
await expectStatus('/attachments/quarantined', 403, { token: operatorToken });
await expectStatus('/attachments/quarantined', 403, { token: readOnlyToken });
const rescanResponse = await request(`/attachments/${adminAttachmentUpload.body.attachmentId}/rescan`, {
  method: 'POST',
  token,
});
assert(rescanResponse.body.scanStatus === 'PENDING', 'Rescan did not reset scanStatus to PENDING.');
await expectStatus(`/attachments/${adminAttachmentUpload.body.attachmentId}/rescan`, 403, {
  method: 'POST',
  token: operatorToken,
});
await expectStatus(`/attachments/${adminAttachmentUpload.body.attachmentId}/rescan`, 403, {
  method: 'POST',
  token: readOnlyToken,
});
console.log('attachment_scan_endpoints', true);
const publicMessageWithAttachment = await request(`/tickets/${operatorTicket.body.id}/public-messages`, {
  method: 'POST',
  token,
  body: JSON.stringify({
    body: 'Smoke public mesaji ekli.',
    attachmentIds: [adminAttachmentUpload.body.attachmentId],
  }),
});
assert(publicMessageWithAttachment.body.id, 'Admin public message with attachment was not persisted.');
console.log('admin_attachment_contract', true);

const statusUpdate = await request(`/tickets/${operatorTicket.body.id}/status`, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'ASSIGNED', publicMessage: 'Talebiniz ilgili birime atandı.' }),
});
console.log('ticket_status', statusUpdate.status, statusUpdate.body.status);

await request(`/tickets/${operatorTicket.body.id}/assign`, {
  method: 'POST',
  token,
  body: JSON.stringify({ departmentId: createdDepartment.body.id }),
});
await expectStatus(`/tickets/${operatorTicket.body.id}/assign`, 403, {
  method: 'POST',
  token,
  body: JSON.stringify({ departmentId: createdDepartment.body.id, assignedToId: departmentStaffUserId }),
});
console.log('ticket_assign', true);

const auditLog = await request(`/tickets/${operatorTicket.body.id}/audit-log`, { token });
console.log('ticket_audit', auditLog.status, auditLog.body.length > 0);

await expectStatus('/tickets', 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Read only ticket create ${unique}`,
    description: 'Read only kullanıcı ticket oluşturamamalı.',
    priority: 'NORMAL',
    departmentId: createdDepartment.body.id,
    categoryId: createdCategory.body.id,
    addressText: 'Read Only Mahallesi',
  }),
});
await expectStatus(`/tickets/${operatorTicket.body.id}/notes`, 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ body: 'Read only iç not ekleyememeli.' }),
});
await expectStatus(`/tickets/${operatorTicket.body.id}/public-messages`, 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ body: 'Read only public mesaj ekleyememeli.' }),
});
await expectStatus(`/tickets/${operatorTicket.body.id}/status`, 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ status: 'IN_PROGRESS' }),
});
await expectStatus(`/tickets/${operatorTicket.body.id}/assign`, 403, {
  method: 'POST',
  token: readOnlyToken,
  body: JSON.stringify({ departmentId: createdDepartment.body.id }),
});
console.log('ticket_rbac_negative', true);

section('role matrix');
const operatorMatrixTicket = await request('/tickets', {
  method: 'POST',
  token: operatorToken,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Smoke operatör rol talebi ${unique}`,
    description: 'Operatör role matrix testi için oluşturulan talep.',
    priority: 'NORMAL',
    departmentId: createdDepartment.body.id,
    categoryId: createdCategory.body.id,
    addressText: 'Operatör Mahallesi',
  }),
});
await request(`/tickets/${operatorMatrixTicket.body.id}/notes`, {
  method: 'POST',
  token: operatorToken,
  body: JSON.stringify({ body: 'Operatör role matrix iç notu.' }),
});
await request(`/tickets/${operatorMatrixTicket.body.id}/status`, {
  method: 'POST',
  token: operatorToken,
  body: JSON.stringify({ status: 'ASSIGNED' }),
});
const managerTickets = await request(`/tickets?q=${encodeURIComponent(operatorMatrixTicket.body.title)}`, { token: managerToken });
assert(managerTickets.body.data.some((ticket) => ticket.id === operatorMatrixTicket.body.id), 'Manager cannot see tenant ticket list.');
const managerMatrixTicket = await request(`/tickets/${operatorMatrixTicket.body.id}`, { token: managerToken });
assert(managerMatrixTicket.body.id === operatorMatrixTicket.body.id, 'Manager cannot read tenant ticket detail.');
await request(`/tickets/${operatorMatrixTicket.body.id}/public-messages`, {
  method: 'POST',
  token: managerToken,
  body: JSON.stringify({ body: 'Manager role matrix public mesajı.' }),
});
console.log('role_matrix', true);

section('department scoping');
const fenTicket = await request('/tickets', {
  method: 'POST',
  token,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Smoke Fen talebi ${unique}`,
    description: 'Fen İşleri kapsam testi için oluşturulan talep.',
    priority: 'NORMAL',
    departmentId: fenDepartment.id,
    addressText: 'Fen Mahallesi',
  }),
});
console.log('department_staff_visible_ticket_create', fenTicket.status, fenTicket.body.ticketNo);

const temizlikTicket = await request('/tickets', {
  method: 'POST',
  token,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Smoke Temizlik talebi ${unique}`,
    description: 'Departman dışı kapsam testi için oluşturulan talep.',
    priority: 'NORMAL',
    departmentId: temizlikDepartment.id,
    addressText: 'Temizlik Mahallesi',
  }),
});
console.log('department_staff_hidden_ticket_create', temizlikTicket.status, temizlikTicket.body.ticketNo);

const departmentStaffTickets = await request(`/tickets?q=${encodeURIComponent(fenTicket.body.title)}`, { token: departmentStaffToken });
const departmentStaffTicketIds = departmentStaffTickets.body.data.map((ticket) => ticket.id);
assert(departmentStaffTicketIds.includes(fenTicket.body.id), 'Department staff cannot see own department ticket.');
const departmentStaffHiddenTickets = await request(`/tickets?q=${encodeURIComponent(temizlikTicket.body.title)}`, { token: departmentStaffToken });
assert(!departmentStaffHiddenTickets.body.data.some((ticket) => ticket.id === temizlikTicket.body.id), 'Department staff can see another department ticket.');

const departmentStaffFenTicket = await request(`/tickets/${fenTicket.body.id}`, { token: departmentStaffToken });
console.log('department_staff_read_scope', departmentStaffFenTicket.status, departmentStaffFenTicket.body.department.id === fenDepartment.id);
await expectStatus(`/tickets/${temizlikTicket.body.id}`, 404, { token: departmentStaffToken });
const departmentStaffFilteredOutTickets = await expectStatus(`/tickets?departmentId=${temizlikDepartment.id}`, 200, { token: departmentStaffToken });
assert(departmentStaffFilteredOutTickets.body.data.length === 0, 'Department staff department filter returned out-of-scope tickets.');

await request(`/tickets/${fenTicket.body.id}/notes`, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ body: 'Fen personeli kapsam içi iç notu.' }),
});
await expectStatus(`/tickets/${temizlikTicket.body.id}/notes`, 404, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ body: 'Departman dışı iç not eklenememeli.' }),
});
await expectStatus(`/tickets/${temizlikTicket.body.id}/public-messages`, 404, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ body: 'Departman dışı public mesaj eklenememeli.' }),
});
await expectStatus(`/tickets/${temizlikTicket.body.id}/status`, 404, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ status: 'IN_PROGRESS' }),
});
await expectStatus(`/tickets/${temizlikTicket.body.id}/assign`, 403, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ departmentId: fenDepartment.id }),
});
await expectStatus(`/tickets/${fenTicket.body.id}/assign`, 403, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ departmentId: fenDepartment.id }),
});
await expectStatus(`/tickets/${fenTicket.body.id}/assign`, 403, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({ departmentId: temizlikDepartment.id }),
});
await expectStatus('/tickets', 403, {
  method: 'POST',
  token: departmentStaffToken,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Smoke departmansız personel talebi ${unique}`,
    description: 'Departman personeli departmansız talep açamamalı.',
    priority: 'NORMAL',
    addressText: 'Kapsamsız Mahalle',
  }),
});
console.log('department_staff_ticket_scope', true);

section('ticket transition guards');
const transitionTicket = await request('/tickets', {
  method: 'POST',
  token,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Smoke transition talebi ${unique}`,
    description: 'Status transition guard testi için oluşturulan talep.',
    priority: 'NORMAL',
    departmentId: createdDepartment.body.id,
    categoryId: createdCategory.body.id,
    addressText: 'Transition Mahallesi',
  }),
});
await request(`/tickets/${transitionTicket.body.id}/status`, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'ASSIGNED' }),
});
await request(`/tickets/${transitionTicket.body.id}/status`, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'IN_PROGRESS' }),
});
await request(`/tickets/${transitionTicket.body.id}/status`, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'RESOLVED' }),
});
await request(`/tickets/${transitionTicket.body.id}/status`, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'CLOSED' }),
});
await expectStatus(`/tickets/${transitionTicket.body.id}/status`, 403, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'IN_PROGRESS' }),
});
await expectStatus(`/tickets/${transitionTicket.body.id}/notes`, 403, {
  method: 'POST',
  token,
  body: JSON.stringify({ body: 'Kapalı talebe iç not eklenememeli.' }),
});
await expectStatus(`/tickets/${transitionTicket.body.id}/assign`, 403, {
  method: 'POST',
  token,
  body: JSON.stringify({ departmentId: createdDepartment.body.id }),
});
console.log('closed_ticket_transition_guard', true);

section('audit coverage');
const auditedEntries = auditLog.body.filter((entry) => ['ticket.assigned', 'ticket.status_changed', 'ticket.internal_note_added', 'ticket.public_message_added'].includes(entry.action));
const auditedActions = new Set(auditedEntries.map((entry) => entry.action));
for (const action of ['ticket.assigned', 'ticket.status_changed', 'ticket.internal_note_added', 'ticket.public_message_added']) {
  assert(auditedActions.has(action), `Audit log missing ${action}.`);
}
for (const entry of auditedEntries) {
  assert(entry.actorType === 'USER', `Audit log ${entry.action} actorType is not USER.`);
  assert(entry.actorUserId === login.body.user.id, `Audit log ${entry.action} actorUserId mismatch.`);
}
console.log('audit_coverage', true);

section('settings audit coverage');
const settingsAuditActions = [
  'tenant.department_created',
  'tenant.department_updated',
  'tenant.category_created',
  'tenant.category_updated',
  'tenant.sla_policy_created',
  'tenant.sla_policy_updated',
  'tenant.message_template_updated',
  'tenant.widget_settings_updated',
];
const settingsAuditEntries = await prisma.auditLog.findMany({
  where: {
    tenantId: login.body.user.tenantId,
    actorUserId: login.body.user.id,
    action: { in: settingsAuditActions },
  },
  orderBy: { createdAt: 'desc' },
  take: 20,
});
const settingsAuditFound = new Set(settingsAuditEntries.map((entry) => entry.action));
for (const action of settingsAuditActions) {
  assert(settingsAuditFound.has(action), `Settings audit log missing ${action}.`);
}
console.log('settings_audit_coverage', true);

section('public safety');
const publicPhone = `+90555${String(unique).slice(-7).padStart(7, '0')}`;
const existingPublicContactCitizen = await prisma.citizen.create({
  data: {
    tenantId: login.body.user.tenantId,
    displayName: `Mevcut Vatandas ${unique}`,
    phone: publicPhone,
    email: `existing-${unique}@example.test`,
  },
});
await expectStatus('/internal/channel-ingest', 403, {
  method: 'POST',
  body: JSON.stringify({
    tenantId: login.body.user.tenantId,
    channel: 'WHATSAPP',
    provider: 'baileys',
    externalConversationId: `wa-smoke-${unique}`,
    externalMessageId: `wa-msg-${unique}`,
    text: 'Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü. Telefonum ' + publicPhone,
    receivedAt: new Date().toISOString(),
    citizenContact: { phone: publicPhone, displayName: `WhatsApp Basvuran ${unique}` },
  }),
});
const whatsappIngest = await request('/internal/channel-ingest', {
  method: 'POST',
  headers: { 'x-kentos-internal-key': internalApiKey },
  body: JSON.stringify({
    tenantId: login.body.user.tenantId,
    channel: 'WHATSAPP',
    provider: 'baileys',
    externalConversationId: `wa-smoke-${unique}`,
    externalMessageId: `wa-msg-${unique}`,
    text: 'Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü. Telefonum ' + publicPhone,
    receivedAt: new Date().toISOString(),
    citizenContact: { phone: publicPhone, displayName: `WhatsApp Basvuran ${unique}` },
  }),
});
assert(whatsappIngest.body.channel === 'WHATSAPP', 'WhatsApp ingest did not preserve channel.');
assert(whatsappIngest.body.trackingToken || whatsappIngest.body.followUpQuestion, 'WhatsApp ingest did not return a ticket or follow-up state.');
console.log('whatsapp_internal_ingest', whatsappIngest.status, whatsappIngest.body.state);
const whatsappEventCountBeforeReplay = await prisma.channelEvent.count({
  where: {
    tenantId: login.body.user.tenantId,
    channel: 'WHATSAPP',
    provider: 'baileys',
    externalEventId: `wa-msg-${unique}`,
  },
});
const whatsappReplay = await request('/internal/channel-ingest', {
  method: 'POST',
  headers: { 'x-kentos-internal-key': internalApiKey },
  body: JSON.stringify({
    tenantId: login.body.user.tenantId,
    channel: 'WHATSAPP',
    provider: 'baileys',
    externalConversationId: `wa-smoke-${unique}`,
    externalMessageId: `wa-msg-${unique}`,
    text: 'Replay smoke text ' + publicPhone,
    receivedAt: new Date().toISOString(),
    citizenContact: { phone: publicPhone },
  }),
});
const whatsappEventCountAfterReplay = await prisma.channelEvent.count({
  where: {
    tenantId: login.body.user.tenantId,
    channel: 'WHATSAPP',
    provider: 'baileys',
    externalEventId: `wa-msg-${unique}`,
  },
});
assert(whatsappReplay.body.conversationId === whatsappIngest.body.conversationId, 'WhatsApp replay did not return the existing conversation.');
assert(whatsappEventCountAfterReplay === whatsappEventCountBeforeReplay, 'WhatsApp replay created a duplicate channel event.');
console.log('whatsapp_internal_ingest_idempotency', true);

await expectStatus('/public/demo-belediye/tickets', 403, {
  method: 'POST',
  headers: { Origin: 'https://kotu-ornek.invalid' },
  body: JSON.stringify({
    description: 'Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü.',
    displayName: `Blocked Origin ${unique}`,
    phone: publicPhone,
    addressText: 'Atatürk Mahallesi 12. Sokak',
  }),
});

const publicAttachmentUpload = await request('/public/demo-belediye/attachments/uploads', {
  method: 'POST',
  headers: { Origin: 'http://localhost:3112' },
  body: JSON.stringify({
    fileName: `smoke-public-${unique}.txt`,
    mimeType: 'text/plain',
    sizeBytes: 26,
  }),
});
assert(publicAttachmentUpload.body.uploadUrl, 'Public attachment upload did not return a presigned URL.');
assert(!Object.hasOwn(publicAttachmentUpload.body, 'storageKey'), 'Public attachment init leaked internal storage key.');
await request(`/public/demo-belediye/attachments/${publicAttachmentUpload.body.attachmentId}/confirm`, {
  method: 'POST',
  headers: { Origin: 'http://localhost:3112' },
  body: JSON.stringify({ checksumSha256: 'c'.repeat(64) }),
});

const publicTicket = await request('/public/demo-belediye/tickets', {
  method: 'POST',
  headers: { Origin: 'http://localhost:3112' },
  body: JSON.stringify({
    description: 'Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü.',
    displayName: `Public Basvuran ${unique}`,
    phone: publicPhone,
    email: `public-${unique}@example.test`,
    attachmentIds: [publicAttachmentUpload.body.attachmentId],
    addressText: 'Atatürk Mahallesi 12. Sokak',
  }),
});
console.log('public_create', publicTicket.status, publicTicket.body.trackingToken);
assert(/^TK-[A-F0-9]{16}$/.test(publicTicket.body.trackingToken), 'Public ticket tracking token format is invalid.');
assert(!Object.hasOwn(publicTicket.body, 'ticketNo'), 'Public ticket creation leaked internal ticketNo.');

const tracked = await request(`/public/demo-belediye/tickets/${publicTicket.body.trackingToken}`);
assert(tracked.body.attachments?.some((attachment) => attachment.fileName.startsWith('smoke-public-')), 'Public ticket did not expose safe attachment metadata.');
assert(!JSON.stringify(tracked.body).includes('storageKey'), 'Public ticket leaked attachment storage key.');
const publicAttachmentDownload = await request(`/public/demo-belediye/attachments/${publicAttachmentUpload.body.attachmentId}/download?trackingToken=${encodeURIComponent(publicTicket.body.trackingToken)}`, {
  headers: { Origin: 'http://localhost:3112' },
});
assert(publicAttachmentDownload.body.downloadUrl, 'Public attachment download did not return a signed URL.');
assert(tracked.body.publicMessages.length > 0, 'Public ticket should include an automatic public status message.');
assert(
  tracked.body.publicMessages.some((message) => message.body === `Kanal özel takip kodu: ${publicTicket.body.trackingToken}.`),
  'Public ticket did not use the channel-specific received template.',
);
const publicTicketMessage = await request(`/public/demo-belediye/tickets/${publicTicket.body.trackingToken}/messages`, {
  method: 'POST',
  body: JSON.stringify({
    contact: publicPhone,
    body: 'Ek bilgi: kaldirim coken alan genisliyor.',
  }),
});
assert(
  publicTicketMessage.body.publicMessages.some((message) => message.body === 'Ek bilgi: kaldirim coken alan genisliyor.'),
  'Public ticket message was not persisted.',
);

const publicTicketAdminView = await request('/tickets?q=kald%C4%B1r%C4%B1m%20%C3%A7%C3%B6kt%C3%BC', { token });
const publicTicketRecord = publicTicketAdminView.body.data.find((ticket) => ticket.publicTrackingToken === publicTicket.body.trackingToken);
assert(publicTicketRecord, 'Public ticket not visible from staff list for audit verification.');
const publicTicketDbRecord = await prisma.ticket.findFirst({
  where: { tenantId: login.body.user.tenantId, publicTrackingToken: publicTicket.body.trackingToken },
  select: { citizenId: true },
});
const updatedPublicContactCitizen = await prisma.citizen.findUnique({ where: { id: existingPublicContactCitizen.id } });
const normalizedPublicPhone = publicPhone.replace(/\D+/g, '');
const citizenPhoneIdentifier = await prisma.citizenIdentifier.findFirst({
  where: {
    tenantId: login.body.user.tenantId,
    citizenId: existingPublicContactCitizen.id,
    kind: 'PHONE',
    normalizedValue: normalizedPublicPhone,
  },
});
assert(publicTicketDbRecord?.citizenId === existingPublicContactCitizen.id, 'Public intake did not reuse the existing citizen contact record.');
assert(citizenPhoneIdentifier, 'Public intake did not backfill a citizen phone identifier.');
assert(updatedPublicContactCitizen?.displayName === existingPublicContactCitizen.displayName, 'Public intake should not overwrite an existing citizen displayName.');
assert(updatedPublicContactCitizen?.email === existingPublicContactCitizen.email, 'Public intake should not overwrite an existing citizen email.');
await expectStatus(`/public/demo-belediye/tickets/${publicTicketRecord.ticketNo}`, 404);

const publicAuditLog = await request(`/tickets/${publicTicketRecord.id}/audit-log`, { token });
assert(
  publicAuditLog.body.some((entry) => entry.action === 'ticket.citizen_public_message_added' && entry.actorType === 'CITIZEN'),
  'Audit log missing citizen public message entry.',
);

await request(`/tickets/${publicTicketRecord.id}/status`, {
  method: 'POST',
  token,
  body: JSON.stringify({ status: 'REJECTED', publicMessage: 'Bu basvuru isleme alinamadi.' }),
});
await expectStatus(`/public/demo-belediye/tickets/${publicTicket.body.trackingToken}/messages`, 403, {
  method: 'POST',
  body: JSON.stringify({
    contact: publicPhone,
    body: 'Kapali basvuruya mesaj eklenmemeli.',
  }),
});
await expectStatus(`/public/yanlis-belediye/tickets/${publicTicket.body.trackingToken}`, 404);
const publicMessagesPayload = JSON.stringify(tracked.body.publicMessages);
assert(!publicMessagesPayload.includes('"senderType"'), 'Public messages leaked senderType.');
assert(tracked.body.publicMessages.every((message) => ['municipality', 'citizen'].includes(message.author)), 'Public messages missing safe author labels.');
const forbiddenPublicKeys = ['id', 'tenantId', 'ticketNo', 'citizenId', 'auditLogs', 'aiRuns', 'aiClassification', 'aiConfidence', 'internalNotes'];
for (const key of forbiddenPublicKeys) {
  assert(!Object.hasOwn(tracked.body, key), `Public ticket response leaked ${key}.`);
}
console.log('public_track', tracked.status, tracked.body.status);
console.log('public_safe_response', true);

section('ticket tenant validation');
await expectStatus('/tickets', 404, {
  method: 'POST',
  token,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Gecersiz citizen ${unique}`,
    description: 'Var olmayan citizen baglantisi reddedilmeli.',
    priority: 'NORMAL',
    departmentId: createdDepartment.body.id,
    citizenId: 'cm9999999999999999999999',
  }),
});
await expectStatus('/tickets', 403, {
  method: 'POST',
  token,
  body: JSON.stringify({
    channel: 'OPERATOR',
    title: `Kategori birim uyumsuz ${unique}`,
    description: 'Kategori ve birim uyumsuz oldugunda ticket olusmamali.',
    priority: 'NORMAL',
    departmentId: temizlikDepartment.id,
    categoryId: createdCategory.body.id,
  }),
});
console.log('ticket_tenant_validation', true);

section('citizen merge');
const mergeSource = await prisma.citizen.create({
  data: { tenantId: login.body.user.tenantId, displayName: `Merge Source ${unique}`, phone: `+9055500${unique}` },
});
const mergeTarget = await prisma.citizen.create({
  data: { tenantId: login.body.user.tenantId, displayName: `Merge Target ${unique}`, email: `merge-target-${unique}@example.test` },
});
// TENANT_ADMIN token'ı kullanıyoruz (login)
await expectStatus(`/citizens/${mergeSource.id}/merge`, 201, {
  method: 'POST',
  token,
  body: JSON.stringify({ mergeIntoId: mergeTarget.id }),
});
// Aynı kaydı tekrar birleştirmeye çalışmak hata vermeli
await expectStatus(`/citizens/${mergeSource.id}/merge`, 400, {
  method: 'POST',
  token,
  body: JSON.stringify({ mergeIntoId: mergeTarget.id }),
});
// Yanlış tenant citizen'ı birleştirmeye çalışmak 404 vermeli
await expectStatus(`/citizens/cm0000000000000000000000/merge`, 404, {
  method: 'POST',
  token,
  body: JSON.stringify({ mergeIntoId: mergeTarget.id }),
});
// Kendisiyle birleştirme 400 vermeli
await expectStatus(`/citizens/${mergeTarget.id}/merge`, 400, {
  method: 'POST',
  token,
  body: JSON.stringify({ mergeIntoId: mergeTarget.id }),
});
// Yetkisiz rol (STAFF token varsa) — bu smoke'da sadece admin token var, unauthorized (401) kontrolü
await expectStatus(`/citizens/${mergeTarget.id}/merge`, 401, {
  method: 'POST',
  body: JSON.stringify({ mergeIntoId: mergeSource.id }),
});
const mergedRecord = await prisma.citizen.findUnique({ where: { id: mergeSource.id } });
assert(mergedRecord?.mergedIntoCitizenId === mergeTarget.id, 'Merge did not set mergedIntoCitizenId');
assert(mergedRecord?.mergedAt !== null, 'Merge did not set mergedAt');
console.log('citizen_merge', true);

await prisma.$disconnect();
