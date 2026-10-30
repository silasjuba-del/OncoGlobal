const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
function createJsonStore(file) {
  let tail = Promise.resolve(), pending = 0;
  return {
    pending: () => pending,
    idle: () => tail,
    async read() {
      await tail;
      try { return JSON.parse(await fs.readFile(file, 'utf8')); }
      catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    },
    write(value) {
      const text = JSON.stringify(value); pending++;
      const next = tail.catch(() => {}).then(async () => {
        const temporary = `${file}.${randomUUID()}.tmp`;
        try { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(temporary, text, { encoding: 'utf8', flag: 'wx' }); await fs.rename(temporary, file); return true; }
        catch (error) { await fs.unlink(temporary).catch(() => {}); throw error; }
        finally { pending--; }
      });
      tail = next; return next;
    },
  };
}
module.exports = { createJsonStore };
