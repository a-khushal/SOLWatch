import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import "dotenv/config";
import { Telegraf, Context } from "telegraf";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const RPC_URL = process.env.RPC_URL;

if (!BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN in .env");
}

if (!RPC_URL) {
    throw new Error("Missing RPC_URL in .env");
}

const bot = new Telegraf(BOT_TOKEN);
const connection = new Connection(RPC_URL, "confirmed");

interface WatchedEntry {
    subs: Set<number>;
    lastLamports: number;
}

const watched: Map<string, WatchedEntry> = new Map();

async function getBalanceLamports(address: string): Promise<number> {
    const pk = new PublicKey(address);
    return await connection.getBalance(pk);
}

bot.start((ctx: Context) => {
    ctx.reply("Hey! Use /subscribe <address> to watch a wallet.");
});

bot.command('balance', async (ctx: Context) => {
    // @ts-ignore
    const [, addr] = ctx.message?.text?.split(/\s+/) ?? [];
    if (!addr) {
        return ctx.reply("Usage: /balance <address>");
    }

    try {
        const balance = await getBalanceLamports(addr);
        const sol = balance / LAMPORTS_PER_SOL;
        ctx.reply(`${addr}\nBalance: ${sol} SOL`);
    } catch (error) {
        ctx.reply("❌ Invalid address");
    }
})

bot.command("subscribe", async (ctx: Context) => {
    // @ts-ignore
    const [, addr] = ctx.message?.text?.split(/\s+/) ?? [];
    if (!addr) {
        return ctx.reply("Usage: /subscribe <address>");
    }

    try {
        const lamports = await getBalanceLamports(addr);
        const value = watched.get(addr) || { subs: new Set<number>(), lastLamports: lamports };
        value.subs.add(ctx.chat?.id ?? 0);
        watched.set(addr, value);

        console.log(watched)

        ctx.reply(
            `Subscribed to ${addr}\nCurrent balance: ${(lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL`
        );
    } catch {
        ctx.reply("❌ Invalid address");
    }
});

bot.command("unsubscribe", (ctx: Context) => {
    // @ts-ignore
    const [, addr] = ctx.message?.text?.split(/\s+/) ?? [];
    if (!addr) {
        return ctx.reply("Usage: /unsubscribe <address>");
    }

    const entry = watched.get(addr);
    if (!entry) {
        return ctx.reply("Not subscribed.");
    }

    entry.subs.delete(ctx.chat?.id ?? 0);
    if (entry.subs.size === 0) {
        watched.delete(addr);
    }

    ctx.reply(`Unsubscribed from ${addr}`);
});

const POLL_INTERVAL_MS = 10_000;
const THRESHOLD = 0.1 * LAMPORTS_PER_SOL;

async function pollLoop() {
    for (const [addr, entry] of watched.entries()) {
        try {
            const lamports = await getBalanceLamports(addr);
            const diff = lamports - entry.lastLamports;

            if (Math.abs(diff) >= THRESHOLD) {
                const sol = lamports / LAMPORTS_PER_SOL;
                const changeSol = (diff / LAMPORTS_PER_SOL).toFixed(3);

                for (const chatId of entry.subs) {
                    await bot.telegram.sendMessage(
                        chatId,
                        `⚡ ${addr}\nBalance changed by ${changeSol} SOL\nNew: ${sol.toFixed(3)} SOL`
                    );
                }
            }
            entry.lastLamports = lamports;
        } catch (e: any) {
            console.error("Poll error:", addr, e.message);
        }
    }
    setTimeout(pollLoop, POLL_INTERVAL_MS);
}

bot.launch().then(() => {
    console.log("Bot is live");
    pollLoop();
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));pollLoop