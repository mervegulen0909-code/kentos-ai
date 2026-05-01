const baseUrl = process.env.KENTOS_API_BASE_URL ?? 'http://127.0.0.1:3110/api/v1';

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

const health = await request('/health');
console.log('health', health.status);

const ready = await request('/health/ready');
console.log('ready', ready.status);

const login = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'admin@demo.local', password: 'ChangeMe123!' }),
});
console.log('login', login.status, Boolean(login.body.accessToken), Boolean(login.body.refreshToken));

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

const token = login.body.accessToken;
const readOnlyToken = readOnlyLogin.body.accessToken;
const departmentStaffToken = departmentStaffLogin.body.accessToken;
const departments = await request('/departments', { token });
console.log('departments', departments.body.length);

const fenDepartment = departments.body.find((department) => department.code === 'FEN_ISLERI');
if (!fenDepartment) throw new Error('Seeded FEN_ISLERI department not found for smoke.');
const temizlikDepartment = departments.body.find((department) => department.code === 'TEMIZLIK');
if (!temizlikDepartment) throw new Error('Seeded TEMIZLIK department not found for smoke.');

const unique = Date.now();
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
if (!firstTemplate) throw new Error('No seeded message template found for smoke.');
const updatedTemplate = await request(`/message-templates/${firstTemplate.id}`, {
  method: 'PATCH',
  token,
  body: JSON.stringify({ body: `${firstTemplate.body} ` }),
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
if (!departmentStaffTicketIds.includes(fenTicket.body.id)) throw new Error('Department staff cannot see own department ticket.');
if (departmentStaffTicketIds.includes(temizlikTicket.body.id)) throw new Error('Department staff can see another department ticket.');

const departmentStaffFenTicket = await request(`/tickets/${fenTicket.body.id}`, { token: departmentStaffToken });
console.log('department_staff_read_scope', departmentStaffFenTicket.status, departmentStaffFenTicket.body.department.id === fenDepartment.id);
await expectStatus(`/tickets/${temizlikTicket.body.id}`, 404, { token: departmentStaffToken });
const departmentStaffFilteredOutTickets = await expectStatus(`/tickets?departmentId=${temizlikDepartment.id}`, 200, { token: departmentStaffToken });
if (departmentStaffFilteredOutTickets.body.length !== 0) throw new Error('Department staff department filter returned out-of-scope tickets.');

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

const auditLog = await request(`/tickets/${operatorTicket.body.id}/audit-log`, { token });
console.log('ticket_audit', auditLog.status, auditLog.body.length > 0);

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
const forbiddenPublicKeys = ['id', 'tenantId', 'citizenId', 'auditLogs', 'aiRuns', 'aiClassification', 'aiConfidence', 'internalNotes'];
for (const key of forbiddenPublicKeys) {
  if (Object.hasOwn(tracked.body, key)) throw new Error(`Public ticket response leaked ${key}.`);
}
console.log('public_track', tracked.status, tracked.body.status);
console.log('public_safe_response', true);
