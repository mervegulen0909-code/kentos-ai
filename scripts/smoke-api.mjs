const baseUrl = process.env.KENTOS_API_BASE_URL ?? 'http://127.0.0.1:3110/api/v1';

function section(name) {
  console.log(`\n[${name}]`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  const body = text ? JSON.parse(text) : null;
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
  const body = text ? JSON.parse(text) : null;
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method ?? 'GET'} ${path} expected ${expectedStatus}, got ${response.status}: ${text}`);
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
const managerAnalyticsOverview = await request('/analytics/overview', { token: managerToken });
assert(typeof managerAnalyticsOverview.body.totalOpen === 'number', 'Manager analytics overview missing totalOpen.');
await expectStatus('/analytics/overview', 403, { token: operatorToken });
await expectStatus('/analytics/overview', 403, { token: departmentStaffToken });
await expectStatus('/analytics/overview', 403, { token: readOnlyToken });
const forbiddenAnalyticsKeys = ['citizen', 'citizens', 'citizenId', 'phone', 'email', 'auditLogs', 'messages', 'internalNotes', 'aiRuns', 'aiClassification'];
const analyticsPayload = JSON.stringify([analyticsOverview.body, analyticsDepartments.body]);
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
const managerTickets = await request('/tickets', { token: managerToken });
assert(managerTickets.body.some((ticket) => ticket.id === operatorMatrixTicket.body.id), 'Manager cannot see tenant ticket list.');
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

const departmentStaffTickets = await request('/tickets', { token: departmentStaffToken });
const departmentStaffTicketIds = departmentStaffTickets.body.map((ticket) => ticket.id);
assert(departmentStaffTicketIds.includes(fenTicket.body.id), 'Department staff cannot see own department ticket.');
assert(!departmentStaffTicketIds.includes(temizlikTicket.body.id), 'Department staff can see another department ticket.');

const departmentStaffFenTicket = await request(`/tickets/${fenTicket.body.id}`, { token: departmentStaffToken });
console.log('department_staff_read_scope', departmentStaffFenTicket.status, departmentStaffFenTicket.body.department.id === fenDepartment.id);
await expectStatus(`/tickets/${temizlikTicket.body.id}`, 404, { token: departmentStaffToken });
const departmentStaffFilteredOutTickets = await expectStatus(`/tickets?departmentId=${temizlikDepartment.id}`, 200, { token: departmentStaffToken });
assert(departmentStaffFilteredOutTickets.body.length === 0, 'Department staff department filter returned out-of-scope tickets.');

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

section('public safety');
const publicTicket = await request('/public/demo-belediye/tickets', {
  method: 'POST',
  body: JSON.stringify({
    description: 'Atatürk Mahallesi 12. Sokak önünde kaldırım çöktü.',
    phone: '+905551112233',
    addressText: 'Atatürk Mahallesi 12. Sokak',
  }),
});
console.log('public_create', publicTicket.status, publicTicket.body.ticketNo);

const tracked = await request(`/public/demo-belediye/tickets/${publicTicket.body.ticketNo}`);
await expectStatus(`/public/yanlis-belediye/tickets/${publicTicket.body.ticketNo}`, 404);
const forbiddenPublicKeys = ['id', 'tenantId', 'citizenId', 'auditLogs', 'aiRuns', 'aiClassification', 'aiConfidence', 'internalNotes'];
for (const key of forbiddenPublicKeys) {
  assert(!Object.hasOwn(tracked.body, key), `Public ticket response leaked ${key}.`);
}
console.log('public_track', tracked.status, tracked.body.status);
console.log('public_safe_response', true);
