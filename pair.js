const express = require('express'); const fs = require('fs'); const pino = require('pino'); const { makeid } = require('./id'); const { default: France_King, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers } = require('@whiskeysockets/baileys');

const router = express.Router(); const codeCooldown = {};        // cooldown tracker: { number: timestamp } const sentNotifications = {};  // track sent notifications: { number: true } const COOLDOWN_MS = 30 * 1000; // 30 seconds cooldown

function removeFile(FilePath) { if (!fs.existsSync(FilePath)) return false; fs.rmSync(FilePath, { recursive: true, force: true }); }

router.get('/', async (req, res) => { const id = makeid(); let num = req.query.number;

if (!num) return res.status(400).send({ error: "Phone number is required." });

async function FLASH_MD_PAIR_CODE() {
    const authPath = `./temp/${id}`;
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    try {
        const client = France_King({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' }))
            },
            printQRInTerminal: false,
            logger: pino({ level: 'fatal' }),
            browser: Browsers.macOS('Chrome')
        });

        client.ev.on('creds.update', saveCreds);

        await delay(1500);
        num = num.replace(/[^0-9]/g, '');
        const now = Date.now();

        if (codeCooldown[num] && now - codeCooldown[num] < COOLDOWN_MS) {
            const wait = Math.ceil((COOLDOWN_MS - (now - codeCooldown[num])) / 1000);
            return res.status(429).send({ error: `Wait ${wait}s before requesting a new code.` });
        }

        codeCooldown[num] = now;
        const code = await client.requestPairingCode(num);

        if (!res.headersSent) {
            await res.send({ code });
        }

        if (!sentNotifications[num]) {
            await client.sendMessage(
                `${num}@s.whatsapp.net`,
                { text: `Enter this code to link your device: *${code}*` }
            );
            sentNotifications[num] = true;
            setTimeout(() => delete sentNotifications[num], COOLDOWN_MS);
        }

        client.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === 'open') {
                await delay(5000);
                try {
                    const data = fs.readFileSync(`${authPath}/creds.json`);
                    const b64data = Buffer.from(data).toString('base64');
                    const session = await client.sendMessage(client.user.id, { text: b64data });

                    const infoText = `

THANKYOU FOR CHOOSING ALONE MD 🔙💚☯️♡𝐃𝐑𝐈𝐏 𝐅𝐀𝐌𝐈𝐋𝐘  .. 🤼 💫 ╭━━━━❤━━━━╮ 💥VERY ACTIVE 🙅 🕊️𝐂𝐥𝐞𝐚𝐧 𝐚𝐥𝐰𝐚𝐲𝐬🍏 ╰━━━━🥺━━━━╯💚🔙 ❒ 𝐖𝐚𝐂𝐡𝐚𝐧𝐧𝐞𝐥: https://whatsapp.com/channel/0029VaeRrcnADTOKzivM0S1r follow our channel to learn how to deploy.. Repository available at our channel`;

await client.sendMessage(client.user.id, { text: infoText }, { quoted: session });
                } catch (err) {
                    console.error('Failed to send session data:', err);
                }

                await delay(100);
                await client.ws.close();
                removeFile(authPath);
            } else if (
                connection === 'close' &&
                lastDisconnect?.error?.output?.statusCode !== 401
            ) {
                await delay(10000);
                FLASH_MD_PAIR_CODE();
            }
        });
    } catch (err) {
        console.error('Error during pairing:', err);
        removeFile(authPath);
        if (!res.headersSent) {
            res.send({ code: 'Service is Currently Unavailable' });
        }
    }
}

await FLASH_MD_PAIR_CODE();

});

module.exports = router;

