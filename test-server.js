console.log('Test server bermula...');
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>RPH Automation - Server OK!</h1><p>Sila buka halaman ini di browser.</p>');
});
server.listen(3001, () => {
  console.log('Server OK di http://localhost:3001');
}).on('error', (e) => {
  console.log('ERROR:', e.message);
});
