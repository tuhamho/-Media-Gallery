const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

async function main() {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
        throw new Error('Run this command in an interactive terminal so the password can be entered without echo.');
    }

    process.stdout.write('Admin password (hidden): ');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    let password = '';

    const readPassword = new Promise((resolve, reject) => {
        process.stdin.on('data', chunk => {
            for (const character of chunk.toString('utf8')) {
                if (character === '\u0003') {
                    reject(new Error('Cancelled.'));
                    return;
                }
                if (character === '\r' || character === '\n') {
                    resolve();
                    return;
                }
                if (character === '\u007f' || character === '\b') {
                    password = password.slice(0, -1);
                    continue;
                }
                password += character;
            }
        });
    });

    try {
        await readPassword;
    } finally {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
    }

    if (!password) throw new Error('Password must not be empty.');
    const salt = crypto.randomBytes(16);
    const derived = await scrypt(password, salt, 64);
    password = '';
    process.stdout.write(`scrypt$${salt.toString('hex')}$${derived.toString('hex')}\n`);
}

main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
});
