import { createQueue } from './queues/create-queue.js';
import { queueNames } from './queues/queue-names.js';

const queues = Object.values(queueNames).map((name) => createQueue(name));

console.log('KentOS worker ready for SLA, notification, reporting and media queues.');
console.log(`Registered queues: ${queues.map((queue) => queue.name).join(', ')}`);

await Promise.all(queues.map((queue) => queue.close()));
