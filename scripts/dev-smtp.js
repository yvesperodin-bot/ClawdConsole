'use strict';

/**
 * Throwaway SMTP sink for local testing only — NOT part of the app.
 * Accepts messages on 127.0.0.1:2525 and writes each one to tmp/inbox/.
 * Start it, point SMTP_HOST/SMTP_PORT at it, and submit a report.
 */
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2] || 2525);
const OUT = path.join(__dirname, '..', 'tmp', 'inbox');
fs.mkdirSync(OUT, { recursive: true });

let count = 0;

net
  .createServer((socket) => {
    let inData = false;
    let buffer = '';
    let message = '';

    socket.write('220 dev-smtp ready\r\n');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      while (true) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) {
            message += buffer;
            buffer = '';
            return;
          }
          message += buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          count += 1;
          const file = path.join(OUT, `message-${Date.now()}-${count}.eml`);
          fs.writeFileSync(file, message);
          console.log('[dev-smtp] stored %s (%d bytes)', file, message.length);
          message = '';
          socket.write('250 2.0.0 Ok: queued\r\n');
          continue;
        }

        const nl = buffer.indexOf('\r\n');
        if (nl === -1) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        const verb = line.split(/\s+/)[0].toUpperCase();

        if (verb === 'EHLO' || verb === 'HELO') {
          socket.write('250-dev-smtp\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        } else if (verb === 'AUTH') {
          socket.write('235 2.7.0 Authentication successful\r\n');
        } else if (verb === 'MAIL' || verb === 'RCPT' || verb === 'RSET' || verb === 'NOOP') {
          socket.write('250 2.1.0 Ok\r\n');
        } else if (verb === 'DATA') {
          inData = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (verb === 'QUIT') {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
          return;
        } else {
          socket.write('250 2.0.0 Ok\r\n');
        }
      }
    });

    socket.on('error', () => {});
  })
  .listen(PORT, '127.0.0.1', () => console.log('[dev-smtp] listening on 127.0.0.1:%d', PORT));
