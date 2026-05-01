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

const health = await request('/health');
console.log('health', health.status);

const ready = await request('/health/ready');
console.log('ready', ready.status);

const login = await request('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ tenantSlug: 'demo-belediye', email: 'admin@demo.local', password: 'ChangeMe123!' }),
});
console.log('login', login.status, Boolean(login.body.accessToken), Boolean(login.body.refreshToken));

const token = login.body.accessToken;
const departments = await request('/departments', { token });
console.log('departments', departments.body.length);

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
console.log('public_track', tracked.status, tracked.body.status);
