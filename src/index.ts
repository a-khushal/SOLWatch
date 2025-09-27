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

bot.launch().then(() => {
    console.log("Bot is live");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));